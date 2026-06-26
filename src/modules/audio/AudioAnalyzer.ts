import { EnergyAnalyzer, bandRms } from './EnergyAnalyzer'
import type { AudioAnalyzerOptions, EnergyBands, RealtimeBeatState, CinemaDynamics } from './types'

const DEFAULT_FFT_SIZE = 2048
const DEFAULT_SMOOTHING = 0.58
const DEFAULT_BEAT_FFT_SIZE = 1024
const DEFAULT_BEAT_SMOOTHING = 0.10

export class AudioAnalyzer {
  private _audioContext: AudioContext | null = null
  private _source: MediaElementAudioSourceNode | null = null
  private _analyser: AnalyserNode | null = null
  private _beatAnalyser: AnalyserNode | null = null
  private _gainNode: GainNode | null = null
  private _frequencyData: Uint8Array | null = null
  private _beatFrequencyData: Uint8Array | null = null
  private _beatTimeDomainData: Uint8Array | null = null
  private _energyAnalyzer: EnergyAnalyzer
  private _options: Required<AudioAnalyzerOptions>
  private _initialized = false
  private _preEffectNode: AudioNode | null = null

  private _beatState: RealtimeBeatState = {
    bass: 0,
    mid: 0,
    treble: 0,
    bassAvg: 0,
    midAvg: 0,
    trebleAvg: 0,
    bassPeak: 0,
    midPeak: 0,
    treblePeak: 0,
    beatDetected: false,
    beatStrength: 0,
    lastBeatTime: 0,
  }

  private _cinemaDynamics: CinemaDynamics = {
    avg: 0,
    lowAvg: 0,
    peak: 0.30,
    scale: 0.82,
  }

  private _beatThreshold = 0.55
  private _minBeatInterval = 0.18
  private _bassAvgSmooth = 0.92
  private _peakDecay = 0.96

  constructor(options: AudioAnalyzerOptions = {}) {
    this._options = {
      fftSize: options.fftSize ?? DEFAULT_FFT_SIZE,
      smoothingTimeConstant: options.smoothingTimeConstant ?? DEFAULT_SMOOTHING,
      beatFftSize: options.beatFftSize ?? DEFAULT_BEAT_FFT_SIZE,
      beatSmoothingTimeConstant: options.beatSmoothingTimeConstant ?? DEFAULT_BEAT_SMOOTHING,
    }
    this._energyAnalyzer = new EnergyAnalyzer()
  }

  get audioContext(): AudioContext | null {
    return this._audioContext
  }

  get analyser(): AnalyserNode | null {
    return this._analyser
  }

  get beatAnalyser(): AnalyserNode | null {
    return this._beatAnalyser
  }

  get gainNode(): GainNode | null {
    return this._gainNode
  }

  get frequencyData(): Uint8Array | null {
    return this._frequencyData
  }

  get beatState(): Readonly<RealtimeBeatState> {
    return this._beatState
  }

  get cinemaDynamics(): Readonly<CinemaDynamics> {
    return this._cinemaDynamics
  }

  get energyAnalyzer(): EnergyAnalyzer {
    return this._energyAnalyzer
  }

  get source(): MediaElementAudioSourceNode | null {
    return this._source
  }

  get destinationInput(): GainNode | null {
    return this._gainNode
  }

  init(audioElement: HTMLAudioElement): boolean {
    if (this._initialized) return true

    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextCtor) return false

      this._audioContext = new AudioContextCtor()
      this._source = this._audioContext.createMediaElementSource(audioElement)
      this._analyser = this._audioContext.createAnalyser()
      this._beatAnalyser = this._audioContext.createAnalyser()
      this._gainNode = this._audioContext.createGain()

      this._analyser.fftSize = this._options.fftSize
      this._analyser.smoothingTimeConstant = this._options.smoothingTimeConstant

      this._beatAnalyser.fftSize = this._options.beatFftSize
      this._beatAnalyser.smoothingTimeConstant = this._options.beatSmoothingTimeConstant

