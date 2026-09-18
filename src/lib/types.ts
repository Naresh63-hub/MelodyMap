export interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  previewUrl?: string | undefined;
  source?: "youtube" | "deezer" | undefined;
  reason?: string | undefined;
  album?: string | undefined;
  year?: string | undefined;
}

