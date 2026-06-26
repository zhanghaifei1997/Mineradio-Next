import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatTime,
  formatDuration,
  formatPlayCount,
  debounce,
  throttle,
  clamp,
  lerp,
  easeOutCubic,
  easeInOutCubic,
  randomBetween,
} from './index'

describe('时间格式化工具', () => {
  describe('formatTime', () => {
    it('应该正确格式化秒数为 mm:ss', () => {
      expect(formatTime(0)).toBe('0:00')
      expect(formatTime(5)).toBe('0:05')
      expect(formatTime(59)).toBe('0:59')
      expect(formatTime(60)).toBe('1:00')
      expect(formatTime(90)).toBe('1:30')
      expect(formatTime(3661)).toBe('61:01')
    })

    it('应该处理无效输入', () => {
      expect(formatTime(NaN)).toBe('0:00')
      expect(formatTime(0)).toBe('0:00')
      expect(formatTime(null as any)).toBe('0:00')
      expect(formatTime(undefined as any)).toBe('0:00')
    })
  })

  describe('formatDuration', () => {
    it('应该正确格式化毫秒为 mm:ss', () => {
      expect(formatDuration(0)).toBe('0:00')
      expect(formatDuration(5000)).toBe('0:05')
      expect(formatDuration(60000)).toBe('1:00')
      expect(formatDuration(90000)).toBe('1:30')
    })
  })

  describe('formatPlayCount', () => {
    it('应该格式化播放次数', () => {
      expect(formatPlayCount(0)).toBe('0')
      expect(formatPlayCount(999)).toBe('999')
      expect(formatPlayCount(1000)).toBe('1000')
    })

    it('应该格式化万级播放次数', () => {
      expect(formatPlayCount(10000)).toBe('1.0万')
      expect(formatPlayCount(15000)).toBe('1.5万')
      expect(formatPlayCount(99999)).toBe('10.0万')
    })

    it('应该格式化亿级播放次数', () => {
      expect(formatPlayCount(100000000)).toBe('1.0亿')
      expect(formatPlayCount(150000000)).toBe('1.5亿')
    })
  })
})

describe('防抖节流工具', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('debounce', () => {
    it('应该在延迟后执行函数', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该重置延迟时间', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced()
      vi.advanceTimersByTime(50)
      debounced()
      vi.advanceTimersByTime(50)

      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(50)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该传递参数', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)

      debounced('arg1', 123)
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledWith('arg1', 123)
    })
  })

  describe('throttle', () => {
    it('应该在延迟内只执行一次', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      throttled()
      throttled()

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在延迟后可以再次执行', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled()
      expect(fn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      throttled()
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该传递参数', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)

      throttled('arg1', 123)
      expect(fn).toHaveBeenCalledWith('arg1', 123)
    })
  })
})

describe('数学工具函数', () => {
  describe('clamp', () => {
    it('应该将值限制在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-1, 0, 10)).toBe(0)
      expect(clamp(11, 0, 10)).toBe(10)
      expect(clamp(0, 0, 10)).toBe(0)
      expect(clamp(10, 0, 10)).toBe(10)
    })
  })

  describe('lerp', () => {
    it('应该进行线性插值', () => {
      expect(lerp(0, 100, 0)).toBe(0)
      expect(lerp(0, 100, 0.5)).toBe(50)
      expect(lerp(0, 100, 1)).toBe(100)
      expect(lerp(10, 20, 0.3)).toBeCloseTo(13, 5)
    })
  })

  describe('easeOutCubic', () => {
    it('应该返回缓出立方值', () => {
      expect(easeOutCubic(0)).toBe(0)
      expect(easeOutCubic(1)).toBe(1)
      expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
    })
  })

  describe('easeInOutCubic', () => {
    it('应该返回缓入缓出立方值', () => {
      expect(easeInOutCubic(0)).toBe(0)
      expect(easeInOutCubic(1)).toBe(1)
      expect(easeInOutCubic(0.5)).toBe(0.5)
    })

    it('应该在起点缓慢加速', () => {
      const v1 = easeInOutCubic(0.1)
      const v2 = easeInOutCubic(0.2)
      const v3 = easeInOutCubic(0.4)
      const v4 = easeInOutCubic(0.5)

      expect(v1).toBeLessThan(0.1)
      expect(v4).toBe(0.5)
      expect(v3 - v2).toBeGreaterThan(v2 - v1)
    })
  })

  describe('randomBetween', () => {
    it('应该返回指定范围内的随机数', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(randomBetween(10, 20)).toBe(10)

      vi.spyOn(Math, 'random').mockReturnValue(1)
      expect(randomBetween(10, 20)).toBe(20)

      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      expect(randomBetween(10, 20)).toBe(15)

      vi.restoreAllMocks()
    })
  })
})
