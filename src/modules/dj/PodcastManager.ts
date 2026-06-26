import type {
  DjRadio,
  DjProgram,
  DjCategory,
  DjToplist,
  DjToplistType,
  PodcastRecommendItem,
  PlayHistoryItem,
  PodcastSearchResult,
  SubscribedRadioList,
  ProgramListResult,
  DjCategoryList,
} from './types'

const API_BASE = '/api/netease'
const HISTORY_STORAGE_KEY = 'mineradio_podcast_history'
const SUBSCRIBED_CACHE_KEY = 'mineradio_subscribed_radios'

export class PodcastManager {
  private history: PlayHistoryItem[] = []
  private subscribedCache: DjRadio[] = []
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.loadHistory()
    this.loadSubscribedCache()
  }

  async getRecommendRadios(): Promise<DjRadio[]> {
    try {
      const resp = await fetch(`${API_BASE}/dj/recommend`)
      const data = await resp.json()
      if (data.djRadios) {
        return data.djRadios.map((r: any) => this.normalizeRadio(r))
      }
      return []
    } catch (e) {
      console.error('[PodcastManager] Failed to get recommend radios:', e)
      return []
    }
  }

  async getRadioPrograms(
    rid: string,
    limit = 30,
    offset = 0
  ): Promise<ProgramListResult> {
    try {
      const resp = await fetch(
        `${API_BASE}/dj/program?rid=${rid}&limit=${limit}&offset=${offset}`
      )
      const data = await resp.json()
      if (data.programs) {
        return {
          count: data.count || 0,
          hasMore: data.more || false,
          programs: data.programs.map((p: any) => this.normalizeProgram(p, rid)),
        }
      }
      return { count: 0, hasMore: false, programs: [] }
    } catch (e) {
      console.error('[PodcastManager] Failed to get radio programs:', e)
      return { count: 0, hasMore: false, programs: [] }
    }
  }

  async getProgramDetail(id: string): Promise<DjProgram | null> {
    try {
      const resp = await fetch(`${API_BASE}/dj/program/detail?id=${id}`)
      const data = await resp.json()
      if (data.program) {
        return this.normalizeProgram(data.program)
      }
      return null
    } catch (e) {
      console.error('[PodcastManager] Failed to get program detail:', e)
      return null
    }
  }

  async getSubscribedRadios(limit = 30, offset = 0): Promise<SubscribedRadioList> {
    try {
      const resp = await fetch(
        `${API_BASE}/dj/sub?limit=${limit}&offset=${offset}`
      )
      const data = await resp.json()
      if (data.djRadios) {
        const radios = data.djRadios.map((r: any) => this.normalizeRadio(r))
        this.subscribedCache = radios
        this.saveSubscribedCache()
        return {
          count: data.count || 0,
          hasMore: data.hasMore || false,
          radios,
        }
      }
      return { count: 0, hasMore: false, radios: [] }
    } catch (e) {
      console.error('[PodcastManager] Failed to get subscribed radios:', e)
      return { count: 0, hasMore: false, radios: this.subscribedCache }
    }
  }

  async getCategories(): Promise<DjCategoryList> {
    try {
      const resp = await fetch(`${API_BASE}/dj/catelist`)
      const data = await resp.json()
      const categories: DjCategory[] = []
      if (data.categories) {
        for (const cat of data.categories) {
          categories.push({
            id: cat.id,
            name: cat.name,
            picUrl: cat.pic56x56 || cat.picUrl,
            radioCategory: cat.radioCategory,
          })
        }
      }
      return { categories }
    } catch (e) {
      console.error('[PodcastManager] Failed to get categories:', e)
      return { categories: [] }
    }
  }

  async getToplist(
    type: DjToplistType = 'hot',
    limit = 100
  ): Promise<DjToplist | null> {
    try {
      const typeMap: Record<string, string> = {
        hot: 'hot',
        new: 'new',
        rising: 'rising',
      }
      const resp = await fetch(
        `${API_BASE}/dj/program/toplist?type=${typeMap[type] || 'hot'}&limit=${limit}`
      )
      const data = await resp.json()
      if (data.toplist) {
        const tracks = data.toplist.map((item: any, index: number) => ({
          program: this.normalizeProgram(item.program || item),
          rank: index + 1,
          score: item.score,
          lastRank: item.lastRank,
          rate: item.rate,
        }))
        return {
          id: `dj-toplist-${type}`,
          name: type === 'hot' ? '节目热播榜' : type === 'new' ? '节目新晋榜' : '节目上升榜',
          tracks,
          top3: tracks.slice(0, 3),
          totalRank: tracks.length,
        }
      }
      return null
    } catch (e) {
      console.error('[PodcastManager] Failed to get toplist:', e)
      return null
    }
  }

  async searchPodcasts(
    keywords: string,
    limit = 30,
    offset = 0
  ): Promise<PodcastSearchResult> {
    try {
      const [programResp, radioResp] = await Promise.all([
        fetch(
          `${API_BASE}/search?keywords=${encodeURIComponent(keywords)}&type=1009&limit=${limit}&offset=${offset}`
        ),
        fetch(
          `${API_BASE}/search?keywords=${encodeURIComponent(keywords)}&type=1002&limit=${limit}&offset=${offset}`
        ),
      ])

      const programData = await programResp.json()
      const radioData = await radioResp.json()

      const programs: DjProgram[] =
        programData.result?.programs?.map((p: any) => this.normalizeProgram(p)) || []
      const radios: DjRadio[] =
        radioData.result?.djRadios?.map((r: any) => this.normalizeRadio(r)) || []

      return {
        programs,
        radios,
        total: (programData.result?.programCount || 0) + (radioData.result?.djRadioCount || 0),
        more: programData.result?.more || radioData.result?.more || false,
      }
    } catch (e) {
      console.error('[PodcastManager] Failed to search podcasts:', e)
      return { programs: [], radios: [], total: 0, more: false }
    }
  }

  async getRecommendByCategory(
    categoryId: number,
    limit = 30
  ): Promise<DjRadio[]> {
    try {
      const resp = await fetch(
        `${API_BASE}/dj/recommend/type?type=${categoryId}&limit=${limit}`
      )
      const data = await resp.json()
      if (data.djRadios) {
        return data.djRadios.map((r: any) => this.normalizeRadio(r))
      }
      return []
    } catch (e) {
      console.error('[PodcastManager] Failed to get recommend by category:', e)
      return []
    }
  }

  getPlayHistory(): PlayHistoryItem[] {
    return [...this.history]
  }

  addToHistory(
    program: DjProgram,
    radio?: DjRadio,
    progress = 0,
    duration = 0
  ): void {
    const existingIndex = this.history.findIndex((h) => h.id === program.id)
    if (existingIndex >= 0) {
      this.history.splice(existingIndex, 1)
    }

    this.history.unshift({
      id: program.id,
      program,
      radio,
      playedAt: Date.now(),
      progress,
      duration: duration || program.duration,
    })

    if (this.history.length > 100) {
      this.history = this.history.slice(0, 100)
    }

    this.saveHistory()
    this.notifyListeners()
  }

  updateProgress(programId: string, progress: number): void {
    const item = this.history.find((h) => h.id === programId)
    if (item) {
      item.progress = progress
      item.playedAt = Date.now()
      this.saveHistory()
      this.notifyListeners()
    }
  }

  clearHistory(): void {
    this.history = []
    this.saveHistory()
    this.notifyListeners()
  }

  getRecommendItems(): PodcastRecommendItem[] {
    const items: PodcastRecommendItem[] = []
    const recent = this.history.slice(0, 10)
    for (const h of recent) {
      if (h.radio) {
        items.push({
          id: h.radio.id,
          name: h.radio.name,
          picUrl: h.radio.picUrl,
          desc: h.radio.desc,
          playCount: h.radio.playCount,
          programCount: h.radio.programCount,
          type: 'radio',
          source: 'history',
        })
      }
    }
    return items
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  private normalizeRadio(raw: any): DjRadio {
    return {
      id: String(raw.id || raw.rid || ''),
      name: raw.name || '',
      picUrl: raw.picUrl || raw.picIdStr ? `https://p1.music.126.net/${raw.picIdStr || ''}/?param=200y200` : undefined,
      desc: raw.desc || raw.description || '',
      subCount: raw.subCount || raw.subedCount || 0,
      programCount: raw.programCount || 0,
      categoryId: raw.categoryId,
      category: raw.category,
      secondCategoryId: raw.secondCategoryId,
      secondCategory: raw.secondCategory,
      rcmdtext: raw.rcmdtext,
      dj: raw.dj ? this.normalizeDjProfile(raw.dj) : undefined,
      playCount: raw.playCount,
      score: raw.score,
      lastProgramName: raw.lastProgramName,
      lastProgramId: raw.lastProgramId ? String(raw.lastProgramId) : undefined,
      lastProgramCreateTime: raw.lastProgramCreateTime,
      subed: raw.subed,
      feeScope: raw.feeScope,
      finish: raw.finish,
      underShelf: raw.underShelf,
      buyed: raw.buyed,
    }
  }

  private normalizeProgram(raw: any, radioId?: string): DjProgram {
    const radio = raw.radio ? this.normalizeRadio(raw.radio) : undefined
    return {
      id: String(raw.id || raw.mainId || ''),
      name: raw.name || '',
      description: raw.description || raw.desc || '',
      coverUrl:
        raw.coverUrl ||
        (raw.cover ? `https://p1.music.126.net/${raw.cover}/?param=200y200` : undefined) ||
        radio?.picUrl,
      dj: raw.dj ? this.normalizeDjProfile(raw.dj) : radio?.dj,
      radio,
      duration: raw.duration || 0,
      playCount: raw.playCount || raw.listenerCount,
      commentCount: raw.commentCount,
      likeCount: raw.likeCount,
      shareCount: raw.shareCount,
      subscribeCount: raw.subscribeCount,
      createTime: raw.createTime,
      pubStatus: raw.pubStatus,
      mainSong: raw.mainSong
        ? {
            id: String(raw.mainSong.id),
            name: raw.mainSong.name,
            duration: raw.mainSong.duration,
            artists: raw.mainSong.artists?.map((a: any) => ({
              id: String(a.id),
              name: a.name,
            })),
          }
        : undefined,
      songs: raw.songs?.map((s: any) => ({
        id: String(s.id),
        name: s.name,
        duration: s.duration,
        artists: s.artists?.map((a: any) => ({
          id: String(a.id),
          name: a.name,
        })),
      })),
      audioUrl: raw.url,
      isPublish: raw.pubStatus === 0 || raw.isPublish,
      serialNum: raw.serialNum,
    }
  }

  private normalizeDjProfile(raw: any) {
    return {
      userId: String(raw.userId || raw.uid || ''),
      nickname: raw.nickname || raw.userName || '',
      avatarUrl: raw.avatarUrl,
      signature: raw.signature,
      gender: raw.gender,
      userType: raw.userType,
      followed: raw.followed,
      vipType: raw.vipType,
    }
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (raw) {
        this.history = JSON.parse(raw)
      }
    } catch (e) {
      console.warn('[PodcastManager] Failed to load history:', e)
      this.history = []
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history))
    } catch (e) {
      console.warn('[PodcastManager] Failed to save history:', e)
    }
  }

  private loadSubscribedCache(): void {
    try {
      const raw = localStorage.getItem(SUBSCRIBED_CACHE_KEY)
      if (raw) {
        this.subscribedCache = JSON.parse(raw)
      }
    } catch (e) {
      console.warn('[PodcastManager] Failed to load subscribed cache:', e)
      this.subscribedCache = []
    }
  }

  private saveSubscribedCache(): void {
    try {
      localStorage.setItem(SUBSCRIBED_CACHE_KEY, JSON.stringify(this.subscribedCache))
    } catch (e) {
      console.warn('[PodcastManager] Failed to save subscribed cache:', e)
    }
  }

  dispose(): void {
    this.listeners.clear()
  }
}

export const podcastManager = new PodcastManager()
