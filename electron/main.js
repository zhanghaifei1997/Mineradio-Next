import { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage, shell, session, dialog } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, stopServer } from './server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'

const APP_NAME = 'Mineradio'
const APP_USER_MODEL_ID = 'com.mineradio.desktop'

const NETEASE_LOGIN_PARTITION = 'persist:mineradio-netease-login'
const NETEASE_LOGIN_URL = 'https://music.163.com/#/login'
const QQ_LOGIN_PARTITION = 'persist:mineradio-qqmusic-login'
const QQ_LOGIN_URL = 'https://y.qq.com/n/ryqq/profile'

const NETEASE_LOGIN_COOKIE_PRIORITY = [
  'MUSIC_U',
  '__csrf',
  'NMTID',
  'MUSIC_A',
  '__remember_me',
  '_ntes_nuid',
  '_ntes_nnid',
  'WEVNSM',
  'WNMCID',
  'JSESSIONID-WYYY',
]

const QQ_LOGIN_COOKIE_PRIORITY = [
  'uin',
  'qqmusic_uin',
  'wxuin',
  'login_type',
  'qm_keyst',
  'qqmusic_key',
  'p_skey',
  'skey',
  'psrf_qqopenid',
  'psrf_qqunionid',
  'psrf_qqaccess_token',
  'psrf_qqrefresh_token',
  'wxopenid',
  'wxunionid',
  'wxrefresh_token',
  'wxskey',
  'p_uin',
  'ptcz',
  'RK',
]

let mainWindow = null
let desktopLyricsWindow = null
let wallpaperWindow = null
let loginWindow = null
let tray = null
let serverProcess = null

let desktopLyricsState = {
  enabled: false,
  clickThrough: true,
  locked: false,
}

let wallpaperState = {
  enabled: false,
}

const registeredGlobalHotkeys = new Map()

const gotSingleInstanceLock = app.requestSingleInstanceLock()

function clampNumber(value, min, max, defaultValue) {
  const num = Number(value)
  if (!Number.isFinite(num)) return defaultValue
  return Math.max(min, Math.min(max, num))
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  return true
}

function getAppIcon() {
  try {
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
    return nativeImage.createFromPath(iconPath)
  } catch (e) {
    return nativeImage.createEmpty()
  }
}

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width * 0.8),
    height: Math.min(800, height * 0.8),
    minWidth: 800,
    minHeight: 600,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    icon: getAppIcon(),
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
    visualEffectState: 'active',
  })

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createDesktopLyricsWindow(payload = {}) {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) return

  const { width } = screen.getPrimaryDisplay().workAreaSize

  desktopLyricsState = { ...desktopLyricsState, ...payload, enabled: true }

  desktopLyricsWindow = new BrowserWindow({
    width: Math.floor(width * 0.6),
    height: 120,
    x: Math.floor(width * 0.2),
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  desktopLyricsWindow.setAlwaysOnTop(true, 'screen-saver')
  desktopLyricsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (desktopLyricsState.clickThrough !== false) {
    desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true })
  }

  if (isDev) {
    desktopLyricsWindow.loadURL('http://127.0.0.1:5173/desktop-lyrics.html')
  } else {
    desktopLyricsWindow.loadFile(path.join(__dirname, '../dist/desktop-lyrics.html'))
  }

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null
    desktopLyricsState.enabled = false
    broadcastDesktopLyricsEnabledState(false)
  })
}

function closeDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.close()
  }
  desktopLyricsWindow = null
  desktopLyricsState.enabled = false
}

function createWallpaperWindow(payload = {}) {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) return

  if (process.platform !== 'win32') {
    console.warn('Wallpaper mode is Windows-only feature')
    return
  }

  wallpaperState = { ...wallpaperState, ...payload, enabled: true }

  const primaryDisplay = screen.getPrimaryDisplay()
  const { bounds } = primaryDisplay

  wallpaperWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  wallpaperWindow.setIgnoreMouseEvents(true, { forward: true })

  if (isDev) {
    wallpaperWindow.loadURL('http://127.0.0.1:5173/wallpaper.html')
  } else {
    wallpaperWindow.loadFile(path.join(__dirname, '../dist/wallpaper.html'))
  }

  wallpaperWindow.on('closed', () => {
    wallpaperWindow = null
    wallpaperState.enabled = false
  })
}

