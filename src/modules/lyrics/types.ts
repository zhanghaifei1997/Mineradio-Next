export interface LyricWord {
  text: string
  t: number
  d: number
  c0: number
  c1: number
}

export interface LyricLine {
  t: number
  duration: number
  text: string
  translation?: string
  words?: LyricWord[]
  charCount: number
  source: string
  fallback?: boolean
}

export interface LyricData {
  lines: LyricLine[]
  hasNativeKaraoke: boolean
  timingSource: string
  hasTranslation: boolean
}

export interface LyricPalette {
  primary: string
  secondary: string
  highlight: string
  glow: string
}

export interface LyricStyleConfig {
  fontFamily: string
  fontWeight: number
  fontSize: number
  letterSpacing: number
  lineHeight: number
  opacity: number
  feather: number
}

export interface LyricGlowConfig {
  enabled: boolean
  beatSync: boolean
  strength: number
  particles: boolean
  highBloom: number
  beatGlow: number
}

export interface LyricLayoutConfig {
  size: number
  verticalPosition: number
  clickThrough: boolean
  cinema: boolean
  highlightFollow: boolean
  frameRate: number
}

export interface DesktopLyricState {
  enabled: boolean
  text: string
  progress: number
  progressSpan: number
  playing: boolean
  playbackTime: number
  playbackDuration: number
  playbackRate: number
  size: number
  opacity: number
  clickThrough: boolean
  cinema: boolean
  highlightFollow: boolean
  frameRate: number
  colors: LyricPalette
  displayColors: LyricPalette
  fontFamily: string
  fontWeight: number
  letterSpacing: number
  lineHeight: number
  lyricGlow: boolean
  lyricGlowBeat: boolean
  lyricGlowStrength: number
  lyricGlowParticles: boolean
  highBloom: number
  beatGlow: number
  beatPulse: number
  bass: number
  feather: number
}

export interface BeatEvent {
  time: number
  strength: number
  confidence: number
  impact: number
  low: number
  body: number
  snap: number
  primary: boolean
  camera: boolean
  pulse: boolean
  mass: number
  sharpness: number
  combo?: string
}

export interface BeatMap {
  cameraBeats: BeatEvent[]
  pulseBeats: BeatEvent[]
  duration: number
  partialUntilSec: number
  visualBeatCount: number
  tempoSource: string
}

export interface ScrollState {
  needed: boolean
  overflow: number
  limit: number
  offset: number
  dir: number
  holdUntil: number
  lastAt: number
}

export interface Particle {
  seed: number
  lane: number
  phase: number
  depth: number
  size: number
}

export interface LiveMotion {
  solar: number
  beat: number
  bass: number
  scale: number
  glow: number
  spark: number
  lift: number
}

export type LyricSource = 'lrc' | 'yrc-word' | 'yrc-line' | 'custom-lrc' | 'custom-text' | 'fallback'
