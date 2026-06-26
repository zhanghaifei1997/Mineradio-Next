import { onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { useImmersiveStore } from '@/stores/immersive'

/**
 * 内嵌快捷键回调集合。
 * 这些动作依赖 App.vue 中的局部 ref 状态（模态/面板开关），由 App.vue 注入实现。
 */
export interface InlineHotkeysOptions {
  /** 回到首页 / 切换首页面板 */
  goHome?: () => void
  /** 关闭所有打开的模态/侧边面板 */
  closeAllPanels?: () => void
  /** 打开/关闭歌词设置面板（KeyL） */
  toggleLyricsPanel?: () => void
  /** 打开/关闭 FX 视觉控制台（KeyP，仅 DIY 模式） */
  toggleFxConsole?: () => void
}

/**
 * 判断事件目标是否为可输入元素，避免快捷键与输入框冲突。
 */
function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

/**
 * 内嵌快捷键系统。
 *
 * 对齐原项目的全局 keydown 行为：
 * - Space        播放/暂停
 * - Home         回到首页
 * - ArrowUp/Down 音量 ±0.05（仍由 hotkeys store 的 handleArrowKeyVolume 处理）
 * - ArrowRight   下一首
 * - ArrowLeft    上一首
 * - Escape       关闭所有打开的模态/面板（含沉浸、全屏等）
 * - KeyL         歌词面板开关（沉浸模式下禁用）
 * - KeyP         FX 视觉控制台（仅 DIY 模式）
 * - KeyI         沉浸模式切换
 * - KeyF         全屏切换
 *
 * 守卫：
 * - 输入框聚焦时（input/textarea/select/contentEditable）不触发
 * - 带修饰键（Ctrl/Alt/Meta）交给全局热键等其它处理器
 * - 自由相机模式下，仅放行 Escape；其余键交给相机系统处理
 */
export function useInlineHotkeys(options: InlineHotkeysOptions = {}) {
  function handleKeydown(e: KeyboardEvent) {
    if (isTypingTarget(e)) return
    // 带修饰键的组合不在此处理（避免与全局热键、浏览器快捷键冲突）
    if (e.ctrlKey || e.altKey || e.metaKey) return

    const fx = useFxStore()
    const immersive = useImmersiveStore()

    // 自由相机模式下 WASD/QE/方向键等交给相机系统处理；Escape 仍然允许退出
    if (fx.freeCameraEnabled && e.code !== 'Escape') {
      // Space 在自由相机下原项目仅 preventDefault，不切换播放
      if (e.code === 'Space') {
        e.preventDefault()
      }
      return
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault()
        usePlayerStore().togglePlay()
        break
      case 'Home':
        e.preventDefault()
        options.goHome?.()
        break
      case 'ArrowRight':
        // 对齐原项目：不 preventDefault
        usePlayerStore().next()
        break
      case 'ArrowLeft':
        usePlayerStore().prev()
        break
      case 'Escape':
        // 沉浸模式优先退出
        if (immersive.isImmersive) {
          e.preventDefault()
          immersive.exit()
          break
        }
        // 浏览器全屏优先退出
        if (document.fullscreenElement) {
          e.preventDefault()
          document.exitFullscreen().catch(() => {})
          break
        }
        options.closeAllPanels?.()
        break
      case 'KeyL':
        // 沉浸模式下不切换歌词面板
        if (immersive.isImmersive) return
        if (options.toggleLyricsPanel) {
          options.toggleLyricsPanel()
        } else {
          useLyricsStore().toggleStageLyrics()
        }
        break
      case 'KeyP':
        // 沉浸模式下不打开 FX 控制台；仅 DIY 模式可用
        if (immersive.isImmersive) return
        if (fx.layoutMode === 'diy') {
          options.toggleFxConsole?.()
        }
        break
      case 'KeyI':
        immersive.toggle()
        break
      case 'KeyF':
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        } else if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {})
        }
        break
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
}
