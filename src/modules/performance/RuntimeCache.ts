import { CacheManager } from './CacheManager'
import type { CacheTrimStrategy } from './types'

export type CacheType =
  | 'coverImages'
  | 'beatMaps'
  | 'lyrics'
  | 'searchResults'
  | 'playlistDetails'
  | 'colorExtraction'

export interface RuntimeCacheStats {
  totalItems: number
  hitCount: number
  missCount: number
  hitRate: number
  estimatedMemoryBytes: number
  byType: Record<CacheType, { size: number; maxSize: number }>
}

interface CacheConfig {
  maxSize: number
  strategy: CacheTrimStrategy
  estimatedBytesPerItem?: number
}

const DEFAULT_CONFIGS: Record<CacheType, CacheConfig> = {
  coverImages: { maxSize: 100, strategy: 'lru', estimatedBytesPerItem: 500 * 1024 },
  beatMaps: { maxSize: 50, strategy: 'lru', estimatedBytesPerItem: 100 * 1024 },
  lyrics: { maxSize: 200, strategy: 'lru', estimatedBytesPerItem: 20 * 1024 },
  searchResults: { maxSize: 50, strategy: 'lru', estimatedBytesPerItem: 50 * 1024 },
  playlistDetails: { maxSize: 30, strategy: 'lru', estimatedBytesPerItem: 30 * 1024 },
  colorExtraction: { maxSize: 200, strategy: 'lru', estimatedBytesPerItem: 1 * 1024 },
}

class RuntimeCacheManager {
  private caches: Map<CacheType, CacheManager<string, unknown>>
  private hitCount = 0
  private missCount = 0
  private trimInterval: ReturnType<typeof setInterval> | null = null
  private isBackground = false

  constructor() {
    this.caches = new Map()

    for (const [type, config] of Object.entries(DEFAULT_CONFIGS)) {
      this.caches.set(
        type as CacheType,
        new CacheManager({
          maxSize: config.maxSize,
          strategy: config.strategy,
        })
      )
    }
  }

  get<T = unknown>(type: CacheType, key: string): T | undefined {
    const cache = this.caches.get(type)
    if (!cache) return undefined

    const value = cache.get(key)
    if (value !== undefined) {
      this.hitCount++
    } else {
      this.missCount++
    }
    return value as T | undefined
  }

  set(type: CacheType, key: string, value: unknown): void {
    const cache = this.caches.get(type)
    if (!cache) return
    cache.set(key, value)
  }

  has(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type)
    return cache ? cache.has(key) : false
  }

  delete(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type)
    return cache ? cache.delete(key) : false
  }

  clear(type?: CacheType): void {
    if (type) {
      const cache = this.caches.get(type)
      if (cache) {
        cache.clear()
      }
    } else {
      this.caches.forEach((cache) => cache.clear())
    }
  }

  keys(type: CacheType): string[] {
    const cache = this.caches.get(type)
    return cache ? cache.keys() : []
  }

  size(type: CacheType): number {
    const cache = this.caches.get(type)
    return cache ? cache.size : 0
  }

  setMaxSize(type: CacheType, maxSize: number): void {
    const cache = this.caches.get(type)
    if (cache) {
      cache.setMaxSize(maxSize)
    }
  }

  setProtected(type: CacheType, key: string, protected_: boolean): void {
    const cache = this.caches.get(type)
    if (cache) {
      cache.setProtected(key, protected_)
    }
  }

  trim(type: CacheType, keep: number): number {
    const cache = this.caches.get(type)
    return cache ? cache.trim(keep) : 0
  }

  trimAll(aggressive: boolean = false): number {
    let totalDropped = 0
    this.caches.forEach((cache, type) => {
      const config = DEFAULT_CONFIGS[type]
      const keepRatio = aggressive ? 0.3 : 0.6
      const keepCount = Math.floor(config.maxSize * keepRatio)
      totalDropped += cache.trim(keepCount)
    })
    return totalDropped
  }

  getStats(): RuntimeCacheStats {
    const byType: Record<CacheType, { size: number; maxSize: number }> = {} as any
    let totalItems = 0
    let estimatedMemoryBytes = 0

    for (const type of Object.keys(DEFAULT_CONFIGS) as CacheType[]) {
      const cache = this.caches.get(type)
      const config = DEFAULT_CONFIGS[type]
      const size = cache ? cache.size : 0
      byType[type] = { size, maxSize: config.maxSize }
      totalItems += size
      estimatedMemoryBytes += size * (config.estimatedBytesPerItem || 0)
    }

    const totalRequests = this.hitCount + this.missCount
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0

    return {
      totalItems,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      estimatedMemoryBytes,
      byType,
    }
  }

  resetStats(): void {
    this.hitCount = 0
    this.missCount = 0
  }

  startPeriodicTrim(intervalMs: number = 60 * 1000): void {
    this.stopPeriodicTrim()
    this.trimInterval = setInterval(() => {
      this.trimAll(this.isBackground)
    }, intervalMs)
  }

  stopPeriodicTrim(): void {
    if (this.trimInterval) {
      clearInterval(this.trimInterval)
      this.trimInterval = null
    }
  }

  setBackgroundMode(isBackground: boolean): void {
    this.isBackground = isBackground
    if (isBackground) {
      this.trimAll(true)
    }
  }

  handleLowMemory(): number {
    return this.trimAll(true)
  }

  getOrCreate<T>(
    type: CacheType,
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    const existing = this.get<T>(type, key)
    if (existing !== undefined) {
      return Promise.resolve(existing)
    }

    return factory().then((value) => {
      this.set(type, key, value)
      return value
    })
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  dispose(): void {
    this.stopPeriodicTrim()
    this.clear()
  }
}

export const runtimeCache = new RuntimeCacheManager()

export default RuntimeCacheManager
