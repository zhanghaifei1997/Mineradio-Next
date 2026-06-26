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

  async getArtistDetail(id: string): Promise<Artist | null> {
    try {
      const data = await this.request<any>('/artist/detail', { id })
      const a = data?.artist || data
      if (!a) return null
      return {
        id: String(a.id),
        name: a.name,
        avatar: a.avatar || a.imgurl,
      }
    } catch {
      return null
    }
  }

  async getArtistSongs(id: string): Promise<Song[]> {
    try {
      const data = await this.request<any>('/artist/songs', { id })
      return (data?.songs || []).map((s: any) => this.mapSong(s))
    } catch {
      return []
    }
  }

  async getAlbum(id: string): Promise<Album | null> {
    try {
      const data = await this.request<any>('/album', { id })
      const a = data?.album || data
      if (!a) return null
      return {
        id: String(a.id || a.albumid),
        name: a.name || a.albumname,
        coverUrl: a.imgurl || a.coverImgUrl,
      }
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
