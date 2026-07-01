/**
 * 桌面控制服务
 * 封装窗口管理、系统托盘、快捷键等桌面级功能
 * 对应 legacy/public/tauri-adapter.js 的 window.desktopWindow 接口
 */
import { tauriInvoke, tauriInvokeSafe } from './api'
import { listen } from '@tauri-apps/api/event'
import type { WindowState, HotkeyBinding, LoginResult } from '@/types'

// ── 窗口控制 ──────────────────────────────────────────────

export const desktop = {
  /** 最小化窗口 */
  minimize: () => tauriInvokeSafe('window_minimize'),

  /** 切换最大化 */
  toggleMaximize: () => tauriInvokeSafe('window_toggle_maximize'),

  /** 切换全屏 */
  toggleFullscreen: () => tauriInvokeSafe('window_toggle_fullscreen'),

  /** 退出全屏但保持窗口 */
  exitFullscreenWindowed: () => tauriInvokeSafe('window_exit_fullscreen_windowed'),

  /** 获取窗口状态 */
  getState: () => tauriInvoke<WindowState>('window_get_state'),

  /** 关闭窗口（可能最小化到托盘） */
  close: () => tauriInvokeSafe('window_close'),

  // ── 登录 ────────────────────────────────────────────────

  /** 打开网易云扫码登录 */
  openNeteaseLogin: async (): Promise<LoginResult> => {
    const openPromise = tauriInvokeSafe<LoginResult>('open_netease_login')

    return new Promise((resolve, reject) => {
      let settled = false
      let unlisten: (() => void) | null = null

      // 监听后端发出的 cookie 事件
      listen<LoginResult>('netease-login-cookie', (event) => {
        if (settled) return
        settled = true
        unlisten?.()
        resolve(event.payload)
      }).then((fn) => { unlisten = fn }).catch(() => {})

      // 也从 invoke 返回值获取
      openPromise.then((result) => {
        if (result?.cookie && !settled) {
          settled = true
          unlisten?.()
          resolve(result)
        }
      }).catch((err) => {
        if (!settled) {
          settled = true
          unlisten?.()
          reject(err)
        }
      })

      // 5 分钟超时
      setTimeout(() => {
        if (!settled) {
          settled = true
          unlisten?.()
          reject(new Error('Netease login timed out'))
        }
      }, 300000)
    })
  },

  /** 清除网易云登录窗口 */
  clearNeteaseLogin: () => tauriInvokeSafe('clear_netease_login'),

  /** 打开 QQ 音乐扫码登录 */
  openQQLogin: async (): Promise<LoginResult> => {
    const openPromise = tauriInvokeSafe<LoginResult>('open_qq_login')

    return new Promise((resolve, reject) => {
      let settled = false
      let unlisten: (() => void) | null = null

      listen<LoginResult>('qq-login-cookie', (event) => {
        if (settled) return
        settled = true
        unlisten?.()
        resolve(event.payload)
      }).then((fn) => { unlisten = fn }).catch(() => {})

      openPromise.then((result) => {
        if (result?.cookie && !settled) {
          settled = true
          unlisten?.()
          resolve(result)
        }
      }).catch((err) => {
        if (!settled) {
          settled = true
          unlisten?.()
          reject(err)
        }
      })

      setTimeout(() => {
        if (!settled) {
          settled = true
          unlisten?.()
          reject(new Error('QQ login timed out'))
        }
      }, 300000)
    })
  },

  /** 清除 QQ 登录窗口 */
  clearQQLogin: () => tauriInvokeSafe('clear_qq_login'),

  // ── 快捷键 ──────────────────────────────────────────────

  /** 配置全局快捷键 */
  configureHotkeys: (bindings: HotkeyBinding[]) =>
    tauriInvokeSafe('configure_global_hotkeys', { bindings }),

  /** 监听全局快捷键事件 */
  onGlobalHotkey: (callback: (payload: { action: string }) => void) => {
    let unlisten: (() => void) | null = null
    listen<{ action: string }>('mineradio-global-hotkey', (event) => {
      callback(event.payload)
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  },

  // ── 桌面歌词 ────────────────────────────────────────────

  /** 启用/禁用桌面歌词 */
  setDesktopLyricsEnabled: (enabled: boolean, payload?: unknown) =>
    tauriInvokeSafe('desktop_lyrics_set_enabled', { enabled, payload: payload || {} }),

  /** 更新桌面歌词内容 */
  updateDesktopLyrics: (payload: unknown) =>
    tauriInvokeSafe('desktop_lyrics_update', { payload }),

  // ── 壁纸模式 ────────────────────────────────────────────

  /** 启用/禁用壁纸模式 */
  setWallpaperMode: (enabled: boolean, payload?: unknown) =>
    tauriInvokeSafe('wallpaper_set_enabled', { enabled, payload: payload || {} }),

  /** 更新壁纸内容 */
  updateWallpaper: (payload: unknown) =>
    tauriInvokeSafe('wallpaper_update', { payload }),

  // ── 文件操作 ────────────────────────────────────────────

  /** 导出 JSON 文件 */
  exportJsonFile: (payload: unknown) =>
    tauriInvokeSafe('export_json_file', { payload }),

  /** 导入 JSON 文件 */
  importJsonFile: () => tauriInvokeSafe<unknown>('import_json_file'),

  // ── 应用生命周期 ────────────────────────────────────────

  /** 打开更新安装包 */
  openUpdateInstaller: (filePath: string) =>
    tauriInvokeSafe('open_update_installer', { filePath }),

  /** 重启应用 */
  restartApp: () => tauriInvokeSafe('restart_app'),

  // ── 托盘设置 ────────────────────────────────────────────

  /** 获取托盘设置 */
  getTraySettings: () => tauriInvokeSafe<Record<string, unknown>>('get_tray_settings'),

  /** 设置关闭按钮最小化到托盘 */
  setCloseToTray: (enabled: boolean) =>
    tauriInvokeSafe('set_close_to_tray', { enabled }),

  /** 设置开机自动启动 */
  setStartupEnabled: (enabled: boolean) =>
    tauriInvokeSafe('set_startup_enabled', { enabled }),

  // ── 窗口状态事件 ────────────────────────────────────────

  /** 监听窗口状态变化 */
  onStateChange: (callback: (state: WindowState) => void) => {
    let unlisten: (() => void) | null = null
    listen<WindowState>('desktop-window-state', (event) => {
      callback(event.payload)
    }).then((fn) => { unlisten = fn })
    return () => { unlisten?.() }
  },
}
