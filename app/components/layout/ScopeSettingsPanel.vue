<script setup lang="ts">
/* ScopeSettingsPanel - display settings for the 3D Lissajous scope, shown
   while it is active (it rises in above the goniometer). Titled "Scope
   Settings" rather than a second "Display Settings" so assistive tech
   never announces two identically-named regions. Takes useLissajous3D's
   settings as one `model`; the actual controls live in
   ScopeSettingsControls (shared with the mobile scope-settings overlay) -
   this file owns only the collapsible glass-panel chrome. */
import Panel from '../ds/Panel.vue';
import IconButton from '../ds/IconButton.vue';
import ScopeSettingsControls from './ScopeSettingsControls.vue';
import type { ScopeSettingsModel } from '~/composables/useLissajous3D.client';

// Panel-local UI state, persisted like every other scope:* setting
const open = usePersistedState<boolean>('scope:liss-panel-open', () => true);

defineProps<{ model: ScopeSettingsModel }>();
</script>

<template>
    <Panel variant="glass" title="Scope Settings" class="w-64">
        <template #headerRight>
            <IconButton
                :icon="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
                variant="ghost"
                class="mr-0"
                size="sm"
                :aria-label="open ? 'Collapse scope settings' : 'Expand scope settings'"
                :aria-expanded="open"
                @click="open = !open"
            />
        </template>
        <div
            class="transition-all duration-300 ease-(--motion-ease-out)"
            :class="open ? 'max-h-[40rem]' : '-my-(--space-4) max-h-0 overflow-hidden opacity-0'"
            :inert="!open"
        >
            <ScopeSettingsControls :model="model" />
        </div>
    </Panel>
</template>
