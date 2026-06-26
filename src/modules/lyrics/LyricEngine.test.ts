import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseLrcText,
  parseYrcText,
  parseCustomLyricText,
  getLyricLineProgress,
  findCurrentLineIndex,
  cloneLyricLine,
  cloneLyricLines,
  createFallbackLyric,
  LyricEngine,
} from './LyricEngine'
import type { LyricLine } from './types'

describe('LyricEngine - LRC 解析', () => {
  it('应该正确解析标准 LRC 格式', () => {
    const lrc = `[00:00.00]第一句歌词
[00:05.00]第二句歌词
[00:10.50]第三句歌词`

    const lines = parseLrcText(lrc)
    expect(lines.length).toBe(3)
    expect(lines[0].t).toBeCloseTo(0, 2)
    expect(lines[0].text).toBe('第一句歌词')
    expect(lines[1].t).toBeCloseTo(5, 2)
    expect(lines[2].t).toBeCloseTo(10.5, 2)
  })

  it('应该正确解析带毫秒的 LRC 格式', () => {
    const lrc = `[01:23.456]带毫秒的歌词`

    const lines = parseLrcText(lrc)
    expect(lines.length).toBe(1)
    expect(lines[0].t).toBeCloseTo(83.456, 2)
  })

  it('应该解析同一时间点的多行标签', () => {
    const lrc = `[00:00.00][00:05.00]重复的歌词`

    const lines = parseLrcText(lrc)
    expect(lines.length).toBe(2)
    expect(lines[0].t).toBeCloseTo(0, 2)
    expect(lines[1].t).toBeCloseTo(5, 2)
    expect(lines[0].text).toBe(lines[1].text)
  })

  it('应该跳过空行和没有时间戳的行', () => {
    const lrc = `[ti:标题]
[ar:艺术家]

[00:00.00]有效歌词
无效行没有时间戳`

    const lines = parseLrcText(lrc)
    expect(lines.length).toBe(1)
    expect(lines[0].text).toBe('有效歌词')
  })

  it('应该处理空字符串输入', () => {
    expect(parseLrcText('').length).toBe(0)
    expect(parseLrcText('  \n  \n').length).toBe(0)
  })

  it('应该自动计算每行的持续时间', () => {
    const lrc = `[00:00.00]第一行
[00:04.00]第二行
[00:08.00]第三行`

    const lines = parseLrcText(lrc)
    expect(lines[0].duration).toBeCloseTo(4, 0)
    expect(lines[1].duration).toBeCloseTo(4, 0)
    expect(lines[2].duration).toBeGreaterThan(0)
  })

  it('应该按时间排序歌词行', () => {
    const lrc = `[00:10.00]第三行
[00:00.00]第一行
[00:05.00]第二行`

    const lines = parseLrcText(lrc)
    expect(lines[0].t).toBeLessThan(lines[1].t)
    expect(lines[1].t).toBeLessThan(lines[2].t)
  })
})

describe('LyricEngine - YRC 逐字歌词解析', () => {
  it('应该正确解析 YRC 格式', () => {
    const yrc = `[500,3000](500,500,0)第(1000,500,0)二(1500,500,0)句(2000,1000,0)歌`

    const lines = parseYrcText(yrc)
    expect(lines.length).toBe(1)
    expect(lines[0].t).toBeCloseTo(0.5, 2)
    expect(lines[0].duration).toBeCloseTo(3, 2)
    expect(lines[0].words).toBeDefined()
    expect(lines[0].words!.length).toBeGreaterThan(0)
    expect(lines[0].source).toBe('yrc-word')
  })

  it('应该处理没有逐字信息的 YRC 行', () => {
    const yrc = `[0,2000]普通歌词行`

    const lines = parseYrcText(yrc)
    expect(lines.length).toBe(1)
    expect(lines[0].t).toBe(0)
    expect(lines[0].text).toBe('普通歌词行')
    expect(lines[0].source).toBe('yrc-line')
  })

  it('应该处理空字符串', () => {
    expect(parseYrcText('').length).toBe(0)
    expect(parseYrcText('invalid').length).toBe(0)
  })

  it('逐字歌词应该有正确的字符索引', () => {
    const yrc = `[0,2000](0,500,0)你(500,500,0)好(1000,1000,0)吗`

    const lines = parseYrcText(yrc)
    expect(lines.length).toBe(1)
    const words = lines[0].words
    expect(words).toBeDefined()
    expect(words![0].c0).toBe(0)
    expect(words![0].text).toBe('你')
  })
})

