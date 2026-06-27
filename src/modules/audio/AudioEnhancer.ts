export interface FadeOptions {
  duration: number
  from: number
  to: number
}

export interface ReplayGainData {
  trackGain: number
  trackPeak: number
  albumGain?: number
  albumPeak?: number
}

export interface BufferProgress {
  buffered: number
  duration: number
  percent: number
}

export interface AudioError {
  code: number
  message: string
  recoverable: boolean
  retryCount: number
}

const DEFAULT_FADE_DURATION = 800
const MAX_RETRY_COUNT = 3
const REPLAYGAIN_PREAMP = 0.5
const NETWORK_TIMEOUT_MS = 30000

export class AudioEnhancer {
  private audio: HTMLAudioElement | null = null
  private fadeAnimationId: number | null = null
  private baseVolume: number = 1
  private replayGainMap: Map<string, ReplayGainData> = new Map()
  private replayGainEnabled: boolean = true
  private preamp: number = REPLAYGAIN_PREAMP
  private bufferProgress: BufferProgress = { buffered: 0, duration: 0, percent: 0 }
  private bufferListeners: Set<(progress: BufferProgress) => void> = new Set()
  private errorState: AudioError | null = null
  private errorListeners: Set<(error: AudioError) => void> = new Set()
  private retryCount: number = 0
  private currentSrc: string = ''
  private loadTimeoutId: ReturnType<typeof setTimeout> | null = null
  private timeoutListeners: Set<() => void> = new Set()

  constructor(audio?: HTMLAudioElement) {
    if (audio) {
      this.attach(audio)
    }
  }

  attach(audio: HTMLAudioElement): void {
    this.audio = audio
    this.setupEventListeners()
  }

  detach(): void {
    this.clearFade()
    this.clearTimeout()
    this.audio = null
  }

  private setupEventListeners(): void {
    if (!this.audio) return

    this.audio.addEventListener('progress', this.handleProgress.bind(this))
    this.audio.addEventListener('error', this.handleError.bind(this))
    this.audio.addEventListener('loadstart', this.handleLoadStart.bind(this))
    this.audio.addEventListener('canplay', this.handleCanPlay.bind(this))
    this.audio.addEventListener('loadeddata', this.handleLoadedData.bind(this))
  }

  private handleProgress(): void {
    if (!this.audio) return

    try {
      const buffered = this.audio.buffered
      if (buffered.length > 0) {
        const bufferedEnd = buffered.end(buffered.length - 1)
        const duration = this.audio.duration || 0
        this.bufferProgress = {
          buffered: bufferedEnd,
          duration,
          percent: duration > 0 ? (bufferedEnd / duration) * 100 : 0,
        }
        this.notifyBufferListeners()
      }
    } catch (e) {
      // ignore
    }
  }

  private handleError(): void {
    if (!this.audio) return

    const error = this.audio.error
    const errorCode = error?.code || 0
    const errorMessage = error?.message || '未知音频错误'

    const recoverable = errorCode !== 4
    this.retryCount = recoverable ? this.retryCount + 1 : MAX_RETRY_COUNT

    this.errorState = {
      code: errorCode,
      message: errorMessage,
      recoverable,
      retryCount: this.retryCount,
    }

    this.notifyErrorListeners(this.errorState)
  }

  private handleLoadStart(): void {
    this.errorState = null
    this.startLoadTimeout()
  }

  private handleCanPlay(): void {
    this.clearTimeout()
  }

  private handleLoadedData(): void {
    this.clearTimeout()
    this.retryCount = 0
  }

  private startLoadTimeout(): void {
    this.clearTimeout()
    this.loadTimeoutId = setTimeout(() => {
      if (this.audio && this.audio.readyState < 3) {
        this.notifyTimeoutListeners()
      }
    }, NETWORK_TIMEOUT_MS)
  }

  private clearTimeout(): void {
    if (this.loadTimeoutId) {
      clearTimeout(this.loadTimeoutId)
      this.loadTimeoutId = null
    }
  }

  getBufferProgress(): BufferProgress {
    return { ...this.bufferProgress }
  }

  onBufferProgress(callback: (progress: BufferProgress) => void): () => void {
    this.bufferListeners.add(callback)
    return () => this.bufferListeners.delete(callback)
  }

  private notifyBufferListeners(): void {
    this.bufferListeners.forEach((fn) => fn(this.bufferProgress))
  }

  onError(callback: (error: AudioError) => void): () => void {
    this.errorListeners.add(callback)
    return () => this.errorListeners.delete(callback)
  }

  private notifyErrorListeners(error: AudioError): void {
    this.errorListeners.forEach((fn) => fn(error))
  }

  onLoadTimeout(callback: () => void): () => void {
    this.timeoutListeners.add(callback)
    return () => this.timeoutListeners.delete(callback)
  }

  private notifyTimeoutListeners(): void {
    this.timeoutListeners.forEach((fn) => fn())
  }

