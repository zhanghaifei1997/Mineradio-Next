import type {
  PerformanceQuality,
  PerformanceBackgroundMode,
  QualityProfile,
  RenderPowerState,
  DesktopRuntimeState,
  RuntimePerfState,
  RenderPerfState,
  RendererInfo,
  ViewportInfo,
  PerfSnapshot,
  RenderLoadTier,
  PerformanceManagerOptions,
} from './types'
import { CoverCache } from './CoverCache'
import { BeatMapCache } from './BeatMapCache'

const QUALITY_PROFILES: Record<PerformanceQuality, QualityProfile> = {
  eco: { cap: 0.95, min: 0.56, budget: 2400000 },
  balanced: { cap: 1.12, min: 0.66, budget: 3800000 },
  high: { cap: 1.35, min: 0.72, budget: 5200000 },
  ultra: { cap: 1.75, min: 0.85, budget: 7800000 },
}

const DEFAULT_RENDER_DPR_CAP = 1.35
const DEFAULT_RENDER_PIXEL_BUDGET = 5200000
const DEFAULT_RENDER_MIN_DPR = 0.72
const DEFAULT_INTERACTION_HOLD_MS = 900

export class PerformanceManager {
  private quality: PerformanceQuality
  private backgroundMode: PerformanceBackgroundMode
  private liveBackgroundKeep: boolean

  private renderPowerState: RenderPowerState
  private desktopRuntimeState: DesktopRuntimeState
  private runtimePerfState: RuntimePerfState
  private renderPerfState: RenderPerfState

  private backgroundCacheTrimTimer: number | null
  private renderInteractionBoostUntil: number
  private renderInteractionReason: string
  private interactionHoldMs: number

  private longTaskObserver: PerformanceObserver | null
  private longTasks: PerformanceEntry[]
  private longTaskThreshold: number

  private enableLongTaskObserver: boolean
  private enableMemoryMonitor: boolean

  private coverCache: CoverCache | null
  private beatMapCache: BeatMapCache | null

  private listeners: Map<string, Set<(...args: unknown[]) => void>>

  constructor(options: PerformanceManagerOptions = {}) {
    this.quality = options.defaultQuality || 'high'
    this.backgroundMode = 'auto'
    this.liveBackgroundKeep = false

    this.renderPowerState = { mode: 'active', width: 0, height: 0, pixelRatio: 1 }
    this.desktopRuntimeState = {
      desktop: false,
      minimized: false,
      visible: true,
      focused: true,
      fullscreen: false,
    }
    this.runtimePerfState = {
      lastCacheTrimAt: 0,
      cacheTrimCount: 0,
      lastCacheTrimReason: '',
      lastHeapSampleAt: 0,
      heapMB: 0,
      cacheCounts: {},
    }
    this.renderPerfState = {
      mode: 'active',
      fps: 0,
      skipped: 0,
      longFrames: 0,
      lastRenderAt: 0,
    }

    this.backgroundCacheTrimTimer = null
    this.renderInteractionBoostUntil = 0
    this.renderInteractionReason = ''
    this.interactionHoldMs = DEFAULT_INTERACTION_HOLD_MS

    this.longTaskObserver = null
    this.longTasks = []
    this.longTaskThreshold = 50

    this.enableLongTaskObserver = options.enableLongTaskObserver !== false
    this.enableMemoryMonitor = options.enableMemoryMonitor !== false

    this.coverCache = null
    this.beatMapCache = null

    this.listeners = new Map()

    this.init()
  }

  private init(): void {
    if (typeof window !== 'undefined') {
      this.setupVisibilityListeners()
      this.setupLongTaskObserver()
    }
  }

