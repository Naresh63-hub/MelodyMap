import { useEffect, useRef } from "react";

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
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

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
          handlersRef.current.onTogglePlay?.();
          break;

        case "ArrowRight":
          e.preventDefault();
          handlersRef.current.onSeekForward?.();
          break;

        case "ArrowLeft":
          e.preventDefault();
          handlersRef.current.onSeekBackward?.();
          break;

        case "ArrowUp":
          e.preventDefault();
          handlersRef.current.onVolumeUp?.();
          break;

        case "ArrowDown":
          e.preventDefault();
          handlersRef.current.onVolumeDown?.();
          break;

        case "n":
        case "N":
          e.preventDefault();
          handlersRef.current.onNext?.();
          break;

        case "p":
        case "P":
          e.preventDefault();
          handlersRef.current.onPrev?.();
          break;

        case "m":
        case "M":
          e.preventDefault();
          handlersRef.current.onToggleMute?.();
          break;

        case "f":
        case "F":
          e.preventDefault();
          handlersRef.current.onToggleFullScreen?.();
          break;

        case "e":
        case "E":
          e.preventDefault();
          handlersRef.current.onToggleEqualizer?.();
          break;

        case "s":
        case "S":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlersRef.current.onToggleShuffle?.();
          }
          break;

        case "r":
        case "R":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlersRef.current.onToggleRepeat?.();
          }
          break;

        case "/":
          e.preventDefault();
          handlersRef.current.onFocusSearch?.();
          break;

        case "?":
          e.preventDefault();
          handlersRef.current.onToggleShortcutsModal?.();
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
