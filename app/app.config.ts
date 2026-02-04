export default defineAppConfig({
  ui: {
    prose: {
      h1: {
        slots: {
          base: "text-4xl mb-4 text-primary font-bold scroll-mt-[calc(45px+var(--ui-header-height))] lg:scroll-mt-(--ui-header-height)",
        },
      },
      h2: {
        slots: {
          base: [
            "text-2xl text-secondary font-bold mt-0 mb-6 scroll-mt-[calc(48px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(48px+var(--ui-header-height))]",
          ],
        },
      },
      h3: {
        slots: {
          base: [
            "text-primary font-bold mt-0  scroll-mt-[calc(48px+45px+var(--ui-header-height))] lg:scroll-mt-[calc(48px+var(--ui-header-height))]",
          ],
        },
      },
    },
    toast: {
      slots: {
        root: "bg-white",
        wrapper: "py-2",
        title: "text-xl",
        icon: "size-7 mt-2",
        close: "cursor-pointer mt-2.5",
      },
    },
    button: {
      slots: {
        base: "mr-4 cursor-pointer",
      },
    },
  },
});
