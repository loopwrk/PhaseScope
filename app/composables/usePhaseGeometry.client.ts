import * as THREE from 'three';
import { toRaw } from 'vue';
import type { Ref } from 'vue';
import {
    analyzeLocalFrequency,
    freqContentToHz,
    ampToOscillationRange,
    createSpectralAnalyzer,
    pitchChromaHue,
} from '~/utils/audio/analysis';
import { precomputeAttractorSpine } from '~/utils/attractor';
import { channelBiasTransform, CHANNEL_BIAS_Z_KEEP } from '~/utils/channelBias';
import { TOPOLOGIES } from '~/utils/topologies';
import type { CorridorState, CorridorMeta, TopologyMode } from '~/utils/topologies';
import type { RenderMode, useCorridorRenderer } from '~/composables/useCorridorRenderer.client';

/* usePhaseGeometry - the audio-to-geometry engine.

   Owns the corridor state (decoded channels + preallocated GPU-bound
   arrays), the per-topology frame mappers and registry, and the
   progressive build that paces geometry to audio playback. The page
   supplies the renderer, the reactive modes, and the playback clock;
   everything that writes into the position/colour buffers lives here.

   The per-topology frame mappers, the TOPOLOGIES registry and the shared
   geometry types (TopologyMode, CorridorState, CorridorMeta, OrbitParams)
   now live in ~/utils/topologies; this file owns only the build engine. */

// Performance warning thresholds. Tuned for the optimised engine (ranged
// GPU uploads, shared buffers, shader-side oscillation): the old limits
// were upload/CPU-bound; the remaining ceiling is raw vertex throughput.
const POINTS_WARNING_THRESHOLD = 8_000_000;
const POINTS_DANGER_THRESHOLD = 20_000_000;

interface UsePhaseGeometryOptions {
    renderer: ReturnType<typeof useCorridorRenderer>;
    renderMode: Ref<RenderMode>;
    topologyMode: Ref<TopologyMode>;
    /** The wav player's reactive audio state (for the point-budget computeds) */
    audio: { buffer: AudioBuffer | null };
}

