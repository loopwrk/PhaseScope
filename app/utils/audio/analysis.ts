// Audio Analysis Utilities

// Frequency analysis window sizes (in samples)
export const ANALYSIS_WINDOW_TEMPORAL = 256; // Fast response, good for percussion/transients
export const ANALYSIS_WINDOW_BALANCED = 512; // Balanced time/frequency resolution
export const ANALYSIS_WINDOW_SPECTRAL = 2048; // Detailed frequency, good for sustained tones

export type FrequencyResolution = "temporal" | "balanced" | "spectral";

export const getAnalysisWindowSize = (
  resolution: FrequencyResolution,
): number => {
  switch (resolution) {
    case "temporal":
      return ANALYSIS_WINDOW_TEMPORAL;
    case "spectral":
      return ANALYSIS_WINDOW_SPECTRAL;
    case "balanced":
    default:
      return ANALYSIS_WINDOW_BALANCED;
  }
};

// Analyze frequency content using derivative energy (rate of change)
export const analyzeFrequencyBand = (
  data: Float32Array,
  startIdx: number,
  windowLen: number,
): number => {
  // Ensure integer indices to avoid fractional array access (e.g. data[123.5])
  const safeStartIdx = Math.max(0, Math.floor(startIdx));
  const minSamples = 8;
  const endIdx = Math.min(safeStartIdx + windowLen, data.length);
  const actualLen = endIdx - safeStartIdx;
  const midFreq = 0.5;
  if (actualLen < minSamples) return midFreq;

  let amplitudeEnergy = 0; // Energy in the signal itself (slow changes)
  let changeEnergy = 0; // Energy in the derivative (fast changes)

  // Calculate energy in signal and its derivative
  for (let i = safeStartIdx; i < endIdx - 1; i++) {
    const sample = data[i] ?? 0;
    const nextSample = data[i + 1] ?? 0;
    const derivative = nextSample - sample; // Rate of change

    amplitudeEnergy += sample * sample;
    changeEnergy += derivative * derivative;
  }

  // Normalize energies
  amplitudeEnergy = Math.sqrt(amplitudeEnergy / actualLen);
  changeEnergy = Math.sqrt(changeEnergy / actualLen);

  const totalEnergy = amplitudeEnergy + changeEnergy;
  if (totalEnergy < 0.001) return midFreq; // Silence

  // More high energy = higher frequencies
  const highRatio = changeEnergy / totalEnergy;

  // Map to 0-1 range with enhanced contrast
  const contrastMultiplier = 3;
  return clamp(highRatio * contrastMultiplier, 0, 1);
};

// Convert normalized frequency content (0-1) to Hz using logarithmic scale

export const freqContentToHz = (
  freqContent: number,
  minHz: number = 100,
  maxHz: number = 8000,
): number => {
  return minHz * Math.pow(maxHz / minHz, freqContent);
};

// Map normalized amplitude (0-1) to oscillation amplitude range

export const ampToOscillationRange = (
  normalizedAmp: number,
  minAmp: number = 0.005, // Minimum oscillation amplitude (default: 0.005)
  maxAmp: number = 0.05, //  Maximum oscillation amplitude (default: 0.05)
): number => {
  const clampedAmp = clamp(normalizedAmp, 0, 1);
  const range = maxAmp - minAmp;
  return clampedAmp * range + minAmp;
};
