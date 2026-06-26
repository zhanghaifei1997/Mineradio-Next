import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  type LyricLine,
  type LyricData,
  type LyricPalette,
  type LyricStyleConfig,
  type LyricGlowConfig,
  type LyricLayoutConfig,
  type LyricStrokeConfig,
  type LyricShadowConfig,
  type LyricAnimationConfig,
  type LyricPreset,
  type LyricPresetConfig,
  type DesktopLyricState,
  parseLrcText,
  parseYrcText,
  parseCustomLyricText,
  findCurrentLineIndex,
  getLyricLineProgress,
  cloneLyricLines,
  effectiveLyricPalette,
  lyricTranslator,
  type TranslationSettings,
  type TranslationDisplayMode,
} from '@/modules/lyrics'
import { usePlayerStore } from './player'

const TRANSLATION_SETTINGS_KEY = 'mineradio-lyric-translation'
const LYRIC_SETTINGS_KEY = 'mineradio-lyric-settings'
const LYRIC_PRESETS_KEY = 'mineradio-lyric-custom-presets'

const defaultPalette: LyricPalette = {
  primary: '#f6fdff',
  secondary: '#a8f6ff',
  highlight: '#fff0b8',
  glow: '#9cffdf',
}

const defaultStyle: LyricStyleConfig = {
  fontFamily: 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  fontWeight: 900,
  fontSize: 58,
  letterSpacing: 0,
  lineHeight: 1,
  opacity: 0.92,
  feather: 0.055,
}

const defaultGlow: LyricGlowConfig = {
  enabled: true,
  beatSync: true,
  strength: 0.35,
  particles: false,
  highBloom: 0,
  beatGlow: 0,
}

const defaultLayout: LyricLayoutConfig = {
  size: 1,
  verticalPosition: 0.76,
  horizontalPosition: 0.5,
  depthPosition: 0,
  rotationX: 0,
  rotationY: 0,
  clickThrough: true,
  cinema: true,
  highlightFollow: false,
  frameRate: 60,
}

const defaultStroke: LyricStrokeConfig = {
  enabled: false,
  color: 'rgba(4, 6, 12, 0.8)',
  width: 2,
}

const defaultShadow: LyricShadowConfig = {
  enabled: true,
  color: 'rgba(4, 6, 12, 0.5)',
  blur: 8,
  offsetX: 0,
  offsetY: 2,
}

const defaultAnimation: LyricAnimationConfig = {
  enterDuration: 0.4,
  exitDuration: 0.3,
  easing: 'ease-out',
  charAnimationSpeed: 1,
  scrollSpeed: 1,
}

const builtinPresets: LyricPresetConfig[] = [
  {
    id: 'minimal',
    name: '简约',
    description: '干净清爽的极简风格',
    palette: { primary: '#ffffff', secondary: '#e0e0e0', highlight: '#ffffff', glow: '#ffffff' },
    style: { fontWeight: 600, opacity: 0.95 },
    glow: { enabled: false, strength: 0 },
    stroke: { enabled: false },
    shadow: { enabled: true, blur: 4, offsetY: 1 },
    layout: {},
    animation: { enterDuration: 0.3, exitDuration: 0.2 },
  },
  {
    id: 'neon',
    name: '霓虹',
    description: '赛博朋克霓虹发光效果',
    palette: { primary: '#00ffff', secondary: '#ff00ff', highlight: '#ffff00', glow: '#00ffff' },
    style: { fontWeight: 900, opacity: 1 },
    glow: { enabled: true, strength: 0.8, beatSync: true },
    stroke: { enabled: true, color: 'rgba(0, 0, 0, 0.9)', width: 3 },
    shadow: { enabled: true, color: '#00ffff', blur: 20, offsetY: 0 },
    layout: {},
    animation: { enterDuration: 0.5, exitDuration: 0.4 },
  },
  {
    id: 'gradient',
    name: '渐变',
    description: '柔和的渐变色效果',
    palette: { primary: '#ff9a9e', secondary: '#fecfef', highlight: '#ffecd2', glow: '#fcb69f' },
    style: { fontWeight: 800, opacity: 0.95 },
    glow: { enabled: true, strength: 0.4 },
    stroke: { enabled: false },
    shadow: { enabled: true, blur: 12, offsetY: 3 },
    layout: {},
    animation: { enterDuration: 0.45, exitDuration: 0.35 },
  },
  {
    id: 'stroke',
    name: '描边',
    description: '经典粗体描边风格',
    palette: { primary: '#ffffff', secondary: '#ffffff', highlight: '#ffd700', glow: '#ffffff' },
    style: { fontWeight: 900, opacity: 1 },
    glow: { enabled: false, strength: 0 },
    stroke: { enabled: true, color: '#000000', width: 4 },
    shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', blur: 6, offsetY: 3 },
    layout: {},
    animation: { enterDuration: 0.35, exitDuration: 0.25 },
  },
  {
    id: 'classic',
    name: '经典',
    description: 'KTV 经典歌词效果',
    palette: { primary: '#ffffff', secondary: '#cccccc', highlight: '#ff6b6b', glow: '#4ecdc4' },
    style: { fontWeight: 900, opacity: 0.95 },
    glow: { enabled: true, strength: 0.3 },
    stroke: { enabled: true, color: 'rgba(0, 0, 0, 0.7)', width: 2 },
    shadow: { enabled: true, blur: 8, offsetY: 2 },
    layout: {},
    animation: { enterDuration: 0.4, exitDuration: 0.3 },
  },
]

