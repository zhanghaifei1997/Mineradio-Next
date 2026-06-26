import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Song, PlayerStatus } from '@/types'
import { providerManager } from '@/modules/providers'
import { playQueueStore } from './playQueue'
import {
  AudioAnalyzer,
  BeatMapData,
  BeatDetector,
  analyzePodcastDjStream,
} from '@/modules/audio'
import type {
  BeatMap,
  EnergyBands,
  RealtimeBeatState,
  CinemaDynamics,
  BeatEvent,
  DjModeState,
} from '@/modules/audio'
import { djModeEngine } from '@/modules/dj'
import type { DjProgram, DjRadio } from '@/modules/dj'

const beatMapCache = new Map<string, BeatMap>()

export const usePlayerStore = defineStore('player', () => {
  const audio = ref<HTMLAudioElement | null>(null)
  const currentSong = ref<Song | null>(null)
  const status = ref<PlayerStatus>('idle')
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.7)
  const muted = ref(false)
  const speed = ref(1)
  const playMode = ref<'sequence' | 'loop' | 'single' | 'shuffle'>('sequence')

  const currentProgram = ref<DjProgram | null>(null)
  const currentRadio = ref<DjRadio | null>(null)
  const isPodcastMode = ref(false)

  const audioAnalyzer = ref<AudioAnalyzer | null>(null)
  const beatDetector = ref<BeatDetector | null>(null)
  const currentBeatMap = ref<BeatMapData | null>(null)
  const energyBands = ref<EnergyBands | null>(null)
  const beatState = ref<RealtimeBeatState | null>(null)
  const cinemaDynamics = ref<CinemaDynamics | null>(null)
  const isAnalyzing = ref(false)
  const beatMapReady = ref(false)
  const djMode = ref<DjModeState>(djModeEngine.getState())

  let animationFrameId: number | null = null
  let lastFrameTime = 0

  const isPlaying = computed(() => status.value === 'playing')
  const progress = computed(() => duration.value > 0 ? (currentTime.value / duration.value) * 100 : 0)
  const bpm = computed(() => currentBeatMap.value?.bpm || 0)

  function initAudio() {
    if (audio.value) return
    audio.value = new Audio()
    audio.value.volume = volume.value
    audio.value.playbackRate = speed.value

    audio.value.addEventListener('timeupdate', () => {
      currentTime.value = audio.value!.currentTime
    })

    audio.value.addEventListener('loadedmetadata', () => {
      duration.value = audio.value!.duration
    })

    audio.value.addEventListener('ended', () => {
      handleSongEnd()
    })

    audio.value.addEventListener('play', () => {
      status.value = 'playing'
      startAnalysisLoop()
    })

    audio.value.addEventListener('pause', () => {
      status.value = 'paused'
    })

    audio.value.addEventListener('error', () => {
      status.value = 'error'
      console.error('Audio play error')
    })

    initAudioAnalyzer()
  }

  function initAudioAnalyzer(): void {
    if (!audio.value || audioAnalyzer.value) return
    const analyzer = new AudioAnalyzer()
    const success = analyzer.init(audio.value)
    if (success) {
      audioAnalyzer.value = analyzer
      beatDetector.value = new BeatDetector()
      beatState.value = analyzer.beatState
      cinemaDynamics.value = analyzer.cinemaDynamics
    }
  }

  function startAnalysisLoop(): void {
    if (animationFrameId !== null || !audioAnalyzer.value) return
    lastFrameTime = performance.now()

    function loop() {
      const now = performance.now()
      const dt = (now - lastFrameTime) / 1000
      lastFrameTime = now

      if (audioAnalyzer.value && audio.value && !audio.value.paused) {
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

        checkBeatMapBeats(audio.value.currentTime)
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
    djModeEngine.processBeat(beat, audio.value?.currentTime || 0)
    djMode.value = djModeEngine.getState()
  }

  async function analyzeCurrentSong(): Promise<BeatMap | null> {
    if (!currentSong.value || !audio.value?.src) return null

    const songId = currentSong.value.id
    const cacheKey = `${currentSong.value.source}:${songId}`

    if (beatMapCache.has(cacheKey)) {
      const cached = beatMapCache.get(cacheKey)!
      currentBeatMap.value = BeatMapData.fromBeatMap(cached)
      beatMapReady.value = true
      return cached
    }

    isAnalyzing.value = true
    beatMapReady.value = false

    try {
      const beatMap = await analyzePodcastDjStream(audio.value.src, {
        durationSec: duration.value,
      })

      beatMapCache.set(cacheKey, beatMap)
      currentBeatMap.value = BeatMapData.fromBeatMap(beatMap)
      beatMapReady.value = true

      return beatMap
    } catch (e) {
      console.error('Beat analysis failed:', e)
      return null
    } finally {
      isAnalyzing.value = false
    }
  }

  function setDjModeActive(active: boolean, songKey = ''): void {
    if (active) {
      djModeEngine.activate(songKey)
    } else {
      djModeEngine.deactivate()
    }
    djMode.value = djModeEngine.getState()
  }

  function resetDjModeMeter(): void {
    djModeEngine.resetMeters()
    djMode.value = djModeEngine.getState()
  }

  function seekBeatMap(time: number): void {
    currentBeatMap.value?.seekTo(time)
  }

  function clearBeatMap(): void {
    currentBeatMap.value = null
    beatMapReady.value = false
  }

  async function play(song: Song): Promise<void> {
    initAudio()
    if (!audio.value) return

    currentSong.value = song
    status.value = 'loading'
    currentTime.value = 0
    clearBeatMap()

    try {
      const provider = providerManager.get(song.source) || providerManager.default
      const result = await provider.getSongUrl(song.id)
      if (!result?.url) {
        status.value = 'error'
        return
      }

      audio.value.src = result.url
      await audio.value.play()

      setTimeout(() => {
        analyzeCurrentSong()
      }, 500)
    } catch (e) {
      console.error('Play failed:', e)
      status.value = 'error'
    }
  }

  function togglePlay(): void {
    if (!audio.value || !currentSong.value) return
    if (status.value === 'playing') {
      audio.value.pause()
    } else if (status.value === 'paused') {
      audio.value.play()
    }
  }

  function pause(): void {
    if (audio.value && status.value === 'playing') {
      audio.value.pause()
    }
  }

  function resume(): void {
    if (audio.value && status.value === 'paused') {
      audio.value.play()
    }
  }

  function seek(time: number): void {
    if (audio.value) {
      audio.value.currentTime = Math.max(0, Math.min(time, duration.value))
      seekBeatMap(time)
    }
  }

  function setVolume(v: number): void {
    const newVolume = Math.max(0, Math.min(1, v))
    volume.value = newVolume
    if (audio.value) {
      audio.value.volume = newVolume
    }
    if (newVolume > 0 && muted.value) {
      muted.value = false
    }
  }

  function toggleMute(): void {
    muted.value = !muted.value
    if (audio.value) {
      audio.value.muted = muted.value
    }
  }

  function setSpeed(s: number): void {
    speed.value = Math.max(0.5, Math.min(2, s))
    if (audio.value) {
      audio.value.playbackRate = speed.value
    }
  }

  function next(): void {
    const queue = playQueueStore()
    const nextSong = queue.getNext()
    if (nextSong) {
      play(nextSong)
    }
  }

  function prev(): void {
    const queue = playQueueStore()
    const prevSong = queue.getPrev()
    if (prevSong) {
      play(prevSong)
    }
  }

  function handleSongEnd(): void {
    if (playMode.value === 'single') {
      if (audio.value) {
        audio.value.currentTime = 0
        audio.value.play()
      }
      return
    }
    next()
  }

  function setPlayMode(mode: typeof playMode.value): void {
    playMode.value = mode
  }

  function cyclePlayMode(): void {
    const modes: typeof playMode.value[] = ['sequence', 'loop', 'single', 'shuffle']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length]
  }

  async function playProgram(program: DjProgram, radio?: DjRadio): Promise<void> {
    if (!program.id) return

    currentProgram.value = program
    currentRadio.value = radio || null
    isPodcastMode.value = true

    const song: Song = {
      id: program.id,
      name: program.name,
      artists: program.dj
        ? [{ id: program.dj.userId, name: program.dj.nickname, avatar: program.dj.avatarUrl }]
        : [],
      album: radio
        ? { id: radio.id, name: radio.name, coverUrl: radio.picUrl }
        : undefined,
      duration: program.duration / 1000,
      source: 'netease-dj',
      coverUrl: program.coverUrl || radio?.picUrl,
      isPodcast: true,
      djProgramId: program.id,
    }

    await play(song)
  }

  function clearPodcastMode(): void {
    currentProgram.value = null
    currentRadio.value = null
    isPodcastMode.value = false
  }

  function startDjTransition(fromKey: string, toKey: string): void {
    djModeEngine.startTransition(fromKey, toKey)
  }

  function getDjVisualMultiplier(): number {
    return djModeEngine.getVisualMultiplier()
  }

  function getDjCameraShakeIntensity(): number {
    return djModeEngine.getCameraShakeIntensity()
  }

  function getDjParticleBoost(): number {
    return djModeEngine.getParticleBoost()
  }

  return {
    currentSong,
    status,
    currentTime,
    duration,
    volume,
    muted,
    speed,
    playMode,
    currentProgram,
    currentRadio,
    isPodcastMode,
    isPlaying,
    progress,
    bpm,
    audioAnalyzer,
    beatDetector,
    currentBeatMap,
    energyBands,
    beatState,
    cinemaDynamics,
    isAnalyzing,
    beatMapReady,
    djMode,
    initAudio,
    play,
    togglePlay,
    pause,
    resume,
    seek,
    setVolume,
    toggleMute,
    setSpeed,
    next,
    prev,
    setPlayMode,
    cyclePlayMode,
    analyzeCurrentSong,
    setDjModeActive,
    resetDjModeMeter,
    clearBeatMap,
    stopAnalysisLoop,
    playProgram,
    clearPodcastMode,
    startDjTransition,
    getDjVisualMultiplier,
    getDjCameraShakeIntensity,
    getDjParticleBoost,
  }
})
