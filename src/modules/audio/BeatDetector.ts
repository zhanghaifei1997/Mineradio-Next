import { clamp01, clampRange, percentile, median, makeBiquad, runBiquad } from './EnergyAnalyzer'
import type { BeatMap, BeatEvent, BeatCandidate, BeatCombo, DecodeInfo, DecodedEnergyResult } from './types'

export function buildBeatMapFromLowEnergy(
  lowEnergy: Float32Array | number[],
  hitEnergy: Float32Array | number[],
  hopSec: number,
  durationSec?: number
): BeatMap {
  const nFrames = Math.min(lowEnergy.length, hitEnergy.length)
  if (nFrames < 20) {
    return {
      kicks: [],
      beats: [],
      pulseBeats: [],
      cameraBeats: [],
      duration: durationSec || 0,
      visualBeatCount: 0,
      tempoSource: 'podcast-dj-server-empty',
      analyzedAt: Date.now(),
    }
  }

  function bandAt(arr: Float32Array | number[], idx: number): number {
    idx = Math.max(0, Math.min(nFrames - 1, idx | 0))
    const a = arr[Math.max(0, idx - 1)] || 0
    const b = arr[idx] || 0
    const c = arr[Math.min(nFrames - 1, idx + 1)] || 0
    return (a + b * 2 + c) * 0.25
  }

  const lowFloor = Math.max(0.0004, percentile(lowEnergy, 0.22))
  const lowMid = Math.max(lowFloor + 0.0002, percentile(lowEnergy, 0.58))
  const lowRef = Math.max(lowMid + 0.0002, percentile(lowEnergy, 0.86))
  const lowCeil = Math.max(lowRef + 0.0004, percentile(lowEnergy, 0.96))
  const hitRef = Math.max(0.0004, percentile(hitEnergy, 0.86))

  const onset = new Float32Array(nFrames)
  for (let i = 4; i < nFrames; i++) {
    const prev = lowEnergy[i - 1] * 0.62 + lowEnergy[i - 2] * 0.28 + lowEnergy[i - 3] * 0.10
    const lowRise = Math.max(0, lowEnergy[i] - prev)
    const wideRise = Math.max(0, (lowEnergy[i] + lowEnergy[i - 1]) * 0.5 - (lowEnergy[i - 3] + lowEnergy[i - 4]) * 0.5)
    const peakRise = Math.max(0, hitEnergy[i] - hitEnergy[i - 2] * 0.84)
    onset[i] = lowRise * 1.72 + wideRise * 0.86 + peakRise * 0.10
  }

  const winN = Math.max(52, Math.round(0.82 / hopSec))
  const minFrameGap = Math.max(18, Math.round(0.215 / hopSec))
  const candidates: BeatCandidate[] = []
  let sumO = 0
  let sqO = 0
  for (let i = 0; i < winN; i++) {
    const o = onset[i] || 0
    sumO += o
    sqO += o * o
  }
  for (let f = winN + 4; f < nFrames - 4; f++) {
    const mean = sumO / winN
    const std = Math.sqrt(Math.max(0, sqO / winN - mean * mean))
    const th = mean + std * 1.66 + lowRef * 0.0038
    const o = onset[f]
    if (o > th && o >= onset[f - 1] && o > onset[f + 1]) {
      let peakF = f
      let peakScore = o + lowEnergy[f] * 0.10
      for (let pf = f - 2; pf <= f + 3; pf++) {
        const ps = (onset[pf] || 0) + (lowEnergy[pf] || 0) * 0.10
        if (ps > peakScore) {
          peakScore = ps
          peakF = pf
        }
      }
      const lowTone = Math.min(2.6, bandAt(lowEnergy, peakF) / lowRef)
      const hitTone = Math.min(2.6, bandAt(hitEnergy, peakF) / hitRef)
      const lowRel = clamp01((bandAt(lowEnergy, peakF) - lowFloor) / Math.max(0.0001, lowCeil - lowFloor))
      const score = (o - th) / Math.max(0.0006, std + mean * 0.38 + lowRef * 0.012)
      if (score > 0.16 && (lowTone > 0.32 || lowRel > 0.22 || hitTone > 0.52)) {
        const cand: BeatCandidate = {
          frame: peakF,
          time: peakF * hopSec,
          score,
          lowTone,
          hitTone,
          lowRel,
          raw: o,
          power: 0,
        }
        cand.power = cand.score * 0.56 + Math.pow(clamp01((cand.lowTone - 0.22) / 1.42), 0.82) * 0.34 + Math.min(1.5, cand.hitTone) * 0.08 + cand.lowRel * 0.10
        const last = candidates[candidates.length - 1]
        if (last && cand.frame - last.frame < minFrameGap) {
          if (cand.power > last.power) candidates[candidates.length - 1] = cand
        } else {
          candidates.push(cand)
        }
      }
    }
    const old = onset[f - winN] || 0
    const next = onset[f] || 0
    sumO += next - old
    sqO += next * next - old * old
  }

  if (!candidates.length) {
    return {
      kicks: [],
      beats: [],
      pulseBeats: [],
      cameraBeats: [],
      duration: durationSec || nFrames * hopSec,
      visualBeatCount: 0,
      tempoSource: 'podcast-dj-server-empty',
      analyzedAt: Date.now(),
    }
  }

  const powers = candidates.map(c => c.power)
  const p30 = percentile(powers, 0.30)
  const p50 = percentile(powers, 0.50)
  const p90 = Math.max(p50 + 0.001, percentile(powers, 0.90))
  const p96 = Math.max(p90 + 0.001, percentile(powers, 0.965))
  let strong = candidates.filter(c => c.power >= p50 && c.lowTone > 0.34)
  if (strong.length < 16) strong = candidates.slice()

  function estimateStep(list: BeatCandidate[]): number {
    if (!list || list.length < 3) return 0
    const bin = 0.006
    const hist: Record<number, number> = {}
    const medGaps: number[] = []
    for (let ai = 0; ai < list.length; ai++) {
      for (let bi = ai + 1; bi < list.length && bi < ai + 10; bi++) {
        const rawGap = list[bi].time - list[ai].time
        if (rawGap < 0.24) continue
        if (rawGap > 2.55) break
        for (let div = 1; div <= 6; div++) {
          const g = rawGap / div
          if (g < 0.31) break
          if (g > 0.86) continue
          const weight = Math.sqrt(Math.max(0.001, list[ai].power * list[bi].power)) / Math.sqrt((bi - ai) * div)
          const key = Math.round(g / bin)
          hist[key] = (hist[key] || 0) + weight
          medGaps.push(g)
        }
      }
    }
    let bestKey: number | null = null
    let bestScore = 0
    Object.keys(hist).forEach(k => {
      const key = parseInt(k, 10)
      const score = (hist[key] || 0) + (hist[key - 1] || 0) * 0.72 + (hist[key + 1] || 0) * 0.72
      if (score > bestScore) {
        bestScore = score
        bestKey = key
      }
    })
    if (bestKey != null) return bestKey * bin
    return median(medGaps)
  }

  let globalStep = estimateStep(strong) || estimateStep(candidates) || 0.50
  globalStep = clampRange(globalStep, 0.32, 0.86)

  function nearestCandidate(center: number, windowSec: number, startIdx = 0): BeatCandidate | null {
    let best: BeatCandidate | null = null
    let bestScore = -Infinity
    let j = startIdx
    while (j < candidates.length && candidates[j].time < center - windowSec) j++
    for (let ni = j; ni < candidates.length && candidates[ni].time <= center + windowSec; ni++) {
      const dist = Math.abs(candidates[ni].time - center)
      const score = candidates[ni].power * (1 - dist / Math.max(0.001, windowSec) * 0.42)
      if (score > bestScore) {
        best = candidates[ni]
        bestScore = score
      }
    }
    return best
  }

  function scorePhase(anchorTime: number, step: number): number {
    let start = anchorTime
    while (start - step > 0.05) start -= step
    const end = Math.min(durationSec || nFrames * hopSec, 180)
    const win = Math.max(0.055, Math.min(0.125, step * 0.18))
    let score = 0
    let count = 0
    let cursor = 0
    for (let gt = start; gt < end; gt += step) {
      while (cursor < candidates.length && candidates[cursor].time < gt - win) cursor++
      let bestScore = 0
      for (let pi = cursor; pi < candidates.length && candidates[pi].time <= gt + win; pi++) {
        const dist = Math.abs(candidates[pi].time - gt)
        const s = candidates[pi].power * (1 - dist / win * 0.44)
        if (s > bestScore) bestScore = s
      }
      score += bestScore ? bestScore : -p30 * 0.08
      count++
    }
    return count ? score / count : -Infinity
  }

  let phaseSource = strong.filter(c => c.time < Math.min(durationSec || nFrames * hopSec, 180)).slice(0, 72)
  if (!phaseSource.length) phaseSource = strong.slice(0, 1)
  let bestAnchor = phaseSource[0] ? phaseSource[0].time : 0
  let bestAnchorScore = -Infinity
  for (let i = 0; i < phaseSource.length; i++) {
    const score = scorePhase(phaseSource[i].time, globalStep)
    if (score > bestAnchorScore) {
      bestAnchorScore = score
      bestAnchor = phaseSource[i].time
    }
  }
  const halfStep = globalStep * 0.5
  if (halfStep >= 0.31) {
    const halfScore = scorePhase(bestAnchor, halfStep)
    if (halfScore > bestAnchorScore * 1.04) globalStep = halfStep
  }
  let anchor = bestAnchor
  while (anchor - globalStep > 0.05) anchor -= globalStep

  const duration = durationSec || nFrames * hopSec
  const sectionLen = duration > 3600 ? 96 : 72
  const sectionCount = Math.max(1, Math.ceil(duration / sectionLen))
  const sectionSteps: number[] = []
  for (let si = 0; si < sectionCount; si++) {
    const t0 = si * sectionLen
    const t1 = Math.min(duration, t0 + sectionLen)
    const seg = strong.filter(c => c.time >= t0 && c.time < t1)
    const prevStep = sectionSteps.length ? sectionSteps[sectionSteps.length - 1] : globalStep
    let localStep = estimateStep(seg) || prevStep || globalStep
    if (prevStep) localStep = clampRange(localStep, prevStep * 0.94, prevStep * 1.06)
    if (globalStep) localStep = clampRange(localStep, globalStep * 0.86, globalStep * 1.14)
    sectionSteps.push(prevStep ? localStep * 0.30 + prevStep * 0.70 : localStep)
  }
  function stepAt(time: number): number {
    const idx = Math.max(0, Math.min(sectionSteps.length - 1, Math.floor(time / sectionLen)))
    return sectionSteps[idx] || globalStep || 0.50
  }

  const beats: BeatEvent[] = []
  let gridIndex = 0
  let cursorIdx = 0
  for (let gridT = anchor; gridT < duration - 0.04;) {
    const localStep = stepAt(gridT) || globalStep || 0.50
    const winSec = Math.max(0.060, Math.min(0.135, localStep * 0.20))
    while (cursorIdx < candidates.length && candidates[cursorIdx].time < gridT - winSec) cursorIdx++
    const bestCand = nearestCandidate(gridT, winSec, cursorIdx)
    const gf = Math.max(0, Math.min(nFrames - 1, Math.round(gridT / hopSec)))
    const gridLow = bandAt(lowEnergy, gf)
    const gridHit = bandAt(hitEnergy, gf)
    const gridLowTone = Math.min(2.6, gridLow / lowRef)
    const gridHitTone = Math.min(2.6, gridHit / hitRef)
    const lowTone = bestCand ? Math.max(gridLowTone * 0.62, bestCand.lowTone) : gridLowTone
    const hitTone = bestCand ? Math.max(gridHitTone * 0.62, bestCand.hitTone) : gridHitTone
    const distPenalty = bestCand ? (1 - Math.min(1, Math.abs(bestCand.time - gridT) / winSec) * 0.26) : 0.54
    const basePower = bestCand ? bestCand.power * distPenalty : gridLowTone * 0.25 + gridHitTone * 0.06
    const powerRel = clamp01((basePower - p30 * 0.78) / Math.max(0.001, p96 - p30 * 0.78))
    const lowRel = clamp01((gridLow - lowFloor) / Math.max(0.0001, lowCeil - lowFloor))
    const kickRel = clamp01(powerRel * 0.74 + lowRel * 0.22 + clamp01((hitTone - 0.26) / 1.70) * 0.04)
    const softGrid = (!bestCand && lowRel < 0.20) || kickRel < 0.16
    const slot = gridIndex % 4
    let combo: BeatCombo = slot === 0 ? 'downbeat' : slot === 1 ? 'push' : slot === 2 ? 'drop' : 'rebound'
    if (kickRel > 0.84 && combo !== 'downbeat') combo = 'accent'
    const visualRel = kickRel > 0.76 ? 0.76 + (kickRel - 0.76) * 0.52 : kickRel
    const downLift = combo === 'downbeat' ? (visualRel > 0.18 ? 0.016 + visualRel * 0.036 : visualRel * 0.028) : 0
    const sectionGate = clamp01((kickRel - 0.10) / 0.58)
    let impact = Math.max(0.020, Math.min(0.88, 0.022 + Math.pow(visualRel, 1.62) * 0.86 + downLift))
    let strength = Math.max(0.12, Math.min(0.93, 0.13 + Math.pow(visualRel, 1.12) * 0.68 + downLift * 0.70))
    if (softGrid) {
      const softMul = combo === 'downbeat' ? 0.48 : 0.30
      impact *= softMul
      strength *= 0.58 + sectionGate * 0.22
    }
    const timingPull = bestCand ? 0.24 + clamp01((kickRel - 0.25) / 0.65) * 0.46 : 0
    const sourceTime = bestCand ? gridT * (1 - timingPull) + bestCand.time * timingPull : gridT
    const cameraActive = impact >= 0.13 || (combo === 'downbeat' && kickRel >= 0.14) || !!(bestCand && kickRel >= 0.18)
    const low = Math.max(0.42, Math.min(0.90, 0.52 + visualRel * 0.32 + lowTone * 0.035 - (combo === 'accent' ? 0.10 : 0)))
    const body = Math.max(0.035, Math.min(0.54, 0.060 + visualRel * 0.12 + (combo === 'push' ? 0.18 : 0) + (combo === 'drop' ? 0.24 : 0)))
    const snap = Math.max(0.015, Math.min(0.62, 0.026 + (combo === 'accent' ? 0.40 : 0) + (combo === 'rebound' ? 0.08 : 0) + visualRel * 0.038))
    beats.push({
      time: sourceTime,
      strength,
      confidence: Math.max(0.44, Math.min(0.99, 0.46 + kickRel * 0.43 + (bestCand ? 0.08 : -0.03))),
      impact,
      primary: cameraActive,
      camera: cameraActive,
      pulse: impact > 0.16 || (combo === 'downbeat' && kickRel >= 0.18),
      tone: 'podcast-dj-server-low-grid',
      low,
      body,
      snap,
      mass: Math.max(0.36, Math.min(0.94, low * 0.72 + Math.pow(visualRel, 1.22) * 0.24)),
      sharpness: Math.max(0.03, Math.min(0.28, snap * 1.18)),
      combo,
      step: localStep,
      index: beats.length,
      dj: true,
      grid: true,
      kickOnly: true,
      server: true,
    })
    gridIndex++
    gridT += localStep
  }

  const cameraBeats = beats.filter(b => b.camera !== false)
  const pulseBeats = beats
    .filter(b => b.pulse !== false && (b.impact >= 0.16 || b.combo === 'downbeat'))
    .map(b => ({ time: b.time, strength: b.strength, impact: b.impact, combo: b.combo, low: b.low, body: b.body, snap: b.snap, dj: true }))

  return {
    kicks: beats.map(b => b.time),
    beats,
    pulseBeats,
    cameraBeats,
    gridStep: globalStep,
    sectionSteps,
    tempoSource: 'podcast-dj-server-low-offline',
    duration,
    visualBeatCount: cameraBeats.length,
    analyzedAt: Date.now(),
    debug: {
      candidates: candidates.length,
      hopSec,
      lowRef,
      step: globalStep,
    },
  }
}

