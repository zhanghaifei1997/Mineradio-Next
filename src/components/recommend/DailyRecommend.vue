<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { providerManager } from '@/modules/providers'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import type { DailyRecommend, DailyRecommendSong } from '@/types'
import { formatDuration } from '@/utils'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const player = usePlayerStore()
const queue = playQueueStore()

const recommend = ref<DailyRecommend | null>(null)
const loading = ref(false)
const activeProvider = ref('netease')

const coverGradient = computed(() => {
  return 'linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(255, 183, 77, 0.4))'
})

const todayStr = computed(() => {
  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 ${weekdays[today.getDay()]}`
})

async function loadRecommend() {
  if (!props.visible) return
  loading.value = true
  try {
    const provider = providerManager.get(activeProvider.value) || providerManager.default
    const data = await provider.getDailyRecommend()
    recommend.value = data
  } catch (e) {
    console.error('Load daily recommend error:', e)
    recommend.value = null
  } finally {
    loading.value = false
  }
}

function playSong(song: DailyRecommendSong, index: number) {
  if (recommend.value) {
    queue.setQueue(recommend.value.songs, index)
    player.play(song)
  }
}

function handlePlayAll() {
  if (recommend.value && recommend.value.songs.length > 0) {
    queue.setQueue(recommend.value.songs, 0)
    player.play(recommend.value.songs[0])
  }
}

function handleAddToQueue() {
  if (recommend.value) {
    recommend.value.songs.forEach((song) => {
      queue.addToQueue(song)
    })
  }
}

function getArtistsText(song: DailyRecommendSong): string {
  return song.artists.map((a) => a.name).join(' / ')
}

const providers = providerManager.getAll()

onMounted(() => {
  if (props.visible) {
    loadRecommend()
  }
})
</script>

<template>
  <Transition name="slide">
    <div v-if="visible" class="daily-recommend">
      <div class="recommend-backdrop" @click="emit('close')"></div>
      <div class="recommend-panel" @click.stop>
        <button class="recommend-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div class="recommend-header">
          <div class="recommend-cover" :style="{ background: coverGradient }">
            <div class="cover-content">
              <div class="cover-date">{{ todayStr }}</div>
              <div class="cover-title">每日推荐</div>
              <div class="cover-subtitle">根据你的口味生成</div>
            </div>
          </div>
          <div class="recommend-info">
            <h2 class="recommend-title">每日推荐</h2>
            <div class="recommend-meta">
              <span>{{ recommend?.songs.length || 0 }} 首歌曲</span>
              <span class="recommend-date">{{ todayStr }}</span>
            </div>
            <p v-if="recommend?.recommendReason" class="recommend-desc">
              {{ recommend.recommendReason }}
            </p>
            <p v-else class="recommend-desc">
              基于你的音乐偏好，每天为你精心推荐好音乐
            </p>
            <div class="recommend-actions">
              <button class="action-btn action-btn--primary" @click="handlePlayAll">
                ▶ 播放全部
              </button>
              <button class="action-btn" @click="handleAddToQueue">
                + 加入队列
              </button>
            </div>
          </div>
        </div>

        <div class="provider-tabs">
          <button
            v-for="p in providers"
            :key="p.id"
            class="provider-tab"
            :class="{ active: activeProvider === p.id }"
            :style="{ '--provider-color': p.color }"
            @click="activeProvider = p.id; loadRecommend()"
          >
            {{ p.name }}
          </button>
        </div>

        <div class="recommend-divider"></div>

        <div class="song-list">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <template v-else-if="recommend && recommend.songs.length > 0">
            <div
              v-for="(song, index) in recommend.songs"
              :key="song.id + '-' + index"
              class="song-item"
              @click="playSong(song, index)"
            >
              <div class="song-index">{{ index + 1 }}</div>
              <div class="song-cover">
                <img v-if="song.coverUrl" :src="song.coverUrl" alt="" />
              </div>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ getArtistsText(song) }}</div>
              </div>
              <div class="song-reason" v-if="song.reason">
                <span class="reason-tag">{{ song.reason }}</span>
              </div>
              <div class="song-duration">{{ formatDuration(song.duration) }}</div>
            </div>
          </template>
          <div v-else class="empty-state">
            <div class="empty-icon">🎵</div>
            <p>暂无推荐，登录后可获取个性化推荐</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.daily-recommend {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recommend-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.recommend-panel {
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

.recommend-close {
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

.recommend-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

.recommend-header {
  display: flex;
  gap: 24px;
  padding: 28px 28px 20px;
}

.recommend-cover {
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
  padding: 20px;
}

.cover-date {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.cover-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
}

.cover-subtitle {
  font-size: 12px;
  opacity: 0.8;
}

.recommend-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.recommend-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}

.recommend-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.recommend-date {
  color: rgba(255, 183, 77, 0.8);
}

.recommend-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recommend-actions {
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

.provider-tabs {
  display: flex;
  padding: 0 28px;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.provider-tab {
  padding: 8px 14px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.provider-tab:hover {
  color: rgba(255, 255, 255, 0.8);
}

.provider-tab.active {
  color: var(--provider-color, #d95b67);
  border-bottom-color: var(--provider-color, #d95b67);
}

.recommend-divider {
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
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.song-reason {
  flex-shrink: 0;
  max-width: 100px;
}

.reason-tag {
  font-size: 10px;
  color: rgba(255, 183, 77, 0.8);
  background: rgba(255, 183, 77, 0.15);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
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

.slide-enter-active .recommend-panel,
.slide-leave-active .recommend-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.slide-enter-from .recommend-panel,
.slide-leave-to .recommend-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
