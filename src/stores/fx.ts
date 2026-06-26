import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FxSettings, VisualPreset, PerformanceQuality, PerformanceBackgroundMode, SpectrumMode, CinemaMode, ShelfMode, ShelfCameraMode, ShelfPresence, LayoutMode } from '@/types'
import { normalizePerformanceQuality, normalizePerformanceBackgroundMode } from '@/modules/performance'

const STORAGE_KEY = 'mineradio-lyric-layout-v1'
const STORAGE_KEY_LEGACY = 'mineradio_fx_settings'

const defaultSettings: FxSettings = {
  preset: 'emily',
  particleResolution: 1,
  particleSize: 1,
  particleColorMode: 'colorful',
  cinemaIntensity: 0.7,
  cinemaMode: 'cinema',
  lyricGlow: 0.6,
  accentColor: '#d95b67',
  glowColor: '#d95b67',
  bgColor: '#0a0e17',
  brightness: 1,
  contrast: 1,
  visualIntensity: 1,
  beatResponseStrength: 0.5,
  particleMotionSpeed: 1,
  autoSwitchPreset: false,
  visualWithSong: false,
  shelfMode: 'sidebar',
  shelfCameraMode: 'dynamic',
  shelfPresence: 'always',
  shelfShowPodcasts: true,
  shelfMergeCollections: false,
  shelfSize: 1.0,
  shelfOffsetX: 0,
  shelfOffsetY: 0,
  shelfOffsetZ: 0,
  shelfAngleY: 0,
  shelfOpacity: 0.95,
  shelfBgOpacity: 0.75,
  shelfAccentColor: '#f4d28a',
  shelfSoundEnabled: true,
  liveBackgroundKeep: false,
  performanceBackground: 'auto',
  performanceQuality: 'high',
  workerwEnabled: false,
  workerwWallpaperMode: false,
  workerwOpacity: 1,
  workerwVisualIntensity: 1,
  spectrumEnabled: true,
  spectrumMode: 'bars',
  spectrumPosition: 'playerbar',
  glassEffect: true,
  glassOpacity: 0.85,
  glassBlur: 20,
  consoleTint: 0.5,
  consoleOpacity: 0.85,
  coverColorEnabled: true,
  onboardingCompleted: false,
  homeWallpaperEnabled: true,
  homeWallpaperPreset: 'wallpaper' as VisualPreset,
  layoutMode: 'diy' as LayoutMode,
  controlsAutoHide: true,
  controlsHideDelay: 2000,
  userCapsuleAutoHide: false,
  fxFabAutoHide: false,
  queuePinned: false,
  freeCameraEnabled: false,
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

  const cinemaMode = computed({
    get: () => settings.value.cinemaMode,
    set: (v: CinemaMode) => { settings.value.cinemaMode = v; save() },
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

  const shelfMode = computed({
    get: () => settings.value.shelfMode,
    set: (v: ShelfMode) => { settings.value.shelfMode = v; save() },
  })

  const shelfCameraMode = computed({
    get: () => settings.value.shelfCameraMode,
    set: (v: ShelfCameraMode) => { settings.value.shelfCameraMode = v; save() },
  })

  const shelfPresence = computed({
    get: () => settings.value.shelfPresence,
    set: (v: ShelfPresence) => { settings.value.shelfPresence = v; save() },
  })

  const shelfShowPodcasts = computed({
    get: () => settings.value.shelfShowPodcasts,
    set: (v: boolean) => { settings.value.shelfShowPodcasts = v; save() },
  })

  const shelfMergeCollections = computed({
    get: () => settings.value.shelfMergeCollections,
    set: (v: boolean) => { settings.value.shelfMergeCollections = v; save() },
  })

  const shelfSize = computed({
    get: () => settings.value.shelfSize,
    set: (v: number) => { settings.value.shelfSize = v; save() },
  })

  const shelfOffsetX = computed({
    get: () => settings.value.shelfOffsetX,
    set: (v: number) => { settings.value.shelfOffsetX = v; save() },
  })

  const shelfOffsetY = computed({
    get: () => settings.value.shelfOffsetY,
    set: (v: number) => { settings.value.shelfOffsetY = v; save() },
  })

  const shelfOffsetZ = computed({
    get: () => settings.value.shelfOffsetZ,
    set: (v: number) => { settings.value.shelfOffsetZ = v; save() },
  })

  const shelfAngleY = computed({
    get: () => settings.value.shelfAngleY,
    set: (v: number) => { settings.value.shelfAngleY = v; save() },
  })

  const shelfOpacity = computed({
    get: () => settings.value.shelfOpacity,
    set: (v: number) => { settings.value.shelfOpacity = v; save() },
  })

  const shelfBgOpacity = computed({
    get: () => settings.value.shelfBgOpacity,
    set: (v: number) => { settings.value.shelfBgOpacity = v; save() },
  })

  const shelfAccentColor = computed({
    get: () => settings.value.shelfAccentColor,
    set: (v: string) => { settings.value.shelfAccentColor = v; save() },
  })

  const shelfSoundEnabled = computed({
    get: () => settings.value.shelfSoundEnabled,
    set: (v: boolean) => { settings.value.shelfSoundEnabled = v; save() },
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

  const layoutMode = computed({
    get: () => settings.value.layoutMode,
    set: (v: LayoutMode) => {
      settings.value.layoutMode = v
      save()
    },
  })

  const controlsAutoHide = computed({
    get: () => settings.value.controlsAutoHide,
    set: (v: boolean) => {
      settings.value.controlsAutoHide = v
      save()
    },
  })

  const controlsHideDelay = computed({
    get: () => settings.value.controlsHideDelay,
    set: (v: number) => {
      settings.value.controlsHideDelay = v
      save()
    },
  })

  const userCapsuleAutoHide = computed({
    get: () => settings.value.userCapsuleAutoHide,
    set: (v: boolean) => {
      settings.value.userCapsuleAutoHide = v
      save()
    },
  })

  const fxFabAutoHide = computed({
    get: () => settings.value.fxFabAutoHide,
    set: (v: boolean) => {
      settings.value.fxFabAutoHide = v
      save()
    },
  })

  const queuePinned = computed({
    get: () => settings.value.queuePinned,
    set: (v: boolean) => {
      settings.value.queuePinned = v
      save()
    },
  })

  const freeCameraEnabled = computed({
    get: () => settings.value.freeCameraEnabled,
    set: (v: boolean) => {
      settings.value.freeCameraEnabled = v
      save()
    },
  })

  const homeWallpaperEnabled = computed({
    get: () => settings.value.homeWallpaperEnabled ?? true,
    set: (v: boolean) => {
      settings.value.homeWallpaperEnabled = v
      save()
    },
  })

  const homeWallpaperPreset = computed({
    get: () => settings.value.homeWallpaperPreset ?? 'wallpaper',
    set: (v: VisualPreset) => {
      settings.value.homeWallpaperPreset = v
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

  function toggleLayoutMode(): void {
    settings.value.layoutMode = settings.value.layoutMode === 'diy' ? 'simple' : 'diy'
    save()
  }

  function toggleFreeCamera(): void {
    settings.value.freeCameraEnabled = !settings.value.freeCameraEnabled
    save()
  }

  function loadSettings(): FxSettings {
    try {
      let raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        raw = localStorage.getItem(STORAGE_KEY_LEGACY)
        if (raw) {
          // 迁移旧数据到新键名
          localStorage.setItem(STORAGE_KEY, raw)
          try {
            localStorage.removeItem(STORAGE_KEY_LEGACY)
          } catch (_) {}
        }
      }
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
          layoutMode: normalizeLayoutMode(parsed.layoutMode),
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
    cinemaMode,
    lyricGlow,
    accentColor,
    glowColor,
    shelfMode,
    shelfCameraMode,
    shelfPresence,
    shelfShowPodcasts,
    shelfMergeCollections,
    shelfSize,
    shelfOffsetX,
    shelfOffsetY,
    shelfOffsetZ,
    shelfAngleY,
    shelfOpacity,
    shelfBgOpacity,
    shelfAccentColor,
    shelfSoundEnabled,
    performanceQuality,
    performanceBackground,
    liveBackgroundKeep,
    layoutMode,
    controlsAutoHide,
    controlsHideDelay,
    userCapsuleAutoHide,
    fxFabAutoHide,
    queuePinned,
    freeCameraEnabled,
    homeWallpaperEnabled,
    homeWallpaperPreset,
    particleGridSize,
    particleCountLabel,
    coverTextureSize,
    update,
    reset,
    setPerformanceQuality,
    setPerformanceBackgroundMode,
    toggleLiveBackgroundKeep,
    toggleLayoutMode,
    toggleFreeCamera,
  }
})

function normalizeCoverResolution(v: number): number {
  return Math.max(0.75, Math.min(1.55, Number(v) || 1))
}

function normalizeLayoutMode(v: string): LayoutMode {
  return v === 'simple' || v === 'diy' ? (v as LayoutMode) : 'diy'
}
