import { describe, it, expect, vi } from "vitest";

describe("Service Worker message event origin validation", () => {
  const swOrigin = "https://melodymap-pi.vercel.app";

  function simulateSwMessageHandler(
    event: { origin?: string; source?: { url?: string }; data: any },
    skipWaitingFn: () => void,
  ) {
    if (event.origin && event.origin !== swOrigin) return;
    if (event.source && typeof event.source === "object" && "url" in event.source) {
      try {
        const sourceOrigin = new URL(event.source.url!).origin;
        if (sourceOrigin !== swOrigin) return;
      } catch {
        return;
      }
    }

    if (event.data === "skipWaiting") {
      skipWaitingFn();
    }
  }

  it("accepts skipWaiting from same-origin messages", () => {
    const skipWaiting = vi.fn();
    simulateSwMessageHandler(
      {
        origin: swOrigin,
        source: { url: "https://melodymap-pi.vercel.app/" },
        data: "skipWaiting",
      },
      skipWaiting,
    );
    expect(skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("ignores skipWaiting from mismatched origin messages", () => {
    const skipWaiting = vi.fn();
    simulateSwMessageHandler(
      {
        origin: "https://attacker.com",
        source: { url: "https://attacker.com/" },
        data: "skipWaiting",
      },
      skipWaiting,
    );
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it("ignores skipWaiting from mismatched source URL client origin", () => {
    const skipWaiting = vi.fn();
    simulateSwMessageHandler(
      {
        origin: swOrigin,
        source: { url: "https://evil.com/fake" },
        data: "skipWaiting",
      },
      skipWaiting,
    );
    expect(skipWaiting).not.toHaveBeenCalled();
  });

  it("ignores non-skipWaiting messages", () => {
    const skipWaiting = vi.fn();
    simulateSwMessageHandler(
      {
        origin: swOrigin,
        source: { url: "https://melodymap-pi.vercel.app/" },
        data: "otherAction",
      },
      skipWaiting,
    );
    expect(skipWaiting).not.toHaveBeenCalled();
  });
});
