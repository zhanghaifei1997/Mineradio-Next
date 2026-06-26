import { makeBiquad, runBiquad, percentile } from './EnergyAnalyzer'
import { buildBeatMapFromLowEnergy } from './BeatDetector'
import type { BeatMap, DecodedEnergyResult, DecodeInfo, BiquadFilterState } from './types'

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FULL_STREAM_QUALITY_LIMIT_SEC = 7200

export interface DecodeOptions {
  userAgent?: string
  durationSec?: number
  limitSec?: number
  range?: string
}

export interface AnalyzeOptions extends DecodeOptions {
  introSec?: number
  skipMusicTempo?: boolean
  preferQualityFullStream?: boolean
}

let mpg123DecoderModule: any = null

async function loadMpg123Decoder() {
  if (mpg123DecoderModule) return mpg123DecoderModule
  const mod = await import('mpg123-decoder')
  mpg123DecoderModule = mod
  return mod
}

export async function decodePodcastDjEnergyRange(
  audioUrl: string,
  opts: DecodeOptions = {}
): Promise<DecodedEnergyResult> {
  const { MPEGDecoder } = await loadMpg123Decoder()
  const decoder = new MPEGDecoder({ enableGapless: false })
  await decoder.ready

  const durationHint = Math.max(0, Number(opts.durationSec) || 0)
  const hopSec = durationHint > 4200 ? 0.0125 : 0.010
  const lowEnergy: number[] = []
  const hitEnergy: number[] = []
  let hp: BiquadFilterState | null = null
  let lp: BiquadFilterState | null = null
  let effectiveSr = 0
  let sampleStep = 1
  let hopSize = 0
  let frameSum = 0
  let framePeak = 0
  let frameCount = 0
  let effectiveSamples = 0
  let chunks = 0
  let decodedSamples = 0
  const limitSec = Math.max(0, Number(opts.limitSec) || 0)

  function initFilters(sampleRate: number): void {
    if (effectiveSr) return
    sampleStep = sampleRate >= 44100 ? 4 : sampleRate >= 32000 ? 3 : 2
    effectiveSr = sampleRate / sampleStep
    hopSize = Math.max(80, Math.floor(effectiveSr * hopSec))
    hp = makeBiquad('highpass', 32, 0.72, effectiveSr)
    lp = makeBiquad('lowpass', 178, 0.82, effectiveSr)
  }

  function pushFrame(): void {
    const count = Math.max(1, frameCount)
    lowEnergy.push(Math.sqrt(frameSum / count))
    hitEnergy.push(framePeak)
    frameSum = 0
    framePeak = 0
    frameCount = 0
  }

  function processDecoded(result: any): void {
    if (!result || !result.samplesDecoded || !result.channelData || !result.channelData.length) return
    const sr = result.sampleRate || 44100
    initFilters(sr)
    const left = result.channelData[0]
    const right = result.channelData[1]
    const n = Math.min(result.samplesDecoded, left ? left.length : 0, right ? right.length : left ? left.length : 0)
    decodedSamples += n
    for (let i = 0; i < n; i += sampleStep) {
      const x = right ? ((left[i] || 0) + (right[i] || 0)) * 0.5 : (left[i] || 0)
      const y = runBiquad(lp!, runBiquad(hp!, x))
      const ay = Math.abs(y)
      frameSum += y * y
      if (ay > framePeak) framePeak = ay
      frameCount++
      effectiveSamples++
      if (frameCount >= hopSize) pushFrame()
    }
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent': opts.userAgent || DEFAULT_UA,
      'Referer': 'https://music.163.com/',
    }
    if (opts.range) headers.Range = opts.range
    const resp = await fetch(audioUrl, { headers })
    if (!resp.ok && resp.status !== 206) throw new Error('Audio fetch failed: ' + resp.status)
    if (!resp.body) throw new Error('Audio response has no body')
    const reader = resp.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || !value.length) continue
      chunks++
      processDecoded(decoder.decode(value instanceof Uint8Array ? value : new Uint8Array(value)))
      if (limitSec && effectiveSr && effectiveSamples / effectiveSr >= limitSec) {
        try { await reader.cancel() } catch (e) { /* ignore */ }
        break
      }
      if (chunks % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }
    processDecoded(decoder.decode(new Uint8Array(0)))
    if (frameCount > 0) pushFrame()
  } finally {
    decoder.free()
  }

  return {
    lowEnergy: new Float32Array(lowEnergy),
    hitEnergy: new Float32Array(hitEnergy),
    hopSec,
    duration: effectiveSr ? effectiveSamples / effectiveSr : 0,
    decode: {
      chunks,
      decodedSamples,
      sampleRate: effectiveSr ? effectiveSr * sampleStep : 0,
      effectiveSampleRate: effectiveSr,
      frames: lowEnergy.length,
    },
  }
}

