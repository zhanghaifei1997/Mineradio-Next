import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  type LyricLine,
  type LyricData,
  type LyricPalette,
  type LyricStyleConfig,
  type LyricGlowConfig,
  type LyricLayoutConfig,
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

export const useLyricsStore = defineStore('lyrics', () => {
  const lines = ref<LyricLine[]>([])
  const hasNativeKaraoke = ref(false)
  const timingSource = ref('fallback')
  const hasTranslation = ref(false)

  const currentIndex = ref(-1)
  const currentProgress = ref(0)

  const stageEnabled = ref(false)
  const desktopEnabled = ref(false)

  const palette = ref<LyricPalette>({
    primary: '#f6fdff',
    secondary: '#a8f6ff',
    highlight: '#fff0b8',
    glow: '#9cffdf',
  })

  const style = ref<LyricStyleConfig>({
    fontFamily: 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    fontWeight: 900,
    fontSize: 58,
    letterSpacing: 0,
    lineHeight: 1,
    opacity: 0.92,
    feather: 0.055,
  })

  const glow = ref<LyricGlowConfig>({
    enabled: true,
    beatSync: true,
    strength: 0.35,
    particles: false,
    highBloom: 0,
    beatGlow: 0,
  })

  const layout = ref<LyricLayoutConfig>({
    size: 1,
    verticalPosition: 0.76,
    clickThrough: true,
    cinema: true,
    highlightFollow: false,
    frameRate: 60,
  })

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
  }

  function setStyle(s: Partial<LyricStyleConfig>): void {
    style.value = { ...style.value, ...s }
  }

  function setGlow(g: Partial<LyricGlowConfig>): void {
    glow.value = { ...glow.value, ...g }
  }

  function setLayout(l: Partial<LyricLayoutConfig>): void {
    layout.value = { ...layout.value, ...l }
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
