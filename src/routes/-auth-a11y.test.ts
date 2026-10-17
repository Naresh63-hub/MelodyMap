import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

function sRGBtoLin(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.2126 * sRGBtoLin(r) + 0.7152 * sRGBtoLin(g) + 0.0722 * sRGBtoLin(b);
}

function blendOverBackground(fgHex: string, alpha: number, bgHex: string): string {
  const cleanFg = fgHex.replace("#", "");
  const cleanBg = bgHex.replace("#", "");
  const fgR = parseInt(cleanFg.slice(0, 2), 16);
  const fgG = parseInt(cleanFg.slice(2, 4), 16);
  const fgB = parseInt(cleanFg.slice(4, 6), 16);
  const bgR = parseInt(cleanBg.slice(0, 2), 16);
  const bgG = parseInt(cleanBg.slice(2, 4), 16);
  const bgB = parseInt(cleanBg.slice(4, 6), 16);

  const r = Math.round(fgR * alpha + bgR * (1 - alpha));
  const g = Math.round(fgG * alpha + bgG * (1 - alpha));
  const b = Math.round(fgB * alpha + bgB * (1 - alpha));

  return "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("/auth Accessibility, Contrast, and Performance verification", () => {
  const authSource = fs.readFileSync(path.resolve(__dirname, "auth.tsx"), "utf8");
  const rootSource = fs.readFileSync(path.resolve(__dirname, "__root.tsx"), "utf8");

  describe("WCAG 2.2 AA Contrast Calculations", () => {
    const cardBg = "#21133F";
    const appBg = "#10091F";
    const white = "#FFFFFF";

    it("ensures placeholder text at 65% opacity satisfies WCAG AA (at least 4.5:1)", () => {
      const placeholderColor = blendOverBackground(white, 0.65, cardBg);
      const ratio = getContrastRatio(placeholderColor, cardBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("ensures field icons and secondary labels at 70% opacity satisfy WCAG AA (at least 4.5:1)", () => {
      const iconColor = blendOverBackground(white, 0.70, cardBg);
      const ratio = getContrastRatio(iconColor, cardBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("ensures secondary text and guest button at 75% opacity satisfy WCAG AA (at least 4.5:1)", () => {
      const textColor = blendOverBackground(white, 0.75, cardBg);
      const ratio = getContrastRatio(textColor, cardBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("ensures app background text at 75% opacity satisfies WCAG AA (at least 4.5:1)", () => {
      const textColor = blendOverBackground(white, 0.75, appBg);
      const ratio = getContrastRatio(textColor, appBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it("ensures primary violet button contrast with white text satisfies WCAG AA (at least 3.0:1)", () => {
      const primaryViolet = "#8B5CF6";
      const ratio = getContrastRatio(white, primaryViolet);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe("Form Accessibility and Tree Formation", () => {
    it("associates all labels with inputs via htmlFor and matching id", () => {
      expect(authSource).toContain('htmlFor="auth-name"');
      expect(authSource).toContain('id="auth-name"');
      expect(authSource).toContain('htmlFor="auth-email"');
      expect(authSource).toContain('id="auth-email"');
      expect(authSource).toContain('htmlFor="auth-password"');
      expect(authSource).toContain('id="auth-password"');
      expect(authSource).toContain('htmlFor="auth-confirm-password"');
      expect(authSource).toContain('id="auth-confirm-password"');
    });

    it("provides autocomplete attributes on all inputs", () => {
      expect(authSource).toContain('autoComplete="name"');
      expect(authSource).toContain('autoComplete="email"');
      expect(authSource).toContain('autoComplete={mode === "signin" ? "current-password" : "new-password"}');
      expect(authSource).toContain('autoComplete="new-password"');
    });

    it("wires up error banner with role='alert', aria-live, and aria-describedby", () => {
      expect(authSource).toContain('role="alert"');
      expect(authSource).toContain('aria-live="assertive"');
      expect(authSource).toContain('id="auth-error-note"');
      expect(authSource).toContain('aria-describedby={errorNote ? "auth-error-note" : undefined}');
    });

    it("provides role='tablist' and role='tab' semantics on mode switcher", () => {
      expect(authSource).toContain('role="tablist"');
      expect(authSource).toContain('role="tab"');
      expect(authSource).toContain('aria-selected={mode === "signin"}');
      expect(authSource).toContain('aria-selected={mode === "signup"}');
    });
  });

  describe("Button Accessible Names and Touch Targets", () => {
    it("ensures password toggle button has dynamic aria-label and aria-pressed", () => {
      expect(authSource).toContain('aria-label={showPassword ? "Hide password" : "Show password"}');
      expect(authSource).toContain('aria-pressed={showPassword}');
    });

    it("ensures password toggle button meets >= 44x44px touch target guidelines", () => {
      expect(authSource).toContain("min-w-[44px]");
      expect(authSource).toContain("min-h-[44px]");
    });

    it("ensures interactive controls meet mobile touch target minimum height", () => {
      expect(authSource).toContain("min-h-[44px]");
    });

    it("marks decorative SVG icons with aria-hidden='true'", () => {
      expect(authSource).toContain('<ArrowLeft aria-hidden="true"');
      expect(authSource).toContain('<User aria-hidden="true"');
      expect(authSource).toContain('<Mail aria-hidden="true"');
      expect(authSource).toContain('<Lock aria-hidden="true"');
      expect(authSource).toContain('<EyeOff aria-hidden="true"');
      expect(authSource).toContain('<Eye aria-hidden="true"');
    });

    it("renders the official MelodyMap logo image with accessible alt text", () => {
      expect(authSource).toContain('src="/brand/app-icon.png"');
      expect(authSource).toContain('alt="MelodyMap"');
    });
  });

  describe("Non-Render-Blocking Font Loading", () => {
    it("includes preconnect and dns-prefetch for font CDNs in __root.tsx", () => {
      expect(rootSource).toContain('{ rel: "dns-prefetch", href: "https://fonts.googleapis.com" }');
      expect(rootSource).toContain('{ rel: "dns-prefetch", href: "https://fonts.gstatic.com" }');
      expect(rootSource).toContain('{ rel: "preconnect", href: "https://fonts.googleapis.com" }');
      expect(rootSource).toContain('{ rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }');
    });

    it("loads Google Fonts asynchronously via preload and media='print'", () => {
      expect(rootSource).toContain('rel: "preload"');
      expect(rootSource).toContain('as: "style"');
      expect(rootSource).toContain('media="print"');
      expect(rootSource).toContain('e.currentTarget.media = "all"');
    });

    it("provides a noscript fallback in RootShell head", () => {
      expect(rootSource).toContain("<noscript>");
      expect(rootSource).toContain("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans");
      expect(rootSource).toContain("</noscript>");
    });
  });
});
