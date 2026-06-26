export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const

export type EqBand = typeof EQ_BANDS[number]

export type EqPreset = 'flat' | 'pop' | 'rock' | 'jazz' | 'classical' | 'vocal' | 'bass' | 'custom'

export interface EqSettings {
  enabled: boolean
  gains: number[]
  preset: EqPreset
  smoothTime: number
}

const PRESET_GAINS: Record<Exclude<EqPreset, 'custom'>, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  pop: [-1, 2, 4, 4, 2, 0, -1, -1, 0, 0],
  rock: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5],
  jazz: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  classical: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4],
  vocal: [-2, -1, 0, 2, 4, 4, 3, 2, 1, 0],
  bass: [6, 5, 4, 2, 0, -1, -1, -1, 0, 0],
}

const MIN_GAIN = -12
const MAX_GAIN = 12
const DEFAULT_SMOOTH_TIME = 0.05

export class Equalizer {
  private audioContext: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private filters: BiquadFilterNode[] = []
  private inputGain: GainNode | null = null
  private outputGain: GainNode | null = null
  private _enabled = false
  private _gains: number[] = new Array(EQ_BANDS.length).fill(0)
  private _preset: EqPreset = 'flat'
  private _smoothTime = DEFAULT_SMOOTH_TIME
  private _initialized = false

  get enabled(): boolean {
    return this._enabled
  }

  get gains(): number[] {
    return [...this._gains]
  }

  get preset(): EqPreset {
    return this._preset
  }

  get bandCount(): number {
    return EQ_BANDS.length
  }

  get bands(): readonly number[] {
    return EQ_BANDS
  }

  init(audioContext: AudioContext, sourceNode: MediaElementAudioSourceNode): boolean {
    if (this._initialized) return true

    try {
      this.audioContext = audioContext
      this.sourceNode = sourceNode

      this.inputGain = audioContext.createGain()
      this.outputGain = audioContext.createGain()

      this.filters = EQ_BANDS.map((freq, index) => {
        const filter = audioContext.createBiquadFilter()
        filter.type = index === 0 ? 'lowshelf' : index === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
        filter.frequency.value = freq
        filter.Q.value = 1.4
        filter.gain.value = 0
        return filter
      })

      this.connectChain()
      this._initialized = true
      return true
    } catch (e) {
      console.warn('Equalizer init failed:', e)
      return false
    }
  }

  private connectChain(): void {
    if (!this.audioContext || !this.sourceNode || !this.inputGain || !this.outputGain) return

    try {
      this.sourceNode.disconnect()
    } catch (e) {
      // ignore
    }

    if (this._enabled && this.filters.length > 0) {
      this.sourceNode.connect(this.inputGain)
      this.inputGain.connect(this.filters[0])

      for (let i = 0; i < this.filters.length - 1; i++) {
        this.filters[i].connect(this.filters[i + 1])
      }

      this.filters[this.filters.length - 1].connect(this.outputGain)
    } else {
      this.sourceNode.connect(this.outputGain)
    }
  }

  setEnabled(enabled: boolean): void {
    if (this._enabled === enabled || !this._initialized) return
    this._enabled = enabled
    this.connectChain()
    if (enabled) {
      this.applyAllGains(true)
    }
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled)
    return this._enabled
  }

  setGain(bandIndex: number, gain: number, smooth: boolean = true): void {
    if (bandIndex < 0 || bandIndex >= this.filters.length) return

    const clampedGain = Math.max(MIN_GAIN, Math.min(MAX_GAIN, gain))
    this._gains[bandIndex] = clampedGain

    if (this._enabled && this.filters[bandIndex]) {
      const filter = this.filters[bandIndex]
      const currentTime = this.audioContext?.currentTime || 0

      if (smooth && this._smoothTime > 0) {
        filter.gain.cancelScheduledValues(currentTime)
        filter.gain.setValueAtTime(filter.gain.value, currentTime)
        filter.gain.linearRampToValueAtTime(clampedGain, currentTime + this._smoothTime)
      } else {
        filter.gain.value = clampedGain
      }
    }

    this._preset = 'custom'
  }

  setGains(gains: number[], smooth: boolean = true): void {
    const len = Math.min(gains.length, this.filters.length)
    for (let i = 0; i < len; i++) {
      this.setGain(i, gains[i], smooth)
    }
  }

  applyPreset(preset: EqPreset): void {
    if (preset === 'custom') return

    const gains = PRESET_GAINS[preset]
    if (gains) {
      this.setGains(gains, true)
      this._preset = preset
    }
  }

  reset(): void {
    this.applyPreset('flat')
    this._preset = 'flat'
  }

  private applyAllGains(immediate: boolean = false): void {
    if (!this._initialized) return
    for (let i = 0; i < this.filters.length; i++) {
      const filter = this.filters[i]
      const gain = this._gains[i]
      if (immediate) {
        filter.gain.value = gain
      } else {
        const currentTime = this.audioContext?.currentTime || 0
        filter.gain.cancelScheduledValues(currentTime)
        filter.gain.setValueAtTime(filter.gain.value, currentTime)
        filter.gain.linearRampToValueAtTime(gain, currentTime + this._smoothTime)
      }
    }
  }

  setSmoothTime(seconds: number): void {
    this._smoothTime = Math.max(0, Math.min(1, seconds))
  }

  getFrequencyResponse(): { frequencies: Float32Array; magResponse: Float32Array; phaseResponse: Float32Array } {
    const frequencies = new Float32Array(EQ_BANDS.length)
    const magResponse = new Float32Array(EQ_BANDS.length)
    const phaseResponse = new Float32Array(EQ_BANDS.length)

    EQ_BANDS.forEach((freq, i) => {
      frequencies[i] = freq
    })

    if (this.filters.length > 0 && this.audioContext) {
      this.filters.forEach((filter) => {
        const mag = new Float32Array(EQ_BANDS.length)
        const phase = new Float32Array(EQ_BANDS.length)
        filter.getFrequencyResponse(frequencies, mag, phase)
        for (let i = 0; i < EQ_BANDS.length; i++) {
          magResponse[i] += mag[i]
          phaseResponse[i] += phase[i]
        }
      })
    }

    return { frequencies, magResponse, phaseResponse }
  }

  getOutputNode(): AudioNode | null {
    return this.outputGain
  }

  getInputNode(): AudioNode | null {
    return this.inputGain
  }

  dispose(): void {
    try {
      this.sourceNode?.disconnect()
      this.inputGain?.disconnect()
      this.outputGain?.disconnect()
      this.filters.forEach((f) => f.disconnect())
    } catch (e) {
      // ignore
    }
    this.filters = []
    this.inputGain = null
    this.outputGain = null
    this.sourceNode = null
    this.audioContext = null
    this._initialized = false
  }
}

export function getPresetGains(preset: EqPreset): number[] {
  if (preset === 'custom') return new Array(EQ_BANDS.length).fill(0)
  return [...PRESET_GAINS[preset]]
}

export function getPresetName(preset: EqPreset): string {
  const names: Record<EqPreset, string> = {
    flat: '平直',
    pop: '流行',
    rock: '摇滚',
    jazz: '爵士',
    classical: '古典',
    vocal: '人声',
    bass: '低音',
    custom: '自定义',
  }
  return names[preset]
}
