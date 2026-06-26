import type { EnergyBands, BiquadFilterState, BiquadType } from './types'

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number(v) || 0))
}

export function clampRange(v: number, min: number, max: number): number {
  v = Number(v) || 0
  return Math.max(min, Math.min(max, v))
}

export function percentile(arr: ArrayLike<number>, p: number, maxSamples = 16000): number {
  const len = arr ? arr.length : 0
  if (!len) return 0.001
  let sample: number[]
  if (len <= maxSamples) {
    sample = Array.prototype.slice.call(arr)
  } else {
    sample = new Array(maxSamples)
    const step = (len - 1) / (maxSamples - 1)
    for (let i = 0; i < maxSamples; i++) {
      sample[i] = arr[Math.min(len - 1, Math.floor(i * step))] || 0
    }
  }
  sample.sort((a, b) => a - b)
  return sample[Math.max(0, Math.min(sample.length - 1, Math.floor(sample.length * p)))] || 0.001
}

export function median(vals: number[]): number {
  const filtered = vals.filter(v => Number.isFinite(v)).sort((a, b) => a - b)
  return filtered.length ? filtered[Math.floor(filtered.length * 0.5)] : 0
}

export function makeBiquad(type: BiquadType, freq: number, q: number, sr: number): BiquadFilterState {
  freq = Math.max(8, Math.min(freq, sr * 0.45))
  const w0 = (2 * Math.PI * freq) / sr
  const cos = Math.cos(w0)
  const sin = Math.sin(w0)
  const alpha = sin / (2 * (q || 0.707))
  let b0: number, b1: number, b2: number
  if (type === 'highpass') {
    b0 = (1 + cos) * 0.5
    b1 = -(1 + cos)
    b2 = (1 + cos) * 0.5
  } else {
    b0 = (1 - cos) * 0.5
    b1 = 1 - cos
    b2 = (1 - cos) * 0.5
  }
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  const inv = 1 / a0
  return {
    b0: b0 * inv,
    b1: b1 * inv,
    b2: b2 * inv,
    a1: a1 * inv,
    a2: a2 * inv,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  }
}

export function runBiquad(st: BiquadFilterState, x: number): number {
  const y = st.b0 * x + st.b1 * st.x1 + st.b2 * st.x2 - st.a1 * st.y1 - st.a2 * st.y2
  st.x2 = st.x1
  st.x1 = x
  st.y2 = st.y1
  st.y1 = y
  return y
}

export function freqToBin(freq: number, sampleRate: number, fftSize: number): number {
  return Math.round((freq / (sampleRate / 2)) * (fftSize / 2))
}

export function bandRms(
  frequencyData: Uint8Array | Float32Array | ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
  lowFreq: number,
  highFreq: number
): number {
  const lowBin = Math.max(0, freqToBin(lowFreq, sampleRate, fftSize))
  const highBin = Math.min(frequencyData.length - 1, freqToBin(highFreq, sampleRate, fftSize))
  if (highBin <= lowBin) return 0
  let sum = 0
  let count = 0
  for (let i = lowBin; i <= highBin; i++) {
    const v = frequencyData[i] || 0
    sum += v * v
    count++
  }
  return count > 0 ? Math.sqrt(sum / count) : 0
}

export class EnergyAnalyzer {
  private _subAvg = 0
  private _lowAvg = 0
  private _midAvg = 0
  private _highAvg = 0
  private _presenceAvg = 0

  private _subPeak = 0
  private _lowPeak = 0
  private _midPeak = 0
  private _highPeak = 0
  private _presencePeak = 0

  private _peakDecay = 0.96
  private _avgSmoothing = 0.92

  get subAvg() { return this._subAvg }
  get lowAvg() { return this._lowAvg }
  get midAvg() { return this._midAvg }
  get highAvg() { return this._highAvg }
  get presenceAvg() { return this._presenceAvg }

  get subPeak() { return this._subPeak }
  get lowPeak() { return this._lowPeak }
  get midPeak() { return this._midPeak }
  get highPeak() { return this._highPeak }
  get presencePeak() { return this._presencePeak }

  analyze(frequencyData: Uint8Array | Float32Array | ArrayLike<number>, sampleRate: number, fftSize: number): EnergyBands {
    const sub = bandRms(frequencyData, sampleRate, fftSize, 20, 60)
    const low = bandRms(frequencyData, sampleRate, fftSize, 60, 250)
    const mid = bandRms(frequencyData, sampleRate, fftSize, 250, 2000)
    const high = bandRms(frequencyData, sampleRate, fftSize, 2000, 8000)
    const presence = bandRms(frequencyData, sampleRate, fftSize, 8000, 20000)

    const maxVal = frequencyData instanceof Uint8Array ? 255 : 1.0
    const subNorm = sub / maxVal
    const lowNorm = low / maxVal
    const midNorm = mid / maxVal
    const highNorm = high / maxVal
    const presenceNorm = presence / maxVal

    this._subAvg = this._subAvg * this._avgSmoothing + subNorm * (1 - this._avgSmoothing)
    this._lowAvg = this._lowAvg * this._avgSmoothing + lowNorm * (1 - this._avgSmoothing)
    this._midAvg = this._midAvg * this._avgSmoothing + midNorm * (1 - this._avgSmoothing)
    this._highAvg = this._highAvg * this._avgSmoothing + highNorm * (1 - this._avgSmoothing)
    this._presenceAvg = this._presenceAvg * this._avgSmoothing + presenceNorm * (1 - this._avgSmoothing)

    this._subPeak = Math.max(subNorm, this._subPeak * this._peakDecay)
    this._lowPeak = Math.max(lowNorm, this._lowPeak * this._peakDecay)
    this._midPeak = Math.max(midNorm, this._midPeak * this._peakDecay)
    this._highPeak = Math.max(highNorm, this._highPeak * this._peakDecay)
    this._presencePeak = Math.max(presenceNorm, this._presencePeak * this._peakDecay)

    return {
      sub: subNorm,
      low: lowNorm,
      mid: midNorm,
      high: highNorm,
      presence: presenceNorm,
    }
  }

  reset(): void {
    this._subAvg = 0
    this._lowAvg = 0
    this._midAvg = 0
    this._highAvg = 0
    this._presenceAvg = 0
    this._subPeak = 0
    this._lowPeak = 0
    this._midPeak = 0
    this._highPeak = 0
    this._presencePeak = 0
  }

  setSmoothing(avg: number, peakDecay: number): void {
    this._avgSmoothing = clampRange(avg, 0.5, 0.99)
    this._peakDecay = clampRange(peakDecay, 0.9, 0.999)
  }
}
