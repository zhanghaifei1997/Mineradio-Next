<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AlbumDetail, Song, Artist } from '@/types'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { providerManager } from '@/modules/providers'

const props = defineProps<{
  albumId: string | null
  source: string
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-artist', artist: Artist): void
}>()

const queue = playQueueStore()
const player = usePlayerStore()
const userStore = useUserStore()

const loading = ref(false)
const actionLoading = ref(false)
const albumDetail = ref<AlbumDetail | null>(null)

function getProvider() {
  return providerManager.get(props.source) || providerManager.default
}

async function loadAlbumDetail() {
  if (!props.albumId) return
  loading.value = true
  try {
    const provider = getProvider()
    const detail = await provider.getAlbum(props.albumId)
    albumDetail.value = detail
  } catch (e) {
    console.error('Load album detail error:', e)
  } finally {
    loading.value = false
  }
}

async function handleToggleSubscribe() {
  if (!props.albumId || actionLoading.value || !userStore.isLoggedIn) return
  actionLoading.value = true
  try {
    const provider = getProvider()
    const isSubscribed = albumDetail.value?.subscribed || false
    const result = await provider.subscribeAlbum(props.albumId, !isSubscribed)
    if (result && albumDetail.value) {
      albumDetail.value.subscribed = !isSubscribed
    }
  } catch (e) {
    console.error('Toggle subscribe error:', e)
  } finally {
    actionLoading.value = false
  }
}

function handlePlaySong(song: Song, index: number) {
  if (!albumDetail.value?.tracks) return
  queue.setQueue(albumDetail.value.tracks, index)
  player.play(song)
}

function handlePlayAll() {
  if (albumDetail.value?.tracks && albumDetail.value.tracks.length > 0) {
    queue.setQueue(albumDetail.value.tracks, 0)
    player.play(albumDetail.value.tracks[0])
  }
}

function handleAddToQueue() {
  if (albumDetail.value?.tracks) {
    albumDetail.value.tracks.forEach((song) => {
      queue.addToQueue(song)
    })
  }
}

function handleOpenArtist(artist: Artist) {
  emit('open-artist', artist)
}

function getArtistsText(): string {
  return albumDetail.value?.artists?.map((a) => a.name).join(' / ') || ''
}

function formatPublishTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatCount(count?: number): string {
  if (!count) return '0'
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + ' 万'
  }
  return String(count)
}

const coverGradient = computed(() => {
  return 'linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4))'
})

watch(
  () => props.albumId,
  (id) => {
    if (id && props.visible) {
      loadAlbumDetail()
    }
  }
)

watch(
  () => props.visible,
  (v) => {
    if (v && props.albumId && !albumDetail.value) {
      loadAlbumDetail()
    }
  }
)
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && albumId" class="album-detail">
      <div class="detail-backdrop" @click="emit('close')"></div>
      <div class="detail-panel" @click.stop>
        <button class="detail-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <template v-else-if="albumDetail">
          <div class="detail-header">
            <div class="detail-cover" :style="{ background: coverGradient }">
              <img v-if="albumDetail.coverUrl" :src="albumDetail.coverUrl" alt="" />
            </div>
            <div class="detail-info">
              <h2 class="detail-title">{{ albumDetail.name }}</h2>
              <div
                v-if="albumDetail.artists && albumDetail.artists.length > 0"
                class="detail-artists"
              >
                <span
                  v-for="artist in albumDetail.artists"
                  :key="artist.id"
                  class="artist-link"
                  @click="handleOpenArtist(artist)"
                >
                  {{ artist.name }}
                </span>
              </div>
              <div class="detail-meta">
                <span v-if="albumDetail.publishTime" class="meta-item">
                  {{ formatPublishTime(albumDetail.publishTime) }}
                </span>
                <span v-if="albumDetail.genre" class="meta-item">
                  {{ albumDetail.genre }}
                </span>
                <span v-if="albumDetail.songCount" class="meta-item">
                  {{ albumDetail.songCount }} 首歌曲
                </span>
                <span v-if="albumDetail.playCount" class="meta-item play-count">
                  ▶ {{ formatCount(albumDetail.playCount) }}
                </span>
              </div>
              <p v-if="albumDetail.description" class="detail-desc">{{ albumDetail.description }}</p>
              <div class="detail-actions">
                <button class="action-btn action-btn--primary" @click="handlePlayAll">
                  ▶ 播放全部
                </button>
                <button class="action-btn" @click="handleAddToQueue">
                  + 加入队列
                </button>
                <button
                  v-if="userStore.isLoggedIn"
                  class="action-btn action-btn--icon"
                  :class="{ 'action-btn--liked': albumDetail.subscribed }"
                  @click="handleToggleSubscribe"
                  :disabled="actionLoading"
                  :title="albumDetail.subscribed ? '取消收藏' : '收藏'"
                >
                  {{ albumDetail.subscribed ? '★ 已收藏' : '☆ 收藏' }}
                </button>
                <button class="action-btn action-btn--icon" title="分享">
                  ↗ 分享
                </button>
              </div>
            </div>
          </div>

          <div class="detail-divider"></div>

          <div class="song-list">
            <div
              v-for="(song, index) in albumDetail.tracks"
              :key="song.id + '-' + index"
              class="song-item"
              @click="handlePlaySong(song, index)"
            >
              <div class="song-index">{{ index + 1 }}</div>
              <div class="song-cover">
                <img v-if="song.coverUrl" :src="song.coverUrl" alt="" />
              </div>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ song.artists?.map(a => a.name).join(' / ') }}</div>
              </div>
              <div class="song-duration">{{ formatTime(song.duration) }}</div>
            </div>
            <div v-if="!albumDetail.tracks || albumDetail.tracks.length === 0" class="empty-state">
              暂无歌曲
            </div>
          </div>
        </template>

        <div v-else class="empty-state">
          未找到专辑信息
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.album-detail {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.detail-panel {
  position: relative;
  width: min(680px, 92vw);
  max-height: 80vh;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.95),
    rgba(15, 15, 22, 0.98)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.detail-close {
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

.detail-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.detail-header {
  display: flex;
  gap: 24px;
  padding: 28px 28px 20px;
}

.detail-cover {
  width: 160px;
  height: 160px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.detail-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.detail-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-artists {
  margin-bottom: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.artist-link {
  font-size: 14px;
  color: #e87882;
  cursor: pointer;
  transition: color 0.2s;
}

.artist-link:hover {
  color: #d95b67;
  text-decoration: underline;
}

.detail-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  flex-wrap: wrap;
}

.meta-item {
  color: rgba(255, 255, 255, 0.5);
}

.play-count {
  color: rgba(255, 255, 255, 0.4);
}

.detail-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
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
  background: linear-gradient(135deg, #d95b67, #e87882);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
}

.action-btn--icon {
  padding: 8px 14px;
}

.action-btn--liked {
  background: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.3);
  color: #ffc107;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.detail-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0 28px;
}

.song-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
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
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
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

.song-duration {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.25s ease;
}

.slide-enter-active .detail-panel,
.slide-leave-active .detail-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.slide-enter-from .detail-panel,
.slide-leave-to .detail-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
