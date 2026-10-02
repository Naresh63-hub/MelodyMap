import { useState } from "react";
import { Check, Copy, MessageCircle, Send, Share2, Twitter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/library";

type Props = {
  open: boolean;
  track: Track | null;
  onClose: () => void;
};

export function ShareModal({ open, track, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!open || !track) return null;

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://melodymap.app";
  const shareText = `Listening to "${track.title}" by ${track.artist} on MelodyMap`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
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
          "_blank"
        ),
    },
    {
      name: "Twitter / X",
      icon: Twitter,
      bg: "bg-sky-500/20 text-sky-400 border-sky-500/30",
      action: () =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          "_blank"
        ),
    },
    {
      name: "Messages",
      icon: Send,
      bg: "bg-blue-600/20 text-blue-400 border-blue-500/30",
      action: () =>
        window.open(
          `sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
          "_blank"
        ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Panel */}
      <div className="relative w-full max-w-lg rounded-t-3xl bg-[#101010] border-t border-white/[0.06] p-5 shadow-2xl z-10 animate-slide-up">
        {/* Grab bar */}
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />

        <div className="flex items-center justify-between pb-3">
          <h2 className="text-base font-semibold text-[#F5F5F5]">Share Song</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Track Preview Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#161616] border border-white/[0.06] mb-5">
          <img
            src={track.thumbnail}
            alt=""
            className="h-12 w-12 rounded-xl object-cover shadow-md"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-[#F5F5F5]">{track.title}</h3>
            <p className="truncate text-xs text-[#A1A1A1] mt-0.5">{track.artist}</p>
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
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] transition-all active:scale-95"
              >
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full border shadow-sm",
                    svc.bg
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium text-white/70">{svc.name}</span>
              </button>
            );
          })}
        </div>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white/[0.06] border border-white/10 py-3.5 text-sm font-medium text-[#F5F5F5] hover:bg-white/10 transition-all active:scale-[0.99] mb-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-[#1DB954]" />
              <span className="text-[#1DB954]">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 text-[#A1A1A1]" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 text-xs font-semibold text-white/40 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
