<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, computed, defineAsyncComponent, Suspense } from 'vue'
import VisualCanvas from '@/components/visual/VisualCanvas.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
import StageLyrics from '@/components/lyrics/StageLyrics.vue'
import VisualConsole from '@/components/visual/VisualConsole.vue'
import UserCapsule from '@/components/user/UserCapsule.vue'
import UpdateEntryButton from '@/components/settings/UpdateEntryButton.vue'
import DjModeIndicator from '@/components/dj/DjModeIndicator.vue'
import MiniPlayer from '@/components/player/MiniPlayer.vue'
import FMModeIndicator from '@/components/fm/FMModeIndicator.vue'
import StatusChips from '@/components/status/StatusChips.vue'
import IdleGuide from '@/components/guide/IdleGuide.vue'
import SourceFallbackNotice from '@/components/player/SourceFallbackNotice.vue'
import BannerNotice from '@/components/common/BannerNotice.vue'
import SplashScreen from '@/components/common/SplashScreen.vue'
import DesktopTitlebar from '@/components/common/DesktopTitlebar.vue'
import HintToast from '@/components/common/HintToast.vue'
import CentralHint from '@/components/common/CentralHint.vue'
import CustomBgVideo from '@/components/visual/CustomBgVideo.vue'
import VisualGuide from '@/components/guide/VisualGuide.vue'
import BottomHandle from '@/components/player/BottomHandle.vue'
import ImmersivePlayer from '@/components/player/ImmersivePlayer.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import Toast from '@/components/common/Toast.vue'
import DropOverlay from '@/components/common/DropOverlay.vue'

const SearchPanel = defineAsyncComponent(() => import('@/components/search/SearchPanel.vue'))
const PlaylistShelf = defineAsyncComponent(() => import('@/components/playlist/PlaylistShelf.vue'))
const SettingsPanel = defineAsyncComponent(() => import('@/components/settings/SettingsPanel.vue'))
const PlaylistQueue = defineAsyncComponent(() => import('@/components/playlist/PlaylistQueue.vue'))
const LocalMusicPanel = defineAsyncComponent(() => import('@/components/local/LocalMusicPanel.vue'))
const RecentPanel = defineAsyncComponent(() => import('@/components/history/RecentPanel.vue'))
const TopListPanel = defineAsyncComponent(() => import('@/components/toplist/TopListPanel.vue'))
const DailyRecommend = defineAsyncComponent(() => import('@/components/recommend/DailyRecommend.vue'))
const ArtistDetail = defineAsyncComponent(() => import('@/components/artist/ArtistDetail.vue'))
const AlbumDetail = defineAsyncComponent(() => import('@/components/album/AlbumDetail.vue'))
const SongComments = defineAsyncComponent(() => import('@/components/comments/SongComments.vue'))
const SongDetail = defineAsyncComponent(() => import('@/components/song/SongDetail.vue'))
const HomePanel = defineAsyncComponent(() => import('@/components/home/HomePanel.vue'))
const WeatherRadio = defineAsyncComponent(() => import('@/components/weather/WeatherRadio.vue'))
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { useUserStore } from '@/stores/user'
import { useHistoryStore } from '@/stores/history'
import { useFMStore } from '@/stores/fm'
import { useThemeStore } from '@/stores/theme'
import { useNotificationStore } from '@/stores/notification'
import { useImmersiveStore } from '@/stores/immersive'
import { useHintStore } from '@/stores/hint'
import { useCustomBgStore } from '@/stores/customBg'
import { useDragDrop } from '@/composables/useDragDrop'
import { useTaskbar } from '@/composables/useTaskbar'
import { useAppStartup } from '@/composables/useAppStartup'
import { useInlineHotkeys } from '@/composables/useInlineHotkeys'
import { usePanelPeek } from '@/composables/usePanelPeek'
import { providerManager } from '@/modules/providers'
import type { LyricLine } from '@/modules/lyrics'
import type { Artist, Album } from '@/types'

