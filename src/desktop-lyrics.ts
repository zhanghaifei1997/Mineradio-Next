import { createApp, ref, onMounted, onUnmounted, watch } from 'vue'
import DesktopLyrics from './components/lyrics/DesktopLyrics.vue'
import './styles/main.css'
import type { DesktopLyricState, DesktopLyricsSettings } from './modules/lyrics'

const electronAPI = (window as any).electronAPI

const App = {
  components: { DesktopLyrics },
  setup() {
    const desktopLyricsRef = ref<InstanceType<typeof DesktopLyrics> | null>(null)

    let removeOnState: (() => void) | null = null
    let removeOnLyricsData: (() => void) | null = null
    let removeOnPlayState: (() => void) | null = null
    let removeOnSettingsChange: (() => void) | null = null
    let removeOnEnabledState: (() => void) | null = null
    let removeOnLockState: (() => void) | null = null
    let removeOnTogglePlay: (() => void) | null = null
    let removeOnNext: (() => void) | null = null
    let removeOnPrev: (() => void) | null = null

    function handleClose() {
      if (electronAPI?.desktopLyrics?.hide) {
        electronAPI.desktopLyrics.hide()
      }
    }

    function handleLockChange(locked: boolean) {
      if (electronAPI?.desktopLyrics?.setLock) {
        electronAPI.desktopLyrics.setLock(locked)
      }
    }

    function handleTogglePlay() {
      if (electronAPI?.desktopLyrics?.sendToMain) {
        electronAPI.desktopLyrics.sendToMain('togglePlay', {})
      }
    }

    function handlePrev() {
      if (electronAPI?.desktopLyrics?.sendToMain) {
        electronAPI.desktopLyrics.sendToMain('prev', {})
      }
    }

    function handleNext() {
      if (electronAPI?.desktopLyrics?.sendToMain) {
        electronAPI.desktopLyrics.sendToMain('next', {})
      }
    }

    function handleOpenSettings() {
      if (electronAPI?.desktopLyrics?.sendToMain) {
        electronAPI.desktopLyrics.sendToMain('openSettings', {})
      }
    }

    function handleLyricsData(data: any) {
      if (desktopLyricsRef.value) {
        const state: Partial<DesktopLyricState> = {
          text: data.currentText || 'Mineradio',
          progress: data.currentProgress || 0,
          progressSpan: data.progressSpan || 4.8,
          playing: data.playing || false,
          playbackTime: data.playbackTime || 0,
          playbackDuration: data.playbackDuration || 0,
          playbackRate: data.playbackRate || 1,
          enabled: true,
        }
        desktopLyricsRef.value.applyState(state)
        desktopLyricsRef.value.updateNextText(data.nextText || '')
        
        if (desktopLyricsRef.value.totalProgress !== undefined) {
          ;(desktopLyricsRef.value as any).totalProgress = data.totalProgress || 0
        }
        if (desktopLyricsRef.value.isPlaying !== undefined) {
          ;(desktopLyricsRef.value as any).isPlaying = data.playing || false
        }
        if (desktopLyricsRef.value.songInfo !== undefined) {
          ;(desktopLyricsRef.value as any).songInfo = data.songInfo || null
        }
      }
    }

    function handlePlayState(data: any) {
      if (desktopLyricsRef.value) {
        desktopLyricsRef.value.applyState({
          playing: data.playing || false,
        })
        if (desktopLyricsRef.value.isPlaying !== undefined) {
          ;(desktopLyricsRef.value as any).isPlaying = data.playing || false
        }
      }
    }

    function handleSettingsChange(settings: Partial<DesktopLyricsSettings>) {
      if (desktopLyricsRef.value) {
        desktopLyricsRef.value.applySettings(settings)
      }
    }

    function handleEnabledState(payload: any) {
      if (desktopLyricsRef.value) {
        desktopLyricsRef.value.applyState({
          enabled: payload?.enabled ?? false,
        })
      }
      if (!payload?.enabled) {
        document.body.classList.remove('show')
      }
    }

    function handleLockState(payload: any) {
      if (desktopLyricsRef.value) {
        desktopLyricsRef.value.applySettings({
          locked: payload?.locked ?? true,
        })
      }
    }

    function handleGlobalTogglePlay() {
      handleTogglePlay()
    }

    function handleGlobalNext() {
      handleNext()
    }

    function handleGlobalPrev() {
      handlePrev()
    }

    onMounted(() => {
      document.body.classList.add('show')

      if (electronAPI?.desktopLyrics) {
        removeOnState = electronAPI.desktopLyrics.onState?.((state: any) => {
          if (desktopLyricsRef.value) {
            desktopLyricsRef.value.applyState(state)
          }
        })

        removeOnLyricsData = electronAPI.desktopLyrics.onLyricsData?.(handleLyricsData)
        removeOnPlayState = electronAPI.desktopLyrics.onPlayState?.(handlePlayState)
        removeOnSettingsChange = electronAPI.desktopLyrics.onSettingsChange?.(handleSettingsChange)
        removeOnEnabledState = electronAPI.desktopLyrics.onEnabledState?.(handleEnabledState)
        removeOnLockState = electronAPI.desktopLyrics.onLockState?.(handleLockState)
      }

      if (electronAPI) {
        removeOnTogglePlay = electronAPI.onTogglePlay?.(handleGlobalTogglePlay)
        removeOnNext = electronAPI.onNext?.(handleGlobalNext)
        removeOnPrev = electronAPI.onPrev?.(handleGlobalPrev)
      }

      if (desktopLyricsRef.value) {
        desktopLyricsRef.value.applyState({ enabled: true })
      }
    })

    onUnmounted(() => {
      removeOnState?.()
      removeOnLyricsData?.()
      removeOnPlayState?.()
      removeOnSettingsChange?.()
      removeOnEnabledState?.()
      removeOnLockState?.()
      removeOnTogglePlay?.()
      removeOnNext?.()
      removeOnPrev?.()
    })

    return {
      desktopLyricsRef,
      handleClose,
      handleLockChange,
      handleTogglePlay,
      handlePrev,
      handleNext,
      handleOpenSettings,
    }
  },
  template: `
    <DesktopLyrics
      ref="desktopLyricsRef"
      @close="handleClose"
      @lock-change="handleLockChange"
      @toggle-play="handleTogglePlay"
      @prev="handlePrev"
      @next="handleNext"
      @open-settings="handleOpenSettings"
    />
  `,
}

const app = createApp(App)
app.mount('#app')