function closeWallpaperWindow() {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    wallpaperWindow.close()
  }
  wallpaperWindow = null
  wallpaperState.enabled = false
}

function createTray() {
  if (tray) return

  const icon = getAppIcon()
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip(APP_NAME)

  updateTrayMenu()

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

function updateTrayMenu() {
  if (!tray) return

  const template = [
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: '播放/暂停',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('global:toggle-play')
        }
      },
    },
    {
      label: '上一首',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('global:prev')
        }
      },
    },
    {
      label: '下一首',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('global:next')
        }
      },
    },
    { type: 'separator' },
    {
      label: desktopLyricsState.enabled ? '关闭桌面歌词' : '显示桌面歌词',
      click: () => {
        if (desktopLyricsState.enabled) {
          closeDesktopLyricsWindow()
        } else {
          createDesktopLyricsWindow()
        }
        updateTrayMenu()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      },
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  tray.setContextMenu(menu)
}

function registerGlobalShortcuts() {
  const shortcuts = [
    { accelerator: 'MediaPlayPause', action: 'toggle-play' },
    { accelerator: 'MediaNextTrack', action: 'next' },
    { accelerator: 'MediaPreviousTrack', action: 'prev' },
  ]

  for (const { accelerator, action } of shortcuts) {
    try {
      const registered = globalShortcut.register(accelerator, () => {
        if (mainWindow) {
          mainWindow.webContents.send(`global:${action}`)
        }
        updateTrayMenu()
      })
      if (registered) {
        registeredGlobalHotkeys.set(accelerator, action)
      }
    } catch (error) {
      console.warn(`Failed to register global shortcut ${accelerator}:`, error.message)
    }
  }
}

function configureGlobalHotkeys(bindings = []) {
  for (const accelerator of registeredGlobalHotkeys.keys()) {
    try {
      globalShortcut.unregister(accelerator)
    } catch (e) {}
  }
  registeredGlobalHotkeys.clear()

  const results = []
  const seen = new Set()

  for (const item of Array.isArray(bindings) ? bindings : []) {
    const action = item && String(item.action || '').trim()
    const accelerator = item && String(item.accelerator || '').trim()
    if (!action || !accelerator || seen.has(accelerator)) continue
    seen.add(accelerator)
    let registered = false
    try {
      registered = globalShortcut.register(accelerator, () => {
        if (mainWindow) {
          mainWindow.webContents.send('mineradio-global-hotkey', { action })
        }
      })
    } catch (error) {
      registered = false
    }
    if (registered) {
      registeredGlobalHotkeys.set(accelerator, action)
      results.push({ action, accelerator, ok: true })
    } else {
      results.push({
        action,
        accelerator,
        ok: false,
        conflict: {
          sourceName: '系统 / 其他软件',
          sourceIcon: 'warning',
          reason: '该组合键已被占用或被系统保留',
        },
      })
    }
  }

  return { ok: true, results }
}

function broadcastDesktopLyricsEnabledState(enabled) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-enabled-state', { enabled })
  }
}

function broadcastDesktopLyricsLockState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-lock-state', {
      locked: desktopLyricsState.clickThrough !== false,
    })
  }
}

function applyDesktopLyricsMouseBehavior() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return
  if (desktopLyricsState.clickThrough !== false) {
    desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    desktopLyricsWindow.setIgnoreMouseEvents(false)
  }
}

async function readNeteaseLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({})
  const priority = NETEASE_LOGIN_COOKIE_PRIORITY
  const map = new Map()
  for (const c of cookies) {
    if (c && c.name) map.set(c.name, c.value)
  }
  const ordered = []
  for (const name of priority) {
    if (map.has(name)) ordered.push(`${name}=${map.get(name)}`)
  }
  for (const [name, value] of map.entries()) {
    if (!priority.includes(name)) ordered.push(`${name}=${value}`)
  }
  return ordered.join('; ')
}

function neteaseCookieHasLogin(cookie) {
  if (!cookie) return false
  return /(^|;\s*)MUSIC_U\s*=/.test(cookie)
}

