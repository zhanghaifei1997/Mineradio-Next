export interface ReverbSettings {
  enabled: boolean
  wet: number
  dry: number
  decay: number
  preDelay: number
}

export interface Surround3DSettings {
  enabled: boolean
  panX: number
  panY: number
  panZ: number
  distanceModel: 'linear' | 'inverse' | 'exponential'
  rolloffFactor: number
}

export interface BassBoostSettings {
  enabled: boolean
  gain: number
  frequency: number
  q: number
}

export interface StereoWidenerSettings {
  enabled: boolean
  width: number
}

export interface CompressorSettings {
  enabled: boolean
  threshold: number
  knee: number
  ratio: number
  attack: number
  release: number
}

export interface AudioEffectsSettings {
  reverb: ReverbSettings
  surround3d: Surround3DSettings
  bassBoost: BassBoostSettings
  stereoWidener: StereoWidenerSettings
  compressor: CompressorSettings
}

const DEFAULT_REVERB: ReverbSettings = {
  enabled: false,
  wet: 0.3,
  dry: 1,
  decay: 2,
  preDelay: 0.01,
}

const DEFAULT_SURROUND3D: Surround3DSettings = {
  enabled: false,
  panX: 0,
  panY: 0,
  panZ: -1,
  distanceModel: 'inverse',
  rolloffFactor: 1,
}

const DEFAULT_BASS_BOOST: BassBoostSettings = {
  enabled: false,
  gain: 6,
  frequency: 80,
  q: 1,
}

const DEFAULT_STEREO_WIDENER: StereoWidenerSettings = {
  enabled: false,
  width: 0.5,
}

const DEFAULT_COMPRESSOR: CompressorSettings = {
  enabled: false,
  threshold: -24,
  knee: 30,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
}

export const DEFAULT_AUDIO_EFFECTS: AudioEffectsSettings = {
  reverb: { ...DEFAULT_REVERB },
  surround3d: { ...DEFAULT_SURROUND3D },
  bassBoost: { ...DEFAULT_BASS_BOOST },
  stereoWidener: { ...DEFAULT_STEREO_WIDENER },
  compressor: { ...DEFAULT_COMPRESSOR },
}

export class AudioEffects {
  private audioContext: AudioContext | null = null
  private _inputNode: AudioNode | null = null
  private _outputNode: AudioNode | null = null

  private reverbNode: ConvolverNode | null = null
  private reverbWetGain: GainNode | null = null
  private reverbDryGain: GainNode | null = null
  private reverbDelay: DelayNode | null = null

  private pannerNode: PannerNode | null = null

  private bassBoostFilter: BiquadFilterNode | null = null
  private bassBoostGain: GainNode | null = null

  private stereoSplitter: ChannelSplitterNode | null = null
  private stereoMerger: ChannelMergerNode | null = null
  private stereoMidGain: GainNode | null = null
  private stereoSideGain: GainNode | null = null
  private stereoDelay: DelayNode | null = null

  private compressorNode: DynamicsCompressorNode | null = null

  private bypassGain: GainNode | null = null

  private settings: AudioEffectsSettings = { ...DEFAULT_AUDIO_EFFECTS }
  private _initialized = false

  get initialized(): boolean {
    return this._initialized
  }

  get inputNode(): AudioNode | null {
    return this._inputNode
  }

  get outputNode(): AudioNode | null {
    return this._outputNode
  }

  init(audioContext: AudioContext): boolean {
    if (this._initialized) return true

    try {
      this.audioContext = audioContext

      this._inputNode = audioContext.createGain()
      this._outputNode = audioContext.createGain()
      this.bypassGain = audioContext.createGain()

      this.initReverb()
      this.initSurround3D()
      this.initBassBoost()
      this.initStereoWidener()
      this.initCompressor()

      this.rebuildChain()
      this._initialized = true
      return true
    } catch (e) {
      console.warn('AudioEffects init failed:', e)
      return false
    }
  }

  private initReverb(): void {
    if (!this.audioContext) return

    this.reverbNode = this.audioContext.createConvolver()
    this.reverbWetGain = this.audioContext.createGain()
    this.reverbDryGain = this.audioContext.createGain()
    this.reverbDelay = this.audioContext.createDelay(5)

    this.reverbWetGain.gain.value = this.settings.reverb.wet
    this.reverbDryGain.gain.value = this.settings.reverb.dry
    this.reverbDelay.delayTime.value = this.settings.reverb.preDelay

    this.reverbNode.buffer = this.createImpulseResponse(this.settings.reverb.decay)
  }

