import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFxStore } from './fx'
import { useLyricsStore } from './lyrics'
import type { VisualPreset, FxSettings, CinemaMode } from '@/types'
import type { LyricPalette, LyricStyleConfig, LyricGlowConfig, LyricLayoutConfig } from '@/modules/lyrics'

const STORAGE_KEY = 'mineradio-user-fx-archives-v1'
const STORAGE_KEY_LEGACY = 'mineradio_archive_slots'

export interface ArchiveSlot {
  id: string
  name: string
  thumbnailColor: string
  visualPreset: VisualPreset
  particleResolution: number
  cinemaIntensity: number
  cinemaMode: CinemaMode
  lyricGlow: number
  highlightColor: string
  glowColor: string
  shelfSettings: {
    showPodcasts: boolean
    mergeCollections: boolean
  }
  lyricSettings: {
    palette: LyricPalette
    style: LyricStyleConfig
    glow: LyricGlowConfig
    layout: LyricLayoutConfig
  }
  createdAt: number
  updatedAt: number
}

const defaultSlotData = (index: number): ArchiveSlot => ({
  id: `slot${index}`,
  name: `槽位 ${index}`,
  thumbnailColor: '#333333',
  visualPreset: 'emily',
  particleResolution: 1,
  cinemaIntensity: 0.7,
  cinemaMode: 'cinema',
  lyricGlow: 0.6,
  highlightColor: '#d95b67',
  glowColor: '#d95b67',
  shelfSettings: {
    showPodcasts: false,
    mergeCollections: false,
  },
  lyricSettings: {
    palette: {
      primary: '#f6fdff',
      secondary: '#a8f6ff',
      highlight: '#fff0b8',
      glow: '#9cffdf',
    },
    style: {
      fontFamily: 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      fontWeight: 900,
      fontSize: 58,
      letterSpacing: 0,
      lineHeight: 1,
      opacity: 0.92,
      feather: 0.055,
    },
    glow: {
      enabled: true,
      beatSync: true,
      strength: 0.35,
      particles: false,
      highBloom: 0,
      beatGlow: 0,
    },
    layout: {
      size: 1,
      verticalPosition: 0.76,
      clickThrough: true,
      cinema: true,
      highlightFollow: false,
      frameRate: 60,
    },
  },
  createdAt: 0,
  updatedAt: 0,
})

function loadSlots(): (ArchiveSlot | null)[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY_LEGACY)
      if (raw) {
        // 迁移旧数据到新键名
        localStorage.setItem(STORAGE_KEY, raw)
        try {
          localStorage.removeItem(STORAGE_KEY_LEGACY)
        } catch (_) {}
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw)
      const slots: (ArchiveSlot | null)[] = [null, null, null, null]
      for (let i = 0; i < 4; i++) {
        const key = `slot${i + 1}`
        if (parsed[key]) {
          slots[i] = parsed[key]
        }
      }
      return slots
    }
  } catch (e) {
    console.warn('Failed to load archive slots:', e)
  }
  return [null, null, null, null]
}

function saveSlots(slots: (ArchiveSlot | null)[]): void {
  try {
    const data: Record<string, ArchiveSlot> = {}
    slots.forEach((slot, index) => {
      if (slot) {
        data[`slot${index + 1}`] = slot
      }
    })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save archive slots:', e)
  }
}

export const useArchiveStore = defineStore('archive', () => {
  const slots = ref<(ArchiveSlot | null)[]>(loadSlots())

  const hasAnySlot = computed(() => slots.value.some(s => s !== null))

  function saveToSlot(slotIndex: number, name?: string): void {
    const fx = useFxStore()
    const lyrics = useLyricsStore()
    const index = slotIndex - 1
    if (index < 0 || index >= 4) return

    const now = Date.now()
    const existing = slots.value[index]

    const newSlot: ArchiveSlot = {
      id: `slot${slotIndex}`,
      name: name || existing?.name || `存档 ${slotIndex}`,
      thumbnailColor: fx.settings.glowColor,
      visualPreset: fx.settings.preset,
      particleResolution: fx.settings.particleResolution,
      cinemaIntensity: fx.settings.cinemaIntensity,
      cinemaMode: fx.settings.cinemaMode,
      lyricGlow: fx.settings.lyricGlow,
      highlightColor: fx.settings.accentColor,
      glowColor: fx.settings.glowColor,
      shelfSettings: {
        showPodcasts: fx.settings.shelfShowPodcasts,
        mergeCollections: fx.settings.shelfMergeCollections,
      },
      lyricSettings: {
        palette: { ...lyrics.palette },
        style: { ...lyrics.style },
        glow: { ...lyrics.glow },
        layout: { ...lyrics.layout },
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }

    slots.value[index] = newSlot
    saveSlots(slots.value)
  }

  function loadFromSlot(slotIndex: number): void {
    const index = slotIndex - 1
    if (index < 0 || index >= 4) return

    const slot = slots.value[index]
    if (!slot) return

    const fx = useFxStore()
    const lyrics = useLyricsStore()

    fx.update('preset', slot.visualPreset)
    fx.update('particleResolution', slot.particleResolution)
    fx.update('cinemaIntensity', slot.cinemaIntensity)
    fx.update('cinemaMode', slot.cinemaMode)
    fx.update('lyricGlow', slot.lyricGlow)
    fx.update('accentColor', slot.highlightColor)
    fx.update('glowColor', slot.glowColor)
    fx.update('shelfShowPodcasts', slot.shelfSettings.showPodcasts)
    fx.update('shelfMergeCollections', slot.shelfSettings.mergeCollections)

    lyrics.setPalette(slot.lyricSettings.palette)
    lyrics.setStyle(slot.lyricSettings.style)
    lyrics.setGlow(slot.lyricSettings.glow)
    lyrics.setLayout(slot.lyricSettings.layout)
  }

  function renameSlot(slotIndex: number, name: string): void {
    const index = slotIndex - 1
    if (index < 0 || index >= 4) return

    const slot = slots.value[index]
    if (!slot) return

    slot.name = name
    slot.updatedAt = Date.now()
    saveSlots(slots.value)
  }

  function clearSlot(slotIndex: number): void {
    const index = slotIndex - 1
    if (index < 0 || index >= 4) return

    slots.value[index] = null
    saveSlots(slots.value)
  }

  function initDefaultArchive(): void {
    if (hasAnySlot.value) return

    const defaultSlot: ArchiveSlot = {
      ...defaultSlotData(1),
      id: 'slot1',
      name: '默认测试',
      thumbnailColor: '#008aff',
      visualPreset: 'emily',
      particleResolution: 1.55,
      cinemaIntensity: 0.5,
      cinemaMode: 'cinema',
      lyricGlow: 0.28,
      highlightColor: '#fac900',
      glowColor: '#008aff',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    slots.value[0] = defaultSlot
    saveSlots(slots.value)
  }

  return {
    slots,
    hasAnySlot,
    saveToSlot,
    loadFromSlot,
    renameSlot,
    clearSlot,
    initDefaultArchive,
  }
})
