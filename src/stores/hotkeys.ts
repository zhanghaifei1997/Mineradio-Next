import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from './player'

export type HotkeyAction =
  | 'toggle-play'
  | 'prev'
  | 'next'
  | 'volume-up'
  | 'volume-down'
  | 'toggle-main-window'
  | 'toggle-desktop-lyrics'
  | 'toggle-desktop-lyrics-lock'
  | 'toggle-favorite'

export interface HotkeyConfig {
  action: HotkeyAction
  accelerator: string
  enabled: boolean
}

export interface HotkeyConflict {
  action: HotkeyAction
  accelerator: string
  conflictAction: HotkeyAction
}

const STORAGE_KEY = 'mineradio-hotkey-settings-v1'
const STORAGE_KEY_LEGACY = 'mineradio_hotkeys'

const DEFAULT_HOTKEYS: HotkeyConfig[] = [
  { action: 'toggle-play', accelerator: 'Ctrl+Alt+Space', enabled: true },
  { action: 'prev', accelerator: 'Ctrl+Alt+Left', enabled: true },
  { action: 'next', accelerator: 'Ctrl+Alt+Right', enabled: true },
  { action: 'volume-up', accelerator: 'Ctrl+Alt+Up', enabled: true },
  { action: 'volume-down', accelerator: 'Ctrl+Alt+Down', enabled: true },
  { action: 'toggle-main-window', accelerator: 'Ctrl+Alt+M', enabled: true },
  { action: 'toggle-desktop-lyrics', accelerator: 'Ctrl+Alt+L', enabled: true },
  { action: 'toggle-desktop-lyrics-lock', accelerator: 'Ctrl+Alt+K', enabled: true },
  { action: 'toggle-favorite', accelerator: 'Ctrl+Alt+S', enabled: true },
]

