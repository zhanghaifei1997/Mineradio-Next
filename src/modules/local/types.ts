export interface LocalSong {
  id: string
  filePath: string
  fileName: string
  title: string
  artist: string
  album: string
  duration: number
  year?: string
  track?: number
  genre?: string
  coverUrl?: string
  fileSize: number
  addedAt: number
}

export interface ScanProgress {
  current: number
  total: number
  currentFile: string
}

export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'error'

export interface LibraryStats {
  totalSongs: number
  totalArtists: number
  totalAlbums: number
  totalDuration: number
  totalFileSize: number
}
