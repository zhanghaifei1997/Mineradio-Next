<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue'
import VisualCanvas from '@/components/visual/VisualCanvas.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
import SearchPanel from '@/components/search/SearchPanel.vue'
import PlaylistShelf from '@/components/playlist/PlaylistShelf.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import PlaylistQueue from '@/components/playlist/PlaylistQueue.vue'
import LocalMusicPanel from '@/components/local/LocalMusicPanel.vue'
import StageLyrics from '@/components/lyrics/StageLyrics.vue'
import UserCapsule from '@/components/user/UserCapsule.vue'
import DjModeIndicator from '@/components/dj/DjModeIndicator.vue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { useUserStore } from '@/stores/user'
import { providerManager } from '@/modules/providers'
import type { LyricLine } from '@/modules/lyrics'

const player = usePlayerStore()
const fx = useFxStore()
const lyrics = useLyricsStore()
const user = useUserStore()

const showQueuePanel = ref(false)
const showLocalPanel = ref(false)
const showSettings = ref(false)
const showLogin = ref(false)

let rafId: number | null = null

function toggleQueuePanel() {
  showQueuePanel.value = !showQueuePanel.value
  if (showQueuePanel.value) {
    showLocalPanel.value = false
  }
}

function toggleLocalPanel() {
  showLocalPanel.value = !showLocalPanel.value
  if (showLocalPanel.value) {
    showQueuePanel.value = false
  }
}

function toggleSettings() {
  showSettings.value = !showSettings.value
}

function toggleLyrics() {
  lyrics.toggleStageLyrics()
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
  rafId = requestAnimationFrame(updateLyricsProgress)
}

watch(
  () => player.currentSong,
  (song) => {
    if (song) {
      loadLyricsForSong(song.id, song.source)
    } else {
      lyrics.clear()
    }
  },
  { immediate: true }
)

onMounted(() => {
  player.initAudio()
  updateLyricsProgress()
})

onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
})
</script>

<template>
  <div class="app-container" :class="{ 'fx-eco': fx.settings.performanceQuality === 'eco' }">
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
    />

    <div class="app-content">
      <div class="top-toolbar">
        <div class="top-toolbar__left">
          <DjModeIndicator />
        </div>
        <div class="top-toolbar__right">
          <button class="icon-btn" @click="toggleLyrics" :title="lyrics.stageEnabled ? '隐藏歌词' : '显示歌词'">
            {{ lyrics.stageEnabled ? '🎵' : '🎤' }}
          </button>
          <button class="icon-btn" @click="toggleSettings" title="设置">
            ⚙️
          </button>
          <UserCapsule @open-login="openLogin" />
        </div>
      </div>

      <PlaylistShelf />
      <SearchPanel />

      <SettingsPanel v-if="showSettings" @close="showSettings = false" />

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
      </div>
    </div>

    <PlayerBar @show-queue="toggleQueuePanel" @show-local="toggleLocalPanel" />
  </div>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: #0a0a0a;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
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
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
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
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
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
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.7);
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
</style>
