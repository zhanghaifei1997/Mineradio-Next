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
const isLoading = ref(true)

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
  setTimeout(() => {
    isLoading.value = false
  }, 800)
})

onUnmounted(() => {
  document.body.classList.remove('empty-home-active')
})
</script>

<template>
  <div class="home-panel" :class="{ 'empty-home': isEmptyHome }">
    <div class="home-scroll">
      <div class="home-content">
        <template v-if="isLoading">
          <div class="home-skeleton">
            <div class="skeleton-hero">
              <div class="skeleton-greeting"></div>
              <div class="skeleton-sub"></div>
              <div class="skeleton-btns">
                <div class="skeleton-btn"></div>
                <div class="skeleton-btn"></div>
              </div>
            </div>
            <div class="skeleton-cards">
              <div class="skeleton-card large"></div>
              <div class="skeleton-card"></div>
              <div class="skeleton-card"></div>
              <div class="skeleton-card"></div>
              <div class="skeleton-card"></div>
              <div class="skeleton-card"></div>
            </div>
          </div>
        </template>
        <template v-else>
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
              <div class="home-disc" :class="{ 'is-spinning': player.isPlaying }">
                <div class="disc-ring"></div>
                <div class="disc-center"></div>
                <div class="disc-cover" v-if="player.currentSong?.coverUrl">
                  <img :src="player.currentSong.coverUrl" alt="" />
                </div>
                <div class="disc-cover placeholder" v-else>
                  <span>🎵</span>
                </div>
              </div>
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
              <div class="home-eq" :class="{ 'is-active': player.isPlaying }">
                <div class="eq-bar" :style="{ '--eq-delay': '0s' }"></div>
                <div class="eq-bar" :style="{ '--eq-delay': '0.15s' }"></div>
                <div class="eq-bar" :style="{ '--eq-delay': '0.3s' }"></div>
                <div class="eq-bar" :style="{ '--eq-delay': '0.45s' }"></div>
                <div class="eq-bar" :style="{ '--eq-delay': '0.6s' }"></div>
                <div class="eq-bar" :style="{ '--eq-delay': '0.35s' }"></div>
                <div class="eq-bar" :style="{ '--eq-delay': '0.2s' }"></div>
              </div>
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
        </template>
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
  bottom: 20px;
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
  max-width: min(1240px, calc(100vw - 72px));
  margin: 0 auto;
  padding: 24px 32px 40px;
}

.hero-section {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0,1.16fr) minmax(150px,.64fr);
  gap: 18px;
  margin-bottom: 32px;
  min-height: 438px;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid color-mix(in srgb, var(--home-accent) 22%, rgba(255,255,255,.085));
  background: linear-gradient(145deg,rgba(33,29,34,.64),rgba(9,10,14,.76) 48%,rgba(17,20,25,.70));
  box-shadow: 0 28px 90px rgba(0,0,0,.34),0 0 0 1px color-mix(in srgb,var(--home-accent) 7%,transparent),inset 0 1px 0 rgba(255,255,255,.065);
  backdrop-filter: blur(30px) saturate(1.16);
  -webkit-backdrop-filter: blur(30px) saturate(1.16);
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg,rgba(255,255,255,.060),transparent 24%,rgba(255,83,103,.070) 54%,rgba(122,215,194,.055) 82%,transparent 100%),
    linear-gradient(90deg,rgba(255,255,255,.032) 0 1px,transparent 1px 48px),
    linear-gradient(0deg,rgba(255,255,255,.024) 0 1px,transparent 1px 44px);
  opacity: .72;
  pointer-events: none;
}

