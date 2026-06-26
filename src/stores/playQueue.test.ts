import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { playQueueStore } from './playQueue'
import type { Song } from '@/types'

function createMockSong(id: string, name: string = `Song ${id}`): Song {
  return {
    id,
    name,
    artists: [{ id: 'a1', name: 'Artist' }],
    duration: 200,
    source: 'test',
  }
}

describe('playQueue store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('初始状态', () => {
    it('应该初始化为空队列', () => {
      const store = playQueueStore()
      expect(store.isEmpty).toBe(true)
      expect(store.total).toBe(0)
      expect(store.currentIndex).toBe(-1)
      expect(store.currentSong).toBeNull()
    })

    it('空队列没有上一首/下一首', () => {
      const store = playQueueStore()
      expect(store.hasNext).toBe(false)
      expect(store.hasPrev).toBe(false)
    })
  })

  describe('设置队列', () => {
    it('应该设置队列并从指定索引开始', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]

      store.setQueue(songs, 1)

      expect(store.total).toBe(3)
      expect(store.currentIndex).toBe(1)
      expect(store.currentSong?.id).toBe('2')
    })

    it('setQueue 应该清空历史记录', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]

      store.setQueue(songs, 0)
      store.getNext()
      expect(store.history.length).toBeGreaterThan(0)

      store.setQueue(songs, 0)
      expect(store.history.length).toBe(0)
    })
  })

  describe('添加歌曲', () => {
    it('应该添加单首歌曲到队列末尾', () => {
      const store = playQueueStore()
      const song = createMockSong('1')

      store.addToQueue(song)

      expect(store.total).toBe(1)
      expect(store.queue[0].id).toBe('1')
    })

    it('应该添加歌曲列表到队列末尾', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]

      store.addListToQueue(songs)

      expect(store.total).toBe(2)
      expect(store.queue[0].id).toBe('1')
      expect(store.queue[1].id).toBe('2')
    })

    it('应该插入到下一首位置', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('3')]
      store.setQueue(songs, 0)

      store.insertNext(createMockSong('2'))

      expect(store.total).toBe(3)
      expect(store.queue[1].id).toBe('2')
      expect(store.currentIndex).toBe(0)
    })
  })

  describe('删除歌曲', () => {
    it('应该删除指定索引的歌曲', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      store.removeFromQueue(1)

      expect(store.total).toBe(2)
      expect(store.queue[0].id).toBe('1')
      expect(store.queue[1].id).toBe('3')
    })

    it('删除当前索引之前的歌曲应该调整 currentIndex', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 2)

      store.removeFromQueue(0)

      expect(store.currentIndex).toBe(1)
      expect(store.currentSong?.id).toBe('3')
    })

    it('删除当前播放歌曲应该调整到有效索引', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 1)

      store.removeFromQueue(1)

      expect(store.currentIndex).toBeLessThan(store.total)
      expect(store.currentIndex).toBeGreaterThanOrEqual(0)
    })

    it('无效索引不应该做任何操作', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1')]
      store.setQueue(songs, 0)

      store.removeFromQueue(-1)
      store.removeFromQueue(100)

      expect(store.total).toBe(1)
    })
  })

  describe('清空队列', () => {
    it('应该清空整个队列', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]
      store.setQueue(songs, 0)

      store.clearQueue()

      expect(store.isEmpty).toBe(true)
      expect(store.currentIndex).toBe(-1)
      expect(store.currentSong).toBeNull()
    })
  })

  describe('顺序播放模式', () => {
    it('getNext 应该播放下一首', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      const next = store.getNext('sequence')

      expect(next?.id).toBe('2')
      expect(store.currentIndex).toBe(1)
    })

    it('到达队列末尾时 getNext 应该返回 null', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]
      store.setQueue(songs, 1)

      const next = store.getNext('sequence')

      expect(next).toBeNull()
    })

    it('getPrev 应该播放上一首', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 2)

      const prev = store.getPrev('sequence')

      expect(prev?.id).toBe('2')
      expect(store.currentIndex).toBe(1)
    })

    it('在第一首时 getPrev 应该尝试从历史记录获取', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 2)

      store.getPrev('sequence')
      store.getPrev('sequence')
      expect(store.currentIndex).toBe(0)

      const prev = store.getPrev('sequence')
      expect(store.currentIndex).toBe(0)
    })
  })

  describe('循环播放模式', () => {
    it('getNext 应该循环到队列开头', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 2)

      const next = store.getNext('loop')

      expect(next?.id).toBe('1')
      expect(store.currentIndex).toBe(0)
    })

    it('getPrev 应该循环到队列末尾', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      const prev = store.getPrev('loop')

      expect(prev?.id).toBe('3')
      expect(store.currentIndex).toBe(2)
    })
  })

  describe('随机播放模式', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('getNext shuffle 应该返回有效歌曲', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      const next = store.getNext('shuffle')

      expect(next).not.toBeNull()
      expect(next!.id).toMatch(/[123]/)
    })

    it('getPrev shuffle 应该返回有效歌曲', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      const prev = store.getPrev('shuffle')

      expect(prev).not.toBeNull()
    })

    it('reshuffle 应该重新生成随机顺序', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      const originalOrder = [...store.queue]
      store.reshuffle()

      expect(store.queue.length).toBe(3)
    })
  })

  describe('跳转播放', () => {
    it('setCurrentIndex 应该跳转到指定索引', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      store.setCurrentIndex(2)

      expect(store.currentIndex).toBe(2)
      expect(store.currentSong?.id).toBe('3')
    })

    it('无效索引应该被忽略', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1')]
      store.setQueue(songs, 0)

      store.setCurrentIndex(-1)
      expect(store.currentIndex).toBe(0)

      store.setCurrentIndex(100)
      expect(store.currentIndex).toBe(0)
    })

    it('playAt 应该返回对应歌曲', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]
      store.setQueue(songs, 0)

      const song = store.playAt(1)

      expect(song?.id).toBe('2')
      expect(store.currentIndex).toBe(1)
    })
  })

  describe('拖拽排序', () => {
    it('move 应该移动歌曲位置', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      store.move(0, 2)

      expect(store.queue[0].id).toBe('2')
      expect(store.queue[1].id).toBe('3')
      expect(store.queue[2].id).toBe('1')
    })

    it('移动当前播放歌曲应该更新 currentIndex', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      store.move(0, 2)

      expect(store.currentIndex).toBe(2)
    })

    it('向后移动经过 currentIndex 时应该调整', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 1)

      store.move(0, 2)

      expect(store.currentIndex).toBe(0)
    })

    it('向前移动经过 currentIndex 时应该调整', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 1)

      store.move(2, 0)

      expect(store.currentIndex).toBe(2)
    })

    it('无效索引不应该做任何操作', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]
      store.setQueue(songs, 0)

      store.move(-1, 1)
      store.move(0, 100)

      expect(store.queue[0].id).toBe('1')
      expect(store.queue[1].id).toBe('2')
    })
  })

  describe('历史记录', () => {
    it('切换歌曲应该添加到历史记录', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2'), createMockSong('3')]
      store.setQueue(songs, 0)

      store.getNext()
      store.getNext()

      expect(store.history.length).toBe(2)
      expect(store.history[0].id).toBe('2')
    })

    it('历史记录应该有大小限制', () => {
      const store = playQueueStore()
      const songs: Song[] = []
      for (let i = 0; i < 100; i++) {
        songs.push(createMockSong(String(i)))
      }
      store.setQueue(songs, 0)

      for (let i = 0; i < 80; i++) {
        store.getNext()
      }

      expect(store.history.length).toBeLessThanOrEqual(50)
    })

    it('clearHistory 应该清空历史记录', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]
      store.setQueue(songs, 0)

      store.getNext()
      expect(store.history.length).toBeGreaterThan(0)

      store.clearHistory()
      expect(store.history.length).toBe(0)
    })
  })

  describe('查询方法', () => {
    it('indexOf 应该返回歌曲索引', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1'), createMockSong('2')]
      store.setQueue(songs, 0)

      expect(store.indexOf('2')).toBe(1)
      expect(store.indexOf('999')).toBe(-1)
    })

    it('contains 应该检查歌曲是否在队列中', () => {
      const store = playQueueStore()
      const songs = [createMockSong('1')]
      store.setQueue(songs, 0)

      expect(store.contains('1')).toBe(true)
      expect(store.contains('999')).toBe(false)
    })
  })
})
