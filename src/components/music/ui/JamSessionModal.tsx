import { useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Disc3,
  Loader2,
  LogOut,
  Music,
  Plus,
  Radio,
  Share2,
  Trash2,
  User,
  Users,
  Vote,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JamSession, JamParticipant, JamQueueItem, JamSessionMode } from "@/lib/jam-types";
import type { Track } from "@/lib/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: JamSession | null;
  participant: JamParticipant | null;
  participants: JamParticipant[];
  queue: JamQueueItem[];
  isHost: boolean;
  isConnecting: boolean;
  error: string | null;
  hostDisconnected: boolean;
  hostGraceSeconds: number;
  skipVotes: { current: number; required: number; hasVoted: boolean };
  currentTrack?: Track | undefined;
  isPlaying: boolean;
  onCreateJam: (params?: { title?: string | undefined; mode?: JamSessionMode | undefined; allowQueue?: boolean | undefined }) => Promise<boolean>;
  onJoinJam: (code: string) => Promise<boolean>;
  onLeaveJam: () => Promise<void>;
  onRemoveFromQueue: (queueItemId: string) => Promise<void>;
  onVoteToSkip: () => Promise<void>;
  onOpenSearch?: () => void;
};

export function JamSessionModal({
  open,
  onOpenChange,
  session,
  participant,
  participants,
  queue,
  isHost,
  isConnecting,
  error,
  hostDisconnected,
  hostGraceSeconds,
  skipVotes,
  currentTrack,
  isPlaying,
  onCreateJam,
  onJoinJam,
  onLeaveJam,
  onRemoveFromQueue,
  onVoteToSkip,
  onOpenSearch,
}: Props) {
  // Not in a session view tab
  const [entryTab, setEntryTab] = useState<"create" | "join">("create");
  // Active session view tab
  const [activeTab, setActiveTab] = useState<"queue" | "participants">("queue");

  // Creation form state
  const [jamTitle, setJamTitle] = useState("");
  const [jamMode, setJamMode] = useState<JamSessionMode>("host_controlled");
  const [allowQueue, setAllowQueue] = useState(true);

  // Join form state
  const [joinCode, setJoinCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!session?.code) return;
    void navigator.clipboard?.writeText(session.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreate = async () => {
    const trimmed = jamTitle.trim();
    await onCreateJam({
      title: trimmed || undefined,
      mode: jamMode,
      allowQueue,
    });
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    await onJoinJam(joinCode.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg bg-popover/95 backdrop-blur-xl border border-border text-foreground p-5 sm:p-6 rounded-2xl shadow-overlay max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#8B5CF6]">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-semibold text-foreground tracking-tight flex items-center gap-2">
                MelodyMap Jam
                {session && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] animate-ping" />
                    LIVE
                  </span>
                )}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground font-medium">
                {session ? "Listen to music together in real-time" : "Collaborative listening with friends"}
              </p>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW A: NO ACTIVE SESSION (START OR JOIN)                            */}
        {/* ==================================================================== */}
        {!session ? (
          <div className="mt-3 space-y-4">
            {/* Tab selector */}
            <div className="flex gap-2 p-1 bg-chip rounded-xl border border-hair">
              <button
                type="button"
                onClick={() => setEntryTab("create")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                  entryTab === "create"
                    ? "bg-[#8B5CF6] text-white font-semibold shadow-xs"
                    : "text-secondary-foreground hover:text-foreground",
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                Start a Jam
              </button>
              <button
                type="button"
                onClick={() => setEntryTab("join")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                  entryTab === "join"
                    ? "bg-[#8B5CF6] text-white font-semibold shadow-xs"
                    : "text-secondary-foreground hover:text-foreground",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                Join a Jam
              </button>
            </div>

            {entryTab === "create" ? (
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Jam Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Chill Beats with Friends"
                    value={jamTitle}
                    onChange={(e) => setJamTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-chip border border-hair text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1.5">Session Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJamMode("host_controlled")}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all",
                        jamMode === "host_controlled"
                          ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-foreground"
                          : "bg-chip border-hair text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Crown className="h-3.5 w-3.5 text-[#8B5CF6]" />
                        Host Controlled
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                        You control playback; friends listen along.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setJamMode("collaborative")}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all",
                        jamMode === "collaborative"
                          ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-foreground"
                          : "bg-chip border-hair text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Vote className="h-3.5 w-3.5 text-[#8B5CF6]" />
                        Collaborative
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                        Friends can vote to skip and curate together.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-chip border border-hair">
                  <div>
                    <span className="text-xs font-medium text-foreground block">Allow queue additions</span>
                    <span className="text-[10px] text-muted-foreground">Participants can add songs to the Jam</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowQueue}
                    onChange={(e) => setAllowQueue(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#8B5CF6]"
                  />
                </div>

                <Button
                  onClick={() => void handleCreate()}
                  disabled={isConnecting}
                  className="w-full rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2.5 text-xs font-semibold shadow-md active:scale-98 transition-all"
                >
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Radio className="h-4 w-4 mr-2" />}
                  Start Jam Session
                </Button>
              </div>
            ) : (
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">Invitation Code</label>
                  <input
                    type="text"
                    placeholder="e.g. JAM-4K9P"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-chip border border-hair text-sm font-mono tracking-widest text-center text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-center">
                    Enter the 6-character code shared by your friend.
                  </p>
                </div>

                <Button
                  onClick={() => void handleJoin()}
                  disabled={isConnecting || !joinCode.trim()}
                  className="w-full rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white py-2.5 text-xs font-semibold shadow-md active:scale-98 transition-all"
                >
                  {isConnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                  Join Jam
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* VIEW B: ACTIVE JAM SESSION                                            */
          /* ==================================================================== */
          <div className="mt-3 space-y-4">
            {/* Host Disconnection Warning */}
            {hostDisconnected && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                <WifiOff className="h-4 w-4 shrink-0 animate-pulse text-amber-400" />
                <div>
                  <span className="font-semibold block">Host temporarily disconnected</span>
                  <span className="text-[11px] opacity-80">
                    Playback will pause in {hostGraceSeconds}s if host does not return.
                  </span>
                </div>
              </div>
            )}

            {/* Session Info Bar & Share Code */}
            <div className="p-3.5 rounded-xl bg-card border border-hair flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-foreground block truncate">{session.title}</span>
                <span className="text-[10px] text-muted-foreground capitalize flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {session.mode.replace("_", " ")} mode &bull; {participants.length} connected
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/15 hover:bg-[#8B5CF6]/25 border border-[#8B5CF6]/30 text-xs font-mono font-medium text-[#8B5CF6] transition-all"
              >
                {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {session.code}
              </button>
            </div>

            {/* Currently Playing Track Banner */}
            {currentTrack ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-hair-strong">
                <img
                  src={currentTrack.thumbnail || "/brand/app-icon.png"}
                  alt={currentTrack.title}
                  className="h-12 w-12 rounded-lg object-cover ring-1 ring-border shrink-0 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-foreground block truncate">{currentTrack.title}</span>
                  <span className="text-[11px] text-muted-foreground block truncate">{currentTrack.artist}</span>
                  <span className="text-[10px] text-[#8B5CF6] font-medium flex items-center gap-1 mt-0.5">
                    <Disc3 className={cn("h-3 w-3", isPlaying && "animate-spin")} />
                    {isHost ? "You are broadcasting" : "Synced with Host"}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Skip voting banner (Collaborative mode) */}
            {session.mode === "collaborative" && (
              <div className="p-3 rounded-xl bg-chip border border-hair flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground block">Vote to Skip Track</span>
                  <span className="text-[10px] text-muted-foreground">
                    {skipVotes.current} of {skipVotes.required} votes needed
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void onVoteToSkip()}
                  disabled={skipVotes.hasVoted}
                  className="rounded-lg text-xs font-medium border-hair hover:bg-chip-strong"
                >
                  <Vote className="h-3.5 w-3.5 mr-1 text-[#8B5CF6]" />
                  {skipVotes.hasVoted ? "Voted" : "Vote Skip"}
                </Button>
              </div>
            )}

            {/* Sub-tab navigation */}
            <div className="flex gap-2 p-1 bg-chip rounded-xl border border-hair">
              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                  activeTab === "queue"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-secondary-foreground hover:text-foreground",
                )}
              >
                <Music className="h-3.5 w-3.5 text-[#8B5CF6]" />
                Shared Queue ({queue.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("participants")}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5",
                  activeTab === "participants"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-secondary-foreground hover:text-foreground",
                )}
              >
                <Users className="h-3.5 w-3.5 text-[#8B5CF6]" />
                Participants ({participants.length})
              </button>
            </div>

            {/* Tab 1: Shared Queue */}
            {activeTab === "queue" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] text-muted-foreground font-medium">Up next in Jam</span>
                  {onOpenSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenSearch();
                      }}
                      className="text-[11px] font-medium text-[#8B5CF6] hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Songs
                    </button>
                  )}
                </div>

                {queue.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground bg-chip/50 rounded-xl border border-dashed border-hair">
                    The Jam queue is empty.
                    {onOpenSearch && (
                      <p className="mt-1 text-[11px] text-[#8B5CF6] cursor-pointer hover:underline" onClick={() => { onOpenChange(false); onOpenSearch(); }}>
                        Tap here to search and add songs
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {queue.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-chip/80 border border-hair hover:bg-chip-strong transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={item.track.thumbnail || "/brand/app-icon.png"}
                            alt={item.track.title}
                            className="h-9 w-9 rounded-md object-cover ring-1 ring-border shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-foreground block truncate">{item.track.title}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {item.track.artist} &bull; Added by {item.added_by_name}
                            </span>
                          </div>
                        </div>

                        {(isHost || item.added_by_id === participant?.user_id) && (
                          <button
                            type="button"
                            onClick={() => void onRemoveFromQueue(item.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                            title="Remove from Jam queue"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Participants */}
            {activeTab === "participants" && (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-chip border border-hair"
                  >
                    <div className="flex items-center gap-2.5">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.display_name} className="h-8 w-8 rounded-full object-cover ring-1 ring-[#8B5CF6]/30" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-[#8B5CF6] flex items-center justify-center text-xs font-bold">
                          {p.display_name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">{p.display_name}</span>
                          {p.is_host && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#8B5CF6]/25 text-[#8B5CF6]">
                              <Crown className="h-2.5 w-2.5" />
                              HOST
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              p.status === "active" ? "bg-emerald-500" : "bg-muted-foreground",
                            )}
                          />
                          {p.status === "active" ? "Listening now" : "Offline"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  void onLeaveJam();
                  onOpenChange(false);
                }}
                className="rounded-xl text-xs font-semibold"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                {isHost ? "End Jam" : "Leave Jam"}
              </Button>

              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-all"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Link
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