export function usePhaseGeometry(options: UsePhaseGeometryOptions) {
    const { renderer, renderMode, topologyMode, audio } = options;

    const corridorState = ref<CorridorState>({
        buffer: null,
        live: false,
        sr: 0,
        ch0: null,
        ch1: null,
        frameCount: 0,
        xyScale: 1.8,
        ringRadius: 1.8,
        builtFrames: 0,
        pos: null,
        attractorSpine: null,
        attractorNormals: null,
        attractorBinormals: null,
    });

    // GPU-bound oscillation side buffer (half floats: pointFreq, pointAmp,
    // frameAvgFreq, frameAvgAmp per point), written during the build and
    // displaced in the vertex shader - see useCorridorRenderer.
    let oscData: Uint16Array | null = null;

    // Per-frame colour source: a real spectral centroid via a windowed FFT.
    // Allocated once (preallocated FFT + window + scratch), reused every frame.
    // 1024-sample window (~23ms): the smallest size that still gives an honest
    // centroid, and half the cost of 2048 - measured FFT cost is then a minority
    // of per-frame build time, behind the per-point colour loop.
    const spectral = createSpectralAnalyzer(1024);

    // User-tweakable settings live in useState (keys documented in
    // useScopeSettings) so they survive navigation away from the page.
    const corridorMeta = usePersistedState<CorridorMeta>('scope:corridor-meta', () => ({
        zStep: 0.08, // distance between frames along Z axis
        pointsPerFrame: 512,
        windowSize: 2048, // samples per frame window
        hopSize: 1024, // samples between frames
    }));

    // Track coverage as percentage (0-100)
    const trackCoveragePercent = usePersistedState('scope:track-coverage', () => 100);

    // Reverse colour spectrum (the V shortcut / settings toggle)
    const useAlternateColors = usePersistedState('scope:reverse-colours', () => false);

    // Colour by pitch: the spectral centroid's chroma drives the FULL colour
    // wheel (one cycle per octave) instead of the bass->treble ramp. Toggling
    // repaints the built corridor (like channel bias), so the change is total
    // rather than only applying to frames built from the playhead on.
    const colourByPitch = usePersistedState('scope:colour-by-pitch', () => true);
    watch(colourByPitch, () => {
        if (renderer.hasGeometry()) corridorState.value.builtFrames = 0; // rebuild to playhead
    });

    // Channel bias: the stereo field pulled apart into left/right
    // populations - works in every topology. Lines would bridge the gap
    // with long jumps, so the toggle locks render mode to points; and the
    // time-budgeted build makes a full retro-rebuild cheap, so flipping it
    // repaints the whole structure rather than only new frames.
    const channelBias = usePersistedState('scope:channel-bias', () => false);
    watch(channelBias, (on) => {
        if (on) renderMode.value = 'points';
        if (renderer.hasGeometry()) corridorState.value.builtFrames = 0; // rebuild to playhead
    });
    // Defensive half of the two-way exclusion: even if the disabled radio
    // is bypassed (shortcut, stale UI), lines and channel bias never coexist
    watch(renderMode, (mode) => {
        if (mode === 'lines' && channelBias.value) renderMode.value = 'points';
    });

    /* ---------- Point budget / performance computeds ---------- */

    // Total frames possible for the loaded audio
    const totalFramesForTrack = computed(() => {
        if (!audio.buffer) return 0;
        const { windowSize, hopSize } = corridorMeta.value;
        return Math.max(0, Math.floor((audio.buffer.length - windowSize) / hopSize));
    });

    // Total points needed for the full track at current pointsPerFrame
    const totalPointsForFullTrack = computed(() => {
        return totalFramesForTrack.value * corridorMeta.value.pointsPerFrame;
    });

    // Effective max points after the coverage slider
    const effectiveMaxPoints = computed(() => {
        const fullPoints = totalPointsForFullTrack.value;
        return Math.floor(fullPoints * (trackCoveragePercent.value / 100));
    });

    const pointsWarningLevel = computed<'none' | 'warning' | 'danger'>(() => {
        const points = effectiveMaxPoints.value;
        if (points >= POINTS_DANGER_THRESHOLD) return 'danger';
        if (points >= POINTS_WARNING_THRESHOLD) return 'warning';
        return 'none';
    });

    // Format large numbers for display
    const formatPointCount = (count: number): string => {
        if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
        if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`;
        return count.toString();
    };

    /* ---------- Lifecycle ---------- */

    const clear = () => {
        renderer.clearGeometry();
        corridorState.value.buffer = null;
        corridorState.value.live = false;
        liveHops = 0;
        liveHopBase = -1;
        corridorState.value.sr = 0;
        corridorState.value.ch0 = null;
        corridorState.value.ch1 = null;
        corridorState.value.frameCount = 0;
        corridorState.value.builtFrames = 0;
        corridorState.value.pos = null;
        oscData = null;
        corridorState.value.attractorSpine = null;
        corridorState.value.attractorNormals = null;
        corridorState.value.attractorBinormals = null;
    };

    const initFromBuffer = (buffer: AudioBuffer) => {
        clear();

        const sr = buffer.sampleRate;
        const ch0 = buffer.getChannelData(0);
        const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;

        const { windowSize, hopSize, pointsPerFrame } = corridorMeta.value;
        const totalFrames = Math.floor((ch0.length - windowSize) / hopSize);

        // Calculate max frames based on percentage-based point budget
        // Use buffer directly here to avoid reactivity timing issues with computeds
        const totalPointsForBuffer = totalFrames * pointsPerFrame;
        const maxPointsForCoverage = Math.floor(totalPointsForBuffer * (trackCoveragePercent.value / 100));
        const maxFrames = Math.floor(maxPointsForCoverage / pointsPerFrame);
        const frameCount = Math.max(1, Math.min(totalFrames, maxFrames));

        corridorState.value.buffer = buffer;
        corridorState.value.sr = sr;
        corridorState.value.ch0 = ch0;
        corridorState.value.ch1 = ch1;
        corridorState.value.frameCount = frameCount;
        corridorState.value.builtFrames = 0;

        const totalPoints = frameCount * pointsPerFrame;

        const topology = TOPOLOGIES[topologyMode.value];

        // Attractor topology: pre-compute Lorenz spine and Frenet frames at load time
        if (topology.needsAttractorSpine) {
            const { spine, normals, binormals } = precomputeAttractorSpine(frameCount, ch0, hopSize);
            corridorState.value.attractorSpine = spine;
            corridorState.value.attractorNormals = normals;
            corridorState.value.attractorBinormals = binormals;
        }

        // Create geometries using the renderer, at the topology's object-space offsets
        const { positions, oscData: osc } = renderer.createGeometry({
            totalPoints,
            renderMode,
            ...topology.geometry,
        });

        corridorState.value.pos = positions;
        oscData = osc;
    };

    /* ---------- Live build (input drawn over a bounded stretch of time) ----------

       Live geometry is a one-shot build: frame slots fill in order as
       hops of fresh audio arrive, and when the last slot fills the
       drawing comes to a hard stop - the synth keeps sounding, only the
       geometry freezes. Nothing wraps except the AUDIO ring the synth
       captures into: slot s reads samples at (s * hopSize) % ringLength,
       which is where hop s's audio lives as long as the build stays
       within the ring's reach of real time (the budgeted catch-up keeps
       it there through stalls).

       Every canvas spans a user-chosen session length (the card's
       chips, 5s-10min); the attractor sits live mode out, since its
       Lorenz spine wants the full signal up front.

       The clock ARMS on the first note: nothing builds (and the window
       does not run down) until armLiveClock anchors hop 0 at that
       moment - silence before the first note costs no time and draws no
       geometry. */

    let liveHops = 0; // hops consumed == next slot to fill (monotonic, no wrap)
    let liveHopBase = -1; // hop of the first note; -1 = clock not yet armed

    const initLive = (
        ring: { ch0: Float32Array; ch1: Float32Array; sr: number; ringLength: number },
        opts: { durationSeconds: number }
    ) => {
        clear();

        const { hopSize, pointsPerFrame } = corridorMeta.value;
        const frameCount = Math.max(1, Math.floor((opts.durationSeconds * ring.sr) / hopSize));

        corridorState.value.live = true;
        corridorState.value.sr = ring.sr;
        corridorState.value.ch0 = ring.ch0;
        corridorState.value.ch1 = ring.ch1;
        corridorState.value.frameCount = frameCount;
        corridorState.value.builtFrames = 0;

        const topology = TOPOLOGIES[topologyMode.value];
        const { positions, oscData: osc } = renderer.createGeometry({
            totalPoints: frameCount * pointsPerFrame,
            renderMode,
            ...topology.geometry,
        });
        corridorState.value.pos = positions;
        oscData = osc;

        liveHops = 0;
        liveHopBase = -1; // armed by the first note
    };

    /** Anchor the live clock at the first note (idempotent). Until this
     *  fires, no geometry builds and the window does not run down. */
    const armLiveClock = (samplesWritten: number) => {
        if (!corridorState.value.live || liveHopBase >= 0) return;
        liveHopBase = Math.max(0, Math.floor(samplesWritten / corridorMeta.value.hopSize));
    };

    const updateLiveBuild = (samplesWritten: number) => {
        if (!renderer.hasGeometry() || !corridorState.value.live) return;

        const { hopSize, windowSize, pointsPerFrame } = corridorMeta.value;
        const { frameCount } = corridorState.value;
        const ringLength = corridorState.value.ch0?.length ?? 0;
        if (!ringLength) return;

        // The clock arms on the first note; the hard stop ends the drawing
        if (liveHopBase < 0 || liveHops >= frameCount) return;

        // Only build hops whose full analysis window has been written,
        // counted from the armed clock's anchor
        const effectiveSamples = samplesWritten - liveHopBase * hopSize;
        const targetHops = Math.min(frameCount, Math.floor((effectiveSamples - windowSize) / hopSize));
        if (targetHops <= liveHops) return;

        const BUILD_BUDGET_MS = 4;
        const MAX_FRAMES_PER_TICK = 64;
        const startedAt = performance.now();

        let built = 0;
        while (
            liveHops < targetHops &&
            built < MAX_FRAMES_PER_TICK &&
            performance.now() - startedAt < BUILD_BUDGET_MS
        ) {
            buildOneFrame(liveHops, ((liveHopBase + liveHops) * hopSize) % ringLength);
            renderer.uploadBuiltRange(liveHops * pointsPerFrame, pointsPerFrame);
            liveHops++;
            built++;
        }

        // The corridor's draw range grows with the column; prebuilt closed
        // forms are already at full range and stay there
        corridorState.value.builtFrames = Math.max(corridorState.value.builtFrames, liveHops);
        renderer.updateDrawRange(corridorState.value.builtFrames * pointsPerFrame);
    };

    /** Where the head currently is: the latest filled frame. In live
     *  mode that is the build cursor (parked on the final frame after the
     *  hard stop); for tracks it is the build frontier. -1 = none yet. */
    const headFrameIndex = () => {
        const { live, frameCount, builtFrames } = corridorState.value;
        if (!live) return builtFrames - 1;
        return Math.min(liveHops, frameCount) - 1;
    };

    /* ---------- Frame building (shared pipeline) ---------- */

    const buildOneFrame = (frameIndex: number, sampleStart?: number) => {
        // Writes a single frame into the preallocated position/colour buffers.
        const meta = corridorMeta.value;
        const { pointsPerFrame, windowSize, hopSize } = meta;
        // Use toRaw to ensure we write to the actual Float32Arrays, not Vue proxies
        const rawState = toRaw(corridorState.value);
        const { ch0, ch1, pos } = rawState;
        if (!pos || !ch0 || !ch1 || !renderer.hasGeometry()) return;
        if (!oscData) return;

        const frame = TOPOLOGIES[topologyMode.value].frameMapper(frameIndex, rawState, meta);
        if (!frame) return;

        // Live mode passes the slot's address in the audio ring; track mode
        // reads the frame's natural position in the decoded buffer
        const frameStart = sampleStart ?? frameIndex * hopSize;

        // Each frame occupies a contiguous block.
        let p = frameIndex * pointsPerFrame * 3;
        const colors = renderer.getColorArray();
        if (!colors) return;

        // Reuse a single Color object to avoid allocating one per point
        const color = new THREE.Color();

        // Per-frame colour from a REAL spectral centroid: one windowed FFT of
        // the L+R mix at the frame centre (see createSpectralAnalyzer). Frequency
        // content is steady within a frame's ~23ms window, so once per frame is
        // plenty - and cheap next to the per-point loop below. The analyzer
        // windows and zero-pads internally, so the centre can sit anywhere.
        const frameCenterSample = clamp(frameStart + windowSize / 2, 0, ch0.length - 1);
        const centroidHz = spectral.centroidHz(ch0, ch1, frameCenterSample - spectral.size / 2, rawState.sr || 48000);

        // Hue from the spectral centroid (one colour per frame). Two mappings:
        //  - Spectrum (default): bass = BLUE/MAGENTA -> treble = RED across 75%
        //    of the wheel; reverse flips it.
        //  - Pitch: the centroid's chroma walks the FULL wheel once per octave,
        //    so a pitch keeps its colour in every octave - vivid, and far more
        //    reactive on tonal material.
        const hueRangeMultiplier = 0.75;
        let hue: number;
        if (colourByPitch.value) {
            hue = pitchChromaHue(centroidHz);
        } else {
            const freqContent = spectral.hzTo01(centroidHz); // 0 = low freq, 1 = high freq
            hue = useAlternateColors.value
                ? freqContent * hueRangeMultiplier
                : hueRangeMultiplier - freqContent * hueRangeMultiplier;
        }
        const baseSaturation = 0.92;
        const baseLightness = 0.35;
        const amplitudeBrightnessFactor = 0.35;

        // Frame-average amplitude for the intensity / frequency modes (the
        // frame's oscillation frequency is the real spectral centroid above, not
        // an average of the per-point proxies)
        let sumAmp = 0;

        for (let k = 0; k < pointsPerFrame; k++) {
            const u = (k / pointsPerFrame) * Math.PI * 2;
            const sampleIndex = frameStart + Math.floor((k / pointsPerFrame) * windowSize);
            const i = clamp(sampleIndex, 0, ch0.length - 1);

            const L = ch0[i] ?? 0;
            const R = ch1[i] ?? 0;
            const normalizedAmp = clamp(Math.sqrt(L * L + R * R), 0, 1);

            let transformed = frame.mapPoint(u, L, R, normalizedAmp);
            if (channelBias.value) {
                transformed = channelBiasTransform(transformed, { L, R, normalizedAmp, frameIndex, uAngle: u }, 1);
            }

            pos[p] = transformed.x;
            pos[p + 1] = transformed.y;
            pos[p + 2] = transformed.z;

            // Lightness/saturation vary per point with amplitude
            const lightness = baseLightness + normalizedAmp * amplitudeBrightnessFactor;
            const saturation = clamp(baseSaturation + normalizedAmp * (1 - baseSaturation), baseSaturation, 1);
            color.setHSL(hue, saturation, lightness);
            colors[p] = color.r;
            colors[p + 1] = color.g;
            colors[p + 2] = color.b;

            // Oscillation data rides to the GPU as half floats (aOsc.xy);
            // positions stay pristine anchors - displacement is shader-side
            const pointFreq = freqContentToHz(analyzeLocalFrequency(ch0, ch1, i));
            const pointAmp = ampToOscillationRange(normalizedAmp);
            const o = (frameIndex * pointsPerFrame + k) * 4;
            oscData[o] = THREE.DataUtils.toHalfFloat(pointFreq);
            oscData[o + 1] = THREE.DataUtils.toHalfFloat(pointAmp);
            sumAmp += pointAmp;

            p += 3;
        }

        // Stamp the frame's oscillation summary into every point's aOsc.zw - the
        // GPU can't reduce across vertices, so it happens here, once. aOsc.z is
        // the real spectral centroid (Hz) that the Frequency mode oscillates at;
        // aOsc.w is the mean amplitude.
        const centroidHalf = THREE.DataUtils.toHalfFloat(centroidHz);
        const avgAmpHalf = THREE.DataUtils.toHalfFloat(sumAmp / pointsPerFrame);
        const frameBase = frameIndex * pointsPerFrame * 4;
        for (let k = 0; k < pointsPerFrame; k++) {
            oscData[frameBase + k * 4 + 2] = centroidHalf;
            oscData[frameBase + k * 4 + 3] = avgAmpHalf;
        }
    };

    /* ---------- Progressive build paced to playback ---------- */

    const getTargetFrameForPlayback = (playbackSeconds: number) => {
        // Map playback time to a frame index.
        if (!corridorState.value.buffer) return 0;
        const sample = Math.floor(playbackSeconds * corridorState.value.sr);
        const { windowSize, hopSize } = corridorMeta.value;
        // frame 0 corresponds to window starting at sample 0
        const f = Math.floor((sample - windowSize) / hopSize);
        return clamp(f, 0, Math.max(0, corridorState.value.frameCount - 1));
    };

    const updateProgressiveBuild = (playbackSeconds: number) => {
        // Build frames progressively up to the current playback-derived target.
        if (!renderer.hasGeometry() || !corridorState.value.buffer) return;

        const targetFrame = getTargetFrameForPlayback(playbackSeconds);
        const remaining = targetFrame - corridorState.value.builtFrames;
        if (remaining <= 0) return;

        // Time-budgeted building: spend at most ~4ms of the frame, however
        // many frames that buys on this machine (always at least one). After
        // a seek or a heavy load the corridor catches up at CPU speed
        // instead of a fixed 6 frames/tick crawl, and on slow machines the
        // budget keeps build ticks from starving the render loop.
        const BUILD_BUDGET_MS = 4;
        const MAX_FRAMES_PER_TICK = 256; // bound the per-tick GPU upload span
        const startedAt = performance.now();
        const firstFrame = corridorState.value.builtFrames;

        let built = 0;
        do {
            buildOneFrame(corridorState.value.builtFrames);
            corridorState.value.builtFrames++;
            built++;
        } while (built < remaining && built < MAX_FRAMES_PER_TICK && performance.now() - startedAt < BUILD_BUDGET_MS);

        const { pointsPerFrame } = corridorMeta.value;

        // Update geometry: draw the new total, upload ONLY the new span
        renderer.updateDrawRange(corridorState.value.builtFrames * pointsPerFrame);
        renderer.uploadBuiltRange(firstFrame * pointsPerFrame, built * pointsPerFrame);
    };

    /** The head's anchor as actually rendered, for head-anchored topologies
     *  (corridor, Möbius). Each topology supplies the pure geometry via its
     *  headAnchor; the only reactive adjustment is the corridor's channel-bias
     *  z-crush, so the camera follows the crushed head. { x:0,y:0,z:0 } for
     *  centre-orbiting topologies that have no head anchor. */
    const transformHeadAnchor = (frameIndex: number) => {
        const topology = TOPOLOGIES[topologyMode.value];
        const anchor = topology.headAnchor?.(frameIndex, toRaw(corridorState.value), corridorMeta.value) ?? {
            x: 0,
            y: 0,
            z: 0,
        };
        // Corridor's stereo split crushes z; the camera must follow the head.
        if (topologyMode.value === 'corridor' && channelBias.value) anchor.z *= CHANNEL_BIAS_Z_KEEP;
        return anchor;
    };

    return {
        corridorState,
        corridorMeta,
        trackCoveragePercent,
        useAlternateColors,
        colourByPitch,
        channelBias,
        effectiveMaxPoints,
        pointsWarningLevel,
        formatPointCount,
        clear,
        initFromBuffer,
        updateProgressiveBuild,
        initLive,
        armLiveClock,
        updateLiveBuild,
        headFrameIndex,
        transformHeadAnchor,
    };
}