describe('LyricEngine - 自定义歌词解析', () => {
  it('应该解析纯文本并转换为时间均匀分布的歌词', () => {
    const text = `First line
Second line
Third line
Fourth line
Fifth line`

    const lines = parseCustomLyricText(text, 25)
    expect(lines.length).toBe(5)
    expect(lines[0].source).toBe('custom-text')
    expect(lines[1].t).toBeGreaterThan(lines[0].t)
  })

  it('应该处理空文本', () => {
    expect(parseCustomLyricText('').length).toBe(0)
    expect(parseCustomLyricText('   \n  \n ').length).toBe(0)
  })

  it('只有符号的文本应该返回空', () => {
    const text = `!!!
@@@
###`
    expect(parseCustomLyricText(text).length).toBe(0)
  })
})

describe('LyricEngine - 时间轴计算', () => {
  const sampleLine: LyricLine = {
    t: 0,
    duration: 5,
    text: '测试歌词',
    charCount: 4,
    source: 'test',
  }

  it('应该正确找到当前歌词行索引', () => {
    const lines: LyricLine[] = [
      { t: 0, duration: 3, text: '第一行', charCount: 3, source: 'test' },
      { t: 3, duration: 3, text: '第二行', charCount: 3, source: 'test' },
      { t: 6, duration: 3, text: '第三行', charCount: 3, source: 'test' },
    ]

    expect(findCurrentLineIndex(lines, 0)).toBe(0)
    expect(findCurrentLineIndex(lines, 1.5)).toBe(0)
    expect(findCurrentLineIndex(lines, 3)).toBe(1)
    expect(findCurrentLineIndex(lines, 4.5)).toBe(1)
    expect(findCurrentLineIndex(lines, 10)).toBe(2)
    expect(findCurrentLineIndex(lines, -1)).toBe(-1)
  })

  it('应该计算歌词行进度 (0-1)', () => {
    const line: LyricLine = { ...sampleLine }
    const nextLine: LyricLine = { ...sampleLine, t: 5 }

    expect(getLyricLineProgress(line, nextLine, 0)).toBeCloseTo(0, 1)
    expect(getLyricLineProgress(line, nextLine, 2.5)).toBeGreaterThan(0)
    expect(getLyricLineProgress(line, nextLine, 4.9)).toBeLessThanOrEqual(1)
  })

  it('空行应该返回 0 进度', () => {
    expect(getLyricLineProgress(null, null, 0)).toBe(0)
  })

  it('逐字歌词应该按字计算进度', () => {
    const line: LyricLine = {
      t: 0,
      duration: 3,
      text: '你好世界',
      charCount: 4,
      source: 'test',
      words: [
        { text: '你', t: 0, d: 0.75, c0: 0, c1: 1 },
        { text: '好', t: 0.75, d: 0.75, c0: 1, c1: 2 },
        { text: '世', t: 1.5, d: 0.75, c0: 2, c1: 3 },
        { text: '界', t: 2.25, d: 0.75, c0: 3, c1: 4 },
      ],
    }

    const progressStart = getLyricLineProgress(line, null, 0.1)
    const progressMid = getLyricLineProgress(line, null, 1.6)
    const progressEnd = getLyricLineProgress(line, null, 3)

    expect(progressStart).toBeGreaterThan(0)
    expect(progressStart).toBeLessThan(0.5)
    expect(progressMid).toBeGreaterThan(0.4)
    expect(progressMid).toBeLessThan(0.9)
    expect(progressEnd).toBe(1)
  })
})

