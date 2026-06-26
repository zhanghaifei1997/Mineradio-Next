import type { LyricLine, LyricWord, LyricData } from './types'

function clamp(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value)
  if (!isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function lyricTagTimeToSeconds(min: string, sec: string, ms?: string): number {
  const minutes = parseInt(min, 10) || 0
  const seconds = parseInt(sec, 10) || 0
  const milliseconds = ms ? parseInt(ms.padEnd(3, '0').slice(0, 3), 10) : 0
  return minutes * 60 + seconds + milliseconds / 1000
}

function finalizeLyricLineDurations(lines: LyricLine[]): LyricLine[] {
  lines.sort((a, b) => a.t - b.t)
  for (let i = 0; i < lines.length; i++) {
    const next = lines[i + 1]
    const inferred = next && next.t > lines[i].t ? next.t - lines[i].t : 4.8
    if (!isFinite(lines[i].duration) || lines[i].duration <= 0) {
      lines[i].duration = inferred
    }
    lines[i].duration = Math.max(0.45, Math.min(12, lines[i].duration))
    lines[i].charCount = Math.max(1, lines[i].charCount || String(lines[i].text || '').length)
  }
  return lines
}

export function parseLrcText(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  const reg = /\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g
  text.split(/\r?\n/).forEach((line) => {
    const times: number[] = []
    let m: RegExpExecArray | null
    reg.lastIndex = 0
    while ((m = reg.exec(line))) {
      times.push(lyricTagTimeToSeconds(m[1], m[2], m[3]))
    }
    if (!times.length) return
    const txt = line.replace(reg, '').trim()
    if (!txt) return
    times.forEach((t) => {
      lines.push({ t, text: txt, source: 'lrc', duration: 0, charCount: 0 })
    })
  })
  return finalizeLyricLineDurations(lines)
}

export function parseYrcText(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  String(text || '')
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\[(\d+),(\d+)\](.*)$/)
      if (!m) return
      const lineStartMs = parseInt(m[1], 10) || 0
      const lineDurMs = parseInt(m[2], 10) || 0
      const body = m[3] || ''
      const words: LyricWord[] = []
      let fullText = ''
      const reg = /\((\d+),(\d+),\d+\)([^()]*)/g
      let wm: RegExpExecArray | null
      while ((wm = reg.exec(body))) {
        const txt = (wm[3] || '').replace(/\s+/g, ' ')
        if (!txt) continue
        const rawStart = parseInt(wm[1], 10) || 0
        const rawDur = parseInt(wm[2], 10) || 0
        const absStartMs = rawStart >= lineStartMs - 500 ? rawStart : lineStartMs + rawStart
        const c0 = fullText.length
        fullText += txt
        words.push({
          text: txt,
          t: absStartMs / 1000,
          d: Math.max(0.06, rawDur / 1000),
          c0,
          c1: fullText.length,
        })
      }
      if (!fullText) fullText = body.replace(/\(\d+,\d+,\d+\)/g, '').replace(/\s+/g, ' ')
      const leading = (fullText.match(/^\s+/) || [''])[0].length
      fullText = fullText.replace(/\s+/g, ' ').trim()
      if (!fullText) return
      if (words.length) {
        words.forEach((w) => {
          w.c0 = Math.max(0, Math.min(fullText.length, w.c0 - leading))
          w.c1 = Math.max(w.c0, Math.min(fullText.length, w.c1 - leading))
        })
      }
      const filteredWords = words.filter((w) => w.c1 > w.c0)
      lines.push({
        t: lineStartMs / 1000,
        duration: lineDurMs / 1000,
        text: fullText,
        words: filteredWords.length ? filteredWords : undefined,
        charCount: Math.max(1, fullText.length),
        source: filteredWords.length ? 'yrc-word' : 'yrc-line',
      })
    })
  return finalizeLyricLineDurations(lines)
}

export function parseCustomLyricText(text: string, duration?: number): LyricLine[] {
  const raw = String(text || '').trim()
  if (!raw) return []
  const lrcLines = parseLrcText(raw)
  if (lrcLines.length && !lrcLines.every((line) => /^[\s\W]*$/.test(line.text))) {
    return lrcLines.map((line) => ({
      ...line,
      source: 'custom-lrc',
    }))
  }
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[\s\W]*$/.test(line))
  if (!rows.length) return []
  const dur = duration && duration > 8 ? duration : 0
  const gap = dur ? Math.max(2.8, Math.min(7.2, dur / Math.max(1, rows.length))) : 4.8
  return finalizeLyricLineDurations(
    rows.map((line, i) => ({
      t: i * gap,
      duration: gap,
      text: line,
      source: 'custom-text',
      charCount: Math.max(1, line.length),
    }))
  )
}