const player = usePlayerStore()
const fx = useFxStore()
const lyrics = useLyricsStore()
const user = useUserStore()
const history = useHistoryStore()
const fm = useFMStore()
const theme = useThemeStore()
const notification = useNotificationStore()
const immersive = useImmersiveStore()
const hint = useHintStore()
const customBg = useCustomBgStore()
const { isDragging } = useDragDrop()
useTaskbar()
const appStartup = useAppStartup()

// 面板 Peek 系统（setPeek 在下方调用，先取得实例）
const panelPeek = usePanelPeek()

const showSplash = ref(true)
const showQueuePanel = ref(false)
const showLocalPanel = ref(false)
const showRecentPanel = ref(false)
const showSettings = ref(false)
const showVisualConsole = ref(false)
const showLogin = ref(false)
const showTopList = ref(false)
const showDailyRecommend = ref(false)
const showWeatherRadio = ref(false)
const isMiniMode = ref(false)
const showHome = ref(true)

const showArtistDetail = ref(false)
const showAlbumDetail = ref(false)
const showSongComments = ref(false)
const showSongDetail = ref(false)
const showFreeCameraHint = ref(false)
const showVisualGuide = ref(false)
const visualGuideRef = ref<InstanceType<typeof VisualGuide> | null>(null)

const currentArtistId = ref<string | null>(null)
const currentArtistSource = ref('netease')
const currentAlbumId = ref<string | null>(null)
const currentAlbumSource = ref('netease')
const currentCommentSongId = ref<string | null>(null)
const currentCommentSource = ref('netease')
const currentSongDetailId = ref<string | null>(null)
const currentSongDetailSource = ref('netease')

let rafId: number | null = null

const electronAPI = (window as any).electronAPI

let hideControlsTimer: ReturnType<typeof setTimeout> | null = null
const BOTTOM_HOTZONE_HEIGHT = 28

function showControls() {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
    hideControlsTimer = null
  }
  document.body.classList.add('controls-visible')
}

function hideControlsDelayed() {
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  hideControlsTimer = setTimeout(() => {
    document.body.classList.remove('controls-visible')
    hideControlsTimer = null
  }, fx.controlsHideDelay)
}

function handleMouseMoveForControls(e: MouseEvent) {
  if (!fx.controlsAutoHide) return

  const windowHeight = window.innerHeight
  const mouseY = e.clientY

  const playerBar = document.querySelector('.player-bar')
  if (playerBar) {
    const rect = playerBar.getBoundingClientRect()
    if (
      mouseY >= rect.top - 10 &&
      mouseY <= rect.bottom + 10 &&
      e.clientX >= rect.left &&
      e.clientX <= rect.right
    ) {
      showControls()
      return
    }
  }

  if (mouseY >= windowHeight - BOTTOM_HOTZONE_HEIGHT) {
    showControls()
  } else {
    hideControlsDelayed()
  }
}

function handleBottomHandleClick() {
  showControls()
}

function updateControlsAutoHideClass() {
  if (fx.controlsAutoHide) {
    document.body.classList.add('controls-auto-hide')
    document.body.classList.remove('controls-visible')
  } else {
    document.body.classList.remove('controls-auto-hide')
    document.body.classList.add('controls-visible')
  }
}

let userCapsulePeekTimer: ReturnType<typeof setTimeout> | null = null
const TOP_RIGHT_HOTZONE_SIZE = 80

function handleMouseMoveForUserCapsule(e: MouseEvent) {
  if (!fx.userCapsuleAutoHide) return

  const mouseX = e.clientX
  const mouseY = e.clientY
  const windowWidth = window.innerWidth

  if (
    mouseX >= windowWidth - TOP_RIGHT_HOTZONE_SIZE &&
    mouseY <= TOP_RIGHT_HOTZONE_SIZE
  ) {
    document.body.classList.add('user-capsule-peek')
  } else {
    const userCapsule = document.querySelector('.user-capsule-wrapper')
    if (userCapsule) {
      const rect = userCapsule.getBoundingClientRect()
      const extendedLeft = rect.left - 80
      if (
        mouseX >= extendedLeft &&
        mouseX <= rect.right + 10 &&
        mouseY >= rect.top - 10 &&
        mouseY <= rect.bottom + 10
      ) {
        document.body.classList.add('user-capsule-peek')
        return
      }
    }
    document.body.classList.remove('user-capsule-peek')
  }
}

