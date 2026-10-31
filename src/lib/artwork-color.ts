/**
 * Dynamic Artwork Color Theming
 * Extracts or estimates dominant artwork colors and applies them to player accents
 * while preserving readable contrast and the Deep Violet (#8B5CF6) brand identity.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface ArtworkColorTheme {
  /** Dominant vibrant accent color in rgba/hex */
  accent: string;
  /** Primary blended color (balanced with Deep Violet) */
  primary: string;
  /** Soft ambient aura background style */
  ambientGlow: string;
  /** Subdued border accent color */
  borderAccent: string;
  /** Raw RGB values of the blended dominant color */
  rgb: RGB;
}

// Deep Violet brand identity: #8B5CF6 -> rgb(139, 92, 246)
export const DEEP_VIOLET_RGB: RGB = { r: 139, g: 92, b: 246 };

// Curated harmonious seed palette for instantaneous fallback
const HARMONIOUS_ACCENTS: RGB[] = [
  { r: 168, g: 85, b: 247 }, // Purple / Violet
  { r: 236, g: 72, b: 153 }, // Pink / Rose
  { r: 99, g: 102, b: 241 },  // Indigo
  { r: 59, g: 130, b: 246 },  // Blue
  { r: 20, g: 184, b: 166 },  // Teal
  { r: 244, g: 63, b: 94 },   // Coral / Rose
  { r: 139, g: 92, b: 246 },  // Deep Violet
  { r: 192, g: 132, b: 252 }, // Soft Violet
];

const colorCache = new Map<string, ArtworkColorTheme>();
const MAX_CACHE_SIZE = 120;

/**
 * Calculates perceived relative luminance of an sRGB color (WCAG definition).
 */
export function getRelativeLuminance(rgb: RGB): number {
  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((val) =>
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
}

/**
 * Clamps color luminance so accents maintain high readability on dark backgrounds.
 */
export function clampReadableLuminance(rgb: RGB, minLum = 0.22, maxLum = 0.75): RGB {
  let { r, g, b } = rgb;
  const lum = getRelativeLuminance({ r, g, b });

  if (lum < minLum) {
    const factor = (minLum + 0.05) / Math.max(0.01, lum);
    r = Math.min(255, Math.round(r * factor + 35));
    g = Math.min(255, Math.round(g * factor + 35));
    b = Math.min(255, Math.round(b * factor + 35));
  } else if (lum > maxLum) {
    const factor = maxLum / Math.max(0.01, lum);
    r = Math.max(0, Math.round(r * factor));
    g = Math.max(0, Math.round(g * factor));
    b = Math.max(0, Math.round(b * factor));
  }

  return { r, g, b };
}

/**
 * Blends a color with Deep Violet (#8B5CF6) to keep the app's signature aesthetic intact.
 * @param weight Ratio of the extracted color (0.0 to 1.0). Default: 0.55 (55% artwork, 45% violet).
 */
export function blendWithDeepViolet(rgb: RGB, weight = 0.55): RGB {
  const w = Math.max(0, Math.min(1, weight));
  const r = Math.round(rgb.r * w + DEEP_VIOLET_RGB.r * (1 - w));
  const g = Math.round(rgb.g * w + DEEP_VIOLET_RGB.g * (1 - w));
  const b = Math.round(rgb.b * w + DEEP_VIOLET_RGB.b * (1 - w));
  return clampReadableLuminance({ r, g, b });
}

/**
 * Generates the full color theme from an RGB value.
 */
export function buildArtworkColorTheme(rgb: RGB): ArtworkColorTheme {
  const blended = blendWithDeepViolet(rgb);
  const { r, g, b } = blended;

  return {
    accent: `rgb(${r}, ${g}, ${b})`,
    primary: `rgba(${r}, ${g}, ${b}, 0.95)`,
    borderAccent: `rgba(${r}, ${g}, ${b}, 0.35)`,
    ambientGlow: `radial-gradient(circle at 50% 30%, rgba(${r}, ${g}, ${b}, 0.28) 0%, rgba(139, 92, 246, 0.14) 55%, rgba(9, 6, 20, 0.98) 100%)`,
    rgb: blended,
  };
}

/**
 * Deterministically estimates a vibrant accent from a seed string (e.g., track id or title).
 * Instant, zero-latency fallback without network or canvas overhead.
 */
export function estimateArtworkColor(seed: string): ArtworkColorTheme {
  const cacheKey = `est:${seed}`;
  const cached = colorCache.get(cacheKey);
  if (cached) return cached;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % HARMONIOUS_ACCENTS.length;
  const picked = HARMONIOUS_ACCENTS[index] || DEEP_VIOLET_RGB;
  const theme = buildArtworkColorTheme(picked);

  if (colorCache.size >= MAX_CACHE_SIZE) {
    const firstKey = colorCache.keys().next().value;
    if (firstKey) colorCache.delete(firstKey);
  }
  colorCache.set(cacheKey, theme);
  return theme;
}

/**
 * Extracts the dominant vibrant color from an image URL using a downscaled 16x16 HTML5 Canvas.
 * Falls back safely to estimateArtworkColor if canvas is unavailable or image fails/CORS blocked.
 */
export async function extractArtworkColor(imageUrl?: string | null, seed = "melodymap"): Promise<ArtworkColorTheme> {
  if (!imageUrl) {
    return estimateArtworkColor(seed);
  }

  const cached = colorCache.get(imageUrl);
  if (cached) return cached;

  if (typeof window === "undefined" || typeof document === "undefined") {
    return estimateArtworkColor(seed || imageUrl);
  }

  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load error"));
      // 2-second timeout to avoid blocking UI rendering
      setTimeout(() => reject(new Error("Image load timeout")), 2000);
      img.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D unavailable");

    ctx.drawImage(img, 0, 0, 16, 16);
    const imgData = ctx.getImageData(0, 0, 16, 16).data;

    let bestRgb: RGB | null = null;
    let maxSaturation = -1;
    let avgR = 0;
    let avgG = 0;
    let avgB = 0;
    let validPixelCount = 0;

    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i] ?? 0;
      const g = imgData[i + 1] ?? 0;
      const b = imgData[i + 2] ?? 0;
      const a = imgData[i + 3] ?? 0;

      if (a < 128) continue; // skip transparent pixels

      avgR += r;
      avgG += g;
      avgB += b;
      validPixelCount++;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const saturation = max === 0 ? 0 : delta / max;
      const lum = getRelativeLuminance({ r, g, b });

      // Look for vibrant midtones (avoid pure blacks, pure whites, and muddy grays)
      if (lum >= 0.15 && lum <= 0.85 && saturation > maxSaturation && saturation >= 0.2) {
        maxSaturation = saturation;
        bestRgb = { r, g, b };
      }
    }

    const candidateRgb: RGB =
      bestRgb ||
      (validPixelCount > 0
        ? {
            r: Math.round(avgR / validPixelCount),
            g: Math.round(avgG / validPixelCount),
            b: Math.round(avgB / validPixelCount),
          }
        : DEEP_VIOLET_RGB);

    const theme = buildArtworkColorTheme(candidateRgb);

    if (colorCache.size >= MAX_CACHE_SIZE) {
      const firstKey = colorCache.keys().next().value;
      if (firstKey) colorCache.delete(firstKey);
    }
    colorCache.set(imageUrl, theme);
    return theme;
  } catch {
    // Graceful fallback to deterministic seed theme
    return estimateArtworkColor(seed || imageUrl);
  }
}