describe('LyricEngine - 克隆与工具函数', () => {
  it('应该深拷贝歌词行', () => {
    const original: LyricLine = {
      t: 0,
      duration: 5,
      text: '测试',
      charCount: 2,
      source: 'test',
      words: [{ text: '测', t: 0, d: 2.5, c0: 0, c1: 1 }],
    }

    const cloned = cloneLyricLine(original)
    expect(cloned).toEqual(original)
    expect(cloned.words).not.toBe(original.words)

    cloned.words![0].text = '修改'
    expect(original.words![0].text).toBe('测')
  })

  it('应该深拷贝歌词行数组', () => {
    const lines: LyricLine[] = [
      { t: 0, duration: 3, text: '第一行', charCount: 3, source: 'test' },
      { t: 3, duration: 3, text: '第二行', charCount: 3, source: 'test' },
    ]

    const cloned = cloneLyricLines(lines)
    expect(cloned.length).toBe(2)
    expect(cloned).not.toBe(lines)
  })

  it('应该创建 fallback 歌词', () => {
    const fallback = createFallbackLyric('暂无歌词', 5)
    expect(fallback.text).toBe('暂无歌词')
    expect(fallback.t).toBe(0)
    expect(fallback.fallback).toBe(true)
    expect(fallback.duration).toBe(5)
  })
})

describe('LyricEngine 类', () => {
  let engine: LyricEngine

  beforeEach(() => {
    engine = new LyricEngine()
  })

  it('应该初始化为空状态', () => {
    expect(engine.lines.length).toBe(0)
    expect(engine.currentLine).toBeNull()
    expect(engine.currentIndex).toBe(-1)
    expect(engine.timingSource).toBe('fallback')
    expect(engine.hasNativeKaraoke).toBe(false)
  })

  it('应该设置歌词并更新状态', () => {
    const lines: LyricLine[] = [
      { t: 0, duration: 3, text: '第一行', charCount: 3, source: 'test' },
      { t: 3, duration: 3, text: '第二行', charCount: 3, source: 'test' },
    ]

    engine.setLyrics(lines, false, 'test')
    expect(engine.lines.length).toBe(2)
    expect(engine.timingSource).toBe('test')
    expect(engine.hasNativeKaraoke).toBe(false)
  })

  it('update 应该更新当前行和进度', () => {
    const lines: LyricLine[] = [
      { t: 0, duration: 3, text: '第一行', charCount: 3, source: 'test' },
      { t: 3, duration: 3, text: '第二行', charCount: 3, source: 'test' },
    ]

    engine.setLyrics(lines)
    const result1 = engine.update(1)
    expect(result1.lineChanged).toBe(true)
    expect(engine.currentIndex).toBe(0)

    const result2 = engine.update(2)
    expect(result2.lineChanged).toBe(false)

    const result3 = engine.update(4)
    expect(result3.lineChanged).toBe(true)
    expect(engine.currentIndex).toBe(1)
  })

  it('应该正确解析 LRC', () => {
    const lrc = `[00:00.00]第一行
[00:03.00]第二行`

    const result = engine.parseLrc(lrc)
    expect(result.lines.length).toBe(2)
    expect(result.timingSource).toBe('lrc')
    expect(result.hasNativeKaraoke).toBe(false)
  })

  it('应该正确解析 YRC', () => {
    const yrc = `[0,3000](0,1000,0)第(1000,1000,0)二(2000,1000,0)行`

    const result = engine.parseYrc(yrc)
    expect(result.lines.length).toBe(1)
    expect(result.hasNativeKaraoke).toBe(true)
  })

  it('clear 应该清空所有状态', () => {
    const lines: LyricLine[] = [
      { t: 0, duration: 3, text: '第一行', charCount: 3, source: 'test' },
    ]

    engine.setLyrics(lines)
    engine.update(1)
    expect(engine.currentIndex).toBe(0)

    engine.clear()
    expect(engine.lines.length).toBe(0)
    expect(engine.currentIndex).toBe(-1)
    expect(engine.timingSource).toBe('fallback')
  })
})
