<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import type { Song } from '@/types'
import { formatDuration } from '@/utils'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const weatherStore = useWeatherStore()
const player = usePlayerStore()
const queue = playQueueStore()

const songsLoaded = ref(false)

async function loadSongs() {
  if (songsLoaded.value) return
  await weatherStore.generateWeatherPlaylist()
  songsLoaded.value = true
}

async function refreshSongs() {
  await weatherStore.refreshPlaylist()
}

function playSong(song: Song, index: number) {
  queue.setQueue(weatherStore.weatherSongs, index)
  player.play(song)
}

function handlePlayAll() {
  if (weatherStore.weatherSongs.length > 0) {
    queue.setQueue(weatherStore.weatherSongs, 0)
    player.play(weatherStore.weatherSongs[0])
  }
}

function handleAddToQueue() {
  weatherStore.weatherSongs.forEach((song) => {
    queue.addToQueue(song)
  })
}

function getArtistsText(song: Song): string {
  return song.artists?.map((a) => a.name).join(' / ') || ''
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      loadSongs()
    }
  }
)

onMounted(() => {
  if (props.visible) {
    loadSongs()
  }
})
</script>

<template>
  <Transition name="slide">
    <div v-if="visible" class="weather-radio">
      <div class="radio-backdrop" @click="emit('close')"></div>
      <div class="radio-panel" @click.stop>
        <button class="radio-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div class="radio-header">
          <div class="weather-cover" :style="{ background: weatherStore.moodGradient }">
            <div class="cover-content">
              <div class="weather-emoji">{{ weatherStore.moodEmoji }}</div>
              <div class="weather-temp" v-if="weatherStore.weather">
                {{ weatherStore.weather.temperature }}°C
              </div>
              <div class="weather-desc" v-if="weatherStore.weather">
                {{ weatherStore.weather.weatherDescription }}
              </div>
              <div class="weather-city" v-if="weatherStore.weather">
                📍 {{ weatherStore.weather.city }}
              </div>
            </div>
          </div>
          <div class="radio-info">
            <h2 class="radio-title">天气电台</h2>
            <div class="radio-meta">
              <span>{{ weatherStore.weatherSongs.length }} 首歌曲</span>
              <span class="radio-mood">{{ weatherStore.mood }}</span>
            </div>
            <p class="radio-desc">
              {{ weatherStore.moodDescription }}
            </p>
            <div class="radio-actions">
              <button class="action-btn action-btn--primary" @click="handlePlayAll">
                ▶ 播放全部
              </button>
              <button class="action-btn" @click="refreshSongs">
                🔄 换一批
              </button>
            </div>
          </div>
        </div>

        <div class="radio-divider"></div>

        <div class="song-list">
          <div v-if="weatherStore.loadingSongs" class="loading-state">
            <div class="loading-spinner"></div>
            <span>生成天气歌单中...</span>
          </div>
          <template v-else-if="weatherStore.weatherSongs.length > 0">
            <div
              v-for="(song, index) in weatherStore.weatherSongs"
              :key="song.id + '-' + index"
              class="song-item"
              @click="playSong(song, index)"
            >
              <div class="song-index">{{ index + 1 }}</div>
              <div class="song-cover">
                <img v-if="song.coverUrl" :src="song.coverUrl" alt="" />
                <div v-else class="cover-placeholder">{{ weatherStore.moodEmoji }}</div>
              </div>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ getArtistsText(song) }}</div>
              </div>
              <div class="song-duration">{{ formatDuration(song.duration) }}</div>
            </div>
          </template>
          <div v-else class="empty-state">
            <div class="empty-icon">🎵</div>
            <p>暂无推荐歌曲</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.weather-radio {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radio-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.radio-panel {
  position: relative;
  width: min(680px, 92vw);
  max-height: 85vh;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.97),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7);
}

.radio-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.radio-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

.radio-header {
  display: flex;
  gap: 24px;
  padding: 28px 28px 20px;
}

.weather-cover {
  width: 160px;
  height: 160px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-content {
  text-align: center;
  color: #fff;
  padding: 16px;
}

.weather-emoji {
  font-size: 48px;
  margin-bottom: 8px;
}

.weather-temp {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.weather-desc {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.weather-city {
  font-size: 11px;
  opacity: 0.8;
}

.radio-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.radio-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}

.radio-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.radio-mood {
  color: rgba(255, 183, 77, 0.8);
  text-transform: capitalize;
}

.radio-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.radio-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.action-btn--primary {
  background: linear-gradient(135deg, #d95b67, #ffb74d);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
}

.radio-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0 28px;
}

.song-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #ffb74d;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.song-index {
  width: 24px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 20px;
  opacity: 0.5;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-duration {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.25s ease;
}

.slide-enter-active .radio-panel,
.slide-leave-active .radio-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.slide-enter-from .radio-panel,
.slide-leave-to .radio-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
