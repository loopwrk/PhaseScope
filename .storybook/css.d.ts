/* Ambient declarations so TypeScript accepts side-effect CSS imports in
   the Storybook config (e.g. `import '../app/assets/css/tokens.css'` in
   preview.ts). The root tsconfig uses Nuxt's project references, which
   don't cover `.storybook/`, so these aren't declared there otherwise. */
declare module '*.css';
