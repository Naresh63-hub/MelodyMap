import { cn } from "@/lib/utils";

/** Animated equalizer bars — only move while audio is actually playing. */
export function Equalizer({ active, className }: { active: boolean; className?: string }) {
  return (
    <span className={cn("flex h-4 items-end gap-[2px]", className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] origin-bottom rounded-full bg-primary transition-transform",
            active ? "animate-bar" : "scale-y-[0.35]",
          )}
          style={{ height: "100%", animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/** Spinning record artwork with a glowing halo while playing. */
export function SpinningArt({
  src,
  playing,
  alt = "",
}: {
  src?: string | undefined;
  playing: boolean;
  alt?: string;
}) {
  return (
    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <span
        className={cn(
          "absolute inset-0 rounded-full bg-vinyl transition-opacity duration-500",
          playing ? "animate-spin-slow opacity-100 shadow-player" : "opacity-60",
        )}
        aria-hidden
      />
      <img
        src={src ?? "https://i.ytimg.com/vi/none/hqdefault.jpg"}
        alt={alt}
        className={cn(
          "relative h-9 w-9 rounded-full object-cover ring-1 ring-border",
          playing && "animate-spin-slow",
          !src && "opacity-30",
        )}
      />
      <span
        className="absolute h-2 w-2 rounded-full bg-background ring-1 ring-border"
        aria-hidden
      />
    </span>
  );
}
