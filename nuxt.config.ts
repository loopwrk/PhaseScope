export default defineNuxtConfig({
  app: {
    head: {
      title: "PhaseFold",
      htmlAttrs: {
        lang: "en",
      },
      link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
    },
  },
  devtools: { enabled: true },

  modules: [
    "@nuxt/eslint",
    "@nuxt/image",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "@nuxt/ui",
    "@nuxt/content",
    "@nuxtjs/color-mode",
  ],
  css: ["~/assets/css/main.css"],
  colorMode: {
    preference: "light",
    fallback: "light",
    classSuffix: "",
    disableTransition: false,
  },
});
