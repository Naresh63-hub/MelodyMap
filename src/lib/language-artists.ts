/**
 * Well-known artists strongly associated with each supported language.
 *
 * Single shared source so BOTH the server-side recommendation query builder
 * (music.functions.ts) and the client-side language-consistency filter
 * (library.ts) agree on which artists imply which language. Previously this
 * map lived privately in music.functions.ts, so the filter could not use it
 * and romanized-language songs leaked into feeds of languages the user never
 * selected (the map is the only reliable signal for romanized titles).
 *
 * Extend new-language entries with mainstream, unambiguous artists only —
 * an artist listed here is treated as proof of that language in feeds.
 */
export const LANGUAGE_ARTISTS: Record<string, string[]> = {
  Telugu: [
    "Sid Sriram", "Anurag Kulkarni", "Ram Miriyala", "Devi Sri Prasad", "S. Thaman",
    "Anirudh Ravichander", "Shreya Ghoshal", "Armaan Malik", "Mangli", "Jaspreet Jasz",
    "SP Balasubrahmanyam", "M.M. Keeravaani", "Karthik", "Hariharan", "K.S. Chithra",
    "Haricharan", "Mano", "Geetha Madhuri", "Sunitha", "Rahul Sipligunj", "Hemachandra",
    "Pradeep Kumar", "Kapil Kapilan", "Hesham Abdul Wahab", "G.V. Prakash Kumar",
    "Chaitan Bharadwaj", "Mickey J Meyer", "Bheems Ceciroleo", "Vivek Sagar"
  ],
  Hindi: [
    "Arijit Singh", "Shreya Ghoshal", "Vishal Mishra", "Jubin Nautiyal", "B Praak",
    "Atif Aslam", "Sonu Nigam", "KK", "Mohit Chauhan", "Sunidhi Chauhan", "Neha Kakkar",
    "Pritam", "A.R. Rahman", "Sachin-Jigar", "Badshah", "Diljit Dosanjh", "Kishore Kumar",
    "Lata Mangeshkar", "Mohammed Rafi", "Kumar Sanu", "Udit Narayan", "Alka Yagnik",
    "Shaan", "Armaan Malik", "Darshan Raval", "Anuv Jain", "Prateek Kuhad", "Amit Trivedi"
  ],
  Tamil: [
    "Anirudh Ravichander", "A.R. Rahman", "Yuvan Shankar Raja", "Harris Jayaraj",
    "Sid Sriram", "Pradeep Kumar", "D. Imman", "Santhosh Narayanan", "Sean Roldan",
    "Ilaiyaraaja", "SP Balasubrahmanyam", "Karthik", "Shreya Ghoshal", "Vijay Antony",
    "G.V. Prakash Kumar", "Dhanush", "Jonita Gandhi", "K.J. Yesudas", "Haricharan"
  ],
  English: [
    "The Weeknd", "Taylor Swift", "Bruno Mars", "Ed Sheeran", "Billie Eilish",
    "Drake", "Post Malone", "Dua Lipa", "Coldplay", "Eminem", "Imagine Dragons",
    "Ariana Grande", "Justin Bieber", "Maroon 5", "Adele", "Sam Smith", "Harry Styles",
    "Lady Gaga", "OneRepublic", "Charlie Puth", "Shawn Mendes", "Sia", "Katy Perry"
  ],
  Punjabi: [
    "Diljit Dosanjh", "Karan Aujla", "AP Dhillon", "Sidhu Moose Wala", "Shubh",
    "Guru Randhawa", "Amrinder Gill", "B Praak", "Jassie Gill", "Hardy Sandhu",
    "Gurdas Maan", "Satinder Sartaaj", "Maninder Buttar"
  ],
  Malayalam: [
    "Sushin Shyam", "Hesham Abdul Wahab", "Jassie Gift", "K.J. Yesudas", "K.S. Chithra",
    "Vineeth Sreenivasan", "Shaan Rahman", "Gopi Sundar", "Haricharan", "Vijay Yesudas"
  ],
  Kannada: [
    "Vijay Prakash", "Sanjith Hegde", "Arjun Janya", "Charan Raj", "Raghu Dixit",
    "Sonu Nigam", "Shreya Ghoshal", "Armaan Malik", "B. Ajaneesh Loknath"
  ],
  Bengali: [
    "Arijit Singh", "Shreya Ghoshal", "Anupam Roy", "Rupankar Bagchi", "Iman Chakraborty",
    "Shaan", "Kumar Sanu", "Asha Bhosle", "Nachiketa Chakraborty", "Srikanto Acharya",
    "Lagnajita Mukhopadhyay", "Anweshaa"
  ],
  Marathi: [
    "Ajay-Atul", "Shankar Mahadevan", "Avadhoot Gupte", "Swapnil Bandodkar",
    "Bela Shende", "Rahul Deshpande", "Vaishali Made", "Aadarsh Shinde",
    "Anand Shinde", "Sumeet Pawar"
  ],
  Gujarati: [
    "Kinjal Dave", "Jignesh Kaviraj", "Geeta Rabari", "Kirtidan Gadhvi",
    "Osman Mir", "Aishwarya Majmudar", "Parthiv Gohil", "Hemant Chauhan"
  ],
  Bhojpuri: [
    "Pawan Singh", "Khesari Lal Yadav", "Nirahua", "Shilpi Raj", "Neelkamal Singh",
    "Ritesh Pandey", "Ankush Raja", "Shivani Singh"
  ],
  Urdu: [
    "Nusrat Fateh Ali Khan", "Rahat Fateh Ali Khan", "Atif Aslam", "Ali Zafar",
    "Coke Studio Pakistan", "Abida Parveen", "Sajjad Ali", "Shafqat Amanat Ali"
  ],
  Japanese: [
    "Yoasobi", "Kenshi Yonezu", "Aimer", "LiSA", "Official HIGE DANdism",
    "King Gnu", "Ado", "Radwimps", "Utada Hikaru", "Eve"
  ],
};

