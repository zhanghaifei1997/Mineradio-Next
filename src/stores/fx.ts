import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FxSettings, VisualPreset, PerformanceQuality, PerformanceBackgroundMode } from '@/types'
import { normalizePerformanceQuality, normalizePerformanceBackgroundMode } from '@/modules/performance'

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
  performanceQuality: 'high',
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
    set: (v: PerformanceQuality) => {
      settings.value.performanceQuality = normalizePerformanceQuality(v)
      save()
    },
  })

  const performanceBackground = computed({
    get: () => settings.value.performanceBackground,
    set: (v: PerformanceBackgroundMode) => {
      settings.value.performanceBackground = v
      save()
    },
  })

  const liveBackgroundKeep = computed({
    get: () => settings.value.liveBackgroundKeep,
    set: (v: boolean) => {
      settings.value.liveBackgroundKeep = v
      save()
    },
  })

  const particleGridSize = computed(() => {
    const grid = Math.round(118 * normalizeCoverResolution(settings.value.particleResolution))
    return Math.max(88, Math.min(183, grid % 2 ? grid : grid + 1))
  })

  const particleCountLabel = computed(() => {
    const grid = particleGridSize.value
    return `${grid}x${grid}`
  })

  const coverTextureSize = computed(() => {
    const v = normalizeCoverResolution(settings.value.particleResolution)
    if (v >= 1.32) return 512
    if (v >= 1.10) return 384
    return 256
  })

  function update<K extends keyof FxSettings>(key: K, value: FxSettings[K]): void {
    settings.value[key] = value
    save()
  }

  function reset(): void {
    settings.value = { ...defaultSettings }
    save()
  }

  function setPerformanceQuality(quality: PerformanceQuality): void {
    settings.value.performanceQuality = normalizePerformanceQuality(quality)
    save()
  }

  function setPerformanceBackgroundMode(mode: PerformanceBackgroundMode): void {
    settings.value.performanceBackground = normalizePerformanceBackgroundMode(mode, settings.value.liveBackgroundKeep)
    save()
  }

  function toggleLiveBackgroundKeep(): void {
    settings.value.liveBackgroundKeep = !settings.value.liveBackgroundKeep
    save()
  }

  function loadSettings(): FxSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          ...defaultSettings,
          ...parsed,
          performanceQuality: normalizePerformanceQuality(parsed.performanceQuality),
          performanceBackground: normalizePerformanceBackgroundMode(
            parsed.performanceBackground,
            parsed.liveBackgroundKeep
          ),
        }
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
    performanceBackground,
    liveBackgroundKeep,
    particleGridSize,
    particleCountLabel,
    coverTextureSize,
    update,
    reset,
    setPerformanceQuality,
    setPerformanceBackgroundMode,
    toggleLiveBackgroundKeep,
  }
})

function normalizeCoverResolution(v: number): number {
  return Math.max(0.75, Math.min(1.55, Number(v) || 1))
}
