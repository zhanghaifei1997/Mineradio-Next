<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { usePlayerStore } from '@/stores/player'
import { useStatsStore } from '@/stores/stats'
import { useUserStore } from '@/stores/user'
import { playQueueStore } from '@/stores/playQueue'
import { useFxStore } from '@/stores/fx'
import { formatDuration } from '@/utils'

const emit = defineEmits<{
  (e: 'open-weather-radio'): void
  (e: 'open-daily-recommend'): void
  (e: 'open-fm'): void
  (e: 'open-toplist'): void
  (e: 'open-playlist', playlist: any): void
}>()

const weatherStore = useWeatherStore()
const player = usePlayerStore()
const stats = useStatsStore()
const userStore = useUserStore()
const queue = playQueueStore()
const fx = useFxStore()

const isHovering = ref<string | null>(null)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const userName = computed(() => {
  return userStore.primaryProfile?.nickname || '音乐爱好者'
})

const continueSong = computed(() => {
  if (!player.continueListening) return null
  const idx = player.continueListening.currentIndex
  return player.continueListening.queue[idx] || null
})

const continueProgress = computed(() => {
  if (!player.continueListening || !continueSong.value) return 0
  const duration = continueSong.value.duration
  if (duration <= 0) return 0
  return Math.min(100, (player.continueListening.currentTime / duration) * 100)
})

const lastPlayedText = computed(() => {
  if (!player.continueListening) return ''
  const diff = Date.now() - player.continueListening.lastPlayedAt
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
})

const totalMinutes = computed(() => {
  return Math.floor(stats.data.totalPlayDuration / 60)
})

const isEmptyHome = computed(() => {
  return !player.currentSong && !player.isPlaying
})

async function handleContinueListen() {
  await player.continueFromLast()
}

function handlePlayQueueFromPlaylist(songs: any[], name?: string, cover?: string) {
  if (songs.length === 0) return
  queue.setQueue(songs, 0)
  player.play(songs[0])
  player.saveContinueListening(name, cover)
}

function updateEmptyHomeClass() {
  if (isEmptyHome.value) {
    document.body.classList.add('empty-home-active')
  } else {
    document.body.classList.remove('empty-home-active')
  }
}

const cardDelays = [0, 0.2, 0.4, 0.6, 0.8, 1.0]

onMounted(() => {
  weatherStore.fetchWeather()
  updateEmptyHomeClass()
})

onUnmounted(() => {
  document.body.classList.remove('empty-home-active')
})
</script>

