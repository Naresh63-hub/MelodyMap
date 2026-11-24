import { useState, useRef, useEffect } from "react";
import { Check, Copy, Download, Image as ImageIcon, MessageCircle, Send, Share2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

type Props = {
  open: boolean;
  track: Track | null;
  lyricsSnippet?: string | undefined;
  onClose: () => void;
};

export function ShareModal({ open, track, lyricsSnippet, onClose }: Props) {
  const [tab, setTab] = useState<"link" | "card">("card");
  const [copied, setCopied] = useState(false);
  const [lyricQuote, setLyricQuote] = useState(lyricsSnippet || "");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (lyricsSnippet) {
      setLyricQuote(lyricsSnippet);
      setTab("card");
    } else {
      setLyricQuote("");
    }
  }, [lyricsSnippet, track]);

  if (!open || !track) return null;

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://melodymap.app";
  const shareText = lyricQuote
    ? `"${lyricQuote}" — from ${track.title} by ${track.artist} on MelodyMap`
    : `Listening to "${track.title}" by ${track.artist} on MelodyMap`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  /**
   * Generates a 1080x1920 high-res Story Card for Instagram & WhatsApp Stories.
   */
  const generateCardBlob = async (): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 1. Deep Midnight Gradient Background
    const bg = ctx.createLinearGradient(0, 0, 1080, 1920);
    bg.addColorStop(0, "#0F0B1A");
    bg.addColorStop(0.4, "#1E1433");
    bg.addColorStop(0.8, "#120B1E");
    bg.addColorStop(1, "#07040C");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Ambient Glowing Orbs
    const orb = ctx.createRadialGradient(540, 580, 60, 540, 580, 550);
    orb.addColorStop(0, "rgba(168, 85, 247, 0.45)");
    orb.addColorStop(0.5, "rgba(139, 92, 246, 0.2)");
    orb.addColorStop(1, "rgba(139, 92, 246, 0)");
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, 1080, 1200);

    // 3. Top Branding Header
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "600 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("MELODYMAP • MUSIC FOR LOVERS", 540, 180);

    // 4. Draw Center Album Artwork (with rounded corners)
    const artSize = 620;
    const artX = (1080 - artSize) / 2;
    const artY = 280;
    const radius = 36;

    let imageLoaded = false;
    if (track.thumbnail) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = track.thumbnail;
        });

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(artX, artY, artSize, artSize, radius);
        ctx.clip();
        ctx.drawImage(img, artX, artY, artSize, artSize);
        ctx.restore();
        imageLoaded = true;
      } catch {
        imageLoaded = false;
      }
    }

    if (!imageLoaded) {
      ctx.fillStyle = "#2D1F47";
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, radius);
      ctx.fill();

      ctx.fillStyle = "#A855F7";
      ctx.beginPath();
      ctx.arc(540, artY + artSize / 2, 120, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Track Title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    const cleanTitle = track.title.length > 28 ? `${track.title.slice(0, 26)}...` : track.title;
    ctx.fillText(cleanTitle, 540, 1010);

    // 6. Track Artist
    ctx.fillStyle = "#C4B5FD";
    ctx.font = "500 38px sans-serif";
    const cleanArtist = track.artist.length > 36 ? `${track.artist.slice(0, 34)}...` : track.artist;
    ctx.fillText(cleanArtist, 540, 1075);

    // 7. Lyric Quote Box
    const quote = lyricQuote.trim();
    if (quote) {
      const quoteBoxY = 1170;
      const quoteBoxW = 900;
      const quoteBoxX = (1080 - quoteBoxW) / 2;

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath();
      ctx.roundRect(quoteBoxX, quoteBoxY, quoteBoxW, 280, 28);
      ctx.fill();
      ctx.strokeStyle = "rgba(168, 85, 247, 0.3)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#F3E8FF";
      ctx.font = "italic 600 42px sans-serif";
      const displayQuote = quote.length > 80 ? `"${quote.slice(0, 77)}..."` : `"${quote}"`;
      ctx.fillText(displayQuote, 540, quoteBoxY + 155);
    }

    // 8. Visualizer Waves Footer
    const waveY = quote ? 1600 : 1380;
    const barWidth = 14;
    const barGap = 16;
    const heights = [35, 60, 95, 140, 80, 120, 50, 90, 130, 70, 105, 40];
    const totalW = heights.length * (barWidth + barGap);
    const startX = (1080 - totalW) / 2;

    ctx.fillStyle = "#A855F7";
    heights.forEach((h, i) => {
      const x = startX + i * (barWidth + barGap);
      ctx.beginPath();
      ctx.roundRect(x, waveY - h / 2, barWidth, h, 7);
      ctx.fill();
    });

    // 9. Bottom App Callout
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "500 28px sans-serif";
    ctx.fillText("Listen ad-free on melodymap.app", 540, 1800);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  };

  const handleDownloadCard = async () => {
    setGenerating(true);
    try {
      const blob = await generateCardBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${track.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_story.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Card download failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleShareStory = async () => {
    setGenerating(true);
    try {
      const blob = await generateCardBlob();
      if (blob && typeof navigator !== "undefined" && navigator.canShare) {
        const file = new File([blob], "melodymap_story.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: track.title,
            text: shareText,
            files: [file],
          });
          return;
        }
      }
      await handleDownloadCard();
      await handleCopy();
    } catch (err) {
      console.warn("Story share failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const shareServices = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      bg: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30",
      action: () =>
        window.open(
          `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      name: "Twitter / X",
      icon: TwitterIcon,
      bg: "bg-sky-500/20 text-sky-400 border-sky-500/30",
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
    {
      name: "Messages",
      icon: Send,
      bg: "bg-blue-600/20 text-blue-400 border-blue-500/30",
      action: () =>
        window.open(
          `sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
          "_blank",
          "noopener,noreferrer"
        ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl bg-surface border-t border-hair p-5 shadow-2xl z-10 animate-slide-up scrollbar-hide">
        {/* Grab bar */}
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-chip-strong" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Share Music</h2>
            <div className="flex rounded-full bg-chip p-0.5 border border-hair text-xs">
              <button
                type="button"
                onClick={() => setTab("card")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-all cursor-pointer",
                  tab === "card"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Story Card 🎨
              </button>
              <button
                type="button"
                onClick={() => setTab("link")}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-all cursor-pointer",
                  tab === "link"
                    ? "bg-primary text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Links
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 hover:bg-chip hover:text-foreground cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {tab === "card" ? (
          /* STORY CARD PREVIEW MODE */
          <div className="space-y-4">
            {/* 9:16 Mini Preview */}
            <div className="relative mx-auto w-64 aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-b from-[#1E1433] via-[#120B1E] to-[#0A0612] p-4 text-center flex flex-col justify-between border border-primary/30 shadow-xl shadow-primary/10 select-none">
              <div className="space-y-3">
                <span className="text-[9px] font-semibold tracking-wider text-white/50 uppercase">
                  MelodyMap Story
                </span>
                <div className="relative mx-auto aspect-square w-36 rounded-xl overflow-hidden shadow-lg border border-white/10">
                  <img
                    src={track.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="truncate text-xs font-bold text-white px-1">{track.title}</h3>
                  <p className="truncate text-[10px] text-purple-300 mt-0.5">{track.artist}</p>
                </div>
              </div>

              {/* Editable Quote Pill */}
              <div className="rounded-xl bg-white/10 border border-white/15 p-2.5">
                <p className="text-[10px] italic text-purple-100 font-medium line-clamp-2">
                  {lyricQuote.trim() ? `"${lyricQuote.trim()}"` : `"Listening on MelodyMap"`}
                </p>
              </div>

              {/* Bottom Equalizer and brand */}
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  {[20, 35, 55, 30, 48, 22].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h * 0.25}px` }}
                      className="w-1 rounded-full bg-primary"
                    />
                  ))}
                </div>
                <span className="text-[8px] text-white/40">melodymap.app</span>
              </div>
            </div>

            {/* Lyric Quote Input Field */}
            <div className="space-y-1.5">
              <label htmlFor="card-quote" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Card Quote or Lyric snippet</span>
              </label>
              <input
                id="card-quote"
                type="text"
                value={lyricQuote}
                onChange={(e) => setLyricQuote(e.target.value)}
                placeholder="e.g. Add your favorite line from this song..."
                className="h-9 w-full rounded-xl border border-hair bg-card px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleShareStory}
                disabled={generating}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-semibold text-white shadow-md shadow-primary/25 hover:bg-primary/95 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <Share2 className="h-4 w-4" />
                <span>Share to Story</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadCard}
                disabled={generating}
                className="flex items-center justify-center gap-2 rounded-xl bg-chip border border-hair-strong py-3 text-xs font-semibold text-foreground hover:bg-chip-strong transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>Save Image</span>
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD LINK SHARE MODE */
          <div>
            {/* Track Preview Card */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-card border border-hair mb-5">
              <img
                src={track.thumbnail}
                alt=""
                className="h-12 w-12 rounded-xl object-cover shadow-md"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-foreground">{track.title}</h3>
                <p className="truncate text-xs text-secondary-foreground mt-0.5">{track.artist}</p>
              </div>
            </div>

            {/* Share apps grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {shareServices.map((svc) => {
                const Icon = svc.icon;
                return (
                  <button
                    key={svc.name}
                    type="button"
                    onClick={svc.action}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-chip-subtle border border-hair hover:bg-chip transition-all active:scale-95 cursor-pointer"
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full border shadow-sm",
                        svc.bg
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-medium text-foreground/70">{svc.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-chip border border-hair-strong py-3.5 text-sm font-medium text-foreground hover:bg-chip-strong transition-all active:scale-[0.99] mb-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-primary">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-secondary-foreground" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 text-xs font-semibold text-foreground/40 hover:text-foreground transition-colors cursor-pointer mt-1"
        >
          Close
        </button>
      </div>
    </div>
  );
}
export default ShareModal;
