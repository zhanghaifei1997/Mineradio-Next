import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
  desktopLyrics: {
    show: () => ipcRenderer.invoke('desktop-lyrics:show'),
    hide: () => ipcRenderer.invoke('desktop-lyrics:hide'),
  },
  wallpaper: {
    enable: () => ipcRenderer.invoke('wallpaper:enable'),
    disable: () => ipcRenderer.invoke('wallpaper:disable'),
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
  },
  onTogglePlay: (callback) => {
    ipcRenderer.on('global:toggle-play', () => callback())
  },
  onNext: (callback) => {
    ipcRenderer.on('global:next', () => callback())
  },
  onPrev: (callback) => {
    ipcRenderer.on('global:prev', () => callback())
  },
})
