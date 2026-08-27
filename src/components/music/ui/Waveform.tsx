import { cn } from "@/lib/utils";

type Props = {
  active?: boolean;
  barCount?: number;
  className?: string;
  variant?: "default" | "large";
};

/** Animated waveform visualization for the player. */
export function Waveform({ active = false, barCount = 40, className, variant = "default" }: Props) {
  const heights = variant === "large"
    ? ["40%", "70%", "55%", "90%", "45%", "80%", "60%", "95%"]
    : ["30%", "60%", "45%", "80%", "35%", "70%", "50%", "85%"];

  return (
    <div
      className={cn(
        "flex items-end justify-center gap-[2px]",
        variant === "large" ? "h-24" : "h-8",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: barCount }, (_, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] origin-bottom rounded-full",
            active
              ? "bg-gradient-to-t from-pink-500 via-purple-500 to-cyan-400 animate-waveform"
              : "bg-white/10",
          )}
          style={{
            height: heights[i % heights.length],
            animationDelay: `${(i % 8) * 0.08}s`,
            animationDuration: `${0.6 + (i % 5) * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
