import { useImmersiveStore } from '@/stores/immersive'
import { useFxStore } from '@/stores/fx'

/**
 * 面板 Peek 半隐藏系统
 *
 * 对齐原项目的 setPeek(el, on, key) 行为：统一管理 search / fx / playlist 三个面板的
 * 半隐藏状态。
 *
 * 触发规则：
 * - 进入触发区：立即显示
 * - 离开触发区：延迟 PEEK_HIDE_DELAY 后隐藏
 * - peekTimers 三键独立计时
 *
 * 守卫：
 * - immersiveMode 时不 peek search / fx（沉浸模式整体隐藏面板）
 * - diyPlayerMode 关闭时影响 fx 面板（simple 模式没有视觉控制台）
 * - emptyHomeActive 时不 peek 搜索面板（首页为空时搜索栏始终可见）
 * - playlistPanelPinned 时不 peek 歌单面板
 *
 * 半隐藏效果：
 * - 通过给 document.body 添加 `peek-<key>-hidden` 类实现
 * - CSS 中根据该类对相应面板做 transform 位移 + 透明度降低
 * - 鼠标移入面板时移除该类（恢复显示）
 */
export type PeekKey = 'search' | 'fx' | 'playlist'

const PEEK_HIDE_DELAY = 170

const VALID_KEYS: ReadonlySet<PeekKey> = new Set<PeekKey>(['search', 'fx', 'playlist'])

/**
 * body 上加/移除的类名：peek-<key>-hidden 表示面板被半隐藏
 */
function hiddenClassName(key: PeekKey): string {
  return `peek-${key}-hidden`
}

/**
 * 检查歌单面板是否处于 pinned 状态（不在 fx store 中暴露 setter，这里读 DOM 属性兜底）。
 * 新项目的 pinned 状态由 fx.queuePinned 标识，等同原项目的 playlistPanelPinned。
 */
function isPlaylistPinned(): boolean {
  // fx.queuePinned 在 fx store 上是可读的；这里延迟读取避免循环依赖
  try {
    return useFxStore().queuePinned
  } catch (_) {
    return false
  }
}

/**
 * 检查首页是否处于"空首页"状态（无歌曲播放时首页强制展示）。
 * HomePanel.vue 会在 body 上加 empty-home-active 类，这里读取该状态。
 */
function isEmptyHomeActive(): boolean {
  if (typeof document === 'undefined') return false
  return document.body.classList.contains('empty-home-active')
}

export interface PanelPeekAPI {
  /**
   * 设置面板的 peek 状态。
   * - on=true：立即显示面板（移除 hidden 类）
   * - on=false：延迟 PEEK_HIDE_DELAY 后半隐藏面板（加 hidden 类）
   *
   * 各 key 的守卫见模块说明。
   */
  setPeek: (key: PeekKey, on: boolean) => void
  /** 当前 key 是否处于半隐藏状态 */
  isHidden: (key: PeekKey) => boolean
  /** 强制立即半隐藏（清掉挂起的显示计时） */
  hideNow: (key: PeekKey) => void
  /** 强制立即显示（清掉挂起的隐藏计时） */
  showNow: (key: PeekKey) => void
  /** 清理所有计时器（组件卸载时调用） */
  cleanup: () => void
}

export function usePanelPeek(): PanelPeekAPI {
  const peekTimers: Partial<Record<PeekKey, ReturnType<typeof setTimeout>>> = {}

  function clearTimer(key: PeekKey) {
    const t = peekTimers[key]
    if (t) {
      clearTimeout(t)
      delete peekTimers[key]
    }
  }

  function setPeek(key: PeekKey, on: boolean) {
    if (!VALID_KEYS.has(key)) return
    if (typeof document === 'undefined' || !document.body) return

    const immersive = useImmersiveStore()
    const fx = useFxStore()

    // 守卫：沉浸模式下不 peek search / fx
    if (on && immersive.isImmersive && (key === 'search' || key === 'fx')) return
    // 守卫：simple 模式（非 diy）下不 peek fx
    if (on && key === 'fx' && fx.layoutMode !== 'diy') return
    // 守卫：空首页激活时，搜索面板不允许半隐藏
    if (!on && key === 'search' && isEmptyHomeActive() && !immersive.isImmersive) return
    // 守卫：歌单面板 pinned 时不半隐藏
    if (!on && key === 'playlist' && isPlaylistPinned()) return

    if (on) {
      // 立即显示
      clearTimer(key)
      document.body.classList.remove(hiddenClassName(key))
    } else {
      // 延迟半隐藏
      clearTimer(key)
      peekTimers[key] = setTimeout(() => {
        delete peekTimers[key]
        if (typeof document === 'undefined' || !document.body) return
        document.body.classList.add(hiddenClassName(key))
      }, PEEK_HIDE_DELAY)
    }
  }

  function isHidden(key: PeekKey): boolean {
    if (typeof document === 'undefined' || !document.body) return false
    return document.body.classList.contains(hiddenClassName(key))
  }

  function hideNow(key: PeekKey) {
    if (!VALID_KEYS.has(key)) return
    clearTimer(key)
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add(hiddenClassName(key))
    }
  }

  function showNow(key: PeekKey) {
    if (!VALID_KEYS.has(key)) return
    clearTimer(key)
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove(hiddenClassName(key))
    }
  }

  function cleanup() {
    for (const key of Object.keys(peekTimers) as PeekKey[]) {
      clearTimer(key)
    }
  }

  return {
    setPeek,
    isHidden,
    hideNow,
    showNow,
    cleanup,
  }
}
