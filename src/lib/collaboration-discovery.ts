/**
 * MelodyMap Algorithmic Discovery Suite:
 * 1. The "Composer & Singer Network Bridge" (Collaboration Discovery)
 * 2. Soundtrack Cross-Pollination (Discover Within the Same Film)
 * 3. "Era Bridging" (Connecting Nostalgia to Contemporary Voices)
 * 5. AutoDJ "Rule of 3" Anti-Clustering Guard
 *
 * Lightweight, pure TypeScript recommendation foundations with zero heavy dependencies.
 */

import {
  type TrackLike,
  normalizeArtistAlias,
  extractPrimaryArtist,
  extractTrackMovieOrAlbum,
} from "./track-dedup";
import { isKnownComposer } from "./taste-profile";

/**
 * Key composers and their notable playback singer collaborator networks.
 * Enables using a familiar composer as a musical bridge to introduce fresh singers
 * who match the user's preferred sonic aesthetic.
 */
export const COMPOSER_COLLABORATOR_NETWORKS: Record<string, string[]> = {
  // Telugu & South Composers
  "devi sri prasad": [
    "Sid Sriram", "Ram Miriyala", "Anurag Kulkarni", "Jaspreet Jasz",
    "Mangli", "Armaan Malik", "Sunitha", "Kapil Kapilan", "Indravathi Chauhan", "Shilpa Rao"
  ],
  "s. thaman": [
    "Sid Sriram", "Anurag Kulkarni", "Armaan Malik", "Shreya Ghoshal",
    "Kapil Kapilan", "Rahul Sipligunj", "Sahithi Chaganti", "Nakash Aziz", "Deepak Blue"
  ],
  "anirudh ravichander": [
    "Sid Sriram", "Pradeep Kumar", "Jonita Gandhi", "Kapil Kapilan",
    "Shilpa Rao", "Dhanush", "Anthony Daasan", "Sean Roldan", "Ravi G"
  ],
  "hesham abdul wahab": [
    "Sid Sriram", "Anurag Kulkarni", "Chinmayi", "Kapil Kapilan",
    "K.S. Chithra", "Sireesha Bhagavatula", "Haricharan", "Divya S. Menon"
  ],
  "m.m. keeravaani": [
    "Kaala Bhairava", "Rahul Sipligunj", "Sunitha", "K.S. Chithra",
    "Hemachandra", "Ramya Behara", "SP Balasubrahmanyam", "M.M. Manasi"
  ],
  "mickey j meyer": [
    "Karthik", "Anurag Kulkarni", "Shreya Ghoshal", "Ramya Behara",
    "Haricharan", "Abhay Jodhpurkar", "Sameera Bharadwaj"
  ],
  "vivek sagar": [
    "Anurag Kulkarni", "Ram Miriyala", "Pradeep Kumar", "Chaitanya Prasad",
    "Kapil Kapilan", "Manisha Eerabathini", "Lipsika"
  ],
  "g.v. prakash kumar": [
    "Sid Sriram", "Pradeep Kumar", "Dhanush", "Saindhavi",
    "Shreya Ghoshal", "Haricharan", "Kapil Kapilan"
  ],
  "santhosh narayanan": [
    "Pradeep Kumar", "Sid Sriram", "Dhee", "Sean Roldan",
    "Ananthu", "Meenakshi Elayaraja", "Dhruv Vikram"
  ],
  "chaitan bharadwaj": [
    "Anurag Kulkarni", "Chaitan Bharadwaj", "Haricharan", "Deepu", "Lipsika"
  ],
  "bheems ceciroleo": [
    "Ram Miriyala", "Mangli", "Bheems Ceciroleo", "Madhu Priya", "Swathi Reddy"
  ],

  // Hindi & Pan-Indian Composers
  "a.r. rahman": [
    "Hariharan", "SP Balasubrahmanyam", "K.S. Chithra", "Shreya Ghoshal",
    "Sid Sriram", "Haricharan", "Javed Ali", "Mohit Chauhan", "Jonita Gandhi", "Shashaa Tirupati"
  ],
  "pritam": [
    "Arijit Singh", "KK", "Mohit Chauhan", "Shreya Ghoshal",
    "Atif Aslam", "Jubin Nautiyal", "Antara Mitra", "Nikhita Gandhi"
  ],
  "sachin-jigar": [
    "Arijit Singh", "Atif Aslam", "Darshan Raval", "Varun Jain", "Shreya Ghoshal"
  ],
  "amit trivedi": [
    "Arijit Singh", "Jasleen Royal", "Shahid Mallya", "Sunidhi Chauhan", "Tochi Raina"
  ],
  "vishal mishra": [
    "Vishal Mishra", "Arijit Singh", "Shreya Ghoshal", "Pratik Bachan"
  ],
};