export async function analyzePodcastDjIntro(
  audioUrl: string,
  opts: AnalyzeOptions = {}
): Promise<BeatMap> {
  if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) throw new Error('Invalid audio url')
  const requestedDuration = Math.max(0, Number(opts.durationSec) || 0)
  const introSec = Math.max(90, Math.min(240, Number(opts.introSec) || 180))
  const decoded = await decodePodcastDjEnergyRange(audioUrl, {
    durationSec: introSec,
    userAgent: opts.userAgent,
    limitSec: introSec + 8,
  })
  const frameLimit = Math.max(1, Math.min(decoded.lowEnergy.length, Math.ceil((introSec + 2) / Math.max(0.001, decoded.hopSec || 0.010))))
  const lowEnergy = decoded.lowEnergy.slice(0, frameLimit)
  const hitEnergy = decoded.hitEnergy.slice(0, frameLimit)
  const mapDuration = Math.min(introSec, lowEnergy.length * decoded.hopSec)
  const map = buildBeatMapFromLowEnergy(lowEnergy, hitEnergy, decoded.hopSec, mapDuration)
  map.partial = true
  map.partialUntilSec = mapDuration
  map.fullDuration = requestedDuration || 0
  map.tempoSource = 'podcast-dj-server-intro-offline'
  map.decode = Object.assign({}, decoded.decode || {}, {
    intro: true,
    requestedDurationSec: requestedDuration,
    effectiveDurationSec: decoded.duration,
    partialUntilSec: mapDuration,
  })
  map.debug = Object.assign({}, map.debug || {
    candidates: 0,
    hopSec: decoded.hopSec,
    lowRef: 0,
    step: 0,
  }, {
    intro: true,
    partialUntilSec: mapDuration,
  })
  return map
}

