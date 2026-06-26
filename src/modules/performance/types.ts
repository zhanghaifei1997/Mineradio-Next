export type PerformanceQuality = 'eco' | 'balanced' | 'high' | 'ultra'

export type PerformanceBackgroundMode = 'auto' | 'keep' | 'release'

export type RenderLoadTier = 0 | 1 | 2

export interface QualityProfile {
  cap: number
  min: number
  budget: number
}

export interface RenderPowerState {
  mode: 'sleep' | 'active'
  width: number
  height: number
  pixelRatio: number
}

export interface DesktopRuntimeState {
  desktop: boolean
  minimized: boolean
  visible: boolean
  focused: boolean
  fullscreen: boolean
}

export interface RuntimePerfState {
  lastCacheTrimAt: number
  cacheTrimCount: number
  lastCacheTrimReason: string
  lastHeapSampleAt: number
  heapMB: number
  cacheCounts: Record<string, number>
}

export interface RenderPerfState {
  mode: string
  fps: number
  skipped: number
  longFrames: number
  lastRenderAt: number
}

export interface RendererInfo {
  geometries?: number
  textures?: number
  calls?: number
  triangles?: number
}

export interface ViewportInfo {
  width: number
  height: number
  devicePixelRatio: number
  renderPixelRatio: number
  canvasWidth: number
  canvasHeight: number
  renderPixels: number
  targetFps: number
  interactionBoost: boolean
  interactionReason: string
}

export interface PerfSnapshot {
  render: RenderPerfState | null
  runtime: RuntimePerfState
  renderer: RendererInfo | null
  viewport: ViewportInfo | null
  deepSleep: boolean
}

export interface CacheRecord {
  [key: string]: unknown
}

export interface CoverCacheRecord {
  url: string
  image?: HTMLImageElement
  texture?: unknown
  loading?: boolean
  timestamp: number
  size?: number
}

export interface BeatMapRecord {
  kicks: number[]
  duration: number
  bpm?: number
  confidence?: number
  energy?: number
  timestamp: number
}

export interface DepthMapCacheRecord {
  id: string
  data?: unknown
  texture?: unknown
  timestamp: number
}

export type CacheTrimStrategy = 'fifo' | 'lru' | 'lfu'

export interface CacheOptions {
  maxSize: number
  strategy?: CacheTrimStrategy
  protectedKeys?: Set<string>
}

export interface PerformanceMonitorOptions {
  longTaskThreshold?: number
  fpsSampleWindow?: number
  memorySampleInterval?: number
}

export interface PerformanceManagerOptions {
  defaultQuality?: PerformanceQuality
  defaultBackgroundMode?: PerformanceBackgroundMode
  enableLongTaskObserver?: boolean
  enableMemoryMonitor?: boolean
}
