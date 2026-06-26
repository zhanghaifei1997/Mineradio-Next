import { onMounted, onUnmounted, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'

const electronAPI = (typeof window !== 'undefined') ? (window as any).electronAPI : null

export function useTaskbar() {
  const player = usePlayerStore()

  function isAvailable(): boolean {
    return !!(electronAPI?.taskbar && electronAPI?.isDesktop)
  }

  function updateThumbarButtons() {
    if (!isAvailable()) return

    const buttons = [
      {
        id: 'prev',
        tooltip: '上一首',
        icon: 'prev',
        flags: ['enabled'],
      },
      {
        id: 'play-pause',
        tooltip: player.isPlaying ? '暂停' : '播放',
        icon: player.isPlaying ? 'pause' : 'play',
        flags: ['enabled'],
      },
      {
        id: 'next',
        tooltip: '下一首',
        icon: 'next',
        flags: ['enabled'],
      },
    ]

    try {
      electronAPI.taskbar.setThumbarButtons(buttons)
    } catch (e) {
      console.warn('Failed to update thumbar buttons:', e)
    }
  }

  function updateProgress() {
    if (!isAvailable()) return
    if (player.duration <= 0) {
      try {
        electronAPI.taskbar.setProgressBar(0, { mode: 'none' })
      } catch (e) {
        console.warn('Failed to reset progress bar:', e)
      }
      return
    }

    const progress = player.currentTime / player.duration
    try {
      electronAPI.taskbar.setProgressBar(progress, {
        mode: player.isPlaying ? 'normal' : 'paused',
      })
    } catch (e) {
      console.warn('Failed to update progress bar:', e)
    }
  }

  function updateOverlayIcon() {
    if (!isAvailable()) return

    try {
      if (player.isPlaying) {
        electronAPI.taskbar.setOverlayIcon('play', '正在播放')
      } else if (player.currentSong) {
        electronAPI.taskbar.setOverlayIcon('pause', '已暂停')
      } else {
        electronAPI.taskbar.setOverlayIcon(null, '')
      }
    } catch (e) {
      console.warn('Failed to update overlay icon:', e)
    }
  }

  function setupTaskbarListeners() {
    if (!isAvailable()) return

    try {
      electronAPI.taskbar.onButtonClicked((buttonId: string) => {
        switch (buttonId) {
          case 'prev':
            player.prev()
            break
          case 'play-pause':
            if (player.isPlaying) {
              player.pause()
            } else {
              player.play()
            }
            break
          case 'next':
            player.next()
            break
        }
      })
    } catch (e) {
      console.warn('Failed to setup taskbar listeners:', e)
    }
  }

  function initTaskbar() {
    if (!isAvailable()) return
    updateThumbarButtons()
    updateProgress()
    updateOverlayIcon()
    setupTaskbarListeners()
  }

  let progressInterval: number | null = null

  function startProgressUpdater() {
    if (progressInterval) return
    progressInterval = window.setInterval(() => {
      if (player.isPlaying) {
        updateProgress()
      }
    }, 1000)
  }

  function stopProgressUpdater() {
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
  }

  watch(
    () => player.isPlaying,
    () => {
      updateThumbarButtons()
      updateOverlayIcon()
      updateProgress()
      if (player.isPlaying) {
        startProgressUpdater()
      } else {
        stopProgressUpdater()
      }
    }
  )

  watch(
    () => player.currentSong,
    () => {
      updateThumbarButtons()
      updateOverlayIcon()
      updateProgress()
    }
  )

  onMounted(() => {
    initTaskbar()
    if (player.isPlaying) {
      startProgressUpdater()
    }
  })

  onUnmounted(() => {
    stopProgressUpdater()
  })

  return {
    isAvailable,
    updateThumbarButtons,
    updateProgress,
    updateOverlayIcon,
  }
}
