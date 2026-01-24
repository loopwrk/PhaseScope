<script setup lang="ts">

const play = usePlayAudio();
const selectedNote = ref("C4");
const simpleSynthNotes = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];
const noteSequence = ref(["C4", "C4", "G4", "G4", "A4", "A4", "G4"])

const addNoteToSequence = (note: string) => {
  noteSequence.value.push(note);
}

const removeNoteFromSequence = (index: number) => {
  noteSequence.value.splice(index, 1);
}

const resetNoteSequence = () => {
  noteSequence.value = ["C4", "C4", "G4", "G4", "A4", "A4", "G4"];
}

const clearNoteSequence = () => {
  noteSequence.value = [];
}

definePageMeta({
  title: "Tone.js - Learning Environment",
});
</script>


<template>
  <div>
    <div class="mb-8">
      <oscilloscope v-if="play.waveform" />
    </div>
    <div class="flex mb-16">
      <PlayPauseButton @click="play.singleNote(selectedNote)" :animate-on-play="false"
        :show-pause-when-playing="false" />
      <fieldset class="note-group" role="group">
        <legend id="play-single-note">Play single note</legend>
        <div class="flex flex-wrap gap-2" aria-labelledby="play-single-note">
          <UButton v-for="note in simpleSynthNotes" :key="note" class="text-amber-100"
            :class="['w-10 justify-center', selectedNote === note ? 'liquid-wheel' : '']" size="md"
            @click="selectedNote = note" color="primary">
            {{ note.replace('4', '') }}
          </UButton>
        </div>
      </fieldset>
    </div>
    <div class="flex mb-16">
      <PlayPauseButton @click="play.multipleNotes(noteSequence)" :show-pause-when-playing="false" />
      <fieldset class="note-group w-full" role="group">
        <legend id="play-note-sequence">Play note sequence</legend>
        <div class="note-options flex flex-wrap gap-2 mb-4">
          <div v-for="note in simpleSynthNotes" :key="note" class="addable-note group relative">
            <UButton variant="outline"
              class="w-10 justify-center cursor-pointer transition-all duration-150 group-hover:ring-1 group-hover:ring-primary group-hover:scale-105"
              size="md" @click="addNoteToSequence(note)" color="primary">
              {{ note.replace('4', '') }}
            </UButton>
            <div
              class="absolute -translate-x-2 -top-2 -right-0.5 size-5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              @click.stop="addNoteToSequence(note)">
              <UIcon name="mingcute-add-circle-fill" class="size-5 text-primary font-extrabold stroke-8" />
            </div>
          </div>
        </div>
        <div
          class="selected-notes flex flex-wrap items-center border-accessible-blue w-full rounded-md border-1 py-3 px-5 gap-2">
          <div v-for="(noteItem, index) in noteSequence" :key="index" class="removable-note group relative">
            <UButton class="text-amber-100 cursor-pointer transition-all duration-150"
              :class="['w-10 justify-center', play.currentPlayingIndex.value === index ? 'liquid-wheel' : 'group-hover:ring-1 group-hover:ring-gray-700 group-hover:scale-95']"
              size="md" color="primary" @click="removeNoteFromSequence(index)">
              {{ noteItem.replace('4', '') }}
            </UButton>
            <div
              class="absolute -translate-x-2 -top-2 -right-0.5 size-5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              @click.stop="removeNoteFromSequence(index)">
              <UIcon name="mingcute-minus-circle-fill" class="size-5 text-gray-700 font-extrabold stroke-8" />
            </div>
          </div>
          <UButton variant="ghost" size="sm" icon="i-heroicons-arrow-path" @click="resetNoteSequence" class="ml-2"
            aria-label="Reset sequence" />
          <UButton v-if="noteSequence.length > 0" class="-translate-x-6" variant="ghost" size="sm"
            icon="i-heroicons-x-mark" @click="clearNoteSequence" aria-label="Clear sequence" />
        </div>
      </fieldset>
    </div>
  </div>
</template>

<style>
.note-group {
  border: 0;
  margin: 0;
  padding: 0;
}

.note-group legend {
  margin-bottom: 0.5rem;
}
</style>
