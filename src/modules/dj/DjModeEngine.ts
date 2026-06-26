import type { BeatMap, BeatEvent, DjModeState, DjModeConfig } from './types'
import {
  analyzePodcastDjStream,
  analyzePodcastDjIntro,
  analyzePodcastDjRangeSamples,
  BeatMapData,
} from '@/modules/audio'
import type { DjAnalysisOptions } from './types'

const DJ_MODE_STORAGE_KEY = 'mineradio_dj_mode_config'

const defaultConfig: DjModeConfig = {
  enabled: false,
  intensity: 0.7,
  autoTransition: true,
  transitionDuration: 2.5,
  visualBoost: 1.5,
  cameraShake: true,
  particleBoost: true,
}

export class DjModeEngine {
  private config: DjModeConfig
  private state: DjModeState
  private currentBeatMap: BeatMapData | null = null
  private beatMapCache = new Map<string, BeatMap>()
  private transitionState = {
    active: false,
    startTime: 0,
    duration: 0,
    fromSongKey: '',
    toSongKey: '',
  }
  private listeners: Set<(state: DjModeState) => void> = new Set()

  constructor() {
    this.config = this.loadConfig()
    this.state = {
      active: false,
      songKey: '',
      startedAt: 0,
      tempoGap: 0,
      tempoConfidence: 0,
      sectionEnergy: 0,
      sectionLow: 0,
      sectionChange: 0,
      visualPulse: 0,
      lastBeatAt: -10,
      lastNoticeAt: 0,
    }
  }

  getState(): DjModeState {
    return { ...this.state }
  }

  getConfig(): DjModeConfig {
    return { ...this.config }
  }

  updateConfig(partial: Partial<DjModeConfig>): void {
    this.config = { ...this.config, ...partial }
    this.saveConfig()
  }

  isActive(): boolean {
    return this.state.active && this.config.enabled
  }

  activate(songKey: string): void {
    this.state.active = true
    this.state.songKey = songKey
    this.state.startedAt = performance.now() / 1000
    this.resetMeters()
    this.notifyListeners()
  }

  deactivate(): void {
    this.state.active = false
    this.notifyListeners()
  }

  resetMeters(): void {
    this.state.tempoGap = 0
    this.state.tempoConfidence = 0
    this.state.sectionEnergy = 0
    this.state.sectionLow = 0
    this.state.sectionChange = 0
    this.state.visualPulse = 0
    this.state.lastBeatAt = -10
    this.state.lastNoticeAt = 0
  }

  async analyzeSong(
    audioUrl: string,
    songKey: string,
    durationSec: number,
    options: DjAnalysisOptions = { mode: 'full' }
  ): Promise<BeatMap | null> {
    if (this.beatMapCache.has(songKey)) {
      const cached = this.beatMapCache.get(songKey)!
      this.currentBeatMap = BeatMapData.fromBeatMap(cached)
      return cached
    }

    try {
      let beatMap: BeatMap

      if (options.mode === 'intro') {
        beatMap = await analyzePodcastDjIntro(audioUrl, {
          durationSec,
          introSec: options.introSec || 180,
        })
      } else if (options.mode === 'range' && durationSec > 7200) {
        beatMap = await analyzePodcastDjRangeSamples(audioUrl, {
          durationSec,
        })
      } else {
        beatMap = await analyzePodcastDjStream(audioUrl, {
          durationSec,
        })
      }

      this.beatMapCache.set(songKey, beatMap)
      this.currentBeatMap = BeatMapData.fromBeatMap(beatMap)

      return beatMap
    } catch (e) {
      console.error('[DjModeEngine] Analysis failed:', e)
      return null
    }
  }

  getBeatMap(): BeatMapData | null {
    return this.currentBeatMap
  }

  setBeatMap(beatMap: BeatMap): void {
    this.currentBeatMap = BeatMapData.fromBeatMap(beatMap)
  }

  clearBeatMap(): void {
    this.currentBeatMap = null
  }

  processBeat(beat: BeatEvent, currentTime: number): void {
    const now = performance.now() / 1000
    this.state.lastBeatAt = now
    this.state.visualPulse = Math.min(1, beat.impact * 1.5 * this.config.intensity)
    this.state.sectionEnergy = this.state.sectionEnergy * 0.92 + beat.strength * 0.08
    this.state.sectionLow = this.state.sectionLow * 0.90 + beat.low * 0.10
    this.state.tempoConfidence = Math.max(
      this.state.tempoConfidence * 0.98,
      beat.confidence
    )

    if (beat.step > 0) {
      const expectedBpm = 60 / beat.step
      this.state.tempoGap = Math.abs(expectedBpm - 60 / beat.step)
    }

    this.notifyListeners()
  }

  getNextBeat(currentTime: number): BeatEvent | null {
    if (!this.currentBeatMap) return null
    return this.currentBeatMap.getNextBeat(currentTime)
  }

  seekTo(time: number): void {
    this.currentBeatMap?.seekTo(time)
  }

  startTransition(fromKey: string, toKey: string, duration?: number): void {
    if (!this.config.autoTransition) return
    this.transitionState = {
      active: true,
      startTime: performance.now() / 1000,
      duration: duration || this.config.transitionDuration,
      fromSongKey: fromKey,
      toSongKey: toKey,
    }
  }

  getTransitionProgress(): number {
    if (!this.transitionState.active) return 1
    const elapsed = performance.now() / 1000 - this.transitionState.startTime
    return Math.min(1, elapsed / this.transitionState.duration)
  }

  isTransitioning(): boolean {
    return this.transitionState.active && this.getTransitionProgress() < 1
  }

  getVisualMultiplier(): number {
    if (!this.isActive()) return 1
    const base = 1 + (this.config.visualBoost - 1) * this.config.intensity
    const pulseBoost = 1 + this.state.visualPulse * 0.5
    return base * pulseBoost
  }

  getCameraShakeIntensity(): number {
    if (!this.isActive() || !this.config.cameraShake) return 0
    return this.state.visualPulse * this.config.intensity * 0.3
  }

  getParticleBoost(): number {
    if (!this.isActive() || !this.config.particleBoost) return 1
    return 1 + this.state.sectionEnergy * this.config.intensity * 0.8
  }

  subscribe(listener: (state: DjModeState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    const state = { ...this.state }
    this.listeners.forEach((listener) => listener(state))
  }

  clearCache(): void {
    this.beatMapCache.clear()
  }

  private loadConfig(): DjModeConfig {
    try {
      const raw = localStorage.getItem(DJ_MODE_STORAGE_KEY)
      if (raw) {
        return { ...defaultConfig, ...JSON.parse(raw) }
      }
    } catch (e) {
      console.warn('[DjModeEngine] Failed to load config:', e)
    }
    return { ...defaultConfig }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(DJ_MODE_STORAGE_KEY, JSON.stringify(this.config))
    } catch (e) {
      console.warn('[DjModeEngine] Failed to save config:', e)
    }
  }

  dispose(): void {
    this.listeners.clear()
    this.clearBeatMap()
  }
}

export const djModeEngine = new DjModeEngine()
