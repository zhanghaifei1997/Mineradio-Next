import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'mineradio_custom_covers'
const MAX_COVERS = 50

interface CoverCacheItem {
  id: string
  dataUrl: string
  timestamp: number
}

function loadCovers(): Map<string, CoverCacheItem> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr: CoverCacheItem[] = JSON.parse(raw)
      return new Map(arr.map((item) => [item.id, item]))
    }
  } catch (e) {
    console.warn('Failed to load custom covers:', e)
  }
  return new Map()
}

function saveCovers(map: Map<string, CoverCacheItem>) {
  try {
    const arr = Array.from(map.values())
    arr.sort((a, b) => b.timestamp - a.timestamp)
    const limited = arr.slice(0, MAX_COVERS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited))
  } catch (e) {
    console.warn('Failed to save custom covers:', e)
  }
}

export const useCustomCoverStore = defineStore('customCover', () => {
  const covers = ref<Map<string, CoverCacheItem>>(loadCovers())

  function getCustomCover(id: string): string | null {
    const item = covers.value.get(id)
    return item?.dataUrl || null
  }

  function setCustomCover(id: string, dataUrl: string): void {
    const item: CoverCacheItem = {
      id,
      dataUrl,
      timestamp: Date.now(),
    }
    covers.value.set(id, item)
    saveCovers(covers.value)
  }

  function removeCustomCover(id: string): void {
    covers.value.delete(id)
    saveCovers(covers.value)
  }

  function hasCustomCover(id: string): boolean {
    return covers.value.has(id)
  }

  function clearAll(): void {
    covers.value.clear()
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (_) {}
  }

  function getCount(): number {
    return covers.value.size
  }

  function getMaxCount(): number {
    return MAX_COVERS
  }

  return {
    getCustomCover,
    setCustomCover,
    removeCustomCover,
    hasCustomCover,
    clearAll,
    getCount,
    getMaxCount,
  }
})