export const useHotkeysStore = defineStore('hotkeys', () => {
  const hotkeys = ref<HotkeyConfig[]>(loadHotkeys())
  const globalEnabled = ref(true)
  const recordingAction = ref<HotkeyAction | null>(null)
  const arrowKeyVolumeEnabled = ref(true)

  const enabledHotkeys = computed(() => hotkeys.value.filter((h) => h.enabled))

  function loadHotkeys(): HotkeyConfig[] {
    try {
      let raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        raw = localStorage.getItem(STORAGE_KEY_LEGACY)
        if (raw) {
          // 迁移旧数据到新键名
          localStorage.setItem(STORAGE_KEY, raw)
          try {
            localStorage.removeItem(STORAGE_KEY_LEGACY)
          } catch (_) {}
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw)
        return mergeWithDefaults(parsed)
      }
    } catch (e) {
      console.warn('Failed to load hotkeys:', e)
    }
    return [...DEFAULT_HOTKEYS]
  }

  function mergeWithDefaults(saved: HotkeyConfig[]): HotkeyConfig[] {
    const result: HotkeyConfig[] = []
    const savedMap = new Map(saved.map((h) => [h.action, h]))

    for (const defaultKey of DEFAULT_HOTKEYS) {
      const savedKey = savedMap.get(defaultKey.action)
      if (savedKey) {
        result.push({ ...defaultKey, ...savedKey })
      } else {
        result.push({ ...defaultKey })
      }
    }

    return result
  }

  function save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hotkeys.value))
    } catch (e) {
      console.warn('Failed to save hotkeys:', e)
    }
  }

  function getHotkey(action: HotkeyAction): HotkeyConfig | undefined {
    return hotkeys.value.find((h) => h.action === action)
  }

  function getAccelerator(action: HotkeyAction): string {
    return getHotkey(action)?.accelerator || ''
  }

  function setHotkey(action: HotkeyAction, accelerator: string): boolean {
    const conflict = checkConflict(accelerator, action)
    if (conflict) {
      return false
    }

    const hotkey = hotkeys.value.find((h) => h.action === action)
    if (hotkey) {
      hotkey.accelerator = accelerator
      save()
      registerAllHotkeys()
      return true
    }
    return false
  }

  function setEnabled(action: HotkeyAction, enabled: boolean): void {
    const hotkey = hotkeys.value.find((h) => h.action === action)
    if (hotkey) {
      hotkey.enabled = enabled
      save()
      registerAllHotkeys()
    }
  }

  function setGlobalEnabled(enabled: boolean): void {
    globalEnabled.value = enabled
    save()
    registerAllHotkeys()
  }

  function checkConflict(accelerator: string, excludeAction?: HotkeyAction): HotkeyConflict | null {
    const normalized = normalizeAccelerator(accelerator)
    const existing = hotkeys.value.find(
      (h) => normalizeAccelerator(h.accelerator) === normalized && h.action !== excludeAction
    )
    if (existing) {
      return {
        action: excludeAction || ('toggle-play' as HotkeyAction),
        accelerator,
        conflictAction: existing.action,
      }
    }
    return null
  }

  function normalizeAccelerator(accel: string): string {
    const parts = accel.toLowerCase().split('+').map((s) => s.trim()).sort()
    return parts.join('+')
  }

  function resetToDefaults(): void {
    hotkeys.value = [...DEFAULT_HOTKEYS]
    globalEnabled.value = true
    save()
    registerAllHotkeys()
  }

  function startRecording(action: HotkeyAction): void {
    recordingAction.value = action
  }

  function stopRecording(): void {
    recordingAction.value = null
  }

  function handleRecordedKey(event: KeyboardEvent): { success: boolean; conflict?: HotkeyConflict } {
    if (!recordingAction.value) return { success: false }

    const accelerator = eventToAccelerator(event)
    if (!accelerator) return { success: false }

    const conflict = checkConflict(accelerator, recordingAction.value)
    if (conflict) {
      return { success: false, conflict }
    }

    const success = setHotkey(recordingAction.value, accelerator)
    recordingAction.value = null
    return { success }
  }

  function eventToAccelerator(event: KeyboardEvent): string {
    const parts: string[] = []

    if (event.ctrlKey || event.metaKey) {
      parts.push('Ctrl')
    }
    if (event.altKey) {
      parts.push('Alt')
    }
    if (event.shiftKey) {
      parts.push('Shift')
    }

    const key = normalizeKey(event.key)
    if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
      parts.push(key)
    }

    if (parts.length < 2) return ''

    return parts.join('+')
  }

  function normalizeKey(key: string): string {
    const keyMap: Record<string, string> = {
      ' ': 'Space',
      ArrowUp: 'Up',
      ArrowDown: 'Down',
      ArrowLeft: 'Left',
      ArrowRight: 'Right',
      Escape: 'Esc',
      Enter: 'Enter',
      Backspace: 'Backspace',
      Tab: 'Tab',
    }
    return keyMap[key] || key.toUpperCase()
  }

  async function registerAllHotkeys(): Promise<void> {
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.hotkeys?.configure) return

    const bindings = globalEnabled.value
      ? enabledHotkeys.value.map((h) => ({ action: h.action, accelerator: h.accelerator }))
      : []

    try {
      await electronAPI.hotkeys.configure(bindings)
    } catch (e) {
      console.warn('Failed to register global hotkeys:', e)
    }
  }

  function setupGlobalHotkeyListener(): void {
    const electronAPI = (window as any).electronAPI
    if (!electronAPI?.onGlobalHotkey) return

    electronAPI.onGlobalHotkey((data: { action: string }) => {
      if (!globalEnabled.value) return
      executeAction(data.action as HotkeyAction)
    })
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) return false
    const tagName = target.tagName.toLowerCase()
    if (['input', 'textarea', 'select'].includes(tagName)) return true
    if (target.isContentEditable) return true
    return false
  }

  function handleArrowKeyVolume(e: KeyboardEvent): void {
    if (!arrowKeyVolumeEnabled.value) return
    if (!globalEnabled.value) return
    if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return
    if (isEditableTarget(e.target)) return

    const player = usePlayerStore()
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      player.setVolume(Math.min(1, player.volume + 0.05))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      player.setVolume(Math.max(0, player.volume - 0.05))
    }
  }

  function setArrowKeyVolumeEnabled(enabled: boolean): void {
    arrowKeyVolumeEnabled.value = enabled
  }

  function executeAction(action: HotkeyAction): void {
    const player = usePlayerStore()

    switch (action) {
      case 'toggle-play':
        player.togglePlay()
        break
      case 'prev':
        player.prev()
        break
      case 'next':
        player.next()
        break
      case 'volume-up':
        player.setVolume(Math.min(1, player.volume + 0.05))
        break
      case 'volume-down':
        player.setVolume(Math.max(0, player.volume - 0.05))
        break
      case 'toggle-main-window':
        toggleMainWindow()
        break
      case 'toggle-desktop-lyrics':
        toggleDesktopLyrics()
        break
      case 'toggle-desktop-lyrics-lock':
        toggleDesktopLyricsLock()
        break
      case 'toggle-favorite':
        toggleFavorite()
        break
    }
  }

  function toggleMainWindow(): void {
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.window?.getState) {
      electronAPI.window.getState().then((state: any) => {
        if (state?.isVisible) {
          electronAPI.window.minimize()
        } else {
          electronAPI.window.show?.()
        }
      })
    }
  }

  function toggleDesktopLyrics(): void {
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.desktopLyrics) {
      electronAPI.desktopLyrics.getState().then((state: any) => {
        if (state?.enabled) {
          electronAPI.desktopLyrics.hide()
        } else {
          electronAPI.desktopLyrics.show()
        }
      })
    }
  }

  function toggleDesktopLyricsLock(): void {
    const electronAPI = (window as any).electronAPI
    if (electronAPI?.app?.toggleDesktopLyricsLock) {
      electronAPI.app.toggleDesktopLyricsLock()
    } else if (electronAPI?.desktopLyrics) {
      electronAPI.desktopLyrics.getState().then((state: any) => {
        const currentlyLocked = state?.clickThrough !== false
        electronAPI.desktopLyrics.setLock(!currentlyLocked)
      })
    }
  }

  function toggleFavorite(): void {
    // TODO: 集成到用户喜欢的歌曲功能
  }

  function getActionName(action: HotkeyAction): string {
    const names: Record<HotkeyAction, string> = {
      'toggle-play': '播放/暂停',
      prev: '上一首',
      next: '下一首',
      'volume-up': '音量加',
      'volume-down': '音量减',
      'toggle-main-window': '显示/隐藏主窗口',
      'toggle-desktop-lyrics': '桌面歌词开关',
      'toggle-desktop-lyrics-lock': '桌面歌词锁定切换',
      'toggle-favorite': '喜欢/取消喜欢',
    }
    return names[action] || action
  }

  function init(): void {
    setupGlobalHotkeyListener()
    registerAllHotkeys()
    window.addEventListener('keydown', handleArrowKeyVolume)
  }

  function cleanup(): void {
    window.removeEventListener('keydown', handleArrowKeyVolume)
  }

  return {
    hotkeys,
    globalEnabled,
    recordingAction,
    arrowKeyVolumeEnabled,
    enabledHotkeys,
    getHotkey,
    getAccelerator,
    setHotkey,
    setEnabled,
    setGlobalEnabled,
    setArrowKeyVolumeEnabled,
    checkConflict,
    resetToDefaults,
    startRecording,
    stopRecording,
    handleRecordedKey,
    getActionName,
    init,
    cleanup,
    registerAllHotkeys,
  }
})