/**
 * Key composers and music directors per language.
 * Used by recommendation query generators to discover diverse songs across
 * multiple singers composed by varied music directors.
 */
export const COMPOSERS_BY_LANGUAGE: Record<string, string[]> = {
  Telugu: [
    "Devi Sri Prasad", "S. Thaman", "Anirudh Ravichander", "M.M. Keeravaani",
    "Mickey J Meyer", "Bheems Ceciroleo", "Hesham Abdul Wahab", "G.V. Prakash Kumar",
    "Vivek Sagar", "Chaitan Bharadwaj"
  ],
  Hindi: [
    "A.R. Rahman", "Pritam", "Sachin-Jigar", "Amit Trivedi", "Vishal Mishra"
  ],
  Tamil: [
    "Anirudh Ravichander", "A.R. Rahman", "Yuvan Shankar Raja", "Harris Jayaraj",
    "Santhosh Narayanan", "Ilaiyaraaja", "G.V. Prakash Kumar"
  ],
  Malayalam: [
    "Sushin Shyam", "Hesham Abdul Wahab", "Gopi Sundar", "Shaan Rahman"
  ],
  Kannada: [
    "Arjun Janya", "Charan Raj", "B. Ajaneesh Loknath"
  ],
  Marathi: [
    "Ajay-Atul"
  ],
};

/**
 * Infer the language of a track from its artist name(s) using the map above.
 *
 * Returns the language ONLY when the matched artist is unambiguous — i.e. the
 * name does not appear under multiple languages. Prolific playback singers
 * (Shreya Ghoshal, Arijit Singh, SP Balasubrahmanyam...) sing across many
 * industries, so a multi-list match yields no verdict (null) instead of a
 * wrong rejection. Case-insensitive substring match handles multi-artist
 * credit strings like "Artist A, Artist B".
 */
export function inferLanguageFromArtists(artist: string | null | undefined): string | null {
  if (!artist) return null;
  const haystack = artist.toLowerCase();
  if (!haystack.trim()) return null;

  let verdict: string | null = null;
  for (const [langName, artists] of Object.entries(LANGUAGE_ARTISTS)) {
    for (const name of artists) {
      if (haystack.includes(name.toLowerCase())) {
        if (verdict === null) {
          verdict = langName;
        } else if (verdict !== langName) {
          return null; // artist spans multiple languages — no reliable verdict
        }
      }
    }
  }
  return verdict;
}

export const ISO_LANG_MAP: Record<string, string> = {
  te: "Telugu",
  tel: "Telugu",
  hi: "Hindi",
  hin: "Hindi",
  ta: "Tamil",
  tam: "Tamil",
  en: "English",
  eng: "English",
  pa: "Punjabi",
  pan: "Punjabi",
  ml: "Malayalam",
  mal: "Malayalam",
  kn: "Kannada",
  kan: "Kannada",
  bn: "Bengali",
  ben: "Bengali",
  mr: "Marathi",
  mar: "Marathi",
  gu: "Gujarati",
  guj: "Gujarati",
  bho: "Bhojpuri",
  ur: "Urdu",
  urd: "Urdu",
  ja: "Japanese",
  jpn: "Japanese",
  ko: "Korean",
  kor: "Korean",
  es: "Spanish",
  spa: "Spanish",
  ar: "Arabic",
  ara: "Arabic",
};