/**
 * Modern contemporary vocal counterparts mapped to classic golden-era voices.
 * Enables bridging nostalgic warmth to contemporary fresh releases.
 */
export const ERA_VOCAL_BRIDGES: Record<string, string[]> = {
  // Male South Legends -> Contemporary Vocalists
  "sp balasubrahmanyam": [
    "Pradeep Kumar", "Anurag Kulkarni", "Kapil Kapilan", "Kaala Bhairava", "Vijay Prakash"
  ],
  "spb": [
    "Pradeep Kumar", "Anurag Kulkarni", "Kapil Kapilan", "Kaala Bhairava"
  ],
  "hariharan": [
    "Pradeep Kumar", "Kapil Kapilan", "Haricharan", "Sooraj Santhosh", "Karthik"
  ],
  "k.j. yesudas": [
    "Haricharan", "Sooraj Santhosh", "Vijay Yesudas", "Pradeep Kumar"
  ],
  "mano": [
    "Ram Miriyala", "Rahul Sipligunj", "Jaspreet Jasz", "Nakash Aziz"
  ],

  // Female South Legends -> Contemporary Vocalists
  "k.s. chithra": [
    "Sireesha Bhagavatula", "Chinmayi", "Shreya Ghoshal", "Saindhavi", "Ramya Behara"
  ],
  "chithra": [
    "Sireesha Bhagavatula", "Chinmayi", "Shreya Ghoshal", "Saindhavi"
  ],
  "s. janaki": [
    "Sireesha Bhagavatula", "Ramya Behara", "Geetha Madhuri", "Sunitha"
  ],
  "sadhana sargam": [
    "Shreya Ghoshal", "Chinmayi", "Neeti Mohan", "Sireesha Bhagavatula"
  ],

  // Male Hindi Legends -> Contemporary Vocalists
  "kishore kumar": [
    "Arijit Singh", "Sonu Nigam", "Ayushmann Khurrana", "Shaan"
  ],
  "mohammed rafi": [
    "Sonu Nigam", "Javed Ali", "Udit Narayan"
  ],
  "kumar sanu": [
    "Jubin Nautiyal", "Arijit Singh", "Stebin Ben", "Atif Aslam"
  ],
  "udit narayan": [
    "Armaan Malik", "Aditya Narayan", "Darshan Raval"
  ],
  "kk": [
    "Vishal Mishra", "Arijit Singh", "Mohit Chauhan", "Darshan Raval"
  ],

  // Female Hindi Legends -> Contemporary Vocalists
  "lata mangeshkar": [
    "Shreya Ghoshal", "Sunidhi Chauhan", "Palak Muchhal", "Madhushree"
  ],
  "asha bhosle": [
    "Sunidhi Chauhan", "Neha Kakkar", "Jonita Gandhi", "Shalmali Kholgade"
  ],
  "alka yagnik": [
    "Shreya Ghoshal", "Palak Muchhal", "Tulsi Kumar", "Antara Mitra"
  ],
};

/**
 * Returns collaborator playback singers for a known composer name.
 */
export function getCollaboratorSingersForComposer(rawComposer: string): string[] {
  if (!rawComposer) return [];
  const norm = normalizeArtistAlias(rawComposer) || rawComposer.toLowerCase().trim();
  if (COMPOSER_COLLABORATOR_NETWORKS[norm]) {
    return [...COMPOSER_COLLABORATOR_NETWORKS[norm]!];
  }
  for (const [key, collaborators] of Object.entries(COMPOSER_COLLABORATOR_NETWORKS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return [...collaborators];
    }
  }
  return [];
}

/**
 * Given a playback singer, finds the composers they work with and returns
 * OTHER collaborator singers from those composers that the user can explore.
 */
