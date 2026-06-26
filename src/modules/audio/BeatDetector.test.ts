import { describe, it, expect, beforeEach } from 'vitest'
import { BeatDetector } from './BeatDetector'

describe('BeatDetector', () => {
  let detector: BeatDetector

  beforeEach(() => {
    detector = new BeatDetector()
  })

  it('应该初始化为默认状态', () => {
    expect(detector.lastBeatTime).toBe(0)
    expect(detector.bpmEstimate).toBe(0)
  })

  it('检测到节拍时应该返回 true 并更新时间', () => {
    const result = detector.detectFromEnergy(0.8, 0.5, 1.0)
    expect(result).toBe(true)
    expect(detector.lastBeatTime).toBe(1.0)
  })

  it('低于阈值的能量不应该触发节拍', () => {
    detector.detectFromEnergy(0.8, 0.5, 1.0)
    const result = detector.detectFromEnergy(0.3, 0.5, 1.1)
    expect(result).toBe(false)
  })

  it('最小间隔内不应该重复触发节拍', () => {
    detector.detectFromEnergy(0.8, 0.5, 1.0)
    const result = detector.detectFromEnergy(0.9, 0.5, 1.1)
    expect(result).toBe(false)
  })

  it('超过最小间隔后应该能再次触发', () => {
    detector.detectFromEnergy(0.8, 0.5, 1.0)
    const result = detector.detectFromEnergy(0.9, 0.5, 1.5)
    expect(result).toBe(true)
    expect(detector.lastBeatTime).toBe(1.5)
  })

  it('应该根据历史节拍计算 BPM', () => {
    const baseTime = 0
    const interval = 0.5

    for (let i = 0; i < 10; i++) {
      detector.detectFromEnergy(0.8, 0.5, baseTime + i * interval)
    }

    const bpm = detector.bpmEstimate
    expect(bpm).toBeGreaterThan(100)
    expect(bpm).toBeLessThan(140)
  })

  it('节拍历史太少时 BPM 应该为 0', () => {
    detector.detectFromEnergy(0.8, 0.5, 1.0)
    expect(detector.bpmEstimate).toBe(0)
  })

  it('应该能够设置灵敏度', () => {
    detector.setSensitivity(1.5)
    const result1 = detector.detectFromEnergy(0.7, 0.5, 1.0)
    expect(result1).toBe(false)

    detector.reset()
    detector.setSensitivity(0.5)
    const result2 = detector.detectFromEnergy(0.8, 0.5, 1.5)
    expect(result2).toBe(true)
  })

  it('灵敏度应该被限制在有效范围内', () => {
    detector.setSensitivity(100)
    const result1 = detector.detectFromEnergy(0.8, 0.5, 1.0)
    expect(result1).toBe(true)

    detector.reset()
    detector.setSensitivity(-10)
    const result2 = detector.detectFromEnergy(0.4, 0.5, 1.0)
    expect(result2).toBe(true)
  })

  it('应该能够设置最小节拍间隔', () => {
    detector.setMinBeatInterval(0.5)
    detector.detectFromEnergy(0.8, 0.5, 1.0)

    const result1 = detector.detectFromEnergy(0.9, 0.5, 1.3)
    expect(result1).toBe(false)

    const result2 = detector.detectFromEnergy(0.9, 0.5, 1.6)
    expect(result2).toBe(true)
  })

  it('最小间隔应该被限制在有效范围内', () => {
    detector.setMinBeatInterval(10)
    expect(detector.detectFromEnergy(0.8, 0.5, 1.0)).toBe(true)
    expect(detector.detectFromEnergy(0.9, 0.5, 1.3)).toBe(false)
  })

  it('reset 应该重置所有状态', () => {
    for (let i = 0; i < 5; i++) {
      detector.detectFromEnergy(0.8, 0.5, i * 0.5)
    }

    expect(detector.lastBeatTime).toBeGreaterThan(0)
    expect(detector.bpmEstimate).toBeGreaterThan(0)

    detector.reset()

    expect(detector.lastBeatTime).toBe(0)
    expect(detector.bpmEstimate).toBe(0)
  })

  it('平均能量太低时不应该触发节拍', () => {
    const result = detector.detectFromEnergy(0.0001, 0.00005, 1.0)
    expect(result).toBe(false)
  })

  it('绝对能量太低时不应该触发节拍', () => {
    const result = detector.detectFromEnergy(0.05, 0.02, 1.0)
    expect(result).toBe(false)
  })

  it('应该维护节拍历史记录', () => {
    for (let i = 0; i < 30; i++) {
      detector.detectFromEnergy(0.8, 0.5, i * 0.5)
    }

    expect(detector.bpmEstimate).toBeGreaterThan(0)
  })
})
