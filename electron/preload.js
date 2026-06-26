import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    getState: () => ipcRenderer.invoke('window:getState'),
  },

  desktopLyrics: {
    show: () => ipcRenderer.invoke('desktop-lyrics:show'),
    hide: () => ipcRenderer.invoke('desktop-lyrics:hide'),
    update: (payload) => ipcRenderer.invoke('desktop-lyrics:update', payload),
    setLock: (locked) => ipcRenderer.invoke('desktop-lyrics:setLock', locked),
    moveBy: (dx, dy) => ipcRenderer.invoke('desktop-lyrics:moveBy', dx, dy),
    onEnabledState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, payload) => callback(payload || {})
      ipcRenderer.on('mineradio-desktop-lyrics-enabled-state', listener)
      return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-enabled-state', listener)
    },
    onLockState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, payload) => callback(payload || {})
      ipcRenderer.on('mineradio-desktop-lyrics-lock-state', listener)
      return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-lock-state', listener)
    },
  },

  wallpaper: {
    enable: () => ipcRenderer.invoke('wallpaper:enable'),
    disable: () => ipcRenderer.invoke('wallpaper:disable'),
    update: (payload) => ipcRenderer.invoke('wallpaper:update', payload),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    restart: () => ipcRenderer.invoke('app:restart'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },

  login: {
    openNetease: () => ipcRenderer.invoke('login:netease:open'),
    clearNetease: () => ipcRenderer.invoke('login:netease:clear'),
    openQQ: () => ipcRenderer.invoke('login:qq:open'),
    clearQQ: () => ipcRenderer.invoke('login:qq:clear'),
  },

  hotkeys: {
    configure: (bindings) => ipcRenderer.invoke('hotkeys:configure', bindings || []),
    onGlobalHotkey: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, payload) => callback(payload || {})
      ipcRenderer.on('mineradio-global-hotkey', listener)
      return () => ipcRenderer.removeListener('mineradio-global-hotkey', listener)
    },
  },

  file: {
    exportJson: (payload) => ipcRenderer.invoke('file:exportJson', payload || {}),
    importJson: () => ipcRenderer.invoke('file:importJson'),
  },

  tray: {
    update: () => ipcRenderer.invoke('tray:update'),
  },

  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
  },

  onTogglePlay: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = () => callback()
    ipcRenderer.on('global:toggle-play', listener)
    return () => ipcRenderer.removeListener('global:toggle-play', listener)
  },

  onNext: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = () => callback()
    ipcRenderer.on('global:next', listener)
    return () => ipcRenderer.removeListener('global:next', listener)
  },

  onPrev: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = () => callback()
    ipcRenderer.on('global:prev', listener)
    return () => ipcRenderer.removeListener('global:prev', listener)
  },

  onWindowStateChange: (callback) => {
    if (typeof callback !== 'function') return () => {}
    const listener = (_event, state) => callback(state)
    ipcRenderer.on('desktop-window-state', listener)
    return () => ipcRenderer.removeListener('desktop-window-state', listener)
  },
})
