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
  TopListSong,
  SearchSuggestResult,
  SearchSuggestItem,
  HotSearchResult,
  HotSearchItem,
  FMSong,
  DailyRecommend,
  DailyRecommendSong,
  ArtistDetail,
  AlbumDetail,
  CommentList,
  Comment,
  CommentUser,
  MV,
  SongDetail,
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
    // freeTrialInfo 存在时表示返回的是试听片段
    const isTrial = !!(d.freeTrialInfo || d.trial)
    const reason = d.reason || (d.code && d.code !== 200 ? 'unavailable' : undefined)
    return {
      url: d.url,
      quality,
      size: d.size,
      md5: d.md5,
      level: d.level,
      trial: isTrial,
      loggedIn: data?.account !== undefined || data?.loginType !== undefined,
      vipLevel: data?.vipLevel,
      reason,
      restriction: d.restriction,
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

  async getArtistDetail(id: string): Promise<ArtistDetail | null> {
    try {
      const data = await this.request<any>('/artist/detail', { id })
      const a = data?.data?.artist
      if (!a) return null
      return {
        id: String(a.id),
        name: a.name,
        avatar: a.avatar || a.img1v1Url || a.picUrl,
        briefDesc: a.briefDesc,
        description: a.detailDesc || a.description,
        fansCount: a.fansCount,
        songCount: a.musicSize,
        albumCount: a.albumSize,
        mvCount: a.mvSize,
        followed: a.followed,
        followedCount: a.followCount,
      }
    } catch (e) {
      console.error('Get artist detail error:', e)
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
    } catch (e) {
      console.error('Get artist songs error:', e)
      return { songs: [], total: 0, more: false }
    }
  }

  async getArtistAlbums(id: string, page: number = 1, limit: number = 30): Promise<{ albums: Album[]; total: number; more: boolean }> {
    try {
      const offset = (page - 1) * limit
      const data = await this.request<any>('/artist/album', { id, limit, offset })
      const albums = (data?.hotAlbums || data?.albums || []).map((a: any) => ({
        id: String(a.id),
        name: a.name,
        coverUrl: a.picUrl || a.img1v1Url,
      }))
      return {
        albums,
        total: data?.total || albums.length,
        more: data?.more ?? false,
      }
    } catch (e) {
      console.error('Get artist albums error:', e)
      return { albums: [], total: 0, more: false }
    }
  }

  async getArtistMVs(id: string, page: number = 1, limit: number = 30): Promise<{ mvs: MV[]; total: number; more: boolean }> {
    try {
      const offset = (page - 1) * limit
      const data = await this.request<any>('/artist/mv', { id, limit, offset })
      const mvs = (data?.mvs || []).map((m: any) => ({
        id: String(m.id),
        name: m.name,
        coverUrl: m.imgurl || m.imgUrl || m.cover,
        playCount: m.playCount,
        artistName: m.artistName || (m.artists?.[0]?.name),
        artistId: m.artistId || (m.artists?.[0]?.id),
        duration: m.duration,
      }))
      return {
        mvs,
        total: data?.count || mvs.length,
        more: data?.hasMore ?? false,
      }
    } catch (e) {
      console.error('Get artist mvs error:', e)
      return { mvs: [], total: 0, more: false }
    }
  }

  async getSimilarArtists(id: string): Promise<Artist[]> {
    try {
      const data = await this.request<any>('/simi/artist', { id })
      return (data?.artists || []).map((a: any) => ({
        id: String(a.id),
        name: a.name,
        avatar: a.img1v1Url || a.picUrl || a.avatar,
      }))
    } catch (e) {
      console.error('Get similar artists error:', e)
      return []
    }
  }

  async followArtist(id: string, follow: boolean): Promise<boolean> {
    try {
      const data = await this.request<any>('/artist/sub', { id, t: follow ? 1 : 0 })
      return data?.code === 200
    } catch (e) {
      console.error('Follow artist error:', e)
      return false
    }
  }

  async getAlbum(id: string): Promise<AlbumDetail | null> {
    try {
      const data = await this.request<any>('/album', { id })
      const a = data?.album
      if (!a) return null
      const tracks = (data?.songs || a.tracks || []).map((s: any) => this.mapSong(s))
      return {
        id: String(a.id),
        name: a.name,
        coverUrl: a.picUrl || a.img1v1Url,
        artists: (a.artists || a.ar || []).map((art: any) => ({
          id: String(art.id),
          name: art.name,
          avatar: art.img1v1Url || art.picUrl,
        })),
        publishTime: a.publishTime,
        genre: a.genre || a.type,
        description: a.description || a.info,
        songCount: a.trackCount || tracks.length,
        playCount: a.playCount,
        subscribed: a.subscribed,
        subCount: a.subCount,
        tracks,
      }
    } catch (e) {
      console.error('Get album error:', e)
      return null
    }
  }

  async getAlbumSongs(id: string): Promise<Song[]> {
    try {
      const data = await this.request<any>('/album', { id })
      return (data?.songs || data?.album?.tracks || []).map((s: any) => this.mapSong(s))
    } catch (e) {
      console.error('Get album songs error:', e)
      return []
    }
  }

  async subscribeAlbum(id: string, subscribe: boolean): Promise<boolean> {
    try {
      const data = await this.request<any>('/album/sub', { id, t: subscribe ? 1 : 0 })
      return data?.code === 200
    } catch (e) {
      console.error('Subscribe album error:', e)
      return false
    }
  }

  async getSongComments(id: string, page: number = 1, limit: number = 20, type: 'hot' | 'new' = 'new'): Promise<CommentList | null> {
    try {
      const offset = (page - 1) * limit
      const data = await this.request<any>('/comment/music', { id, limit, offset })
      const comments = this.mapComments(data?.comments || [])
      const hotComments = this.mapComments(data?.hotComments || [])
      return {
        total: data?.total || 0,
        hasMore: data?.more ?? false,
        comments,
        hotComments,
      }
    } catch (e) {
      console.error('Get song comments error:', e)
      return null
    }
  }

  async likeComment(id: string, cid: string, like: boolean): Promise<boolean> {
    try {
      const data = await this.request<any>('/comment/like', { id, cid, t: like ? 1 : 0, type: 0 })
      return data?.code === 200
    } catch (e) {
      console.error('Like comment error:', e)
      return false
    }
  }

  async sendComment(id: string, content: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/comment/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content }),
      })
      const data = await res.json()
      return data?.code === 200
    } catch (e) {
      console.error('Send comment error:', e)
      return false
    }
  }

  async getSongFullDetail(id: string): Promise<SongDetail | null> {
    try {
      const data = await this.request<any>('/song/detail', { ids: id })
      const songs = data?.songs || []
      if (!songs[0]) return null
      const raw = songs[0]
      const song = this.mapSong(raw) as SongDetail
      song.size = raw.size
      song.bitrate = raw.duration ? Math.floor((raw.size * 8) / (raw.duration / 1000)) : undefined
      song.publishTime = raw.publishTime
      return song
    } catch (e) {
      console.error('Get song full detail error:', e)
      return null
    }
  }

  private mapComments(rawComments: any[]): Comment[] {
    return rawComments.map((c: any) => ({
      id: String(c.commentId || c.id),
      content: c.content,
      user: this.mapCommentUser(c.user),
      time: c.time,
      timeStr: c.timeStr,
      likedCount: c.likedCount,
      liked: c.liked,
      replyCount: c.replyCount,
      isHot: c.isHot,
    }))
  }

  private mapCommentUser(user: any): CommentUser {
    if (!user) return { id: '', nickname: '匿名用户' }
    return {
      id: String(user.userId || user.id),
      nickname: user.nickname || user.userName || '',
      avatarUrl: user.avatarUrl || user.img1v1Url,
      vipType: user.vipType,
      vipLevel: user.vipLevel,
      isSvip: user.vipType === 11 || user.vipType === 12,
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

  async getTopList(): Promise<TopListItem[]> {
    try {
      const data = await this.request<any>('/toplist')
      const list = data?.list || []
      return list.map((item: any) => ({
        id: String(item.id),
        name: item.name,
        coverUrl: item.coverImgUrl,
        description: item.description,
        playCount: item.playCount,
        updateTime: item.updateTime,
        trackCount: item.trackCount,
        tracks: (item.tracks || []).map((s: any) => this.mapSong(s)),
        source: this.id,
        ToplistType: item.ToplistType,
        updateFrequency: item.updateFrequency,
      }))
    } catch (e) {
      console.error('Get top list error:', e)
      return []
    }
  }

  async getTopListDetail(id: string): Promise<TopListDetail | null> {
    try {
      const data = await this.request<any>('/top/list', { id, limit: 100, offset: 0 })
      const playlist = data?.playlist
      if (!playlist) return null

      const tracks: TopListSong[] = (playlist.tracks || []).map((s: any, index: number) => {
        const song = this.mapSong(s) as TopListSong
        song.rank = index + 1
        const rankInfo = data?.rankList?.find((r: any) => r.id === s.id)
        if (rankInfo) {
          song.lastRank = rankInfo.lastRank
          song.changeValue = rankInfo.changeValue
          if (rankInfo.changeType === 1) {
            song.changeType = 'up'
          } else if (rankInfo.changeType === 2) {
            song.changeType = 'down'
          } else if (rankInfo.changeType === 0) {
            song.changeType = 'same'
          } else if (rankInfo.changeType === 3) {
            song.changeType = 'new'
          }
        }
        return song
      })

      return {
        id: String(playlist.id),
        name: playlist.name,
        coverUrl: playlist.coverImgUrl,
        description: playlist.description,
        playCount: playlist.playCount,
        updateTime: playlist.updateTime,
        trackCount: playlist.trackCount,
        tracks,
        source: this.id,
      }
    } catch (e) {
      console.error('Get top list detail error:', e)
      return null
    }
  }

  async getSearchSuggest(keyword: string): Promise<SearchSuggestResult> {
    try {
      const data = await this.request<any>('/search/suggest', { keywords: keyword })
      const result = data?.result || data

      const songs: SearchSuggestItem[] = (result?.songs || []).map((s: any) => ({
        keyword: s.name,
        type: 'song' as const,
        id: String(s.id),
        name: s.name,
        artist: (s.artists || s.ar || []).map((a: any) => a.name).join(' / '),
        coverUrl: s.album?.picUrl || s.al?.picUrl,
      }))

      const artists: SearchSuggestItem[] = (result?.artists || []).map((a: any) => ({
        keyword: a.name,
        type: 'artist' as const,
        id: String(a.id),
        name: a.name,
        coverUrl: a.picUrl || a.img1v1Url,
      }))

      const albums: SearchSuggestItem[] = (result?.albums || []).map((a: any) => ({
        keyword: a.name,
        type: 'album' as const,
        id: String(a.id),
        name: a.name,
        artist: (a.artists || a.ar || []).map((art: any) => art.name).join(' / '),
        coverUrl: a.picUrl || a.img1v1Url,
      }))

      const playlists: SearchSuggestItem[] = (result?.playlists || []).map((p: any) => ({
        keyword: p.name,
        type: 'playlist' as const,
        id: String(p.id),
        name: p.name,
        coverUrl: p.coverImgUrl,
      }))

      return { songs, artists, albums, playlists }
    } catch (e) {
      console.error('Get search suggest error:', e)
      return { songs: [], artists: [], albums: [], playlists: [] }
    }
  }

  async getHotSearch(): Promise<HotSearchResult> {
    try {
      const data = await this.request<any>('/search/hot')
      const hots: HotSearchItem[] = (data?.data || []).map((item: any, index: number) => ({
        rank: index + 1,
        keyword: item.searchWord || item.first || '',
        hotValue: item.score || item.hotValue || 0,
        iconType: item.iconType || 0,
        isHot: item.iconType === 1,
        isNew: item.iconType === 2,
      }))
      return { hots, time: Date.now() }
    } catch (e) {
      console.error('Get hot search error:', e)
      return { hots: [], time: Date.now() }
    }
  }

  async getPersonalFM(): Promise<FMSong[]> {
    try {
      const data = await this.request<any>('/personal/fm')
      const songs = (data?.songs || data?.data || []).map((s: any) => {
        const song = this.mapSong(s) as FMSong
        song.fmId = String(s.id)
        song.liked = false
        return song
      })
      return songs
    } catch (e) {
      console.error('Get personal FM error:', e)
      return []
    }
  }

  async likeFMSong(id: string, like: boolean): Promise<boolean> {
    return this.likeSong(id, like)
  }

  async getDailyRecommend(): Promise<DailyRecommend | null> {
    try {
      const data = await this.request<any>('/recommend/songs')
      const dailySongs = data?.data?.dailySongs || data?.songs || []
      const songs: DailyRecommendSong[] = dailySongs.map((s: any) => {
        const song = this.mapSong(s) as DailyRecommendSong
        song.reason = s.reason || s.pc?.rp || ''
        song.alg = s.alg || ''
        return song
      })

      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      return {
        date: dateStr,
        songs,
        recommendReason: data?.data?.recommendReason || '',
      }
    } catch (e) {
      console.error('Get daily recommend error:', e)
      return null
    }
  }

  async createPlaylist(name: string, privacy: 'public' | 'private' = 'private'): Promise<Playlist | null> {
    try {
      const res = await fetch(`${API_BASE}/playlist/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, privacy: privacy === 'private' ? '10' : '0' }),
      })
      const data = await res.json()
      const pl = data?.playlist || data?.data
      if (!pl) return null
      return {
        id: String(pl.id),
        name: pl.name,
        coverUrl: pl.coverImgUrl,
        description: pl.description,
        tracks: [],
        trackCount: pl.trackCount || 0,
        creator: pl.creator ? this.mapUserProfile(pl.creator) : undefined,
        source: this.id,
      }
    } catch (e) {
      console.error('Create playlist error:', e)
      return null
    }
  }

  async updatePlaylist(id: string, data: { name?: string; description?: string; coverUrl?: string; privacy?: 'public' | 'private' }): Promise<boolean> {
    try {
      const params: Record<string, any> = {}
      if (data.name !== undefined) params.name = data.name
      if (data.description !== undefined) params.desc = data.description
      if (data.privacy !== undefined) params.privacy = data.privacy === 'private' ? '10' : '0'
      if (Object.keys(params).length === 0) return false
      params.id = id
      const res = await this.request<any>('/playlist/update', params)
      return res?.code === 200
    } catch (e) {
      console.error('Update playlist error:', e)
      return false
    }
  }

  async deletePlaylist(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/playlist/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      return data?.code === 200
    } catch (e) {
      console.error('Delete playlist error:', e)
      return false
    }
  }

  async subscribePlaylist(id: string): Promise<boolean> {
    try {
      const res = await this.request<any>('/playlist/subscribe', { id, t: 1 })
      return res?.code === 200
    } catch (e) {
      console.error('Subscribe playlist error:', e)
      return false
    }
  }

  async unsubscribePlaylist(id: string): Promise<boolean> {
    try {
      const res = await this.request<any>('/playlist/subscribe', { id, t: 0 })
      return res?.code === 200
    } catch (e) {
      console.error('Unsubscribe playlist error:', e)
      return false
    }
  }

  async addToPlaylist(playlistId: string, songIds: string[]): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/playlist/add-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: playlistId, ids: songIds.join(',') }),
      })
      const data = await res.json()
      return data?.success === true || data?.code === 200
    } catch (e) {
      console.error('Add to playlist error:', e)
      return false
    }
  }

  async removeFromPlaylist(playlistId: string, songIds: string[]): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/playlist/delete-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid: playlistId, ids: songIds.join(',') }),
      })
      const data = await res.json()
      return data?.success === true || data?.code === 200
    } catch (e) {
      console.error('Remove from playlist error:', e)
      return false
    }
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