function updateUserCapsuleAutoHideClass() {
  if (fx.userCapsuleAutoHide) {
    document.body.classList.add('user-capsule-auto-hide')
    document.body.classList.remove('user-capsule-peek')
  } else {
    document.body.classList.remove('user-capsule-auto-hide')
    document.body.classList.remove('user-capsule-peek')
  }
}

function updateFxFabAutoHideClass() {
  if (fx.fxFabAutoHide) {
    document.body.classList.add('fx-fab-auto-hide')
  } else {
    document.body.classList.remove('fx-fab-auto-hide')
  }
}

function handleGlobalMouseMove(e: MouseEvent) {
  handleMouseMoveForControls(e)
  handleMouseMoveForUserCapsule(e)
  handleMouseMoveForPanelPeek(e)
}

const currentLyricText = computed(() => {
  if (lyrics.lines.length === 0) return 'Mineradio'
  const line = lyrics.lines[lyrics.currentIndex]
  return line?.text || 'Mineradio'
})

const nextLyricText = computed(() => {
  const nextIndex = lyrics.currentIndex + 1
  if (nextIndex >= lyrics.lines.length) return ''
  return lyrics.lines[nextIndex]?.text || ''
})

const songInfoText = computed(() => {
  if (!player.currentSong) return ''
  const artists = player.currentSong.artists?.map((a: any) => a.name).join(' / ') || ''
  return `${player.currentSong.name} - ${artists}`
})

function toggleQueuePanel() {
  showQueuePanel.value = !showQueuePanel.value
  if (showQueuePanel.value) {
    showLocalPanel.value = false
    showRecentPanel.value = false
  }
}

function toggleLocalPanel() {
  showLocalPanel.value = !showLocalPanel.value
  if (showLocalPanel.value) {
    showQueuePanel.value = false
    showRecentPanel.value = false
  }
}

function toggleRecentPanel() {
  showRecentPanel.value = !showRecentPanel.value
  if (showRecentPanel.value) {
    showQueuePanel.value = false
    showLocalPanel.value = false
  }
}

function toggleSettings() {
  showSettings.value = !showSettings.value
}

function toggleVisualConsole() {
  showVisualConsole.value = !showVisualConsole.value
}

// ============================================================
// 面板 Peek 系统：search(顶部) / fx(右侧) / playlist(左侧) 三个面板的半隐藏
// ============================================================
const PEEK_TOP_HOTZONE = 80      // 顶部触发区高度
const PEEK_RIGHT_HOTZONE = 48    // 右侧触发区宽度
const PEEK_LEFT_HOTZONE = 48     // 左侧触发区宽度

function isPointOverPanel(e: MouseEvent, selector: string): boolean {
  const el = document.querySelector(selector)
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return (
    e.clientX >= rect.left - 12 &&
    e.clientX <= rect.right + 12 &&
    e.clientY >= rect.top - 12 &&
    e.clientY <= rect.bottom + 12
  )
}

function handleMouseMoveForPanelPeek(e: MouseEvent) {
  // 沉浸模式下整体隐藏面板，不需要 peek
  if (immersive.isImmersive) return

  const w = window.innerWidth
  const x = e.clientX
  const y = e.clientY

  // 搜索面板：顶部触发区 + 面板本身
  const overSearchPanel = isPointOverPanel(e, '.search-panel')
  if (y < PEEK_TOP_HOTZONE || overSearchPanel) {
    panelPeek.setPeek('search', true)
  } else {
    panelPeek.setPeek('search', false)
  }

  // FX 视觉控制台：右侧触发区 + 面板本身（仅 DIY 模式下生效）
  const overFxConsole = isPointOverPanel(e, '.visual-console')
  if (fx.layoutMode === 'diy' && (x >= w - PEEK_RIGHT_HOTZONE || overFxConsole)) {
    panelPeek.setPeek('fx', true)
  } else {
    panelPeek.setPeek('fx', false)
  }

  // 歌单/队列面板：左侧触发区 + 面板本身
  const overPlaylistShelf = isPointOverPanel(e, '.playlist-shelf')
  const overQueuePanel = isPointOverPanel(e, '.queue-panel')
  if (x < PEEK_LEFT_HOTZONE || overPlaylistShelf || overQueuePanel) {
    panelPeek.setPeek('playlist', true)
  } else {
    panelPeek.setPeek('playlist', false)
  }
}