async function readQQLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({})
  const priority = QQ_LOGIN_COOKIE_PRIORITY
  const map = new Map()
  for (const c of cookies) {
    if (c && c.name) map.set(c.name, c.value)
  }
  const ordered = []
  for (const name of priority) {
    if (map.has(name)) ordered.push(`${name}=${map.get(name)}`)
  }
  for (const [name, value] of map.entries()) {
    if (!priority.includes(name)) ordered.push(`${name}=${value}`)
  }
  return ordered.join('; ')
}

function qqCookieHasLogin(cookie) {
  if (!cookie) return false
  return /(^|;\s*)(uin|qqmusic_uin|wxuin)\s*=/.test(cookie)
}

function qqCookieHasPlaybackLogin(cookie) {
  if (!cookie) return false
  return /(^|;\s*)(qm_keyst|qqmusic_key|p_skey)\s*=/.test(cookie)
}

async function openNeteaseMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION)
  const initialCookie = await readNeteaseLoginCookieHeader(cookieSession)
  if (neteaseCookieHasLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer = null

    loginWindow = new BrowserWindow({
      width: 940,
      height: 760,
      minWidth: 780,
      minHeight: 580,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: '网易云音乐登录',
      backgroundColor: '#111111',
      icon: getAppIcon(),
      webPreferences: {
        partition: NETEASE_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const finish = async (result) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close()
      }
      loginWindow = null
      resolve(result)
    }

    const checkCookies = async () => {
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession)
        if (neteaseCookieHasLogin(cookie)) {
          finish({ ok: true, cookie })
        }
      } catch (e) {
        console.warn('Netease login cookie check failed:', e.message)
      }
    }

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\/([^/]+\.)?(163|music\.163|netease)\.com/i.test(url)) {
        loginWindow.loadURL(url).catch((e) => console.warn('Netease login popup navigation failed:', e.message))
      } else if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url).catch(() => {})
      }
      return { action: 'deny' }
    })

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies()
      loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const docs = [document];
          document.querySelectorAll('iframe').forEach((frame) => {
            try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (_) {}
          });
          for (const doc of docs) {
            const nodes = Array.from(doc.querySelectorAll('a, button, span, div'));
            const loginNode = nodes.find((node) => {
              const text = (node.textContent || '').trim();
              if (!/登录|立即登录/.test(text)) return false;
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && rect.height > 0;
            });
            if (loginNode) { loginNode.click(); return true; }
          }
          return false;
        }, 900);
      `, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', () => loginWindow.show())
    loginWindow.on('closed', async () => {
      if (settled) return
      if (pollTimer) clearInterval(pollTimer)
      try {
        const cookie = await readNeteaseLoginCookieHeader(cookieSession)
        resolve(neteaseCookieHasLogin(cookie)
          ? { ok: true, cookie, partial: !qqCookieHasPlaybackLogin(cookie) }
          : { ok: false, cancelled: true, message: '网易云登录窗口已关闭' })
      } catch (e) {
        resolve({ ok: false, error: e.message || '网易云登录窗口已关闭' })
      }
      loginWindow = null
    })

    pollTimer = setInterval(checkCookies, 1200)
    loginWindow.loadURL(NETEASE_LOGIN_URL).catch((e) => finish({ ok: false, error: e.message }))
  })
}

async function openQQMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION)
  const initialCookie = await readQQLoginCookieHeader(cookieSession)
  if (qqCookieHasPlaybackLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true }

  return new Promise((resolve) => {
    let settled = false
    let pollTimer = null
    let warmupStarted = false

    loginWindow = new BrowserWindow({
      width: 900,
      height: 720,
      minWidth: 760,
      minHeight: 560,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false,
      show: false,
      autoHideMenuBar: true,
      title: 'QQ 音乐登录',
      backgroundColor: '#111111',
      icon: getAppIcon(),
      webPreferences: {
        partition: QQ_LOGIN_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    const finish = async (result) => {
      if (settled) return
      settled = true
      if (pollTimer) clearInterval(pollTimer)
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close()
      }
      loginWindow = null
      resolve(result)
    }

    const checkCookies = async () => {
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession)
        if (qqCookieHasPlaybackLogin(cookie)) {
          finish({ ok: true, cookie })
        } else if (qqCookieHasLogin(cookie) && !warmupStarted) {
          warmupStarted = true
          setTimeout(() => {
            if (!settled && loginWindow && !loginWindow.isDestroyed()) {
              loginWindow.loadURL('https://y.qq.com/n/ryqq/player').catch((e) => console.warn('QQ login warmup navigation failed:', e.message))
            }
          }, 900)
        }
      } catch (e) {
        console.warn('QQ login cookie check failed:', e.message)
      }
    }

    loginWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) {
        loginWindow.loadURL(url).catch((e) => console.warn('QQ login popup navigation failed:', e.message))
      } else {
        shell.openExternal(url).catch(() => {})
      }
      return { action: 'deny' }
    })

    loginWindow.webContents.on('did-finish-load', () => {
      checkCookies()
      loginWindow.webContents.executeJavaScript(`
        setTimeout(() => {
          const nodes = Array.from(document.querySelectorAll('a, button, span, div'));
          const loginNode = nodes.find((node) => {
            const text = (node.textContent || '').trim();
            if (!/登录|登陆/.test(text)) return false;
            const rect = node.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          if (loginNode) loginNode.click();
        }, 700);
      `, true).catch(() => {})
    })

    loginWindow.on('ready-to-show', () => loginWindow.show())
    loginWindow.on('closed', async () => {
      if (settled) return
      if (pollTimer) clearInterval(pollTimer)
      try {
        const cookie = await readQQLoginCookieHeader(cookieSession)
        resolve(qqCookieHasLogin(cookie)
          ? { ok: true, cookie }
          : { ok: false, cancelled: true, message: 'QQ 登录窗口已关闭' })
      } catch (e) {
        resolve({ ok: false, error: e.message || 'QQ 登录窗口已关闭' })
      }
      loginWindow = null
    })

    pollTimer = setInterval(checkCookies, 1200)
    loginWindow.loadURL(QQ_LOGIN_URL).catch((e) => finish({ ok: false, error: e.message }))
  })
}

async function clearNeteaseMusicLoginSession() {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION)
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  })
  return { ok: true }
}

async function clearQQMusicLoginSession() {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION)
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  })
  return { ok: true }
}

function setupIpc() {
  ipcMain.handle('window:minimize', (event) => {
    getSenderWindow(event)?.minimize()
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = getSenderWindow(event)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('window:close', (event) => {
    getSenderWindow(event)?.close()
  })

  ipcMain.handle('window:isMaximized', (event) => {
    return getSenderWindow(event)?.isMaximized() ?? false
  })

  ipcMain.handle('window:getState', (event) => {
    const win = getSenderWindow(event)
    if (!win || win.isDestroyed()) return null
    return {
      isMaximized: win.isMaximized(),
      isMinimized: win.isMinimized(),
      isFullScreen: win.isFullScreen(),
      isVisible: win.isVisible(),
      isFocused: win.isFocused(),
      bounds: win.getBounds(),
    }
  })

  ipcMain.handle('desktop-lyrics:show', () => {
    createDesktopLyricsWindow()
    desktopLyricsWindow?.show()
    broadcastDesktopLyricsEnabledState(true)
    updateTrayMenu()
  })

  ipcMain.handle('desktop-lyrics:hide', () => {
    closeDesktopLyricsWindow()
    updateTrayMenu()
  })

  ipcMain.handle('desktop-lyrics:update', (_event, payload) => {
    try {
      const nextState = { ...desktopLyricsState, ...(payload || {}) }
      if (nextState.enabled) {
        createDesktopLyricsWindow(payload || {})
      } else if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
        desktopLyricsState = nextState
        if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
          desktopLyricsWindow.webContents.send('desktop-lyrics:state', nextState)
        }
      } else {
        desktopLyricsState = nextState
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('desktop-lyrics:setLock', (_event, locked) => {
    try {
      desktopLyricsState = { ...desktopLyricsState, clickThrough: !!locked, locked: !!locked }
      applyDesktopLyricsMouseBehavior()
      broadcastDesktopLyricsLockState()
      return { ok: true, locked: !!locked }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('desktop-lyrics:moveBy', (_event, dx, dy) => {
    try {
      if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) {
        return { ok: false, error: 'NO_DESKTOP_LYRICS_WINDOW' }
      }
      if (desktopLyricsState.clickThrough !== false) {
        return { ok: false, error: 'DESKTOP_LYRICS_LOCKED' }
      }
      const bounds = desktopLyricsWindow.getBounds()
      const next = {
        ...bounds,
        x: Math.round(bounds.x + clampNumber(dx, -160, 160, 0)),
        y: Math.round(bounds.y + clampNumber(dy, -160, 160, 0)),
      }
      desktopLyricsWindow.setBounds(next, false)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('wallpaper:enable', () => {
    createWallpaperWindow()
  })

  ipcMain.handle('wallpaper:disable', () => {
    closeWallpaperWindow()
  })

  ipcMain.handle('wallpaper:update', (_event, payload) => {
    try {
      wallpaperState = { ...wallpaperState, ...(payload || {}) }
      if (wallpaperState.enabled) {
        createWallpaperWindow(wallpaperState)
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:restart', () => {
    try {
      app.relaunch()
      app.exit(0)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  ipcMain.handle('hotkeys:configure', (_event, bindings) => {
    return configureGlobalHotkeys(bindings)
  })

  ipcMain.handle('login:netease:open', async (event) => {
    return openNeteaseMusicLoginWindow(getSenderWindow(event))
  })

  ipcMain.handle('login:netease:clear', async () => {
    return clearNeteaseMusicLoginSession()
  })

  ipcMain.handle('login:qq:open', async (event) => {
    return openQQMusicLoginWindow(getSenderWindow(event))
  })

  ipcMain.handle('login:qq:clear', async () => {
    return clearQQMusicLoginSession()
  })

  ipcMain.handle('file:exportJson', async (event, payload = {}) => {
    try {
      const owner = getSenderWindow(event)
      const defaultName = String(payload.defaultName || 'mineradio-export.json').replace(/[\\/:*?"<>|]+/g, '-')
      const result = await dialog.showSaveDialog(owner, {
        title: '导出 Mineradio 存档',
        defaultPath: defaultName.toLowerCase().endsWith('.json') ? defaultName : `${defaultName}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true }
      const text = typeof payload.text === 'string' ? payload.text : JSON.stringify(payload.data || {}, null, 2)
      const fs = await import('node:fs')
      fs.writeFileSync(result.filePath, text, 'utf8')
      return { ok: true, filePath: result.filePath }
    } catch (e) {
      return { ok: false, error: e.message || 'EXPORT_FAILED' }
    }
  })

  ipcMain.handle('file:importJson', async (event) => {
    try {
      const owner = getSenderWindow(event)
      const result = await dialog.showOpenDialog(owner, {
        title: '导入 Mineradio 存档',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true }
      const filePath = result.filePaths[0]
      const fs = await import('node:fs')
      const text = fs.readFileSync(filePath, 'utf8')
      return { ok: true, filePath, text }
    } catch (e) {
      return { ok: false, error: e.message || 'IMPORT_FAILED' }
    }
  })

  ipcMain.handle('tray:update', () => {
    updateTrayMenu()
  })

  ipcMain.handle('update:check', async () => {
    return { ok: true, updateAvailable: false, version: app.getVersion() }
  })

  ipcMain.handle('update:download', async () => {
    return { ok: false, error: 'NOT_IMPLEMENTED' }
  })
}

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!focusMainWindow()) {
      app.whenReady().then(() => createMainWindow()).catch((e) => console.error('Second instance window restore failed:', e))
    }
  })

  app.whenReady().then(() => {
    app.setName(APP_NAME)
    if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID)

    serverProcess = startServer({
      cookieDir: app.getPath('userData'),
    })

    createMainWindow()
    createTray()
    setupIpc()
    registerGlobalShortcuts()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      } else {
        focusMainWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer()
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopServer()
  if (tray) {
    tray.destroy()
    tray = null
  }
})

export { mainWindow, desktopLyricsWindow, wallpaperWindow, tray }
