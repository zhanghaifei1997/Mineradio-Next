import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePlayerStore } from './player'

export type SleepAction = 'pause' | 'quit' | 'shutdown'
export type TimerPreset = 15 | 30 | 45 | 60 | 90 | 120

const STORAGE_KEY = 'mineradio_sleep_timer'

interface TimerSettings {
  enabled: boolean
  duration: number
  action: SleepAction
  fadeOut: boolean
  sleepMode: boolean
}

const defaultSettings: TimerSettings = {
  enabled: false,
  duration: 30,
  action: 'pause',
  fadeOut: true,
  sleepMode: false,
}

export const useTimerStore = defineStore('timer', () => {
  const settings = ref<TimerSettings>(loadSettings())
  const remainingTime = ref(0)
  const isRunning = ref(false)
  const isFading = ref(false)

  let timerInterval: number | null = null
  let fadeOutInterval: number | null = null

  const remainingMinutes = computed(() => Math.ceil(remainingTime.value / 60))
  const remainingTimeFormatted = computed(() => {
    const mins = Math.floor(remainingTime.value / 60)
    const secs = remainingTime.value % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  function setDuration(minutes: number): void {
    settings.value.duration = minutes
    saveSettings()
  }

  function setAction(action: SleepAction): void {
    settings.value.action = action
    saveSettings()
  }

  function setFadeOut(enabled: boolean): void {
    settings.value.fadeOut = enabled
    saveSettings()
  }

  function setSleepMode(enabled: boolean): void {
    settings.value.sleepMode = enabled
    saveSettings()
  }

  function startTimer(minutes?: number): void {
    if (minutes !== undefined) {
      settings.value.duration = minutes
    }

    remainingTime.value = settings.value.duration * 60
    isRunning.value = true
    settings.value.enabled = true
    isFading.value = false
    saveSettings()

    if (timerInterval) {
      clearInterval(timerInterval)
    }

    timerInterval = window.setInterval(() => {
      tick()
    }, 1000)
  }

  function stopTimer(): void {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }

    if (fadeOutInterval) {
      clearInterval(fadeOutInterval)
      fadeOutInterval = null
    }

    isRunning.value = false
    isFading.value = false
    remainingTime.value = 0
    settings.value.enabled = false
    saveSettings()
  }

  function tick(): void {
    remainingTime.value--

    if (settings.value.fadeOut && remainingTime.value === 60) {
      startFadeOut()
    }

    if (remainingTime.value <= 0) {
      executeAction()
    }
  }

  function startFadeOut(): void {
    const player = usePlayerStore()
    isFading.value = true
    const startVolume = player.volume
    const fadeDuration = 60
    let elapsed = 0

    if (fadeOutInterval) {
      clearInterval(fadeOutInterval)
    }

    fadeOutInterval = window.setInterval(() => {
      elapsed++
      const progress = elapsed / fadeDuration
      const newVolume = startVolume * (1 - progress)
      player.setVolume(Math.max(0, newVolume))

      if (elapsed >= fadeDuration) {
        if (fadeOutInterval) {
          clearInterval(fadeOutInterval)
          fadeOutInterval = null
        }
      }
    }, 1000)
  }

  function executeAction(): void {
    const player = usePlayerStore()

    stopTimer()

    switch (settings.value.action) {
      case 'pause':
        player.pause()
        player.setVolume(0.7)
        break
      case 'quit':
        player.pause()
        if ((window as any).electronAPI?.app?.quit) {
          ;(window as any).electronAPI.app.quit()
        }
        break
      case 'shutdown':
        player.pause()
        if ((window as any).electronAPI?.system?.shutdown) {
          ;(window as any).electronAPI.system.shutdown()
        }
        break
    }
  }

  function loadSettings(): TimerSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          ...defaultSettings,
          ...parsed,
        }
      }
    } catch (e) {
      console.warn('Failed to load timer settings:', e)
    }
    return { ...defaultSettings }
  }

  function saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.warn('Failed to save timer settings:', e)
    }
  }

  return {
    settings,
    remainingTime,
    remainingMinutes,
    remainingTimeFormatted,
    isRunning,
    isFading,
    setDuration,
    setAction,
    setFadeOut,
    setSleepMode,
    startTimer,
    stopTimer,
  }
})
