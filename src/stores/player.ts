import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Song, PlayerStatus, QualityLevel, MusicSource } from '@/types'
import { providerManager } from '@/modules/providers'
import type { SongUrlResult } from '@/modules/providers'
import { localMusicLibrary } from '@/modules/local'
import { playQueueStore } from './playQueue'
import { useNotificationStore } from './notification'
import { useUserStore } from './user'
import {
  AudioAnalyzer,
  BeatMapData,
  BeatDetector,
  analyzePodcastDjStream,
  AudioEnhancer,
  Equalizer,
  AudioEffects,
  MockBeatGenerator,
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

const QUALITY_STORAGE_KEY = 'mineradio-playback-quality-v1'
const QUALITY_STORAGE_KEY_LEGACY = 'mineradio_player_quality'
const VOLUME_STORAGE_KEY = 'apex-player-volume'
const CONTINUE_KEY = 'mineradio_continue_listening'

function loadSavedVolume(): number {
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY)
    if (saved !== null) {
      const parsed = parseFloat(saved)
      if (!Number.isNaN(parsed)) {
        return Math.max(0, Math.min(1, parsed))
      }
    }
  } catch (e) {
    console.warn('Failed to load volume setting:', e)
  }
  return 0.75
}

const beatMapCache = new Map<string, BeatMap>()

// ============================================================================
// 竞态保护与错误恢复相关常量与工具函数
// ============================================================================

/** 失败项冷却时间（ms），冷却期内跳过该队列项 */
const PLAYBACK_FAIL_COOLDOWN_MS = 18000
/** 跨源回退最大递归深度 */
const MAX_FALLBACK_DEPTH = 3
/** QQ 音质降级重试顺序：无损 → 极高 → 较高 → 标准 */
const QQ_QUALITY_FALLBACK_ORDER: QualityLevel[] = ['lossless', 'exhigh', 'higher', 'standard']

/** 播放选项：在 play() / playQueueAt() 之间传递的保护参数 */
export interface PlayOptions {
  /** 当前跨源回退深度，0 表示首次播放 */
  fallbackDepth?: number
  /** 强制使用的音质（用于 QQ 音质降级重试） */
  qualityOverride?: QualityLevel
  /** 已尝试过的 QQ 音质列表，避免循环重试 */
  qqQualityTried?: QualityLevel[]
  /** 是否为用户主动操作（手动失败时不自动跳到下一首） */
  manual?: boolean
}

/** 标准化文本：用于标题/歌手严格匹配 */
function normalizeMatchText(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s·・\-—_.,，。:：'"“”‘’/\\|]+/g, '')
}

/** 提取歌曲的歌手名片段（兼容 artists 数组与 artist 字符串） */
function artistNameParts(song: Song): string[] {
  const parts: string[] = []
  if (song && Array.isArray(song.artists)) {
    song.artists.forEach((a) => {
      if (a && a.name) parts.push(a.name)
    })
  }
  // 运行时部分歌曲对象可能携带 artist 字符串字段
  const artistStr = (song as any).artist as string | undefined
  if (artistStr) {
    String(artistStr)
      .split(/\s*\/\s*|\s*,\s*|、|&| feat\.? | ft\.? /i)
      .forEach((name) => {
        if (name && name.trim()) parts.push(name.trim())
      })
  }
  return parts.map(normalizeMatchText).filter(Boolean)
}

/**
 * 严格匹配两首歌的标题与歌手
 * 用于跨源回退时避免取到同名但不同歌手的版本
 */
export function isSameTitleArtist(a: Song, b: Song): boolean {
  if (!a || !b) return false
  const norm = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[\s\-\(\)（）]/g, '')
      .replace(/feat\..*$/i, '')
  const getArtist = (song: Song): string => {
    const explicit = (song as any).artist as string | undefined
    if (explicit) return explicit
    return (song.artists || []).map((ar) => ar.name).join('')
  }
  return norm(a.name) === norm(b.name) && norm(getArtist(a)) === norm(getArtist(b))
}

/** 检测是否为递归栈溢出错误（RangeError / maximum call stack size exceeded） */
export function isPlaybackRecursionError(err: unknown): boolean {
  const msg = String((err instanceof Error && err.message) || err || '')
  return err instanceof RangeError || /maximum call stack size exceeded/i.test(msg)
}