export class BeatDetector {
  private _lastBeatTime = 0
  private _beatHistory: number[] = []
  private _maxHistory = 20
  private _minBeatInterval = 0.2
  private _sensitivity = 0.65

  get lastBeatTime(): number {
    return this._lastBeatTime
  }

  get bpmEstimate(): number {
    if (this._beatHistory.length < 2) return 0
    let sum = 0
    for (let i = 1; i < this._beatHistory.length; i++) {
      sum += this._beatHistory[i] - this._beatHistory[i - 1]
    }
    const avgInterval = sum / (this._beatHistory.length - 1)
    return avgInterval > 0 ? 60 / avgInterval : 0
  }

  detectFromEnergy(bassEnergy: number, bassAvg: number, currentTime: number): boolean {
    if (bassAvg <= 0.001) return false
    const ratio = bassEnergy / bassAvg
    const timeSinceLast = currentTime - this._lastBeatTime

    if (ratio > this._sensitivity && timeSinceLast > this._minBeatInterval && bassEnergy > 0.1) {
      this._lastBeatTime = currentTime
      this._beatHistory.push(currentTime)
      if (this._beatHistory.length > this._maxHistory) {
        this._beatHistory.shift()
      }
      return true
    }
    return false
  }

  setSensitivity(sens: number): void {
    this._sensitivity = Math.max(0.3, Math.min(1.5, sens))
  }

  setMinBeatInterval(seconds: number): void {
    this._minBeatInterval = Math.max(0.08, Math.min(0.5, seconds))
  }

  reset(): void {
    this._lastBeatTime = 0
    this._beatHistory = []
  }
}
