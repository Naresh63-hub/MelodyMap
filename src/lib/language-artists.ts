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
