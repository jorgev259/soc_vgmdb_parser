export interface DiscResponse {
  number: number;
  tracks: string[];
}

export interface VGMDBResponse {
  title?: string | null;
  subTitle?: string | null;
  releaseDate?: string | null;
  trackList?: DiscResponse[];
  artists?: String[];
  categories?: String[];
  classifications?: String[];
  coverUrl?: string;
}
