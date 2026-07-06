import type { ComputedRef, Ref } from 'vue';
import type { DemoTrack } from '~/composables/useDemoTracks';

/* useDemoMenu - the demo-track menu model and its two openers.

   Owns how the flat, sorted track list becomes menu rows (group headings and
   separator rules between groups) and the "Pick a demo" fork: on desktop it
   reaches into the transport's dropdown; on phones the transport is hidden
   during onboarding, so it opens the dedicated overlay instead. */

export type DemoMenuItem =
    | { type: 'label'; label: string }
    | { type: 'separator'; class?: string }
    | { label: string; value: string };

const SEP_WHITE = 'bg-(--brand-white)';
const SEP_RED = 'bg-[var(--brand-primary)]';

/** Fold the sorted track list into menu rows. Groups and their order come
 *  entirely from the audio subfolders (see the audio-manifest module): each
 *  group opens with a white rule (except the first), its heading (uppercased
 *  via CSS) and a red rule, then its tracks. Pure - unit-tested directly. */
export const buildDemoMenuItems = (tracks: readonly Pick<DemoTrack, 'id' | 'name' | 'group'>[]): DemoMenuItem[] => {
    const items: DemoMenuItem[] = [];
    let currentGroup: string | null = null;
    for (const t of tracks) {
        if (t.group !== currentGroup) {
            if (currentGroup !== null) items.push({ type: 'separator', class: SEP_WHITE });
            items.push({ type: 'label', label: t.group });
            items.push({ type: 'separator', class: SEP_RED });
            currentGroup = t.group;
        }
        items.push({ label: t.name, value: t.id });
    }
    return items;
};

interface UseDemoMenuOptions {
    sortedDemoTracks: ComputedRef<DemoTrack[]> | Ref<DemoTrack[]>;
    isDesktop: Ref<boolean> | ComputedRef<boolean>;
    /** The transport bar's exposed handle (null until mounted / while hidden). */
    transportRef: Ref<{ openDemoMenu: () => void } | null>;
    /** Load the chosen track (the orchestrator's handleSelectDemoTrack). */
    selectTrack: (id: string) => void;
}

export function useDemoMenu(options: UseDemoMenuOptions) {
    const { sortedDemoTracks, isDesktop, transportRef, selectTrack } = options;

    const demoTrackItems = computed(() => buildDemoMenuItems(sortedDemoTracks.value));

    const showDemoOverlay = ref(false);

    const onPickDemo = () => {
        if (isDesktop.value) transportRef.value?.openDemoMenu();
        else showDemoOverlay.value = true;
    };

    const onPickDemoTrack = (id: string) => {
        selectTrack(id);
        showDemoOverlay.value = false;
    };

    return {
        demoTrackItems,
        showDemoOverlay,
        onPickDemo,
        onPickDemoTrack,
    };
}