<template>
  <div class="home-panel" :class="{ 'empty-home': isEmptyHome }">
    <div class="home-scroll">
      <div class="home-content">
        <div class="hero-section">
          <div class="hero-left">
            <h1 class="greeting">{{ greeting }}，{{ userName }}</h1>
            <p class="greeting-sub">今天想听点什么呢？</p>
            <div class="quick-entry">
              <button class="entry-btn primary" @click="emit('open-daily-recommend')">
                <span class="entry-icon">✨</span>
                <span>发现音乐</span>
              </button>
              <button class="entry-btn" @click="emit('open-fm')">
                <span class="entry-icon">📻</span>
                <span>私人FM</span>
              </button>
            </div>
          </div>
          <div class="hero-right">
            <div class="visual-preview">
              <div class="visual-circle c1"></div>
              <div class="visual-circle c2"></div>
              <div class="visual-circle c3"></div>
              <div class="visual-note">🎵</div>
            </div>
          </div>
        </div>

        <div class="cards-grid">
          <div
            class="home-card card-weather"
            :style="{ '--delay': cardDelays[0] + 's' }"
            :class="{ 'hover-stop': isHovering === 'weather' }"
            @mouseenter="isHovering = 'weather'"
            @mouseleave="isHovering = null"
            @click="emit('open-weather-radio')"
          >
            <div class="card-bg" :style="{ background: weatherStore.moodGradient }"></div>
            <div class="card-content">
              <div class="card-header">
                <span class="card-icon">🌤️</span>
                <span class="card-label">天气电台</span>
              </div>
              <div class="weather-display">
                <div class="weather-emoji-big">{{ weatherStore.moodEmoji }}</div>
                <div class="weather-info">
                  <div class="weather-temp" v-if="weatherStore.weather">
                    {{ weatherStore.weather.temperature }}°
                  </div>
                  <div class="weather-city" v-if="weatherStore.weather">
                    {{ weatherStore.weather.city }}
                  </div>
                </div>
              </div>
              <div class="card-hint">
                <span>{{ weatherStore.moodDescription }}</span>
                <span class="hint-arrow">→</span>
              </div>
            </div>
            <div class="card-cover-mini">
              <span>🌧️</span>
            </div>
          </div>

          <div
            class="home-card card-daily"
            :style="{ '--delay': cardDelays[1] + 's' }"
            :class="{ 'hover-stop': isHovering === 'daily' }"
            @mouseenter="isHovering = 'daily'"
            @mouseleave="isHovering = null"
            @click="emit('open-daily-recommend')"
          >
            <div class="card-bg"></div>
            <div class="card-content">
              <div class="card-header">
                <span class="card-icon">📅</span>
                <span class="card-label">每日推荐</span>
              </div>
              <div class="card-title">根据你的口味</div>
              <div class="card-subtitle">每日更新 30 首</div>
            </div>
            <div class="card-cover-mini">
              <span>🎶</span>
            </div>
          </div>

          <div
            class="home-card card-fm"
            :style="{ '--delay': cardDelays[2] + 's' }"
            :class="{ 'hover-stop': isHovering === 'fm' }"
            @mouseenter="isHovering = 'fm'"
            @mouseleave="isHovering = null"
            @click="emit('open-fm')"
          >
            <div class="card-bg"></div>
            <div class="card-content">
              <div class="card-header">
                <span class="card-icon">📻</span>
                <span class="card-label">私人电台</span>
              </div>
              <div class="card-title">遇见好歌</div>
              <div class="card-subtitle">个性化推荐</div>
            </div>
            <div class="card-cover-mini">
              <span>🎙️</span>
            </div>
          </div>

          <div
            class="home-card card-continue"
            :style="{ '--delay': cardDelays[3] + 's' }"
            :class="{ 'hover-stop': isHovering === 'continue' }"
            @mouseenter="isHovering = 'continue'"
            @mouseleave="isHovering = null"
            @click="player.hasContinueData() && handleContinueListen()"
          >
            <div class="card-bg"></div>
            <div class="card-content">
              <div class="card-header">
                <span class="card-icon">▶️</span>
                <span class="card-label">继续听</span>
              </div>
              <template v-if="continueSong">
                <div class="card-title text-truncate">{{ continueSong.name }}</div>
                <div class="card-subtitle text-truncate">
                  {{ continueSong.artists?.map((a: any) => a.name).join(' / ') || '' }}
                </div>
                <div class="mini-progress">
                  <div class="mini-progress-bar">
                    <div class="mini-progress-fill" :style="{ width: continueProgress + '%' }"></div>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="card-title">暂无记录</div>
                <div class="card-subtitle">开始播放吧</div>
              </template>
            </div>
            <div class="card-cover-mini" v-if="continueSong?.coverUrl">
              <img :src="continueSong.coverUrl" alt="" />
            </div>
            <div class="card-cover-mini placeholder" v-else>
              <span>🎵</span>
            </div>
          </div>

          <div
            class="home-card card-profile"
            :style="{ '--delay': cardDelays[4] + 's' }"
            :class="{ 'hover-stop': isHovering === 'profile' }"
            @mouseenter="isHovering = 'profile'"
            @mouseleave="isHovering = null"
          >
            <div class="card-bg"></div>
            <div class="card-content">
              <div class="card-header">
                <span class="card-icon">🎭</span>
                <span class="card-label">听歌画像</span>
              </div>
              <div class="card-title">{{ stats.personality }}</div>
              <div class="card-stats-mini">
                <span>{{ stats.data.totalPlayCount }} 首</span>
                <span>·</span>
                <span>{{ totalMinutes }} 分钟</span>
              </div>
            </div>
            <div class="card-cover-mini">
              <span>🎨</span>
            </div>
          </div>

          <div
            class="home-card card-artists"
            :style="{ '--delay': cardDelays[5] + 's' }"
            :class="{ 'hover-stop': isHovering === 'artists' }"
            @mouseenter="isHovering = 'artists'"
            @mouseleave="isHovering = null"
          >
            <div class="card-bg"></div>
            <div class="card-content">
              <div class="card-header">
                <span class="card-icon">👤</span>
                <span class="card-label">常听歌手</span>
              </div>
              <div class="top-artists-mini" v-if="stats.topArtists.length > 0">
                <span v-for="(artist, idx) in stats.topArtists.slice(0, 3)" :key="artist.id" class="artist-chip">
                  {{ artist.name }}
                </span>
              </div>
              <div v-else class="card-subtitle">暂无数据</div>
            </div>
            <div class="card-cover-mini">
              <span>🎤</span>
            </div>
          </div>
        </div>

        <div class="section playlists-section">
          <div class="section-header">
            <h3>为你推荐</h3>
            <button class="section-more">
              更多 <span>→</span>
            </button>
          </div>

          <div v-if="userStore.ownedPlaylists.length === 0" class="empty-playlists">
            <div class="empty-icon">📁</div>
            <p>还没有歌单，登录后可以同步你的歌单</p>
          </div>

          <div v-else class="playlist-grid">
            <div
              v-for="playlist in userStore.ownedPlaylists.slice(0, 6)"
              :key="playlist.id"
              class="playlist-item"
              @click="emit('open-playlist', playlist)"
            >
              <div class="playlist-cover">
                <img v-if="playlist.coverUrl" :src="playlist.coverUrl" alt="" />
                <div v-else class="cover-placeholder">🎵</div>
              </div>
              <div class="playlist-name text-truncate">{{ playlist.name }}</div>
              <div class="playlist-count">{{ playlist.trackCount }} 首</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-panel {
  position: absolute;
  top: 72px;
  left: 0;
  right: 0;
  bottom: 88px;
  pointer-events: none;
  z-index: 15;
}