export function getCollaboratorSingersForSinger(
  rawSinger: string,
  userFamiliarArtists: Set<string> | string[] = new Set(),
): string[] {
  if (!rawSinger) return [];
  const singerNorm = normalizeArtistAlias(rawSinger) || rawSinger.toLowerCase().trim();
  const familiarSet = userFamiliarArtists instanceof Set
    ? userFamiliarArtists
    : new Set(userFamiliarArtists.map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()));

  const candidates = new Set<string>();

  for (const [composer, collaborators] of Object.entries(COMPOSER_COLLABORATOR_NETWORKS)) {
    const worksWithComposer = collaborators.some(
      (c) => (normalizeArtistAlias(c) || c.toLowerCase().trim()) === singerNorm,
    );
    if (worksWithComposer) {
      for (const collaborator of collaborators) {
        const collabNorm = normalizeArtistAlias(collaborator) || collaborator.toLowerCase().trim();
        if (collabNorm !== singerNorm && !familiarSet.has(collabNorm)) {
          candidates.add(collaborator);
        }
      }
    }
  }

  return Array.from(candidates);
}

/**
 * Given a classic artist name, returns their modern contemporary counterparts.
 */
export function getModernEraBridges(rawArtist: string): string[] {
  if (!rawArtist) return [];
  const norm = normalizeArtistAlias(rawArtist) || rawArtist.toLowerCase().trim();
  if (ERA_VOCAL_BRIDGES[norm]) {
    return [...ERA_VOCAL_BRIDGES[norm]!];
  }
  for (const [key, modernSingers] of Object.entries(ERA_VOCAL_BRIDGES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return [...modernSingers];
    }
  }
  return [];
}

/**
 * Generates search queries to cross-pollinate songs from the same movie soundtrack album,
 * introducing different singers within the same aesthetic envelope.
 */
export function generateSoundtrackCrossPollinationQueries(
  likedTracks: readonly TrackLike[],
  limit = 4,
): string[] {
  const soundtrackCounts = new Map<string, number>();

  for (const t of likedTracks) {
    const movie = extractTrackMovieOrAlbum(t);
    if (movie && movie.length >= 2) {
      soundtrackCounts.set(movie, (soundtrackCounts.get(movie) || 0) + 1);
    }
  }

  const sortedSoundtracks = Array.from(soundtrackCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([movie]) => movie)
    .slice(0, limit);

  const queries: string[] = [];
  for (const movie of sortedSoundtracks) {
    queries.push(`${movie} movie songs`);
    queries.push(`${movie} soundtrack album`);
  }

  return queries;
}

/**
 * Checks if a candidate track is from the same soundtrack album as a liked song,
 * but features a DIFFERENT primary playback singer.
 */
export function isSoundtrackCrossPollinationMatch(
  candidate: TrackLike,
  likedTracks: readonly TrackLike[],
): boolean {
  const candMovie = extractTrackMovieOrAlbum(candidate);
  if (!candMovie) return false;

  const candArtist = extractPrimaryArtist(candidate.artist);

  for (const lt of likedTracks) {
    const ltMovie = extractTrackMovieOrAlbum(lt);
    if (ltMovie && ltMovie === candMovie) {
      const ltArtist = extractPrimaryArtist(lt.artist);
      if (!candArtist || !ltArtist || candArtist !== ltArtist) {
        return true;
      }
    }
  }
  return false;
}

/**
 * AutoDJ "Rule of 3" Anti-Clustering Guard
 *
 * Enforces two critical constraints over continuous playback queues:
 * 1. Max 2 tracks per artist in any sliding window of 6 songs.
 * 2. At least 1 in every 3 queued songs MUST be an unfamiliar / fresh voice.
 *
 * Reorders candidate tracks to preserve smooth energy flow while guaranteeing
 * genuine vocal variety and anti-clustering.
 */
