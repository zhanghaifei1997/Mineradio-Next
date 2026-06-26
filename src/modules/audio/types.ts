export type BeatCombo = 'downbeat' | 'push' | 'drop' | 'rebound' | 'accent'

export interface BeatEvent {
  time: number
  strength: number
  confidence: number
  impact: number
  primary: boolean
  camera: boolean
  pulse: boolean
  tone: string
  low: number
  body: number
  snap: number
  mass: number
  sharpness: number
  combo: BeatCombo
  step: number
  index: number
  dj?: boolean
  grid?: boolean
  kickOnly?: boolean
  server?: boolean
  sampled?: boolean
}

export interface PulseBeat {
  time: number
  strength: number
  impact: number
  combo: BeatCombo
  low: number
  body: number
  snap: number
  dj?: boolean
}

export interface BeatMap {
  kicks: number[]
  beats: BeatEvent[]
  pulseBeats: PulseBeat[]
  cameraBeats: BeatEvent[]
  gridStep?: number
  sectionSteps?: number[]
  tempoSource: string
  duration: number
  visualBeatCount: number
  analyzedAt: number
  partial?: boolean
  partialUntilSec?: number
  fullDuration?: number
  decode?: DecodeInfo
  debug?: BeatMapDebug
}

export interface DecodeInfo {
  chunks: number
  decodedSamples: number
  sampleRate: number
  effectiveSampleRate: number
  frames: number
  requestedDurationSec?: number
  effectiveDurationSec?: number
  fullStreamQuality?: boolean
  intro?: boolean
  partialUntilSec?: number
}

export interface BeatMapDebug {
  candidates: number
  hopSec: number
  lowRef: number
  step: number
  intro?: boolean
  partialUntilSec?: number
  rangeSampled?: boolean
  samples?: number
  profiles?: SectionProfile[]
  contentLength?: number
  decode?: { chunks: number; decodedSamples: number }
}

export interface SectionProfile {
  time: number
  avg: number
  hi: number
  activity: number
  step: number
  anchor?: number
}

export interface EnergyBands {
  sub: number
  low: number
  mid: number
  high: number
  presence: number
}

export interface RealtimeBeatState {
  bass: number
  mid: number
  treble: number
  bassAvg: number
  midAvg: number
  trebleAvg: number
  bassPeak: number
  midPeak: number
  treblePeak: number
  beatDetected: boolean
  beatStrength: number
  lastBeatTime: number
}

export interface CinemaDynamics {
  avg: number
  lowAvg: number
  peak: number
  scale: number
}

export interface DjModeState {
  active: boolean
  songKey: string
  startedAt: number
  tempoGap: number
  tempoConfidence: number
  sectionEnergy: number
  sectionLow: number
  sectionChange: number
  visualPulse: number
  lastBeatAt: number
  lastNoticeAt: number
}

export interface AudioAnalyzerOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  beatFftSize?: number
  beatSmoothingTimeConstant?: number
}

export interface BeatCandidate {
  frame: number
  time: number
  score: number
  lowTone: number
  hitTone: number
  lowRel: number
  raw: number
  power: number
}

export interface BiquadFilterState {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
  x1: number
  x2: number
  y1: number
  y2: number
}

export type BiquadType = 'lowpass' | 'highpass'

export interface DecodedEnergyResult {
  lowEnergy: Float32Array
  hitEnergy: Float32Array
  hopSec: number
  duration: number
  decode: DecodeInfo
}
