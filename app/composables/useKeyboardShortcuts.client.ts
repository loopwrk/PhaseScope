type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  handler: ShortcutHandler;
  ignoreInInputs?: boolean;
}

export function useKeyboardShortcuts() {
  const shortcuts = new Map<string, Shortcut>();

  const isInputElement = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    );
  };

  const handleKeydown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    const shortcut = shortcuts.get(key);

    if (!shortcut) return;

    // Skip if in input field and shortcut should be ignored in inputs
    if (shortcut.ignoreInInputs !== false && isInputElement(event.target)) {
      return;
    }

    shortcut.handler();
  };

  const register = (
    key: string,
    handler: ShortcutHandler,
    options: { ignoreInInputs?: boolean } = {},
  ) => {
    shortcuts.set(key.toLowerCase(), {
      key: key.toLowerCase(),
      handler,
      ignoreInInputs: options.ignoreInInputs ?? true,
    });
  };

  const unregister = (key: string) => {
    shortcuts.delete(key.toLowerCase());
  };

  onMounted(() => {
    window.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeydown);
    shortcuts.clear();
  });

  return {
    register,
    unregister,
  };
}