export function enforceAutoDjRuleOfThree<T extends TrackLike>(
  candidates: readonly T[],
  recentQueueOrHistory: readonly T[] = [],
  familiarArtists: Set<string> | string[] = new Set(),
): T[] {
  if (candidates.length <= 1) return [...candidates];

  const familiarNormSet = familiarArtists instanceof Set
    ? new Set(Array.from(familiarArtists).map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()))
    : new Set(familiarArtists.map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()));

  // Seed recent artist history from recent queue or session history
  const recentArtistWindow: string[] = recentQueueOrHistory
    .slice(-6)
    .map((t) => extractPrimaryArtist(t.artist))
    .filter(Boolean);

  const available = [...candidates];
  const result: T[] = [];

  let consecutiveFamiliarCount = 0;

  while (available.length > 0) {
    const windowLast5 = recentArtistWindow.slice(-5);

    // Count occurrences of each artist in the active sliding window of 5 (+ 1 upcoming candidate = 6)
    const windowArtistCounts = new Map<string, number>();
    for (const art of windowLast5) {
      windowArtistCounts.set(art, (windowArtistCounts.get(art) || 0) + 1);
    }

    const needsFreshVoice = consecutiveFamiliarCount >= 2;

    // Find the first candidate that satisfies both:
    // (a) Window limit: artist appears <= 1 time in the last 5 songs (allowing at most 2 in 6)
    // (b) Rule of 3: if 2 consecutive familiar songs occurred, require a fresh / unfamiliar voice
    let bestIndex = -1;

    for (let i = 0; i < available.length; i++) {
      const cand = available[i]!;
      const candArtist = extractPrimaryArtist(cand.artist);
      const artCountInWindow = candArtist ? (windowArtistCounts.get(candArtist) || 0) : 0;

      // Check Rule A: max 2 in 6
      const violatesMax2In6 = artCountInWindow >= 2;
      if (violatesMax2In6) continue;

      // Check Rule B: 1 fresh voice in every 3
      const isCandFamiliar = candArtist ? familiarNormSet.has(candArtist) : false;
      if (needsFreshVoice && isCandFamiliar) {
        // Continue looking for an unfamiliar voice in available pool
        continue;
      }

      bestIndex = i;
      break;
    }

    // If no candidate satisfies both strict rules, relax Rule B (fresh voice) but keep Rule A (max 2 in 6)
    if (bestIndex === -1) {
      for (let i = 0; i < available.length; i++) {
        const cand = available[i]!;
        const candArtist = extractPrimaryArtist(cand.artist);
        const artCountInWindow = candArtist ? (windowArtistCounts.get(candArtist) || 0) : 0;
        if (artCountInWindow < 2) {
          bestIndex = i;
          break;
        }
      }
    }

    // Fallback: take next available candidate
    if (bestIndex === -1) {
      bestIndex = 0;
    }

    const [chosen] = available.splice(bestIndex, 1);
    if (chosen) {
      result.push(chosen);
      const chosenArtist = extractPrimaryArtist(chosen.artist);
      if (chosenArtist) {
        recentArtistWindow.push(chosenArtist);
      }
      const isChosenFamiliar = chosenArtist ? familiarNormSet.has(chosenArtist) : false;
      if (isChosenFamiliar) {
        consecutiveFamiliarCount += 1;
      } else {
        consecutiveFamiliarCount = 0;
      }
    }
  }

  return result;
}

/**
 * 6. Curated Emerging & Breakthrough Singers (Language-specific Fresh Voices)
 * Curated list of rising, indie, and breakthrough playback voices across languages.
 */
export const RISING_EMERGING_SINGERS: Record<string, string[]> = {
  Telugu: [
    "Kapil Kapilan", "Sireesha Bhagavatula", "Ram Miriyala", "Kaala Bhairava",
    "Lipsika", "Harika Narayan", "Sahithi Chaganti", "Chaitan Bharadwaj",
    "Manisha Eerabathini", "Deepak Blue", "Sri Krishna", "Mohana Bhogaraju",
    "Dhanunjay", "Aditi Bhavaraju", "Anudeep Dev", "PVNS Rohit"
  ],
  Hindi: [
    "Anuv Jain", "Prateek Kuhad", "Jasleen Royal", "Varun Jain",
    "Nikhita Gandhi", "Kavita Seth", "Antara Mitra", "Shahid Mallya",
    "Tochi Raina", "Raghav Chaitanya", "Shashwat Singh", "Zaeden",
    "Abhay Jodhpurkar", "Jonita Gandhi"
  ],
  Tamil: [
    "Pradeep Kumar", "Kapil Kapilan", "Dhee", "Sean Roldan",
    "Shashaa Tirupati", "Anthony Daasan", "Santhosh Narayanan", "Jonita Gandhi",
    "Aditi Rao Hydari", "Ravi G", "Govind Vasantha", "Sathyaprakash"
  ],
  Malayalam: [
    "Sushin Shyam", "Sooraj Santhosh", "Sithara Krishnakumar", "Anne Amie",
    "Zia Ul Haq", "Job Kurian", "Pradeep Kumar", "Haricharan"
  ],
  Kannada: [
    "Sanjith Hegde", "Charan Raj", "Anuradha Bhat", "Supriya Ram",
    "B. Ajaneesh Loknath", "Chandan Shetty", "Varijashree Venugopal"
  ],
  Punjabi: [
    "Karan Aujla", "Shubh", "AP Dhillon", "Sunanda Sharma",
    "Nimrat Khaira", "Simiran Kaur Dhadli", "Gurnam Bhullar"
  ],
  English: [
    "Stephen Sanchez", "Laufey", "Noah Kahan", "Gracie Abrams",
    "Teddy Swims", "Raye", "Benson Boone", "Lizzy McAlpine"
  ],
};