.hero-section::after {
  content: '';
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 22px;
  height: 1px;
  background: linear-gradient(90deg,color-mix(in srgb,var(--home-accent) 0%,transparent),color-mix(in srgb,var(--home-accent) 52%,transparent),rgba(36,66,255,.24),rgba(248,244,238,.18),color-mix(in srgb,var(--home-accent) 0%,transparent));
  opacity: .82;
  pointer-events: none;
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.greeting {
  font-size: clamp(34px,4.6vw,58px);
  font-weight: 760;
  color: rgba(255,255,255,.98);
  margin: 0;
  line-height: .98;
  letter-spacing: 0;
  max-width: 380px;
  text-shadow: 0 10px 36px rgba(0,0,0,.26);
}

.greeting-sub {
  font-size: 13px;
  line-height: 1.62;
  color: rgba(255,255,255,.62);
  max-width: 348px;
  margin: 14px 0 0;
}

.quick-entry {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.entry-btn {
  height: 32px;
  padding: 0 13px;
  border: 1px solid rgba(255,255,255,.11);
  border-radius: 999px;
  background: rgba(255,255,255,.060);
  color: rgba(255,255,255,.76);
  font-size: 11.5px;
  font-weight: 680;
  cursor: pointer;
  transition: all .18s;
}

.entry-btn:hover {
  background: color-mix(in srgb, var(--home-accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--home-accent) 38%, rgba(255,255,255,.10));
  color: #fff;
  box-shadow: 0 10px 26px color-mix(in srgb, var(--home-accent) 8%, transparent);
  transform: translateY(-1px);
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
  width: 180px;
  height: 180px;
  animation: home-visual-drift 7.4s ease-in-out infinite;
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
  --tone-a: #00f5d4;
  --tone-b: #2442ff;
  --tone-c: #f8f4ee;
  position: relative;
  min-height: 152px;
  border: 1px solid color-mix(in srgb, var(--home-accent) 10%, rgba(255,255,255,.085));
  border-radius: 22px;
  background: linear-gradient(142deg,rgba(18,21,26,.66),rgba(8,9,13,.76));
  box-shadow: 0 20px 64px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.060);
  backdrop-filter: blur(24px) saturate(1.12);
  -webkit-backdrop-filter: blur(24px) saturate(1.12);
  padding: 17px;
  overflow: hidden;
  cursor: pointer;
  transition: transform .22s cubic-bezier(.16,1,.3,1), border-color .22s, background .22s, box-shadow .22s;
  animation: cardFloat 7.4s ease-in-out infinite;
  animation-delay: var(--delay);
}

.home-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg,color-mix(in srgb,var(--tone-a) 22%,transparent),transparent 38%,color-mix(in srgb,var(--tone-b) 16%,transparent) 74%,transparent),
    linear-gradient(90deg,rgba(255,255,255,.035) 0 1px,transparent 1px 38px);
  opacity: .86;
  pointer-events: none;
}

.home-card::after {
  content: '';
  position: absolute;
  right: 114px;
  bottom: 18px;
  width: 38px;
  height: 70px;
  border-radius: 999px;
  background: repeating-linear-gradient(0deg,color-mix(in srgb,var(--tone-c) 64%,rgba(255,255,255,.26)) 0 4px,transparent 4px 10px);
  opacity: .20;
  transform: skewX(-10deg);
  pointer-events: none;
}

.home-card.hover-stop {
  animation-play-state: paused;
}

.home-card:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb,var(--tone-a) 42%,rgba(255,255,255,.18));
  background: linear-gradient(142deg,rgba(36,33,39,.72),rgba(10,10,14,.84));
  box-shadow: 0 28px 84px rgba(0,0,0,.36),0 0 34px color-mix(in srgb,var(--tone-a) 16%,transparent),inset 0 1px 0 rgba(255,255,255,.085);
}

.card-weather {
  grid-row: span 2;
  min-height: 300px;
}

.card-bg {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
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
  color: color-mix(in srgb, var(--tone-a) 70%, #fff);
}

.card-label {
  font-size: 10px;
  font-weight: 760;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--tone-a) 70%, #fff);
  text-shadow: 0 0 18px color-mix(in srgb, var(--tone-a) 22%, transparent);
}

.card-title {
  font-size: 19px;
  font-weight: 780;
  line-height: 1.16;
  color: rgba(255,255,255,.96);
  margin-bottom: 4px;
  max-width: 70%;
}

