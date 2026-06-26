import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song } from '@/types'

const STORAGE_KEY = 'mineradio-play-history'
const MAX_HISTORY = 100

export interface HistoryEntry {
  song: Song
  playedAt: number
  playDuration: number
}

function loadFromStorage(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (_) {}
  return []
}

function saveToStorage(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch (_) {}
}

export const useHistoryStore = defineStore('history', () => {
  const history = ref<HistoryEntry[]>(loadFromStorage())
  const currentPlayStartTime = ref<number>(0)

  const recentSongs = computed(() => {
    return history.value.map(entry => entry.song)
  })

  const totalPlayCount = computed(() => history.value.length)

  function addToHistory(song: Song): void {
    const now = Date.now()

    const existingIndex = history.value.findIndex(
      entry => entry.song.id === song.id && entry.song.source === song.source
    )

    if (existingIndex >= 0) {
      history.value.splice(existingIndex, 1)
    }

    const playDuration = currentPlayStartTime.value > 0
      ? (now - currentPlayStartTime.value) / 1000
      : 0

    history.value.unshift({
      song,
      playedAt: now,
      playDuration,
    })

    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(0, MAX_HISTORY)
    }

    saveToStorage(history.value)
    currentPlayStartTime.value = now
  }

  function removeFromHistory(songId: string, source: string): void {
    const index = history.value.findIndex(
      entry => entry.song.id === songId && entry.song.source === source
    )
    if (index >= 0) {
      history.value.splice(index, 1)
      saveToStorage(history.value)
    }
  }

  function clearHistory(): void {
    history.value = []
    saveToStorage(history.value)
  }

  function getSongPlayCount(songId: string, source: string): number {
    return history.value.filter(
      entry => entry.song.id === songId && entry.song.source === source
    ).length
  }

  function getRecentSongs(limit: number = 20): Song[] {
    return history.value.slice(0, limit).map(entry => entry.song)
  }

  function getHistoryByDate(date: Date): HistoryEntry[] {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000
    return history.value.filter(
      entry => entry.playedAt >= startOfDay && entry.playedAt < endOfDay
    )
  }

  function formatPlayedAt(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60 * 1000) {
      return '刚刚'
    }
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))} 分钟前`
    }
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`
    }

    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }

  return {
    history,
    recentSongs,
    totalPlayCount,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getSongPlayCount,
    getRecentSongs,
    getHistoryByDate,
    formatPlayedAt,
  }
})
