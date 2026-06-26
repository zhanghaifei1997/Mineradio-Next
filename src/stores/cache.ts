import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song, QualityLevel } from '@/types'

const STORAGE_KEY = 'mineradio_cache_settings'

export type CacheCategory = 'songs' | 'lyrics' | 'images' | 'other'

export interface DownloadTask {
  id: string
  song: Song
  quality: QualityLevel
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  progress: number
  totalSize: number
  downloadedSize: number
  speed: number
  error?: string
  createdAt: number
}

interface CacheSettings {
  autoCache: boolean
  maxSize: number
  strategy: 'lru' | 'fifo'
  wifiOnly: boolean
}

const defaultSettings: CacheSettings = {
  autoCache: true,
  maxSize: 2 * 1024 * 1024 * 1024,
  strategy: 'lru',
  wifiOnly: true,
}

interface CacheStats {
  songs: number
  lyrics: number
  images: number
  other: number
}

interface SongCacheItem {
  song: Song
  quality: QualityLevel
  url: string
  size: number
  cachedAt: number
  lastPlayedAt: number
  playCount: number
}

const isElectron = !!(window as any).electronAPI

export const useCacheStore = defineStore('cache', () => {
  const settings = ref<CacheSettings>(loadSettings())

  const cacheStats = ref<CacheStats>({
    songs: 0,
    lyrics: 0,
    images: 0,
    other: 0,
  })

  const totalCacheSize = computed(() => {
    return cacheStats.value.songs + cacheStats.value.lyrics + cacheStats.value.images + cacheStats.value.other
  })

  const downloadTasks = ref<DownloadTask[]>([])
  const activeDownloadCount = computed(() => downloadTasks.value.filter(t => t.status === 'downloading').length)
  const completedDownloadCount = computed(() => downloadTasks.value.filter(t => t.status === 'completed').length)

  const isElectronEnv = ref(isElectron)

  function setAutoCache(enabled: boolean): void {
    settings.value.autoCache = enabled
    saveSettings()
  }

  function setMaxSize(size: number): void {
    settings.value.maxSize = size
    saveSettings()
  }

  function setStrategy(strategy: 'lru' | 'fifo'): void {
    settings.value.strategy = strategy
    saveSettings()
  }

  function setWifiOnly(enabled: boolean): void {
    settings.value.wifiOnly = enabled
    saveSettings()
  }

  async function getCacheSize(): Promise<CacheStats> {
    if (isElectron && (window as any).electronAPI?.cache?.getStats) {
      try {
        const stats = await (window as any).electronAPI.cache.getStats()
        cacheStats.value = stats
        return stats
      } catch (e) {
        console.warn('Failed to get cache stats from electron:', e)
      }
    }
    return cacheStats.value
  }

  async function clearCache(category?: CacheCategory): Promise<void> {
    if (isElectron && (window as any).electronAPI?.cache?.clear) {
      try {
        await (window as any).electronAPI.cache.clear(category)
        await getCacheSize()
        return
      } catch (e) {
        console.warn('Failed to clear cache from electron:', e)
      }
    }

    if (typeof indexedDB !== 'undefined') {
      try {
        await clearIndexedDBCache(category)
      } catch (e) {
        console.warn('Failed to clear IndexedDB cache:', e)
      }
    }

    if (!category || category === 'images') {
      try {
        localStorage.removeItem('cover_cache')
      } catch (e) {
        console.warn('Failed to clear localStorage cache:', e)
      }
    }

    await getCacheSize()
  }

  async function clearIndexedDBCache(category?: CacheCategory): Promise<void> {
    return new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('mineradio_cache')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    })
  }

  function addDownload(song: Song, quality: QualityLevel = 'exhigh'): DownloadTask {
    const existing = downloadTasks.value.find(t => t.id === song.id && t.quality === quality)
    if (existing) return existing

    const task: DownloadTask = {
      id: `${song.id}_${quality}`,
      song,
      quality,
      status: 'pending',
      progress: 0,
      totalSize: 0,
      downloadedSize: 0,
      speed: 0,
      createdAt: Date.now(),
    }

    downloadTasks.value.unshift(task)
    startDownload(task.id)
    return task
  }

  function startDownload(taskId: string): void {
    const task = downloadTasks.value.find(t => t.id === taskId)
    if (!task || task.status === 'downloading') return

    task.status = 'downloading'

    if (isElectron && (window as any).electronAPI?.download?.start) {
      (window as any).electronAPI.download.start(task.song.id, task.quality, task.song.source)
      setupDownloadIpcListeners()
    } else {
      simulateDownload(taskId)
    }
  }

  function setupDownloadIpcListeners(): void {
    if (!(window as any).electronAPI?.download?.onProgress) return

    ;(window as any).electronAPI.download.onProgress((data: any) => {
      const task = downloadTasks.value.find(t => t.id === `${data.songId}_${data.quality}`)
      if (task) {
        task.progress = data.progress
        task.downloadedSize = data.downloaded
        task.totalSize = data.total
        task.speed = data.speed
      }
    })

    ;(window as any).electronAPI.download.onComplete((data: any) => {
      const task = downloadTasks.value.find(t => t.id === `${data.songId}_${data.quality}`)
      if (task) {
        task.status = 'completed'
        task.progress = 100
        task.downloadedSize = task.totalSize
        getCacheSize()
      }
    })

    ;(window as any).electronAPI.download.onError((data: any) => {
      const task = downloadTasks.value.find(t => t.id === `${data.songId}_${data.quality}`)
      if (task) {
        task.status = 'failed'
        task.error = data.error
      }
    })
  }

  function simulateDownload(taskId: string): void {
    const task = downloadTasks.value.find(t => t.id === taskId)
    if (!task) return

    const totalSize = Math.floor(Math.random() * 10 * 1024 * 1024) + 5 * 1024 * 1024
    task.totalSize = totalSize

    let downloaded = 0
    const interval = setInterval(() => {
      if (task.status !== 'downloading') {
        clearInterval(interval)
        return
      }

      const chunk = Math.floor(Math.random() * 500 * 1024) + 100 * 1024
      downloaded = Math.min(downloaded + chunk, totalSize)
      task.downloadedSize = downloaded
      task.progress = Math.floor((downloaded / totalSize) * 100)
      task.speed = chunk * 2

      if (downloaded >= totalSize) {
        task.status = 'completed'
        task.progress = 100
        clearInterval(interval)
        getCacheSize()
      }
    }, 200)
  }

  function cancelDownload(taskId: string): void {
    const index = downloadTasks.value.findIndex(t => t.id === taskId)
    if (index > -1) {
      downloadTasks.value.splice(index, 1)
    }
  }

  function removeCompletedDownloads(): void {
    downloadTasks.value = downloadTasks.value.filter(t => t.status !== 'completed')
  }

  function loadSettings(): CacheSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          ...defaultSettings,
          ...parsed,
        }
      }
    } catch (e) {
      console.warn('Failed to load cache settings:', e)
    }
    return { ...defaultSettings }
  }

  function saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.warn('Failed to save cache settings:', e)
    }
  }

  function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return {
    settings,
    cacheStats,
    totalCacheSize,
    downloadTasks,
    activeDownloadCount,
    completedDownloadCount,
    isElectronEnv,
    setAutoCache,
    setMaxSize,
    setStrategy,
    setWifiOnly,
    getCacheSize,
    clearCache,
    addDownload,
    startDownload,
    cancelDownload,
    removeCompletedDownloads,
    formatSize,
  }
})
