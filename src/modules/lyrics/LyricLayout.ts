import type { ScrollState, LyricStyleConfig } from './types'

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

export function lyricScrollEase(t: number): number {
  t = clamp(t, 0, 1, 0)
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function lyricScrollInitialHoldMs(progressSpan: number): number {
  return Math.round(clamp(progressSpan * 130, 140, 520, 320))
}

export interface LayoutResult {
  fontSize: number
  fitScaleX: number
  edgeWidth: number
  maskEdgeWidth: number
  viewportWidth: number
  verticalFeather: number
  scrollNeeded: boolean
  scrollLimit: number
  scrollOverflow: number
}

export function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
  letterSpacing: number
): number {
  ctx.save()
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const width = ctx.measureText(text || ' ').width
  ctx.restore()
  const charCount = Array.from(text).length
  return Math.max(1, width + Math.max(0, charCount - 1) * fontSize * letterSpacing)
}

export function fitLyricText(
  text: string,
  baseFontSize: number,
  style: Partial<LyricStyleConfig>,
  viewportWidth: number,
  viewportHeight: number,
  ctx?: CanvasRenderingContext2D
): LayoutResult {
  const safeWidth = Math.max(300, viewportWidth - 8)
  const edgeWidth = Math.round(clamp(safeWidth * 0.085, 54, 116, 92))
  const vpWidth = Math.round(
    Math.max(280, Math.min(safeWidth - 12, viewportWidth - Math.min(240, Math.max(88, viewportWidth * 0.13))))
  )
  const clearWidth = Math.max(160, vpWidth - edgeWidth * 2)
  const readableWidth = clearWidth
  const maxHeight = Math.max(64, viewportHeight - 188)

  const fontFamily = style.fontFamily || 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif'
  const fontWeight = style.fontWeight || 900
  const letterSpacing = style.letterSpacing ?? 0
  const lineHeight = style.lineHeight ?? 1

  let size = baseFontSize
  let fitScaleX = 1
  const minSize = Math.max(24, Math.min(32, baseFontSize * 0.55))
  const maxScrollableWidth = readableWidth * 1.76

  const measureWidth = (fontSize: number): number => {
    if (ctx) {
      return measureTextWidth(ctx, text, fontSize, fontWeight, fontFamily, letterSpacing)
    }
    const charCount = Array.from(text).length
    return charCount * fontSize * 0.6 + Math.max(0, charCount - 1) * fontSize * letterSpacing
  }

  for (let i = 0; i < 24; i++) {
    const width = measureWidth(size)
    const height = size * lineHeight
    if ((width <= maxScrollableWidth && height <= maxHeight) || size <= minSize) break
    size = Math.max(minSize, size - Math.max(1.25, size * 0.062))
  }

  const measuredWidth = measureWidth(size)
  const maxRenderedWidth = readableWidth * 1.82
  if (measuredWidth > maxRenderedWidth) {
    fitScaleX = clamp(maxRenderedWidth / measuredWidth, 0.72, 1, 1)
  }

  const scaledWidth = measuredWidth * fitScaleX
  const travelWidth = Math.max(0, scaledWidth - clearWidth)
  const clearTailMargin = Math.max(58, Math.min(edgeWidth * 1.18, size * 1.08))
  const centeredTailLimit =
    scaledWidth > clearWidth * 1.28 ? Math.max(0, scaledWidth / 2 - clearWidth * 0.18) : 0
  const scrollLimit = travelWidth > 0 ? Math.max(travelWidth / 2 + clearTailMargin, centeredTailLimit) : 0
  const scrollOverflow = scrollLimit * 2
  const scrollNeeded = travelWidth > Math.max(16, size * 0.18)

  const maskEdgeWidth = scrollNeeded ? Math.round(clamp(edgeWidth * 0.44, 26, 58, 42)) : edgeWidth

  return {
    fontSize: Math.round(size),
    fitScaleX,
    edgeWidth,
    maskEdgeWidth,
    viewportWidth: vpWidth,
    verticalFeather: Math.round(clamp(size * 0.92, 38, 72, 46)),
    scrollNeeded,
    scrollLimit,
    scrollOverflow,
  }
}

export function updateLyricScroll(
  scrollState: ScrollState,
  progress: number,
  progressSpan: number,
  viewportWidth: number,
  nowMs: number
): number {
  if (!scrollState.needed) return 0

  const limit = Math.max(0, scrollState.limit || scrollState.overflow / 2)
  if (limit <= 0) return 0

  const p = clamp(progress, 0, 1, 0)
  const spanMs = Math.max(450, progressSpan * 1000)
  const startGate = clamp(lyricScrollInitialHoldMs(progressSpan) / spanMs, 0.035, 0.18, 0.08)
  const longLineBias = clamp(limit / Math.max(260, viewportWidth), 0, 0.3, 0.12)
  const shortLineBias = clamp((4.8 - progressSpan) / 8, 0, 0.16, 0)
  const endGate = clamp(0.84 - longLineBias * 0.38 - shortLineBias * 0.5, 0.62, 0.88, 0.78)
  const finalEndGate = endGate <= startGate + 0.12 ? startGate + 0.12 : endGate

  const travel = lyricScrollEase((p - startGate) / (finalEndGate - startGate))
  let targetOffset = -limit * travel
  if (p >= finalEndGate) targetOffset = -limit
  if (nowMs < scrollState.holdUntil && p < startGate) targetOffset = 0

  return Math.max(-limit, Math.min(0, targetOffset))
}

export function initScrollState(): ScrollState {
  return {
    needed: false,
    overflow: 0,
    limit: 0,
    offset: 0,
    dir: -1,
    holdUntil: 0,
    lastAt: 0,
  }
}

export function drawCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  spacing: number,
  stroke: boolean = false
): void {
  const chars = Array.from(text || '')
  if (!spacing || chars.length < 2) {
    if (stroke) ctx.strokeText(text, x, y)
    else ctx.fillText(text, x, y)
    return
  }
  let width = 0
  for (let i = 0; i < chars.length; i++) {
    width += ctx.measureText(chars[i]).width
    if (i < chars.length - 1) width += spacing
  }
  let cursor = x - width / 2
  ctx.textAlign = 'left'
  for (let c = 0; c < chars.length; c++) {
    if (stroke) ctx.strokeText(chars[c], cursor, y)
    else ctx.fillText(chars[c], cursor, y)
    cursor += ctx.measureText(chars[c]).width + (c < chars.length - 1 ? spacing : 0)
  }
  ctx.textAlign = 'center'
}
