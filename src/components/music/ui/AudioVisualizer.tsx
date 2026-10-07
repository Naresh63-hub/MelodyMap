import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioVisualizerProps {
  /** FFT tap exposed by the audio engine. When absent (iframe/native engines) the component renders nothing. */
  getAnalyser?: (() => AnalyserNode | null) | undefined;
  /** Draw only while playback is active. */
  active: boolean;
  barCount?: number;
  className?: string;
}

/**
 * Real-time frequency-bar visualizer driven by the player's AnalyserNode.
 * Canvas + requestAnimationFrame, colored from the live theme tokens, and
 * fully idle (no rAF loop) when nothing is playing.
 */
export default function AudioVisualizer({ getAnalyser, active, barCount = 28, className }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const levelsRef = useRef<Float32Array>(new Float32Array(barCount));
  const [hasSource, setHasSource] = useState(false);

  // Detect whether an analyser exists (html5/proxy engine) so we can hide gracefully.
  useEffect(() => {
    if (!getAnalyser) return;
    const check = setInterval(() => {
      setHasSource(Boolean(getAnalyser()));
    }, 1000);
    setHasSource(Boolean(getAnalyser()));
    return () => clearInterval(check);
  }, [getAnalyser]);

  useEffect(() => {
    if (!active || !hasSource) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    let running = true;
    let frame = 0;
    let primary = "#38bdf8";
    let ring = "#7dd3fc";

    const readTheme = () => {
      const style = getComputedStyle(document.documentElement);
      primary = (style.getPropertyValue("--primary") || primary).trim();
      ring = (style.getPropertyValue("--ring") || ring).trim();
    };
    readTheme();

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { clientWidth, clientHeight } = canvas;
      if (canvas.width !== Math.floor(clientWidth * dpr) || canvas.height !== Math.floor(clientHeight * dpr)) {
        canvas.width = Math.floor(clientWidth * dpr);
        canvas.height = Math.floor(clientHeight * dpr);
      }
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const bars = levelsRef.current;
    if (bars.length !== barCount) levelsRef.current = new Float32Array(barCount);

    const draw = () => {
      if (!running) return;
      const analyser = getAnalyser?.();
      if (!analyser) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      if (frame % 30 === 0) readTheme();
      frame++;
      resize();

      const bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx2d.clearRect(0, 0, width, height);

      // Use the lower ~2/3 of the spectrum (where music lives) and group bins
      // geometrically so bass gets fewer, wider bars than treble.
      const usable = Math.floor(bins.length * 0.7);
      const gap = 3;
      const barW = Math.max(2, (width - gap * (barCount - 1)) / barCount);

      for (let i = 0; i < barCount; i++) {
        const start = Math.floor(Math.pow(i / barCount, 1.35) * usable);
        const end = Math.max(start + 1, Math.floor(Math.pow((i + 1) / barCount, 1.35) * usable));
        let sum = 0;
        for (let j = start; j < end && j < bins.length; j++) sum += bins[j] ?? 0;
        const target = sum / (end - start) / 255;
        // Fast attack, slow decay for a lively but smooth look
        const prev = bars[i] ?? 0;
        const level = target > prev ? prev + (target - prev) * 0.7 : prev + (target - prev) * 0.18;
        bars[i] = level;

        const barH = Math.max(2, level * height);
        const x = i * (barW + gap);
        const y = height - barH;

        const grad = ctx2d.createLinearGradient(0, height, 0, y);
        grad.addColorStop(0, primary);
        grad.addColorStop(1, ring);
        ctx2d.fillStyle = grad;
        ctx2d.globalAlpha = 0.55 + level * 0.45;

        const r = Math.min(barW / 2, 3);
        ctx2d.beginPath();
        ctx2d.roundRect(x, y, barW, barH, [r, r, 0, 0]);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    // Settle bars to zero once inactive
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      bars.fill(0);
      const c = canvasRef.current;
      c?.getContext("2d")?.clearRect(0, 0, c.clientWidth, c.clientHeight);
    };
  }, [active, hasSource, getAnalyser, barCount]);

  if (!hasSource) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("h-14 w-full", className)}
    />
  );
}
