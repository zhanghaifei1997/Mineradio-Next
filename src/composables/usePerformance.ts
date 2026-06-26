import { onMounted, onUnmounted, watch, ref, computed } from 'vue'
import { usePerformanceStore } from '@/stores/performance'
import { useFxStore } from '@/stores/fx'
import type {
  PerformanceQuality,
  PerformanceBackgroundMode,
  RenderPowerState,
  PerfSnapshot,
  QualityProfile,
  RenderLoadTier,
} from '@/modules/performance'

export function usePerformance() {
  const performanceStore = usePerformanceStore()
  const fxStore = useFxStore()

  const initialized = ref(false)

  const quality = computed(() => performanceStore.quality)
  const backgroundMode = computed(() => performanceStore.backgroundMode)
  const isDeepSleep = computed(() => performanceStore.isDeepSleep)
  const isInteractionActive = computed(() => performanceStore.isInteractionActive)
  const renderPowerState = computed<RenderPowerState>(() => performanceStore.renderPowerState)
  const qualityProfile = computed<QualityProfile>(() => performanceStore.qualityProfile)
  const renderPixelRatio = computed(() => performanceStore.renderPixelRatio)
  const renderPixelLoad = computed(() => performanceStore.renderPixelLoad)
  const renderLoadTier = computed<RenderLoadTier>(() => performanceStore.renderLoadTier)
  const cacheStats = computed(() => performanceStore.cacheStats)

  function init(): void {
    if (initialized.value) return

    performanceStore.init()

    if (fxStore.settings.performanceQuality) {
      performanceStore.setQuality(fxStore.settings.performanceQuality)
    }

    if (fxStore.settings.performanceBackground) {
      performanceStore.setBackgroundMode(
        fxStore.settings.performanceBackground,
        fxStore.settings.liveBackgroundKeep
      )
    }

    watch(
      () => fxStore.settings.performanceQuality,
      (newQuality) => {
        performanceStore.setQuality(newQuality)
      }
    )

    watch(
      () => fxStore.settings.performanceBackground,
      (newMode) => {
        performanceStore.setBackgroundMode(newMode, fxStore.settings.liveBackgroundKeep)
      }
    )

    watch(
      () => fxStore.settings.liveBackgroundKeep,
      (liveKeep) => {
        performanceStore.setBackgroundMode(fxStore.settings.performanceBackground, liveKeep)
      }
    )

    initialized.value = true
  }

  function setQuality(newQuality: PerformanceQuality): void {
    performanceStore.setQuality(newQuality)
    fxStore.update('performanceQuality', newQuality)
  }

  function setBackgroundMode(mode: PerformanceBackgroundMode, liveKeepFallback = false): void {
    performanceStore.setBackgroundMode(mode, liveKeepFallback)
    fxStore.update('performanceBackground', mode)
  }

  function markInteraction(reason?: string, holdMs?: number): void {
    performanceStore.markInteraction(reason, holdMs)
  }

  function updateRenderPerf(updates: Partial<{ fps: number; skipped: number; longFrames: number }>): void {
    performanceStore.updateRenderPerf(updates)
  }

  function updateDesktopState(state: {
    desktop?: boolean
    minimized?: boolean
    visible?: boolean
    focused?: boolean
    fullscreen?: boolean
  }): void {
    performanceStore.updateDesktopState(state)
  }

  function trimCaches(reason: string, aggressive: boolean): number {
    return performanceStore.trimCaches(reason, aggressive)
  }

  function getSnapshot(): PerfSnapshot {
    return performanceStore.getSnapshot()
  }

  function getPerformanceManager() {
    return performanceStore.getManager()
  }

  function getCoverCache() {
    return performanceStore.getCoverCache()
  }

  function getBeatMapCache() {
    return performanceStore.getBeatMapCache()
  }

  onMounted(() => {
    init()
  })

  return {
    initialized,
    quality,
    backgroundMode,
    isDeepSleep,
    isInteractionActive,
    renderPowerState,
    qualityProfile,
    renderPixelRatio,
    renderPixelLoad,
    renderLoadTier,
    cacheStats,
    init,
    setQuality,
    setBackgroundMode,
    markInteraction,
    updateRenderPerf,
    updateDesktopState,
    trimCaches,
    getSnapshot,
    getPerformanceManager,
    getCoverCache,
    getBeatMapCache,
  }
}

export function useRenderPerformance() {
  const { getPerformanceManager, markInteraction } = usePerformance()
  const manager = getPerformanceManager()

  const fps = ref(0)
  const frameTime = ref(0)
  const longFrames = ref(0)
  const skippedFrames = ref(0)

  let frameCount = 0
  let lastFpsUpdate = 0
  let lastFrameTime = 0
  let rafId: number | null = null

  function onFrame(): void {
    const now = performance.now()

    if (lastFrameTime > 0) {
      const delta = now - lastFrameTime
      frameTime.value = delta

      if (delta > 50) {
        longFrames.value++
      }
    }

    frameCount++
    lastFrameTime = now

    if (now - lastFpsUpdate >= 1000) {
      fps.value = Math.round((frameCount * 1000) / (now - lastFpsUpdate))
      frameCount = 0
      lastFpsUpdate = now

      try {
        const perfStore = usePerformanceStore()
        perfStore.updateRenderPerf({
          fps: fps.value,
          longFrames: longFrames.value,
          skipped: skippedFrames.value,
        })
      } catch (e) {
        // ignore
      }
    }
  }

  function startTracking(): void {
    if (rafId !== null) return

    function loop() {
      onFrame()
      rafId = requestAnimationFrame(loop)
    }

    lastFpsUpdate = performance.now()
    frameCount = 0
    rafId = requestAnimationFrame(loop)
  }

  function stopTracking(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function skipFrame(): void {
    skippedFrames.value++
  }

  onMounted(() => {
    startTracking()
  })

  onUnmounted(() => {
    stopTracking()
  })

  return {
    fps,
    frameTime,
    longFrames,
    skippedFrames,
    startTracking,
    stopTracking,
    skipFrame,
    markInteraction,
  }
}

export function useLongTaskMonitor() {
  const { getPerformanceManager } = usePerformance()
  const manager = getPerformanceManager()

  const longTaskCount = ref(0)
  const recentLongTasks = ref<PerformanceEntry[]>([])

  function refresh(): void {
    recentLongTasks.value = manager.getRecentLongTasks(10)
    longTaskCount.value = manager.getLongTasks().length
  }

  onMounted(() => {
    refresh()
  })

  return {
    longTaskCount,
    recentLongTasks,
    refresh,
  }
}
