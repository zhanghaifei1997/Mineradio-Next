import type { ShelfLayoutProfile, ShelfSettings, PointerParallax } from './types'
import { clamp } from '@/utils'

const SHELF_VISIBLE_RADIUS = 5

export function getLayoutProfile(
  viewportWidth: number,
  viewportHeight: number,
  settings: ShelfSettings
): ShelfLayoutProfile {
  const portrait = viewportHeight > viewportWidth * 1.08

  const baseSideX = portrait ? 2.52 : 3.18
  const baseSideXStep = portrait ? 0.086 : 0.125
  const baseSideY = portrait ? -0.10 : -0.05
  const baseSideYStep = portrait ? 0.48 : 0.54
  const baseSideZ = portrait ? 2.42 : 2.78
  const baseSideZStep = portrait ? 0.18 : 0.20
  const baseSideRotX = portrait ? 0.030 : 0.042
  const baseSideRotY = portrait ? -0.44 : -0.58
  const baseSideScale = portrait ? 0.82 : 0.96
  const baseSideEntryX = portrait ? 1.2 : 1.6
  const baseSideDetailShift = portrait ? 0.18 : 0.28

  const baseStageX = 0
  const baseStageXStep = portrait ? 1.05 : 1.25
  const baseStageY = portrait ? -1.8 : -2.0
  const baseStageZ = portrait ? 2.0 : 2.4
  const baseStageScale = portrait ? 0.85 : 1.0

  const sizeScale = settings.size

  return {
    portrait,
    sideX: baseSideX * sizeScale + settings.x,
    sideXStep: baseSideXStep * sizeScale,
    sideY: baseSideY + settings.y,
    sideYStep: baseSideYStep * sizeScale,
    sideZ: baseSideZ * sizeScale + settings.z,
    sideZStep: baseSideZStep * sizeScale,
    sideRotX: baseSideRotX,
    sideRotY: baseSideRotY + settings.angle,
    sideScale: baseSideScale,
    sideEntryX: baseSideEntryX,
    sideDetailShift: baseSideDetailShift,
    stageX: baseStageX + settings.x,
    stageXStep: baseStageXStep * sizeScale,
    stageY: baseStageY + settings.y,
    stageZ: baseStageZ * sizeScale + settings.z,
    stageScale: baseStageScale,
    detail: {
      x: 1.28,
      y: 0.18,
      z: 1.36,
      rx: -0.008,
      ry: 0.020,
      rowStep: 0.36,
      rowScale: 1.0,
    },
  }
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(244, 210, 138, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

export function readableInkForHex(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#000'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.6 ? '#0a0a0a' : '#fff'
}

export function makeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): void {
  const chars = String(text || '').split('')
  let line = ''
  const lines: string[] = []
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = chars[i]
      if (lines.length >= maxLines - 1) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  for (let j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], x, y + j * lineHeight)
  }
}

export function ellipsizeText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  const str = String(text || '')
  if (ctx.measureText(str).width <= maxWidth) return str
  let out = str
  while (out.length > 1 && ctx.measureText(out + '...').width > maxWidth) {
    out = out.slice(0, -1)
  }
  return out + '...'
}

export const SHELF_CONSTANTS = {
  VISIBLE_RADIUS: SHELF_VISIBLE_RADIUS,
  MAX_RENDER: SHELF_VISIBLE_RADIUS * 2 + 1,
  CARD_WIDTH: 2.05,
  CARD_HEIGHT: 1.025,
  CANVAS_WIDTH: 720,
  CANVAS_HEIGHT: 360,
}