.home-scroll {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  pointer-events: auto;
}

.home-content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

.hero-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-bottom: 32px;
  min-height: 180px;
  align-items: center;
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.greeting {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  line-height: 1.2;
  letter-spacing: -0.5px;
}

.greeting-sub {
  font-size: 15px;
  color: var(--color-text-secondary);
  margin: 0;
}

.quick-entry {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.entry-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1px solid var(--color-border);
  border-radius: 24px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
}

.entry-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(217, 91, 103, 0.4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.entry-btn.primary {
  background: linear-gradient(135deg, #d95b67, #f4d28a);
  border: none;
  color: #fff;
}

.entry-btn.primary:hover {
  box-shadow: 0 8px 24px rgba(217, 91, 103, 0.3);
}

.entry-icon {
  font-size: 16px;
}

.hero-right {
  display: flex;
  justify-content: center;
  align-items: center;
}

.visual-preview {
  position: relative;
  width: 160px;
  height: 160px;
}

.visual-circle {
  position: absolute;
  border-radius: 50%;
  animation: float 7.4s ease-in-out infinite;
}

.visual-circle.c1 {
  width: 120px;
  height: 120px;
  top: 10%;
  left: 10%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(244, 210, 138, 0.2));
  filter: blur(2px);
}

.visual-circle.c2 {
  width: 80px;
  height: 80px;
  top: 30%;
  right: 5%;
  background: linear-gradient(135deg, rgba(100, 150, 255, 0.3), rgba(150, 100, 200, 0.2));
  animation-delay: 1.5s;
  filter: blur(1px);
}

.visual-circle.c3 {
  width: 60px;
  height: 60px;
  bottom: 10%;
  left: 30%;
  background: linear-gradient(135deg, rgba(244, 210, 138, 0.4), rgba(217, 91, 103, 0.2));
  animation-delay: 3s;
  filter: blur(1px);
}

.visual-note {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 48px;
  animation: pulse 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-15px) scale(1.05); }
}

