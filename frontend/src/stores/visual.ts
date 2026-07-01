import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BackgroundMode } from '@/types'

export const useVisualStore = defineStore('visual', () => {
  // ── 当前预设 ──
  const currentPresetId = ref(0)
  const backgroundMode = ref<BackgroundMode>('album')

  // ── 视觉参数 ──
  const particleDensity = ref(1.0)
  const particleSize = ref(1.0)
  const bgBlur = ref(120)
  const bgBrightness = ref(0.18)
  const bgOpacity = ref(0)

  // ── 歌词样式 ──
  const lyricColor = ref('#a9b8c8')
  const lyricFont = ref('sans')
  const lyricSize = ref(48)

  // ── 音频频谱 ──
  const bass = ref(0)
  const mid = ref(0)
  const treble = ref(0)
  const energy = ref(0)
  const beatPulse = ref(0)

  // ── 自定义背景 ──
  const customBgColor = ref('#000000')
  const customBgImage = ref('')
  const customBgVideo = ref('')

  function setPreset(id: number) { currentPresetId.value = id }
  function setBackgroundMode(mode: BackgroundMode) { backgroundMode.value = mode }
  function setLyricColor(color: string) { lyricColor.value = color }

  function updateAudioData(data: { bass: number; mid: number; treble: number; energy: number; beatPulse?: number }) {
    bass.value = data.bass
    mid.value = data.mid
    treble.value = data.treble
    energy.value = data.energy
    if (data.beatPulse !== undefined) beatPulse.value = data.beatPulse
  }

  return {
    currentPresetId, backgroundMode,
    particleDensity, particleSize, bgBlur, bgBrightness, bgOpacity,
    lyricColor, lyricFont, lyricSize,
    bass, mid, treble, energy, beatPulse,
    customBgColor, customBgImage, customBgVideo,
    setPreset, setBackgroundMode, setLyricColor, updateAudioData,
  }
})
