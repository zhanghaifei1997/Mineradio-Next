import { MusicProvider, type SearchOptions, type SongUrlResult, type LoginResult } from './MusicProvider'
import type {
  Song,
  SearchResult,
  LyricData,
  Playlist,
  UserProfile,
  QualityLevel,
  Artist,
  Album,
  LyricLine,
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

const API_BASE = '/api/kugou'

export class KugouProvider extends MusicProvider {
  readonly id = 'kugou'
  readonly name = '酷狗音乐'
  readonly color = '#2CA2F9'

  private async request<T>(path: string, params?: Record<string, any>): Promise<T> {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await fetch(`${API_BASE}${path}${query}`)
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`)
    return res.json()
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      const data = await this.request<any>('/login/status')
      return !!data?.loggedIn
    } catch {
      return false
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const data = await this.request<any>('/login/status')
      if (!data?.userId) return null
      return {
        id: String(data.userId),
        nickname: data.nickname || '酷狗用户',
        avatarUrl: data.avatarUrl,
      }
    } catch {
      return null
    }
  }

  async login(): Promise<LoginResult> {
    return { success: false, message: '请使用桌面端登录窗口' }
  }

  async logout(): Promise<void> {
    await this.request('/logout')
  }

  async search(keyword: string, options: SearchOptions = {}): Promise<SearchResult> {
    const { limit = 30, offset = 0 } = options
    const data = await this.request<any>('/search', {
      keyword,
      limit,
      offset,
    })
    return {
      songs: (data?.songs || []).map((s: any) => this.mapSong(s)),
      total: data?.total || 0,
      more: data?.hasMore ?? false,
    }
  }

  async getSongDetail(id: string): Promise<Song | null> {
    const data = await this.request<any>('/song/detail', { hash: id })
    const song = data?.song || data
    return song ? this.mapSong(song) : null
  }

  async getSongUrl(id: string, quality: QualityLevel = 'exhigh'): Promise<SongUrlResult | null> {
    const data = await this.request<any>('/song/url', {
      hash: id,
      level: this.mapQuality(quality),
    })
    if (!data?.url) return null
    return {
      url: data.url,
      quality,
      size: data.size,
    }
  }

  async getLyric(id: string): Promise<LyricData | null> {
    const data = await this.request<any>('/lyric', { hash: id })
    const lrc = data?.lyric
    if (!lrc) return null
    return {
      lines: this.parseLyric(lrc),
      hasTranslation: !!data?.trans,
      offset: 0,
    }
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    const data = await this.request<any>('/playlist/detail', { id })
    const p = data?.playlist || data
    if (!p) return null
    return {
      id: String(p.id || p.specialid),
      name: p.name || p.specialname,
      coverUrl: p.imgurl || p.coverImgUrl,
      description: p.intro || p.description,
      tracks: (p.songs || p.tracks || []).map((s: any) => this.mapSong(s)),
      trackCount: p.songcount || p.trackCount || 0,
      playCount: p.playcount || p.playCount,
      source: this.id,
    }
  }

  async getUserPlaylists(_uid?: string): Promise<Playlist[]> {
    try {
      const data = await this.request<any>('/user/playlist')
      const playlists = data?.playlists || []
      return playlists.map((p: any) => ({
        id: String(p.id || p.specialid),
        name: p.name || p.specialname,
        coverUrl: p.imgurl || p.coverImgUrl,
        description: p.intro,
        tracks: [],
        trackCount: p.songcount || 0,
        playCount: p.playcount,
        source: this.id,
      }))
    } catch {
      return []
    }
  }

  async getRecommendSongs(): Promise<Song[]> {
    return []
  }

  async getRecommendResources(): Promise<Playlist[]> {
    try {
      const data = await this.request<any>('/recommend/playlist')
      const playlists = data?.playlists || []
      return playlists.map((p: any) => ({
        id: String(p.id || p.specialid),
        name: p.name || p.specialname,
        coverUrl: p.imgurl || p.coverImgUrl,
        tracks: [],
        trackCount: p.songcount || 0,
        source: this.id,
      }))
    } catch {
      return []
    }
  }

  async getArtistDetail(id: string): Promise<ArtistDetail | null> {
    try {
      const data = await this.request<any>('/artist/detail', { id })
      const a = data?.artist || data
      if (!a) return null
      return {
        id: String(a.id),
        name: a.name,
        avatar: a.avatar || a.imgurl,
        briefDesc: a.briefDesc,
        description: a.description,
        fansCount: a.fansCount,
        songCount: a.songCount,
        albumCount: a.albumCount,
        mvCount: a.mvCount,
        followed: a.followed,
        followedCount: a.followCount,
      }
    } catch {
      return null
    }
  }

  async getArtistSongs(id: string, page: number = 1, limit: number = 50): Promise<{ songs: Song[]; total: number; more: boolean }> {
    try {
      const offset = (page - 1) * limit
      const data = await this.request<any>('/artist/songs', { id, limit, offset })
      const songs = (data?.songs || []).map((s: any) => this.mapSong(s))
      return {
        songs,
        total: data?.total || songs.length,
        more: data?.more ?? false,
      }
    } catch {
      return { songs: [], total: 0, more: false }
    }
  }

  async getArtistAlbums(id: string, page: number = 1, limit: number = 30): Promise<{ albums: Album[]; total: number; more: boolean }> {
    try {
      const offset = (page - 1) * limit
      const data = await this.request<any>('/artist/album', { id, limit, offset })
      const albums = (data?.albums || data?.list || []).map((a: any) => ({
        id: String(a.id || a.albumid),
        name: a.name || a.albumname,
        coverUrl: a.imgurl || a.coverImgUrl,
      }))
      return {
        albums,
        total: data?.total || albums.length,
        more: data?.more ?? false,
      }
    } catch {
      return { albums: [], total: 0, more: false }
    }
  }

  async getArtistMVs(_id: string, _page: number = 1, _limit: number = 30): Promise<{ mvs: MV[]; total: number; more: boolean }> {
    return { mvs: [], total: 0, more: false }
  }

  async getSimilarArtists(_id: string): Promise<Artist[]> {
    return []
  }

  async followArtist(_id: string, _follow: boolean): Promise<boolean> {
    return false
  }

  async getAlbum(id: string): Promise<AlbumDetail | null> {
    try {
      const data = await this.request<any>('/album', { id })
      const a = data?.album || data
      if (!a) return null
      const tracks = (data?.songs || a.tracks || []).map((s: any) => this.mapSong(s))
      return {
        id: String(a.id || a.albumid),
        name: a.name || a.albumname,
        coverUrl: a.imgurl || a.coverImgUrl,
        artists: (a.artists || a.singer || []).map((art: any) => ({
          id: String(art.id || art.singerid),
          name: art.name || art.singername,
          avatar: art.imgurl || art.avatar,
        })),
        publishTime: a.publishTime || a.publishtime,
        genre: a.genre || a.type,
        description: a.description || a.info,
        songCount: a.trackCount || tracks.length,
        playCount: a.playCount,
        subscribed: a.subscribed,
        subCount: a.subCount,
        tracks,
      }
    } catch {
      return null
    }
  }

  async getAlbumSongs(id: string): Promise<Song[]> {
    try {
      const data = await this.request<any>('/album', { id })
      return (data?.songs || data?.album?.tracks || []).map((s: any) => this.mapSong(s))
    } catch {
      return []
    }
  }

  async subscribeAlbum(_id: string, _subscribe: boolean): Promise<boolean> {
    return false
  }

  async getSongComments(_id: string, _page?: number, _limit?: number, _type?: 'hot' | 'new'): Promise<CommentList | null> {
    return null
  }

  async likeComment(_id: string, _cid: string, _like: boolean): Promise<boolean> {
    return false
  }

  async sendComment(_id: string, _content: string): Promise<boolean> {
    return false
  }

  async getSongFullDetail(id: string): Promise<SongDetail | null> {
    try {
      const song = await this.getSongDetail(id)
      return song as SongDetail
    } catch {
      return null
    }
  }

  async likeSong(_id: string, _like: boolean): Promise<boolean> {
    return false
  }

  async isSongLiked(_id: string): Promise<boolean> {
    return false
  }

  async getLikedSongs(): Promise<Song[]> {
    return []
  }

  async getTopList(): Promise<TopListItem[]> {
    return []
  }

  async getTopListDetail(_id: string): Promise<TopListDetail | null> {
    return null
  }

  async getSearchSuggest(_keyword: string): Promise<SearchSuggestResult> {
    return { songs: [], artists: [], albums: [], playlists: [] }
  }

  async getHotSearch(): Promise<HotSearchResult> {
    return { hots: [], time: Date.now() }
  }

  async getPersonalFM(): Promise<FMSong[]> {
    return []
  }

  async likeFMSong(_id: string, _like: boolean): Promise<boolean> {
    return false
  }

  async getDailyRecommend(): Promise<DailyRecommend | null> {
    return null
  }

  async createPlaylist(_name: string, _privacy?: 'public' | 'private'): Promise<Playlist | null> {
    return null
  }

  async updatePlaylist(_id: string, _data: { name?: string; description?: string; coverUrl?: string; privacy?: 'public' | 'private' }): Promise<boolean> {
    return false
  }

  async deletePlaylist(_id: string): Promise<boolean> {
    return false
  }

  async subscribePlaylist(_id: string): Promise<boolean> {
    return false
  }

  async unsubscribePlaylist(_id: string): Promise<boolean> {
    return false
  }

  async addToPlaylist(_playlistId: string, _songIds: string[]): Promise<boolean> {
    return false
  }

  async removeFromPlaylist(_playlistId: string, _songIds: string[]): Promise<boolean> {
    return false
  }

  private mapSong(raw: any): Song {
    return {
      id: raw.hash || raw.FileHash || String(raw.id || ''),
      name: raw.songname || raw.name || raw.SongName || '',
      artists: (raw.singer || raw.artists || raw.SingerName || []).map((a: any, i: number) => {
        if (typeof a === 'string') {
          return { id: String(i), name: a }
        }
        return {
          id: String(a.id || a.singerid || i),
          name: a.name || a.singername || '',
        }
      }),
      album: raw.album || raw.album_name || raw.AlbumName ? {
        id: String(raw.albumid || raw.album_id || raw.AlbumID || ''),
        name: raw.album || raw.album_name || raw.AlbumName || '',
        coverUrl: raw.imgurl || raw.album_img || raw.AlbumImg || '',
      } : undefined,
      duration: (raw.duration || raw.Duration || raw.timelength || 0) * 1000,
      source: this.id,
      coverUrl: raw.imgurl || raw.album_img || raw.AlbumImg || '',
    }
  }

  private mapQuality(quality: QualityLevel): string {
    const map: Record<QualityLevel, string> = {
      standard: '128',
      higher: '192',
      exhigh: '320',
      lossless: 'flac',
      hires: 'hires',
    }
    return map[quality] || '320'
  }

  private parseLyric(lrc: string): LyricLine[] {
    const lines: LyricLine[] = []
    const lineRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g
    let match
    while ((match = lineRegex.exec(lrc)) !== null) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const millis = parseInt(match[3].padEnd(3, '0'), 10)
      const time = minutes * 60 + seconds + millis / 1000
      const text = match[4].trim()
      if (text) {
        lines.push({ time, text })
      }
    }
    return lines.sort((a, b) => a.time - b.time)
  }
}

export const kugouProvider = new KugouProvider()
