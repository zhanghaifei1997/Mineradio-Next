import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import { useLyricsStore } from '@/stores/lyrics'
import { usePlayerStore } from '@/stores/player'
import {
  type LyricLine,
  type LyricData,
  type LyricPalette,
  parseLrcText,
  parseYrcText,
} from '@/modules/lyrics'

export function useLyrics() {
  const lyrics = useLyricsStore()
  const player = usePlayerStore()

  const animationId = ref<number | null>(null)
  const lastUpdateTime = ref(0)

  function tick() {
    if (player.isPlaying) {
      lyrics.update(player.currentTime, player.duration)
    }
    animationId.value = requestAnimationFrame(tick)
  }

  function startTick() {
    if (animationId.value) return
    animationId.value = requestAnimationFrame(tick)
  }

  function stopTick() {
    if (animationId.value) {
      cancelAnimationFrame(animationId.value)
      animationId.value = null
    }
  }

  function loadLrc(text: string): void {
    const data: LyricData = {
      lines: parseLrcText(text),
      hasNativeKaraoke: false,
      timingSource: 'lrc',
      hasTranslation: false,
    }
    lyrics.setOriginalLyrics(data)
    lyrics.applyOriginalLyrics()
  }

  function loadYrc(text: string): void {
    const lines = parseYrcText(text)
    const hasKaraoke = lines.some((l) => l.words && l.words.length > 0)
    const data: LyricData = {
      lines,
      hasNativeKaraoke: hasKaraoke,
      timingSource: hasKaraoke ? 'yrc-word' : 'yrc-line',
      hasTranslation: false,
    }
    lyrics.setOriginalLyrics(data)
    lyrics.applyOriginalLyrics()
  }

  function setPalette(pal: Partial<LyricPalette>): void {
    lyrics.setPalette(pal)
  }

  function toggleStageLyrics(): void {
    lyrics.toggleStageLyrics()
  }

  function toggleDesktopLyrics(): void {
    lyrics.toggleDesktopLyrics()
  }

  onMounted(() => {
    startTick()
  })

  onUnmounted(() => {
    stopTick()
  })

  onActivated(() => {
    startTick()
  })

  onDeactivated(() => {
    stopTick()
  })

  return {
    lyrics,
    currentLine: computed(() => lyrics.currentLine),
    currentText: computed(() => lyrics.currentText),
    currentTranslation: computed(() => lyrics.currentTranslation),
    currentProgress: computed(() => lyrics.currentProgress),
    stageEnabled: computed(() => lyrics.stageEnabled),
    desktopEnabled: computed(() => lyrics.desktopEnabled),
    palette: computed(() => lyrics.palette),
    style: computed(() => lyrics.style),
    glow: computed(() => lyrics.glow),
    layout: computed(() => lyrics.layout),
    loadLrc,
    loadYrc,
    setPalette,
    toggleStageLyrics,
    toggleDesktopLyrics,
    startTick,
    stopTick,
  }
}
