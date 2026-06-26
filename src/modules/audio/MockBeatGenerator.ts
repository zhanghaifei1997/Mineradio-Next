import type { RealtimeBeatState, CinemaDynamics, EnergyBands } from './types'

export interface MockBeatOptions {
  bpm?: number
  minEnergy?: number
  maxEnergy?: number
  bassBias?: number
  randomVariation?: number
}

const DEFAULT_OPTIONS: Required<MockBeatOptions> = {
  bpm: 100,
  minEnergy: 0.3,
  maxEnergy: 0.6,
  bassBias: 1.3,
  randomVariation: 0.15,
}

export class MockBeatGenerator {
  private _options: Required<MockBeatOptions>
  private _startTime: number = 0
  private _beatState: RealtimeBeatState
  private _cinemaDynamics: CinemaDynamics
  private _energyBands: EnergyBands
  private _lastBeatTime: number = 0
  private _beatInterval: number = 0
  private _phase: number = 0

  constructor(options: MockBeatOptions = {}) {
    this._options = { ...DEFAULT_OPTIONS, ...options }
    this._beatInterval = 60 / this._options.bpm
    this._beatState = {
      bass: 0,
      mid: 0,
      treble: 0,
      bassAvg: 0.3,
      midAvg: 0.25,
      trebleAvg: 0.2,
      bassPeak: 0.3,
      midPeak: 0.25,
      treblePeak: 0.2,
      beatDetected: false,
      beatStrength: 0,
      lastBeatTime: 0,
    }
    this._cinemaDynamics = {
      avg: 0.25,
      lowAvg: 0.3,
      peak: 0.35,
      scale: 0.82,
    }
    this._energyBands = {
      sub: 0.3,
      low: 0.35,
      mid: 0.25,
      high: 0.2,
      presence: 0.15,
    }
  }

  get beatState(): Readonly<RealtimeBeatState> {
    return this._beatState
  }

  get cinemaDynamics(): Readonly<CinemaDynamics> {
    return this._cinemaDynamics
  }

  get energyBands(): Readonly<EnergyBands> {
    return this._energyBands
  }

  start(): void {
    this._startTime = performance.now() / 1000
    this._lastBeatTime = 0
    this._phase = 0
  }

  stop(): void {
    this._beatState.beatDetected = false
    this._beatState.beatStrength = 0
  }

  setBpm(bpm: number): void {
    this._options.bpm = Math.max(60, Math.min(140, bpm))
    this._beatInterval = 60 / this._options.bpm
  }

  update(dt: number = 0.016): boolean {
    const now = performance.now() / 1000
    const elapsed = now - this._startTime
    const { minEnergy, maxEnergy, bassBias, randomVariation } = this._options

    const beatProgress = (elapsed % this._beatInterval) / this._beatInterval
    const beatPhase = beatProgress * Math.PI * 2
    const beatWave = (Math.sin(beatPhase - Math.PI / 2) + 1) / 2

    const barPhase = (elapsed / (this._beatInterval * 4)) * Math.PI * 2
    const barWave = (Math.sin(barPhase - Math.PI / 2) + 1) / 2

    const bassEnvelope = Math.pow(beatWave, 2.5)
    const midEnvelope = Math.pow(beatWave, 1.8) * 0.8 + barWave * 0.15
    const trebleEnvelope = Math.pow(beatWave, 1.2) * 0.5 + Math.sin(elapsed * 2.5) * 0.1 + 0.2

    const randomBass = (Math.random() - 0.5) * randomVariation
    const randomMid = (Math.random() - 0.5) * randomVariation * 0.8
    const randomTreble = (Math.random() - 0.5) * randomVariation * 0.6

    const energyRange = maxEnergy - minEnergy
    const bass = Math.max(0, Math.min(1,
      minEnergy + bassEnvelope * energyRange * bassBias + randomBass
    ))
    const mid = Math.max(0, Math.min(1,
      minEnergy + midEnvelope * energyRange * 0.85 + randomMid
    ))
    const treble = Math.max(0, Math.min(1,
      minEnergy * 0.7 + trebleEnvelope * energyRange * 0.6 + randomTreble
    ))

    const smooth = 0.92
    const peakDecay = 0.96

    this._beatState.bass = bass
    this._beatState.mid = mid
    this._beatState.treble = treble

    this._beatState.bassAvg = this._beatState.bassAvg * smooth + bass * (1 - smooth)
    this._beatState.midAvg = this._beatState.midAvg * smooth + mid * (1 - smooth)
    this._beatState.trebleAvg = this._beatState.trebleAvg * smooth + treble * (1 - smooth)

    this._beatState.bassPeak = Math.max(bass, this._beatState.bassPeak * peakDecay)
    this._beatState.midPeak = Math.max(mid, this._beatState.midPeak * peakDecay)
    this._beatState.treblePeak = Math.max(treble, this._beatState.treblePeak * peakDecay)

    const bassRatio = this._beatState.bassAvg > 0.001 ? bass / this._beatState.bassAvg : 0
    const timeSinceLastBeat = elapsed - this._lastBeatTime

    const beatDetected = bassRatio > 1.4 && timeSinceLastBeat > this._beatInterval * 0.6 && bass > minEnergy * 1.2

    this._beatState.beatDetected = beatDetected
    this._beatState.beatStrength = beatDetected ? Math.min(0.7, bassRatio * 0.4 + bass * 0.3) : 0

    if (beatDetected) {
      this._beatState.lastBeatTime = elapsed
      this._lastBeatTime = elapsed
    }

    this._updateCinemaDynamics(dt, bass, mid)
    this._updateEnergyBands(bass, mid, treble)

    return beatDetected
  }