// ============================================================
// 内嵌快捷键系统
// ============================================================
function closeAllPanelsAndModals() {
  showQueuePanel.value = false
  showLocalPanel.value = false
  showRecentPanel.value = false
  showSettings.value = false
  showVisualConsole.value = false
  showLogin.value = false
  showTopList.value = false
  showDailyRecommend.value = false
  showWeatherRadio.value = false
  showArtistDetail.value = false
  showAlbumDetail.value = false
  showSongComments.value = false
  showSongDetail.value = false
  showVisualGuide.value = false
}

useInlineHotkeys({
  goHome: () => {
    closeAllPanelsAndModals()
    showHome.value = true
  },
  closeAllPanels: closeAllPanelsAndModals,
  toggleLyricsPanel: () => {
    lyrics.toggleStageLyrics()
  },
  toggleFxConsole: () => {
    toggleVisualConsole()
  },
})

function toggleTopList() {
  showTopList.value = !showTopList.value
}

function toggleDailyRecommend() {
  showDailyRecommend.value = !showDailyRecommend.value
}

function toggleWeatherRadio() {
  showWeatherRadio.value = !showWeatherRadio.value
}

function toggleHome() {
  showHome.value = !showHome.value
}

function openArtistDetail(artist: Artist, source?: string) {
  currentArtistId.value = artist.id
  currentArtistSource.value = source || 'netease'
  showArtistDetail.value = true
}

function closeArtistDetail() {
  showArtistDetail.value = false
}

function openAlbumDetail(album: Album, source?: string) {
  currentAlbumId.value = album.id
  currentAlbumSource.value = source || 'netease'
  showAlbumDetail.value = true
}

function closeAlbumDetail() {
  showAlbumDetail.value = false
}

function openSongComments(songId: string, source?: string) {
  currentCommentSongId.value = songId
  currentCommentSource.value = source || 'netease'
  showSongComments.value = true
}

function closeSongComments() {
  showSongComments.value = false
}

function openSongDetail(songId: string, source?: string) {
  currentSongDetailId.value = songId
  currentSongDetailSource.value = source || 'netease'
  showSongDetail.value = true
}

function closeSongDetail() {
  showSongDetail.value = false
}

function handleArtistFromAlbum(artist: Artist) {
  closeAlbumDetail()
  openArtistDetail(artist, currentAlbumSource.value)
}

function handleAlbumFromArtist(album: Album) {
  closeArtistDetail()
  openAlbumDetail(album, currentArtistSource.value)
}

function handleArtistFromSongDetail(artist: Artist) {
  closeSongDetail()
  openArtistDetail(artist, currentSongDetailSource.value)
}

function handleAlbumFromSongDetail(album: Album) {
  closeSongDetail()
  openAlbumDetail(album, currentSongDetailSource.value)
}

function handleCommentsFromSongDetail() {
  if (currentSongDetailId.value) {
    openSongComments(currentSongDetailId.value, currentSongDetailSource.value)
  }
}

function toggleFMMode() {
  if (fm.isFMMode) {
    fm.stopFM()
  } else {
    fm.startFM()
  }
}

function toggleLyrics() {
  lyrics.toggleStageLyrics()
}

function toggleMiniMode() {
  isMiniMode.value = !isMiniMode.value
  if (electronAPI?.window?.setMiniMode) {
    electronAPI.window.setMiniMode(isMiniMode.value)
  }
}

function handleSplashEnter() {
  showSplash.value = false
  appStartup.handleSplashEnter()
}

