import type { RealtimeBeatState, RealtimeBeatResult, AudioAnalysisData } from './types'

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function beatBandRms(
  data: Uint8Array,
  sampleRate: number,
  fftSize: number,
  hz0: number,
  hz1: number,
): number {
  const binHz = sampleRate / fftSize
  const a = Math.max(1, Math.floor(hz0 / binHz))
  const b = Math.min(data.length - 1, Math.ceil(hz1 / binHz))
  let sum = 0
  let count = 0
  for (let i = a; i <= b; i++) {
    const v = data[i] / 255
    sum += v * v
    count++
  }
  return count ? Math.sqrt(sum / count) : 0
}

export class BeatSync {
  rtBeat: RealtimeBeatState
  private beatPulse = 0
  private beatPulseSmooth = 0
  private lastBeatTime = 0
  private beatCount = 0

  constructor() {
    this.rtBeat = this.createInitialState()
  }

  private createInitialState(): RealtimeBeatState {
    return {
      subFast: 0,
      subSlow: 0,
      lowFast: 0,
      lowSlow: 0,
      bodyFast: 0,
      bodySlow: 0,
      vocalFast: 0,
      vocalSlow: 0,
      snapFast: 0,
      snapSlow: 0,
      prevSub: 0,
      prevLow: 0,
      prevBody: 0,
      prevVocal: 0,
      prevSnap: 0,
      prevRms: 0,
      onsetAvg: 0.012,
      onsetPeak: 0.060,
      subPeak: 0.14,
      lowPeak: 0.18,
      bodyPeak: 0.16,
      vocalPeak: 0.16,
      snapPeak: 0.14,
      lastHitAt: -10,
      tempoGap: 0,
      tempoConfidence: 0,
      beatCount: 0,
      primedFrames: 0,
      warmupUntil: 0,
      pulse: 0,
      score: 0,
      stats: {
        hits: 0,
        blocked: 0,
        assisted: 0,
        strong: 0,
        rejected: 0,
      },
    }
  }

  reset(): void {
    this.rtBeat = this.createInitialState()
    this.beatPulse = 0
    this.beatPulseSmooth = 0
    this.lastBeatTime = 0
    this.beatCount = 0
  }

