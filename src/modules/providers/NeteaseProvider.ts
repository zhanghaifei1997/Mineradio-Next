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

const API_BASE = '/api/netease'

export class NeteaseProvider extends MusicProvider {
  readonly id = 'netease'
  readonly name = '网易云音乐'
  readonly color = '#d95b67'

  private async request<T>(path: string, params?: Record<string, any>): Promise<T> {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await fetch(`${API_BASE}${path}${query}`)
    if (!res.ok) throw new Error(`Netease API error: ${res.status}`)
    return res.json()
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      const data = await this.request<any>('/login/status')
      return !!data?.loggedIn || !!data?.userId
    } catch {
      return false
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    try {
      const data = await this.request<any>('/login/status')
      if (!data?.loggedIn && !data?.userId) return null
      return this.mapUserProfile(data)
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
    const { type = 'song', limit = 30, offset = 0 } = options
    const data = await this.request<any>('/search', {
      keywords: keyword,
      type: this.mapSearchType(type),
      limit,
      offset,
    })
    return {
      songs: (data.result?.songs || []).map((s: any) => this.mapSong(s)),
      total: data.result?.songCount || 0,
      more: data.result?.more ?? false,
    }
  }

  async getSongDetail(id: string): Promise<Song | null> {
    const data = await this.request<any>('/song/detail', { ids: id })
    const songs = data?.songs || []
    return songs[0] ? this.mapSong(songs[0]) : null
  }

  async getSongUrl(id: string, quality: QualityLevel = 'exhigh'): Promise<SongUrlResult | null> {
    const data = await this.request<any>('/song/url', {
      id,
      level: this.mapQuality(quality),
    })
    const d = data?.data?.[0]
    if (!d?.url) return null
    return {
      url: d.url,
      quality,
      size: d.size,
      md5: d.md5,
    }
  }

  async getLyric(id: string): Promise<LyricData | null> {
    const data = await this.request<any>('/lyric', { id })
    const lrc = data?.lrc?.lyric
    if (!lrc) return null
    return {
      lines: this.parseLyric(lrc),
      hasTranslation: !!data?.tlyric?.lyric,
      offset: data?.lrc?.version || 0,
    }
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    const data = await this.request<any>('/playlist/detail', { id })
    const p = data?.playlist
    if (!p) return null
    return {
      id: String(p.id),
      name: p.name,
      coverUrl: p.coverImgUrl,
      description: p.description,
      tracks: (p.tracks || []).map((s: any) => this.mapSong(s)),
      trackCount: p.trackCount,
      playCount: p.playCount,
      creator: p.creator ? this.mapUserProfile(p.creator) : undefined,
      source: this.id,
    }
  }

  async getUserPlaylists(uid?: string): Promise<Playlist[]> {
    const data = await this.request<any>('/user/playlist', { uid })
    const playlists = data?.playlists || []
    return playlists.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      coverUrl: p.cover || p.coverImgUrl,
      description: p.description,
      tracks: [],
      trackCount: p.trackCount,
      playCount: p.playCount,
      creator: p.creator
        ? { id: String(p.creator.userId || p.creator.id), nickname: p.creator.nickname || p.creator, avatarUrl: p.creator.avatarUrl } as UserProfile
        : undefined,
      source: this.id,
    }))
  }

  async getRecommendSongs(): Promise<Song[]> {
    const data = await this.request<any>('/recommend/songs')
    return (data?.data?.dailySongs || []).map((s: any) => this.mapSong(s))
  }

  async getRecommendResources(): Promise<Playlist[]> {
    const data = await this.request<any>('/recommend/resource')
    return (data?.recommend || []).map((p: any) => ({
      id: String(p.id),
      name: p.name,
      coverUrl: p.picUrl,
      tracks: [],
      trackCount: p.playcount,
      source: this.id,
    }))
  }

  async getArtistDetail(id: string): Promise<Artist | null> {
    const data = await this.request<any>('/artist/detail', { id })
    const a = data?.data?.artist
    if (!a) return null
    return {
      id: String(a.id),
      name: a.name,
      avatar: a.avatar,
    }
  }

  async getArtistSongs(id: string): Promise<Song[]> {
    const data = await this.request<any>('/artist/songs', { id })
    return (data?.songs || []).map((s: any) => this.mapSong(s))
  }

  async getAlbum(id: string): Promise<Album | null> {
    const data = await this.request<any>('/album', { id })
    const a = data?.album
    if (!a) return null
    return {
      id: String(a.id),
      name: a.name,
      coverUrl: a.picUrl,
    }
  }

  async likeSong(id: string, like: boolean): Promise<boolean> {
    const data = await this.request<any>('/like', { id, like: like ? 'true' : 'false' })
    return data?.code === 200
  }

  async isSongLiked(id: string): Promise<boolean> {
    const data = await this.request<any>('/song/like/check', { id })
    return data?.status === true
  }

  async getLikedSongs(): Promise<Song[]> {
    const profile = await this.getCurrentUser()
    if (!profile) return []
    const playlists = await this.getUserPlaylists(profile.id)
    const liked = playlists.find(p => p.name.includes('我喜欢的音乐'))
    if (!liked) return []
    const detail = await this.getPlaylist(liked.id)
    return detail?.tracks || []
  }

  private mapSong(raw: any): Song {
    return {
      id: String(raw.id),
      name: raw.name,
      artists: (raw.ar || raw.artists || []).map((a: any) => ({
        id: String(a.id),
        name: a.name,
      })),
      album: raw.al ? {
        id: String(raw.al.id),
        name: raw.al.name,
        coverUrl: raw.al.picUrl,
      } : undefined,
      duration: raw.dt || raw.duration || 0,
      source: this.id,
      coverUrl: raw.al?.picUrl,
    }
  }

  private mapUserProfile(raw: any): UserProfile {
    return {
      id: String(raw.userId || raw.id || ''),
      nickname: raw.nickname || '',
      avatarUrl: raw.avatar || raw.avatarUrl,
      signature: raw.signature,
      vipType: raw.vipType,
      vipLevel: raw.vipLevel,
      isSvip: raw.isSvip,
    }
  }

  private mapSearchType(type: string): number {
    const map: Record<string, number> = {
      song: 1,
      album: 10,
      artist: 100,
      playlist: 1000,
    }
    return map[type] || 1
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
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g
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

export const neteaseProvider = new NeteaseProvider()