  private setupVisibilityListeners(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.updateRenderPowerClasses()
        this.applyRendererPowerMode()
        if (!this.isDeepBackgroundMode()) {
          this.emit('backgroundRecover', 'visibilitychange')
        }
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.desktopRuntimeState.focused = true
        this.updateRenderPowerClasses()
        this.applyRendererPowerMode()
        if (!this.isDeepBackgroundMode()) {
          this.emit('backgroundRecover', 'focus')
        }
      })

      window.addEventListener('blur', () => {
        this.desktopRuntimeState.focused = false
        this.updateRenderPowerClasses()
        this.applyRendererPowerMode()
      })
    }
  }

  private setupLongTaskObserver(): void {
    if (!this.enableLongTaskObserver) return
    if (typeof PerformanceObserver === 'undefined') return

    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.duration >= this.longTaskThreshold) {
            this.longTasks.push(entry)
            if (this.longTasks.length > 50) {
              this.longTasks.shift()
            }
            this.emit('longTask', entry)
          }
        })
      })
      this.longTaskObserver.observe({ entryTypes: ['longtask'] })
    } catch (e) {
      console.warn('Long task observer not supported:', e)
    }
  }

  getQuality(): PerformanceQuality {
    return this.quality
  }

  setQuality(quality: PerformanceQuality): void {
    const normalized = this.normalizePerformanceQuality(quality)
    if (this.quality === normalized) return
    this.quality = normalized
    this.applyRendererPowerMode()
    this.emit('qualityChange', this.quality)
  }

  getBackgroundMode(): PerformanceBackgroundMode {
    return this.backgroundMode
  }

  setBackgroundMode(mode: PerformanceBackgroundMode, liveKeepFallback = false): void {
    const normalized = this.normalizePerformanceBackgroundMode(mode, liveKeepFallback)
    if (this.backgroundMode === normalized) return
    this.backgroundMode = normalized
    this.liveBackgroundKeep = normalized === 'keep'
    this.updateRenderPowerClasses()
    this.applyRendererPowerMode()
    this.emit('backgroundModeChange', this.backgroundMode)
  }

  isLiveBackgroundKeepMode(): boolean {
    return this.backgroundMode === 'keep' || this.liveBackgroundKeep
  }

  isBackgroundReleaseMode(): boolean {
    return this.backgroundMode === 'release'
  }

  isDeepBackgroundMode(): boolean {
    if (this.isLiveBackgroundKeepMode()) return false
    return !!(
      (typeof document !== 'undefined' && document.hidden) ||
      this.desktopRuntimeState.minimized ||
      this.desktopRuntimeState.visible === false
    )
  }

  isHiddenForBackgroundOptimization(): boolean {
    return !!(typeof document !== 'undefined' && document.hidden && !this.isLiveBackgroundKeepMode())
  }

  getQualityProfile(): QualityProfile {
    return QUALITY_PROFILES[this.quality] || QUALITY_PROFILES.high
  }

  getRenderPixelRatio(): number {
    const device = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
    if (this.isDeepBackgroundMode()) return Math.min(device, 0.3)

    const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const innerHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
    const cssPixels = Math.max(1, innerWidth * innerHeight)
    const quality = this.getQualityProfile()
    const budgetCap = Math.sqrt(quality.budget / cssPixels)
    const cap = Math.min(quality.cap, budgetCap)
    return Math.max(quality.min, Math.min(device, cap))
  }

  getRenderPixelLoad(): number {
    const ratio = this.getRenderPixelRatio()
    const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const innerHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
    return Math.max(1, innerWidth * innerHeight) * ratio * ratio
  }

  getRenderLoadTier(): RenderLoadTier {
    const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
    const innerHeight = typeof window !== 'undefined' ? window.innerHeight : 1080
    const cssPixels = Math.max(1, innerWidth * innerHeight)
    const renderPixels = this.getRenderPixelLoad()

    if (cssPixels >= 7200000 || renderPixels >= 5000000) return 2
    if (cssPixels >= 3200000 || renderPixels >= 3600000) return 1
    return 0
  }

  markRenderInteraction(reason?: string, holdMs?: number): void {
    if (this.isDeepBackgroundMode()) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.renderInteractionBoostUntil = Math.max(
      this.renderInteractionBoostUntil,
      now + (holdMs || this.interactionHoldMs)
    )
    this.renderInteractionReason = reason || this.renderInteractionReason || 'interaction'
    this.renderPerfState.lastRenderAt = 0
  }

  isRenderInteractionActive(now?: number): boolean {
    const time = now || (typeof performance !== 'undefined' ? performance.now() : Date.now())
    return time < this.renderInteractionBoostUntil
  }

  getInteractionReason(): string {
    return this.renderInteractionReason
  }

  applyRendererPowerMode(): void {
    const deep = this.isDeepBackgroundMode()
    const innerWidth = typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : 1920
    const innerHeight = typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 1080
    const width = deep ? 4 : innerWidth
    const height = deep ? 4 : innerHeight
    const pixelRatio = this.getRenderPixelRatio()
    const mode: 'sleep' | 'active' = deep ? 'sleep' : 'active'

    if (
      this.renderPowerState.mode === mode &&
      this.renderPowerState.width === width &&
      this.renderPowerState.height === height &&
      Math.abs(this.renderPowerState.pixelRatio - pixelRatio) < 0.001
    ) {
      return
    }

    this.renderPowerState = { mode, width, height, pixelRatio }
    this.emit('renderPowerChange', this.renderPowerState)

    if (deep) {
      this.scheduleBackgroundCacheTrim()
      this.emit('deepSleep')
    } else {
      this.emit('wakeUp')
    }
  }

  getRenderPowerState(): RenderPowerState {
    return { ...this.renderPowerState }
  }

  updateDesktopRuntimeState(state: Partial<DesktopRuntimeState>): void {
    const wasDeep = this.isDeepBackgroundMode()
    const wasFullscreen = this.desktopRuntimeState.fullscreen

    this.desktopRuntimeState = {
      ...this.desktopRuntimeState,
      ...state,
    }

    this.updateRenderPowerClasses()
    this.applyRendererPowerMode()

    if (wasDeep && !this.isDeepBackgroundMode()) {
      this.emit('backgroundRecover', 'desktop-runtime-state')
    }

    if (this.desktopRuntimeState.fullscreen !== wasFullscreen) {
      this.emit('fullscreenChange', this.desktopRuntimeState.fullscreen)
    }
  }

  getDesktopRuntimeState(): DesktopRuntimeState {
    return { ...this.desktopRuntimeState }
  }

  private updateRenderPowerClasses(): void {
    if (typeof document === 'undefined' || !document.body) return
    document.body.classList.toggle('render-deep-sleep', this.isDeepBackgroundMode())
  }

  private scheduleBackgroundCacheTrim(): void {
    if (!this.isDeepBackgroundMode()) return
    if (this.backgroundCacheTrimTimer !== null) {
      clearTimeout(this.backgroundCacheTrimTimer)
    }
    this.backgroundCacheTrimTimer = window.setTimeout(() => {
      this.backgroundCacheTrimTimer = null
      this.trimVisualCachesForBackground()
    }, 900)
  }

  trimVisualCachesForBackground(): void {
    if (!this.isDeepBackgroundMode()) return
    this.trimRuntimeCaches('deep-background', true)
  }

  trimRuntimeCaches(reason: string, aggressive: boolean): number {
    let dropped = 0

    if (this.coverCache) {
      dropped += this.coverCache.trimCoverCache(aggressive ? 72 : 180)
      dropped += this.coverCache.trimDepthCache(aggressive ? 4 : 10)
    }

    if (this.beatMapCache) {
      dropped += this.beatMapCache.trim(aggressive ? 12 : 36)
      dropped += this.beatMapCache.trimDj(aggressive ? 4 : 12)
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.runtimePerfState.lastCacheTrimAt = now
    this.runtimePerfState.cacheTrimCount += 1
    this.runtimePerfState.lastCacheTrimReason = reason || (aggressive ? 'deep' : 'active')
    this.updateCacheCounts()

    this.emit('cacheTrim', { reason, aggressive, dropped })
    return dropped
  }

  maybeTrimRuntimeCaches(now?: number): void {
    const time = now || (typeof performance !== 'undefined' ? performance.now() : Date.now())
    const deep = this.isDeepBackgroundMode()
    const gap = deep ? (this.isBackgroundReleaseMode() ? 3600 : 7000) : 45000

    if (!deep && time < 30000) return
    if (time - this.runtimePerfState.lastCacheTrimAt < gap) return

    this.trimRuntimeCaches(
      deep ? (this.isBackgroundReleaseMode() ? 'release-frame' : 'deep-frame') : 'active-frame',
      deep
    )
  }

  updateRenderPerf(updates: Partial<RenderPerfState>): void {
    this.renderPerfState = { ...this.renderPerfState, ...updates }
  }

  getRenderPerfState(): RenderPerfState {
    return { ...this.renderPerfState }
  }

  collectRuntimePerfSnapshot(now?: number): PerfSnapshot {
    const time = now || (typeof performance !== 'undefined' ? performance.now() : Date.now())

    this.updateCacheCounts()
    this.updateHeapSample(time)

    return {
      render: { ...this.renderPerfState },
      runtime: { ...this.runtimePerfState },
      renderer: null,
      viewport: this.getViewportInfo(),
      deepSleep: this.isDeepBackgroundMode(),
    }
  }

  private updateCacheCounts(): void {
    const counts: Record<string, number> = {}

    if (this.coverCache) {
      const stats = this.coverCache.getStats()
      counts.playlistCovers = stats.covers.size
      counts.coverDepth = stats.depthMaps.size
    }

    if (this.beatMapCache) {
      const stats = this.beatMapCache.getStats()
      counts.beatMaps = stats.beatMaps.size
      counts.djBeatMaps = stats.djBeatMaps.size
    }

    this.runtimePerfState.cacheCounts = counts
  }

  private updateHeapSample(now: number): void {
    if (!this.enableMemoryMonitor) return
    if (typeof performance === 'undefined') return
    if (!(performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory) return

    if (now - this.runtimePerfState.lastHeapSampleAt > 12000) {
      this.runtimePerfState.lastHeapSampleAt = now
      const mem = (performance as Performance & { memory: { usedJSHeapSize: number } }).memory
      this.runtimePerfState.heapMB = Math.round(mem.usedJSHeapSize / 1048576)
    }
  }

  private getViewportInfo(): ViewportInfo | null {
    if (typeof window === 'undefined') return null

    const innerWidth = window.innerWidth
    const innerHeight = window.innerHeight
    const devicePixelRatio = window.devicePixelRatio || 1
    const renderPixelRatio = this.getRenderPixelRatio()
    const canvasWidth = Math.round(innerWidth * renderPixelRatio)
    const canvasHeight = Math.round(innerHeight * renderPixelRatio)

    return {
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
      renderPixelRatio,
      canvasWidth,
      canvasHeight,
      renderPixels: canvasWidth * canvasHeight,
      targetFps: 0,
      interactionBoost: this.isRenderInteractionActive(),
      interactionReason: this.renderInteractionReason,
    }
  }

  setCoverCache(cache: CoverCache): void {
    this.coverCache = cache
  }

  setBeatMapCache(cache: BeatMapCache): void {
    this.beatMapCache = cache
  }

  getCoverCache(): CoverCache | null {
    return this.coverCache
  }

  getBeatMapCache(): BeatMapCache | null {
    return this.beatMapCache
  }

  getLongTasks(): PerformanceEntry[] {
    return [...this.longTasks]
  }

  getRecentLongTasks(count: number = 10): PerformanceEntry[] {
    return this.longTasks.slice(-count)
  }

  normalizePerformanceQuality(v: string): PerformanceQuality {
    return /^(eco|balanced|high|ultra)$/.test(v) ? (v as PerformanceQuality) : 'high'
  }

  normalizePerformanceBackgroundMode(v: string, liveKeepFallback = false): PerformanceBackgroundMode {
    const value = String(v || '')
    if (value === 'keep' || liveKeepFallback) return 'keep'
    if (value === 'release') return 'release'
    return 'auto'
  }

  on(event: string, callback: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
    return () => this.off(event, callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args)
      } catch (e) {
        console.error(`Error in ${event} listener:`, e)
      }
    })
  }

  dispose(): void {
    if (this.longTaskObserver) {
      try {
        this.longTaskObserver.disconnect()
      } catch (e) {
        // ignore
      }
      this.longTaskObserver = null
    }

    if (this.backgroundCacheTrimTimer !== null) {
      clearTimeout(this.backgroundCacheTrimTimer)
      this.backgroundCacheTrimTimer = null
    }

    this.listeners.clear()
  }
}

export function normalizePerformanceQuality(v: string): PerformanceQuality {
  return /^(eco|balanced|high|ultra)$/.test(v) ? (v as PerformanceQuality) : 'high'
}

export function normalizePerformanceBackgroundMode(v: string, liveKeepFallback = false): PerformanceBackgroundMode {
  const value = String(v || '')
  if (value === 'keep' || liveKeepFallback) return 'keep'
  if (value === 'release') return 'release'
  return 'auto'
}

let globalPerformanceManager: PerformanceManager | null = null

export function getPerformanceManager(): PerformanceManager {
  if (!globalPerformanceManager) {
    globalPerformanceManager = new PerformanceManager()
  }
  return globalPerformanceManager
}
