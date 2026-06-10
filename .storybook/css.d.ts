/* Ambient declarations so TypeScript accepts side-effect CSS imports in
   the Storybook config (e.g. `import '../app/assets/css/tokens.css'` in
   preview.ts). The root tsconfig uses Nuxt's project references, which
   don't cover `.storybook/`, so these aren't declared there otherwise. */
declare module '*.css';

/* Importing Nuxt UI's App component by its .vue path resolves to a
   `.d.vue.ts` type file, which TS won't read without
   `allowArbitraryExtensions`. This targeted shim lets preview.ts import it
   (kept specific so it doesn't strip types from our own *.vue imports). */
declare module '@nuxt/ui/components/App.vue';
