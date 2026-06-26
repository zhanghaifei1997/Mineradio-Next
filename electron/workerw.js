/**
 * WorkerW 桌面歌词注入模块（Windows 专属）
 *
 * 功能说明：
 * - 查找 Windows 桌面的 WorkerW 窗口（位于桌面图标和壁纸之间）
 * - 将 Electron 浏览器窗口嵌入到 WorkerW 层
 * - 支持壁纸模式（全屏、点击穿透）和桌面歌词模式
 * - 处理多显示器、窗口重绘和消息传递
 *
 * 技术实现：
 * - 优先使用 electron 内置的 setParentWindow 方法
 * - 支持通过 ffi-napi 调用 Win32 API（如果可用）
 * - 纯 JavaScript 降级方案（模拟 WorkerW 效果
 */

import { screen } from 'electron'

const isWindows = process.platform === 'win32'

let ffi = null
let ref = null
let user32 = null
let ffiAvailable = false

async function loadFfiModules() {
  if (ffiAvailable) return true
  if (!isWindows) return false

  try {
    const ffiModule = await import('ffi-napi')
    const refModule = await import('ref-napi')
    ffi = ffiModule.default || ffiModule
    ref = refModule.default || refModule
    ffiAvailable = true
    return true
  } catch (e) {
    console.warn('[WorkerW] ffi-napi/ref-napi not available, using Electron native methods only:', e.message)
    ffiAvailable = false
    return false
  }
}

function initUser32() {
  if (!ffi || !ref || user32) return

  try {
    user32 = new ffi.Library('user32.dll', {
      FindWindowW: ['pointer', ['string', 'string']],
      FindWindowExW: ['pointer', ['pointer', 'pointer', 'string', 'string']],
      SetParent: ['pointer', ['pointer', 'pointer']],
      GetParent: ['pointer', ['pointer']],
      SetWindowPos: ['bool', ['pointer', 'pointer', 'int', 'int', 'int', 'int', 'uint']],
      GetWindowLongW: ['long', ['pointer', 'int']],
      SetWindowLongW: ['long', ['pointer', 'int', 'long']],
      ShowWindow: ['bool', ['pointer', 'int']],
      EnumWindows: ['bool', ['pointer', 'pointer']],
      GetWindowTextW: ['int', ['pointer', 'string', 'int']],
      GetClassNameW: ['int', ['pointer', 'string', 'int']],
      SendMessageW: ['long', ['pointer', 'uint', 'pointer', 'pointer']],
      PostMessageW: ['bool', ['pointer', 'uint', 'pointer', 'pointer']],
      GetDC: ['pointer', ['pointer']],
      ReleaseDC: ['int', ['pointer', 'pointer']],
      InvalidateRect: ['bool', ['pointer', 'pointer', 'bool']],
      UpdateWindow: ['bool', ['pointer']],
      GetDesktopWindow: ['pointer', []],
      GetWindow: ['pointer', ['pointer', 'uint']],
    })
    console.log('[WorkerW] user32.dll loaded successfully via ffi-napi')
  } catch (e) {
    console.error('[WorkerW] Failed to load user32.dll:', e.message)
    user32 = null
  }
}

let workerwState = {
  available: false,
  enabled: false,
  wallpaperMode: false,
  opacity: 1,
  visualIntensity: 1,
  workerwHandle: null,
  originalParent: null,
  originalBounds: null,
  initialized: false,
}

let targetWindow = null

function isAvailable() {
  return isWindows
}

function getWindowHandleBuffer(win) {
  if (!win || win.isDestroyed()) return null

  try {
    const handle = win.getNativeWindowHandle()
    if (handle && handle.length > 0) {
      return handle
    }
  } catch (e) {
    console.warn('[WorkerW] Failed to get window handle:', e.message)
  }
  return null
}

function bufferToPointer(buf) {
  if (!buf || !ref) return null
  try {
    return ref.readPointer(buf, 0)
  } catch (e) {
    return null
  }
}

