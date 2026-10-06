import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "light" | "medium" | "heavy" | "premium" | "gradient" | "inner-glow" | "reflection" | "frosted" | "crystal" | "shimmer";
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  onClick?: () => void;
};

/**
 * Premium GlassCard component with Apple-style frosted glass effects
 * Multi-layer glass with depth, lighting, and blur
 */
export function GlassCard({
  children,
  className,
  variant = "medium",
  rounded = "xl",
  onClick,
}: Props) {
  const variantClass = {
    light: "glass-light",
    medium: "glass-medium",
    heavy: "glass-heavy",
    premium: "glass-premium-apple",
    gradient: "glass-gradient",
    "inner-glow": "glass-inner-glow",
    reflection: "glass-reflection",
    frosted: "glass-frosted",
    crystal: "glass-crystal",
    shimmer: "glass-shimmer",
  }[variant];

  const roundedClass = {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      onClick={onClick}
      className={cn(
        variantClass,
        roundedClass,
        "transition-all duration-300",
        onClick && "cursor-pointer hover:shadow-lg active:scale-[0.98]",
        className
      )}
    >
      {children}
    </div>
  );
}
