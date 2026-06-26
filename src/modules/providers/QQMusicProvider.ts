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

const API_BASE = '/api/qq'

export class QQMusicProvider extends MusicProvider {
  readonly id = 'qqmusic'
  readonly name = 'QQ 音乐'
  readonly color = '#00F5D4'

  private async request<T>(path: string, params?: Record<string, any>): Promise<T> {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await fetch(`${API_BASE}${path}${query}`)
    if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`)
    return res.json()
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      const data = await this.request<any>('/login/status')
      return data?.playbackKeyReady ?? false
    } catch {
      return false
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const data = await this.request<any>('/login/status')
      if (!data?.uin) return null
      return {
        id: data.uin,
        nickname: data.nickname || 'QQ音乐用户',
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
    const data = await this.request<any>('/song/detail', { songmid: id })
    const songs = data?.songs || data?.data?.songList || []
    return songs[0] ? this.mapSong(songs[0]) : null
  }

  async getSongUrl(id: string, quality: QualityLevel = 'exhigh'): Promise<SongUrlResult | null> {
    const data = await this.request<any>('/song/url', {
      songmid: id,
      level: this.mapQuality(quality),
    })
    const d = data?.data?.[0] || data
    if (!d?.url) return null
    return {
      url: d.url,
      quality,
      size: d.size,
    }
  }

  async getLyric(id: string): Promise<LyricData | null> {
    const data = await this.request<any>('/lyric', { songmid: id })
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
    const p = data?.data?.songList || data?.playlist
    if (!p) return null
    return {
      id: String(p.id || p.tid),
      name: p.title || p.name,
      coverUrl: p.logo || p.coverImgUrl,
      description: p.desc,
      tracks: (p.songList || p.tracks || []).map((s: any) => this.mapSong(s)),
      trackCount: p.songnum || p.trackCount || 0,
      source: this.id,
    }
  }

  async getUserPlaylists(_uid?: string): Promise<Playlist[]> {
    return []
  }

  async getRecommendSongs(): Promise<Song[]> {
    return []
  }

  async getRecommendResources(): Promise<Playlist[]> {
    return []
  }

  async getArtistDetail(_id: string): Promise<Artist | null> {
    return null
  }

  async getArtistSongs(_id: string): Promise<Song[]> {
    return []
  }

  async getAlbum(_id: string): Promise<Album | null> {
    return null
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
      id: raw.songmid || String(raw.id),
      name: raw.songname || raw.name,
      artists: (raw.singer || raw.artists || []).map((a: any) => ({
        id: String(a.mid || a.id),
        name: a.name,
      })),
      album: raw.album ? {
        id: String(raw.album.mid || raw.album.id),
        name: raw.album.name,
        coverUrl: raw.album.picUrl,
      } : undefined,
      duration: (raw.interval || raw.duration || 0) * 1000,
      source: this.id,
      coverUrl: raw.album?.picUrl,
    }
  }

  private mapQuality(quality: QualityLevel): string {
    const map: Record<QualityLevel, string> = {
      standard: 'standard',
      higher: 'higher',
      exhigh: 'exhigh',
      lossless: 'lossless',
      hires: 'hires',
    }
    return map[quality] || 'exhigh'
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

export const qqMusicProvider = new QQMusicProvider()
