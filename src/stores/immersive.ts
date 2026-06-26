import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useImmersiveStore = defineStore('immersive', () => {
  const isImmersive = ref(false)
  const showControls = ref(false)
  let hideControlsTimer: number | null = null

  function enter() {
    isImmersive.value = true
    document.body.classList.add('immersive-mode')
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }
  }

  function exit() {
    isImmersive.value = false
    document.body.classList.remove('immersive-mode')
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
    resetHideTimer()
  }

  function toggle() {
    if (isImmersive.value) {
      exit()
    } else {
      enter()
    }
  }

  function showPlayerControls() {
    showControls.value = true
    resetHideTimer()
  }

  function hidePlayerControls() {
    showControls.value = false
    if (hideControlsTimer) {
      clearTimeout(hideControlsTimer)
      hideControlsTimer = null
    }
  }

  function resetHideTimer() {
    if (hideControlsTimer) {
      clearTimeout(hideControlsTimer)
    }
    hideControlsTimer = window.setTimeout(() => {
      if (isImmersive.value) {
        showControls.value = false
      }
    }, 2000)
  }

  function handleMouseMove() {
    if (!isImmersive.value) return
    showControls.value = true
    resetHideTimer()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isImmersive.value) {
      exit()
    }
    if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') || e.key === 'F11') {
      e.preventDefault()
      toggle()
    }
  }

  function setupListeners() {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('keydown', handleKeydown)
  }

  function cleanupListeners() {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('keydown', handleKeydown)
    if (hideControlsTimer) {
      clearTimeout(hideControlsTimer)
    }
  }

  return {
    isImmersive,
    showControls,
    enter,
    exit,
    toggle,
    showPlayerControls,
    hidePlayerControls,
    setupListeners,
    cleanupListeners,
  }
})