  private _updateCinemaDynamics(dt: number, bass: number, mid: number): void {
    const total = bass * 0.7 + mid * 0.3
    const smooth = Math.max(0.88, Math.min(0.985, 0.92 + dt * 2))
    const lowSmooth = Math.max(0.90, Math.min(0.99, 0.94 + dt * 1.5))

    this._cinemaDynamics.avg = this._cinemaDynamics.avg * smooth + total * (1 - smooth)
    this._cinemaDynamics.lowAvg = this._cinemaDynamics.lowAvg * lowSmooth + bass * (1 - lowSmooth)

    const peakTarget = Math.max(0.25, this._cinemaDynamics.avg * 2.0)
    const peakSmooth = Math.max(0.96, Math.min(0.998, 0.98 + dt))
    this._cinemaDynamics.peak = this._cinemaDynamics.peak * peakSmooth + peakTarget * (1 - peakSmooth)

    const scaleTarget = 0.6 + Math.min(0.6, this._cinemaDynamics.avg * 2.5) * 0.4
    const scaleSmooth = Math.max(0.94, Math.min(0.995, 0.97 + dt * 1.2))
    this._cinemaDynamics.scale = this._cinemaDynamics.scale * scaleSmooth + scaleTarget * (1 - scaleSmooth)
  }

  private _updateEnergyBands(bass: number, mid: number, treble: number): void {
    this._energyBands.sub = bass * 0.9 + Math.random() * 0.05
    this._energyBands.low = bass * 0.8 + mid * 0.2
    this._energyBands.mid = mid * 0.9 + treble * 0.1
    this._energyBands.high = treble * 0.85 + Math.random() * 0.08
    this._energyBands.presence = treble * 0.7 + Math.random() * 0.1
  }

  reset(): void {
    this._beatState = {
      bass: 0,
      mid: 0,
      treble: 0,
      bassAvg: 0.3,
      midAvg: 0.25,
      trebleAvg: 0.2,
      bassPeak: 0.3,
      midPeak: 0.25,
      treblePeak: 0.2,
      beatDetected: false,
      beatStrength: 0,
      lastBeatTime: 0,
    }
    this._cinemaDynamics = {
      avg: 0.25,
      lowAvg: 0.3,
      peak: 0.35,
      scale: 0.82,
    }
    this._energyBands = {
      sub: 0.3,
      low: 0.35,
      mid: 0.25,
      high: 0.2,
      presence: 0.15,
    }
    this._lastBeatTime = 0
    this._phase = 0
  }
}
