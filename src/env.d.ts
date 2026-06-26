/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI?: {
    window: {
      minimize: () => Promise<void>
      maximize: () => Promise<boolean>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
    }
    desktopLyrics: {
      show: () => Promise<void>
      hide: () => Promise<void>
    }
    wallpaper: {
      enable: () => Promise<void>
      disable: () => Promise<void>
    }
    app: {
      getVersion: () => Promise<string>
    }
    onTogglePlay: (callback: () => void) => void
    onNext: (callback: () => void) => void
    onPrev: (callback: () => void) => void
  }
  overlayAPI?: {
    onLyricUpdate: (callback: (data: any) => void) => void
    onPlayStateChange: (callback: (data: any) => void) => void
  }
}
