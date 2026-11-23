import { describe, it, expect } from "vitest";
import {
  getCollaboratorSingersForComposer,
  getCollaboratorSingersForSinger,
  getModernEraBridges,
  generateSoundtrackCrossPollinationQueries,
  isSoundtrackCrossPollinationMatch,
  enforceAutoDjRuleOfThree,
  getEmergingSingersForLanguages,
  generateFreshVoicesQueries,
  filterFreshVoicesTracks,
  pickSurpriseTrack,
} from "./collaboration-discovery";
import type { TrackLike } from "./track-dedup";

describe("MelodyMap Algorithmic Discovery Suite", () => {
  // 1. Composer & Singer Network Bridge (Collaboration Discovery)
  describe("1. Composer & Singer Network Bridge", () => {
    it("retrieves collaborator singers for a known composer", () => {
      const heshamCollaborators = getCollaboratorSingersForComposer("Hesham Abdul Wahab");
      expect(heshamCollaborators.length).toBeGreaterThan(0);
      const lower = heshamCollaborators.map((s) => s.toLowerCase());
      expect(lower).toContain("sid sriram");
      expect(lower).toContain("anurag kulkarni");
      expect(lower).toContain("chinmayi");

      const dspCollaborators = getCollaboratorSingersForComposer("Devi Sri Prasad");
      expect(dspCollaborators.map((s) => s.toLowerCase())).toContain("ram miriyala");
    });

    it("uses a familiar singer to discover other singers collaborating with the same composers", () => {
      // Listener loves Sid Sriram, knows only Sid Sriram
      const familiar = new Set(["sid sriram"]);
      const discoveredSingers = getCollaboratorSingersForSinger("Sid Sriram", familiar);

      expect(discoveredSingers.length).toBeGreaterThan(0);
      const lower = discoveredSingers.map((s) => s.toLowerCase());
      // Should NOT contain the familiar singer itself
      expect(lower).not.toContain("sid sriram");
      // Should introduce collaborator voices under Hesham / Thaman / Anirudh / DSP
      expect(lower.some((s) => ["anurag kulkarni", "kapil kapilan", "pradeep kumar", "chinmayi", "ram miriyala"].includes(s))).toBe(true);
    });

    it("excludes user's already familiar artists from discovered collaborator list", () => {
      const familiar = new Set(["sid sriram", "anurag kulkarni", "chinmayi"]);
      const discovered = getCollaboratorSingersForSinger("Sid Sriram", familiar);

      const lower = discovered.map((s) => s.toLowerCase());
      expect(lower).not.toContain("anurag kulkarni");
      expect(lower).not.toContain("chinmayi");
    });
  });

  // 2. Soundtrack Cross-Pollination (Discover Within the Same Film)
  describe("2. Soundtrack Cross-Pollination", () => {
    it("generates targeted soundtrack album queries from liked movie songs", () => {
      const liked: TrackLike[] = [
        { id: "1", title: "Samajavaragamana", artist: "Sid Sriram", album: "Ala Vaikunthapurramuloo" },
        { id: "2", title: "Butta Bomma", artist: "Armaan Malik", album: "Ala Vaikunthapurramuloo" },
        { id: "3", title: "Ooru Paletooru", artist: "Balagam", album: "Balagam" },
      ];

      const queries = generateSoundtrackCrossPollinationQueries(liked, 2);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.some((q) => q.toLowerCase().includes("ala vaikunthapurramuloo"))).toBe(true);
      expect(queries.some((q) => q.toLowerCase().includes("balagam"))).toBe(true);
    });

    it("identifies tracks from the same movie soundtrack featuring different singers", () => {
      const liked: TrackLike[] = [
        { id: "1", title: "Samajavaragamana", artist: "Sid Sriram", album: "Ala Vaikunthapurramuloo" },
      ];

      // Same movie, DIFFERENT singer -> Cross-pollination match!
      const companionSong: TrackLike = {
        id: "2",
        title: "Ramuloo Ramulaa",
        artist: "Anurag Kulkarni",
        album: "Ala Vaikunthapurramuloo",
      };
      expect(isSoundtrackCrossPollinationMatch(companionSong, liked)).toBe(true);

      // Same movie, SAME singer -> not a new singer cross-pollination
      const sameSingerSong: TrackLike = {
        id: "3",
        title: "Another Song",
        artist: "Sid Sriram",
        album: "Ala Vaikunthapurramuloo",
      };
      expect(isSoundtrackCrossPollinationMatch(sameSingerSong, liked)).toBe(false);

      // Different movie -> false
      const differentMovieSong: TrackLike = {
        id: "4",
        title: "Dosti",
        artist: "Hemachandra",
        album: "RRR",
      };
      expect(isSoundtrackCrossPollinationMatch(differentMovieSong, liked)).toBe(false);
    });
  });

  // 3. Era Bridging (Connecting Nostalgia to Contemporary Voices)
  describe("3. Era Bridging", () => {
    it("bridges vintage South legends to contemporary vocal counterparts", () => {
      // SPB -> Pradeep Kumar, Anurag Kulkarni, Kapil Kapilan
      const spbBridges = getModernEraBridges("SP Balasubrahmanyam").map((s) => s.toLowerCase());
      expect(spbBridges).toContain("pradeep kumar");
      expect(spbBridges).toContain("anurag kulkarni");

      // Hariharan -> Pradeep Kumar, Kapil Kapilan, Haricharan
      const hariBridges = getModernEraBridges("Hariharan").map((s) => s.toLowerCase());
      expect(hariBridges).toContain("pradeep kumar");
      expect(hariBridges).toContain("kapil kapilan");

      // K.S. Chithra -> Sireesha Bhagavatula, Chinmayi, Shreya Ghoshal
      const chithraBridges = getModernEraBridges("K.S. Chithra").map((s) => s.toLowerCase());
      expect(chithraBridges).toContain("sireesha bhagavatula");
      expect(chithraBridges).toContain("chinmayi");
    });

    it("bridges vintage Hindi legends to contemporary vocal counterparts", () => {
      // Kishore Kumar -> Arijit Singh, Sonu Nigam
      const kishoreBridges = getModernEraBridges("Kishore Kumar").map((s) => s.toLowerCase());
      expect(kishoreBridges).toContain("arijit singh");

      // Mohammed Rafi -> Sonu Nigam, Javed Ali
      const rafiBridges = getModernEraBridges("Mohammed Rafi").map((s) => s.toLowerCase());
      expect(rafiBridges).toContain("sonu nigam");
    });

    it("handles variations in capitalization and whitespace", () => {
      const bridges = getModernEraBridges("   spb   ").map((s) => s.toLowerCase());
      expect(bridges).toContain("pradeep kumar");
    });
  });

  // 5. AutoDJ "Rule of 3" Anti-Clustering Guard
  describe("5. AutoDJ Rule of 3 Anti-Clustering Guard", () => {
    const makeTrack = (id: string, artist: string): TrackLike => ({
      id,
      title: `Song ${id}`,
      artist,
    });

    it("enforces max 2 tracks by the same artist within any sliding window of 6 songs", () => {
      // Pool with Artist A clustered at the top, along with diverse other artists
      const candidates: TrackLike[] = [
        makeTrack("1", "Artist A"),
        makeTrack("2", "Artist A"),
        makeTrack("3", "Artist A"),
        makeTrack("4", "Artist B"),
        makeTrack("5", "Artist C"),
        makeTrack("6", "Artist D"),
        makeTrack("7", "Artist E"),
        makeTrack("8", "Artist F"),
        makeTrack("9", "Artist G"),
        makeTrack("10", "Artist H"),
      ];

      const guarded = enforceAutoDjRuleOfThree(candidates, [], new Set(["artist a"]));

      // Verify that in any window of 6 consecutive songs, Artist A appears at most 2 times
      for (let i = 0; i <= guarded.length - 6; i++) {
        const window = guarded.slice(i, i + 6);
        const countArtistA = window.filter((t) => (t.artist || "").toLowerCase() === "artist a").length;
        expect(countArtistA).toBeLessThanOrEqual(2);
      }
    });

    it("guarantees at least 1 fresh / unfamiliar voice in every 3 queued songs", () => {
      const familiarArtists = new Set(["familiar 1", "familiar 2"]);

      const candidates: TrackLike[] = [
        makeTrack("f1", "Familiar 1"),
        makeTrack("f2", "Familiar 2"),
        makeTrack("f3", "Familiar 1"),
        makeTrack("f4", "Familiar 2"),
        makeTrack("u1", "Unfamiliar Voice 1"),
        makeTrack("u2", "Unfamiliar Voice 2"),
      ];

      const guarded = enforceAutoDjRuleOfThree(candidates, [], familiarArtists);

      // Verify: never 3 consecutive familiar songs
      let consecutiveFamiliar = 0;
      for (const track of guarded) {
        const isFamiliar = familiarArtists.has((track.artist || "").toLowerCase());
        if (isFamiliar) {
          consecutiveFamiliar += 1;
          expect(consecutiveFamiliar).toBeLessThanOrEqual(2); // Never 3 in a row
        } else {
          consecutiveFamiliar = 0;
        }
      }
    });

    it("preserves all input candidates without dropping tracks", () => {
      const candidates: TrackLike[] = [
        makeTrack("1", "Sid Sriram"),
        makeTrack("2", "Sid Sriram"),
        makeTrack("3", "Anurag Kulkarni"),
        makeTrack("4", "Kapil Kapilan"),
        makeTrack("5", "Sid Sriram"),
        makeTrack("6", "Chinmayi"),
      ];

      const guarded = enforceAutoDjRuleOfThree(candidates, [], new Set(["sid sriram"]));
      expect(guarded.length).toBe(candidates.length);
      const originalIds = new Set(candidates.map((c) => c.id));
      const guardedIds = new Set(guarded.map((g) => g.id));
      expect(guardedIds).toEqual(originalIds);
    });
  });

  // 6. "Fresh Voices" Dedicated Discovery Rail
  describe("6. Fresh Voices Dedicated Discovery Rail", () => {
    it("retrieves emerging playback singers in the user's selected languages", () => {
      const teluguSingers = getEmergingSingersForLanguages(["Telugu"]).map((s) => s.toLowerCase());
      expect(teluguSingers).toContain("kapil kapilan");
      expect(teluguSingers).toContain("sireesha bhagavatula");
      expect(teluguSingers).toContain("ram miriyala");

      const hindiSingers = getEmergingSingersForLanguages(["Hindi"]).map((s) => s.toLowerCase());
      expect(hindiSingers).toContain("anuv jain");
      expect(hindiSingers).toContain("prateek kuhad");

      const tamilSingers = getEmergingSingersForLanguages(["Tamil"]).map((s) => s.toLowerCase());
      expect(tamilSingers).toContain("pradeep kumar");
      expect(tamilSingers).toContain("dhee");
    });

    it("strictly excludes user's top familiar artists from the emerging singer list", () => {
      const familiar = new Set(["kapil kapilan", "ram miriyala"]);
      const freshSingers = getEmergingSingersForLanguages(["Telugu"], familiar).map((s) => s.toLowerCase());

      expect(freshSingers).not.toContain("kapil kapilan");
      expect(freshSingers).not.toContain("ram miriyala");
      expect(freshSingers).toContain("sireesha bhagavatula");
    });

    it("generates targeted search queries for emerging singers and breakthrough tracks", () => {
      const queries = generateFreshVoicesQueries(["Telugu"], new Set(["sid sriram"]), 4);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.some((q) => q.toLowerCase().includes("telugu indie songs") || q.toLowerCase().includes("breakthrough"))).toBe(true);
      expect(queries.some((q) => q.toLowerCase().includes("songs"))).toBe(true);
    });

    it("filterFreshVoicesTracks strictly excludes tracks from familiar artists and deduplicates", () => {
      const familiar = new Set(["sid sriram", "anirudh ravichander"]);
      const candidates: TrackLike[] = [
        { id: "1", title: "Track 1", artist: "Sid Sriram" }, // familiar -> exclude
        { id: "2", title: "Track 2", artist: "Anirudh Ravichander" }, // familiar -> exclude
        { id: "3", title: "Track 3", artist: "Kapil Kapilan" }, // fresh -> keep
        { id: "4", title: "Track 4", artist: "Sireesha Bhagavatula" }, // fresh -> keep
        { id: "5", title: "Track 3", artist: "Kapil Kapilan" }, // duplicate -> exclude
      ];

      const filtered = filterFreshVoicesTracks(candidates, familiar);
      expect(filtered.length).toBe(2);
      expect(filtered.map((t) => t.id)).toEqual(["3", "4"]);
    });
  });

  // 7. "Surprise Me" / Serendipity Dice 🎲 1-Tap Exploration Action
  describe("7. Surprise Me / Serendipity Dice 1-Tap Exploration", () => {
    it("picks a top track from an artist the user has never played before", () => {
      const allPlayedArtists = new Set(["sid sriram", "anirudh", "dsp"]);
      const candidates: TrackLike[] = [
        { id: "1", title: "Song 1", artist: "Sid Sriram" }, // already played
        { id: "2", title: "Song 2", artist: "DSP" }, // already played
        { id: "3", title: "Serendipity Gem", artist: "Pradeep Kumar" }, // NEVER played -> target!
        { id: "4", title: "Song 4", artist: "Kapil Kapilan" },
      ];

      const picked = pickSurpriseTrack(candidates, allPlayedArtists);
      expect(picked).not.toBeNull();
      expect(picked?.id).toBe("3");
      expect(picked?.title).toBe("Serendipity Gem");
      expect(picked?.artist).toBe("Pradeep Kumar");
    });

    it("falls back gracefully to first valid candidate if all available tracks have some prior play history", () => {
      const allPlayedArtists = new Set(["sid sriram", "anirudh"]);
      const candidates: TrackLike[] = [
        { id: "1", title: "Song 1", artist: "Sid Sriram" },
        { id: "2", title: "Song 2", artist: "Anirudh" },
      ];

      const picked = pickSurpriseTrack(candidates, allPlayedArtists);
      expect(picked).not.toBeNull();
      expect(picked?.id).toBe("1");
    });

    it("returns null when candidates list is empty", () => {
      const picked = pickSurpriseTrack([], new Set(["sid sriram"]));
      expect(picked).toBeNull();
    });
  });
});
