<script setup lang="ts">
/* Demo harness for the Toast story - buttons that fire each toast kind.
   Toasts appear in the <UApp> toaster (corner of the preview). */
import Button from '../app/components/ds/Button.vue';
import { usePsToast } from '../app/composables/usePsToast';

const { show } = usePsToast();
</script>

<template>
    <div style="display: flex; flex-wrap: wrap; gap: 12px">
        <Button variant="secondary" label="Info" @click="show('info', 'Topology changed', 'Time becomes latitude.')" />
        <Button variant="secondary" label="Success" @click="show('success', 'Track loaded')" />
        <Button
            variant="secondary"
            label="Warning"
            @click="show('warning', '3.3M points', 'May impact performance on some devices.')"
        />
        <Button
            variant="danger"
            label="Error"
            @click="show('error', 'Decode failed', 'Could not read the audio file.')"
        />
        <Button variant="primary" label="Live" @click="show('live', 'Now playing', 'a-03-esperaphora')" />
    </div>
</template>
