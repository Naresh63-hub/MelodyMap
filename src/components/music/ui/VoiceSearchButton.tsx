import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceSearchButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  disabled?: boolean;
}

// Window type augmentation for Web Speech API
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export function VoiceSearchButton({
  onTranscript,
  className,
  disabled = false,
}: VoiceSearchButtonProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = navigator.language || "en-US";

        recognition.onstart = () => {
          setIsListening(true);
          setFeedback("Listening... speak now");
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const current = event.resultIndex;
          const transcript = event.results[current]?.[0]?.transcript?.trim();
          if (transcript) {
            setFeedback(`"${transcript}"`);
            onTranscript(transcript);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          setIsListening(false);
          if (event.error === "not-allowed") {
            setFeedback("Microphone access denied");
          } else if (event.error === "no-speech") {
            setFeedback("No speech detected");
          } else if (event.error !== "aborted") {
            setFeedback("Voice error. Try typing");
          }
          if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
          feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 3000);
        };

        recognition.onend = () => {
          setIsListening(false);
          if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
          feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 2500);
        };

        recognitionRef.current = recognition;
      } catch (err) {
        console.warn("[VoiceSearch] Init error:", err);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, [onTranscript]);

  const toggleListening = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isSupported) {
        setFeedback("Voice dictation not supported in this browser");
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 3000);
        return;
      }

      if (isListening) {
        try {
          recognitionRef.current?.stop();
        } catch {}
        setIsListening(false);
      } else {
        try {
          recognitionRef.current?.start();
        } catch (err) {
          // If already running, abort and restart
          try {
            recognitionRef.current?.abort();
            setTimeout(() => recognitionRef.current?.start(), 100);
          } catch {}
        }
      }
    },
    [isSupported, isListening],
  );

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled}
        aria-label={isListening ? "Stop voice dictation" : "Dictate song or artist name"}
        title={isListening ? "Listening... click to stop" : "Voice search (dictate song or artist)"}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-1 focus:ring-white/20 active:scale-95",
          isListening
            ? "bg-emerald-500/20 text-[#1DB954] ring-2 ring-[#1DB954]/50 shadow-[0_0_12px_rgba(29,185,84,0.35)]"
            : "text-white/40 hover:text-white/80 hover:bg-white/[0.06]",
          className,
        )}
      >
        {isListening ? (
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1DB954] opacity-50" />
            <Mic className="relative h-4 w-4 text-[#1DB954]" />
          </span>
        ) : !isSupported ? (
          <MicOff className="h-4 w-4 opacity-40" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {/* Floating feedback badge while listening or on result */}
      {feedback && (
        <div className="absolute -bottom-8 right-0 z-30 whitespace-nowrap rounded-md bg-[#1a1a1a] px-2.5 py-1 text-[11px] font-medium text-white/90 shadow-lg border border-white/[0.08] backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none">
          <div className="flex items-center gap-1.5">
            {isListening && <Loader2 className="h-3 w-3 animate-spin text-[#1DB954]" />}
            <span>{feedback}</span>
          </div>
        </div>
      )}
    </div>
  );
}
