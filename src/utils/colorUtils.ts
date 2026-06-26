export interface HSL {
  h: number
  s: number
  l: number
}

export interface RGB {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RGB | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      })
      .join('')
  )
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  }
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h /= 360
  s /= 100
  l /= 100

  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

export function hexToHsl(hex: string): HSL | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l)
  return rgbToHex(rgb.r, rgb.g, rgb.b)
}

export function isValidHex(hex: string): boolean {
  return /^#?([a-f\d]{6}|[a-f\d]{3})$/i.test(hex)
}

export function normalizeHex(hex: string): string {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return '#' + h.toLowerCase()
}

export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function adjustBrightness(hex: string, factor: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  return rgbToHex(
    Math.max(0, Math.min(255, rgb.r * factor)),
    Math.max(0, Math.min(255, rgb.g * factor)),
    Math.max(0, Math.min(255, rgb.b * factor)),
  )
}

export function extractPaletteFromImage(img: HTMLImageElement, count = 8): string[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const size = 100
  canvas.width = size
  canvas.height = size
  ctx.drawImage(img, 0, 0, size, size)

  const imageData = ctx.getImageData(0, 0, size, size)
  const pixels = imageData.data

  const colorMap = new Map<string, number>()

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    const a = pixels[i + 3]

    if (a < 128) continue

    const bucketR = Math.floor(r / 32) * 32
    const bucketG = Math.floor(g / 32) * 32
    const bucketB = Math.floor(b / 32) * 32
    const key = `${bucketR},${bucketG},${bucketB}`

    colorMap.set(key, (colorMap.get(key) || 0) + 1)
  }

  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count * 3)

  const palette: string[] = []
  const minDistance = 60

  for (const [key] of sortedColors) {
    const [r, g, b] = key.split(',').map(Number)
    const hex = rgbToHex(r + 16, g + 16, b + 16)

    let tooClose = false
    for (const existing of palette) {
      const existingRgb = hexToRgb(existing)
      if (existingRgb) {
        const dist = Math.sqrt(
          Math.pow(r - existingRgb.r, 2) + Math.pow(g - existingRgb.g, 2) + Math.pow(b - existingRgb.b, 2),
        )
        if (dist < minDistance) {
          tooClose = true
          break
        }
      }
    }

    if (!tooClose) {
      palette.push(hex)
      if (palette.length >= count) break
    }
  }

  return palette
}
