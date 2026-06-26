import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('overlayAPI', {
  onLyricUpdate: (callback) => {
    ipcRenderer.on('overlay:lyric-update', (_e, data) => callback(data))
  },
  onPlayStateChange: (callback) => {
    ipcRenderer.on('overlay:play-state', (_e, data) => callback(data))
  },
})
