const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  desktopLyrics: {
    update: (payload) => ipcRenderer.invoke('desktop-lyrics:update', payload),
    setLock: (locked) => ipcRenderer.invoke('desktop-lyrics:setLock', locked),
    moveBy: (dx, dy) => ipcRenderer.invoke('desktop-lyrics:moveBy', dx, dy),
    onState: (callback) => {
      if (typeof callback !== 'function') return () => {}
      const listener = (_event, state) => callback(state || {})
      ipcRenderer.on('desktop-lyrics:state', listener)
      return () => ipcRenderer.removeListener('desktop-lyrics:state', listener)
    },
  },

  wallpaper: {
    update: (payload) => ipcRenderer.invoke('wallpaper:update', payload),
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
