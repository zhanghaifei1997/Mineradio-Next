import type { LyricPalette, Particle, LiveMotion } from './types'
import { drawCanvasText } from './LyricLayout'

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

const colorCtx = (() => {
  if (typeof document !== 'undefined') {
    return document.createElement('canvas').getContext('2d')
  }
  return null
})()

export function parseCssColor(color: string, fallback: string = '#ffffff'): { r: number; g: number; b: number; a: number } {
  fallback = fallback || '#ffffff'
  try {
    if (colorCtx) {
      colorCtx.fillStyle = fallback
      const safe = colorCtx.fillStyle as string
      colorCtx.fillStyle = String(color || fallback)
      const css = (colorCtx.fillStyle as string) || safe
      const hex = css.match(/^#([0-9a-f]{6})$/i)
      if (hex) {
        const n = parseInt(hex[1], 16)
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
      }
      const rgb = css.match(/^rgba?\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,\s*([.\d]+)(?:\s*,\s*([.\d]+))?/i)
      if (rgb) {
        return {
          r: Math.round(Number(rgb[1])),
          g: Math.round(Number(rgb[2])),
          b: Math.round(Number(rgb[3])),
          a: rgb[4] == null ? 1 : clamp(Number(rgb[4]), 0, 1, 1),
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return { r: 255, g: 255, b: 255, a: 1 }
}

export function normalizeLyricColor(color: string, fallback: string): string {
  const c = parseCssColor(color, fallback)
  return `rgb(${c.r},${c.g},${c.b})`
}

export function colorWithAlpha(color: string, alpha: number): string {
  const c = parseCssColor(color, '#ffffff')
  return `rgba(${c.r},${c.g},${c.b},${clamp(alpha, 0, 1, 1)})`
}

export function liftedLyricColor(color: string, fallback: string, minLum?: number): string {
  const c = parseCssColor(color, fallback)
  const lum = (c.r * 0.299 + c.g * 0.587 + c.b * 0.114) / 255
  const floor = minLum == null ? 0.34 : minLum
  if (lum < floor) {
    const lift = Math.round((floor - lum) * 255)
    c.r = Math.min(255, c.r + lift)
    c.g = Math.min(255, c.g + lift)
    c.b = Math.min(255, c.b + lift)
  }
  return `rgb(${c.r},${c.g},${c.b})`
}

export function effectiveLyricPalette(pal: Partial<LyricPalette>): LyricPalette {
  const primary = normalizeLyricColor(pal.primary || '#f6fdff', '#f6fdff')
  const secondary = normalizeLyricColor(pal.secondary || '#a8f6ff', '#a8f6ff')
  const highlight = normalizeLyricColor(pal.highlight || '#fff0b8', '#fff0b8')
  const glow = normalizeLyricColor(pal.glow || pal.secondary || '#9cffdf', '#9cffdf')
  return { primary, secondary, highlight, glow }
}

export function lyricPaletteFromHex(hex: string): LyricPalette {
  const base = parseCssColor(hex, '#9db8cf')
  const r = base.r, g = base.g, b = base.b
  const primary = `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`
  const secondary = `rgb(${Math.min(255, r + 20)},${Math.min(255, g + 20)},${Math.min(255, b + 20)})`
  const highlight = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 55)},${Math.min(255, b + 30)})`
  const glow = `rgb(${Math.min(255, r + 30)},${Math.min(255, g + 50)},${Math.min(255, b + 45)})`
  return { primary, secondary, highlight, glow }
}

export function drawAura(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  colors: LyricPalette,
  live: LiveMotion,
  opacity: number
): void {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.52
  const rx = Math.max(rect.width * 0.58, 260) * (1 + live.solar * 0.1 + live.beat * 0.08)
  const ry = Math.max(rect.height * 1.02, 66) * (1 + live.solar * 0.1 + live.beat * 0.08)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = clamp(opacity, 0.28, 1, 0.92)
  ctx.translate(cx, cy)
  ctx.scale(rx, ry)

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0.0, colorWithAlpha(colors.highlight, 0.24))
  g.addColorStop(0.28, colorWithAlpha(colors.glow, 0.15))
  g.addColorStop(0.64, colorWithAlpha(colors.secondary, 0.04))
  g.addColorStop(0.9, colorWithAlpha(colors.glow, 0.006))
  g.addColorStop(1.0, 'rgba(0,0,0,0)')

  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawHighlightBloom(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  progress: number,
  colors: LyricPalette,
  live: LiveMotion,
  fontSize: number,
  opacity: number
): void {
  const p = clamp(progress, 0, 1, 0)
  const x = rect.left + rect.width * p
  const y = rect.top + rect.height * 0.5 - live.lift * 0.1
  const rx = Math.max(42, Math.min(150, fontSize * (1.05 + live.beat * 0.32)))
  const ry = Math.max(24, Math.min(82, fontSize * (0.42 + live.beat * 0.18)))
  const alpha = clamp(0.18 + live.solar * 0.12 + live.beat * 0.18, 0.12, 0.48) * clamp(opacity, 0.28, 1, 0.92)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.scale(rx, ry)

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1)
  g.addColorStop(0, colorWithAlpha(colors.highlight, 0.88))
  g.addColorStop(0.36, colorWithAlpha(colors.glow, 0.34))
  g.addColorStop(1, 'rgba(0,0,0,0)')

  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawGlowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: DOMRect,
  colors: LyricPalette,
  live: LiveMotion,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
  letterSpacing: number,
  fitScaleX: number,
  glowStrength: number,
  opacity: number
): number {
  if (glowStrength <= 0) return 0

  const target = Math.min(1.08, (0.09 + live.solar * 0.38 + live.beat * 0.22) * Math.min(3, glowStrength / 0.5))
  live.glow += (target - live.glow) * (target > live.glow ? 0.11 : 0.06)
  if (live.glow <= 0.004) return live.glow

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const spacing = fontSize * letterSpacing
  const hotMix = Math.max(0, Math.min(1, live.solar * 1.05 + live.beat * 0.18))
  const color = hotMix > 0.42 ? colors.highlight : colors.glow

  const layers = [
    { blur: 10, alpha: 0.54, stroke: Math.max(9, fontSize * 0.09) },
    { blur: 24, alpha: 0.38, stroke: Math.max(15, fontSize * 0.15) },
    { blur: 48, alpha: 0.2, stroke: Math.max(22, fontSize * 0.22) },
    { blur: 78, alpha: 0.09, stroke: Math.max(30, fontSize * 0.3) },
  ]

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.translate(cx, cy)
  ctx.scale(fitScaleX * live.scale, live.scale)

  for (let i = 0; i < layers.length; i++) {
    ctx.save()
    ctx.filter = `blur(${layers[i].blur}px)`
    ctx.globalAlpha = live.glow * layers[i].alpha * clamp(opacity, 0.28, 1, 0.92)
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineWidth = layers[i].stroke
    ctx.lineJoin = 'round'
    drawCanvasText(ctx, text, 0, 0, fontSize, spacing, true)
    drawCanvasText(ctx, text, 0, 0, fontSize, spacing, false)
    ctx.restore()
  }

  ctx.restore()
  return live.glow
}

function rand(seed: number): number {
  return Math.abs(Math.sin(seed * 9283.173) * 43758.5453) % 1
}

export function ensureParticles(particles: Particle[], count: number = 220): Particle[] {
  while (particles.length < count) {
    const i = particles.length + 1
    particles.push({
      seed: i * 17.17,
      lane: rand(i),
      phase: rand(i * 3.1),
      depth: rand(i * 7.7),
      size: 0.65 + rand(i * 2.3) * 1.55,
    })
  }
  return particles
}

export function drawParticles(
  ctx: CanvasRenderingContext2D,
  rect: DOMRect,
  particles: Particle[],
  colors: LyricPalette,
  live: LiveMotion,
  glowStrength: number,
  showParticles: boolean,
  now: number,
  opacity: number
): number {
  const target =
    showParticles && glowStrength > 0
      ? Math.min(0.5, (0.12 + live.solar * 0.18 + live.beat * 0.16) * Math.min(1.7, glowStrength / 0.5))
      : 0
  live.spark += (target - live.spark) * (target > live.spark ? 0.14 : 0.08)
  if (live.spark <= 0.006) return live.spark

  ensureParticles(particles)
  const width = Math.max(300, Math.min(rect.width * 1.16 + 140, rect.width + 140))
  const height = Math.max(74, rect.height * 1.34)
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2 + Math.sin(now * 0.55) * 3.5

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const lane = Math.floor(p.lane * 5)
    const local = (p.lane * 5) % 1
    const speed = 0.018 + rand(p.seed) * 0.03 + lane * 0.002
    const flow = (p.phase + now * speed) % 1
    const edge = Math.sin(Math.PI * flow)
    const x = cx + (flow - 0.5) * width * (1.02 + rand(p.seed * 4.1) * 0.18)
    const curve = Math.sin(flow * Math.PI * 2 * (0.9 + rand(p.seed * 1.3) * 0.5) + p.seed + now * 0.32)
    const y =
      cy +
      (lane - 2) * height * 0.13 +
      curve * height * (0.16 + rand(p.seed * 2.2) * 0.18) +
      (local - 0.5) * height * 0.13 +
      Math.sin(now * (0.42 + rand(p.seed * 0.32) + p.seed)) * (4 + live.beat * 6)
    const tw = Math.pow(0.5 + 0.5 * Math.sin(now * (0.7 + rand(p.seed * 0.4) + p.seed)), 4)
    const r = Math.max(0.7, p.size * (0.75 + edge * 1.45 + tw * 0.85 + live.beat * 0.55))

    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5)
    grad.addColorStop(0, colorWithAlpha(colors.highlight, 0.96))
    grad.addColorStop(0.34, colorWithAlpha(colors.glow, 0.68))
    grad.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.globalAlpha = live.spark * (0.16 + edge * 0.44 + tw * 0.24) * clamp(opacity, 0.28, 1, 0.92)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r * 4.5, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
  return live.spark
}

export function applyStageMotion(
  stageEl: HTMLElement,
  live: LiveMotion,
  now: number,
  cinema: boolean
): void {
  const motionBeat = cinema ? live.beat : 0
  const motionSolar = cinema ? live.solar : 0
  const motionBass = cinema ? live.bass : 0
  const targetLift = cinema ? Math.min(22, motionBeat * 18 + motionSolar * 5.2 + motionBass * 4.4) : 0

  live.lift += (targetLift - live.lift) * (targetLift > live.lift ? 0.46 : 0.16)

  const floatY = Math.sin(now * 1.08) * -9.8 + Math.sin(now * 2.1 + 0.7) * 3.1
  const floatX = Math.sin(now * 0.7 + 0.4) * 6.2 + Math.sin(now * 1.18 + 1.1) * 2.6
  const bobY = floatY - live.lift
  const bobX = floatX + Math.sin(now * 1.55) * motionBeat * 3.4
  const rotX = Math.sin(now * 0.86 + 0.2) * 3.25 - motionBeat * 0.92
  const rotY = Math.sin(now * 0.74 + 1.3) * -2.75 + motionBeat * 0.34
  const scale = 1 + motionBeat * 0.115 + motionSolar * 0.034 + motionBass * 0.026

  live.scale += (scale - live.scale) * (scale > live.scale ? 0.46 : 0.16)

  stageEl.style.transform = `translate3d(${bobX.toFixed(2)}px,${bobY.toFixed(2)}px,0) rotateX(${rotX.toFixed(3)}deg) rotateY(${rotY.toFixed(3)}deg) scale(${live.scale.toFixed(4)})`
  stageEl.style.filter = `brightness(${(1.04 + motionBeat * 0.12 + motionSolar * 0.05).toFixed(3)}) saturate(${(1.08 + motionBeat * 0.1).toFixed(3)})`
}

export function updateMotion(
  live: LiveMotion,
  now: number,
  glowStrength: number,
  glowBeat: boolean,
  beatGlow: number,
  beatPulse: number,
  bass: number,
  highBloom: number,
  cinema: boolean,
  playing: boolean,
  offlineBeat: number = 0,
  offlineGlow: number = 0,
  offlineBass: number = 0,
  offlineActive: boolean = false
): { glowStrength: number; glowDrive: number } {
  const actualGlowStrength = glowStrength
  const glowDrive = Math.min(1.7, Math.max(0, actualGlowStrength / 0.5))
  const cinemaBinding = cinema
  const beatSource = cinemaBinding && glowBeat ? Math.max(beatGlow, beatPulse * 0.86) : 0
  const cameraBeat = Math.max(beatSource, offlineBeat)
  const localBeat =
    playing && cinemaBinding
      ? Math.pow(Math.max(0, Math.sin(now * 2.35)), 8) * (offlineActive ? 0.1 : 0.44)
      : 0
  const bassDrive = Math.max(bass, offlineBass)
  const fallbackSolar =
    actualGlowStrength > 0
      ? (0.18 + (0.5 + 0.5 * Math.sin(now * 1.05)) * 0.16 + Math.max(bassDrive * 0.32, cameraBeat * 0.12) + cameraBeat * 1.18 + offlineGlow * 0.22) * glowDrive
      : 0
  const solarTarget =
    actualGlowStrength > 0
      ? Math.min(1.45, Math.max(highBloom, offlineGlow, fallbackSolar * 0.56 + localBeat * 0.18))
      : localBeat * 0.12
  const beatTarget = cinemaBinding ? Math.min(1.35, Math.max(glowBeat ? cameraBeat : offlineBeat * 0.72, localBeat)) : 0

  live.solar += (solarTarget - live.solar) * (solarTarget > live.solar ? 0.36 : 0.1)
  live.beat += (beatTarget - live.beat) * (beatTarget > live.beat ? 0.62 : 0.18)
  live.bass += (bassDrive - live.bass) * 0.22

  return { glowStrength: actualGlowStrength, glowDrive }
}

export function initLiveMotion(): LiveMotion {
  return {
    solar: 0,
    beat: 0,
    bass: 0,
    scale: 1,
    glow: 0,
    spark: 0,
    lift: 0,
  }
}
