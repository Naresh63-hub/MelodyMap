// Adaptive recommendation engine that learns from user behavior
// Tracks skips, likes, listen duration, and adjusts recommendations accordingly

interface ListenEvent {
  trackId: string;
  timestamp: number;
  duration: number; // seconds listened
  skipped: boolean;
  liked: boolean;
  position: number; // position when skipped
}

interface RecommendationWeights {
  genreBoost: Record<string, number>;
  artistBoost: Record<string, number>;
  energyBoost: number; // -1 to 1
  valenceBoost: number; // -1 to 1
}

const LISTEN_HISTORY_KEY = 'melodymap-listen-history';
const MAX_HISTORY = 200;

export class AdaptiveRecommendationEngine {
  private listenHistory: ListenEvent[] = [];
  private weights: RecommendationWeights = {
    genreBoost: {},
    artistBoost: {},
    energyBoost: 0,
    valenceBoost: 0,
  };

  constructor() {
    this.loadHistory();
    this.calculateWeights();
  }

  private loadHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(LISTEN_HISTORY_KEY);
      if (saved) {
        this.listenHistory = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading listen history:', e);
    }
  }

  private saveHistory() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(LISTEN_HISTORY_KEY, JSON.stringify(this.listenHistory));
    } catch (e) {
      console.error('Error saving listen history:', e);
    }
  }

  recordListen(event: ListenEvent) {
    this.listenHistory.push(event);
    
    // Keep only recent history
    if (this.listenHistory.length > MAX_HISTORY) {
      this.listenHistory = this.listenHistory.slice(-MAX_HISTORY);
    }
    
    this.saveHistory();
    this.calculateWeights();
  }

  private calculateWeights() {
    // Reset weights
    this.weights = {
      genreBoost: {},
      artistBoost: {},
      energyBoost: 0,
      valenceBoost: 0,
    };

    const recentEvents = this.listenHistory.slice(-50); // Last 50 events
    
    // Calculate artist boosts based on likes and long listens
    recentEvents.forEach(event => {
      if (event.liked) {
        this.weights.artistBoost[event.trackId] = 
          (this.weights.artistBoost[event.trackId] || 0) + 2;
      }
      
      if (event.duration > 60 && !event.skipped) {
        this.weights.artistBoost[event.trackId] = 
          (this.weights.artistBoost[event.trackId] || 0) + 1;
      }
      
      if (event.skipped && event.position < 10) {
        this.weights.artistBoost[event.trackId] = 
          (this.weights.artistBoost[event.trackId] || 0) - 1;
      }
    });

    // Calculate energy/valence based on skip patterns
    const earlySkips = recentEvents.filter(e => e.skipped && e.position < 10);
    const longListens = recentEvents.filter(e => e.duration > 60 && !e.skipped);
    
    if (earlySkips.length > longListens.length) {
      // User skips early often - prefer high energy
      this.weights.energyBoost = 0.5;
    } else if (longListens.length > earlySkips.length) {
      // User listens through - prefer lower energy for longer sessions
      this.weights.energyBoost = -0.3;
    }
  }

  getScore(trackId: string, trackMetadata?: { genre?: string; artist?: string }): number {
    let score = 0;
    
    // Artist boost
    score += this.weights.artistBoost[trackId] || 0;
    
    // Genre boost (if metadata available)
    if (trackMetadata?.genre) {
      score += this.weights.genreBoost[trackMetadata.genre] || 0;
    }
    
    // Energy boost (simulated)
    score += this.weights.energyBoost;
    
    // Valence boost (simulated)
    score += this.weights.valenceBoost;
    
    return score;
  }

  rankTracks(tracks: Array<{ id: string; metadata?: { genre?: string; artist?: string } }>) {
    return tracks
      .map(track => ({
        ...track,
        score: this.getScore(track.id, track.metadata),
      }))
      .sort((a, b) => b.score - a.score);
  }

  getWeights(): RecommendationWeights {
    return { ...this.weights };
  }
}

export const adaptiveEngine = new AdaptiveRecommendationEngine();
