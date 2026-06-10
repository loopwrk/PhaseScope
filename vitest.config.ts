import { defineVitestConfig } from '@nuxt/test-utils/config';

/* Unit tests run in plain node by default (fast - the engine math is pure).
   A spec that needs Nuxt's auto-imports / Vue reactivity opts into the nuxt
   environment with a `// @vitest-environment nuxt` pragma on line 1. */
export default defineVitestConfig({
    test: {
        include: ['tests/unit/**/*.spec.ts'],
    },
});
