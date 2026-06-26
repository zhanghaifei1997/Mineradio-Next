import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song } from '@/types'

export type PlayMode = 'sequence' | 'loop' | 'single' | 'shuffle'

export const playQueueStore = defineStore('playQueue', () => {
  const queue = ref<Song[]>([])
  const currentIndex = ref(-1)
  const shuffleOrder = ref<number[]>([])
  const shuffleIndex = ref(-1)
  const history = ref<Song[]>([])
  const maxHistorySize = 50

  const currentSong = computed(() => queue.value[currentIndex.value] || null)
  const hasNext = computed(() => {
    if (queue.value.length === 0) return false
    if (currentIndex.value < queue.value.length - 1) return true
    return false
  })
  const hasPrev = computed(() => {
    if (queue.value.length === 0) return false
    if (currentIndex.value > 0) return true
    return history.value.length > 0
  })
  const isEmpty = computed(() => queue.value.length === 0)
  const total = computed(() => queue.value.length)

  function setQueue(songs: Song[], startIndex = 0): void {
    queue.value = [...songs]
    currentIndex.value = startIndex
    buildShuffleOrder()
    shuffleIndex.value = startIndex
    history.value = []
  }

  function addToQueue(song: Song): void {
    queue.value.push(song)
    if (shuffleOrder.value.length > 0) {
      shuffleOrder.value.push(queue.value.length - 1)
    }
  }

  function addListToQueue(songs: Song[]): void {
    const startIndex = queue.value.length
    queue.value.push(...songs)
    if (shuffleOrder.value.length > 0) {
      for (let i = 0; i < songs.length; i++) {
        shuffleOrder.value.push(startIndex + i)
      }
    }
  }

  function insertNext(song: Song): void {
    const insertIndex = currentIndex.value + 1
    queue.value.splice(insertIndex, 0, song)
    if (shuffleOrder.value.length > 0) {
      shuffleOrder.value = shuffleOrder.value.map((idx) =>
        idx >= insertIndex ? idx + 1 : idx
      )
      shuffleOrder.value.splice(insertIndex, 0, insertIndex)
    }
  }

  function removeFromQueue(index: number): void {
    if (index < 0 || index >= queue.value.length) return
    const removedSong = queue.value[index]
    queue.value.splice(index, 1)
    if (currentIndex.value > index) {
      currentIndex.value--
    } else if (currentIndex.value === index) {
      currentIndex.value = Math.min(currentIndex.value, queue.value.length - 1)
    }
    buildShuffleOrder()
    if (shuffleIndex.value > index) {
      shuffleIndex.value--
    }
  }

  function clearQueue(): void {
    queue.value = []
    currentIndex.value = -1
    shuffleOrder.value = []
    shuffleIndex.value = -1
    history.value = []
  }

  function getNext(mode: PlayMode = 'sequence'): Song | null {
    if (queue.value.length === 0) return null

    if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
      addToHistory(queue.value[currentIndex.value])
    }

    if (mode === 'shuffle') {
      return getNextShuffle()
    }

    if (mode === 'loop') {
      const nextIdx = (currentIndex.value + 1) % queue.value.length
      currentIndex.value = nextIdx
      return queue.value[nextIdx]
    }

    const nextIdx = Math.min(currentIndex.value + 1, queue.value.length - 1)
    if (nextIdx === currentIndex.value && mode === 'sequence') {
      return null
    }
    currentIndex.value = nextIdx
    return queue.value[nextIdx]
  }

  function getNextShuffle(): Song | null {
    if (queue.value.length === 0) return null

    if (shuffleOrder.value.length === 0) {
      buildShuffleOrder()
    }

    shuffleIndex.value = (shuffleIndex.value + 1) % shuffleOrder.value.length
    const actualIndex = shuffleOrder.value[shuffleIndex.value]
    currentIndex.value = actualIndex
    return queue.value[actualIndex]
  }

  function getPrev(mode: PlayMode = 'sequence'): Song | null {
    if (queue.value.length === 0) return null

    if (mode === 'shuffle') {
      return getPrevShuffle()
    }

    if (mode === 'loop') {
      const prevIdx = (currentIndex.value - 1 + queue.value.length) % queue.value.length
      currentIndex.value = prevIdx
      return queue.value[prevIdx]
    }

    const prevIdx = Math.max(currentIndex.value - 1, 0)
    if (prevIdx === currentIndex.value) {
      return getFromHistory()
    }
    currentIndex.value = prevIdx
    return queue.value[prevIdx]
  }

  function getPrevShuffle(): Song | null {
    if (queue.value.length === 0) return null

    if (shuffleOrder.value.length === 0) {
      buildShuffleOrder()
    }

    shuffleIndex.value = (shuffleIndex.value - 1 + shuffleOrder.value.length) % shuffleOrder.value.length
    const actualIndex = shuffleOrder.value[shuffleIndex.value]
    currentIndex.value = actualIndex
    return queue.value[actualIndex]
  }

  function setCurrentIndex(index: number): void {
    if (index >= 0 && index < queue.value.length) {
      if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
        addToHistory(queue.value[currentIndex.value])
      }
      currentIndex.value = index

      if (shuffleOrder.value.length > 0) {
        const shufflePos = shuffleOrder.value.indexOf(index)
        if (shufflePos >= 0) {
          shuffleIndex.value = shufflePos
        }
      }
    }
  }

  function playAt(index: number): Song | null {
    if (index < 0 || index >= queue.value.length) return null
    setCurrentIndex(index)
    return queue.value[index]
  }

  function buildShuffleOrder(): void {
    const indices = queue.value.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    shuffleOrder.value = indices
    shuffleIndex.value = -1
  }

  function reshuffle(): void {
    const currentSongId = currentSong.value?.id
    buildShuffleOrder()
    if (currentSongId) {
      const currentIdx = queue.value.findIndex((s) => s.id === currentSongId)
      if (currentIdx >= 0) {
        const shufflePos = shuffleOrder.value.indexOf(currentIdx)
        if (shufflePos >= 0) {
          ;[shuffleOrder.value[0], shuffleOrder.value[shufflePos]] = [
            shuffleOrder.value[shufflePos],
            shuffleOrder.value[0],
          ]
          shuffleIndex.value = 0
        }
      }
    }
  }

  function move(from: number, to: number): void {
    if (from < 0 || from >= queue.value.length || to < 0 || to >= queue.value.length) return
    const [item] = queue.value.splice(from, 1)
    queue.value.splice(to, 0, item)
    if (currentIndex.value === from) {
      currentIndex.value = to
    } else if (from < currentIndex.value && to >= currentIndex.value) {
      currentIndex.value--
    } else if (from > currentIndex.value && to <= currentIndex.value) {
      currentIndex.value++
    }
    buildShuffleOrder()
  }

  function addToHistory(song: Song): void {
    history.value.unshift(song)
    if (history.value.length > maxHistorySize) {
      history.value.pop()
    }
  }

  function getFromHistory(): Song | null {
    if (history.value.length === 0) return null
    return history.value[0]
  }

  function clearHistory(): void {
    history.value = []
  }

  function indexOf(songId: string): number {
    return queue.value.findIndex((s) => s.id === songId)
  }

  function contains(songId: string): boolean {
    return indexOf(songId) >= 0
  }

  return {
    queue,
    currentIndex,
    currentSong,
    hasNext,
    hasPrev,
    isEmpty,
    total,
    history,
    setQueue,
    addToQueue,
    addListToQueue,
    insertNext,
    removeFromQueue,
    clearQueue,
    getNext,
    getPrev,
    setCurrentIndex,
    playAt,
    buildShuffleOrder,
    reshuffle,
    move,
    clearHistory,
    indexOf,
    contains,
  }
})
