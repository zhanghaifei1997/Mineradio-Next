import type {
  Song,
  SearchResult,
  LyricData,
  Playlist,
  UserProfile,
  QualityLevel,
  Artist,
  Album,
  TopListItem,
  TopListDetail,
  SearchSuggestResult,
  HotSearchResult,
  FMSong,
  DailyRecommend,
  ArtistDetail,
  AlbumDetail,
  CommentList,
  MV,
  SongDetail,
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

  abstract getArtistDetail(id: string): Promise<ArtistDetail | null>
  abstract getArtistSongs(id: string, page?: number, limit?: number): Promise<{ songs: Song[]; total: number; more: boolean }>
  abstract getArtistAlbums(id: string, page?: number, limit?: number): Promise<{ albums: Album[]; total: number; more: boolean }>
  abstract getArtistMVs(id: string, page?: number, limit?: number): Promise<{ mvs: MV[]; total: number; more: boolean }>
  abstract getSimilarArtists(id: string): Promise<Artist[]>
  abstract followArtist(id: string, follow: boolean): Promise<boolean>

  abstract getAlbum(id: string): Promise<AlbumDetail | null>
  abstract getAlbumSongs(id: string): Promise<Song[]>
  abstract subscribeAlbum(id: string, subscribe: boolean): Promise<boolean>

  abstract getSongComments(id: string, page?: number, limit?: number, type?: 'hot' | 'new'): Promise<CommentList | null>
  abstract likeComment(id: string, cid: string, like: boolean): Promise<boolean>
  abstract sendComment(id: string, content: string): Promise<boolean>

  abstract getSongFullDetail(id: string): Promise<SongDetail | null>

  abstract likeSong(id: string, like: boolean): Promise<boolean>
  abstract isSongLiked(id: string): Promise<boolean>
  abstract getLikedSongs(): Promise<Song[]>

  abstract getTopList(): Promise<TopListItem[]>
  abstract getTopListDetail(id: string): Promise<TopListDetail | null>

  abstract getSearchSuggest(keyword: string): Promise<SearchSuggestResult>
  abstract getHotSearch(): Promise<HotSearchResult>

  abstract getPersonalFM(): Promise<FMSong[]>
  abstract likeFMSong(id: string, like: boolean): Promise<boolean>

  abstract getDailyRecommend(): Promise<DailyRecommend | null>

  abstract createPlaylist(name: string, privacy?: 'public' | 'private'): Promise<Playlist | null>
  abstract updatePlaylist(id: string, data: { name?: string; description?: string; coverUrl?: string; privacy?: 'public' | 'private' }): Promise<boolean>
  abstract deletePlaylist(id: string): Promise<boolean>
  abstract subscribePlaylist(id: string): Promise<boolean>
  abstract unsubscribePlaylist(id: string): Promise<boolean>
  abstract addToPlaylist(playlistId: string, songIds: string[]): Promise<boolean>
  abstract removeFromPlaylist(playlistId: string, songIds: string[]): Promise<boolean>

  async getSongUrls(ids: string[], quality?: QualityLevel): Promise<Map<string, SongUrlResult | null>> {
    const results = new Map<string, SongUrlResult | null>()
    for (const id of ids) {
      results.set(id, await this.getSongUrl(id, quality))
    }
    return results
  }
}
