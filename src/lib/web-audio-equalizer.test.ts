import { describe, it, expect } from "vitest";
import {
  EQUALIZER_SPECS,
  getEffectiveBiquadGains,
  computeFadeCurve,
  isSourceWebAudioEligible,
  CDN_CORS_ELIGIBILITY_MAP,
} from "./web-audio-equalizer";
import { EQUALIZER_PRESETS, type EqualizerSettings } from "./equalizer";

describe("web-audio-equalizer (Task 11)", () => {
  describe("EQUALIZER_SPECS", () => {
    it("defines exactly 10 filter bands with correct frequencies and filter types", () => {
      expect(EQUALIZER_SPECS).toHaveLength(10);
      expect(EQUALIZER_SPECS[0]).toEqual({ frequency: 31, type: "lowshelf", label: "31Hz" });
      expect(EQUALIZER_SPECS[1]).toEqual({ frequency: 62, type: "peaking", label: "62Hz" });
      expect(EQUALIZER_SPECS[2]).toEqual({ frequency: 125, type: "peaking", label: "125Hz" });
      expect(EQUALIZER_SPECS[3]).toEqual({ frequency: 250, type: "peaking", label: "250Hz" });
      expect(EQUALIZER_SPECS[4]).toEqual({ frequency: 500, type: "peaking", label: "500Hz" });
      expect(EQUALIZER_SPECS[5]).toEqual({ frequency: 1000, type: "peaking", label: "1kHz" });
      expect(EQUALIZER_SPECS[6]).toEqual({ frequency: 2000, type: "peaking", label: "2kHz" });
      expect(EQUALIZER_SPECS[7]).toEqual({ frequency: 4000, type: "peaking", label: "4kHz" });
      expect(EQUALIZER_SPECS[8]).toEqual({ frequency: 8000, type: "peaking", label: "8kHz" });
      expect(EQUALIZER_SPECS[9]).toEqual({ frequency: 16000, type: "highshelf", label: "16kHz" });
    });
  });

  describe("getEffectiveBiquadGains (preset -> gains & neutral bypass)", () => {
    it("maps flat preset to 10 zero dB gains", () => {
      const settings: EqualizerSettings = {
        enabled: true,
        preset: "flat",
        gains: EQUALIZER_PRESETS.flat.gains,
        crossfade: 3,
        quality: "high",
      };
      expect(getEffectiveBiquadGains(settings, false)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("maps bass_boost preset accurately", () => {
      const settings: EqualizerSettings = {
        enabled: true,
        preset: "bass_boost",
        gains: EQUALIZER_PRESETS.bass_boost.gains,
        crossfade: 3,
        quality: "high",
      };
      expect(getEffectiveBiquadGains(settings, false)).toEqual([7, 6, 5, 3, 1, 0, 0, 0, 0, 0]);
    });

    it("clamps gains to [-12, +12] range", () => {
      const settings: EqualizerSettings = {
        enabled: true,
        preset: "custom",
        gains: [20, -18, 5, 0, 0, 0, 0, 0, 0, 0],
        crossfade: 0,
        quality: "standard",
      };
      const gains = getEffectiveBiquadGains(settings, false);
      expect(gains[0]).toBe(12);
      expect(gains[1]).toBe(-12);
      expect(gains[2]).toBe(5);
    });

    it("forces all 10 gains to 0 dB when bypassed", () => {
      const settings: EqualizerSettings = {
        enabled: true,
        preset: "bass_boost",
        gains: EQUALIZER_PRESETS.bass_boost.gains,
        crossfade: 3,
        quality: "high",
      };
      // isBypassed = true (e.g. cross-origin track without CORS)
      expect(getEffectiveBiquadGains(settings, true)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("forces all 10 gains to 0 dB when equalizer is disabled in settings", () => {
      const settings: EqualizerSettings = {
        enabled: false,
        preset: "rock",
        gains: EQUALIZER_PRESETS.rock.gains,
        crossfade: 0,
        quality: "high",
      };
      expect(getEffectiveBiquadGains(settings, false)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("returns 10 zeros when settings are null or undefined", () => {
      expect(getEffectiveBiquadGains(null, false)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });
  });

  describe("computeFadeCurve (equal-power trigonometric crossfade curves)", () => {
    it("computes monotonic fade-in curve starting at 0 and ending at 1", () => {
      const curve = computeFadeCurve("in", 32);
      expect(curve.length).toBe(32);
      expect(curve[0]).toBeCloseTo(0, 5);
      expect(curve[31]).toBeCloseTo(1, 5);

      for (let i = 1; i < curve.length; i++) {
        expect(curve[i]!).toBeGreaterThanOrEqual(curve[i - 1]!);
      }
    });

    it("computes monotonic fade-out curve starting at 1 and ending at 0", () => {
      const curve = computeFadeCurve("out", 32);
      expect(curve.length).toBe(32);
      expect(curve[0]).toBeCloseTo(1, 5);
      expect(curve[31]).toBeCloseTo(0, 5);

      for (let i = 1; i < curve.length; i++) {
        expect(curve[i]!).toBeLessThanOrEqual(curve[i - 1]!);
      }
    });

    it("satisfies equal-power trigonometric property (sin^2 + cos^2 = 1) across all sample points", () => {
      const fadeIn = computeFadeCurve("in", 32);
      const fadeOut = computeFadeCurve("out", 32);

      for (let i = 0; i < 32; i++) {
        const sumOfSquares = (fadeIn[i]! ** 2) + (fadeOut[i]! ** 2);
        expect(sumOfSquares).toBeCloseTo(1.0, 5);
      }
    });
  });

  describe("isSourceWebAudioEligible", () => {
    it("permits same-origin relative URLs and stream proxies", () => {
      expect(isSourceWebAudioEligible("/api/stream/12345")).toBe(true);
      expect(isSourceWebAudioEligible("/stream-proxy/abc")).toBe(true);
    });

    it("permits offline blob: URLs from IndexedDB", () => {
      expect(isSourceWebAudioEligible("blob:http://localhost:3000/1234-5678")).toBe(true);
    });

    it("permits explicit same-origin absolute URLs", () => {
      expect(isSourceWebAudioEligible("http://localhost:3000/api/stream/abc", "http://localhost:3000")).toBe(true);
    });

    it("rejects JioSaavn CDNs lacking CORS headers", () => {
      expect(isSourceWebAudioEligible("https://aac.saavncdn.com/123/abc.mp4")).toBe(false);
      expect(isSourceWebAudioEligible("https://c.saavncdn.com/456/def.mp4")).toBe(false);
      expect(isSourceWebAudioEligible("https://preview.saavncdn.com/789/preview.mp4")).toBe(false);
    });

    it("rejects Jamendo storage CDNs lacking CORS headers", () => {
      expect(isSourceWebAudioEligible("https://prod-1.storage.jamendo.com/download/track/1885558/mp32/")).toBe(false);
      expect(isSourceWebAudioEligible("https://mp3d.jamendo.com/stream/track.mp3")).toBe(false);
    });

    it("rejects Internet Archive media streams lacking CORS headers", () => {
      expect(isSourceWebAudioEligible("https://archive.org/download/test/song.mp3")).toBe(false);
      expect(isSourceWebAudioEligible("https://ia800201.us.archive.org/0/items/test/song.mp3")).toBe(false);
    });

    it("permits verified CORS-enabled external providers (Audius)", () => {
      expect(isSourceWebAudioEligible("https://audius.co/tracks/123/stream")).toBe(true);
      expect(isSourceWebAudioEligible("https://creatornode.audius.co/tracks/cidstream/baeaaaiq")).toBe(true);
      expect(isSourceWebAudioEligible("https://discoveryprovider.audius.co/v1/tracks/trending")).toBe(true);
    });

    it("exposes measured CDN_CORS_ELIGIBILITY_MAP with verified provider entries", () => {
      expect(CDN_CORS_ELIGIBILITY_MAP["saavncdn.com"]).toBe(false);
      expect(CDN_CORS_ELIGIBILITY_MAP["audius.co"]).toBe(true);
      expect(CDN_CORS_ELIGIBILITY_MAP["archive.org"]).toBe(false);
      expect(CDN_CORS_ELIGIBILITY_MAP["prod-1.storage.jamendo.com"]).toBe(false);
    });

    it("rejects empty or invalid URLs", () => {
      expect(isSourceWebAudioEligible("")).toBe(false);
    });
  });
});