  private initSurround3D(): void {
    if (!this.audioContext) return

    this.pannerNode = this.audioContext.createPanner()
    this.pannerNode.panningModel = 'HRTF'
    this.pannerNode.distanceModel = this.settings.surround3d.distanceModel
    this.pannerNode.rolloffFactor = this.settings.surround3d.rolloffFactor
    this.pannerNode.refDistance = 1
    this.pannerNode.maxDistance = 100
    this.pannerNode.coneInnerAngle = 360
    this.pannerNode.coneOuterAngle = 0
    this.pannerNode.coneOuterGain = 0

    this.updatePannerPosition()
  }

  private initBassBoost(): void {
    if (!this.audioContext) return

    this.bassBoostFilter = this.audioContext.createBiquadFilter()
    this.bassBoostGain = this.audioContext.createGain()

    this.bassBoostFilter.type = 'lowshelf'
    this.bassBoostFilter.frequency.value = this.settings.bassBoost.frequency
    this.bassBoostFilter.Q.value = this.settings.bassBoost.q
    this.bassBoostFilter.gain.value = this.settings.bassBoost.gain
  }

  private initStereoWidener(): void {
    if (!this.audioContext) return

    this.stereoSplitter = this.audioContext.createChannelSplitter(2)
    this.stereoMerger = this.audioContext.createChannelMerger(2)
    this.stereoMidGain = this.audioContext.createGain()
    this.stereoSideGain = this.audioContext.createGain()
    this.stereoDelay = this.audioContext.createDelay(0.01)

    this.updateStereoWidth(this.settings.stereoWidener.width)
  }

  private initCompressor(): void {
    if (!this.audioContext) return

    this.compressorNode = this.audioContext.createDynamicsCompressor()
    this.compressorNode.threshold.value = this.settings.compressor.threshold
    this.compressorNode.knee.value = this.settings.compressor.knee
    this.compressorNode.ratio.value = this.settings.compressor.ratio
    this.compressorNode.attack.value = this.settings.compressor.attack
    this.compressorNode.release.value = this.settings.compressor.release
  }

