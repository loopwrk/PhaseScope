<script setup lang="ts">
/* ScopeSettingsPanel - display settings for the 3D Lissajous scope, shown
   while it is active (it rises in above the goniometer). Titled "Scope
   Settings" rather than a second "Display Settings" so assistive tech
   never announces two identically-named regions. Controlled: every
   setting is a v-model onto useLissajous3D's persisted refs. The controls
   live in ScopeSettingsControls (shared with the mobile scope-settings
   overlay); this file owns only the collapsible glass-panel chrome. */
import Panel from '../ds/Panel.vue';
import IconButton from '../ds/IconButton.vue';
import ScopeSettingsControls from './ScopeSettingsControls.vue';

// Panel-local UI state, persisted like every other scope:* setting
const open = usePersistedState<boolean>('scope:liss-panel-open', () => true);

const dimension = defineModel<'3d' | '2d'>('dimension', { default: '3d' });
const lineWidth = defineModel<number>('lineWidth', { default: 1 });
const colourMode = defineModel<'spectrum' | 'average' | 'custom'>('colourMode', { default: 'spectrum' });
const customColour = defineModel<string>('customColour', { default: '#2fd4e6' });
const waveform = defineModel<boolean>('waveform', { default: false });
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
            <ScopeSettingsControls
                v-model:dimension="dimension"
                v-model:line-width="lineWidth"
                v-model:colour-mode="colourMode"
                v-model:custom-colour="customColour"
                v-model:waveform="waveform"
            />
        </div>
    </Panel>
</template>
