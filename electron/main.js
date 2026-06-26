import { app, BrowserWindow, ipcMain, globalShortcut, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer, stopServer } from './server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let desktopLyricsWindow = null
let wallpaperWindow = null
let serverProcess = null

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    visualEffectState: 'active',
  })

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createDesktopLyricsWindow() {
  if (desktopLyricsWindow) return

  const { width } = screen.getPrimaryDisplay().workAreaSize

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
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true })

  if (isDev) {
    desktopLyricsWindow.loadURL('http://127.0.0.1:5173/desktop-lyrics.html')
  } else {
    desktopLyricsWindow.loadFile(path.join(__dirname, '../dist/desktop-lyrics.html'))
  }

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null
  })
}

function createWallpaperWindow() {
  if (wallpaperWindow) return
  console.warn('Wallpaper mode is Windows-only feature')
}

function registerGlobalShortcuts() {
  globalShortcut.register('MediaPlayPause', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global:toggle-play')
    }
  })

  globalShortcut.register('MediaNextTrack', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global:next')
    }
  })

  globalShortcut.register('MediaPreviousTrack', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global:prev')
    }
  })
}

function setupIpc() {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
    return mainWindow?.isMaximized() ?? false
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  ipcMain.handle('desktop-lyrics:show', () => {
    createDesktopLyricsWindow()
    desktopLyricsWindow?.show()
  })

  ipcMain.handle('desktop-lyrics:hide', () => {
    desktopLyricsWindow?.hide()
  })

  ipcMain.handle('wallpaper:enable', () => {
    createWallpaperWindow()
  })

  ipcMain.handle('wallpaper:disable', () => {
    wallpaperWindow?.close()
    wallpaperWindow = null
  })

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion()
  })
}

app.whenReady().then(() => {
  serverProcess = startServer()
  createMainWindow()
  setupIpc()
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer()
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopServer()
})
