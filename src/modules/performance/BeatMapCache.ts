import { CacheManager } from './CacheManager'
import type { BeatMapRecord } from './types'

export class BeatMapCache {
  private beatMaps: CacheManager<string, BeatMapRecord>
  private djBeatMaps: CacheManager<string, BeatMapRecord>

  constructor(options: { maxBeatMaps?: number; maxDjBeatMaps?: number } = {}) {
    this.beatMaps = new CacheManager<string, BeatMapRecord>({
      maxSize: options.maxBeatMaps || 50,
      strategy: 'lru',
    })
    this.djBeatMaps = new CacheManager<string, BeatMapRecord>({
      maxSize: options.maxDjBeatMaps || 20,
      strategy: 'lru',
    })
  }

  get(key: string): BeatMapRecord | undefined {
    return this.beatMaps.get(key)
  }

  set(key: string, record: Omit<BeatMapRecord, 'timestamp'>): void {
    this.beatMaps.set(key, {
      ...record,
      timestamp: Date.now(),
    })
  }

  has(key: string): boolean {
    return this.beatMaps.has(key)
  }

  delete(key: string): boolean {
    return this.beatMaps.delete(key)
  }

  getDj(key: string): BeatMapRecord | undefined {
    return this.djBeatMaps.get(key)
  }

  setDj(key: string, record: Omit<BeatMapRecord, 'timestamp'>): void {
    this.djBeatMaps.set(key, {
      ...record,
      timestamp: Date.now(),
    })
  }

  hasDj(key: string): boolean {
    return this.djBeatMaps.has(key)
  }

  deleteDj(key: string): boolean {
    return this.djBeatMaps.delete(key)
  }

  trim(keep: number, protectedKeys?: Set<string>): number {
    return this.beatMaps.trim(keep, protectedKeys)
  }

  trimDj(keep: number, protectedKeys?: Set<string>): number {
    return this.djBeatMaps.trim(keep, protectedKeys)
  }

  setMaxBeatMaps(size: number): void {
    this.beatMaps.setMaxSize(size)
  }

  setMaxDjBeatMaps(size: number): void {
    this.djBeatMaps.setMaxSize(size)
  }

  setProtected(key: string, protected_: boolean, isDj = false): void {
    if (isDj) {
      this.djBeatMaps.setProtected(key, protected_)
    } else {
      this.beatMaps.setProtected(key, protected_)
    }
  }

  getStats(): {
    beatMaps: { size: number; maxSize: number }
    djBeatMaps: { size: number; maxSize: number }
  } {
    const beatStats = this.beatMaps.getStats()
    const djStats = this.djBeatMaps.getStats()
    return {
      beatMaps: { size: beatStats.size, maxSize: beatStats.maxSize },
      djBeatMaps: { size: djStats.size, maxSize: djStats.maxSize },
    }
  }

  clear(): void {
    this.beatMaps.clear()
    this.djBeatMaps.clear()
  }

  static songKey(songId: string, source: string = 'default'): string {
    return `${source}:${songId}`
  }
}
