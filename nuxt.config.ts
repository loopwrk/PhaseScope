import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function generateAudioManifest() {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
  const audioDir = join(process.cwd(), 'public', 'audio');
  let files: string[];
  try {
    files = readdirSync(audioDir);
  } catch {
    files = [];
  }
  const audioFiles = files
    .filter((file) => audioExtensions.some((ext) => file.toLowerCase().endsWith(ext)))
    .sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] ?? '', 10);
      const numB = parseInt(b.match(/^(\d+)/)?.[1] ?? '', 10);
      const hasNumA = !isNaN(numA);
      const hasNumB = !isNaN(numB);
      if (hasNumA && hasNumB) return numA - numB || a.localeCompare(b);
      if (hasNumA) return -1;
      if (hasNumB) return 1;
      return a.localeCompare(b);
    })
    .map((file, index) => ({
      id: `auto-${file}`,
      name: file.replace(/\.[^/.]+$/, ''),
      file: `/audio/${file}`,
      corridorOrder: index + 1,
      sphereOrder: index + 1,
    }));
  const outPath = join(process.cwd(), 'public', 'audio-manifest.json');
  writeFileSync(outPath, JSON.stringify(audioFiles));
  console.log(`[audio-manifest] ${audioFiles.length} tracks`);
}

generateAudioManifest();

export default defineNuxtConfig({
  app: {
    head: {
      title: "PhaseFold",
      htmlAttrs: {
        lang: "en",
        class: "light",
      },
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },
  colorMode: {
    preference: "light",
    fallback: "light",
  },
  devtools: { enabled: true },

  modules: [
    "@nuxt/eslint",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "@nuxt/ui",
    "@nuxt/content",
  ],
  css: ["~/assets/css/main.css"],
});