export function getLyricLineProgress(
  line: LyricLine | null,
  nextLine: LyricLine | null,
  now: number,
  totalDuration?: number
): number {
  if (!line) return 0
  now += line.words && line.words.length ? 0.03 : 0.02
  if (line.words && line.words.length && line.charCount > 0) {
    let lastP = 0
    for (let i = 0; i < line.words.length; i++) {
      const w = line.words[i]
      const ws = w.t
      const we = w.t + Math.max(0.08, w.d || 0.24)
      if (now < ws) return lastP
      const local = now >= we ? 1 : (now - ws) / Math.max(0.08, we - ws)
      const clampedLocal = Math.max(0, Math.min(1, local))
      const p = (w.c0 + (w.c1 - w.c0) * clampedLocal) / line.charCount
      lastP = Math.max(lastP, p)
      if (now < we) return lastP
    }
    return 1
  }
  const nextT =
    nextLine && nextLine.t > line.t
      ? nextLine.t
      : Math.min(totalDuration || now + 4, line.t + (line.duration || 4.8))
  const span = Math.max(0.75, nextT - line.t)
  const prog = Math.max(0, Math.min(1, (now - line.t) / span))
  return prog * prog * (3 - 2 * prog)
}

export function findCurrentLineIndex(lines: LyricLine[], currentTime: number): number {
  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].t <= currentTime + 0.05) idx = i
    else break
  }
  return idx
}

export function cloneLyricLine(line: LyricLine): LyricLine {
  const copy: LyricLine = { ...line }
  if (line.words) {
    copy.words = line.words.map((w) => ({ ...w }))
  }
  return copy
}

export function cloneLyricLines(lines: LyricLine[]): LyricLine[] {
  return (Array.isArray(lines) ? lines : []).map(cloneLyricLine)
}

export function createFallbackLyric(text: string, duration: number = 4.8): LyricLine {
  return {
    t: 0,
    duration: Math.max(0.8, duration),
    text,
    charCount: Math.max(1, text.length),
    source: 'fallback',
    fallback: true,
  }
}

export class LyricEngine {
  private _lines: LyricLine[] = []
  private _hasNativeKaraoke = false
  private _timingSource = 'fallback'
  private _currentIndex = -1
  private _currentTime = 0

  get lines(): LyricLine[] {
    return this._lines
  }

  get hasNativeKaraoke(): boolean {
    return this._hasNativeKaraoke
  }

  get timingSource(): string {
    return this._timingSource
  }

  get currentLine(): LyricLine | null {
    return this._currentIndex >= 0 && this._currentIndex < this._lines.length
      ? this._lines[this._currentIndex]
      : null
  }

  get nextLine(): LyricLine | null {
    return this._currentIndex + 1 < this._lines.length ? this._lines[this._currentIndex + 1] : null
  }

  get currentIndex(): number {
    return this._currentIndex
  }

  setLyrics(lines: LyricLine[], hasNativeKaraoke = false, timingSource = 'fallback'): void {
    this._lines = cloneLyricLines(lines)
    this._hasNativeKaraoke = hasNativeKaraoke
    this._timingSource = timingSource
    this._currentIndex = -1
  }

  clear(): void {
    this._lines = []
    this._hasNativeKaraoke = false
    this._timingSource = 'fallback'
    this._currentIndex = -1
  }

  update(time: number, totalDuration?: number): { lineChanged: boolean; progress: number } {
    this._currentTime = time
    const newIndex = findCurrentLineIndex(this._lines, time)
    const lineChanged = newIndex !== this._currentIndex
    this._currentIndex = newIndex

    const curLine = this.currentLine
    const nextLine = this.nextLine
    const progress = getLyricLineProgress(curLine, nextLine, time, totalDuration)

    return { lineChanged, progress }
  }

  getCurrentProgress(totalDuration?: number): number {
    return getLyricLineProgress(this.currentLine, this.nextLine, this._currentTime, totalDuration)
  }

  parseLrc(text: string): LyricData {
    const lines = parseLrcText(text)
    return {
      lines,
      hasNativeKaraoke: false,
      timingSource: 'lrc',
      hasTranslation: false,
    }
  }

  parseYrc(text: string): LyricData {
    const lines = parseYrcText(text)
    const hasKaraoke = lines.some((l) => l.words && l.words.length > 0)
    return {
      lines,
      hasNativeKaraoke: hasKaraoke,
      timingSource: hasKaraoke ? 'yrc-word' : 'yrc-line',
      hasTranslation: false,
    }
  }
}

export const lyricEngine = new LyricEngine()
