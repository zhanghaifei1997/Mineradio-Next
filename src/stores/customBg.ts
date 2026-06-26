import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type BackgroundVideoMode = 'off' | 'video-only' | 'mix'

const STORAGE_KEY = 'mineradio_custom_bg'

interface CustomBgSettings {
  mode: BackgroundVideoMode
  videoSrc: string | null
  videoName: string | null
  opacity: number
  muted: boolean
  loop: boolean
  autoPlay: boolean
  playbackRate: number
}

const defaultSettings: CustomBgSettings = {
  mode: 'off',
  videoSrc: null,
  videoName: null,
  opacity: 1,
  muted: true,
  loop: true,
  autoPlay: true,
  playbackRate: 1,
}

function loadSettings(): CustomBgSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ...defaultSettings,
        ...parsed,
      }
    }
  } catch (e) {
    console.warn('Failed to load custom bg settings:', e)
  }
  return { ...defaultSettings }
}

function saveSettings(settings: CustomBgSettings): void {
  try {
    const toSave = {
      mode: settings.mode,
      videoName: settings.videoName,
      opacity: settings.opacity,
      muted: settings.muted,
      loop: settings.loop,
      autoPlay: settings.autoPlay,
      playbackRate: settings.playbackRate,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.warn('Failed to save custom bg settings:', e)
  }
}

export const useCustomBgStore = defineStore('customBg', () => {
  const settings = ref<CustomBgSettings>(loadSettings())
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)

  const videoElement = ref<HTMLVideoElement | null>(null)

  const isVideoActive = computed(() => settings.value.mode !== 'off' && settings.value.videoSrc)

  const canvasOpacity = computed(() => {
    if (settings.value.mode === 'video-only') return 0
    if (settings.value.mode === 'mix') return 0.5
    return 1
  })

  function setMode(mode: BackgroundVideoMode): void {
    settings.value.mode = mode
    saveSettings(settings.value)
    updateVideoPlayback()
  }

  function setVideoSrc(src: string, name?: string): void {
    settings.value.videoSrc = src
    settings.value.videoName = name || null
    if (src && settings.value.mode === 'off') {
      settings.value.mode = 'mix'
    }
    saveSettings(settings.value)
  }

  function setOpacity(opacity: number): void {
    settings.value.opacity = Math.max(0, Math.min(1, opacity))
    saveSettings(settings.value)
  }

  function setMuted(muted: boolean): void {
    settings.value.muted = muted
    saveSettings(settings.value)
    if (videoElement.value) {
      videoElement.value.muted = muted
    }
  }

  function setLoop(loop: boolean): void {
    settings.value.loop = loop
    saveSettings(settings.value)
    if (videoElement.value) {
      videoElement.value.loop = loop
    }
  }

  function setPlaybackRate(rate: number): void {
    settings.value.playbackRate = Math.max(0.25, Math.min(2, rate))
    saveSettings(settings.value)
    if (videoElement.value) {
      videoElement.value.playbackRate = settings.value.playbackRate
    }
  }

  function setVideoElement(el: HTMLVideoElement | null): void {
    videoElement.value = el
    if (el) {
      el.muted = settings.value.muted
      el.loop = settings.value.loop
      el.playbackRate = settings.value.playbackRate
      updateVideoPlayback()
    }
  }

  function updateVideoPlayback(): void {
    const el = videoElement.value
    if (!el || !settings.value.videoSrc) return

    if (settings.value.mode !== 'off') {
      if (settings.value.autoPlay) {
        el.play().catch(() => {})
      }
    } else {
      el.pause()
    }
  }

  function play(): void {
    if (videoElement.value && settings.value.videoSrc) {
      videoElement.value.play().catch(() => {})
    }
  }

  function pause(): void {
    if (videoElement.value) {
      videoElement.value.pause()
    }
  }

  function togglePlay(): void {
    if (videoElement.value) {
      if (videoElement.value.paused) {
        play()
      } else {
        pause()
      }
    }
  }

  function clearVideo(): void {
    settings.value.videoSrc = null
    settings.value.videoName = null
    settings.value.mode = 'off'
    saveSettings(settings.value)
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.src = ''
    }
  }

  function handleFileSelect(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('video/')) {
        reject(new Error('Invalid file type'))
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          setVideoSrc(result, file.name)
          resolve()
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  function onTimeUpdate(): void {
    if (videoElement.value) {
      currentTime.value = videoElement.value.currentTime
    }
  }

  function onLoadedMetadata(): void {
    if (videoElement.value) {
      duration.value = videoElement.value.duration
    }
  }

  function onPlay(): void {
    isPlaying.value = true
  }

  function onPause(): void {
    isPlaying.value = false
  }

  watch(
    () => settings.value.videoSrc,
    (src) => {
      if (videoElement.value && src) {
        videoElement.value.src = src
        videoElement.value.load()
      }
    }
  )

  return {
    settings,
    isPlaying,
    currentTime,
    duration,
    isVideoActive,
    canvasOpacity,
    setMode,
    setVideoSrc,
    setOpacity,
    setMuted,
    setLoop,
    setPlaybackRate,
    setVideoElement,
    play,
    pause,
    togglePlay,
    clearVideo,
    handleFileSelect,
    onTimeUpdate,
    onLoadedMetadata,
    onPlay,
    onPause,
  }
})
