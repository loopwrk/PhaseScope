type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  handler: ShortcutHandler;
  ignoreInInputs?: boolean;
  preventDefault?: boolean;
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

  const normalizeKey = (key: string): string => {
    // Handle special keys
    if (key === " ") return " ";
    return key.toLowerCase();
  };

  const handleKeydown = (event: KeyboardEvent) => {
    // Ignore when modifier keys are pressed (Cmd, Ctrl, Alt)
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const key = normalizeKey(event.key);
    const shortcut = shortcuts.get(key);

    if (!shortcut) return;

    // Skip if in input field and shortcut should be ignored in inputs
    if (shortcut.ignoreInInputs !== false && isInputElement(event.target)) {
      return;
    }

    if (shortcut.preventDefault !== false) {
      event.preventDefault();
      event.stopPropagation();
    }

    shortcut.handler();
  };

  const register = (
    key: string,
    handler: ShortcutHandler,
    options: { ignoreInInputs?: boolean; preventDefault?: boolean } = {},
  ) => {
    shortcuts.set(normalizeKey(key), {
      key: normalizeKey(key),
      handler,
      ignoreInInputs: options.ignoreInInputs ?? true,
      preventDefault: options.preventDefault ?? true,
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
