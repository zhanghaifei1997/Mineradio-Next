import type {
  Song,
  SearchResult,
  LyricData,
  Playlist,
  UserProfile,
  QualityLevel,
  Artist,
  Album,
} from '@/types'

export interface SearchOptions {
  type?: 'song' | 'album' | 'artist' | 'playlist'
  limit?: number
  offset?: number
}

export interface SongUrlResult {
  url: string
  quality: QualityLevel
  size?: number
  md5?: string
}

export interface LoginResult {
  success: boolean
  profile?: UserProfile
  cookie?: string
  message?: string
}

export abstract class MusicProvider {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly color: string

  abstract isLoggedIn(): Promise<boolean>
  abstract getCurrentUser(): Promise<UserProfile | null>
  abstract login(): Promise<LoginResult>
  abstract logout(): Promise<void>

  abstract search(keyword: string, options?: SearchOptions): Promise<SearchResult>
  abstract getSongDetail(id: string): Promise<Song | null>
  abstract getSongUrl(id: string, quality?: QualityLevel): Promise<SongUrlResult | null>
  abstract getLyric(id: string): Promise<LyricData | null>

  abstract getPlaylist(id: string): Promise<Playlist | null>
  abstract getUserPlaylists(uid?: string): Promise<Playlist[]>
  abstract getRecommendSongs(): Promise<Song[]>
  abstract getRecommendResources(): Promise<Playlist[]>

  abstract getArtistDetail(id: string): Promise<Artist | null>
  abstract getArtistSongs(id: string): Promise<Song[]>
  abstract getAlbum(id: string): Promise<Album | null>

  abstract likeSong(id: string, like: boolean): Promise<boolean>
  abstract isSongLiked(id: string): Promise<boolean>
  abstract getLikedSongs(): Promise<Song[]>

  async getSongUrls(ids: string[], quality?: QualityLevel): Promise<Map<string, SongUrlResult | null>> {
    const results = new Map<string, SongUrlResult | null>()
    for (const id of ids) {
      results.set(id, await this.getSongUrl(id, quality))
    }
    return results
  }
}
