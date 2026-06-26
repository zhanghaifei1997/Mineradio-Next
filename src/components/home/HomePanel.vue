<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { usePlayerStore } from '@/stores/player'
import { useStatsStore } from '@/stores/stats'
import { useUserStore } from '@/stores/user'
import { playQueueStore } from '@/stores/playQueue'
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

async function handleContinueListen() {
  await player.continueFromLast()
}

function handlePlayQueueFromPlaylist(songs: any[], name?: string, cover?: string) {
  if (songs.length === 0) return
  queue.setQueue(songs, 0)
  player.play(songs[0])
  player.saveContinueListening(name, cover)
}

onMounted(() => {
  weatherStore.fetchWeather()
})
</script>

<template>
  <div class="home-panel">
    <div class="home-scroll">
      <div class="home-content">
        <div class="home-header">
          <div class="greeting-section">
            <h1 class="greeting">{{ greeting }}，{{ userName }}</h1>
            <p class="greeting-sub">今天想听点什么呢？</p>
          </div>
          
          <div 
            class="weather-card" 
            :style="{ background: weatherStore.moodGradient }"
            @click="emit('open-weather-radio')"
          >
            <div class="weather-info">
              <div class="weather-emoji">{{ weatherStore.moodEmoji }}</div>
              <div class="weather-text">
                <div class="weather-temp" v-if="weatherStore.weather">
                  {{ weatherStore.weather.temperature }}°C
                </div>
                <div class="weather-city" v-if="weatherStore.weather">
                  {{ weatherStore.weather.city }}
                </div>
              </div>
            </div>
            <div class="weather-hint">
              <span class="hint-text">{{ weatherStore.moodDescription }}</span>
              <span class="hint-arrow">→</span>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <button class="quick-action-btn" @click="emit('open-daily-recommend')">
            <div class="action-icon">📅</div>
            <div class="action-text">每日推荐</div>
          </button>
          <button class="quick-action-btn" @click="emit('open-fm')">
            <div class="action-icon">📻</div>
            <div class="action-text">私人FM</div>
          </button>
          <button class="quick-action-btn" @click="emit('open-toplist')">
            <div class="action-icon">🏆</div>
            <div class="action-text">排行榜</div>
          </button>
          <button class="quick-action-btn" @click="emit('open-playlist', null)">
            <div class="action-icon">📁</div>
            <div class="action-text">我的歌单</div>
          </button>
        </div>

        <div v-if="player.hasContinueData()" class="section continue-section">
          <div class="section-header">
            <h3>继续听</h3>
            <span class="section-sub">{{ lastPlayedText }}</span>
          </div>
          <div class="continue-card" @click="handleContinueListen">
            <div class="continue-cover">
              <img v-if="continueSong?.coverUrl" :src="continueSong.coverUrl" alt="" />
              <div v-else class="cover-placeholder">🎵</div>
              <div class="continue-play-btn">▶</div>
            </div>
            <div class="continue-info">
              <div class="continue-song">{{ continueSong?.name || '继续播放' }}</div>
              <div class="continue-artist">
                {{ continueSong?.artists?.map((a: any) => a.name).join(' / ') || '' }}
              </div>
              <div class="continue-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: continueProgress + '%' }"></div>
                </div>
                <span class="progress-text">
                  听到 {{ formatDuration(player.continueListening?.currentTime || 0) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="section profile-section">
          <div class="section-header">
            <h3>听歌画像</h3>
            <span class="section-tag">{{ stats.personality }}</span>
          </div>
          
          <div class="profile-card">
            <div class="profile-stats">
              <div class="stat-item">
                <div class="stat-value">{{ stats.data.totalPlayCount }}</div>
                <div class="stat-label">总播放</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ totalMinutes }}</div>
                <div class="stat-label">分钟</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ stats.timePreference.preferredPeriod }}</div>
                <div class="stat-label">最爱时段</div>
              </div>
            </div>

            <div class="profile-tags">
              <span 
                v-for="(tag, idx) in stats.tasteTags" 
                :key="idx" 
                class="taste-tag"
              >
                {{ tag }}
              </span>
            </div>

            <div class="profile-top-artists" v-if="stats.topArtists.length > 0">
              <div class="top-title">常听歌手 TOP 5</div>
              <div class="artist-list">
                <div 
                  v-for="(artist, idx) in stats.topArtists.slice(0, 5)" 
                  :key="artist.id"
                  class="artist-item"
                >
                  <span class="artist-rank">{{ idx + 1 }}</span>
                  <span class="artist-name text-truncate">{{ artist.name }}</span>
                  <span class="artist-count">{{ artist.playCount }} 次</span>
                </div>
              </div>
            </div>

            <div class="time-chart">
              <div class="chart-title">听歌时段分布</div>
              <div class="chart-bars">
                <div class="bar-item">
                  <div class="bar-label">早</div>
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ height: stats.timePreference.morning + '%' }"></div>
                  </div>
                  <div class="bar-value">{{ stats.timePreference.morning }}%</div>
                </div>
                <div class="bar-item">
                  <div class="bar-label">午</div>
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ height: stats.timePreference.afternoon + '%' }"></div>
                  </div>
                  <div class="bar-value">{{ stats.timePreference.afternoon }}%</div>
                </div>
                <div class="bar-item">
                  <div class="bar-label">晚</div>
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ height: stats.timePreference.evening + '%' }"></div>
                  </div>
                  <div class="bar-value">{{ stats.timePreference.evening }}%</div>
                </div>
                <div class="bar-item">
                  <div class="bar-label">夜</div>
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ height: stats.timePreference.night + '%' }"></div>
                  </div>
                  <div class="bar-value">{{ stats.timePreference.night }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section playlists-section">
          <div class="section-header">
            <h3>我的歌单</h3>
            <span class="section-sub">{{ userStore.ownedPlaylists.length }} 个歌单</span>
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
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 32px 40px;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 28px;
}

