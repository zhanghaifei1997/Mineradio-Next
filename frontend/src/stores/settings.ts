import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // ── UI 模式 ──
  const diyMode = ref(false)
  const immersiveMode = ref(false)
  const controlsVisible = ref(false)

  // ── 桌面相关 ──
  const closeToTray = ref(true)
  const desktopLyricsEnabled = ref(false)
  const wallpaperMode = ref(false)

  // ── 快捷键 ──
  const hotkeyBindings = ref<Array<{ accelerator: string; action: string }>>([])

  // ── 偏好 ──
  const savedVolume = ref(0.8)
  const autoHideCursor = ref(true)
  const fxPanelOpen = ref(false)
  const playlistPanelOpen = ref(false)
  const playlistPanelPinned = ref(false)

  function setDiyMode(val: boolean) { diyMode.value = val }
  function setImmersiveMode(val: boolean) { immersiveMode.value = val }
  function setControlsVisible(val: boolean) { controlsVisible.value = val }
  function setCloseToTray(val: boolean) { closeToTray.value = val }
  function setDesktopLyricsEnabled(val: boolean) { desktopLyricsEnabled.value = val }
  function setWallpaperMode(val: boolean) { wallpaperMode.value = val }
  function setFxPanelOpen(val: boolean) { fxPanelOpen.value = val }
  function setPlaylistPanelOpen(val: boolean) { playlistPanelOpen.value = val }
  function setPlaylistPanelPinned(val: boolean) { playlistPanelPinned.value = val }

  return {
    diyMode, immersiveMode, controlsVisible, closeToTray,
    desktopLyricsEnabled, wallpaperMode, hotkeyBindings,
    savedVolume, autoHideCursor, fxPanelOpen, playlistPanelOpen, playlistPanelPinned,
    setDiyMode, setImmersiveMode, setControlsVisible, setCloseToTray,
    setDesktopLyricsEnabled, setWallpaperMode, setFxPanelOpen,
    setPlaylistPanelOpen, setPlaylistPanelPinned,
  }
})