  getError(): AudioError | null {
    return this.errorState ? { ...this.errorState } : null
  }

  canRetry(): boolean {
    return this.retryCount < MAX_RETRY_COUNT && this.errorState?.recoverable === true
  }

  getRetryCount(): number {
    return this.retryCount
  }

  resetRetry(): void {
    this.retryCount = 0
    this.errorState = null
  }

  fadeIn(duration: number = DEFAULT_FADE_DURATION): Promise<void> {
    return this.fade({
      duration,
      from: 0,
      to: this.baseVolume,
    })
  }

  fadeOut(duration: number = DEFAULT_FADE_DURATION): Promise<void> {
    return this.fade({
      duration,
      from: this.audio?.volume || 0,
      to: 0,
    })
  }

  fade(options: FadeOptions): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audio) {
        resolve()
        return
      }

      this.clearFade()

      const { duration } = options
      const from = Math.max(0, Math.min(1, options.from))
      const to = Math.max(0, Math.min(1, options.to))
      const startTime = performance.now()

      this.audio.volume = from

      if (duration <= 0) {
        this.audio.volume = to
        resolve()
        return
      }

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = this.easeOutCubic(progress)
        const currentVolume = Math.max(0, Math.min(1, from + (to - from) * eased))

        if (this.audio) {
          this.audio.volume = currentVolume
        }

        if (progress < 1) {
          this.fadeAnimationId = requestAnimationFrame(animate)
        } else {
          this.fadeAnimationId = null
          resolve()
        }
      }

      this.fadeAnimationId = requestAnimationFrame(animate)
    })
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  clearFade(): void {
    if (this.fadeAnimationId !== null) {
      cancelAnimationFrame(this.fadeAnimationId)
      this.fadeAnimationId = null
    }
  }

  setBaseVolume(volume: number): void {
    this.baseVolume = Math.max(0, Math.min(1, volume))
    if (this.audio && this.fadeAnimationId === null) {
      this.audio.volume = this.getAdjustedVolume()
    }
  }

  getBaseVolume(): number {
    return this.baseVolume
  }

  setReplayGainEnabled(enabled: boolean): void {
    this.replayGainEnabled = enabled
    this.updateVolume()
  }

  isReplayGainEnabled(): boolean {
    return this.replayGainEnabled
  }

  setReplayGainPreamp(preamp: number): void {
    this.preamp = Math.max(-12, Math.min(12, preamp))
    this.updateVolume()
  }

  getReplayGainPreamp(): number {
    return this.preamp
  }

  setReplayGain(songId: string, data: ReplayGainData): void {
    this.replayGainMap.set(songId, data)
  }

  getReplayGain(songId: string): ReplayGainData | undefined {
    return this.replayGainMap.get(songId)
  }

  applyReplayGainToSong(songId: string): void {
    this.currentSrc = songId
    this.updateVolume()
  }

  private updateVolume(): void {
    if (this.audio && this.fadeAnimationId === null) {
      this.audio.volume = this.getAdjustedVolume()
    }
  }

  private getAdjustedVolume(): number {
    let volume = this.baseVolume

    if (this.replayGainEnabled && this.currentSrc) {
      const rgData = this.replayGainMap.get(this.currentSrc)
      if (rgData) {
        const gainDb = rgData.trackGain + this.preamp
        const gainLinear = Math.pow(10, gainDb / 20)
        volume = this.baseVolume * gainLinear

        if (rgData.trackPeak > 0) {
          const peakReduction = 1 / rgData.trackPeak
          volume = Math.min(volume, peakReduction)
        }
      }
    }

    return Math.max(0, Math.min(1, volume))
  }

  analyzeReplayGain(audioBuffer: AudioBuffer): ReplayGainData {
    const channelData = audioBuffer.getChannelData(0)
    const sampleRate = audioBuffer.sampleRate
    const windowSize = Math.floor(sampleRate * 0.05)
    const hopSize = Math.floor(windowSize / 2)

    let rmsSum = 0
    let rmsCount = 0
    let peak = 0

    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      let sumSq = 0
      for (let j = 0; j < windowSize; j++) {
        const sample = Math.abs(channelData[i + j])
        sumSq += sample * sample
        if (sample > peak) peak = sample
      }
      const rms = Math.sqrt(sumSq / windowSize)
      if (rms > 0) {
        rmsSum += rms
        rmsCount++
      }
    }

    const avgRms = rmsCount > 0 ? rmsSum / rmsCount : 0.0001
    const referenceLoudness = -18
    const currentLoudness = 20 * Math.log10(avgRms)
    const trackGain = referenceLoudness - currentLoudness

    return {
      trackGain: Math.max(-12, Math.min(12, trackGain)),
      trackPeak: peak || 1,
    }
  }

  destroy(): void {
    this.clearFade()
    this.clearTimeout()
    this.bufferListeners.clear()
    this.errorListeners.clear()
    this.timeoutListeners.clear()
    this.replayGainMap.clear()
    this.audio = null
  }
}
