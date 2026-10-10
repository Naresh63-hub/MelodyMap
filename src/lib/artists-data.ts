/**
 * Curated JioSaavn Official Top Artists
 * All images are verified 500x500 official JioSaavn CDN portraits.
 */

export interface JioSaavnArtist {
  id: string;
  name: string;
  image: string;
  role: string;
  languages: string[];
}

export const TOP_JIOSAAVN_ARTISTS: JioSaavnArtist[] = [
  // --- TELUGU ---
  {
    id: "anirudh",
    name: "Anirudh Ravichander",
    image: "https://c.saavncdn.com/artists/Anirudh_Ravichander_003_20260121134149_500x500.jpg",
    role: "Music Director",
    languages: ["Telugu", "Tamil", "Hindi"],
  },
  {
    id: "thaman-s",
    name: "Thaman S",
    image: "https://c.saavncdn.com/artists/Thaman_S__007_20231106094011_500x500.jpg",
    role: "Music Director",
    languages: ["Telugu", "Tamil"],
  },
  {
    id: "dsp",
    name: "Devi Sri Prasad",
    image: "https://c.saavncdn.com/artists/Devi_Sri_Prasad_008_20250619062824_500x500.jpg",
    role: "Rockstar DSP",
    languages: ["Telugu", "Tamil", "Hindi"],
  },
  {
    id: "sid-sriram",
    name: "Sid Sriram",
    image: "https://c.saavncdn.com/artists/Sid_Sriram_005_20240425180600_500x500.jpg",
    role: "Singer",
    languages: ["Telugu", "Tamil", "Malayalam"],
  },
  {
    id: "spb",
    name: "S. P. Balasubrahmanyam",
    image: "https://c.saavncdn.com/artists/S_P_Balasubrahmanyam_500x500.jpg",
    role: "Legendary Singer",
    languages: ["Telugu", "Tamil", "Hindi"],
  },
  {
    id: "ar-rahman",
    name: "A.R. Rahman",
    image: "https://c.saavncdn.com/artists/AR_Rahman_002_20210120084455_500x500.jpg",
    role: "Oscar Maestro",
    languages: ["Tamil", "Hindi", "Telugu", "English"],
  },
  {
    id: "anurag-kulkarni",
    name: "Anurag Kulkarni",
    image: "https://c.saavncdn.com/artists/Anurag_Kulkarni_004_20251029091123_500x500.jpg",
    role: "Singer",
    languages: ["Telugu"],
  },
  {
    id: "ram-miriyala",
    name: "Ram Miriyala",
    image: "https://c.saavncdn.com/artists/Ram_Miriyala_001_20250911063558_500x500.jpg",
    role: "Singer & Composer",
    languages: ["Telugu"],
  },
  {
    id: "ks-chithra",
    name: "K. S. Chithra",
    image: "https://c.saavncdn.com/artists/K_S_Chithra_002_20190906071921_500x500.jpg",
    role: "Legendary Singer",
    languages: ["Telugu", "Tamil", "Malayalam"],
  },

  // --- HINDI / BOLLYWOOD ---
  {
    id: "arijit-singh",
    name: "Arijit Singh",
    image: "https://c.saavncdn.com/artists/Arijit_Singh_004_20241118063717_500x500.jpg",
    role: "Singer",
    languages: ["Hindi", "Bengali", "Telugu"],
  },
  {
    id: "shreya-ghoshal",
    name: "Shreya Ghoshal",
    image: "https://c.saavncdn.com/artists/Shreya_Ghoshal_007_20241101074144_500x500.jpg",
    role: "Melody Queen",
    languages: ["Hindi", "Telugu", "Tamil", "Bengali"],
  },
  {
    id: "pritam",
    name: "Pritam",
    image: "https://c.saavncdn.com/artists/Pritam_Chakraborty-20170711073326_500x500.jpg",
    role: "Music Director",
    languages: ["Hindi", "Bengali"],
  },
  {
    id: "sonu-nigam",
    name: "Sonu Nigam",
    image: "https://c.saavncdn.com/artists/Sonu_Nigam_003_20260813182013_500x500.jpg",
    role: "Legendary Singer",
    languages: ["Hindi", "Kannada", "Telugu"],
  },
  {
    id: "kishore-kumar",
    name: "Kishore Kumar",
    image: "https://c.saavncdn.com/artists/Kishore_Kumar_500x500.jpg",
    role: "Evergreen Legend",
    languages: ["Hindi", "Bengali"],
  },
  {
    id: "alka-yagnik",
    name: "Alka Yagnik",
    image: "https://c.saavncdn.com/artists/Alka_Yagnik_002_20220314192930_500x500.jpg",
    role: "Golden Voice",
    languages: ["Hindi"],
  },
  {
    id: "neha-kakkar",
    name: "Neha Kakkar",
    image: "https://c.saavncdn.com/artists/Neha_Kakkar_007_20241212115832_500x500.jpg",
    role: "Pop Artist",
    languages: ["Hindi", "Punjabi"],
  },
  {
    id: "badshah",
    name: "Badshah",
    image: "https://c.saavncdn.com/artists/Badshah_006_20241118064015_500x500.jpg",
    role: "Hip-Hop & Pop",
    languages: ["Hindi", "Punjabi"],
  },

  // --- TAMIL ---
  {
    id: "yuvan-shankar-raja",
    name: "Yuvan Shankar Raja",
    image: "https://c.saavncdn.com/artists/Yuvan_Shankar_Raja_002_20180802174245_500x500.jpg",
    role: "U1 Drug",
    languages: ["Tamil", "Telugu"],
  },
  {
    id: "harris-jayaraj",
    name: "Harris Jayaraj",
    image: "https://c.saavncdn.com/artists/Harris_Jayaraj_002_20230718071330_500x500.jpg",
    role: "Music Director",
    languages: ["Tamil", "Telugu"],
  },

  // --- PUNJABI ---
  {
    id: "diljit-dosanjh",
    name: "Diljit Dosanjh",
    image: "https://c.saavncdn.com/artists/Diljit_Dosanjh_005_20231025073054_500x500.jpg",
    role: "Global Punjabi Star",
    languages: ["Punjabi", "Hindi"],
  },
  {
    id: "karan-aujla",
    name: "Karan Aujla",
    image: "https://c.saavncdn.com/artists/Karan_Aujla_005_20260925061936_500x500.jpg",
    role: "Punjabi Icon",
    languages: ["Punjabi"],
  },
  {
    id: "ap-dhillon",
    name: "AP Dhillon",
    image: "https://c.saavncdn.com/artists/AP_Dhillon_004_20251023102150_500x500.jpg",
    role: "Brown Munde",
    languages: ["Punjabi"],
  },
  {
    id: "sidhu-moose-wala",
    name: "Sidhu Moose Wala",
    image: "https://c.saavncdn.com/artists/Sidhu_Moose_Wala_004_20250617183705_500x500.jpg",
    role: "Punjabi Legend",
    languages: ["Punjabi"],
  },

  // --- GLOBAL / ENGLISH ---
  {
    id: "the-weeknd",
    name: "The Weeknd",
    image: "https://c.saavncdn.com/artists/The_Weeknd_002_20241003071400_500x500.jpg",
    role: "Global Superstar",
    languages: ["English"],
  },
  {
    id: "taylor-swift",
    name: "Taylor Swift",
    image: "https://c.saavncdn.com/artists/Taylor_Swift_003_20200226074119_500x500.jpg",
    role: "Global Superstar",
    languages: ["English"],
  },
  {
    id: "ed-sheeran",
    name: "Ed Sheeran",
    image: "https://c.saavncdn.com/artists/Ed_Sheeran_002_20250625073038_500x500.jpg",
    role: "Singer-Songwriter",
    languages: ["English"],
  },
  {
    id: "justin-bieber",
    name: "Justin Bieber",
    image: "https://c.saavncdn.com/artists/Justin_Bieber_005_20201127112218_500x500.jpg",
    role: "Pop Star",
    languages: ["English"],
  },
];

/**
 * Filters and prioritizes artists according to the user's selected languages.
 * If user hasn't selected languages or selections are empty, returns the top most popular artists across India.
 */
export function getTopArtistsForLanguages(userLanguages: string[] = []): JioSaavnArtist[] {
  if (!userLanguages || userLanguages.length === 0) {
    return TOP_JIOSAAVN_ARTISTS.slice(0, 16);
  }

  const normalized = userLanguages.map((l) => l.toLowerCase());

  // Score each artist:
  // 2 points if their primary (first) language matches
  // 1 point if any other language matches
  // 0 points if non-matching
  const scored = TOP_JIOSAAVN_ARTISTS.map((artist) => {
    let score = 0;
    const firstLang = artist.languages[0];
    if (firstLang && normalized.includes(firstLang.toLowerCase())) {
      score = 2;
    } else if (artist.languages.some((l) => normalized.includes(l.toLowerCase()))) {
      score = 1;
    }
    return { artist, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.artist).slice(0, 16);
}