  private createImpulseResponse(decay: number): AudioBuffer {
    if (!this.audioContext) return new AudioBuffer({ length: 1, sampleRate: 44100 })

    const sampleRate = this.audioContext.sampleRate
    const length = Math.floor(sampleRate * decay)
    const impulse = this.audioContext.createBuffer(2, length, sampleRate)

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel)
      for (let i = 0; i < length; i++) {
        const progress = i / length
        const envelope = Math.pow(1 - progress, 2)
        channelData[i] = (Math.random() * 2 - 1) * envelope
      }
    }

    return impulse
  }

  private rebuildChain(): void {
    if (!this.audioContext || !this._inputNode || !this._outputNode || !this.bypassGain) return

    try {
      this._inputNode.disconnect()
      this.bypassGain.disconnect()
      if (this.reverbNode) this.reverbNode.disconnect()
      if (this.reverbWetGain) this.reverbWetGain.disconnect()
      if (this.reverbDryGain) this.reverbDryGain.disconnect()
      if (this.reverbDelay) this.reverbDelay.disconnect()
      if (this.pannerNode) this.pannerNode.disconnect()
      if (this.bassBoostFilter) this.bassBoostFilter.disconnect()
      if (this.bassBoostGain) this.bassBoostGain.disconnect()
      if (this.stereoSplitter) this.stereoSplitter.disconnect()
      if (this.stereoMerger) this.stereoMerger.disconnect()
      if (this.stereoMidGain) this.stereoMidGain.disconnect()
      if (this.stereoSideGain) this.stereoSideGain.disconnect()
      if (this.stereoDelay) this.stereoDelay.disconnect()
      if (this.compressorNode) this.compressorNode.disconnect()
    } catch (e) {
      // ignore
    }

    let currentNode: AudioNode = this._inputNode

    if (this.settings.bassBoost.enabled && this.bassBoostFilter) {
      currentNode.connect(this.bassBoostFilter)
      currentNode = this.bassBoostFilter
    }

    if (this.settings.compressor.enabled && this.compressorNode) {
      currentNode.connect(this.compressorNode)
      currentNode = this.compressorNode
    }

    if (this.settings.stereoWidener.enabled && this.stereoSplitter && this.stereoMerger && this.stereoMidGain && this.stereoSideGain) {
      currentNode.connect(this.stereoSplitter)
      this.stereoSplitter.connect(this.stereoMidGain, 0)
      this.stereoSplitter.connect(this.stereoMidGain, 1)
      this.stereoSplitter.connect(this.stereoSideGain, 0)
      this.stereoSplitter.connect(this.stereoSideGain, 1)
      this.stereoMidGain.connect(this.stereoMerger, 0, 0)
      this.stereoMidGain.connect(this.stereoMerger, 0, 1)
      this.stereoSideGain.connect(this.stereoMerger, 0, 0)
      this.stereoSideGain.connect(this.stereoMerger, 0, 1)
      currentNode = this.stereoMerger
    }

    if (this.settings.surround3d.enabled && this.pannerNode) {
      currentNode.connect(this.pannerNode)
      currentNode = this.pannerNode
    }

    if (this.settings.reverb.enabled && this.reverbNode && this.reverbWetGain && this.reverbDryGain && this.reverbDelay) {
      const reverbInput = currentNode
      reverbInput.connect(this.reverbDryGain)
      reverbInput.connect(this.reverbDelay)
      this.reverbDelay.connect(this.reverbNode)
      this.reverbNode.connect(this.reverbWetGain)
      this.reverbDryGain.connect(this._outputNode)
      this.reverbWetGain.connect(this._outputNode)
    } else {
      currentNode.connect(this._outputNode)
    }
  }

  private updatePannerPosition(): void {
    if (!this.pannerNode) return
    const { panX, panY, panZ } = this.settings.surround3d
    this.pannerNode.positionX.value = panX
    this.pannerNode.positionY.value = panY
    this.pannerNode.positionZ.value = panZ
  }

  private updateStereoWidth(width: number): void {
    if (!this.stereoMidGain || !this.stereoSideGain) return
    const mid = 1 - width * 0.5
    const side = width * 0.7
    this.stereoMidGain.gain.value = mid
    this.stereoSideGain.gain.value = side
  }

  setReverbEnabled(enabled: boolean): void {
    this.settings.reverb.enabled = enabled
    this.rebuildChain()
  }

  setReverbWet(wet: number): void {
    this.settings.reverb.wet = Math.max(0, Math.min(1, wet))
    if (this.reverbWetGain) {
      this.reverbWetGain.gain.value = this.settings.reverb.wet
    }
  }

  setReverbDry(dry: number): void {
    this.settings.reverb.dry = Math.max(0, Math.min(1, dry))
    if (this.reverbDryGain) {
      this.reverbDryGain.gain.value = this.settings.reverb.dry
    }
  }

  setReverbDecay(decay: number): void {
    this.settings.reverb.decay = Math.max(0.1, Math.min(10, decay))
    if (this.reverbNode && this.audioContext) {
      this.reverbNode.buffer = this.createImpulseResponse(this.settings.reverb.decay)
    }
  }

  setSurround3DEnabled(enabled: boolean): void {
    this.settings.surround3d.enabled = enabled
    this.rebuildChain()
  }

  setSurround3DPosition(x: number, y: number, z: number): void {
    this.settings.surround3d.panX = Math.max(-5, Math.min(5, x))
    this.settings.surround3d.panY = Math.max(-5, Math.min(5, y))
    this.settings.surround3d.panZ = Math.max(-10, Math.min(10, z))
    this.updatePannerPosition()
  }

  setBassBoostEnabled(enabled: boolean): void {
    this.settings.bassBoost.enabled = enabled
    this.rebuildChain()
  }

  setBassBoostGain(gain: number): void {
    this.settings.bassBoost.gain = Math.max(0, Math.min(12, gain))
    if (this.bassBoostFilter) {
      this.bassBoostFilter.gain.value = this.settings.bassBoost.gain
    }
  }

  setBassBoostFrequency(freq: number): void {
    this.settings.bassBoost.frequency = Math.max(20, Math.min(200, freq))
    if (this.bassBoostFilter) {
      this.bassBoostFilter.frequency.value = this.settings.bassBoost.frequency
    }
  }

  setStereoWidenerEnabled(enabled: boolean): void {
    this.settings.stereoWidener.enabled = enabled
    this.rebuildChain()
  }

  setStereoWidth(width: number): void {
    this.settings.stereoWidener.width = Math.max(0, Math.min(1, width))
    this.updateStereoWidth(this.settings.stereoWidener.width)
  }

  setCompressorEnabled(enabled: boolean): void {
    this.settings.compressor.enabled = enabled
    this.rebuildChain()
  }

  setCompressorThreshold(threshold: number): void {
    this.settings.compressor.threshold = Math.max(-100, Math.min(0, threshold))
    if (this.compressorNode) {
      this.compressorNode.threshold.value = this.settings.compressor.threshold
    }
  }

  setCompressorRatio(ratio: number): void {
    this.settings.compressor.ratio = Math.max(1, Math.min(20, ratio))
    if (this.compressorNode) {
      this.compressorNode.ratio.value = this.settings.compressor.ratio
    }
  }

  getSettings(): AudioEffectsSettings {
    return JSON.parse(JSON.stringify(this.settings))
  }

  setSettings(settings: Partial<AudioEffectsSettings>): void {
    if (settings.reverb) {
      Object.assign(this.settings.reverb, settings.reverb)
    }
    if (settings.surround3d) {
      Object.assign(this.settings.surround3d, settings.surround3d)
    }
    if (settings.bassBoost) {
      Object.assign(this.settings.bassBoost, settings.bassBoost)
    }
    if (settings.stereoWidener) {
      Object.assign(this.settings.stereoWidener, settings.stereoWidener)
    }
    if (settings.compressor) {
      Object.assign(this.settings.compressor, settings.compressor)
    }
    this.rebuildChain()
    this.applySettingsToNodes()
  }

  private applySettingsToNodes(): void {
    if (this.reverbWetGain) this.reverbWetGain.gain.value = this.settings.reverb.wet
    if (this.reverbDryGain) this.reverbDryGain.gain.value = this.settings.reverb.dry
    if (this.reverbDelay) this.reverbDelay.delayTime.value = this.settings.reverb.preDelay
    if (this.reverbNode && this.audioContext) {
      this.reverbNode.buffer = this.createImpulseResponse(this.settings.reverb.decay)
    }
    this.updatePannerPosition()
    if (this.pannerNode) {
      this.pannerNode.distanceModel = this.settings.surround3d.distanceModel
      this.pannerNode.rolloffFactor = this.settings.surround3d.rolloffFactor
    }
    if (this.bassBoostFilter) {
      this.bassBoostFilter.frequency.value = this.settings.bassBoost.frequency
      this.bassBoostFilter.Q.value = this.settings.bassBoost.q
      this.bassBoostFilter.gain.value = this.settings.bassBoost.gain
    }
    this.updateStereoWidth(this.settings.stereoWidener.width)
    if (this.compressorNode) {
      this.compressorNode.threshold.value = this.settings.compressor.threshold
      this.compressorNode.knee.value = this.settings.compressor.knee
      this.compressorNode.ratio.value = this.settings.compressor.ratio
      this.compressorNode.attack.value = this.settings.compressor.attack
      this.compressorNode.release.value = this.settings.compressor.release
    }
  }

  reset(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_AUDIO_EFFECTS))
    this.rebuildChain()
    this.applySettingsToNodes()
  }

  getCompressionReduction(): number {
    if (!this.compressorNode) return 0
    return this.compressorNode.reduction
  }

  dispose(): void {
    try {
      this._inputNode?.disconnect()
      this._outputNode?.disconnect()
      this.bypassGain?.disconnect()
      this.reverbNode?.disconnect()
      this.reverbWetGain?.disconnect()
      this.reverbDryGain?.disconnect()
      this.reverbDelay?.disconnect()
      this.pannerNode?.disconnect()
      this.bassBoostFilter?.disconnect()
      this.bassBoostGain?.disconnect()
      this.stereoSplitter?.disconnect()
      this.stereoMerger?.disconnect()
      this.stereoMidGain?.disconnect()
      this.stereoSideGain?.disconnect()
      this.stereoDelay?.disconnect()
      this.compressorNode?.disconnect()
    } catch (e) {
      // ignore
    }
    this._inputNode = null
    this._outputNode = null
    this.bypassGain = null
    this.reverbNode = null
    this.reverbWetGain = null
    this.reverbDryGain = null
    this.reverbDelay = null
    this.pannerNode = null
    this.bassBoostFilter = null
    this.bassBoostGain = null
    this.stereoSplitter = null
    this.stereoMerger = null
    this.stereoMidGain = null
    this.stereoSideGain = null
    this.stereoDelay = null
    this.compressorNode = null
    this.audioContext = null
    this._initialized = false
  }
}
