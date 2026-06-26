import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { useFxStore } from '@/stores/fx'
import { useHintStore } from '@/stores/hint'
import type { MusicSource } from '@/types'

export interface StartupState {
  isInitialized: boolean
  isStartingUp: boolean
  splashVisible: boolean
  loginRefreshed: boolean
  playlistsLoaded: boolean
  shelfInitialized: boolean
  visualPreviewActive: boolean
  startupProgress: number
  error: string | null
}

let startupStarted = false
let startupState: StartupState | null = null

export function useAppStartup() {
  const player = usePlayerStore()
  const user = useUserStore()
  const fx = useFxStore()
  const hint = useHintStore()

  if (!startupState) {
    startupState = {
      isInitialized: false,
      isStartingUp: false,
      splashVisible: true,
      loginRefreshed: false,
      playlistsLoaded: false,
      shelfInitialized: false,
      visualPreviewActive: false,
      startupProgress: 0,
      error: null,
    }
  }

  const state = ref<StartupState>(startupState)

  const isReady = computed(() => state.value.isInitialized && !state.value.isStartingUp)

  function updateProgress(progress: number) {
    state.value.startupProgress = Math.max(0, Math.min(100, progress))
  }

  async function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([
      promise,
      new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
    ])
  }

  async function refreshLoginStatus(): Promise<void> {
    try {
      const result = await timeoutPromise(
        user.refreshLoginStatus(5000),
        5500
      )

      state.value.loginRefreshed = true

      if (result && result.newlyLoggedIn.length > 0) {
        const primarySource = result.newlyLoggedIn[0]
        const account = user.getAccount(primarySource)
        if (account.profile) {
          hint.showGeneralHint(
            `欢迎 ${account.profile.nickname}`,
            '登录成功',
            4000
          )
        }
      }
    } catch (e) {
      console.warn('[AppStartup] Login refresh failed:', e)
      state.value.loginRefreshed = true
    }
  }

  async function loadUserPlaylists(): Promise<void> {
    if (!user.isLoggedIn) {
      state.value.playlistsLoaded = true
      return
    }

    try {
      await timeoutPromise(
        user.fetchAllUserPlaylists(),
        8000
      )
      state.value.playlistsLoaded = true
    } catch (e) {
      console.warn('[AppStartup] Failed to load user playlists:', e)
      state.value.playlistsLoaded = true
    }
  }

  function initializeShelf(): void {
    state.value.shelfInitialized = true
  }

  function startVisualPreview(): void {
    if (player.isPlaying) return
    if (state.value.visualPreviewActive) return

    if (fx.homeWallpaperEnabled && fx.homeWallpaperPreset) {
      fx.preset = fx.homeWallpaperPreset
    }

    player.startStartupVisualPreview()
    state.value.visualPreviewActive = true
  }

  function stopVisualPreview(): void {
    if (!state.value.visualPreviewActive) return

    player.stopStartupVisualPreview()
    state.value.visualPreviewActive = false
  }

  function toggleVisualPreview(force?: boolean): void {
    const shouldActivate = force !== undefined ? force : !state.value.visualPreviewActive
    if (shouldActivate) {
      startVisualPreview()
    } else {
      stopVisualPreview()
    }
  }

  async function startInitialization(): Promise<void> {
    if (startupStarted) return
    startupStarted = true

    state.value.isStartingUp = true
    state.value.startupProgress = 0

    try {
      updateProgress(10)

      const loginPromise = refreshLoginStatus()

      updateProgress(20)

      updateProgress(30)

      await Promise.all([
        loginPromise,
      ])

      updateProgress(50)

      await loadUserPlaylists()
      updateProgress(70)

      initializeShelf()
      updateProgress(85)

      startVisualPreview()
      updateProgress(95)

      state.value.isInitialized = true
      updateProgress(100)
    } catch (e) {
      console.error('[AppStartup] Initialization error:', e)
      state.value.error = e instanceof Error ? e.message : 'Unknown error'
      state.value.isInitialized = true
    } finally {
      state.value.isStartingUp = false
    }
  }

  function dismissSplash(): void {
    state.value.splashVisible = false
  }

  function handleSplashEnter(): void {
    dismissSplash()

    if (state.value.isInitialized) {
      startVisualPreview()
    }
  }

  function reset(): void {
    startupStarted = false
    startupState = {
      isInitialized: false,
      isStartingUp: false,
      splashVisible: true,
      loginRefreshed: false,
      playlistsLoaded: false,
      shelfInitialized: false,
      visualPreviewActive: false,
      startupProgress: 0,
      error: null,
    }
    state.value = startupState
  }

  return {
    state,
    isReady,
    startInitialization,
    dismissSplash,
    handleSplashEnter,
    startVisualPreview,
    stopVisualPreview,
    toggleVisualPreview,
    refreshLoginStatus,
    loadUserPlaylists,
    initializeShelf,
    reset,
  }
}
