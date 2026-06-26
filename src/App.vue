<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, computed, defineAsyncComponent, Suspense } from 'vue'
import VisualCanvas from '@/components/visual/VisualCanvas.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
import StageLyrics from '@/components/lyrics/StageLyrics.vue'
import VisualConsole from '@/components/visual/VisualConsole.vue'
import UserCapsule from '@/components/user/UserCapsule.vue'
import DjModeIndicator from '@/components/dj/DjModeIndicator.vue'
import MiniPlayer from '@/components/player/MiniPlayer.vue'
import FMModeIndicator from '@/components/fm/FMModeIndicator.vue'

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
import { useDragDrop } from '@/composables/useDragDrop'
import { useTaskbar } from '@/composables/useTaskbar'
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
const { isDragging } = useDragDrop()
useTaskbar()

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

onMounted(() => {
  player.initAudio()
  updateLyricsProgress()
  setupMediaSession()
  immersive.setupListeners()
})

onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
  immersive.cleanupListeners()
})
</script>

<template>
  <div class="app-container" :class="{ 'fx-eco': fx.settings.performanceQuality === 'eco', 'mini-mode': isMiniMode, 'drag-over': isDragging }">
    <div v-if="isDragging" class="drag-drop-overlay">
      <div class="drag-drop-content">
        <div class="drag-drop-icon">🎵</div>
        <div class="drag-drop-text">释放以播放</div>
        <div class="drag-drop-hint">支持 MP3, FLAC, WAV, M4A, OGG, AAC, Opus</div>
      </div>
    </div>
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
            <button class="icon-btn" @click="toggleHome" :title="showHome ? '隐藏首页' : '显示首页'">
              {{ showHome ? '🏠' : '🎵' }}
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
            <UserCapsule @open-login="openLogin" @open-recent="toggleRecentPanel" />
          </div>
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
            <div v-if="showQueuePanel" class="side-panel queue-panel">
              <div class="panel-close" @click="showQueuePanel = false">✕</div>
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
      <ImmersivePlayer />
      <ContextMenu @open-settings="toggleSettings" @open-about="toggleSettings" />
    </template>

    <template v-else>
      <MiniPlayer @close="toggleMiniMode" @expand="toggleMiniMode" />
    </template>
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

.drag-drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: dragFadeIn 0.2s ease;
}

[data-theme='light'] .drag-drop-overlay {
  background: rgba(255, 255, 255, 0.7);
}

.drag-drop-content {
  text-align: center;
  padding: 48px 64px;
  border: 3px dashed var(--color-primary);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
  animation: dragPulse 1.5s ease-in-out infinite;
}

.drag-drop-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: dragBounce 1s ease-in-out infinite;
}

.drag-drop-text {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
}

.drag-drop-hint {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.drag-over .app-content {
  opacity: 0.3;
}

@keyframes dragFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes dragPulse {
  0%, 100% {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 0 rgba(var(--color-primary-rgb), 0.4);
  }
  50% {
    border-color: var(--color-accent);
    box-shadow: 0 0 30px 10px rgba(var(--color-primary-rgb), 0.2);
  }
}

@keyframes dragBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
</style>