/**
 * Returns emerging/rising singers for given languages, strictly excluding familiar artists.
 */
export function getEmergingSingersForLanguages(
  languages: readonly string[] = [],
  familiarArtists: Set<string> | string[] = new Set(),
): string[] {
  const familiarSet = familiarArtists instanceof Set
    ? new Set(Array.from(familiarArtists).map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()))
    : new Set(familiarArtists.map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()));

  const targetLangs = languages.length > 0 ? languages : ["Telugu", "Hindi"];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const lang of targetLangs) {
    const list = RISING_EMERGING_SINGERS[lang] || [];
    for (const singer of list) {
      const norm = normalizeArtistAlias(singer) || singer.toLowerCase().trim();
      if (!familiarSet.has(norm) && !seen.has(norm)) {
        seen.add(norm);
        out.push(singer);
      }
    }
  }

  return out;
}

/**
 * Generates search queries for Fresh Voices feed.
 */
export function generateFreshVoicesQueries(
  languages: readonly string[] = [],
  familiarArtists: Set<string> | string[] = new Set(),
  limit = 6,
): string[] {
  const singers = getEmergingSingersForLanguages(languages, familiarArtists);
  const queries: string[] = [];
  const targetLangs = languages.length > 0 ? languages : ["Telugu", "Hindi"];

  for (const singer of singers.slice(0, limit)) {
    queries.push(`${singer} songs`);
  }

  for (const lang of targetLangs) {
    queries.push(`${lang} indie songs`);
    queries.push(`${lang} breakthrough songs`);
  }

  return queries.slice(0, limit * 2);
}

/**
 * Filters candidates for Fresh Voices:
 * - Strictly excludes tracks by user's familiar artists.
 * - Enforces zero duplicate tracks.
 */
export function filterFreshVoicesTracks<T extends TrackLike>(
  candidates: readonly T[],
  familiarArtists: Set<string> | string[] = new Set(),
): T[] {
  const familiarSet = familiarArtists instanceof Set
    ? new Set(Array.from(familiarArtists).map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()))
    : new Set(familiarArtists.map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()));

  const result: T[] = [];
  const seenIdentities = new Set<string>();

  for (const t of candidates) {
    if (!t || !t.title) continue;
    const primary = extractPrimaryArtist(t.artist);
    const norm = normalizeArtistAlias(primary || t.artist) || (t.artist || "").toLowerCase().trim();
    if (familiarSet.has(norm)) continue;

    // Check raw artist string tokens too
    let matchFamiliar = false;
    for (const fam of familiarSet) {
      if (fam.length >= 3 && norm.includes(fam)) {
        matchFamiliar = true;
        break;
      }
    }
    if (matchFamiliar) continue;

    const identity = `${(t.title || "").toLowerCase().trim()}:::${norm}`;
    if (seenIdentities.has(identity)) continue;
    seenIdentities.add(identity);

    result.push(t);
  }

  return result;
}

/**
 * 7. Serendipity Dice 🎲 Track Picker
 * Picks the best candidate track from an artist the user has NEVER played before.
 */
export function pickSurpriseTrack<T extends TrackLike>(
  candidates: readonly T[],
  allListenedArtists: Set<string> | string[] = new Set(),
): T | null {
  if (!candidates || candidates.length === 0) return null;

  const listenedSet = allListenedArtists instanceof Set
    ? new Set(Array.from(allListenedArtists).map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()))
    : new Set(allListenedArtists.map((a) => normalizeArtistAlias(a) || a.toLowerCase().trim()));

  // 1. First priority: candidate whose artist was NEVER played / heard
  for (const cand of candidates) {
    if (!cand || !cand.title) continue;
    const primary = extractPrimaryArtist(cand.artist);
    const norm = normalizeArtistAlias(primary || cand.artist) || (cand.artist || "").toLowerCase().trim();
    if (!norm) continue;

    let isListened = listenedSet.has(norm);
    if (!isListened) {
      for (const listened of listenedSet) {
        if (listened.length >= 3 && (norm.includes(listened) || listened.includes(norm))) {
          isListened = true;
          break;
        }
      }
    }

    if (!isListened) {
      return cand;
    }
  }

  // 2. Fallback: if all candidate artists have some connection, pick the first valid candidate
  return candidates[0] ?? null;
}