  processAudioData(
    frequencyData: Uint8Array | null,
    timeDomainData: Uint8Array | null,
    sampleRate: number,
    fftSize: number,
    currentTime: number,
    isPlaying: boolean,
    dt: number,
  ): RealtimeBeatResult {
    if (!isPlaying || !frequencyData) {
      this.beatPulse *= Math.pow(0.01, dt)
      this.beatPulseSmooth *= Math.pow(0.05, dt)
      return { hit: false, beatPulse: this.beatPulseSmooth }
    }

    dt = Math.max(0.001, Math.min(0.080, dt || 0.016))

    const sub = beatBandRms(frequencyData, sampleRate, fftSize, 38, 74)
    const kick = beatBandRms(frequencyData, sampleRate, fftSize, 52, 165)
    const body = beatBandRms(frequencyData, sampleRate, fftSize, 165, 420)
    const vocal = beatBandRms(frequencyData, sampleRate, fftSize, 420, 2600)
    const snap = beatBandRms(frequencyData, sampleRate, fftSize, 1800, 9200)
    const low = Math.min(1, kick * 0.86 + sub * 0.42)

    let rms = 0
    if (timeDomainData) {
      for (let i = 0; i < timeDomainData.length; i++) {
        const tv = (timeDomainData[i] - 128) / 128
        rms += tv * tv
      }
      rms = Math.sqrt(rms / timeDomainData.length)
    }

    const follow = (cur: number, next: number, upTau: number, downTau: number): number => {
      const tau = next > cur ? upTau : downTau
      return cur + (next - cur) * (1 - Math.exp(-dt / Math.max(0.001, tau)))
    }

    const rt = this.rtBeat

    rt.subFast = follow(rt.subFast, sub, 0.018, 0.064)
    rt.subSlow = follow(rt.subSlow, sub, 0.320, 0.520)
    rt.lowFast = follow(rt.lowFast, low, 0.016, 0.070)
    rt.lowSlow = follow(rt.lowSlow, low, 0.300, 0.540)
    rt.bodyFast = follow(rt.bodyFast, body, 0.020, 0.082)
    rt.bodySlow = follow(rt.bodySlow, body, 0.360, 0.600)
    rt.vocalFast = follow(rt.vocalFast, vocal, 0.026, 0.090)
    rt.vocalSlow = follow(rt.vocalSlow, vocal, 0.340, 0.580)
    rt.snapFast = follow(rt.snapFast, snap, 0.012, 0.060)
    rt.snapSlow = follow(rt.snapSlow, snap, 0.300, 0.520)

    const peakDecay = 0.99
    rt.subPeak = Math.max(rt.subPeak * Math.pow(peakDecay, dt * 60), sub, 0.045)
    rt.lowPeak = Math.max(rt.lowPeak * Math.pow(0.989, dt * 60), low, 0.060)
    rt.bodyPeak = Math.max(rt.bodyPeak * Math.pow(peakDecay, dt * 60), body, 0.040)
    rt.vocalPeak = Math.max(rt.vocalPeak * Math.pow(peakDecay, dt * 60), vocal, 0.040)
    rt.snapPeak = Math.max(rt.snapPeak * Math.pow(peakDecay, dt * 60), snap, 0.035)

    const subFlux = Math.max(0, sub - rt.prevSub)
    const lowFlux = Math.max(0, low - rt.prevLow)
    const bodyFlux = Math.max(0, body - rt.prevBody)
    const vocalFlux = Math.max(0, vocal - rt.prevVocal)
    const snapFlux = Math.max(0, snap - rt.prevSnap)
    const rmsFlux = Math.max(0, rms - rt.prevRms)

    const subRise = Math.max(0, rt.subFast - rt.subSlow)
    const lowRise = Math.max(0, rt.lowFast - rt.lowSlow)
    const bodyRise = Math.max(0, rt.bodyFast - rt.bodySlow)
    const vocalRise = Math.max(0, rt.vocalFast - rt.vocalSlow)
    const snapRise = Math.max(0, rt.snapFast - rt.snapSlow)

    const drumOnset = subRise * 0.88 + subFlux * 0.66 + lowRise * 1.62 + lowFlux * 1.34
    const musicalOnset = bodyRise * 0.34 + bodyFlux * 0.24 + vocalRise * 0.52 + vocalFlux * 0.36 + snapRise * 0.08 + snapFlux * 0.06 + rmsFlux * 0.20
    const onset = drumOnset + musicalOnset * 0.16

    const avgTau = onset > rt.onsetAvg ? 1.10 : 0.34
    rt.onsetAvg = follow(rt.onsetAvg, onset, avgTau, avgTau)
    rt.onsetPeak = Math.max(rt.onsetPeak * Math.pow(0.988, dt * 60), onset, 0.032)

    const floor = rt.onsetAvg * 0.84
    const score = clamp01((onset - floor) / Math.max(0.014, rt.onsetPeak - floor))

    const subNorm = clamp01(sub / Math.max(0.045, rt.subPeak * 0.70))
    const lowNorm = clamp01(low / Math.max(0.060, rt.lowPeak * 0.72))
    const bodyNorm = clamp01(body / Math.max(0.045, rt.bodyPeak * 0.72))
    const vocalNorm = clamp01(vocal / Math.max(0.045, rt.vocalPeak * 0.72))
    const snapNorm = clamp01(snap / Math.max(0.040, rt.snapPeak * 0.72))

    rt.primedFrames++
    const warmingUp = currentTime < rt.warmupUntil || rt.primedFrames < 18

    const gapFromLast = currentTime - rt.lastHitAt
    const expectedGap = rt.tempoGap > 0 ? rt.tempoGap : 0
    const phaseErr = expectedGap > 0 ? Math.abs(gapFromLast - expectedGap) : 99
    const phaseWindow = expectedGap > 0 ? Math.max(0.055, Math.min(0.105, expectedGap * 0.16)) : 0
    const tempoDue = expectedGap > 0 && gapFromLast > expectedGap - phaseWindow && gapFromLast < expectedGap + phaseWindow

    const lowPresence = Math.max(lowNorm, subNorm * 0.74)
    const lowAttack = lowRise + lowFlux * 0.72 + subRise * 0.58 + subFlux * 0.40
    const lowDominance = low / Math.max(0.001, vocal * 0.84 + body * 0.36 + snap * 0.10)
    const lowFluxDominance = (lowFlux + subFlux * 0.58) / Math.max(0.001, vocalFlux * 0.72 + bodyFlux * 0.42 + snapFlux * 0.16)
    const voiceMask = vocalNorm > 0.58 && lowDominance < 0.86 && lowFluxDominance < 1.10

    let drumGate = lowPresence > 0.38 && lowAttack > Math.max(0.014, rt.onsetAvg * 0.34) && !voiceMask
    drumGate = drumGate && (lowDominance > 0.72 || lowFluxDominance > 1.02 || subNorm > 0.56)

    const strongTransient = drumGate && score > 0.54 && drumOnset > rt.onsetAvg * 0.84
    const kickTransient = drumGate && score > 0.40 && lowAttack > Math.max(0.018, rt.onsetAvg * 0.46)
    const tempoAssist = tempoDue && rt.tempoConfidence > 0.42 && drumGate && score > 0.22 && lowAttack > Math.max(0.016, rt.onsetAvg * 0.34)

    let candidateHit = strongTransient || kickTransient || tempoAssist
    if (warmingUp) candidateHit = false

    const hasTempoLock = expectedGap >= 0.42 && expectedGap <= 0.88 && rt.tempoConfidence > 0.38
    const lockedWindow = hasTempoLock ? Math.max(0.070, Math.min(0.110, expectedGap * 0.16)) : 0
    const gapRaw = currentTime - rt.lastHitAt

    let rhythmAccept = false
    if (candidateHit) {
      if (rt.lastHitAt < 0) {
        rhythmAccept = strongTransient && score > 0.62 && lowPresence > 0.48
      } else if (hasTempoLock) {
        const oneBeatErr = Math.abs(gapRaw - expectedGap)
        const twoBeatErr = Math.abs(gapRaw - expectedGap * 2)
        rhythmAccept = oneBeatErr <= lockedWindow && (kickTransient || strongTransient)
        rhythmAccept = rhythmAccept || (twoBeatErr <= lockedWindow * 1.35 && strongTransient && score > 0.58)
        rhythmAccept = rhythmAccept || (gapRaw > expectedGap * 1.55 && strongTransient && lowPresence > 0.44)
      } else {
        rhythmAccept = gapRaw >= 0.220 && strongTransient && score > 0.58 && lowPresence > 0.44
      }
    }

    let hit = candidateHit && rhythmAccept

    const minGap = hasTempoLock ? Math.max(0.400, Math.min(0.540, expectedGap * 0.72)) : 0.220
    if (hit && gapRaw < minGap) {
      rt.stats.blocked++
      hit = false
    }

    rt.prevSub = sub
    rt.prevLow = low
    rt.prevBody = body
    rt.prevVocal = vocal
    rt.prevSnap = snap
    rt.prevRms = rms
    rt.score = score
    rt.pulse *= Math.pow(0.18, dt)
    rt.tempoConfidence *= Math.pow(0.996, dt * 60)

    if (!hit) {
      if (score > 0.42 || vocalNorm > 0.62 || bodyNorm > 0.54) rt.stats.rejected++
      this.beatPulse *= Math.pow(0.05, dt)
      this.beatPulseSmooth += (this.beatPulse - this.beatPulseSmooth) * 0.1
      return { hit: false, beatPulse: this.beatPulseSmooth, low: lowNorm, body: bodyNorm, vocal: vocalNorm, snap: snapNorm, confidence: rt.tempoConfidence }
    }

    if (rt.lastHitAt > 0) {
      let gap = currentTime - rt.lastHitAt
      while (gap > 0.88) gap *= 0.5
      while (gap < 0.42) gap *= 2.0
      if (gap >= 0.42 && gap <= 0.88) {
        const tempoEase = hasTempoLock ? 0.10 : 0.22
        rt.tempoGap = rt.tempoGap ? rt.tempoGap * (1 - tempoEase) + gap * tempoEase : gap
        rt.tempoConfidence = Math.min(1, rt.tempoConfidence + 0.18)
      }
    }

    rt.lastHitAt = currentTime
    rt.beatCount++
    rt.stats.hits++
    if (tempoAssist) rt.stats.assisted++
    if (strongTransient || kickTransient) rt.stats.strong++

    const strength = clamp01(0.24 + score * 0.36 + lowPresence * 0.34 + Math.min(1.25, lowDominance) * 0.07 + rmsFlux * 0.95)
    const mass = clamp01(lowPresence * 0.76 + bodyNorm * 0.20)
    const sharpness = clamp01(snapNorm * 0.70 + bodyNorm * 0.12)

    const comboSlot = (rt.beatCount - 1) % 4
    const combo = comboSlot === 0 ? 'downbeat' : (comboSlot === 1 ? 'push' : (comboSlot === 2 ? 'drop' : 'rebound'))

    rt.pulse = Math.max(rt.pulse, strength)
    this.beatPulse = Math.max(this.beatPulse, strength)
    this.beatPulseSmooth = Math.max(this.beatPulseSmooth, strength * 0.8)
    this.lastBeatTime = currentTime
    this.beatCount++

    return {
      hit: true,
      time: currentTime,
      strength,
      confidence: clamp01(score * 0.62 + lowPresence * 0.26 + rt.tempoConfidence * 0.12),
      low: Math.max(0.05, lowPresence),
      body: Math.max(0.02, bodyNorm * 0.62),
      snap: Math.max(0.02, snapNorm),
      mass,
      sharpness,
      tempoAssist,
      tempoGap: rt.tempoGap,
      combo,
      score,
      lowDominance,
      beatPulse: this.beatPulseSmooth,
    }
  }

  getBeatPulse(): number {
    return this.beatPulseSmooth
  }

  getBpm(): number {
    if (this.rtBeat.tempoGap > 0 && this.rtBeat.tempoConfidence > 0.3) {
      return 60 / this.rtBeat.tempoGap
    }
    return 0
  }
}
