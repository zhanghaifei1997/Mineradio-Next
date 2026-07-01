import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song, PlayMode, SongQuality } from '@/types'

export const usePlayerStore = defineStore('player', () => {
  // ── 播放列表和队列 ──
  const playlist = ref<Song[]>([])
  const playQueue = ref<Song[]>([])
  const currentIdx = ref<number>(-1)

  // ── 播放状态 ──
  const playing = ref(false)
  const currentTime = ref(0) // 秒
  const duration = ref(0) // 秒
  const volume = ref(0.8)
  const muted = ref(false)
  const playMode = ref<PlayMode>('loop')
  const quality = ref<SongQuality>('standard')
  const playToggleBusy = ref(false)

  // ── 计算属性 ──
  const currentSong = computed(() => {
    if (currentIdx.value >= 0 && currentIdx.value < playlist.value.length) {
      return playlist.value[currentIdx.value]
    }
    return null
  })

  const progress = computed(() => {
    if (duration.value <= 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  const hasNext = computed(() => {
    if (playMode.value === 'single') return false
    if (playQueue.value.length > 0) return true
    if (playMode.value === 'loop') return playlist.value.length > 1
    return currentIdx.value < playlist.value.length - 1
  })

  const hasPrev = computed(() => {
    return currentIdx.value > 0 || playMode.value === 'loop'
  })

  // ── 操作方法 ──
  function setPlaylist(songs: Song[]) {
    playlist.value = songs
  }

  function addToQueue(song: Song) {
    playQueue.value.push(song)
  }

  function removeFromQueue(index: number) {
    playQueue.value.splice(index, 1)
  }

  function clearQueue() {
    playQueue.value = []
  }

  function setCurrentIdx(idx: number) {
    currentIdx.value = idx
  }

  function setPlaying(val: boolean) {
    playing.value = val
  }

  function setCurrentTime(t: number) {
    currentTime.value = t
  }

  function setDuration(d: number) {
    duration.value = d
  }

  function setVolume(v: number) {
    volume.value = Math.max(0, Math.min(1, v))
  }

  function setMuted(val: boolean) {
    muted.value = val
  }

  function setPlayMode(mode: PlayMode) {
    playMode.value = mode
  }

  function cyclePlayMode(): PlayMode {
    const modes: PlayMode[] = ['loop', 'shuffle', 'single']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length] ?? 'loop'
    return playMode.value
  }

  function resetPlayback() {
    currentTime.value = 0
    duration.value = 0
    playing.value = false
  }

  return {
    playlist, playQueue, currentIdx, playing, currentTime, duration,
    volume, muted, playMode, quality, playToggleBusy,
    currentSong, progress, hasNext, hasPrev,
    setPlaylist, addToQueue, removeFromQueue, clearQueue,
    setCurrentIdx, setPlaying, setCurrentTime, setDuration,
    setVolume, setMuted, setPlayMode, cyclePlayMode, resetPlayback,
  }
})