function syncDesktopLyrics() {
  if (!electronAPI?.desktopLyrics) return
  
  const data = {
    currentText: currentLyricText.value,
    nextText: nextLyricText.value,
    currentProgress: lyrics.currentProgress,
    progressSpan: 4.8,
    playing: player.isPlaying,
    playbackTime: player.currentTime,
    playbackDuration: player.duration,
    playbackRate: 1,
    songInfo: songInfoText.value,
    songName: player.currentSong?.name || '',
    artistName: player.currentSong?.artists?.map((a: any) => a.name).join(' / ') || '',
    coverUrl: player.currentSong?.coverUrl || '',
  }
  
  electronAPI.desktopLyrics.sendToOverlay('lyrics', data)
}

function openLogin() {
  showLogin.value = true
}

function closeLogin() {
  showLogin.value = false
}

function openVisualGuide() {
  showVisualGuide.value = true
  if (visualGuideRef.value) {
    visualGuideRef.value.restart()
  }
}

async function loadLyricsForSong(songId: string, source: string) {
  try {
    const provider = providerManager.get(source) || providerManager.default
    const lyricData = await provider.getLyric(songId)
    
    if (lyricData && lyricData.lines && lyricData.lines.length > 0) {
      const convertedLines: LyricLine[] = lyricData.lines.map((line: any) => ({
        t: line.time || line.t || 0,
        duration: line.duration || 0,
        text: line.text || '',
        translation: line.translation || '',
        words: line.words || [],
        source: line.source || (lyricData.hasTranslation ? 'yrc' : 'lrc'),
      }))
      
      lyrics.setOriginalLyrics({
        lines: convertedLines,
        hasNativeKaraoke: lyricData.hasTranslation != null ? false : true,
        timingSource: lyricData.hasTranslation != null ? 'yrc' : 'lrc',
        hasTranslation: !!lyricData.hasTranslation,
      })
      lyrics.applyOriginalLyrics()
    } else {
      lyrics.clear()
    }
  } catch (e) {
    console.error('Load lyrics failed:', e)
    lyrics.clear()
  }
}

function updateLyricsProgress() {
  if (player.isPlaying && lyrics.lines.length > 0) {
    lyrics.update(player.currentTime, player.duration)
  }
  syncDesktopLyrics()
  rafId = requestAnimationFrame(updateLyricsProgress)
}

function updateMediaSession() {
  if ('mediaSession' in navigator && player.currentSong) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: player.currentSong.name,
      artist: player.currentSong.artists?.map((a: any) => a.name).join(' / ') || '',
      album: player.currentSong.album || '',
      artwork: player.currentSong.coverUrl
        ? [{ src: player.currentSong.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
    
    navigator.mediaSession.playbackState = player.isPlaying ? 'playing' : 'paused'
  }
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return
  
  navigator.mediaSession.setActionHandler('play', () => {
    player.play()
  })
  
  navigator.mediaSession.setActionHandler('pause', () => {
    player.pause()
  })
  
  navigator.mediaSession.setActionHandler('previoustrack', () => {
    player.prev()
  })
  
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    player.next()
  })
}

watch(
  () => player.currentSong,
  (song) => {
    if (song) {
      loadLyricsForSong(song.id, song.source)
      history.addToHistory(song)
      user.addToRecentPlayed(song)
      notification.notifyTrackChange(song)
      const artistName = song.artists?.map((a: any) => a.name).join(' / ')
      hint.showSongHint(song.name, artistName)
    } else {
      lyrics.clear()
    }
    updateMediaSession()
  }
)

watch(
  () => player.isPlaying,
  () => {
    updateMediaSession()
  }
)

watch(
  () => fx.settings.layoutMode,
  (mode) => {
    updateLayoutModeClass(mode)
  },
  { immediate: true }
)

watch(
  () => fx.controlsAutoHide,
  () => {
    updateControlsAutoHideClass()
  },
  { immediate: true }
)

watch(
  () => fx.userCapsuleAutoHide,
  () => {
    updateUserCapsuleAutoHideClass()
  },
  { immediate: true }
)

