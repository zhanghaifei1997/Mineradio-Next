import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song } from '@/types'

export const playQueueStore = defineStore('playQueue', () => {
  const queue = ref<Song[]>([])
  const currentIndex = ref(-1)
  const shuffleOrder = ref<number[]>([])
  const shuffleIndex = ref(-1)

  const currentSong = computed(() => queue.value[currentIndex.value] || null)
  const hasNext = computed(() => currentIndex.value < queue.value.length - 1)
  const hasPrev = computed(() => currentIndex.value > 0)
  const isEmpty = computed(() => queue.value.length === 0)
  const total = computed(() => queue.value.length)

  function setQueue(songs: Song[], startIndex = 0): void {
    queue.value = [...songs]
    currentIndex.value = startIndex
    buildShuffleOrder()
    shuffleIndex.value = startIndex
  }

  function addToQueue(song: Song): void {
    queue.value.push(song)
    if (shuffleOrder.length > 0) {
      shuffleOrder.value.push(queue.value.length - 1)
    }
  }

  function removeFromQueue(index: number): void {
    if (index < 0 || index >= queue.value.length) return
    queue.value.splice(index, 1)
    if (currentIndex.value > index) {
      currentIndex.value--
    }
    buildShuffleOrder()
  }

  function clearQueue(): void {
    queue.value = []
    currentIndex.value = -1
    shuffleOrder.value = []
    shuffleIndex.value = -1
  }

  function getNext(): Song | null {
    if (queue.value.length === 0) return null
    const nextIdx = Math.min(currentIndex.value + 1, queue.value.length - 1)
    currentIndex.value = nextIdx
    return queue.value[nextIdx]
  }

  function getPrev(): Song | null {
    if (queue.value.length === 0) return null
    const prevIdx = Math.max(currentIndex.value - 1, 0)
    currentIndex.value = prevIdx
    return queue.value[prevIdx]
  }

  function setCurrentIndex(index: number): void {
    if (index >= 0 && index < queue.value.length) {
      currentIndex.value = index
    }
  }

  function buildShuffleOrder(): void {
    const indices = queue.value.map((_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    shuffleOrder.value = indices
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
  }

  return {
    queue,
    currentIndex,
    currentSong,
    hasNext,
    hasPrev,
    isEmpty,
    total,
    setQueue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    getNext,
    getPrev,
    setCurrentIndex,
    move,
  }
})
