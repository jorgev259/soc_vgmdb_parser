export interface Disc {
  number: number
  body: string
}

export interface Album {
  title: string | null
  subTitle: string | null
  releaseDate: string | null
  tracklist: Disc[]
  artists: String[]
  categories: String[]
  classifications: String[]
  coverUrl?: string
}