function loadTranslationSettings(): TranslationSettings {
  try {
    const raw = localStorage.getItem(TRANSLATION_SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      lyricTranslator.updateSettings(parsed)
      return parsed
    }
  } catch (_) {}
  return {
    enabled: false,
    provider: 'youdao',
    targetLanguage: 'zh-CN',
    displayMode: 'both',
  }
}

function saveTranslationSettings(settings: TranslationSettings): void {
  try {
    localStorage.setItem(TRANSLATION_SETTINGS_KEY, JSON.stringify(settings))
  } catch (_) {}
}

function loadLyricSettings(): {
  palette: Partial<LyricPalette>
  style: Partial<LyricStyleConfig>
  glow: Partial<LyricGlowConfig>
  layout: Partial<LyricLayoutConfig>
  stroke: Partial<LyricStrokeConfig>
  shadow: Partial<LyricShadowConfig>
  animation: Partial<LyricAnimationConfig>
  cameraBind: boolean
} {
  try {
    const raw = localStorage.getItem(LYRIC_SETTINGS_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (_) {}
  return {
    palette: {},
    style: {},
    glow: {},
    layout: {},
    stroke: {},
    shadow: {},
    animation: {},
    cameraBind: false,
  }
}

function saveLyricSettings(data: {
  palette: LyricPalette
  style: LyricStyleConfig
  glow: LyricGlowConfig
  layout: LyricLayoutConfig
  stroke: LyricStrokeConfig
  shadow: LyricShadowConfig
  animation: LyricAnimationConfig
  cameraBind: boolean
}): void {
  try {
    localStorage.setItem(LYRIC_SETTINGS_KEY, JSON.stringify(data))
  } catch (_) {}
}

function loadCustomPresets(): LyricPresetConfig[] {
  try {
    const raw = localStorage.getItem(LYRIC_PRESETS_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (_) {}
  return []
}

function saveCustomPresets(presets: LyricPresetConfig[]): void {
  try {
    localStorage.setItem(LYRIC_PRESETS_KEY, JSON.stringify(presets))
  } catch (_) {}
}

export const useLyricsStore = defineStore('lyrics', () => {
  const savedSettings = loadLyricSettings()

  const lines = ref<LyricLine[]>([])
  const hasNativeKaraoke = ref(false)
  const timingSource = ref('fallback')
  const hasTranslation = ref(false)

  const currentIndex = ref(-1)
  const currentProgress = ref(0)

  const stageEnabled = ref(false)
  const desktopEnabled = ref(false)

  const palette = ref<LyricPalette>({ ...defaultPalette, ...savedSettings.palette })
  const style = ref<LyricStyleConfig>({ ...defaultStyle, ...savedSettings.style })
  const glow = ref<LyricGlowConfig>({ ...defaultGlow, ...savedSettings.glow })
  const layout = ref<LyricLayoutConfig>({ ...defaultLayout, ...savedSettings.layout })
  const stroke = ref<LyricStrokeConfig>({ ...defaultStroke, ...savedSettings.stroke })
  const shadow = ref<LyricShadowConfig>({ ...defaultShadow, ...savedSettings.shadow })
  const animation = ref<LyricAnimationConfig>({ ...defaultAnimation, ...savedSettings.animation })
  const cameraBind = ref<boolean>(savedSettings.cameraBind || false)

  const customPresets = ref<LyricPresetConfig[]>(loadCustomPresets())
  const allPresets = computed<LyricPresetConfig[]>(() => [...builtinPresets, ...customPresets.value])

  const originalLyricsState = ref<LyricData>({
    lines: [],
    hasNativeKaraoke: false,
    timingSource: 'fallback',
    hasTranslation: false,
  })

  const customLyricsMap = ref<Record<string, { text: string }>>({})
  const lyricSourceMode = ref<'original' | 'custom'>('original')

  const translationSettings = ref<TranslationSettings>(loadTranslationSettings())
  const translatedLines = ref<LyricLine[]>([])
  const isTranslating = ref(false)

  const displayLines = computed(() => {
    if (translationSettings.value.displayMode === 'translation' && translatedLines.value.length > 0) {
      return translatedLines.value.map(l => ({ ...l, text: l.translation || l.text }))
    }
    if (translationSettings.value.displayMode === 'both' && translatedLines.value.length > 0) {
      return lines.value.map((line, idx) => ({
        ...line,
        text: translatedLines.value[idx]?.translation
          ? `${line.text}\n${translatedLines.value[idx].translation}`
          : line.text,
      }))
    }
    return lines.value
  })

  const currentLine = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < lines.value.length) {
      return lines.value[currentIndex.value]
    }
    return null
  })

  const nextLine = computed(() => {
    if (currentIndex.value + 1 < lines.value.length) {
      return lines.value[currentIndex.value + 1]
    }
    return null
  })

  const currentText = computed(() => currentLine.value?.text || '')
  const currentTranslation = computed(() => currentLine.value?.translation || '')

  const desktopState = computed<DesktopLyricState>(() => ({
    enabled: desktopEnabled.value,
    text: currentText.value || 'Mineradio',
    progress: currentProgress.value,
    progressSpan: currentLine.value?.duration || 4.8,
    playing: usePlayerStore().isPlaying,
    playbackTime: usePlayerStore().currentTime,
    playbackDuration: usePlayerStore().duration,
    playbackRate: usePlayerStore().speed,
    size: layout.value.size,
    opacity: style.value.opacity,
    clickThrough: layout.value.clickThrough,
    cinema: layout.value.cinema,
    highlightFollow: layout.value.highlightFollow,
    frameRate: layout.value.frameRate,
    colors: palette.value,
    displayColors: effectiveLyricPalette(palette.value),
    fontFamily: style.value.fontFamily,
    fontWeight: style.value.fontWeight,
    letterSpacing: style.value.letterSpacing,
    lineHeight: style.value.lineHeight,
    lyricGlow: glow.value.enabled,
    lyricGlowBeat: glow.value.beatSync,
    lyricGlowStrength: glow.value.strength,
    lyricGlowParticles: glow.value.particles,
    highBloom: glow.value.highBloom,
    beatGlow: glow.value.beatGlow,
    beatPulse: glow.value.beatGlow,
    bass: 0,
    feather: style.value.feather,
  }))

  function persistSettings() {
    saveLyricSettings({
      palette: palette.value,
      style: style.value,
      glow: glow.value,
      layout: layout.value,
      stroke: stroke.value,
      shadow: shadow.value,
      animation: animation.value,
      cameraBind: cameraBind.value,
    })
  }

  function setLyrics(data: Partial<LyricData>): void {
    if (data.lines) {
      lines.value = cloneLyricLines(data.lines)
    }
    if (data.hasNativeKaraoke != null) {
      hasNativeKaraoke.value = data.hasNativeKaraoke
    }
    if (data.timingSource) {
      timingSource.value = data.timingSource
    }
    if (data.hasTranslation != null) {
      hasTranslation.value = data.hasTranslation
    }
    currentIndex.value = -1
    currentProgress.value = 0
  }

  function setOriginalLyrics(data: Partial<LyricData>): void {
    originalLyricsState.value = {
      lines: data.lines ? cloneLyricLines(data.lines) : originalLyricsState.value.lines,
      hasNativeKaraoke: data.hasNativeKaraoke ?? originalLyricsState.value.hasNativeKaraoke,
      timingSource: data.timingSource || originalLyricsState.value.timingSource,
      hasTranslation: data.hasTranslation ?? originalLyricsState.value.hasTranslation,
    }
    if (lyricSourceMode.value === 'original') {
      setLyrics(originalLyricsState.value)
    }
  }

  function parseLrc(text: string): LyricData {
    const parsedLines = parseLrcText(text)
    return {
      lines: parsedLines,
      hasNativeKaraoke: false,
      timingSource: 'lrc',
      hasTranslation: false,
    }
  }

  function parseYrc(text: string): LyricData {
    const parsedLines = parseYrcText(text)
    const hasKaraoke = parsedLines.some((l) => l.words && l.words.length > 0)
    return {
      lines: parsedLines,
      hasNativeKaraoke: hasKaraoke,
      timingSource: hasKaraoke ? 'yrc-word' : 'yrc-line',
      hasTranslation: false,
    }
  }

  function parseCustom(text: string, duration?: number): LyricLine[] {
    return parseCustomLyricText(text, duration)
  }

  function update(currentTime: number, duration?: number): { lineChanged: boolean; progress: number } {
    if (!lines.value.length) {
      currentIndex.value = -1
      currentProgress.value = 0
      return { lineChanged: false, progress: 0 }
    }

    const newIndex = findCurrentLineIndex(lines.value, currentTime)
    const lineChanged = newIndex !== currentIndex.value
    currentIndex.value = newIndex

    const curLine = currentLine.value
    const nxtLine = nextLine.value
    const progress = getLyricLineProgress(curLine, nxtLine, currentTime, duration)
    currentProgress.value = progress

    return { lineChanged, progress }
  }

  function clear(): void {
    lines.value = []
    hasNativeKaraoke.value = false
    timingSource.value = 'fallback'
    hasTranslation.value = false
    currentIndex.value = -1
    currentProgress.value = 0
  }

  function toggleStageLyrics(force?: boolean): void {
    stageEnabled.value = force != null ? force : !stageEnabled.value
  }

  function toggleDesktopLyrics(force?: boolean): void {
    desktopEnabled.value = force != null ? force : !desktopEnabled.value
  }

  function setPalette(pal: Partial<LyricPalette>): void {
    palette.value = { ...palette.value, ...pal }
    persistSettings()
  }

  function setStyle(s: Partial<LyricStyleConfig>): void {
    style.value = { ...style.value, ...s }
    persistSettings()
  }

  function setGlow(g: Partial<LyricGlowConfig>): void {
    glow.value = { ...glow.value, ...g }
    persistSettings()
  }

  function setLayout(l: Partial<LyricLayoutConfig>): void {
    layout.value = { ...layout.value, ...l }
    persistSettings()
  }

  function setStroke(s: Partial<LyricStrokeConfig>): void {
    stroke.value = { ...stroke.value, ...s }
    persistSettings()
  }

  function setShadow(s: Partial<LyricShadowConfig>): void {
    shadow.value = { ...shadow.value, ...s }
    persistSettings()
  }

  function setAnimation(a: Partial<LyricAnimationConfig>): void {
    animation.value = { ...animation.value, ...a }
    persistSettings()
  }

  function setCameraBind(enabled: boolean): void {
    cameraBind.value = enabled
    persistSettings()
  }

  function applyPreset(presetId: LyricPreset): void {
    const preset = allPresets.value.find(p => p.id === presetId)
    if (!preset) return

    if (preset.palette) palette.value = { ...defaultPalette, ...preset.palette }
    if (preset.style) style.value = { ...defaultStyle, ...preset.style }
    if (preset.glow) glow.value = { ...defaultGlow, ...preset.glow }
    if (preset.stroke) stroke.value = { ...defaultStroke, ...preset.stroke }
    if (preset.shadow) shadow.value = { ...defaultShadow, ...preset.shadow }
    if (preset.layout) layout.value = { ...defaultLayout, ...preset.layout }
    if (preset.animation) animation.value = { ...defaultAnimation, ...preset.animation }

    persistSettings()
  }

  function savePreset(name: string, description: string): void {
    const id = `custom-${Date.now()}` as LyricPreset
    const newPreset: LyricPresetConfig = {
      id,
      name,
      description,
      palette: { ...palette.value },
      style: { ...style.value },
      glow: { ...glow.value },
      stroke: { ...stroke.value },
      shadow: { ...shadow.value },
      layout: { ...layout.value },
      animation: { ...animation.value },
    }
    customPresets.value.push(newPreset)
    saveCustomPresets(customPresets.value)
  }

  function deletePreset(presetId: string): void {
    const index = customPresets.value.findIndex(p => p.id === presetId)
    if (index > -1) {
      customPresets.value.splice(index, 1)
      saveCustomPresets(customPresets.value)
    }
  }

  function resetToDefault(): void {
    palette.value = { ...defaultPalette }
    style.value = { ...defaultStyle }
    glow.value = { ...defaultGlow }
    layout.value = { ...defaultLayout }
    stroke.value = { ...defaultStroke }
    shadow.value = { ...defaultShadow }
    animation.value = { ...defaultAnimation }
    cameraBind.value = false
    persistSettings()
  }

  function applyOriginalLyrics(): void {
    lyricSourceMode.value = 'original'
    setLyrics(originalLyricsState.value)
  }

  function applyCustomLyrics(songId: string): boolean {
    const entry = customLyricsMap.value[songId]
    if (!entry || !entry.text.trim()) {
      return false
    }
    const player = usePlayerStore()
    const customLines = parseCustom(entry.text, player.duration)
    if (!customLines.length) return false

    lyricSourceMode.value = 'custom'
    setLyrics({
      lines: customLines,
      hasNativeKaraoke: false,
      timingSource: customLines[0]?.source === 'custom-lrc' ? 'custom-lrc' : 'custom-text',
      hasTranslation: false,
    })
    return true
  }

  function setCustomLyric(songId: string, text: string): void {
    customLyricsMap.value[songId] = { text }
  }

  function getCustomLyric(songId: string): { text: string } | null {
    return customLyricsMap.value[songId] || null
  }

  function setLyricSourceMode(mode: 'original' | 'custom'): void {
    if (mode === 'custom') {
      const player = usePlayerStore()
      const songId = player.currentSong?.id
      if (songId && applyCustomLyrics(songId)) {
        lyricSourceMode.value = 'custom'
      }
    } else {
      applyOriginalLyrics()
    }
  }

  function updateTranslationSettings(settings: Partial<TranslationSettings>): void {
    translationSettings.value = { ...translationSettings.value, ...settings }
    lyricTranslator.updateSettings(translationSettings.value)
    saveTranslationSettings(translationSettings.value)

    if (translationSettings.value.enabled && lines.value.length > 0) {
      translateCurrentLyrics()
    } else {
      translatedLines.value = []
    }
  }

  function setTranslationDisplayMode(mode: TranslationDisplayMode): void {
    updateTranslationSettings({ displayMode: mode })
  }

  async function translateCurrentLyrics(): Promise<void> {
    if (!translationSettings.value.enabled || lines.value.length === 0) {
      translatedLines.value = []
      return
    }

    isTranslating.value = true
    try {
      const result = await lyricTranslator.translateLines(lines.value)
      translatedLines.value = result
    } catch (e) {
      console.error('Translate lyrics failed:', e)
      translatedLines.value = []
    } finally {
      isTranslating.value = false
    }
  }

  function clearTranslation(): void {
    translatedLines.value = []
  }

  watch(
    () => lines.value,
    () => {
      if (translationSettings.value.enabled) {
        translateCurrentLyrics()
      }
    }
  )

  return {
    lines,
    hasNativeKaraoke,
    timingSource,
    hasTranslation,
    currentIndex,
    currentProgress,
    stageEnabled,
    desktopEnabled,
    palette,
    style,
    glow,
    layout,
    stroke,
    shadow,
    animation,
    cameraBind,
    builtinPresets,
    customPresets,
    allPresets,
    currentLine,
    nextLine,
    currentText,
    currentTranslation,
    desktopState,
    lyricSourceMode,
    translationSettings,
    translatedLines,
    displayLines,
    isTranslating,
    setLyrics,
    setOriginalLyrics,
    parseLrc,
    parseYrc,
    parseCustom,
    update,
    clear,
    toggleStageLyrics,
    toggleDesktopLyrics,
    setPalette,
    setStyle,
    setGlow,
    setLayout,
    setStroke,
    setShadow,
    setAnimation,
    setCameraBind,
    applyPreset,
    savePreset,
    deletePreset,
    resetToDefault,
    applyOriginalLyrics,
    applyCustomLyrics,
    setCustomLyric,
    getCustomLyric,
    setLyricSourceMode,
    updateTranslationSettings,
    setTranslationDisplayMode,
    translateCurrentLyrics,
    clearTranslation,
  }
})
