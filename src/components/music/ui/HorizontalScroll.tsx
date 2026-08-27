import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
};

/** Horizontal scroll container with smooth arrow navigation. */
export function HorizontalScroll({ children, className, title, subtitle }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  const scroll = (dir: -1 | 1) => {
    ref.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
    window.setTimeout(updateArrows, 350);
  };

  return (
    <section className={cn("group/scroll relative", className)}>
      {(title || subtitle) && (
        <div className="mb-3 flex items-end justify-between gap-2">
          <div>
            {title && <h2 className="text-lg font-bold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={() => scroll(-1)}
              disabled={!canLeft}
              aria-label="Scroll left"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              disabled={!canRight}
              aria-label="Scroll right"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div
        ref={ref}
        onScroll={updateArrows}
        className="scrollbar-hide flex gap-3 overflow-x-auto pb-1 pt-0.5 scroll-smooth"
      >
        {children}
      </div>
    </section>
  );
}
