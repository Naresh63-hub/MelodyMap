import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getStoredTheme,
  setStoredTheme,
  resolveTheme,
  applyTheme,
  subscribeTheme,
  THEME_KEY,
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
} from "./theme";
import { safeStorage } from "./safe-storage";

class MockClassList {
  private classes = new Set<string>();
  add(...names: string[]) {
    names.forEach((n) => this.classes.add(n));
  }
  remove(...names: string[]) {
    names.forEach((n) => this.classes.delete(n));
  }
  contains(name: string) {
    return this.classes.has(name);
  }
  clear() {
    this.classes.clear();
  }
}

describe("theme management", () => {
  let originalWindow: any;
  let originalDocument: any;
  let mockClassList: MockClassList;
  let mockMeta: { content: string };
  let mockDoc: any;
  let mockWin: any;

  beforeEach(() => {
    safeStorage.removeItem(THEME_KEY);

    originalWindow = (globalThis as any).window;
    originalDocument = (globalThis as any).document;

    mockClassList = new MockClassList();
    mockMeta = { content: THEME_COLOR_DARK };

    mockDoc = {
      documentElement: {
        classList: mockClassList,
        style: { colorScheme: "" },
      },
      querySelector: vi.fn((sel: string) => {
        if (sel === 'meta[name="theme-color"]') return mockMeta;
        return null;
      }),
    };

    mockWin = {
      matchMedia: vi.fn((query: string) => ({
        matches: true,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
      AndroidTheme: {
        setStatusBarTheme: vi.fn(),
      },
    };

    (globalThis as any).document = mockDoc;
    (globalThis as any).window = mockWin;
  });

  afterEach(() => {
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
  });

  it("defaults to dark theme when no preference stored", () => {
    expect(getStoredTheme()).toBe("dark");
    expect(resolveTheme()).toBe("dark");
  });

  it("persists light theme in safeStorage and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTheme(listener);

    setStoredTheme("light");

    expect(getStoredTheme()).toBe("light");
    expect(resolveTheme("light")).toBe("light");
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it("persists auto theme mode and resolves using system preference", () => {
    setStoredTheme("auto");
    expect(getStoredTheme()).toBe("auto");

    // Mock matchMedia returning false (prefers light)
    mockWin.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(resolveTheme("auto")).toBe("light");

    // Mock matchMedia returning true (prefers dark)
    mockWin.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(resolveTheme("auto")).toBe("dark");
  });

  it("applies dark theme to DOM and status bar", () => {
    applyTheme("dark");

    expect(mockClassList.contains("dark")).toBe(true);
    expect(mockClassList.contains("light")).toBe(false);
    expect(mockDoc.documentElement.style.colorScheme).toBe("dark");
    expect(mockMeta.content).toBe(THEME_COLOR_DARK);
    expect(mockWin.AndroidTheme.setStatusBarTheme).toHaveBeenCalledWith(false);
  });

  it("applies light theme to DOM and status bar", () => {
    applyTheme("light");

    expect(mockClassList.contains("light")).toBe(true);
    expect(mockClassList.contains("dark")).toBe(false);
    expect(mockDoc.documentElement.style.colorScheme).toBe("light");
    expect(mockMeta.content).toBe(THEME_COLOR_LIGHT);
    expect(mockWin.AndroidTheme.setStatusBarTheme).toHaveBeenCalledWith(true);
  });

  it("handles storage exceptions gracefully without crashing", () => {
    vi.spyOn(safeStorage, "getItem").mockImplementation(() => {
      throw new Error("Blocked storage access");
    });
    vi.spyOn(safeStorage, "setItem").mockImplementation(() => {
      throw new Error("Blocked storage access");
    });

    expect(() => getStoredTheme()).not.toThrow();
    expect(getStoredTheme()).toBe("dark");

    expect(() => setStoredTheme("light")).not.toThrow();
    expect(mockClassList.contains("light")).toBe(true);
  });

  it("handles AndroidTheme missing or throwing without crashing", () => {
    mockWin.AndroidTheme = {
      setStatusBarTheme: () => {
        throw new Error("Bridge failure");
      },
    };

    expect(() => applyTheme("light")).not.toThrow();
    expect(mockClassList.contains("light")).toBe(true);

    delete mockWin.AndroidTheme;
    expect(() => applyTheme("dark")).not.toThrow();
    expect(mockClassList.contains("dark")).toBe(true);
  });
});
