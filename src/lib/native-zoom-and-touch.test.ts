import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import capacitorConfig from "../../capacitor.config";

/**
 * Regression guards for Native App Touch Experience and Anti-Zoom Controls.
 *
 * Ensures the Android APK feels strictly like a native application rather than
 * a browser/webpage wrapper, preventing pinch-to-zoom, double-tap zoom, text selection,
 * tap highlights, and overscroll artifacts across Web, Capacitor, and Android Java layers.
 */
describe("Native app touch feel and anti-zoom guards", () => {
  const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

  it("locks the viewport in __root.tsx with user-scalable=no and maximum-scale=1.0", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).toContain('user-scalable=no');
    expect(root).toContain('maximum-scale=1.0');
    expect(root).toContain('viewport-fit=cover');
  });

  it("injects client-side gesture prevention script for multi-touch and WebKit gestures", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).toContain('gesturestart');
    expect(root).toContain('touches.length>1');
  });

  it("locks viewport in error-page.ts with user-scalable=no and maximum-scale=1.0", () => {
    const errorPage = read("src/lib/error-page.ts");
    expect(errorPage).toContain('user-scalable=no');
    expect(errorPage).toContain('maximum-scale=1.0');
  });

  it("configures touch-action and user-select in src/styles.css", () => {
    const css = read("src/styles.css");
    expect(css).toContain("touch-action: pan-x pan-y;");
    expect(css).toContain("-webkit-touch-callout: none;");
    expect(css).toContain("-webkit-user-select: none;");
    expect(css).toContain("-webkit-tap-highlight-color: transparent;");
    expect(css).toContain("overscroll-behavior-y: none;");
    // Verifies input fields remain selectable
    expect(css).toContain("user-select: text;");
  });

  it("enforces mobile inputs >= 16px to prevent iOS/Android input auto-zoom", () => {
    const css = read("src/styles.css");
    expect(css).toContain("font-size: 16px !important;");
  });

  it("disables zoom in capacitor.config.ts and android assets capacitor.config.json", () => {
    expect(capacitorConfig.android?.zoomEnabled).toBe(false);

    const assets = JSON.parse(read("android/app/src/main/assets/capacitor.config.json")) as {
      android?: { zoomEnabled?: boolean };
    };
    expect(assets.android?.zoomEnabled).toBe(false);
  });

  it("configures strict native WebView settings in MainActivity.java", () => {
    const java = read("android/app/src/main/java/com/melodymap/music/MainActivity.java");
    expect(java).toContain("settings.setSupportZoom(false);");
    expect(java).toContain("settings.setBuiltInZoomControls(false);");
    expect(java).toContain("settings.setDisplayZoomControls(false);");
    expect(java).toContain("settings.setTextZoom(100);");
    expect(java).toContain("webView.setOverScrollMode(View.OVER_SCROLL_NEVER);");
    expect(java).toContain("configureNativeWebView();");
  });
});
