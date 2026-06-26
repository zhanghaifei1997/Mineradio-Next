import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FxSettings, VisualPreset } from '@/types'

const STORAGE_KEY = 'mineradio_fx_settings'

const defaultSettings: FxSettings = {
  preset: 'emily',
  particleResolution: 1,
  cinemaIntensity: 0.7,
  lyricGlow: 0.6,
  accentColor: '#d95b67',
  glowColor: '#d95b67',
  shelfShowPodcasts: false,
  shelfMergeCollections: false,
  liveBackgroundKeep: false,
  performanceBackground: 'auto',
  performanceQuality: 'balanced',
}

export const useFxStore = defineStore('fx', () => {
  const settings = ref<FxSettings>(loadSettings())

  const preset = computed({
    get: () => settings.value.preset,
    set: (v: VisualPreset) => { settings.value.preset = v; save() },
  })

  const particleResolution = computed({
    get: () => settings.value.particleResolution,
    set: (v: number) => { settings.value.particleResolution = v; save() },
  })

  const cinemaIntensity = computed({
    get: () => settings.value.cinemaIntensity,
    set: (v: number) => { settings.value.cinemaIntensity = v; save() },
  })

  const lyricGlow = computed({
    get: () => settings.value.lyricGlow,
    set: (v: number) => { settings.value.lyricGlow = v; save() },
  })

  const accentColor = computed({
    get: () => settings.value.accentColor,
    set: (v: string) => { settings.value.accentColor = v; save() },
  })

  const glowColor = computed({
    get: () => settings.value.glowColor,
    set: (v: string) => { settings.value.glowColor = v; save() },
  })

  const performanceQuality = computed({
    get: () => settings.value.performanceQuality,
    set: (v: FxSettings['performanceQuality']) => {
      settings.value.performanceQuality = v
      save()
    },
  })

  function update<K extends keyof FxSettings>(key: K, value: FxSettings[K]): void {
    settings.value[key] = value
    save()
  }

  function reset(): void {
    settings.value = { ...defaultSettings }
    save()
  }

  function loadSettings(): FxSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        return { ...defaultSettings, ...JSON.parse(raw) }
      }
    } catch (e) {
      console.warn('Failed to load fx settings:', e)
    }
    return { ...defaultSettings }
  }

  function save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch (e) {
      console.warn('Failed to save fx settings:', e)
    }
  }

  return {
    settings,
    preset,
    particleResolution,
    cinemaIntensity,
    lyricGlow,
    accentColor,
    glowColor,
    performanceQuality,
    update,
    reset,
  }
})
