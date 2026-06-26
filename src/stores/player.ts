import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Song, PlayerStatus } from '@/types'
import { providerManager } from '@/modules/providers'
import { localMusicLibrary } from '@/modules/local'
import { playQueueStore } from './playQueue'
import {
  AudioAnalyzer,
  BeatMapData,
  BeatDetector,
  analyzePodcastDjStream,
  AudioEnhancer,
  Equalizer,
  AudioEffects,
} from '@/modules/audio'
import type {
  BeatMap,
  EnergyBands,
  RealtimeBeatState,
  CinemaDynamics,
  BeatEvent,
  DjModeState,
  BufferProgress,
  AudioError,
  EqPreset,
  AudioEffectsSettings,
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

  const audioEnhancer = ref<AudioEnhancer | null>(null)
  const bufferProgress = ref<BufferProgress>({ buffered: 0, duration: 0, percent: 0 })
  const lastError = ref<AudioError | null>(null)
  const fadeEnabled = ref(true)
  const replayGainEnabled = ref(false)

  const equalizer = ref<Equalizer | null>(null)
  const equalizerEnabled = ref(false)
  const equalizerPreset = ref<EqPreset>('flat')
  const equalizerGains = ref<number[]>(new Array(10).fill(0))

  const audioEffects = ref<AudioEffects | null>(null)
  const audioEffectsEnabled = ref(false)
  const audioEffectsSettings = ref<AudioEffectsSettings | null>(null)

  let animationFrameId: number | null = null
  let lastFrameTime = 0
  let isSwitchingSong = false

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
      if (audioEnhancer.value && fadeEnabled.value) {
        audioEnhancer.value.fadeIn(500)
      }
    })

    audio.value.addEventListener('pause', () => {
      status.value = 'paused'
    })

    audio.value.addEventListener('error', () => {
      status.value = 'error'
      console.error('Audio play error')
      handleAudioError()
    })

    audioEnhancer.value = new AudioEnhancer(audio.value)
    audioEnhancer.value.setBaseVolume(volume.value)
    audioEnhancer.value.setReplayGainEnabled(replayGainEnabled.value)

    audioEnhancer.value.onBufferProgress((p) => {
      bufferProgress.value = p
    })

    audioEnhancer.value.onError((err) => {
      lastError.value = err
    })

    audioEnhancer.value.onLoadTimeout(() => {
      console.warn('Audio load timeout')
      if (audioEnhancer.value?.canRetry()) {
        retryPlay()
      }
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

      initEqualizer()
      initAudioEffects()
      setupEffectChain()
    }
  }

  function initEqualizer(): void {
    if (!audioAnalyzer.value?.audioContext || !audioAnalyzer.value.source) return
    const eq = new Equalizer()
    const success = eq.init(audioAnalyzer.value.audioContext, audioAnalyzer.value.source)
    if (success) {
      equalizer.value = eq
    }
  }

  function initAudioEffects(): void {
    if (!audioAnalyzer.value?.audioContext) return
    const effects = new AudioEffects()
    const success = effects.init(audioAnalyzer.value.audioContext)
    if (success) {
      audioEffects.value = effects
      audioEffectsSettings.value = effects.getSettings()
    }
  }

  function setupEffectChain(): void {
    if (!audioAnalyzer.value) return

    const hasEq = equalizer.value && equalizerEnabled.value
    const hasEffects = audioEffects.value && audioEffectsEnabled.value

    if (!hasEq && !hasEffects) {
      audioAnalyzer.value.setPreEffectChain(null, null)
      return
    }

    let inputNode: AudioNode | null = null
    let outputNode: AudioNode | null = null

    if (hasEq && hasEffects && equalizer.value && audioEffects.value) {
      const eqInput = equalizer.value.getInputNode()
      const eqOutput = equalizer.value.getOutputNode()
      const effectsInput = audioEffects.value.inputNode
      const effectsOutput = audioEffects.value.outputNode
      if (eqInput && eqOutput && effectsInput && effectsOutput) {
        eqOutput.connect(effectsInput)
        inputNode = eqInput
        outputNode = effectsOutput
      }
    } else if (hasEq && equalizer.value) {
      const eqInput = equalizer.value.getInputNode()
      const eqOutput = equalizer.value.getOutputNode()
      if (eqInput && eqOutput) {
        inputNode = eqInput
        outputNode = eqOutput
      }
    } else if (hasEffects && audioEffects.value) {
      inputNode = audioEffects.value.inputNode
      outputNode = audioEffects.value.outputNode
    }

    if (inputNode && outputNode) {
      audioAnalyzer.value.setPreEffectChain(inputNode, outputNode)
    } else if (outputNode) {
      audioAnalyzer.value.setPreEffectChain(outputNode, outputNode)
    }
  }

  function setEqualizerEnabled(enabled: boolean): void {
    equalizerEnabled.value = enabled
    if (equalizer.value) {
      equalizer.value.setEnabled(enabled)
    }
    setupEffectChain()
  }

  function setEqualizerGain(bandIndex: number, gain: number): void {
    if (equalizer.value) {
      equalizer.value.setGain(bandIndex, gain)
      equalizerGains.value = equalizer.value.gains
      equalizerPreset.value = equalizer.value.preset
    }
  }

  function setEqualizerPreset(preset: EqPreset): void {
    if (equalizer.value) {
      equalizer.value.applyPreset(preset)
      equalizerGains.value = equalizer.value.gains
      equalizerPreset.value = preset
    }
  }

  function resetEqualizer(): void {
    if (equalizer.value) {
      equalizer.value.reset()
      equalizerGains.value = equalizer.value.gains
      equalizerPreset.value = equalizer.value.preset
    }
  }

  function setAudioEffectsEnabled(enabled: boolean): void {
    audioEffectsEnabled.value = enabled
    setupEffectChain()
  }

  function updateAudioEffects(settings: Partial<AudioEffectsSettings>): void {
    if (audioEffects.value) {
      audioEffects.value.setSettings(settings)
      audioEffectsSettings.value = audioEffects.value.getSettings()
    }
  }

  function resetAudioEffects(): void {
    if (audioEffects.value) {
      audioEffects.value.reset()
      audioEffectsSettings.value = audioEffects.value.getSettings()
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

  async function getSongUrl(song: Song): Promise<string | null> {
    if (song.source === 'local') {
      return localMusicLibrary.getSongUrl(song.id)
    }

    const provider = providerManager.get(song.source) || providerManager.default
    const result = await provider.getSongUrl(song.id)
    return result?.url || null
  }

  async function play(song: Song): Promise<void> {
    initAudio()
    if (!audio.value) return

    if (isSwitchingSong) return
    isSwitchingSong = true

    if (audioEnhancer.value && fadeEnabled.value && !audio.value.paused && currentSong.value) {
      await audioEnhancer.value.fadeOut(300)
    }

    currentSong.value = song
    status.value = 'loading'
    currentTime.value = 0
    clearBeatMap()
    lastError.value = null
    audioEnhancer.value?.resetRetry()

    if (audioEnhancer.value && replayGainEnabled.value) {
      audioEnhancer.value.applyReplayGainToSong(song.id)
    }

    try {
      const url = await getSongUrl(song)
      if (!url) {
        status.value = 'error'
        isSwitchingSong = false
        return
      }

      audio.value.src = url
      await audio.value.play()

      setTimeout(() => {
        analyzeCurrentSong()
      }, 500)
    } catch (e) {
      console.error('Play failed:', e)
      status.value = 'error'
    } finally {
      isSwitchingSong = false
    }
  }

  function togglePlay(): void {
    if (!audio.value || !currentSong.value) return
    if (status.value === 'playing') {
      if (audioEnhancer.value && fadeEnabled.value) {
        audioEnhancer.value.fadeOut(200).then(() => {
          audio.value?.pause()
        })
      } else {
        audio.value.pause()
      }
    } else if (status.value === 'paused') {
      audio.value.play()
    }
  }

  function pause(): void {
    if (audio.value && status.value === 'playing') {
      if (audioEnhancer.value && fadeEnabled.value) {
        audioEnhancer.value.fadeOut(200).then(() => {
          audio.value?.pause()
        })
      } else {
        audio.value.pause()
      }
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
    if (audioEnhancer.value) {
      audioEnhancer.value.setBaseVolume(newVolume)
    } else if (audio.value) {
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
    const nextSong = queue.getNext(playMode.value)
    if (nextSong) {
      play(nextSong)
    }
  }

  function prev(): void {
    const queue = playQueueStore()
    const prevSong = queue.getPrev(playMode.value)
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

  function handleAudioError(): void {
    if (audioEnhancer.value?.canRetry()) {
      retryPlay()
    }
  }

  function retryPlay(): void {
    if (!audio.value || !currentSong.value) return
    console.log(`Retrying playback (attempt ${audioEnhancer.value?.getRetryCount() || 0 + 1})`)
    audio.value.load()
    audio.value.play().catch(() => {
      console.error('Retry failed')
    })
  }

  function setPlayMode(mode: typeof playMode.value): void {
    playMode.value = mode
  }

  function cyclePlayMode(): void {
    const modes: typeof playMode.value[] = ['sequence', 'loop', 'single', 'shuffle']
    const idx = modes.indexOf(playMode.value)
    playMode.value = modes[(idx + 1) % modes.length]
  }

  function setFadeEnabled(enabled: boolean): void {
    fadeEnabled.value = enabled
  }

  function setReplayGainEnabled(enabled: boolean): void {
    replayGainEnabled.value = enabled
    if (audioEnhancer.value) {
      audioEnhancer.value.setReplayGainEnabled(enabled)
    }
  }

  function getBufferProgress(): BufferProgress {
    return bufferProgress.value
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
    bufferProgress,
    lastError,
    fadeEnabled,
    replayGainEnabled,
    equalizer,
    equalizerEnabled,
    equalizerPreset,
    equalizerGains,
    audioEffects,
    audioEffectsEnabled,
    audioEffectsSettings,
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
    setFadeEnabled,
    setReplayGainEnabled,
    getBufferProgress,
    retryPlay,
    setEqualizerEnabled,
    setEqualizerGain,
    setEqualizerPreset,
    resetEqualizer,
    setAudioEffectsEnabled,
    updateAudioEffects,
    resetAudioEffects,
  }
})
