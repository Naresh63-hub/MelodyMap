import { describe, expect, it } from "vitest";
import {
  cleanMovieName,
  cleanSongTitle,
  decodeEntities,
  extractFromClause,
  isChannelOrLabelName,
  stripLanguageAndNoiseTags,
  trackSubtitle,
} from "./track-metadata";

/**
 * Cases below are real strings captured from the JioSaavn catalog API and from
 * YouTube-derived entries the app still mixes into its feeds.
 */
describe("decodeEntities", () => {
  it("decodes the entities JioSaavn emits", () => {
    expect(decodeEntities("Yeshanagula (From &quot;The Paradise&quot;)")).toBe(
      'Yeshanagula (From "The Paradise")',
    );
    expect(decodeEntities("Vibe &amp; Paz")).toBe("Vibe & Paz");
    expect(decodeEntities("Don&#039;t Stop")).toBe("Don't Stop");
  });
});

describe("cleanSongTitle", () => {
  it("strips the (From \"Movie\") clause that JioSaavn appends", () => {
    expect(cleanSongTitle('One Name (From "Jailer 2")')).toBe("One Name");
    expect(cleanSongTitle('Tum Hi Ho (From "Aashiqui 2")')).toBe("Tum Hi Ho");
    expect(cleanSongTitle('Gehra Hua (From "Dhurandhar")')).toBe("Gehra Hua");
  });

  it("strips the language tag left behind after the movie clause", () => {
    expect(cleanSongTitle('Yeshanagula (From &quot;The Paradise&quot;) (Telugu)')).toBe("Yeshanagula");
    expect(cleanSongTitle('Aaya Sher (From "The Paradise") (Telugu)')).toBe("Aaya Sher");
    expect(cleanSongTitle("The Paradise (Telugu)")).toBe("The Paradise");
  });

  it("repairs dangling quotes from truncated catalog titles", () => {
    expect(cleanSongTitle('Tu Jahaan")')).toBe("Tu Jahaan");
    expect(cleanSongTitle('Rubaroo")')).toBe("Rubaroo");
  });

  it("drops soundtrack / single / video noise", () => {
    expect(cleanSongTitle("Ala Bolelo (Original Motion Picture Soundtrack)")).toBe("Ala Bolelo");
    expect(cleanSongTitle("Some Song - Single")).toBe("Some Song");
    expect(cleanSongTitle("Some Song | Official Video")).toBe("Some Song");
  });

  it("never returns an empty title", () => {
    expect(cleanSongTitle("(From \"Jailer 2\")")).toBeTruthy();
    expect(cleanSongTitle("")).toBe("");
  });
});

describe("extractFromClause", () => {
  it("finds the movie in square brackets and 'the movie' phrasing", () => {
    expect(extractFromClause('Song [From "Movie X"]')).toBe("Movie X");
    expect(extractFromClause("Song (From the movie Vikram)")).toBe("Vikram");
    expect(extractFromClause("Song")).toBeUndefined();
  });
});

describe("cleanMovieName", () => {
  it("recovers the movie from an album field polluted with the song title", () => {
    // Real shape: album mirrors the raw title, so the movie lives in the clause.
    expect(cleanMovieName('Yeshanagula (From "The Paradise") (Telugu)', 'Yeshanagula (From "The Paradise") (Telugu)')).toBe("The Paradise");
    expect(cleanMovieName('Ala Bolelo (From &quot;Jailer 2&quot;)', 'Ala Bolelo (From "Jailer 2")')).toBe("Jailer 2");
  });

  it("strips the language tag from a real album name", () => {
    expect(cleanMovieName("The Paradise (Telugu)", "Yeshanagula")).toBe("The Paradise");
    expect(cleanMovieName("Dhurandhar", "Gehra Hua")).toBe("Dhurandhar");
    expect(cleanMovieName("Aashiqui 2", "Tum Hi Ho")).toBe("Aashiqui 2");
  });

  it("rejects albums that are compilations, playlists or the song itself", () => {
    expect(cleanMovieName("World Music Day - Best Of Bollywood Hits", "Tum Hi Ho")).toBeUndefined();
    expect(cleanMovieName("Best Of Arijit Singh - Collection Of Romantic Songs", "Tum Hi Ho")).toBeUndefined();
    expect(cleanMovieName("Vibe & Paz, Vol. 1", "Lo-Fi Chill Beats")).toBeUndefined();
    expect(cleanMovieName("Basinga Balaalu", "Basinga Balaalu")).toBeUndefined();
    expect(cleanMovieName("Telugu", "Something")).toBeUndefined();
    expect(cleanMovieName(undefined, "Something")).toBeUndefined();
  });
});

describe("isChannelOrLabelName", () => {
  it("flags channels and labels seen in the app's own feed", () => {
    expect(isChannelOrLabelName("Aditya Music PLAYBACK")).toBe(true);
    expect(isChannelOrLabelName("SriBalajiMovies")).toBe(true);
    expect(isChannelOrLabelName("Music Club Official")).toBe(true);
    expect(isChannelOrLabelName("AdityaMusic")).toBe(true);
    expect(isChannelOrLabelName("SomeArtistVEVO")).toBe(true);
    expect(isChannelOrLabelName("Sony Music India - Topic")).toBe(true);
    // Curated uploader handles observed leaking into the live Explore feed.
    expect(isChannelOrLabelName("MoodExTunes, MoodoraTunes")).toBe(true);
    expect(isChannelOrLabelName("Trending Topic")).toBe(true);
    expect(isChannelOrLabelName("Retro Rewind (Trending Again)")).toBe(true);
  });

  it("does not flag real artist names", () => {
    expect(isChannelOrLabelName("Arijit Singh")).toBe(false);
    expect(isChannelOrLabelName("Anirudh Ravichander, Srinivasa Mouli")).toBe(false);
    expect(isChannelOrLabelName("A.R. Rahman")).toBe(false);
    expect(isChannelOrLabelName("")).toBe(false);
  });
});

describe("trackSubtitle", () => {
  it("prefers the movie name over the artist", () => {
    expect(
      trackSubtitle({
        title: 'Yeshanagula (From "The Paradise") (Telugu)',
        album: 'Yeshanagula (From "The Paradise") (Telugu)',
        artist: "Anirudh Ravichander, Singer Prabha",
      }),
    ).toBe("The Paradise");
  });

  it("falls back to the artist when there is no movie", () => {
    expect(trackSubtitle({ title: "Lo-Fi Chill Beats", album: "Vibe & Paz, Vol. 1", artist: "Brabo Beatz" })).toBe("Brabo Beatz");
  });

  it("never shows a channel name", () => {
    expect(trackSubtitle({ title: "Priyatama Song", artist: "Aditya Music PLAYBACK" })).toBe("");
    expect(trackSubtitle({ title: "Velli Nilave Song", artist: "SriBalajiMovies" })).toBe("");
  });
});

describe("stripLanguageAndNoiseTags", () => {
  it("strips trailing tags repeatedly", () => {
    expect(stripLanguageAndNoiseTags('Song (From "X") (Telugu) (Single)')).toBe('Song (From "X")');
    expect(stripLanguageAndNoiseTags("Song (Deluxe Edition)")).toBe("Song");
  });
});