const LANGUAGE_SCRIPTS: Record<string, RegExp> = {
  Telugu: /[\u0C00-\u0C7F]/,
  Tamil: /[\u0B80-\u0BFF]/,
  Malayalam: /[\u0D00-\u0D7F]/,
  Kannada: /[\u0C80-\u0CFF]/,
  Punjabi: /[\u0A00-\u0A7F]/,
  Bengali: /[\u0980-\u09FF]/,
  Korean: /[\uAC00-\uD7AF\u1100-\u11FF]/,
  Arabic: /[\u0600-\u06FF]/,
  Japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
  Devanagari: /[\u0900-\u097F]/,
};

const INDUSTRY_MAP: Record<string, string> = {
  tollywood: "Telugu",
  kollywood: "Tamil",
  bollywood: "Hindi",
  mollywood: "Malayalam",
  sandalwood: "Kannada",
  pollywood: "Punjabi",
  kpop: "Korean",
  "k-pop": "Korean",
};

export const SUPPORTED_LANGUAGES = [
  "Telugu",
  "Hindi",
  "Tamil",
  "English",
  "Malayalam",
  "Kannada",
  "Punjabi",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Bhojpuri",
  "Urdu",
  "Japanese",
  "Korean",
  "Spanish",
  "Arabic",
] as const;

/**
 * Single source of truth for determining a track's language across all signals:
 * languageCode/language field, bracketed/delimited tags, explicit title phrases,
 * regional industry keywords, Unicode scripts, and unambiguous artist association.
 */
export function getTrackLanguage(
  track?: {
    title?: string | undefined;
    artist?: string | undefined;
    album?: string | undefined;
    languageCode?: string | undefined;
    language?: string | undefined;
  } | null,
): string | undefined {
  if (!track) return undefined;

  // 1. Explicit languageCode or language field
  const rawCode = (track.languageCode || track.language || "").trim().toLowerCase();
  if (rawCode && rawCode !== "und" && rawCode !== "zxx") {
    if (ISO_LANG_MAP[rawCode]) {
      return ISO_LANG_MAP[rawCode];
    }
    const match = SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === rawCode);
    if (match) return match;
    const prefixMatch = SUPPORTED_LANGUAGES.find((l) => rawCode.startsWith(l.toLowerCase().slice(0, 3)));
    if (prefixMatch) return prefixMatch;
  }

  const rawTitle = track.title || "";
  const rawArtist = track.artist || "";
  const rawAlbum = track.album || "";
  const combined = `${rawTitle} ${rawAlbum}`;
  const text = combined.toLowerCase();

  // 2. Explicit bracket tags, delimited tags, and phrases
  for (const lang of SUPPORTED_LANGUAGES) {
    const l = lang.toLowerCase();
    const bracketPattern = new RegExp(`[\\(\\[][^\\)\\]]*\\b${l}\\b[^\\)\\]]*[\\)\\]]`, "i");
    if (bracketPattern.test(combined)) {
      return lang;
    }
    const delimiterPattern = new RegExp(`[\\|\\-\\/\u2013\u2014]\\s*${l}\\s*[\\|\\-\\/\u2013\u2014]`, "i");
    if (delimiterPattern.test(combined)) {
      return lang;
    }
    const phrasePattern = new RegExp(
      `\\b(${l}\\s+(song|songs|hits|version|dub|audio|video|jukebox|remix|mashup|lyric|lyrics|lyrical|mp3|movie|cinema)|in\\s+${l})\\b`,
      "i",
    );
    if (phrasePattern.test(combined)) {
      return lang;
    }
  }

  // 3. Known industry tags (e.g. "Tollywood", "Bollywood")
  for (const [industry, lang] of Object.entries(INDUSTRY_MAP)) {
    const indPattern = new RegExp(`\\b${industry}\\b`, "i");
    if (indPattern.test(text)) {
      return lang;
    }
  }

  // 4. Unicode scripts
  const textForScript = `${rawTitle} ${rawArtist} ${rawAlbum}`;
  for (const [lang, regex] of Object.entries(LANGUAGE_SCRIPTS)) {
    if (lang === "Devanagari") continue;
    if (regex.test(textForScript)) {
      return lang;
    }
  }
  const devanagariRegex = LANGUAGE_SCRIPTS["Devanagari"];
  if (devanagariRegex && devanagariRegex.test(textForScript)) {
    const marathiArtist = inferLanguageFromArtists(rawArtist) === "Marathi";
    const marathiKeywords = /\b(marathi|abhang|lavani|natyageet)\b/i.test(text);
    return marathiArtist || marathiKeywords ? "Marathi" : "Hindi";
  }

  // 5. Unambiguous artist-based inference
  const artistLang = inferLanguageFromArtists(rawArtist);
  if (artistLang) {
    return artistLang;
  }

  return undefined;
}