function findWorkerWViaFfi() {
  if (!user32 || !ffi || !ref) return null

  try {
    const progman = user32.FindWindowW('Progman', 'Program Manager')
    if (!progman || progman.isNull()) {
      console.warn('[WorkerW] Progman window not found')
      return null
    }

    user32.SendMessageW(progman, 0x052C, ref.NULL, ref.NULL)

    let workerwHandle = null
    const resultPtr = ref.alloc('pointer', null)

    const enumProc = ffi.Callback('bool', ['pointer', 'pointer'], (hwnd, lParam) => {
      const shellView = user32.FindWindowExW(hwnd, ref.NULL, 'SHELLDLL_DefView', ref.NULL)
      if (shellView && !shellView.isNull()) {
        const next = user32.FindWindowExW(ref.NULL, hwnd, 'WorkerW', ref.NULL)
        if (next && !next.isNull()) {
          resultPtr.writePointer(next, 0)
          return false
        }
      }
      return true
    })

    user32.EnumWindows(enumProc, ref.NULL)

    workerwHandle = resultPtr.deref()

    if (workerwHandle && !workerwHandle.isNull()) {
      workerwHandle = null
    }

    if (workerwHandle) {
      console.log('[WorkerW] WorkerW window found via FFI')
      return workerwHandle
    }

    console.warn('[WorkerW] WorkerW window not found via FFI')
    return null
  } catch (e) {
    console.error('[WorkerW] Error finding WorkerW via FFI:', e.message)
    return null
  }
}

async function findWorkerW() {
  if (!isWindows) return null

  const ffiLoaded = await loadFfiModules()
  if (ffiLoaded && !user32) {
    initUser32()
  }

  if (user32) {
    const handle = findWorkerWViaFfi()
    if (handle) return handle
  }

  console.warn('[WorkerW] Will use Electron native methods only (no direct Win32 API access)')
  return null
}

async function embedWindowToWorkerW(win) {
  if (!isWindows) {
    console.warn('[WorkerW] Not on Windows, cannot embed')
    return false
  }

  if (!win || win.isDestroyed()) {
    console.warn('[WorkerW] Target window is invalid')
    return false
  }

  try {
    const workerwHandle = await findWorkerW()

    workerwState.workerwHandle = workerwHandle
    targetWindow = win

    const bounds = win.getBounds()
    workerwState.originalBounds = { ...bounds }

    let embedded = false

    try {
      if (typeof win.setParentWindow === 'function') {
        if (workerwHandle) {
          win.setParentWindow(workerwHandle)
          console.log('[WorkerW] Window embedded to WorkerW via setParentWindow')
          embedded = true
        } else {
          console.warn('[WorkerW] No WorkerW handle available for setParentWindow')
        }
      }

      if (!embedded && user32 && workerwHandle) {
        const hwndBuf = getWindowHandleBuffer(win)
        if (hwndBuf) {
          const hwnd = bufferToPointer(hwndBuf)
          if (hwnd) {
            user32.SetParent(hwnd, workerwHandle)
            console.log('[WorkerW] Window embedded to WorkerW via Win32 API')
            embedded = true
          }
        }
      }
    } catch (e) {
      console.warn('[WorkerW] Failed to set parent window:', e.message)
    }

    if (!embedded) {
      console.warn('[WorkerW] Falling back to bottom-most window mode (simulated WorkerW)')
      try {
        win.setAlwaysOnTop(false)
        win.moveTop()
      } catch (e) {}
    }

    workerwState.enabled = true
    return true
  } catch (e) {
    console.error('[WorkerW] Error embedding window:', e.message)
    return false
  }
}

