import { ref, computed, onUnmounted, watch } from 'vue'
import {
  AudioAnalyzer,
  BeatMapData,
  BeatDetector,
  analyzePodcastDjStream,
  analyzePodcastDjIntro,
} from '@/modules/audio'
import type {
  BeatMap,
  EnergyBands,
  RealtimeBeatState,
  CinemaDynamics,
  BeatEvent,
  DjModeState,
} from '@/modules/audio'

export interface UseAudioAnalyzerOptions {
  autoAnalyze?: boolean
  djModeEnabled?: boolean
  introOnly?: boolean
  introSec?: number
}

const beatMapCache = new Map<string, BeatMap>()

export function useAudioAnalyzer(options: UseAudioAnalyzerOptions = {}) {
  const audioAnalyzer = ref<AudioAnalyzer | null>(null)
  const beatDetector = ref<BeatDetector | null>(null)
  const currentBeatMap = ref<BeatMapData | null>(null)
  const energyBands = ref<EnergyBands | null>(null)
  const beatState = ref<RealtimeBeatState | null>(null)
  const cinemaDynamics = ref<CinemaDynamics | null>(null)
  const isAnalyzing = ref(false)
  const analyzeProgress = ref(0)
  const beatMapReady = ref(false)

  const djMode = ref<DjModeState>({
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
  })

  let animationFrameId: number | null = null
  let lastFrameTime = 0
  let currentAudioElement: HTMLAudioElement | null = null

  const bpm = computed(() => {
    return currentBeatMap.value?.bpm || 0
  })

  const isPlaying = computed(() => {
    return currentAudioElement ? !currentAudioElement.paused : false
  })

  function init(audioElement: HTMLAudioElement): boolean {
    if (audioAnalyzer.value) return true
    currentAudioElement = audioElement
    const analyzer = new AudioAnalyzer()
    const success = analyzer.init(audioElement)
    if (success) {
      audioAnalyzer.value = analyzer
      beatDetector.value = new BeatDetector()
      beatState.value = analyzer.beatState
      cinemaDynamics.value = analyzer.cinemaDynamics
      return true
    }
    return false
  }

  async function resume(): Promise<void> {
    await audioAnalyzer.value?.resume()
  }

  function startAnalysisLoop(): void {
    if (animationFrameId !== null) return
    lastFrameTime = performance.now()

    function loop() {
      const now = performance.now()
      const dt = (now - lastFrameTime) / 1000
      lastFrameTime = now

      if (audioAnalyzer.value && currentAudioElement && !currentAudioElement.paused) {
        const energy = audioAnalyzer.value.analyzeEnergy()
        if (energy) {
          energyBands.value = energy
        }
        const beatDetected = audioAnalyzer.value.detectBeat(dt)
        beatState.value = { ...audioAnalyzer.value.beatState }
        cinemaDynamics.value = { ...audioAnalyzer.value.cinemaDynamics }

        if (beatDetected && beatDetector.value) {
          beatDetector.value.detectFromEnergy(
            beatState.value.bass,
            beatState.value.bassAvg,
            now / 1000
          )
        }

        checkBeatMapBeats(currentAudioElement.currentTime)
      }

      animationFrameId = requestAnimationFrame(loop)
    }

    animationFrameId = requestAnimationFrame(loop)
  }

  function stopAnalysisLoop(): void {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function checkBeatMapBeats(currentTime: number): BeatEvent | null {
    if (!currentBeatMap.value || !beatMapReady.value) return null
    const nextBeat = currentBeatMap.value.getNextBeat(currentTime)
    if (nextBeat && nextBeat.time <= currentTime + 0.05) {
      updateDjModeOnBeat(nextBeat)
      return nextBeat
    }
    return null
  }

  function updateDjModeOnBeat(beat: BeatEvent): void {
    const now = performance.now() / 1000
    djMode.value.lastBeatAt = now
    djMode.value.visualPulse = Math.min(1, beat.impact * 1.5)
    djMode.value.sectionEnergy = djMode.value.sectionEnergy * 0.92 + beat.strength * 0.08
    djMode.value.sectionLow = djMode.value.sectionLow * 0.90 + beat.low * 0.10
    djMode.value.tempoConfidence = Math.max(djMode.value.tempoConfidence * 0.98, beat.confidence)
  }

  async function analyzeSong(
    audioUrl: string,
    songId: string,
    durationSec?: number
  ): Promise<BeatMap | null> {
    if (!audioUrl) return null

    const cacheKey = songId
    if (beatMapCache.has(cacheKey)) {
      const cached = beatMapCache.get(cacheKey)!
      currentBeatMap.value = BeatMapData.fromBeatMap(cached)
      beatMapReady.value = true
      return cached
    }

    isAnalyzing.value = true
    analyzeProgress.value = 0
    beatMapReady.value = false

    try {
      let beatMap: BeatMap

      if (options.introOnly && durationSec && durationSec > 240) {
        beatMap = await analyzePodcastDjIntro(audioUrl, {
          durationSec,
          introSec: options.introSec || 180,
        })
      } else {
        beatMap = await analyzePodcastDjStream(audioUrl, {
          durationSec,
        })
      }

      beatMapCache.set(cacheKey, beatMap)
      currentBeatMap.value = BeatMapData.fromBeatMap(beatMap)
      beatMapReady.value = true
      analyzeProgress.value = 1

      return beatMap
    } catch (e) {
      console.error('Beat analysis failed:', e)
      return null
    } finally {
      isAnalyzing.value = false
    }
  }

  function setDjModeActive(active: boolean, songKey = ''): void {
    djMode.value.active = active
    djMode.value.songKey = songKey
    if (active) {
      djMode.value.startedAt = performance.now()
      resetDjModeMeter()
    }
  }

  function resetDjModeMeter(): void {
    djMode.value.tempoGap = 0
    djMode.value.tempoConfidence = 0
    djMode.value.sectionEnergy = 0
    djMode.value.sectionLow = 0
    djMode.value.sectionChange = 0
    djMode.value.visualPulse = 0
    djMode.value.lastBeatAt = -10
  }

  function seekBeatMap(time: number): void {
    currentBeatMap.value?.seekTo(time)
  }

  function clearBeatMap(): void {
    currentBeatMap.value = null
    beatMapReady.value = false
    beatMapCache.clear()
  }

  function reset(): void {
    audioAnalyzer.value?.reset()
    beatDetector.value?.reset()
    energyBands.value = null
    beatState.value = null
    cinemaDynamics.value = null
    currentBeatMap.value = null
    beatMapReady.value = false
    isAnalyzing.value = false
    analyzeProgress.value = 0
    resetDjModeMeter()
  }

  function dispose(): void {
    stopAnalysisLoop()
    audioAnalyzer.value?.dispose()
    audioAnalyzer.value = null
    beatDetector.value = null
    currentBeatMap.value = null
    energyBands.value = null
    beatState.value = null
    cinemaDynamics.value = null
    currentAudioElement = null
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    audioAnalyzer,
    beatDetector,
    currentBeatMap,
    energyBands,
    beatState,
    cinemaDynamics,
    isAnalyzing,
    analyzeProgress,
    beatMapReady,
    djMode,
    bpm,
    isPlaying,
    init,
    resume,
    startAnalysisLoop,
    stopAnalysisLoop,
    analyzeSong,
    setDjModeActive,
    resetDjModeMeter,
    seekBeatMap,
    clearBeatMap,
    reset,
    dispose,
  }
}
