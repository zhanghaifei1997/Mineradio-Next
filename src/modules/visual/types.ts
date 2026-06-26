import type * as THREE from 'three'
import type { VisualPreset, FxSettings } from '@/types'
import type { PerformanceManager } from '@/modules/performance'

export interface VisualEngineOptions {
  canvas: HTMLCanvasElement
  fxSettings: FxSettings
  performanceManager?: PerformanceManager
}

export interface PerformanceQualityProfile {
  cap: number
  min: number
  budget: number
}

export interface OrbitState {
  userTheta: number
  userPhi: number
  userRadius: number
  cineTheta: number
  cinePhi: number
  cineRadius: number
  theta: number
  phi: number
  radius: number
  minPhi: number
  maxPhi: number
  minRadius: number
  maxRadius: number
  baselineTheta: number
  baselinePhi: number
  baselineRadius: number
  rotating: boolean
  last: { x: number; y: number }
  recentering: boolean
  centerLocked: boolean
  lookAt: THREE.Vector3
  beatGlow: number
}

export interface FreeCameraState {
  active: boolean
  locked: boolean
  position: THREE.Vector3
  yaw: number
  pitch: number
  roll: number
  fov: number
  velocity: THREE.Vector3
  keys: Record<string, boolean>
}

export interface BeatCameraState {
  punch: number
  thetaKick: number
  phiKick: number
  radiusKick: number
  rollKick: number
  events: BeatCameraEvent[]
  nextIdx: number
  lastTriggerAt: number
  lastRealtimeAt: number
  prevAudioTime: number
  attack: number
  hold: number
  release: number
  lookahead: number
  minInterval: number
  realtimeMinInterval: number
  realtimeMergeWindow: number
  stats: {
    map: number
    live: number
    merged: number
    liveBlocked: number
  }
}

export interface BeatCameraEvent {
  start: number
  hit: number
  amp: number
  attack: number
  hold: number
  release: number
  zoomAmp: number
  thetaAmp: number
  phiAmp: number
  rollAmp: number
  mode: string
  combo: string
  phase: number
  low: number
  body: number
  snap: number
  mass: number
  source: string
  dj: boolean
}

export interface CinemaDynamics {
  avg: number
  lowAvg: number
  peak: number
  scale: number
}

export interface CinemaTrackProfile {
  scale: number
  target: number
  nameHint: number
  frames: number
  energyAvg: number
  lowAvg: number
  vocalAvg: number
  melodyAvg: number
  punchPeak: number
  density: number
}

export interface RealtimeBeatState {
  subFast: number
  subSlow: number
  lowFast: number
  lowSlow: number
  bodyFast: number
  bodySlow: number
  vocalFast: number
  vocalSlow: number
  snapFast: number
  snapSlow: number
  prevSub: number
  prevLow: number
  prevBody: number
  prevVocal: number
  prevSnap: number
  prevRms: number
  onsetAvg: number
  onsetPeak: number
  subPeak: number
  lowPeak: number
  bodyPeak: number
  vocalPeak: number
  snapPeak: number
  lastHitAt: number
  tempoGap: number
  tempoConfidence: number
  beatCount: number
  primedFrames: number
  warmupUntil: number
  pulse: number
  score: number
  stats: {
    hits: number
    blocked: number
    assisted: number
    strong: number
    rejected: number
  }
}

export interface RealtimeBeatResult {
  hit: boolean
  time?: number
  strength?: number
  confidence?: number
  low?: number
  mid?: number
  high?: number
  bass?: number
  treble?: number
  vocal?: number
  body?: number
  snap?: number
  mass?: number
  sharpness?: number
  tempoAssist?: boolean
  tempoGap?: number
  combo?: string
  score?: number
  lowDominance?: number
  dj?: boolean
  beatPulse?: number
}

export interface AudioAnalysisData {
  energy: number
  low: number
  mid: number
  high: number
  bass: number
  treble: number
  beatPulse: number
  isPlaying: boolean
  currentTime: number
  /** 涟漪活跃度（0..1），由 RippleSystem 提供 */
  rippleScatter?: number
  /** 涟漪爆发量（0..1），由 RippleSystem 提供 */
  rippleBurst?: number
  /** 活跃涟漪数量 */
  rippleCount?: number
  /** 指针视差 X（典型 -0.15..0.15），由 ParticleInteraction 提供 */
  pointerParallaxX?: number
  /** 指针视差 Y */
  pointerParallaxY?: number
  /** 指针 NDC X (-1..1) */
  pointerX?: number
  /** 指针 NDC Y (-1..1) */
  pointerY?: number
  /** hand active 强度（0..1） */
  handActive?: number
}

export interface ParticlePreset {
  name: VisualPreset
  create: (scene: THREE.Scene, options: ParticlePresetOptions) => ParticleSystem
}

export interface ParticlePresetOptions {
  quality: FxSettings['performanceQuality']
  resolution: number
  color: string
  glowColor: string
}

export interface ParticleSystem {
  group: THREE.Object3D
  update: (dt: number, audio: AudioAnalysisData) => void
  resize: () => void
  dispose: () => void
  setVisible: (visible: boolean) => void
}

export type { VisualPreset }