@keyframes pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.8; }
}

.cards-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
  margin-bottom: 32px;
}

.home-card {
  position: relative;
  min-height: 140px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: cardFloat 7.4s ease-in-out infinite;
  animation-delay: var(--delay);
  border: 1px solid var(--color-border);
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
}

.home-card.hover-stop {
  animation-play-state: paused;
}

.home-card:hover {
  transform: translateY(-4px) scale(1.02);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  border-color: rgba(217, 91, 103, 0.3);
}

.card-weather {
  grid-row: span 2;
  min-height: 300px;
}

.card-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.15), rgba(100, 50, 150, 0.1));
  transition: all 0.3s ease;
}

.card-weather .card-bg {
  opacity: 0.8;
}

.home-card:hover .card-bg {
  opacity: 1;
}

.card-content {
  position: relative;
  z-index: 2;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.card-icon {
  font-size: 20px;
}

.card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
}

.card-weather .card-title {
  font-size: 24px;
}

.weather-display {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: auto 0;
}

.weather-emoji-big {
  font-size: 64px;
  line-height: 1;
}

.weather-info {
  color: var(--color-text);
}

.weather-temp {
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
}

.weather-city {
  font-size: 14px;
  opacity: 0.8;
  margin-top: 4px;
}

.card-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-top: auto;
}

.hint-arrow {
  transition: transform 0.2s;
}

.home-card:hover .hint-arrow {
  transform: translateX(4px);
}

.card-cover-mini {
  position: absolute;
  right: 16px;
  bottom: 16px;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  z-index: 1;
  overflow: hidden;
}

.card-cover-mini img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-cover-mini.placeholder {
  opacity: 0.5;
}

.mini-progress {
  margin-top: auto;
  padding-top: 8px;
}

.mini-progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f4d28a);
  border-radius: 2px;
  transition: width 0.3s;
}

.card-stats-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.top-artists-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.artist-chip {
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes cardFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.section {
  margin-bottom: 28px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.section-more {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s;
}

.section-more:hover {
  background: var(--color-hover);
  color: var(--color-text-secondary);
}

.empty-playlists {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-playlists p {
  font-size: 13px;
  margin: 0;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.playlist-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-item:hover {
  transform: translateY(-2px);
}

.playlist-item:hover .playlist-cover {
  border-color: rgba(217, 91, 103, 0.3);
}

.playlist-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  margin-bottom: 8px;
  transition: all 0.2s;
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  opacity: 0.5;
}

.playlist-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 2px;
}

.playlist-count {
  font-size: 11px;
  color: var(--color-text-muted);
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-home-active .home-panel {
  animation: homeFadeIn 0.6s ease-out;
}

@keyframes homeFadeIn {
  from {
    opacity: 0;
    transform: scale(0.98);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (max-width: 960px) {
  .cards-grid {
    grid-template-columns: 1fr 1fr;
  }

  .card-weather {
    grid-column: span 2;
    grid-row: auto;
    min-height: 180px;
  }

  .weather-display {
    margin: 16px 0;
  }

  .weather-emoji-big {
    font-size: 48px;
  }

  .weather-temp {
    font-size: 32px;
  }

  .playlist-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-section {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .hero-right {
    order: -1;
  }

  .visual-preview {
    width: 120px;
    height: 120px;
  }

  .greeting {
    font-size: 28px;
  }

  .cards-grid {
    grid-template-columns: 1fr;
  }

  .card-weather {
    grid-column: auto;
    min-height: 160px;
  }

  .playlist-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .home-content {
    padding: 16px;
  }
}
</style>
