/**
 * Verified Top Regional Podcast Creators Catalog
 * Curated list of the most popular, high-profile podcast shows in Telugu, Hindi, Tamil, Kannada, and English.
 */

export interface CuratedPodcaster {
  id: string; // iTunes Collection ID
  name: string;
  creator: string;
  tagline: string;
  badge?: string;
  language: string;
  topics: string[];
  searchQuery: string;
  isFeatured: boolean;
}

export const TOP_REGIONAL_CREATORS: Record<string, CuratedPodcaster[]> = {
  Telugu: [
    {
      id: "1666577596",
      name: "Raw Talks with VK",
      creator: "Vamshi Kurapati",
      tagline: "#1 Telugu Business & Deep-Dive Podcast",
      badge: "👑 #1 Telugu",
      language: "Telugu",
      topics: ["Business & Finance", "Tech & Science", "Motivation", "Culture & Society"],
      searchQuery: "raw talks vamshi",
      isFeatured: true,
    },
    {
      id: "1520461878",
      name: "Mouli Talks",
      creator: "Mouli Tanuj Prashanth",
      tagline: "Candid Conversations, Comedy & Youth Life",
      badge: "🔥 Trending",
      language: "Telugu",
      topics: ["Comedy", "Stories & Drama", "Culture & Society"],
      searchQuery: "mouli talks telugu",
      isFeatured: true,
    },
    {
      id: "1556849891",
      name: "Chai Bisket Original Podcast",
      creator: "Chai Bisket / Daaba Kathalu",
      tagline: "Cinema, Nostalgia & Pop-Culture Stories",
      badge: "🎬 Cinema",
      language: "Telugu",
      topics: ["Stories & Drama", "Comedy", "Culture & Society"],
      searchQuery: "chai bisket podcast",
      isFeatured: true,
    },
    {
      id: "1530971814",
      name: "Mee Software Kurradu (MSK)",
      creator: "Pani Tej",
      tagline: "Tech, Careers & IT Industry Realities",
      badge: "💻 Tech & IT",
      language: "Telugu",
      topics: ["Tech & Science", "Business & Finance"],
      searchQuery: "MSK mee software kurradu",
      isFeatured: true,
    },
    {
      id: "1539555250",
      name: "Manchi Coffee Laanti Kadhalu",
      creator: "Rajesh Ladi",
      tagline: "Heartwarming Everyday Telugu Audio Stories",
      badge: "☕ Stories",
      language: "Telugu",
      topics: ["Stories & Drama", "Culture & Society"],
      searchQuery: "manchi coffee laanti kadhalu",
      isFeatured: false,
    },
  ],

  Hindi: [
    {
      id: "1542452346",
      name: "The Ranveer Show हिंदी",
      creator: "BeerBiceps (Ranveer Allahbadia)",
      tagline: "#1 Hindi Podcast: Mindset, History & Heroes",
      badge: "👑 #1 Hindi",
      language: "Hindi",
      topics: ["Motivation", "Culture & Society", "Tech & Science", "Health & Wellness"],
      searchQuery: "the ranveer show hindi",
      isFeatured: true,
    },
    {
      id: "1825095617",
      name: "Figuring Out with Raj Shamani",
      creator: "Raj Shamani",
      tagline: "India's Leading Business & Startup Deep Dives",
      badge: "💼 Business",
      language: "Hindi",
      topics: ["Business & Finance", "Motivation", "Tech & Science"],
      searchQuery: "raj shamani figuring out",
      isFeatured: true,
    },
    {
      id: "1538251790",
      name: "Dostcast",
      creator: "Vinamre Kasanaa",
      tagline: "Uncensored, Long-Form Culture & Society Talks",
      badge: "🎙️ Candid",
      language: "Hindi",
      topics: ["Culture & Society", "Comedy", "News & Politics"],
      searchQuery: "dostcast",
      isFeatured: true,
    },
    {
      id: "1518305061",
      name: "The Desi Crime Podcast",
      creator: "Aryaan & Aishwarya",
      tagline: "Gripping Indian & South Asian True Crime",
      badge: "🔍 Crime",
      language: "Hindi",
      topics: ["Stories & Drama", "Culture & Society"],
      searchQuery: "the desi crime podcast",
      isFeatured: true,
    },
    {
      id: "1501085355",
      name: "Prakhar Ke Pravachan",
      creator: "Prakhar Gupta",
      tagline: "Psychology, Critical Thinking & Modern Philosophy",
      badge: "🧠 Philosophy",
      language: "Hindi",
      topics: ["Culture & Society", "Motivation", "News & Politics"],
      searchQuery: "prakhar ke pravachan",
      isFeatured: false,
    },
  ],

  Tamil: [
    {
      id: "1525216883",
      name: "Idhayathin Kural",
      creator: "Naveen Vigneshwar",
      tagline: "Feel-Good Motivation & Meaningful Life Reflections",
      badge: "👑 Top Tamil",
      language: "Tamil",
      topics: ["Motivation", "Health & Wellness", "Culture & Society"],
      searchQuery: "idhayathin kural",
      isFeatured: true,
    },
    {
      id: "1537355483",
      name: "Kadhai Kelu Kadhai Kelu",
      creator: "Arunmozhi Mohanraj",
      tagline: "Captivating Audio Stories & Narratives",
      badge: "📖 Stories",
      language: "Tamil",
      topics: ["Stories & Drama", "Culture & Society"],
      searchQuery: "kadhai kelu",
      isFeatured: true,
    },
    {
      id: "1574760784",
      name: "The Pokkisham - Tamil",
      creator: "The Pokkisham",
      tagline: "History, Mystery, Science & Tamil Insights",
      badge: "🔬 Science",
      language: "Tamil",
      topics: ["Tech & Science", "Culture & Society"],
      searchQuery: "tamil pokkisham",
      isFeatured: true,
    },
  ],

  Kannada: [
    {
      id: "1447075003",
      name: "Thale-Harate Kannada Podcast",
      creator: "IVM Podcasts",
      tagline: "Karnataka History, Tech, Public Policy & Society",
      badge: "👑 Top Kannada",
      language: "Kannada",
      topics: ["News & Politics", "Culture & Society", "Tech & Science"],
      searchQuery: "thale harate",
      isFeatured: true,
    },
  ],

  English: [
    {
      id: "1490896085",
      name: "The Ranveer Show (English)",
      creator: "BeerBiceps (Ranveer Allahbadia)",
      tagline: "World-Class Intellectual & Leadership Conversations",
      badge: "🌟 Featured",
      language: "English",
      topics: ["Motivation", "Tech & Science", "Health & Wellness", "Business & Finance"],
      searchQuery: "ranveer show beerbiceps",
      isFeatured: true,
    },
    {
      id: "1532901566",
      name: "Finshots Daily",
      creator: "Finshots",
      tagline: "5-Minute Financial Insights & Current Affairs",
      badge: "📈 Finance",
      language: "English",
      topics: ["Business & Finance", "News & Politics"],
      searchQuery: "finshots daily",
      isFeatured: true,
    },
  ],
};

/**
 * Returns curated podcasters for a given language, optionally filtered by topic.
 */
export function getCuratedPodcasters(
  language?: string,
  topic?: string,
): CuratedPodcaster[] {
  const norm = (language || "").trim().toLowerCase();
  let key = "Telugu";

  for (const langKey of Object.keys(TOP_REGIONAL_CREATORS)) {
    if (langKey.toLowerCase() === norm) {
      key = langKey;
      break;
    }
  }

  const list = TOP_REGIONAL_CREATORS[key] || [];
  if (!topic || topic === "All") {
    return list;
  }

  // Filter or sort so topic matches come first
  const topicNorm = topic.toLowerCase();
  const matched = list.filter((p) => p.topics.some((t) => t.toLowerCase() === topicNorm));
  return matched.length > 0 ? matched : list;
}

/**
 * Returns seed queries for fetching curated top creators when browsing.
 */
export function getCuratedSeedQueries(
  language?: string,
  topic?: string,
): string[] {
  const creators = getCuratedPodcasters(language, topic);
  return creators.slice(0, 4).map((c) => c.searchQuery);
}