export async function analyzePodcastDjRangeSamples(
  audioUrl: string,
  opts: AnalyzeOptions = {}
): Promise<BeatMap> {
  const duration = Math.max(0, Number(opts.durationSec) || 0)
  if (!duration) throw new Error('Long podcast analysis needs duration')

  let contentLength = 0
  try {
    const head = await fetch(audioUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': opts.userAgent || DEFAULT_UA,
        'Referer': 'https://music.163.com/',
      },
    })
    contentLength = Number(head.headers.get('content-length') || 0) || 0
  } catch (err) {
    contentLength = 0
  }
  if (!contentLength) {
    return analyzePodcastDjStreamFull(audioUrl, opts)
  }

  const sampleCount = duration > 14400 ? 12 : duration > 9000 ? 10 : 8
  const sampleStarts: number[] = []
  for (let i = 0; i < sampleCount; i++) {
    const pos = i / Math.max(1, sampleCount - 1)
    const shaped = i === 0 ? 0 : i === sampleCount - 1 ? 0.88 : 0.08 + pos * 0.80
    sampleStarts.push(duration * shaped)
  }
  const sampleWindow = duration > 14400 ? 82 : duration > 9000 ? 88 : 96
  const sampleMaps: { offset: number; map: BeatMap }[] = []
  let totalChunks = 0
  let totalDecoded = 0

  for (let i = 0; i < sampleStarts.length; i++) {
    const targetTime = Math.max(0, Math.min(duration - sampleWindow, sampleStarts[i]))
    const bytePerSec = contentLength / Math.max(1, duration)
    const prerollBytes = i === 0 ? 0 : Math.min(384 * 1024, Math.floor(bytePerSec * 4))
    const startByte = Math.max(0, Math.floor(targetTime * bytePerSec) - prerollBytes)
    const windowBytes = Math.max(768 * 1024, Math.floor(sampleWindow * bytePerSec) + prerollBytes + 128 * 1024)
    const endByte = Math.min(contentLength - 1, startByte + windowBytes)
    const approxOffset = (startByte / contentLength) * duration
    const decoded = await decodePodcastDjEnergyRange(audioUrl, {
      durationSec: sampleWindow,
      userAgent: opts.userAgent,
      range: 'bytes=' + startByte + '-' + endByte,
    })
    totalChunks += decoded.decode.chunks || 0
    totalDecoded += decoded.decode.decodedSamples || 0
    const map = buildBeatMapFromLowEnergy(decoded.lowEnergy, decoded.hitEnergy, decoded.hopSec, decoded.duration || sampleWindow)
    if (map && map.visualBeatCount >= 8 && map.gridStep) {
      sampleMaps.push({ offset: approxOffset, map })
    }
  }

  if (!sampleMaps.length) {
    return {
      kicks: [],
      beats: [],
      pulseBeats: [],
      cameraBeats: [],
      duration,
      visualBeatCount: 0,
      tempoSource: 'podcast-dj-server-range-empty',
      analyzedAt: Date.now(),
    }
  }

  function phaseFromMap(map: BeatMap, baseStep: number): { phase: number; step: number } {
    const step = Math.max(0.32, Math.min(0.86, baseStep || map.gridStep || 0.50))
    const beats = (map.cameraBeats && map.cameraBeats.length ? map.cameraBeats : map.beats || [])
      .filter(b => b && Number.isFinite(b.time) && b.time > 0.35)
    if (!beats.length) return { phase: ((beats[0]?.time % step) + step) % step || 0, step }
    let sx = 0
    let sy = 0
    let total = 0
    for (let i = 0; i < beats.length; i++) {
      const b = beats[i]
      const impact = b.impact == null ? b.strength || 0.3 : b.impact
      const w = 0.20 + Math.pow(Math.max(0, impact), 1.45)
      const phase = ((b.time % step) + step) % step
      const angle = (phase / step) * Math.PI * 2
      sx += Math.cos(angle) * w
      sy += Math.sin(angle) * w
      total += w
    }
    if (total <= 0) return { phase: ((beats[0].time % step) + step) % step, step }
    let angle = Math.atan2(sy / total, sx / total)
    if (angle < 0) angle += Math.PI * 2
    return { phase: (angle / (Math.PI * 2)) * step, step }
  }

  const stepVotes: number[] = []
  sampleMaps.forEach(s => {
    const w = Math.max(1, Math.min(16, Math.round((s.map.visualBeatCount || 0) / 16)))
    for (let i = 0; i < w; i++) stepVotes.push(s.map.gridStep || 0.5)
  })
  const med = (arr: number[]) => {
    const sorted = arr.slice().sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length * 0.5)] || 0.5
  }
  let globalStep = Math.max(0.32, Math.min(0.86, med(stepVotes) || sampleMaps[0].map.gridStep || 0.50))
  const firstMap = sampleMaps[0].map
  const firstBeat = (firstMap.cameraBeats || firstMap.beats || [])[0]
  let anchor = firstBeat && firstBeat.time ? firstBeat.time : 0
  while (anchor - globalStep > 0.05) anchor -= globalStep

  const profiles = sampleMaps.map(s => {
    const beats = s.map.cameraBeats || s.map.beats || []
    const impacts = beats.map(b => b.impact == null ? b.strength : b.impact).filter(v => Number.isFinite(v))
    const activeImpacts = impacts.filter(v => v >= 0.10)
    const avgImpact = activeImpacts.length ? activeImpacts.reduce((a, b) => a + b, 0) / activeImpacts.length : 0.16
    const hiImpact = impacts.length ? percentile(impacts, 0.90, 4000) : Math.max(0.55, avgImpact)
    const activity = beats.length / Math.max(20, s.map.duration || 20)
    const phaseInfo = phaseFromMap(s.map, globalStep)
    return {
      time: s.offset,
      avg: Math.max(0.08, Math.min(0.72, avgImpact * Math.max(0.38, Math.min(1.05, activity / 1.65)))),
      hi: Math.max(0.18, Math.min(0.96, hiImpact)),
      activity: Math.max(0.18, Math.min(1.12, activity / 1.65)),
      step: globalStep,
      anchor: s.offset + (phaseInfo.phase || 0),
    }
  }).sort((a, b) => a.time - b.time)

  function profileAt(time: number): typeof profiles[0] {
    if (profiles.length === 1) return profiles[0]
    let prev = profiles[0]
    let next = profiles[profiles.length - 1]
    for (let i = 0; i < profiles.length; i++) {
      if (profiles[i].time <= time) prev = profiles[i]
      if (profiles[i].time >= time) { next = profiles[i]; break }
    }
    if (prev === next) return prev
    const mix = Math.max(0, Math.min(1, (time - prev.time) / Math.max(1, next.time - prev.time)))
    return {
      time,
      avg: prev.avg + (next.avg - prev.avg) * mix,
      hi: prev.hi + (next.hi - prev.hi) * mix,
      activity: prev.activity + (next.activity - prev.activity) * mix,
      step: prev.step + (next.step - prev.step) * mix,
      anchor: prev.anchor + ((next.anchor || 0) - (prev.anchor || 0)) * mix,
    }
  }

  const beats: BeatMap['beats'] = []
  let gridIndex = 0
  function pushRangeBeat(t: number, stepOverride?: number): void {
    const p = profileAt(t)
    const slot = gridIndex % 4
    let combo: BeatMap['beats'][0]['combo'] = slot === 0 ? 'downbeat' : slot === 1 ? 'push' : slot === 2 ? 'drop' : 'rebound'
    const sectionEnergy = Math.max(0, Math.min(1, (p.avg - 0.055) / 0.54)) * Math.max(0.30, Math.min(1.10, p.activity || 0.5))
    const motion = (Math.sin(gridIndex * 1.618 + p.avg * 9.7) * 0.5 + Math.sin(gridIndex * 0.317) * 0.28) * (0.08 + sectionEnergy * 0.17)
    const rel = Math.max(0, Math.min(1, 0.12 + sectionEnergy * 0.70 + motion + (combo === 'downbeat' ? 0.060 : 0)))
    if (rel > 0.82 && combo !== 'downbeat') combo = 'accent'
    const visualRel = rel > 0.78 ? 0.78 + (rel - 0.78) * 0.50 : rel
    const comboLift = combo === 'downbeat' ? 0.10 * sectionEnergy : combo === 'drop' ? 0.050 * sectionEnergy : combo === 'accent' ? 0.075 * sectionEnergy : 0
    const impact = Math.max(0.020, Math.min(0.90, 0.026 + Math.pow(visualRel, 1.48) * (0.42 + p.hi * 0.34) + comboLift))
    const strength = Math.max(0.12, Math.min(0.93, 0.15 + Math.pow(visualRel, 1.02) * 0.66 + comboLift * 0.68))
    const cameraActive = impact >= 0.105 || (combo === 'downbeat' && sectionEnergy >= 0.16)
    const low = Math.max(0.42, Math.min(0.90, 0.50 + visualRel * 0.32 + (combo === 'downbeat' ? 0.050 * sectionEnergy : 0) - (combo === 'accent' ? 0.12 : 0)))
    const body = Math.max(0.045, Math.min(0.56, 0.06 + visualRel * 0.15 + (combo === 'push' ? 0.22 * sectionEnergy : 0) + (combo === 'drop' ? 0.30 * sectionEnergy : 0)))
    const snap = Math.max(0.02, Math.min(0.62, 0.025 + visualRel * 0.035 + (combo === 'accent' ? 0.40 * sectionEnergy : 0) + (combo === 'rebound' ? 0.12 * sectionEnergy : 0)))
    beats.push({
      time: t,
      strength,
      confidence: 0.68 + visualRel * 0.22,
      impact,
      primary: cameraActive,
      camera: cameraActive,
      pulse: impact > 0.16 || (combo === 'downbeat' && sectionEnergy >= 0.24),
      tone: 'podcast-dj-server-range-grid',
      low,
      body,
      snap,
      mass: Math.max(0.36, Math.min(0.94, low * 0.72 + Math.pow(visualRel, 1.22) * 0.24)),
      sharpness: combo === 'accent' ? 0.20 : 0.08,
      combo,
      step: stepOverride || p.step || globalStep,
      index: beats.length,
      dj: true,
      grid: true,
      kickOnly: true,
      server: true,
      sampled: true,
    })
    gridIndex++
  }
  for (let si = 0; si < profiles.length; si++) {
    const p = profiles[si]
    const start = si === 0 ? 0 : (profiles[si - 1].time + p.time) * 0.5
    const end = si === profiles.length - 1 ? duration : (p.time + profiles[si + 1].time) * 0.5
    const localStep = globalStep
    let t = Number.isFinite(p.anchor!) ? p.anchor! : anchor
    while (t - localStep > start) t -= localStep
    while (t < start) t += localStep
    for (; t < end - 0.04; t += localStep) pushRangeBeat(t, localStep)
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
    sectionSteps: profiles.map(p => p.step),
    tempoSource: 'podcast-dj-server-range-offline',
    duration,
    visualBeatCount: cameraBeats.length,
    analyzedAt: Date.now(),
    debug: {
      rangeSampled: true,
      samples: sampleMaps.length,
      profiles,
      contentLength,
      decode: { chunks: totalChunks, decodedSamples: totalDecoded },
      candidates: 0,
      hopSec: 0,
      lowRef: 0,
      step: globalStep,
    },
  }
}

