import { CacheManager } from './CacheManager'
import type { CoverCacheRecord, DepthMapCacheRecord } from './types'

export class CoverCache {
  private coverCache: CacheManager<string, CoverCacheRecord>
  private depthCache: Map<string, DepthMapCacheRecord>
  private depthCacheKeys: string[]
  private maxDepthCacheSize: number

  constructor(options: { maxCoverSize?: number; maxDepthSize?: number } = {}) {
    this.coverCache = new CacheManager<string, CoverCacheRecord>({
      maxSize: options.maxCoverSize || 200,
      strategy: 'lru',
    })
    this.depthCache = new Map()
    this.depthCacheKeys = []
    this.maxDepthCacheSize = options.maxDepthSize || 20
  }

  getCover(url: string): CoverCacheRecord | undefined {
    return this.coverCache.get(url)
  }

  setCover(url: string, record: Omit<CoverCacheRecord, 'timestamp'>): void {
    this.coverCache.set(url, {
      ...record,
      timestamp: Date.now(),
    })
  }

  hasCover(url: string): boolean {
    return this.coverCache.has(url)
  }

  deleteCover(url: string): boolean {
    return this.coverCache.delete(url)
  }

  getDepthMap(id: string): DepthMapCacheRecord | undefined {
    const record = this.depthCache.get(id)
    if (record) {
      const idx = this.depthCacheKeys.indexOf(id)
      if (idx !== -1) {
        this.depthCacheKeys.splice(idx, 1)
        this.depthCacheKeys.push(id)
      }
    }
    return record
  }

  setDepthMap(id: string, data: Omit<DepthMapCacheRecord, 'id' | 'timestamp'>): void {
    if (this.depthCache.has(id)) {
      const idx = this.depthCacheKeys.indexOf(id)
      if (idx !== -1) {
        this.depthCacheKeys.splice(idx, 1)
      }
    }

    while (this.depthCacheKeys.length >= this.maxDepthCacheSize) {
      const oldestKey = this.depthCacheKeys.shift()
      if (oldestKey) {
        this.depthCache.delete(oldestKey)
      }
    }

    this.depthCache.set(id, {
      id,
      ...data,
      timestamp: Date.now(),
    })
    this.depthCacheKeys.push(id)
  }

  hasDepthMap(id: string): boolean {
    return this.depthCache.has(id)
  }

  deleteDepthMap(id: string): boolean {
    const idx = this.depthCacheKeys.indexOf(id)
    if (idx !== -1) {
      this.depthCacheKeys.splice(idx, 1)
    }
    return this.depthCache.delete(id)
  }

  trimDepthCache(keep: number, protectedKeys?: Set<string>): number {
    if (this.depthCacheKeys.length <= keep) {
      return 0
    }

    const keepSet = new Set<string>()
    const recentKeys = this.depthCacheKeys.slice(-keep)
    recentKeys.forEach((key) => keepSet.add(key))

    if (protectedKeys) {
      protectedKeys.forEach((key) => keepSet.add(key))
    }

    let dropped = 0
    const keysToRemove: string[] = []
    this.depthCacheKeys.forEach((key) => {
      if (!keepSet.has(key)) {
        keysToRemove.push(key)
      }
    })

    keysToRemove.forEach((key) => {
      this.depthCache.delete(key)
      dropped++
    })

    this.depthCacheKeys = this.depthCacheKeys.filter((key) => this.depthCache.has(key))
    return dropped
  }

  trimCoverCache(keep: number, protectedKeys?: Set<string>): number {
    return this.coverCache.trim(keep, protectedKeys)
  }

  setMaxCoverSize(size: number): void {
    this.coverCache.setMaxSize(size)
  }

  setMaxDepthSize(size: number): void {
    this.maxDepthCacheSize = size
    while (this.depthCacheKeys.length > size) {
      const oldestKey = this.depthCacheKeys.shift()
      if (oldestKey) {
        this.depthCache.delete(oldestKey)
      }
    }
  }

  setProtectedCover(url: string, protected_: boolean): void {
    this.coverCache.setProtected(url, protected_)
  }

  getStats(): {
    covers: { size: number; maxSize: number }
    depthMaps: { size: number; maxSize: number }
  } {
    return {
      covers: {
        size: this.coverCache.size,
        maxSize: 200,
      },
      depthMaps: {
        size: this.depthCache.size,
        maxSize: this.maxDepthCacheSize,
      },
    }
  }

  clear(): void {
    this.coverCache.clear()
    this.depthCache.clear()
    this.depthCacheKeys = []
  }

  static makeDepthCacheId(src: string, texWidth: number, texHeight: number): string {
    return `${src}|tex=${texWidth}x${texHeight}`
  }
}