      this._frequencyData = new Uint8Array(this._analyser.frequencyBinCount)
      this._beatFrequencyData = new Uint8Array(this._beatAnalyser.frequencyBinCount)
      this._beatTimeDomainData = new Uint8Array(this._beatAnalyser.fftSize)

      this._source.connect(this._analyser)
      this._source.connect(this._beatAnalyser)
      this._analyser.connect(this._gainNode)
      this._beatAnalyser.connect(this._gainNode)
      this._gainNode.connect(this._audioContext.destination)

      this._initialized = true
      return true
    } catch (e) {
      console.warn('AudioAnalyzer init failed:', e)
      return false
    }
  }

  setPreEffectChain(inputNode: AudioNode | null, outputNode: AudioNode | null): void {
    if (!this._initialized || !this._source || !this._analyser || !this._beatAnalyser) return

    try {
      this._source.disconnect()
      this._analyser.disconnect()
      this._beatAnalyser.disconnect()
    } catch (e) {
      // ignore
    }

    if (inputNode && outputNode) {
      this._source.connect(inputNode)
      outputNode.connect(this._analyser)
      outputNode.connect(this._beatAnalyser)
      this._preEffectNode = outputNode
    } else {
      this._source.connect(this._analyser)
      this._source.connect(this._beatAnalyser)
      this._preEffectNode = null
    }

    this._analyser.connect(this._gainNode)
    this._beatAnalyser.connect(this._gainNode)
  }

  async resume(): Promise<void> {
    if (this._audioContext && this._audioContext.state === 'suspended') {
      try {
        await this._audioContext.resume()
      } catch (e) {
        console.warn('Audio context resume failed:', e)
      }
    }
  }

  getFrequencyData(): Uint8Array | null {
    if (!this._analyser || !this._frequencyData) return null
    this._analyser.getByteFrequencyData(this._frequencyData)
    return this._frequencyData
  }

  getBeatFrequencyData(): Uint8Array | null {
    if (!this._beatAnalyser || !this._beatFrequencyData) return null
    this._beatAnalyser.getByteFrequencyData(this._beatFrequencyData)
    return this._beatFrequencyData
  }

  getTimeDomainData(): Uint8Array | null {
    if (!this._beatAnalyser || !this._beatTimeDomainData) return null
    this._beatAnalyser.getByteTimeDomainData(this._beatTimeDomainData)
    return this._beatTimeDomainData
  }

  analyzeEnergy(): EnergyBands | null {
    if (!this._analyser || !this._frequencyData || !this._audioContext) return null
    this._analyser.getByteFrequencyData(this._frequencyData)
    return this._energyAnalyzer.analyze(
      this._frequencyData,
      this._audioContext.sampleRate,
      this._options.fftSize
    )
  }

  detectBeat(dt: number = 0.016): boolean {
    if (!this._beatAnalyser || !this._beatFrequencyData || !this._audioContext) {
      this._beatState.beatDetected = false
      return false
    }

    dt = Math.max(0.001, Math.min(0.080, dt))
    const sr = this._audioContext.sampleRate || 44100
    const fftSize = this._options.beatFftSize

    this._beatAnalyser.getByteFrequencyData(this._beatFrequencyData)

    const bass = bandRms(this._beatFrequencyData, sr, fftSize, 52, 165) / 255
    const mid = bandRms(this._beatFrequencyData, sr, fftSize, 165, 420) / 255
    const treble = bandRms(this._beatFrequencyData, sr, fftSize, 2000, 8000) / 255

    this._beatState.bass = bass
    this._beatState.mid = mid
    this._beatState.treble = treble

    this._beatState.bassAvg = this._beatState.bassAvg * this._bassAvgSmooth + bass * (1 - this._bassAvgSmooth)
    this._beatState.midAvg = this._beatState.midAvg * this._bassAvgSmooth + mid * (1 - this._bassAvgSmooth)
    this._beatState.trebleAvg = this._beatState.trebleAvg * this._bassAvgSmooth + treble * (1 - this._bassAvgSmooth)

    this._beatState.bassPeak = Math.max(bass, this._beatState.bassPeak * this._peakDecay)
    this._beatState.midPeak = Math.max(mid, this._beatState.midPeak * this._peakDecay)
    this._beatState.treblePeak = Math.max(treble, this._beatState.treblePeak * this._peakDecay)

    const bassRatio = this._beatState.bassAvg > 0.001 ? bass / this._beatState.bassAvg : 0
    const now = performance.now() / 1000
    const timeSinceLastBeat = now - this._beatState.lastBeatTime

    const beatDetected = bassRatio > this._beatThreshold && timeSinceLastBeat > this._minBeatInterval && bass > 0.1

    this._beatState.beatDetected = beatDetected
    this._beatState.beatStrength = beatDetected ? Math.min(1.0, bassRatio * 0.6 + bass * 0.4) : 0

    if (beatDetected) {
      this._beatState.lastBeatTime = now
    }

    this._updateCinemaDynamics(dt, bass, mid)

    return beatDetected
  }

  private _updateCinemaDynamics(dt: number, bass: number, mid: number): void {
    const total = bass * 0.7 + mid * 0.3
    const smooth = Math.max(0.88, Math.min(0.985, 0.92 + dt * 2))
    const lowSmooth = Math.max(0.90, Math.min(0.99, 0.94 + dt * 1.5))

    this._cinemaDynamics.avg = this._cinemaDynamics.avg * smooth + total * (1 - smooth)
    this._cinemaDynamics.lowAvg = this._cinemaDynamics.lowAvg * lowSmooth + bass * (1 - lowSmooth)

    const peakTarget = Math.max(0.10, this._cinemaDynamics.avg * 2.2)
    const peakSmooth = Math.max(0.96, Math.min(0.998, 0.98 + dt))
    this._cinemaDynamics.peak = this._cinemaDynamics.peak * peakSmooth + peakTarget * (1 - peakSmooth)

    const scaleTarget = 0.5 + Math.min(0.8, this._cinemaDynamics.avg * 3) * 0.5
    const scaleSmooth = Math.max(0.94, Math.min(0.995, 0.97 + dt * 1.2))
    this._cinemaDynamics.scale = this._cinemaDynamics.scale * scaleSmooth + scaleTarget * (1 - scaleSmooth)
  }

  setBeatThreshold(threshold: number): void {
    this._beatThreshold = Math.max(0.3, Math.min(1.2, threshold))
  }

  setMinBeatInterval(seconds: number): void {
    this._minBeatInterval = Math.max(0.08, Math.min(0.5, seconds))
  }

  reset(): void {
    this._energyAnalyzer.reset()
    this._beatState = {
      bass: 0,
      mid: 0,
      treble: 0,
      bassAvg: 0,
      midAvg: 0,
      trebleAvg: 0,
      bassPeak: 0,
      midPeak: 0,
      treblePeak: 0,
      beatDetected: false,
      beatStrength: 0,
      lastBeatTime: 0,
    }
    this._cinemaDynamics = {
      avg: 0,
      lowAvg: 0,
      peak: 0.30,
      scale: 0.82,
    }
  }

  dispose(): void {
    if (this._source) {
      try { this._source.disconnect() } catch (e) { /* ignore */ }
      this._source = null
    }
    if (this._analyser) {
      try { this._analyser.disconnect() } catch (e) { /* ignore */ }
      this._analyser = null
    }
    if (this._beatAnalyser) {
      try { this._beatAnalyser.disconnect() } catch (e) { /* ignore */ }
      this._beatAnalyser = null
    }
    if (this._gainNode) {
      try { this._gainNode.disconnect() } catch (e) { /* ignore */ }
      this._gainNode = null
    }
    if (this._audioContext) {
      try { this._audioContext.close() } catch (e) { /* ignore */ }
      this._audioContext = null
    }
    this._frequencyData = null
    this._beatFrequencyData = null
    this._beatTimeDomainData = null
    this._initialized = false
  }
}
