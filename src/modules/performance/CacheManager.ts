import type { CacheOptions, CacheTrimStrategy } from './types'

export class CacheManager<K extends string = string, V = unknown> {
  private cache: Map<K, V>
  private accessOrder: K[]
  private accessCount: Map<K, number>
  private maxSize: number
  private strategy: CacheTrimStrategy
  private protectedKeys: Set<K>

  constructor(options: CacheOptions) {
    this.cache = new Map()
    this.accessOrder = []
    this.accessCount = new Map()
    this.maxSize = options.maxSize
    this.strategy = options.strategy || 'lru'
    this.protectedKeys = new Set<K>(options.protectedKeys as Set<K> || new Set<K>())
  }

  get size(): number {
    return this.cache.size
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      this.touch(key)
    }
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.set(key, value)
      this.touch(key)
      return
    }

    if (this.cache.size >= this.maxSize) {
      this.evict(1)
    }

    this.cache.set(key, value)
    this.accessOrder.push(key)
    this.accessCount.set(key, 1)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    if (this.cache.delete(key)) {
      const idx = this.accessOrder.indexOf(key)
      if (idx !== -1) this.accessOrder.splice(idx, 1)
      this.accessCount.delete(key)
      return true
    }
    return false
  }

  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    this.accessCount.clear()
  }

  keys(): K[] {
    return Array.from(this.cache.keys())
  }

  values(): V[] {
    return Array.from(this.cache.values())
  }

  entries(): [K, V][] {
    return Array.from(this.cache.entries())
  }

  forEach(callback: (value: V, key: K) => void): void {
    this.cache.forEach((value, key) => callback(value, key))
  }

  setProtected(key: K, protected_: boolean): void {
    if (protected_) {
      this.protectedKeys.add(key)
    } else {
      this.protectedKeys.delete(key)
    }
  }

  isProtected(key: K): boolean {
    return this.protectedKeys.has(key)
  }

  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize
    if (this.cache.size > maxSize) {
      this.evict(this.cache.size - maxSize)
    }
  }

  trim(keep: number, protectedKeys?: Set<K>): number {
    if (this.cache.size <= keep) return 0

    const drop = this.cache.size - keep
    let dropped = 0
    const keysToEvict = this.getEvictionCandidates(drop, protectedKeys)

    for (const key of keysToEvict) {
      if (this.delete(key)) {
        dropped++
      }
    }

    return dropped
  }

  private touch(key: K): void {
    if (this.strategy === 'lru') {
      const idx = this.accessOrder.indexOf(key)
      if (idx !== -1) {
        this.accessOrder.splice(idx, 1)
        this.accessOrder.push(key)
      }
    } else if (this.strategy === 'lfu') {
      const count = this.accessCount.get(key) || 0
      this.accessCount.set(key, count + 1)
    }
  }

  private evict(count: number): number {
    let evicted = 0
    const keysToEvict = this.getEvictionCandidates(count)

    for (const key of keysToEvict) {
      if (this.delete(key)) {
        evicted++
      }
    }

    return evicted
  }

  private getEvictionCandidates(count: number, extraProtected?: Set<K>): K[] {
    const candidates: K[] = []
    const protectedKeys = new Set([...this.protectedKeys, ...(extraProtected || [])])

    if (this.strategy === 'fifo' || this.strategy === 'lru') {
      for (const key of this.accessOrder) {
        if (candidates.length >= count) break
        if (!protectedKeys.has(key)) {
          candidates.push(key)
        }
      }
    } else if (this.strategy === 'lfu') {
      const counts: [K, number][] = []
      for (const [key, count] of this.accessCount) {
        if (!protectedKeys.has(key)) {
          counts.push([key, count])
        }
      }
      counts.sort((a, b) => a[1] - b[1])
      for (const [key] of counts) {
        if (candidates.length >= count) break
        candidates.push(key)
      }
    }

    return candidates
  }

  getStats(): { size: number; maxSize: number; protectedCount: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      protectedCount: this.protectedKeys.size,
    }
  }
}

export function trimObjectCache<T>(
  cache: Record<string, T>,
  keep: number,
  protectedKeys?: Record<string, boolean>,
  skipRecord?: (rec: T, key: string) => boolean
): number {
  const keys = Object.keys(cache)
  if (!cache || keys.length <= keep) return 0

  let drop = keys.length - keep
  let dropped = 0

  for (let i = 0; i < keys.length && drop > 0; i++) {
    const key = keys[i]
    if (protectedKeys && protectedKeys[key]) continue
    const rec = cache[key]
    if (skipRecord && skipRecord(rec, key)) continue
    delete cache[key]
    drop--
    dropped++
  }

  return dropped
}