/** 跨源回退的目标音源：QQ ↔ 网易云 */
function alternatePlaybackSource(source: string): string {
  return source === 'qqmusic' ? 'netease' : 'qqmusic'
}

/** 将 API 返回的音质字符串映射为内部 QualityLevel */
function mapQualityLevel(q: string | undefined): QualityLevel | null {
  if (!q) return null
  const map: Record<string, QualityLevel> = {
    standard: 'standard',
    higher: 'higher',
    exhigh: 'exhigh',
    lossless: 'lossless',
    hires: 'hires',
    jymaster: 'hires',
  }
  return map[q] || null
}

function songQueueKey(song: Song): string {
  return `${song.source}:${song.id}`
}

export interface ContinueListeningData {
  queue: Song[]
  currentIndex: number
  currentTime: number
  lastPlayedAt: number
  playlistName?: string
  playlistCover?: string
}

function loadContinueData(): ContinueListeningData | null {
  try {
    const raw = localStorage.getItem(CONTINUE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (_) {}
  return null
}

function saveContinueData(data: ContinueListeningData): void {
  try {
    localStorage.setItem(CONTINUE_KEY, JSON.stringify(data))
  } catch (_) {}
}

export const usePlayerStore = defineStore('player', () => {
  const audio = ref<HTMLAudioElement | null>(null)
  const currentSong = ref<Song | null>(null)
  const status = ref<PlayerStatus>('idle')
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref<number>(loadSavedVolume())
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

  const currentQuality = ref<QualityLevel>(loadQuality())
  const wifiQuality = ref<QualityLevel>('exhigh')
  const mobileQuality = ref<QualityLevel>('standard')
  const continueListening = ref<ContinueListeningData | null>(loadContinueData())

  const audioDevices = ref<MediaDeviceInfo[]>([])
  const currentOutputDeviceId = ref<string>(loadOutputDevice())

  const startupVisualPreviewActive = ref(false)
  const mockBeatGenerator = ref<MockBeatGenerator | null>(null)

  // ---- 竞态保护与错误恢复状态 ----
  /** 切歌令牌：每次 play()/playQueueAt() 递增，异步步骤校验以防止旧请求覆盖新状态 */
  const trackSwitchToken = ref(0)
  /** 播放互斥锁：togglePlay 期间阻止重复触发 */
  const playToggleBusy = ref(false)
  /** 播放阶段标记：用于错误诊断，报告失败发生在哪个阶段 */
  const playPhase = ref<string>('start')
  /** 试听片段提示：{ show, text, loginRequired } */
  const trialBanner = ref<{ show: boolean; text: string; loginRequired: boolean }>({
    show: false,
    text: '',
    loginRequired: false,
  })
  /** 失败冷却记录：key = `${source}:${id}`，value = 失败时间戳（ms） */
  const lastPlaybackFailAt = ref<Record<string, number>>({})

  let animationFrameId: number | null = null
  let lastFrameTime = 0
  let mockAnimationFrameId: number | null = null

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
    refreshAudioDevices()

    const savedDevice = loadOutputDevice()
    if (savedDevice && savedDevice !== 'default') {
      setOutputDevice(savedDevice)
    }
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

  function startStartupVisualPreview(): void {
    if (startupVisualPreviewActive.value) return
    if (status.value === 'playing') return

    if (!mockBeatGenerator.value) {
      mockBeatGenerator.value = new MockBeatGenerator({
        bpm: 100,
        minEnergy: 0.3,
        maxEnergy: 0.55,
        bassBias: 1.25,
        randomVariation: 0.12,
      })
    }

    mockBeatGenerator.value.start()
    startupVisualPreviewActive.value = true

    const initialBeat = mockBeatGenerator.value.beatState
    const initialCinema = mockBeatGenerator.value.cinemaDynamics
    const initialEnergy = mockBeatGenerator.value.energyBands

    beatState.value = { ...initialBeat }
    cinemaDynamics.value = { ...initialCinema }
    energyBands.value = { ...initialEnergy }

    startMockBeatLoop()
  }

  function stopStartupVisualPreview(): void {
    if (!startupVisualPreviewActive.value) return

    startupVisualPreviewActive.value = false
    stopMockBeatLoop()

    if (mockBeatGenerator.value) {
      mockBeatGenerator.value.stop()
    }
  }

  function startMockBeatLoop(): void {
    if (mockAnimationFrameId !== null) return

    let mockLastFrameTime = performance.now()

    function mockLoop() {
      const now = performance.now()
      const dt = (now - mockLastFrameTime) / 1000
      mockLastFrameTime = now

      if (mockBeatGenerator.value && startupVisualPreviewActive.value) {
        mockBeatGenerator.value.update(dt)
        beatState.value = { ...mockBeatGenerator.value.beatState }
        cinemaDynamics.value = { ...mockBeatGenerator.value.cinemaDynamics }
        energyBands.value = { ...mockBeatGenerator.value.energyBands }
      }

      mockAnimationFrameId = requestAnimationFrame(mockLoop)
    }

    mockAnimationFrameId = requestAnimationFrame(mockLoop)
  }

  function stopMockBeatLoop(): void {
    if (mockAnimationFrameId !== null) {
      cancelAnimationFrame(mockAnimationFrameId)
      mockAnimationFrameId = null
    }
  }

  function toggleStartupVisualPreview(force?: boolean): void {
    const shouldActivate = force !== undefined ? force : !startupVisualPreviewActive.value
    if (shouldActivate) {
      startStartupVisualPreview()
    } else {
      stopStartupVisualPreview()
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

  async function getSongUrl(song: Song, quality?: QualityLevel): Promise<string | null> {
    if (song.source === 'local') {
      return localMusicLibrary.getSongUrl(song.id)
    }

    const provider = providerManager.get(song.source) || providerManager.default
    const result = await provider.getSongUrl(song.id, quality || currentQuality.value)
    return result?.url || null
  }

  /**
   * 获取歌曲播放 URL 及其元信息（trial / level / restriction 等）
   * 用于 play() 中的试听片段检测、login_required 判定与音质降级诊断
   */
  async function getSongUrlWithMeta(
    song: Song,
    quality?: QualityLevel
  ): Promise<SongUrlResult | null> {
    if (song.source === 'local') {
      const url = await localMusicLibrary.getSongUrl(song.id)
      if (!url) return null
      return { url, quality: quality || currentQuality.value }
    }

    const provider = providerManager.get(song.source) || providerManager.default
    const result = await provider.getSongUrl(song.id, quality || currentQuality.value)
    return result
  }

  async function getSupportedQualities(song: Song): Promise<QualityLevel[]> {
    if (song.source === 'local') {
      return ['standard', 'higher', 'exhigh', 'lossless']
    }

    const allQualities: QualityLevel[] = ['standard', 'higher', 'exhigh', 'lossless', 'hires']
    const supported: QualityLevel[] = []

    for (const quality of allQualities) {
      try {
        const provider = providerManager.get(song.source) || providerManager.default
        const result = await provider.getSongUrl(song.id, quality)
        if (result?.url) {
          supported.push(quality)
        }
      } catch {
        continue
      }
    }

    return supported.length > 0 ? supported : ['exhigh']
  }

  function setQuality(quality: QualityLevel): void {
    currentQuality.value = quality
    saveQuality(quality)
  }

  function setWifiQuality(quality: QualityLevel): void {
    wifiQuality.value = quality
  }

  function setMobileQuality(quality: QualityLevel): void {
    mobileQuality.value = quality
  }

  async function switchQuality(quality: QualityLevel): Promise<void> {
    if (!currentSong.value || !audio.value) return

    const wasPlaying = !audio.value.paused
    const currentTime = audio.value.currentTime

    setQuality(quality)

    try {
      const url = await getSongUrl(currentSong.value, quality)
      if (!url) return

      audio.value.src = url
      audio.value.currentTime = currentTime

      if (wasPlaying) {
        await audio.value.play()
      }
    } catch (e) {
      console.error('Switch quality failed:', e)
    }
  }

  function loadQuality(): QualityLevel {
    try {
      const saved = localStorage.getItem(QUALITY_STORAGE_KEY)
        ?? localStorage.getItem(QUALITY_STORAGE_KEY_LEGACY)
      if (saved && ['standard', 'higher', 'exhigh', 'lossless', 'hires'].includes(saved)) {
        return saved as QualityLevel
      }
    } catch (e) {
      console.warn('Failed to load quality setting:', e)
    }
    return 'exhigh'
  }

  function saveQuality(quality: QualityLevel): void {
    try {
      localStorage.setItem(QUALITY_STORAGE_KEY, quality)
      try {
        localStorage.removeItem(QUALITY_STORAGE_KEY_LEGACY)
      } catch (_) {}
    } catch (e) {
      console.warn('Failed to save quality setting:', e)
    }
  }

  async function refreshAudioDevices(): Promise<void> {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        console.warn('MediaDevices API not available')
        return
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioOutputDevices = devices.filter(d => d.kind === 'audiooutput')
      audioDevices.value = audioOutputDevices
    } catch (e) {
      console.warn('Failed to enumerate audio devices:', e)
    }
  }

  async function setOutputDevice(deviceId: string): Promise<void> {
    if (!audio.value) {
      initAudio()
    }

    if (!audio.value) return

    try {
      const audioEl = audio.value as HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }
      if (typeof audioEl.setSinkId === 'function') {
        await audioEl.setSinkId(deviceId)
        currentOutputDeviceId.value = deviceId
        localStorage.setItem('mineradio_output_device', deviceId)
      } else {
        console.warn('setSinkId not supported')
      }
    } catch (e) {
      console.error('Failed to set output device:', e)
    }
  }

  function saveContinueListening(playlistName?: string, playlistCover?: string): void {
    const queueStore = playQueueStore()
    if (queueStore.queue.length === 0 || !currentSong.value) return
    
    const data: ContinueListeningData = {
      queue: [...queueStore.queue],
      currentIndex: queueStore.currentIndex,
      currentTime: currentTime.value,
      lastPlayedAt: Date.now(),
      playlistName,
      playlistCover,
    }
    continueListening.value = data
    saveContinueData(data)
  }

  async function continueFromLast(): Promise<boolean> {
    if (!continueListening.value) return false
    
    const data = continueListening.value
    if (data.queue.length === 0) return false
    
    const queueStore = playQueueStore()
    queueStore.setQueue(data.queue, data.currentIndex)
    
    const song = data.queue[data.currentIndex]
    if (song) {
      await play(song)
      setTimeout(() => {
        if (audio.value && data.currentTime > 0) {
          audio.value.currentTime = data.currentTime
        }
      }, 500)
      return true
    }
    return false
  }

  function hasContinueData(): boolean {
    return continueListening.value !== null && continueListening.value.queue.length > 0
  }

  function clearContinueListening(): void {
    continueListening.value = null
    try {
      localStorage.removeItem(CONTINUE_KEY)
    } catch (_) {}
  }

  function loadOutputDevice(): string {
    try {
      const saved = localStorage.getItem('mineradio_output_device')
      return saved || 'default'
    } catch {
      return 'default'
    }
  }

  async function play(song: Song, opts: PlayOptions = {}): Promise<void> {
    initAudio()
    if (!audio.value) return

    // 切歌令牌递增：使此前所有异步请求失效
    trackSwitchToken.value++
    const token = trackSwitchToken.value

    // 阶段追踪：用于错误诊断
    const markPhase = (name: string) => {
      playPhase.value = name
    }
    markPhase('start')

    markPhase('session-finalize')
    stopStartupVisualPreview()

    markPhase('cancel-previous-track')
    if (audioEnhancer.value && fadeEnabled.value && !audio.value.paused && currentSong.value) {
      try {
        await audioEnhancer.value.fadeOut(300)
      } catch (_) {}
    }
    // 令牌校验：fade 期间可能已有新的 play() 触发
    if (token !== trackSwitchToken.value) return

    markPhase('track-setup')
    currentSong.value = song
    status.value = 'loading'
    currentTime.value = 0
    clearBeatMap()
    lastError.value = null
    audioEnhancer.value?.resetRetry()
    // 重置试听提示
    trialBanner.value = { show: false, text: '', loginRequired: false }

    if (audioEnhancer.value && replayGainEnabled.value) {
      audioEnhancer.value.applyReplayGainToSong(song.id)
    }

    markPhase('lyric-prep')
    // 歌词由 useLyrics composable 监听 currentSong 变化处理，此处仅标记阶段

    markPhase('cover-load')
    // 封面由 useCoverColor composable 监听 currentSong 变化处理，此处仅标记阶段

    markPhase('source-url')
    try {
      const requestedQuality = opts.qualityOverride || currentQuality.value
      const result = await getSongUrlWithMeta(song, requestedQuality)
      // 令牌校验：URL 获取期间可能已有新的 play() 触发
      if (token !== trackSwitchToken.value) return

      if (!result || !result.url) {
        // QQ 音质降级重试：无损 → 极高 → 较高 → 标准
        if (
          song.source === 'qqmusic' &&
          (await retryQQPlaybackWithCompatibleQuality(song, token, opts, result, requestedQuality))
        ) {
          return
        }
        // 跨源回退：查找同名同歌手的另一平台版本
        if ((await tryAutoPlaybackFallback(song, result, token, opts))) {
          return
        }
        // 无法播放：处理 login_required 等情况
        handlePlaybackUnavailable(song, result)
        status.value = 'error'
        return
      }

      // 试听片段检测：区分 vip / svip / 未登录 文案
      if (result.trial) {
        const user = useUserStore()
        const account = user.getAccount(song.source as MusicSource)
        const loggedIn = account.loggedIn
        let text: string
        if (loggedIn && account.profile?.isSvip) {
          text = '此歌曲需要单曲、专辑购买或更高权限'
        } else if (loggedIn && account.profile?.vipLevel === 'vip') {
          text = '此歌曲需要 SVIP 或购买 · 当前仅播放试听片段'
        } else if (loggedIn) {
          text = '此歌曲需 VIP · 当前仅播放试听片段'
        } else {
          text = '当前未登录 · 仅播放试听片段'
        }
        trialBanner.value = { show: true, text, loginRequired: !loggedIn }
      }

      markPhase('audio-element')
      audio.value.src = result.url

      markPhase('visual-prep')
      // 重置可视化状态由现有监听器处理

      markPhase('audio-start')
      await audio.value.play()
      // 令牌校验：play() 启动期间可能已有新的 play() 触发
      if (token !== trackSwitchToken.value) return

      markPhase('session-begin')
      // 播放成功后通知
      const notification = useNotificationStore()
      notification.notifyTrackChange(song)

      markPhase('lyrics-fetch')
      setTimeout(() => {
        if (token !== trackSwitchToken.value) return
        analyzeCurrentSong()
      }, 500)
    } catch (e) {
      // 令牌校验：失败时若已有新 play() 触发，则不处理旧错误
      if (token !== trackSwitchToken.value) return
      console.error('Play failed:', { phase: playPhase.value, error: e }, e)

      // login_required 检测：错误信息中包含则自动打开登录弹窗
      const errMsg = e instanceof Error ? e.message : String(e)
      if (/login_required/i.test(errMsg)) {
        const user = useUserStore()
        user.showLoginModal(song.source as MusicSource)
      }

      // 递归保护：栈溢出错误不再触发跳过/回退
      if (isPlaybackRecursionError(e)) {
        status.value = 'error'
        return
      }

      // 非手动操作且队列有多首时，自动跳过失败项
      if (!opts.manual) {
        const queue = playQueueStore()
        if (queue.queue.length > 1) {
          skipFailedQueueItem(song, token, '当前歌曲加载失败，正在尝试队列里的下一首。')
          return
        }
      }
      status.value = 'error'
    }
  }

  async function togglePlay(): Promise<void> {
    // 互斥锁：防止快速连点导致的播放/暂停状态混乱
    if (playToggleBusy.value) return
    playToggleBusy.value = true
    try {
      if (!audio.value || !currentSong.value) return
      if (status.value === 'playing') {
        if (audioEnhancer.value && fadeEnabled.value) {
          try {
            await audioEnhancer.value.fadeOut(200)
          } catch (_) {}
          audio.value?.pause()
        } else {
          audio.value.pause()
        }
      } else if (status.value === 'paused') {
        try {
          await audio.value.play()
        } catch (e) {
          console.warn('[TogglePlay] resume failed:', e)
        }
      }
    } catch (e) {
      console.warn('[TogglePlay]', e)
    } finally {
      playToggleBusy.value = false
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
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, newVolume.toString())
    } catch (e) {
      console.warn('Failed to save volume setting:', e)
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
    // 重置互斥锁，防止 togglePlay 卡死
    playToggleBusy.value = false
    const queue = playQueueStore()
    const nextSong = queue.getNext(playMode.value)
    if (nextSong) {
      play(nextSong)
    }
  }

  function prev(): void {
    // 重置互斥锁，防止 togglePlay 卡死
    playToggleBusy.value = false
    const queue = playQueueStore()
    const prevSong = queue.getPrev(playMode.value)
    if (prevSong) {
      play(prevSong)
    }
  }

  /**
   * 按队列索引播放：playQueueAt 是 play() 的队列入口，
   * 与 play() 共享同一套 token 保护机制。
   */
  async function playQueueAt(idx: number, opts: PlayOptions = {}): Promise<void> {
    const queue = playQueueStore()
    if (idx < 0 || idx >= queue.queue.length) return
    queue.setCurrentIndex(idx)
    const song = queue.queue[idx]
    if (song) {
      await play(song, opts)
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
    } else {
      tryFallbackSource()
    }
  }

  function retryPlay(): void {
    if (!audio.value || !currentSong.value) return
    const attempt = (audioEnhancer.value?.getRetryCount() || 0) + 1
    console.log(`Retrying playback (attempt ${attempt})`)
    audio.value.load()
    audio.value.play().catch(() => {
      console.error('Retry failed')
      tryFallbackSource()
    })
  }

  /**
   * 跨源回退：搜索同名同歌手的另一平台版本
   * - 严格匹配 isSameTitleArtist，不再直接取 searchResult.songs[0]
   * - 递归保护：最多 MAX_FALLBACK_DEPTH 层
   * - 检测 isPlaybackRecursionError 并停止回退
   */
  async function tryFallbackSource(opts: { fallbackDepth?: number } = {}): Promise<boolean> {
    if (!currentSong.value || !audio.value) return false

    const depth = opts.fallbackDepth || 0
    if (depth >= MAX_FALLBACK_DEPTH) {
      console.error(`Fallback depth exceeded (max ${MAX_FALLBACK_DEPTH})`)
      return false
    }

    // 捕获当前 token，用于异步边界校验
    const token = trackSwitchToken.value
    const originalSource = currentSong.value.source
    if (originalSource === 'local') return false

    const allProviders = providerManager
      .getAll()
      .filter((p) => p.id !== originalSource && p.id !== 'local')

    for (const provider of allProviders) {
      try {
        console.log(`Trying fallback source: ${provider.id}`)
        const searchResult = await provider.search(currentSong.value.name, { limit: 5 })
        // 令牌校验：搜索期间可能已有新的 play() 触发
        if (token !== trackSwitchToken.value) return false

        // 严格匹配标题 + 歌手，避免取到同名但不同歌手的版本
        const matchedSong = searchResult.songs.find((candidate) =>
          isSameTitleArtist(currentSong.value!, candidate)
        )
        if (!matchedSong) continue

        const urlResult = await provider.getSongUrl(matchedSong.id, currentQuality.value)
        // 令牌校验
        if (token !== trackSwitchToken.value) return false
        if (!urlResult?.url) continue

        const notification = useNotificationStore()
        notification.notifySourceFallback(originalSource, provider.id, currentSong.value)

        const updatedSong: Song = {
          ...currentSong.value,
          id: matchedSong.id,
          source: provider.id,
          url: urlResult.url,
        }

        const wasPlaying = isPlaying.value
        const preserveTime = audio.value.currentTime

        currentSong.value = updatedSong
        audio.value.src = urlResult.url
        audio.value.currentTime = Math.min(preserveTime, 5)

        if (wasPlaying) {
          try {
            await audio.value.play()
          } catch {
            continue
          }
        }
        return true
      } catch (e) {
        // 递归保护：栈溢出错误立即停止回退
        if (isPlaybackRecursionError(e)) {
          console.error('Playback recursion detected during fallback')
          return false
        }
        console.warn(`Fallback to ${provider.id} failed:`, e)
        continue
      }
    }

    return false
  }

  // ---- 失败冷却与队列跳过 ----

  /** 标记队列中某首歌曲播放失败，记录时间戳 */
  function markQueueItemPlaybackFailed(idx: number): void {
    const queue = playQueueStore()
    const q = queue.queue
    if (idx < 0 || idx >= q.length) return
    const key = songQueueKey(q[idx])
    lastPlaybackFailAt.value = { ...lastPlaybackFailAt.value, [key]: Date.now() }
  }

  /**
   * 从 fromIdx 开始查找下一个未被冷却期阻挡的队列索引
   * 冷却期（PLAYBACK_FAIL_COOLDOWN_MS）内的失败项会被跳过
   */
  function nextUnblockedQueueIndex(fromIdx: number): number {
    const queue = playQueueStore()
    const q = queue.queue
    if (q.length === 0) return -1
    const now = Date.now()
    for (let step = 1; step < q.length; step++) {
      const nextIdx = (fromIdx + step) % q.length
      const key = songQueueKey(q[nextIdx])
      const failedAt = lastPlaybackFailAt.value[key] || 0
      if (!failedAt || now - failedAt > PLAYBACK_FAIL_COOLDOWN_MS) {
        return nextIdx
      }
    }
    return -1
  }

  /** 跳过失败的队列项：标记失败 → 查找下一个可播项 → 自动播放 */
  function skipFailedQueueItem(song: Song, token: number, message: string): void {
    if (token !== trackSwitchToken.value) return
    const queue = playQueueStore()
    const q = queue.queue
    const idx = q.findIndex((s) => s.id === song.id && s.source === song.source)
    if (idx >= 0) markQueueItemPlaybackFailed(idx)

    const notification = useNotificationStore()

    if (q.length <= 1) {
      notification.showNotification('没有可跳过的下一首', { body: message })
      return
    }

    const fromIdx = idx >= 0 ? idx : queue.currentIndex
    const nextIdx = nextUnblockedQueueIndex(fromIdx)
    if (nextIdx < 0) {
      notification.showNotification('队列暂时没有可播歌曲', {
        body: '已尝试绕开受限歌曲，当前队列没有新的可播放项。',
      })
      return
    }

    notification.showNotification('已跳过受限歌曲', { body: message })
    playQueueAt(nextIdx, { fallbackDepth: 0 })
  }

  // ---- 跨源自动回退（play() 内部调用） ----

  /**
   * 自动跨源回退：查找同名同歌手的另一平台版本
   * - depth > 0 时不再递归回退，改为跳过队列项
   * - login_required 时不跳过，交由 handlePlaybackUnavailable 处理
   */
  async function tryAutoPlaybackFallback(
    song: Song,
    result: SongUrlResult | null,
    token: number,
    opts: PlayOptions
  ): Promise<boolean> {
    const depth = opts.fallbackDepth || 0
    // 已是回退后的版本仍不可播：跳到队列下一首
    if (depth > 0) {
      skipFailedQueueItem(song, token, '自动换源后的版本仍不可播，正在播放下一首。')
      return true
    }
    if (!song || song.source === 'local') return false

    const reason = result?.reason || result?.restriction?.category || ''
    const originalSource = song.source
    const targetSource = alternatePlaybackSource(originalSource)
    const targetProvider = providerManager.get(targetSource)
    if (!targetProvider) return false

    const notification = useNotificationStore()
    const fromLabel = originalSource === 'qqmusic' ? 'QQ 音乐' : '网易云'
    const toLabel = targetSource === 'qqmusic' ? 'QQ 音乐' : '网易云'
    notification.showNotification('正在自动换源', {
      body: `${fromLabel} 当前不可播，正在查找 ${toLabel} 的同名同歌手版本。`,
    })

    try {
      const searchResult = await targetProvider.search(song.name, { limit: 8 })
      if (token !== trackSwitchToken.value) return true

      // 严格匹配标题 + 歌手
      const alternate = searchResult.songs.find((candidate) =>
        isSameTitleArtist(song, candidate)
      )
      if (!alternate) {
        // login_required 时不跳过，让 handlePlaybackUnavailable 打开登录弹窗
        if (reason === 'login_required') return false
        skipFailedQueueItem(
          song,
          token,
          `没有找到同名同歌手的 ${toLabel} 版本，正在播放下一首。`
        )
        return true
      }

      notification.showNotification('已自动切换音源', {
        body: `${song.name} 已从 ${fromLabel} 切到 ${toLabel}。`,
      })

      // 以递增的 fallbackDepth 播放回退版本，防止无限递归
      await play(alternate, {
        ...opts,
        fallbackDepth: depth + 1,
      })
      return true
    } catch (e) {
      if (token !== trackSwitchToken.value) return true
      if (isPlaybackRecursionError(e)) return false
      skipFailedQueueItem(song, token, '自动换源搜索失败，正在播放下一首。')
      return true
    }
  }

  // ---- QQ 音质降级重试 ----

  /**
   * QQ 音乐播放失败时，按 无损 → 极高 → 较高 → 标准 顺序降级重试
   * 通过递归调用 play() 实现，会递增 trackSwitchToken 使当前请求失效
   */
  async function retryQQPlaybackWithCompatibleQuality(
    song: Song,
    token: number,
    opts: PlayOptions,
    result: SongUrlResult | null,
    requestedQuality: QualityLevel
  ): Promise<boolean> {
    if (song.source !== 'qqmusic') return false

    // 收集已尝试的音质
    const tried = new Set<QualityLevel>(opts.qqQualityTried || [])
    tried.add(requestedQuality)
    const resolvedLevel = mapQualityLevel(result?.level)
    if (resolvedLevel) tried.add(resolvedLevel)

    const candidates = QQ_QUALITY_FALLBACK_ORDER.filter((q) => !tried.has(q))
    if (candidates.length === 0) return false
    // 令牌校验
    if (token !== trackSwitchToken.value) return false

    const nextQuality = candidates[0]
    const notification = useNotificationStore()
    notification.showNotification('QQ 音质自动兼容', {
      body: `当前音质启动失败，正在切到 ${nextQuality}。`,
    })

    // 以降级后的音质重新播放（play() 会递增 token）
    await play(song, {
      ...opts,
      qualityOverride: nextQuality,
      qqQualityTried: Array.from(tried),
      fallbackDepth: opts.fallbackDepth || 0,
    })
    return true
  }

  // ---- 播放不可用处理（login_required 检测） ----

  /**
   * 处理歌曲无法播放的情况
   * - reason 为 login_required 时自动打开登录弹窗
   */
  function handlePlaybackUnavailable(song: Song, result: SongUrlResult | null): void {
    const reason = result?.reason || result?.restriction?.category || ''
    const notification = useNotificationStore()

    if (reason === 'login_required' || /login_required/i.test(reason)) {
      const user = useUserStore()
      user.showLoginModal(song.source as MusicSource)
      notification.showNotification('需要登录', {
        body: `${song.name} 需要登录后才能播放`,
      })
    } else {
      notification.showNotification('无法播放', {
        body: `${song.name} 暂时无法播放`,
      })
    }
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
    currentQuality,
    wifiQuality,
    mobileQuality,
    continueListening,
    audioDevices,
    currentOutputDeviceId,
    startupVisualPreviewActive,
    mockBeatGenerator,
    // 竞态保护与错误恢复状态
    trackSwitchToken,
    playToggleBusy,
    playPhase,
    trialBanner,
    lastPlaybackFailAt,
    initAudio,
    play,
    playQueueAt,
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
    tryFallbackSource,
    nextUnblockedQueueIndex,
    setEqualizerEnabled,
    setEqualizerGain,
    setEqualizerPreset,
    resetEqualizer,
    setAudioEffectsEnabled,
    updateAudioEffects,
    resetAudioEffects,
    setQuality,
    setWifiQuality,
    setMobileQuality,
    switchQuality,
    getSupportedQualities,
    refreshAudioDevices,
    setOutputDevice,
    saveContinueListening,
    continueFromLast,
    hasContinueData,
    clearContinueListening,
    startStartupVisualPreview,
    stopStartupVisualPreview,
    toggleStartupVisualPreview,
  }
})
