import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song, PlayerStatus } from '@/types'
import { providerManager } from '@/modules/providers'
import { playQueueStore } from './playQueue'

export const usePlayerStore = defineStore('player', () => {
  const audio = ref<HTMLAudioElement | null>(null)
  const currentSong = ref<Song | null>(null)
  const status = ref<PlayerStatus>('idle')
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.7)
  const muted = ref(false)
  const speed = ref(1)
  const playMode = ref<'sequence' | 'loop' | 'single' | 'shuffle'>('sequence')

  const isPlaying = computed(() => status.value === 'playing')
  const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0)

  function initAudio() {
    if (audio.value) return
    audio.value = new Audio()
    audio.value.volume = volume.value
    audio.value.playbackRate = speed.value

    audio.value.addEventListener('timeupdate', () => {
      currentTime.value = audio.value!.currentTime
    })

    audio.value.addEventListener('loadedmetadata', () => {
      duration.value = audio.value!.duration
    })

    audio.value.addEventListener('ended', () => {
      handleSongEnd()
    })

    audio.value.addEventListener('play', () => {
      status.value = 'playing'
    })

    audio.value.addEventListener('pause', () => {
      status.value = 'paused'
    })

    audio.value.addEventListener('error', () => {
      status.value = 'error'
      console.error('Audio play error')
    })
  }

  async function play(song: Song): Promise<void> {
    initAudio()
    if (!audio.value) return

    currentSong.value = song
    status.value = 'loading'
    currentTime.value = 0

    try {
      const provider = providerManager.get(song.source) || providerManager.default
      const result = await provider.getSongUrl(song.id)
      if (!result?.url) {
        status.value = 'error'
        return
      }

      audio.value.src = result.url
      await audio.value.play()
    } catch (e) {
      console.error('Play failed:', e)
      status.value = 'error'
    }
  }

  function togglePlay(): void {
    if (!audio.value || !currentSong.value) return
    if (status.value === 'playing') {
      audio.value.pause()
    } else if (status.value === 'paused') {
      audio.value.play()
    }
  }

  function pause(): void {
    if (audio.value && status.value === 'playing') {
      audio.value.pause()
    }
  }

  function resume(): void {
    if (audio.value && status.value === 'paused') {
      audio.value.play()
    }
  }

  function seek(time: number): void {
    if (audio.value) {
      audio.value.currentTime = Math.max(0, Math.min(time, duration.value))
    }
  }

  function setVolume(v: number): void {
    const newVolume = Math.max(0, Math.min(1, v))
    volume.value = newVolume
    if (audio.value) {
      audio.value.volume = newVolume
    }
    if (newVolume > 0 && muted.value) {
      muted.value = false
    }
  }

  function toggleMute(): void {
    muted.value = !muted.value
    if (audio.value) {
      audio.value.muted = muted.value
    }
  }

  function setSpeed(s: number): void {
    speed.value = Math.max(0.5, Math.min(2, s))
    if (audio.value) {
      audio.value.playbackRate = speed.value
    }
  }

  function next(): void {
    const queue = playQueueStore()
    const nextSong = queue.getNext()
    if (nextSong) {
      play(nextSong)
    }
  }

  function prev(): void {
    const queue = playQueueStore()
    const prevSong = queue.getPrev()
    if (prevSong) {
      play(prevSong)
    }
  }

  function handleSongEnd(): void {
    if (playMode.value === 'single') {
      if (audio.value) {
        audio.value.currentTime = 0
        audio.value.play()
      }
      return
    }
    next()
  }

  function setPlayMode(mode: typeof playMode.value): void {
    playMode.value = mode
  }

  function cyclePlayMode(): void {
    const modes: typeof playMode.value[] = ['sequence', 'loop', 'single', 'shuffle']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length]
  }

  return {
    currentSong,
    status,
    currentTime,
    duration,
    volume,
    muted,
    speed,
    playMode,
    isPlaying,
    progress,
    initAudio,
    play,
    togglePlay,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    setSpeed,
    next,
    prev,
    setPlayMode,
    cyclePlayMode,
  }
})