.card-subtitle {
  margin-top: 8px;
  font-size: 11.5px;
  line-height: 1.45;
  color: rgba(255,255,255,.55);
  max-width: 70%;
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
  z-index: 1;
  right: 13px;
  bottom: 13px;
  width: 108px;
  height: 108px;
  border-radius: 24px;
  background: linear-gradient(135deg,color-mix(in srgb,var(--tone-a) 78%,#14141a),color-mix(in srgb,var(--tone-b) 68%,#09090d));
  box-shadow: 0 18px 50px rgba(0,0,0,.36),inset 0 1px 0 rgba(255,255,255,.16);
  transform: rotate(3deg);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
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
  background: linear-gradient(90deg, var(--home-accent), color-mix(in srgb, var(--home-accent) 40%, #f4d28a));
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
  border-color: color-mix(in srgb, var(--home-accent) 40%, transparent);
  box-shadow: 0 0 26px color-mix(in srgb, var(--home-accent) 12%, transparent);
}

.playlist-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, color-mix(in srgb, var(--home-accent) 15%, var(--color-bg)), var(--color-bg));
  border: 1px solid color-mix(in srgb, var(--home-accent) 12%, var(--color-border));
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

/* --- 桌面模式标题栏偏移 --- */
:global(body.desktop-titlebar-active) .home-panel {
  top: 128px;
}

/* --- 播放器控制栏可见时，底边上抬避让 --- */
:global(body.controls-visible) .home-panel {
  bottom: 130px;
}
:global(body.controls-visible.desktop-titlebar-active) .home-panel {
  bottom: 130px;
}

/* --- 桌面全屏模式更宽内容区 (对齐老项目 desktop_shell fullscreen) --- */
:global(body.desktop-titlebar-active.desktop-fullscreen) .home-panel,
:global(:fullscreen body.desktop-titlebar-active) .home-panel {
  top: 96px;
}
:global(body.desktop-titlebar-active.desktop-fullscreen) .home-content,
:global(:fullscreen body.desktop-titlebar-active) .home-content {
  max-width: min(1480px, calc(100vw - 96px));
}

/* --- Responsive (aligned with original breakpoints) --- */

/* 1120px - medium screens */
@media (max-width: 1120px) {
  .hero-section {
    padding: 22px;
  }
  .hero-right {
    max-width: 226px;
  }
  .greeting {
    font-size: clamp(30px, 4vw, 48px);
    max-width: 340px;
  }
  .subtitle {
    font-size: 12.5px;
    line-height: 1.5;
    max-width: 314px;
  }
  .home-disc {
    width: min(190px, 78%);
  }
  .cards-grid {
    gap: 10px;
  }
  .home-card {
    min-height: 122px;
    padding: 14px;
  }
}

/* 840px - hero single column, visual hidden */
@media (max-width: 840px) {
  .hero-section {
    grid-template-columns: minmax(0, 1fr);
  }
  .hero-right {
    display: none;
  }
  .home-card {
    min-height: 102px;
  }
  .greeting {
    font-size: clamp(26px, 3.8vw, 40px);
  }
}

/* 760px - home grid 2 columns */
@media (max-width: 760px) {
  .home-content {
    width: calc(100vw - 36px);
    padding: 16px;
  }
  .hero-section {
    min-height: 330px;
  }
  .cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .playlist-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* 620px - single column, compact */
@media (max-width: 620px) {
  .home-content {
    width: calc(100vw - 24px);
    padding: 12px;
  }
  .hero-section {
    padding: 20px;
    border-radius: 22px;
    min-height: auto;
  }
  .hero-right {
    display: none;
  }
  .cards-grid {
    grid-template-columns: 1fr;
  }
  .playlist-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .home-card {
    min-height: auto;
  }
  .card-weather {
    grid-column: auto;
    min-height: 160px;
  }
}

/* max-height: 700px - compact vertical */
@media (max-height: 700px) {
  .hero-section {
    min-height: 0;
    padding: 18px;
  }
  .greeting {
    font-size: clamp(27px, 3.5vw, 40px);
  }
  .subtitle {
    font-size: 11.8px;
    line-height: 1.4;
  }
  .home-disc {
    width: min(166px, 72%);
  }
  .home-card {
    min-height: 104px;
    padding: 12px;
  }
}

.home-skeleton {
  width: 100%;
}

.skeleton-hero {
  margin-bottom: 32px;
}

.skeleton-greeting {
  width: 280px;
  height: 42px;
  border-radius: 8px;
  background: var(--color-surface);
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}

.skeleton-sub {
  width: 180px;
  height: 18px;
  border-radius: 4px;
  background: var(--color-surface);
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}

.skeleton-btns {
  display: flex;
  gap: 12px;
}

.skeleton-btn {
  width: 120px;
  height: 40px;
  border-radius: 20px;
  background: var(--color-surface);
  position: relative;
  overflow: hidden;
}

.skeleton-cards {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 16px;
  margin-bottom: 32px;
}

.skeleton-card {
  min-height: 140px;
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.skeleton-card.large {
  grid-row: span 2;
  min-height: 300px;
}

.skeleton-greeting::before,
.skeleton-sub::before,
.skeleton-btn::before,
.skeleton-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.08),
    transparent
  );
  animation: home-shimmer-local 1.5s ease-in-out infinite;
}

@keyframes home-shimmer-local {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

.home-disc {
  position: relative;
  width: min(210px,82%);
  aspect-ratio: 1;
  border-radius: 50%;
  animation: home-disc-turn-local 18s linear infinite;
  animation-play-state: paused;
  background: repeating-radial-gradient(circle,rgba(255,255,255,.10) 0 1px,transparent 1px 10px),conic-gradient(from 210deg,#00f5d4,#2442ff,#f8f4ee,#7ad7c2,#00f5d4);
  box-shadow: 0 24px 62px rgba(0,0,0,.42),inset 0 0 0 1px rgba(255,255,255,.18),inset 0 0 0 16px rgba(8,8,12,.56);
}

.home-disc.is-spinning {
  animation-play-state: running;
}

.home-disc::before {
  content: '';
  position: absolute;
  inset: 15px;
  border-radius: 50%;
  background: repeating-radial-gradient(
    circle at center,
    #1a1a1a 0px,
    #1a1a1a 3px,
    #2a2a2a 3px,
    #2a2a2a 6px
  );
}

.disc-ring {
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--home-accent) 40%, transparent);
  z-index: 1;
}

.disc-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #0a0a0f;
  z-index: 3;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.disc-center::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #333;
}

.disc-cover {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  z-index: 2;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.disc-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.disc-cover.placeholder {
  background: linear-gradient(135deg, color-mix(in srgb, var(--home-accent) 50%, transparent), color-mix(in srgb, var(--tone-b) 50%, transparent));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
}

@keyframes home-disc-turn-local {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.home-eq {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 4px;
  height: 36px;
  margin-top: auto;
  padding-top: 12px;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}

.home-eq.is-active {
  opacity: 1;
}

.eq-bar {
  width: 4px;
  height: 8px;
  border-radius: 2px;
  background: linear-gradient(to top, var(--home-accent), color-mix(in srgb, var(--home-accent) 30%, white));
  animation: home-eq-rise-local 1.8s ease-in-out infinite;
  animation-delay: var(--eq-delay, 0s);
  box-shadow: 0 0 6px color-mix(in srgb, var(--home-accent) 50%, transparent);
}

.home-eq:not(.is-active) .eq-bar {
  animation-play-state: paused;
  height: 8px !important;
}

@keyframes home-eq-rise-local {
  0%, 100% {
    height: 8px;
  }
  25% {
    height: 28px;
  }
  50% {
    height: 16px;
  }
  75% {
    height: 32px;
  }
}

@keyframes home-card-float-local {
  0%, 100% {
    transform: translateY(0) translateX(0);
  }
  25% {
    transform: translateY(-6px) translateX(2px);
  }
  50% {
    transform: translateY(-10px) translateX(-2px);
  }
  75% {
    transform: translateY(-4px) translateX(1px);
  }
}

.home-card {
  animation-name: home-card-float-local;
  animation-duration: 7.4s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
</style>
