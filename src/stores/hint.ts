import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type HintType = 'song-hint' | 'preset-hint' | 'volume-hint' | 'mode-hint' | 'general-hint'

export interface HintItem {
  id: string
  title: string
  subtitle?: string
  type: HintType
  duration: number
  glass?: boolean
}

export const useHintStore = defineStore('hint', () => {
  const queue = ref<HintItem[]>([])
  const current = ref<HintItem | null>(null)
  const isVisible = ref(false)

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  const isActive = computed(() => isVisible.value || queue.value.length > 0)

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  function showHint(
    title: string,
    subtitle?: string,
    type: HintType = 'general-hint',
    duration: number = 2500,
    glass: boolean = true
  ): string {
    const item: HintItem = {
      id: generateId(),
      title,
      subtitle,
      type,
      duration,
      glass,
    }

    if (isVisible.value) {
      queue.value.push(item)
    } else {
      displayHint(item)
    }

    return item.id
  }

  function displayHint(item: HintItem): void {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }

    current.value = item
    isVisible.value = true
    updateBodyClass(true)

    hideTimer = setTimeout(() => {
      hideCurrent()
    }, item.duration)
  }

  function hideCurrent(): void {
    isVisible.value = false
    updateBodyClass(false)

    setTimeout(() => {
      current.value = null
      processQueue()
    }, 300)
  }

  function processQueue(): void {
    if (queue.value.length > 0) {
      const next = queue.value.shift()
      if (next) {
        displayHint(next)
      }
    }
  }

  function updateBodyClass(active: boolean): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('hint-active', active)
    }
  }

  function showSongHint(songName: string, artistName?: string): string {
    return showHint(songName, artistName, 'song-hint', 3000, true)
  }

  function showPresetHint(presetName: string): string {
    return showHint(presetName, '视觉预设', 'preset-hint', 2000, true)
  }

  function showVolumeHint(volume: number): string {
    const percent = Math.round(volume * 100)
    return showHint(`${percent}%`, '音量', 'volume-hint', 1500, false)
  }

  function showModeHint(modeName: string): string {
    return showHint(modeName, '模式切换', 'mode-hint', 2000, true)
  }

  function showGeneralHint(title: string, subtitle?: string, duration?: number): string {
    return showHint(title, subtitle, 'general-hint', duration || 2500, true)
  }

  function clearQueue(): void {
    queue.value = []
  }

  function dismiss(): void {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    hideCurrent()
  }

  return {
    queue,
    current,
    isVisible,
    isActive,
    showHint,
    showSongHint,
    showPresetHint,
    showVolumeHint,
    showModeHint,
    showGeneralHint,
    clearQueue,
    dismiss,
  }
})
