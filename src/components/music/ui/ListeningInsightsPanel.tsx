import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Flame,
  Heart,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import { telemetry, type PlaybackTelemetryEvent } from "@/lib/telemetry";
import { contextEngine, getTemporalContext } from "@/lib/context-engine";
import { ThompsonSamplingPolicy } from "@/lib/bandit-policy";
import { runBanditSimulation, type SimulationReport } from "@/lib/bandit-evaluation";
import { Button } from "@/components/ui/button";

const FEATURE_LABELS = [
  { idx: 1, name: "Circadian Alignment", desc: "Syncs songs to current time of day", icon: Clock },
  { idx: 2, name: "Energy Flow Continuity", desc: "Smooth track-to-track AutoDJ energy transitions", icon: Zap },
  { idx: 3, name: "Artist Loyalty", desc: "Prioritizes your proven favorite artists", icon: Heart },
  { idx: 4, name: "Discovery & Novelty", desc: "Ventures into fresh artists and unexpected gems", icon: Compass },
  { idx: 5, name: "Session Momentum", desc: "Adapts to skip/listen streaks during active session", icon: Flame },
];

export function ListeningInsightsPanel() {
  const [simulationReport, setSimulationReport] = useState<SimulationReport | null>(null);
  const [isRunningSim, setIsRunningSim] = useState(false);

  // 1. Gather Telemetry & Playback Statistics
  const stats = useMemo(() => {
    const events: PlaybackTelemetryEvent[] = telemetry.getBufferedEvents();
    const completions = events.filter((e) => e.eventType === "COMPLETED").length;
    const skips = events.filter((e) => e.eventType === "SKIPPED").length;
    const likes = events.filter((e) => e.eventType === "LIKED").length;
    const fastSkips = events.filter((e) => e.eventType === "SKIPPED" && e.positionSeconds < 10).length;
    const totalPlays = events.filter((e) => e.eventType === "PLAY_START" || e.eventType === "COMPLETED").length || events.length;

    const completionRate = totalPlays > 0 ? Math.round((completions / totalPlays) * 100) : 0;
    const skipRate = totalPlays > 0 ? Math.round((skips / totalPlays) * 100) : 0;

    return {
      totalEvents: events.length,
      completions,
      skips,
      likes,
      fastSkips,
      completionRate,
      skipRate,
    };
  }, []);

  // 2. Gather AI Bandit Parameter Weights
  const banditModel = useMemo(() => {
    const policy = new ThompsonSamplingPolicy();
    const state = policy.getModelState();
    return {
      mu: state.mu,
      totalUpdates: state.totalUpdates,
      lastUpdated: state.lastUpdated,
    };
  }, []);

  // 3. Artist Affinity Spectrum
  const affinity = useMemo(() => {
    return contextEngine.getAffinityWeights();
  }, []);

  // 4. Current Circadian Context
  const temporalCtx = useMemo(() => {
    return getTemporalContext();
  }, []);

  // Run offline benchmark simulation
  const handleRunSimulation = () => {
    setIsRunningSim(true);
    setTimeout(() => {
      try {
        const report = runBanditSimulation(undefined, {
          rounds: 200,
          candidatePoolSize: 10,
          epsilon: 0.1,
        });
        setSimulationReport(report);
      } finally {
        setIsRunningSim(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Circadian & AI Status */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground tracking-[-0.01em]">Adaptive Audio Intelligence</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  LinTS Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Current window: <span className="font-medium text-foreground">{temporalCtx.label}</span> ({temporalCtx.energy} energy)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground">Learned Updates</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">{banditModel.totalUpdates} telemetry points</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="flex justify-center text-primary mb-1.5">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-[-0.01em] tabular-nums">
            {stats.completionRate}%
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Completion Rate</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="flex justify-center text-primary mb-1.5">
            <Heart className="h-4 w-4" />
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-[-0.01em] tabular-nums">
            {stats.likes}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Loved Tracks</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="flex justify-center text-primary mb-1.5">
            <RotateCcw className="h-4 w-4" />
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-[-0.01em] tabular-nums">
            {stats.skips}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Skips Avoided</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <div className="flex justify-center text-primary mb-1.5">
            <Play className="h-4 w-4" />
          </div>
          <p className="text-2xl font-semibold text-foreground tracking-[-0.01em] tabular-nums">
            {stats.completions}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground mt-0.5">Full Listens</p>
        </div>
      </div>

      {/* Recommender Bayesian Weights Radar / Bars */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h4 className="text-xs font-medium text-foreground tracking-[0.06em] uppercase">Your Learned Taste Vectors ($\mu$)</h4>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Thompson Posterior</span>
        </div>

        <div className="space-y-3.5">
          {FEATURE_LABELS.map((item) => {
            const rawVal = banditModel.mu[item.idx] ?? 0.5;
            // Normalize roughly [-0.2, 1.2] -> [0%, 100%]
            const pct = Math.max(5, Math.min(100, Math.round(rawVal * 100)));
            const Icon = item.icon;

            return (
              <div key={item.idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {item.name}
                  </span>
                  <span className="text-[11px] font-medium text-primary tabular-nums">
                    {pct}% <span className="font-normal text-muted-foreground font-mono">({rawVal.toFixed(2)})</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-chip">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Artist Affinity & Deprioritization */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Affinity Artists */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-medium text-foreground tracking-[0.06em] uppercase">Top Affinity Artists</h4>
          </div>
          {affinity.affinityArtists.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {affinity.affinityArtists.map((artist: string) => (
                <span
                  key={artist}
                  className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary border border-primary/20"
                >
                  {artist}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Keep listening to tracks to discover your top affinity artists.
            </p>
          )}
        </div>

        {/* Deprioritized Artists */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-medium text-foreground tracking-[0.06em] uppercase">Deprioritized on Skip</h4>
          </div>
          {affinity.penalizedArtists.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {affinity.penalizedArtists.map((artist: string) => (
                <span
                  key={artist}
                  className="rounded-lg bg-surface-hover px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border"
                >
                  {artist}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No skipped artists. The AI will avoid repeatedly skipped music automatically.
            </p>
          )}
        </div>
      </div>

      {/* Offline Recommender Evaluation Simulation Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-medium text-foreground tracking-[0.06em] uppercase">Offline Bandit Benchmark</h4>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulate 200 listening sessions comparing Thompson Sampling vs Random &amp; $\varepsilon$-Greedy baselines.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleRunSimulation}
            disabled={isRunningSim}
            className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium cursor-pointer"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {isRunningSim ? "Simulating..." : "Run 200-Round Benchmark"}
          </Button>
        </div>

        {simulationReport && (
          <div className="rounded-lg border border-border bg-black/30 p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center border-b border-border pb-3">
              <div>
                <p className="text-lg font-semibold text-primary tabular-nums">
                  +{simulationReport.summary.thompsonVsRandomImprovement}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Reward vs Random</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  -{simulationReport.summary.thompsonRegretReductionVsRandom}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Regret Reduction</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {Math.round(simulationReport.results.thompson.artistDiversityRatio * 100)}%
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">Artist Diversity</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Thompson Sampling (LinTS):</span>
                <span className="font-semibold text-primary">{simulationReport.results.thompson.cumulativeReward} reward</span>
              </div>
              <div className="flex justify-between">
                <span>Epsilon-Greedy ($\varepsilon$=0.1):</span>
                <span className="font-medium text-foreground/70">{simulationReport.results.epsilonGreedy.cumulativeReward} reward</span>
              </div>
              <div className="flex justify-between">
                <span>Random Baseline:</span>
                <span className="font-medium text-muted-foreground">{simulationReport.results.random.cumulativeReward} reward</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
