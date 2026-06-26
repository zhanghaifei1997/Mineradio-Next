import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  PerformanceManager,
  CoverCache,
  BeatMapCache,
  getPerformanceManager,
} from '@/modules/performance'
import type {
  PerformanceQuality,
  PerformanceBackgroundMode,
  RenderPowerState,
  RuntimePerfState,
  RenderPerfState,
  PerfSnapshot,
  RenderLoadTier,
} from '@/modules/performance'

export const usePerformanceStore = defineStore('performance', () => {
  const manager = ref<PerformanceManager>(getPerformanceManager())
  const coverCache = ref<CoverCache>(new CoverCache())
  const beatMapCache = ref<BeatMapCache>(new BeatMapCache())

  const quality = ref<PerformanceQuality>('high')
  const backgroundMode = ref<PerformanceBackgroundMode>('auto')
  const isDeepSleep = ref(false)
  const isInteractionActive = ref(false)
  const renderPowerState = ref<RenderPowerState>({
    mode: 'active',
    width: 0,
    height: 0,
    pixelRatio: 1,
  })
  const runtimePerfState = ref<RuntimePerfState>({
    lastCacheTrimAt: 0,
    cacheTrimCount: 0,
    lastCacheTrimReason: '',
    lastHeapSampleAt: 0,
    heapMB: 0,
    cacheCounts: {},
  })
  const renderPerfState = ref<RenderPerfState>({
    mode: 'active',
    fps: 0,
    skipped: 0,
    longFrames: 0,
    lastRenderAt: 0,
  })

  const qualityProfile = computed(() => manager.value.getQualityProfile())

  const renderPixelRatio = computed(() => manager.value.getRenderPixelRatio())

  const renderPixelLoad = computed(() => manager.value.getRenderPixelLoad())

  const renderLoadTier = computed<RenderLoadTier>(() => manager.value.getRenderLoadTier())

  const cacheStats = computed(() => ({
    covers: coverCache.value.getStats(),
    beatMaps: beatMapCache.value.getStats(),
  }))

  function init(): void {
    manager.value.setCoverCache(coverCache.value)
    manager.value.setBeatMapCache(beatMapCache.value)

    manager.value.on('qualityChange', (newQuality) => {
      quality.value = newQuality as PerformanceQuality
    })

    manager.value.on('backgroundModeChange', (newMode) => {
      backgroundMode.value = newMode as PerformanceBackgroundMode
    })

    manager.value.on('renderPowerChange', (state) => {
      renderPowerState.value = state as RenderPowerState
    })

    manager.value.on('deepSleep', () => {
      isDeepSleep.value = true
    })

    manager.value.on('wakeUp', () => {
      isDeepSleep.value = false
    })
  }

  function setQuality(newQuality: PerformanceQuality): void {
    manager.value.setQuality(newQuality)
    quality.value = newQuality
  }

  function setBackgroundMode(mode: PerformanceBackgroundMode, liveKeepFallback = false): void {
    manager.value.setBackgroundMode(mode, liveKeepFallback)
    backgroundMode.value = mode
  }

  function markInteraction(reason?: string, holdMs?: number): void {
    manager.value.markRenderInteraction(reason, holdMs)
    isInteractionActive.value = true
    setTimeout(() => {
      isInteractionActive.value = manager.value.isRenderInteractionActive()
    }, holdMs || 900)
  }

  function updateRenderPerf(updates: Partial<RenderPerfState>): void {
    manager.value.updateRenderPerf(updates)
    renderPerfState.value = { ...renderPerfState.value, ...updates }
  }

  function updateDesktopState(state: Parameters<PerformanceManager['updateDesktopRuntimeState']>[0]): void {
    manager.value.updateDesktopRuntimeState(state)
  }

  function trimCaches(reason: string, aggressive: boolean): number {
    return manager.value.trimRuntimeCaches(reason, aggressive)
  }

  function getSnapshot(): PerfSnapshot {
    return manager.value.collectRuntimePerfSnapshot()
  }

  function getManager(): PerformanceManager {
    return manager.value
  }

  function getCoverCache(): CoverCache {
    return coverCache.value
  }

  function getBeatMapCache(): BeatMapCache {
    return beatMapCache.value
  }

  return {
    quality,
    backgroundMode,
    isDeepSleep,
    isInteractionActive,
    renderPowerState,
    runtimePerfState,
    renderPerfState,
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
    getManager,
    getCoverCache,
    getBeatMapCache,
  }
})