export async function analyzePodcastDjStreamFull(
  audioUrl: string,
  opts: AnalyzeOptions = {}
): Promise<BeatMap> {
  const { MPEGDecoder } = await loadMpg123Decoder()
  const decoder = new MPEGDecoder({ enableGapless: false })
  await decoder.ready

  const durationHint = Math.max(0, Number(opts.durationSec) || 0)
  const hopSec = durationHint > 9000 ? 0.0125 : 0.010
  const lowEnergy: number[] = []
  const hitEnergy: number[] = []
  let hp: BiquadFilterState | null = null
  let lp: BiquadFilterState | null = null
  let effectiveSr = 0
  let sampleStep = 1
  let hopSize = 0
  let frameSum = 0
  let framePeak = 0
  let frameCount = 0
  let effectiveSamples = 0
  let chunks = 0
  let decodedSamples = 0

  function initFilters(sampleRate: number): void {
    if (effectiveSr) return
    sampleStep = sampleRate >= 44100 ? 4 : sampleRate >= 32000 ? 3 : 2
    effectiveSr = sampleRate / sampleStep
    hopSize = Math.max(80, Math.floor(effectiveSr * hopSec))
    hp = makeBiquad('highpass', 32, 0.72, effectiveSr)
    lp = makeBiquad('lowpass', 178, 0.82, effectiveSr)
  }

  function pushFrame(): void {
    const count = Math.max(1, frameCount)
    lowEnergy.push(Math.sqrt(frameSum / count))
    hitEnergy.push(framePeak)
    frameSum = 0
    framePeak = 0
    frameCount = 0
  }

  function processDecoded(result: any): void {
    if (!result || !result.samplesDecoded || !result.channelData || !result.channelData.length) return
    const sr = result.sampleRate || 44100
    initFilters(sr)
    const left = result.channelData[0]
    const right = result.channelData[1]
    const n = Math.min(result.samplesDecoded, left ? left.length : 0, right ? right.length : left ? left.length : 0)
    decodedSamples += n
    for (let i = 0; i < n; i += sampleStep) {
      const x = right ? ((left[i] || 0) + (right[i] || 0)) * 0.5 : (left[i] || 0)
      const y = runBiquad(lp!, runBiquad(hp!, x))
      const ay = Math.abs(y)
      frameSum += y * y
      if (ay > framePeak) framePeak = ay
      frameCount++
      effectiveSamples++
      if (frameCount >= hopSize) pushFrame()
    }
  }

  try {
    const resp = await fetch(audioUrl, {
      headers: {
        'User-Agent': opts.userAgent || DEFAULT_UA,
        'Referer': 'https://music.163.com/',
      },
    })
    if (!resp.ok || !resp.body) throw new Error('Audio fetch failed: ' + resp.status)
    const reader = resp.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || !value.length) continue
      chunks++
      processDecoded(decoder.decode(value instanceof Uint8Array ? value : new Uint8Array(value)))
      if (chunks % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }
    const tail = decoder.decode(new Uint8Array(0))
    processDecoded(tail)
    if (frameCount > 0) pushFrame()
  } finally {
    decoder.free()
  }

  const effectiveDuration = effectiveSr ? effectiveSamples / effectiveSr : 0
  const duration = effectiveDuration || durationHint
  const map = buildBeatMapFromLowEnergy(new Float32Array(lowEnergy), new Float32Array(hitEnergy), hopSec, duration)
  map.decode = {
    chunks,
    decodedSamples,
    sampleRate: effectiveSr ? effectiveSr * sampleStep : 0,
    effectiveSampleRate: effectiveSr,
    frames: lowEnergy.length,
    requestedDurationSec: durationHint,
    effectiveDurationSec: effectiveDuration,
    fullStreamQuality: !!opts.preferQualityFullStream,
  }
  return map
}

