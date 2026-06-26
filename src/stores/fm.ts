import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { providerManager } from '@/modules/providers'
import { usePlayerStore } from './player'
import { playQueueStore } from './playQueue'
import type { FMSong } from '@/types'

export const useFMStore = defineStore('fm', () => {
  const isFMMode = ref(false)
  const currentSong = ref<FMSong | null>(null)
  const queue = ref<FMSong[]>([])
  const history = ref<FMSong[]>([])
  const loading = ref(false)
  const activeProvider = ref('netease')

  const player = usePlayerStore()
  const playQueue = playQueueStore()

  let previousQueue: typeof playQueue.queue | null = null
  let previousIndex = 0
  let previousPlayMode: typeof player.playMode = 'sequence'

  const canPrev = computed(() => {
    return history.value.length > 0
  })

  async function loadMoreSongs(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const provider = providerManager.get(activeProvider.value) || providerManager.default
      const songs = await provider.getPersonalFM()
      queue.value.push(...songs)
    } catch (e) {
      console.error('Load FM songs error:', e)
    } finally {
      loading.value = false
    }
  }

  async function startFM(): Promise<void> {
    if (isFMMode.value) return

    previousQueue = [...playQueue.queue]
    previousIndex = playQueue.currentIndex
    previousPlayMode = player.playMode

    isFMMode.value = true
    queue.value = []
    history.value = []

    await loadMoreSongs()

    if (queue.value.length > 0) {
      const song = queue.value.shift()!
      currentSong.value = song
      playQueue.setQueue([song], 0)
      player.play(song)
    }
  }

  function stopFM(): void {
    if (!isFMMode.value) return

    isFMMode.value = false
    currentSong.value = null

    if (previousQueue && previousQueue.length > 0) {
      playQueue.queue = previousQueue
      playQueue.currentIndex = previousIndex
    }

    previousQueue = null
  }

  async function nextSong(): Promise<void> {
    if (!isFMMode.value) return

    if (currentSong.value) {
      history.value.unshift(currentSong.value)
      if (history.value.length > 50) {
        history.value.pop()
      }
    }

    if (queue.value.length < 3) {
      loadMoreSongs()
    }

    if (queue.value.length > 0) {
      const song = queue.value.shift()!
      currentSong.value = song
      playQueue.setQueue([song], 0)
      player.play(song)
    } else {
      await loadMoreSongs()
      if (queue.value.length > 0) {
        const song = queue.value.shift()!
        currentSong.value = song
        playQueue.setQueue([song], 0)
        player.play(song)
      }
    }
  }

  function prevSong(): void {
    if (!isFMMode.value || history.value.length === 0) return

    if (currentSong.value) {
      queue.value.unshift(currentSong.value)
    }

    const song = history.value.shift()!
    currentSong.value = song
    playQueue.setQueue([song], 0)
    player.play(song)
  }

  async function likeCurrentSong(liked: boolean): Promise<void> {
    if (!currentSong.value) return

    try {
      const provider = providerManager.get(activeProvider.value) || providerManager.default
      await provider.likeFMSong(currentSong.value.id, liked)
      currentSong.value.liked = liked
    } catch (e) {
      console.error('Like FM song error:', e)
    }
  }

  function skipCurrentSong(): void {
    nextSong()
  }

  watch(
    () => player.status,
    (status) => {
      if (isFMMode.value && status === 'idle' && currentSong.value) {
        nextSong()
      }
    }
  )

  return {
    isFMMode,
    currentSong,
    queue,
    history,
    loading,
    canPrev,
    activeProvider,
    startFM,
    stopFM,
    nextSong,
    prevSong,
    likeCurrentSong,
    skipCurrentSong,
    loadMoreSongs,
  }
})
