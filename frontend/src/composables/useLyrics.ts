/**
 * 歌词解析与同步 composable
 * 支持 LRC 格式和网易云 YRC (逐字卡拉OK) 格式
 */
import { ref, watch, computed } from 'vue'
import type { LyricLine, LyricData } from '@/types'
import { netease } from '@/services/netease'

export function useLyrics(currentTime: () => number) {
  const lines = ref<LyricLine[]>([])
  const currentLineIdx = ref(-1)
  const hasKaraoke = ref(false)
  const rawLrc = ref('')

  // 当前行歌词文本
  const currentText = computed(() => {
    if (currentLineIdx.value >= 0 && currentLineIdx.value < lines.value.length) {
      return lines.value[currentLineIdx.value]?.text ?? ''
    }
    return ''
  })

  // 当前行翻译文本
  const currentTranslation = computed(() => {
    if (currentLineIdx.value >= 0 && currentLineIdx.value < lines.value.length) {
      return lines.value[currentLineIdx.value]?.translation ?? ''
    }
    return ''
  })

  /**
   * 解析 LRC 格式歌词
   * 格式: [mm:ss.xx] 歌词文本
   */
  function parseLrc(lrcText: string): LyricLine[] {
    if (!lrcText) return []
    const result: LyricLine[] = []
    const regex = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(lrcText)) !== null) {
      const minutes = parseInt(match[1] ?? '0', 10)
      const seconds = parseInt(match[2] ?? '0', 10)
      const ms = parseInt((match[3] ?? '0').padEnd(3, '0'), 10)
      const time = minutes * 60 + seconds + ms / 1000
      const text = match[4]?.trim() ?? ''

      if (text) {
        result.push({ time, text })
      }
    }

    // 按时间排序
    result.sort((a, b) => a.time - b.time)
    return result
  }

  /**
   * 解析翻译歌词 (TLRC)
   * 将翻译按时间戳匹配到对应行
   */
  function parseTranslation(tlyricText: string, mainLines: LyricLine[]): void {
    if (!tlyricText) return
    const transLines = parseLrc(tlyricText)

    for (const tl of transLines) {
      // 找到时间最接近的主歌词行
      let bestIdx = -1
      let bestDiff = Infinity
      for (let i = 0; i < mainLines.length; i++) {
        const line = mainLines[i]
        if (!line) continue
        const diff = Math.abs(line.time - tl.time)
        if (diff < bestDiff) {
          bestDiff = diff
          bestIdx = i
        }
      }
      if (bestIdx >= 0 && bestDiff < 1.0) {
        const target = mainLines[bestIdx]
        if (target) target.translation = tl.text
      }
    }
  }

  /**
   * 加载歌曲歌词
   */
  async function loadLyrics(songId: string, source?: string) {
    lines.value = []
    currentLineIdx.value = -1
    hasKaraoke.value = false
    rawLrc.value = ''

    if (source === 'qq') {
      // QQ 歌词通过 QQ 服务获取
      // TODO: 实现 QQ 歌词加载
      return
    }

    try {
      const result = await netease.getLyric({ id: songId })
      if (!result) return

      const raw = result as unknown as Record<string, unknown>
      const lrc = (raw.lyric as string) || ''
      const tlyric = (raw.tlyric as string) || ''
      const yrc = (raw.yrc as string) || ''

      rawLrc.value = lrc

      // 优先使用 YRC (逐字卡拉OK)
      if (yrc) {
        const parsed = parseLrc(yrc)
        if (parsed.length > 0) {
          lines.value = parsed
          hasKaraoke.value = true
          parseTranslation(tlyric, parsed)
          return
        }
      }

      // 回退到 LRC
      const parsed = parseLrc(lrc)
      lines.value = parsed
      parseTranslation(tlyric, parsed)
    } catch (e) {
      console.error('[useLyrics] loadLyrics failed:', e)
    }
  }

  /**
   * 根据当前播放时间更新歌词高亮行
   */
  function updateCurrentLine() {
    if (lines.value.length === 0) {
      currentLineIdx.value = -1
      return
    }

    const t = currentTime()
    let idx = -1

    for (let i = lines.value.length - 1; i >= 0; i--) {
      const line = lines.value[i]
      if (line && t >= line.time) {
        idx = i
        break
      }
    }

    currentLineIdx.value = idx
  }

  /**
   * 清空歌词
   */
  function clearLyrics() {
    lines.value = []
    currentLineIdx.value = -1
    hasKaraoke.value = false
    rawLrc.value = ''
  }

  return {
    lines,
    currentLineIdx,
    currentText,
    currentTranslation,
    hasKaraoke,
    rawLrc,
    loadLyrics,
    updateCurrentLine,
    clearLyrics,
    parseLrc,
  }
}
