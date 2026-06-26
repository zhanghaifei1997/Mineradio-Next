import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    getState: () => ipcRenderer.invoke('window:getState'),
    setMiniMode: (isMini) => ipcRenderer.invoke('window:setMiniMode', isMini),
  },

  media: {
    setNowPlaying: (data) => ipcRenderer.invoke('media:setNowPlaying', data),
    setPlaybackState: (state) => ipcRenderer.invoke('media:setPlaybackState', state),
  },

  desktopLyrics: {
    show: () => ipcRenderer.invoke('desktop-lyrics:show'),
    hide: () => ipcRenderer.invoke('desktop-lyrics:hide'),
    update: (payload) => ipcRenderer.invoke('desktop-lyrics:update', payload),
    setLock: (locked) => ipcRenderer.invoke('desktop-lyrics:setLock', locked),
    moveBy: (dx, dy) => ipcRenderer.invoke('desktop-lyrics:moveBy', dx, dy),
    getState: () => ipcRenderer.invoke('desktop-lyrics:getState'),
    sendToOverlay: (channel, payload) => ipcRenderer.invoke('desktop-lyrics:sendToOverlay', channel, payload),
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
    onLyricsData: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, data) => callback(data || {})
      ipcRenderer.on('desktop-lyrics:lyricsData', listener)
      return () => ipcRenderer.removeListener('desktop-lyrics:lyricsData', listener)
    },
    onPlayState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, data) => callback(data || {})
      ipcRenderer.on('desktop-lyrics:playState', listener)
      return () => ipcRenderer.removeListener('desktop-lyrics:playState', listener)
    },
    onSettingsChange: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, settings) => callback(settings || {})
      ipcRenderer.on('desktop-lyrics:settings', listener)
      return () => ipcRenderer.removeListener('desktop-lyrics:settings', listener)
    },
  },

  wallpaper: {
    enable: () => ipcRenderer.invoke('wallpaper:enable'),
    disable: () => ipcRenderer.invoke('wallpaper:disable'),
    update: (payload) => ipcRenderer.invoke('wallpaper:update', payload),
  },

  workerw: {
    state: () => ipcRenderer.invoke('workerw:state'),
    enable: (options) => ipcRenderer.invoke('workerw:enable', options || {}),
    disable: () => ipcRenderer.invoke('workerw:disable'),
    setOpacity: (opacity) => ipcRenderer.invoke('workerw:setOpacity', opacity),
    setWallpaperMode: (enabled) => ipcRenderer.invoke('workerw:setWallpaperMode', enabled),
    setVisualIntensity: (intensity) => ipcRenderer.invoke('workerw:setVisualIntensity', intensity),
    onState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, state) => callback(state || {})
      ipcRenderer.on('mineradio-workerw-state', listener)
      return () => ipcRenderer.removeListener('mineradio-workerw-state', listener)
    },
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
    install: () => ipcRenderer.invoke('update:install'),
    getState: () => ipcRenderer.invoke('update:state'),
    cancel: () => ipcRenderer.invoke('update:cancel'),
    onStateChanged: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, state) => callback(state || {})
      ipcRenderer.on('update:state-changed', listener)
      return () => ipcRenderer.removeListener('update:state-changed', listener)
    },
  },

  localMusic: {
    scanDirectory: (dirPath) => ipcRenderer.invoke('local-music:scan-directory', dirPath),
    readMetadata: (filePath) => ipcRenderer.invoke('local-music:read-metadata', filePath),
    selectDirectory: () => ipcRenderer.invoke('local-music:select-directory'),
    selectFiles: () => ipcRenderer.invoke('local-music:select-files'),
    getFileUrl: (filePath) => ipcRenderer.invoke('local-music:get-file-url', filePath),
    getConfig: () => ipcRenderer.invoke('local-music:get-config'),
    saveConfig: (config) => ipcRenderer.invoke('local-music:save-config', config),
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