.greeting-section {
  flex: 1;
  min-width: 0;
}

.greeting {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 6px;
  line-height: 1.2;
}

.greeting-sub {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}

.weather-card {
  flex-shrink: 0;
  width: 280px;
  padding: 16px 20px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.weather-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
}

.weather-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.weather-emoji {
  font-size: 36px;
  line-height: 1;
}

.weather-text {
  color: #fff;
}

.weather-temp {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
}

.weather-city {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 2px;
}

.weather-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
}

.hint-text {
  font-size: 12px;
  opacity: 0.9;
}

.hint-arrow {
  font-size: 14px;
  opacity: 0.8;
  transition: transform 0.2s;
}

.weather-card:hover .hint-arrow {
  transform: translateX(4px);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}

.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--color-text);
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
}

.quick-action-btn:hover {
  background: var(--color-hover);
  transform: translateY(-2px);
  border-color: rgba(217, 91, 103, 0.3);
}

.action-icon {
  font-size: 28px;
}

.action-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
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

.section-sub {
  font-size: 12px;
  color: var(--color-text-muted);
}

.section-tag {
  font-size: 12px;
  padding: 2px 10px;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(255, 183, 77, 0.3));
  color: #ffb74d;
  border-radius: 10px;
  font-weight: 500;
}

.continue-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
}

.continue-card:hover {
  background: var(--color-hover);
  border-color: rgba(217, 91, 103, 0.3);
}

.continue-cover {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.continue-cover img {
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

.continue-play-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.2s;
}

.continue-card:hover .continue-play-btn {
  opacity: 1;
}

.continue-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.continue-song {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.continue-artist {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.continue-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #ffb74d);
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.profile-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 20px;
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
}

.profile-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 18px;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-muted);
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.taste-tag {
  padding: 4px 12px;
  font-size: 12px;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.2), rgba(255, 183, 77, 0.2));
  color: #ffb74d;
  border-radius: 12px;
  border: 1px solid rgba(255, 183, 77, 0.2);
}

.profile-top-artists {
  margin-bottom: 18px;
}

.top-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.artist-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.artist-item:hover {
  background: var(--color-hover);
}

.artist-rank {
  width: 18px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-align: center;
  flex-shrink: 0;
}

.artist-item:nth-child(1) .artist-rank {
  color: #ffb74d;
}

.artist-item:nth-child(2) .artist-rank {
  color: #90caf9;
}

.artist-item:nth-child(3) .artist-rank {
  color: #a1887f;
}

.artist-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--color-text);
}

.artist-count {
  font-size: 11px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.time-chart {
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.chart-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.chart-bars {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 100px;
  gap: 12px;
}

.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bar-track {
  flex: 1;
  width: 100%;
  max-width: 36px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  background: linear-gradient(180deg, #d95b67, #ffb74d);
  border-radius: 4px;
  min-height: 4px;
  transition: height 0.5s ease;
}

.bar-label {
  font-size: 11px;
  color: var(--color-text-muted);
}

.bar-value {
  font-size: 10px;
  color: var(--color-text-muted);
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
  grid-template-columns: repeat(3, 1fr);
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

@media (max-width: 768px) {
  .home-header {
    flex-direction: column;
  }

  .weather-card {
    width: 100%;
  }

  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }

  .playlist-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .home-content {
    padding: 16px;
  }
}
</style>
