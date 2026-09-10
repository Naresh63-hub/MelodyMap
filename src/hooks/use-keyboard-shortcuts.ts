import { useEffect } from "react";

export type KeyboardShortcutHandlers = {
  onTogglePlay?: () => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
  onVolumeUp?: () => void;
  onVolumeDown?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onToggleMute?: () => void;
  onToggleFullScreen?: () => void;
  onToggleEqualizer?: () => void;
  onToggleShuffle?: () => void;
  onToggleRepeat?: () => void;
  onFocusSearch?: () => void;
  onToggleShortcutsModal?: () => void;
};

export function useKeyboardShortcuts(
  handlers: KeyboardShortcutHandlers,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, contenteditable, or select
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.getAttribute("contenteditable") === "true");

      // Exception: Escape key can blur active input
      if (e.key === "Escape" && isInput) {
        (activeEl as HTMLElement).blur();
        return;
      }

      if (isInput) return;

      // Handle shortcuts
      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          handlers.onTogglePlay?.();
          break;

        case "ArrowRight":
          e.preventDefault();
          handlers.onSeekForward?.();
          break;

        case "ArrowLeft":
          e.preventDefault();
          handlers.onSeekBackward?.();
          break;

        case "ArrowUp":
          e.preventDefault();
          handlers.onVolumeUp?.();
          break;

        case "ArrowDown":
          e.preventDefault();
          handlers.onVolumeDown?.();
          break;

        case "n":
        case "N":
          e.preventDefault();
          handlers.onNext?.();
          break;

        case "p":
        case "P":
          e.preventDefault();
          handlers.onPrev?.();
          break;

        case "m":
        case "M":
          e.preventDefault();
          handlers.onToggleMute?.();
          break;

        case "f":
        case "F":
          e.preventDefault();
          handlers.onToggleFullScreen?.();
          break;

        case "e":
        case "E":
          e.preventDefault();
          handlers.onToggleEqualizer?.();
          break;

        case "s":
        case "S":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlers.onToggleShuffle?.();
          }
          break;

        case "r":
        case "R":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlers.onToggleRepeat?.();
          }
          break;

        case "/":
          e.preventDefault();
          handlers.onFocusSearch?.();
          break;

        case "?":
          e.preventDefault();
          handlers.onToggleShortcutsModal?.();
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers, enabled]);
}
