import { ref, computed, watch } from 'vue'
import { useFxStore } from '@/stores/fx'
import { usePlayerStore } from '@/stores/player'

export interface ExtractedColors {
  primary: string
  secondary: string
  background: string
  accent: string
  glow: string
}

const STORAGE_KEY = 'mineradio_cover_color_settings'

interface CoverColorSettings {
  enabled: boolean
  applyToBackground: boolean
  applyToHighlight: boolean
  applyToGlow: boolean
}

function loadSettings(): CoverColorSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.warn('Failed to load cover color settings:', e)
  }
  return {
    enabled: false,
    applyToBackground: true,
    applyToHighlight: true,
    applyToGlow: true,
  }
}

function saveSettings(settings: CoverColorSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('Failed to save cover color settings:', e)
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null
}

function adjustBrightness(r: number, g: number, b: number, factor: number): { r: number; g: number; b: number } {
  return {
    r: Math.max(0, Math.min(255, r * factor)),
    g: Math.max(0, Math.min(255, g * factor)),
    b: Math.max(0, Math.min(255, b * factor)),
  }
}

function getComplementaryColor(r: number, g: number, b: number): { r: number; g: number; b: number } {
  return {
    r: 255 - r,
    g: 255 - g,
    b: 255 - b,
  }
}

function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

let debounceTimer: number | null = null

export function useCoverColor() {
  const fx = useFxStore()
  const player = usePlayerStore()

  const settings = ref<CoverColorSettings>(loadSettings())
  const extractedColors = ref<ExtractedColors | null>(null)
  const isExtracting = ref(false)

  const isEnabled = computed({
    get: () => settings.value.enabled,
    set: (v: boolean) => {
      settings.value.enabled = v
      saveSettings(settings.value)
      if (v && player.currentSong?.coverUrl) {
        extractAndApply(player.currentSong.coverUrl)
      }
    },
  })

  const applyToBackground = computed({
    get: () => settings.value.applyToBackground,
    set: (v: boolean) => {
      settings.value.applyToBackground = v
      saveSettings(settings.value)
    },
  })

  const applyToHighlight = computed({
    get: () => settings.value.applyToHighlight,
    set: (v: boolean) => {
      settings.value.applyToHighlight = v
      saveSettings(settings.value)
    },
  })

  const applyToGlow = computed({
    get: () => settings.value.applyToGlow,
    set: (v: boolean) => {
      settings.value.applyToGlow = v
      saveSettings(settings.value)
    },
  })

  function extractColor(imageUrl: string): Promise<ExtractedColors> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D not supported'))
          return
        }

        const size = 50
        canvas.width = size
        canvas.height = size
        ctx.drawImage(img, 0, 0, size, size)

        const imageData = ctx.getImageData(0, 0, size, size)
        const pixels = imageData.data

        let r = 0, g = 0, b = 0, count = 0
        let satR = 0, satG = 0, satB = 0, satCount = 0

        for (let i = 0; i < pixels.length; i += 4) {
          const pr = pixels[i]
          const pg = pixels[i + 1]
          const pb = pixels[i + 2]
          const pa = pixels[i + 3]

          if (pa < 128) continue

          r += pr
          g += pg
          b += pb
          count++

          const max = Math.max(pr, pg, pb)
          const min = Math.min(pr, pg, pb)
          const saturation = max > 0 ? (max - min) / max : 0
          const luminance = getLuminance(pr, pg, pb)

          if (saturation > 0.2 && luminance > 30 && luminance < 230) {
            satR += pr
            satG += pg
            satB += pb
            satCount++
          }
        }

        if (count === 0) {
          reject(new Error('No valid pixels'))
          return
        }

        let avgR = r / count
        let avgG = g / count
        let avgB = b / count

        if (satCount > 0) {
          avgR = satR / satCount
          avgG = satG / satCount
          avgB = satB / satCount
        }

        const luminance = getLuminance(avgR, avgG, avgB)
        let primaryR = avgR
        let primaryG = avgG
        let primaryB = avgB

        if (luminance < 60) {
          const bright = adjustBrightness(avgR, avgG, avgB, 1.8)
          primaryR = bright.r
          primaryG = bright.g
          primaryB = bright.b
        } else if (luminance > 200) {
          const dark = adjustBrightness(avgR, avgG, avgB, 0.7)
          primaryR = dark.r
          primaryG = dark.g
          primaryB = dark.b
        }

        const primary = rgbToHex(primaryR, primaryG, primaryB)

        const darker = adjustBrightness(primaryR, primaryG, primaryB, 0.6)
        const secondary = rgbToHex(darker.r, darker.g, darker.b)

        const bgDark = adjustBrightness(avgR, avgG, avgB, 0.15)
        const background = rgbToHex(bgDark.r, bgDark.g, bgDark.b)

        const complementary = getComplementaryColor(primaryR, primaryG, primaryB)
        const compLum = getLuminance(complementary.r, complementary.g, complementary.b)
        let accentR = complementary.r
        let accentG = complementary.g
        let accentB = complementary.b

        if (compLum < 80) {
          const bright = adjustBrightness(complementary.r, complementary.g, complementary.b, 1.5)
          accentR = bright.r
          accentG = bright.g
          accentB = bright.b
        }

        const accent = rgbToHex(accentR, accentG, accentB)

        const brighter = adjustBrightness(primaryR, primaryG, primaryB, 1.3)
        const glow = rgbToHex(brighter.r, brighter.g, brighter.b)

        resolve({
          primary,
          secondary,
          background,
          accent,
          glow,
        })
      }

      img.onerror = () => {
        reject(new Error('Failed to load image'))
      }

      img.src = imageUrl
    })
  }

  function applyCoverColor(colors: ExtractedColors): void {
    if (settings.value.applyToHighlight) {
      fx.update('accentColor', colors.accent)
    }
    if (settings.value.applyToGlow) {
      fx.update('glowColor', colors.glow)
    }
  }

  async function extractAndApply(imageUrl: string): Promise<void> {
    if (!settings.value.enabled) return

    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = window.setTimeout(async () => {
      isExtracting.value = true
      try {
        const colors = await extractColor(imageUrl)
        extractedColors.value = colors
        applyCoverColor(colors)
      } catch (e) {
        console.warn('Failed to extract cover color:', e)
      } finally {
        isExtracting.value = false
      }
    }, 300)
  }

  watch(
    () => player.currentSong?.coverUrl,
    (coverUrl) => {
      if (coverUrl && settings.value.enabled) {
        extractAndApply(coverUrl)
      }
    },
  )

  return {
    settings,
    extractedColors,
    isExtracting,
    isEnabled,
    applyToBackground,
    applyToHighlight,
    applyToGlow,
    extractColor,
    applyCoverColor,
    extractAndApply,
  }
}