export async function analyzePodcastDjStream(
  audioUrl: string,
  opts: AnalyzeOptions = {}
): Promise<BeatMap> {
  if (!audioUrl || !/^https?:\/\//i.test(audioUrl)) throw new Error('Invalid audio url')
  const durationSec = Math.max(0, Number(opts.durationSec) || 0)
  if (durationSec > 3300 && durationSec <= FULL_STREAM_QUALITY_LIMIT_SEC) {
    try {
      const map = await analyzePodcastDjStreamFull(audioUrl, Object.assign({}, opts, { preferQualityFullStream: true }))
      map.debug = Object.assign({}, map.debug || {
        candidates: 0,
        hopSec: 0,
        lowRef: 0,
        step: 0,
      }, { fullStreamQuality: true, requestedDurationSec: durationSec })
      return map
    } catch (err) {
      console.warn('[PodcastDjBeatmap] full-stream quality path failed, falling back to range:', err && (err as Error).message ? (err as Error).message : err)
      return analyzePodcastDjRangeSamples(audioUrl, opts)
    }
  }
  if (durationSec > FULL_STREAM_QUALITY_LIMIT_SEC) {
    return analyzePodcastDjRangeSamples(audioUrl, opts)
  }
  return analyzePodcastDjStreamFull(audioUrl, opts)
}
