const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  desktopLyrics: {
    show: () => ipcRenderer.invoke('desktop-lyrics:show'),
    hide: () => ipcRenderer.invoke('desktop-lyrics:hide'),
    update: (payload) => ipcRenderer.invoke('desktop-lyrics:update', payload),
    setLock: (locked) => ipcRenderer.invoke('desktop-lyrics:setLock', locked),
    moveBy: (dx, dy) => ipcRenderer.invoke('desktop-lyrics:moveBy', dx, dy),
    getState: () => ipcRenderer.invoke('desktop-lyrics:getState'),
    sendToMain: (channel, payload) => ipcRenderer.invoke('desktop-lyrics:sendToMain', channel, payload),
    onState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, state) => callback(state || {})
      ipcRenderer.on('desktop-lyrics:state', listener)
      return () => ipcRenderer.removeListener('desktop-lyrics:state', listener)
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
    update: (payload) => ipcRenderer.invoke('wallpaper:update', payload),
  },

  workerw: {
    state: () => ipcRenderer.invoke('workerw:state'),
    onState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, state) => callback(state || {})
      ipcRenderer.on('mineradio-workerw-state', listener)
      return () => ipcRenderer.removeListener('mineradio-workerw-state', listener)
    },
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
})