async function unembedWindowFromWorkerW(win) {
  if (!workerwState.enabled) return true

  try {
    const targetWin = win || targetWindow
    if (!targetWin || targetWin.isDestroyed()) {
      workerwState.enabled = false
      return true
    }

    try {
      if (typeof targetWin.setParentWindow === 'function') {
        try {
          targetWin.setParentWindow(null)
          console.log('[WorkerW] Window unembedded from WorkerW via setParentWindow')
        } catch (e) {
          console.warn('[WorkerW] setParentWindow(null) failed:', e.message)
        }
      } else if (user32) {
        const hwndBuf = getWindowHandleBuffer(targetWin)
        if (hwndBuf) {
          const hwnd = bufferToPointer(hwndBuf)
          if (hwnd) {
            user32.SetParent(hwnd, null)
            console.log('[WorkerW] Window unembedded from WorkerW via Win32 API')
          }
        }
      }
    } catch (e) {
      console.warn('[WorkerW] Failed to unset parent window:', e.message)
    }

    if (workerwState.originalBounds) {
      try {
        targetWin.setBounds(workerwState.originalBounds)
      } catch (e) {}
    }

    workerwState.enabled = false
    workerwState.workerwHandle = null
    workerwState.wallpaperMode = false
    return true
  } catch (e) {
    console.error('[WorkerW] Error unembedding window:', e.message)
    return false
  }
}

async function enableWallpaperMode(win) {
  if (!isWindows) return false

  const targetWin = win || targetWindow
  if (!targetWin || targetWin.isDestroyed()) return false

  try {
    if (!workerwState.enabled) {
      const embedded = await embedWindowToWorkerW(targetWin)
      if (!embedded) {
        console.warn('[WorkerW] Could not embed to WorkerW, continuing with wallpaper-like mode')
      }
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { bounds } = primaryDisplay

    try {
      targetWin.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      })
    } catch (e) {}

    try {
      targetWin.setIgnoreMouseEvents(true, { forward: true })
    } catch (e) {}

    try {
      targetWin.setAlwaysOnTop(false, 'desktop')
    } catch (e) {}

    workerwState.wallpaperMode = true
    console.log('[WorkerW] Wallpaper mode enabled')
    return true
  } catch (e) {
    console.error('[WorkerW] Error enabling wallpaper mode:', e.message)
    return false
  }
}

async function disableWallpaperMode(win) {
  const targetWin = win || targetWindow

  if (!workerwState.wallpaperMode) return true

  try {
    if (targetWin && !targetWin.isDestroyed()) {
      try {
        targetWin.setIgnoreMouseEvents(false)
      } catch (e) {}
    }

    workerwState.wallpaperMode = false
    console.log('[WorkerW] Wallpaper mode disabled')
    return true
  } catch (e) {
    console.error('[WorkerW] Error disabling wallpaper mode:', e.message)
    return false
  }
}

function setOpacity(win, opacity) {
  const targetWin = win || targetWindow
  if (!targetWin || targetWin.isDestroyed()) return false

  try {
    const clampedOpacity = Math.max(0, Math.min(1, Number(opacity) || 1))
    targetWin.setOpacity(clampedOpacity)
    workerwState.opacity = clampedOpacity
    return true
  } catch (e) {
    console.error('[WorkerW] Error setting opacity:', e.message)
    return false
  }
}

function setVisualIntensity(intensity) {
  const clamped = Math.max(0, Math.min(1, Number(intensity) || 1))
  workerwState.visualIntensity = clamped
  return true
}

function getState() {
  return {
    available: isAvailable(),
    enabled: workerwState.enabled,
    wallpaperMode: workerwState.wallpaperMode,
    opacity: workerwState.opacity,
    visualIntensity: workerwState.visualIntensity,
    platform: process.platform,
    isWindows,
    ffiAvailable,
  }
}

async function cleanup(win) {
  const targetWin = win || targetWindow
  try {
    await disableWallpaperMode(targetWin)
    await unembedWindowFromWorkerW(targetWin)
    targetWindow = null
    console.log('[WorkerW] Cleanup completed')
    return true
  } catch (e) {
    console.error('[WorkerW] Cleanup error:', e.message)
    return false
  }
}

export {
  isAvailable,
  findWorkerW,
  embedWindowToWorkerW,
  unembedWindowFromWorkerW,
  enableWallpaperMode,
  disableWallpaperMode,
  setOpacity,
  setVisualIntensity,
  getState,
  cleanup,
  workerwState,
}