watch(
  () => fx.fxFabAutoHide,
  () => {
    updateFxFabAutoHideClass()
  },
  { immediate: true }
)

watch(
  () => fx.freeCameraEnabled,
  (enabled) => {
    if (enabled) {
      showFreeCameraHint.value = true
    }
  }
)

function updateLayoutModeClass(mode: string) {
  if (typeof document === 'undefined' || !document.body) return
  document.body.classList.toggle('simple-mode', mode === 'simple')
  document.body.classList.toggle('diy-mode', mode === 'diy')
}

onMounted(() => {
  player.initAudio()
  updateLyricsProgress()
  setupMediaSession()
  immersive.setupListeners()
  document.addEventListener('mousemove', handleGlobalMouseMove)

  setTimeout(() => {
    appStartup.startInitialization()
  }, 100)
})

onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
  immersive.cleanupListeners()
  document.removeEventListener('mousemove', handleGlobalMouseMove)
  if (hideControlsTimer) {
    clearTimeout(hideControlsTimer)
  }
  panelPeek.cleanup()
})
</script>

<template>
  <div class="app-container" :class="{ 'fx-eco': fx.settings.performanceQuality === 'eco', 'mini-mode': isMiniMode, 'drag-over': isDragging }">
    <CustomBgVideo v-if="!isMiniMode" />
    <CentralHint v-if="!isMiniMode" />
    <Toast
      v-if="!isMiniMode"
      :visible="hint.toast.show"
      :message="hint.toast.message"
      :duration="hint.toast.duration"
      @close="hint.hideToast"
    />

    <DesktopTitlebar 
      @open-settings="showSettings = true" 
      @toggle-guide="openVisualGuide"
    />

    <Transition name="splash-fade">
      <SplashScreen 
        v-if="showSplash" 
        :show-dont-show-again="true"
        @enter="handleSplashEnter"
      />
    </Transition>

    <BannerNotice
      id="welcome-trial"
      type="trial"
      icon="✨"
      title="欢迎使用 Mineradio Next"
      message="全新沉浸式音乐体验，DIY 模式等你探索"
      link-text="了解更多"
      link-url="https://github.com/XxHuberrr/Mineradio"
    />

    <DropOverlay :visible="isDragging" />
    <template v-if="!isMiniMode">
      <VisualCanvas />

      <StageLyrics
        :visible="lyrics.stageEnabled"
        :lines="lyrics.lines"
        :current-time="player.currentTime"
        :duration="player.duration"
        :playing="player.isPlaying"
        :current-index="lyrics.currentIndex"
        :progress="lyrics.currentProgress"
        :palette="lyrics.palette"
        :size="lyrics.layout.size"
        :vertical-position="lyrics.layout.verticalPosition"
        :horizontal-position="lyrics.layout.horizontalPosition"
        :depth-position="lyrics.layout.depthPosition"
        :rotation-x="lyrics.layout.rotationX"
        :rotation-y="lyrics.layout.rotationY"
        :highlight-follow="lyrics.layout.highlightFollow"
        :feather="lyrics.style.feather"
        :font-family="lyrics.style.fontFamily"
        :font-weight="lyrics.style.fontWeight"
        :letter-spacing="lyrics.style.letterSpacing"
        :line-height="lyrics.style.lineHeight"
        :lyric-glow="lyrics.glow.enabled"
        :lyric-glow-beat="lyrics.glow.beatSync"
        :lyric-glow-strength="lyrics.glow.strength"
        :lyric-glow-particles="lyrics.glow.particles"
        :high-bloom="lyrics.glow.highBloom"
        :beat-glow="lyrics.glow.beatGlow"
        :cinema="lyrics.layout.cinema"
        :opacity="lyrics.style.opacity"
        :stroke-enabled="lyrics.stroke.enabled"
        :stroke-color="lyrics.stroke.color"
        :stroke-width="lyrics.stroke.width"
        :shadow-enabled="lyrics.shadow.enabled"
        :shadow-color="lyrics.shadow.color"
        :shadow-blur="lyrics.shadow.blur"
        :shadow-offset-x="lyrics.shadow.offsetX"
        :shadow-offset-y="lyrics.shadow.offsetY"
        :camera-bind="lyrics.cameraBind"
      />

      <VisualConsole
        :visible="showVisualConsole"
        @close="showVisualConsole = false"
      />

      <div class="app-content">
        <div class="top-toolbar">
          <div class="top-toolbar__left">
            <button class="icon-btn home-btn" :class="{ active: showHome }" @click="toggleHome" :title="showHome ? '隐藏首页' : '显示首页'">
              🏠
            </button>
            <DjModeIndicator />
            <FMModeIndicator @toggle="toggleFMMode" />
          </div>
          <div class="top-toolbar__right">
            <button class="icon-btn" @click="toggleWeatherRadio" title="天气电台">
              🌤️
            </button>
            <button class="icon-btn" @click="toggleDailyRecommend" title="每日推荐">
              📅
            </button>
            <button class="icon-btn" @click="toggleTopList" title="排行榜">
              🏆
            </button>
            <button class="icon-btn" @click="toggleRecentPanel" title="最近播放">
              🕐
            </button>
            <button class="icon-btn" @click="toggleLyrics" :title="lyrics.stageEnabled ? '隐藏歌词' : '显示歌词'">
              {{ lyrics.stageEnabled ? '🎵' : '🎤' }}
            </button>
            <button class="icon-btn" @click="toggleVisualConsole" :title="showVisualConsole ? '关闭视觉控制台' : '打开视觉控制台'">
              🎨
            </button>
            <button class="icon-btn" @click="theme.toggleTheme" :title="theme.mode === 'dark' ? '暗色模式' : theme.mode === 'light' ? '亮色模式' : '跟随系统'">
              {{ theme.isDark ? '🌙' : '☀️' }}
            </button>
            <button class="icon-btn" @click="toggleMiniMode" title="迷你模式">
              📱
            </button>
            <button class="icon-btn" @click="toggleSettings" title="设置">
              ⚙️
            </button>
            <button class="icon-btn help-btn" @click="openVisualGuide" title="使用引导">
              ❓
            </button>
            <UpdateEntryButton @click="showSettings = true" />
            <UserCapsule @open-login="openLogin" @open-recent="toggleRecentPanel" />
          </div>
        </div>

        <StatusChips v-if="fx.layoutMode === 'diy' || player.isPlaying" />

        <div class="source-fallback-container">
          <SourceFallbackNotice
            :notice="notification.currentFallbackNotice"
            @close="notification.dismissFallbackNotice()"
          />
        </div>

        <PlaylistShelf />
        <SearchPanel />

        <Suspense>
          <HomePanel
            v-if="showHome"
            @open-weather-radio="toggleWeatherRadio"
            @open-daily-recommend="toggleDailyRecommend"
            @open-fm="toggleFMMode"
            @open-toplist="toggleTopList"
            @open-playlist="() => {}"
          />
        </Suspense>

        <Suspense>
          <WeatherRadio v-if="showWeatherRadio" :visible="showWeatherRadio" @close="showWeatherRadio = false" />
        </Suspense>

        <SettingsPanel v-if="showSettings" @close="showSettings = false" />
        <TopListPanel v-if="showTopList" :visible="showTopList" @close="showTopList = false" />
        <DailyRecommend v-if="showDailyRecommend" :visible="showDailyRecommend" @close="showDailyRecommend = false" />

        <div class="side-panels">
          <Transition name="slide-right">
            <div v-if="showQueuePanel || fx.queuePinned" class="side-panel queue-panel" :class="{ 'queue-panel--pinned': fx.queuePinned }">
              <div class="panel-close" @click="showQueuePanel = false" v-if="!fx.queuePinned">✕</div>
              <PlaylistQueue />
            </div>
          </Transition>

          <Transition name="slide-right">
            <div v-if="showLocalPanel" class="side-panel local-panel">
              <div class="panel-close" @click="showLocalPanel = false">✕</div>
              <LocalMusicPanel />
            </div>
          </Transition>

          <Transition name="slide-right">
            <div v-if="showRecentPanel" class="side-panel recent-panel-container">
              <div class="panel-close" @click="showRecentPanel = false">✕</div>
              <RecentPanel @close="showRecentPanel = false" />
            </div>
          </Transition>
        </div>

        <Suspense>
          <ArtistDetail
            v-if="showArtistDetail"
            :artist-id="currentArtistId"
            :source="currentArtistSource"
            :visible="showArtistDetail"
            @close="closeArtistDetail"
            @open-album="handleAlbumFromArtist"
            @open-artist="(a) => openArtistDetail(a, currentArtistSource)"
          />
        </Suspense>

        <Suspense>
          <AlbumDetail
            v-if="showAlbumDetail"
            :album-id="currentAlbumId"
            :source="currentAlbumSource"
            :visible="showAlbumDetail"
            @close="closeAlbumDetail"
            @open-artist="handleArtistFromAlbum"
          />
        </Suspense>

        <Suspense>
          <SongComments
            v-if="showSongComments"
            :song-id="currentCommentSongId"
            :source="currentCommentSource"
            :visible="showSongComments"
            @close="closeSongComments"
          />
        </Suspense>

        <Suspense>
          <SongDetail
            v-if="showSongDetail"
            :song-id="currentSongDetailId"
            :source="currentSongDetailSource"
            :visible="showSongDetail"
            @close="closeSongDetail"
            @open-artist="handleArtistFromSongDetail"
            @open-album="handleAlbumFromSongDetail"
            @open-comments="handleCommentsFromSongDetail"
          />
        </Suspense>
      </div>

      <PlayerBar @show-queue="toggleQueuePanel" @show-local="toggleLocalPanel" />
      <BottomHandle v-if="fx.controlsAutoHide" @click="handleBottomHandleClick" />
      <ImmersivePlayer />
      <ContextMenu @open-settings="toggleSettings" @open-about="toggleSettings" />
      <IdleGuide />

      <HintToast
        v-if="!isMiniMode"
        :visible="showFreeCameraHint"
        title="自由相机模式"
        message="右键拖拽：旋转视角 · 滚轮：缩放 · WASD：移动 · 空格：重置视角 · F：退出"
        icon="🎥"
        position="bottom-left"
        :duration="6000"
        @close="showFreeCameraHint = false"
      />
    </template>

    <template v-else>
      <MiniPlayer @close="toggleMiniMode" @expand="toggleMiniMode" />
    </template>

    <VisualGuide
      ref="visualGuideRef"
      :visible="showVisualGuide"
      @close="showVisualGuide = false"
      @complete="showVisualGuide = false"
    />
  </div>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  transition: var(--transition-theme);
}

.app-content {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.app-content > * {
  pointer-events: auto;
}

.source-fallback-container {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  pointer-events: auto;
}

.top-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 20;
  pointer-events: none;
}

.top-toolbar__left,
.top-toolbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
  border: 1px solid var(--color-border);
}

.icon-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
  transform: scale(1.05);
}

.icon-btn.home-btn.active {
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(244, 210, 138, 0.3));
  border-color: rgba(217, 91, 103, 0.4);
  box-shadow: 0 0 16px rgba(217, 91, 103, 0.2);
}

.side-panels {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 88px;
  width: 420px;
  pointer-events: none;
  z-index: 50;
}

.side-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  bottom: 20px;
  width: 400px;
  pointer-events: auto;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  background: var(--color-surface);
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
  border: 1px solid var(--color-border);
}

.panel-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-hover);
  border: none;
  border-radius: 50%;
  color: var(--color-text-secondary);
  font-size: 14px;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s;
}

.panel-close:hover {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.drag-over .app-content {
  opacity: 0.3;
}

.splash-fade-enter-active,
.splash-fade-leave-active {
  transition: opacity 0.3s ease;
}

.splash-fade-enter-from,
.splash-fade-leave-to {
  opacity: 0;
}
</style>
