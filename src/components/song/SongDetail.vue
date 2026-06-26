<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { SongDetail, Artist, Album, Song } from '@/types'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { providerManager } from '@/modules/providers'
import CollectModal from '../playlist/CollectModal.vue'

const props = defineProps<{
  songId: string | null
  source: string
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-artist', artist: Artist): void
  (e: 'open-album', album: Album): void
  (e: 'open-comments'): void
}>()

const player = usePlayerStore()
const userStore = useUserStore()

const loading = ref(false)
const songDetail = ref<SongDetail | null>(null)
const isLiked = ref(false)
const likeLoading = ref(false)
const showCollectModal = ref(false)

function getProvider() {
  return providerManager.get(props.source) || providerManager.default
}

async function loadSongDetail() {
  if (!props.songId) return
  loading.value = true
  try {
    const provider = getProvider()
    const detail = await provider.getSongFullDetail(props.songId)
    songDetail.value = detail
    if (detail && userStore.isLoggedIn) {
      try {
        isLiked.value = await userStore.isSongLiked(props.source as any, props.songId)
      } catch (_) {}
    }
  } catch (e) {
    console.error('Load song detail error:', e)
  } finally {
    loading.value = false
  }
}

async function handleToggleLike() {
  if (!props.songId || likeLoading.value || !userStore.isLoggedIn) return
  likeLoading.value = true
  try {
    const result = await userStore.likeSong(
      props.source as any,
      props.songId,
      !isLiked.value,
      songDetail.value as any
    )
    if (result) {
      isLiked.value = !isLiked.value
    }
  } catch (e) {
    console.error('Toggle like error:', e)
  } finally {
    likeLoading.value = false
  }
}

function handlePlay() {
  if (songDetail.value) {
    player.play(songDetail.value as any)
  }
}

function handleOpenArtist(artist: Artist) {
  emit('open-artist', artist)
}

function handleOpenAlbum() {
  if (songDetail.value?.album) {
    emit('open-album', songDetail.value.album)
  }
}

function handleOpenComments() {
  emit('open-comments')
}

function handleOpenCollect() {
  if (songDetail.value) {
    showCollectModal.value = true
  }
}

function getArtistsText(): string {
  return songDetail.value?.artists?.map((a) => a.name).join(' / ') || ''
}

function formatPublishTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatSize(bytes?: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatBitrate(bitrate?: number): string {
  if (!bitrate) return '-'
  if (bitrate >= 1000) {
    return `${(bitrate / 1000).toFixed(0)} kbps`
  }
  return `${bitrate} bps`
}

const qualityLabel = computed(() => {
  const map: Record<string, string> = {
    standard: '标准',
    higher: '较高',
    exhigh: '极高',
    lossless: '无损',
    hires: 'Hi-Res',
  }
  return map[songDetail.value?.quality || ''] || '标准'
})

const coverGradient = computed(() => {
  return 'linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4))'
})

watch(
  () => props.songId,
  (id) => {
    if (id && props.visible) {
      loadSongDetail()
    }
  }
)

watch(
  () => props.visible,
  (v) => {
    if (v && props.songId && !songDetail.value) {
      loadSongDetail()
    }
  }
)
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && songId" class="song-detail">
      <div class="detail-backdrop" @click="emit('close')"></div>
      <div class="detail-panel" @click.stop>
        <button class="detail-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <template v-else-if="songDetail">
          <div class="detail-header">
            <div class="detail-cover" :style="{ background: coverGradient }">
              <img v-if="songDetail.coverUrl" :src="songDetail.coverUrl" alt="" />
            </div>
            <div class="detail-info">
              <h2 class="detail-title">{{ songDetail.name }}</h2>
              <div class="detail-artists">
                <span
                  v-for="artist in songDetail.artists"
                  :key="artist.id"
                  class="artist-link"
                  @click="handleOpenArtist(artist)"
                >
                  {{ artist.name }}
                </span>
              </div>
              <div v-if="songDetail.album" class="detail-album" @click="handleOpenAlbum">
                专辑：<span class="album-link">{{ songDetail.album.name }}</span>
              </div>
              <div class="detail-actions">
                <button class="action-btn action-btn--primary" @click="handlePlay">
                  ▶ 播放
                </button>
                <button
                  v-if="userStore.isLoggedIn"
                  class="action-btn"
                  :class="{ 'action-btn--liked': isLiked }"
                  @click="handleToggleLike"
                  :disabled="likeLoading"
                  :title="isLiked ? '取消喜欢' : '喜欢'"
                >
                  {{ isLiked ? '❤️ 已喜欢' : '🤍 喜欢' }}
                </button>
                <button class="action-btn action-btn--icon" @click="handleOpenComments" title="评论">
                  💬 评论
                </button>
                <button class="action-btn action-btn--icon" @click="handleOpenCollect" title="收藏到歌单">
                  📁 收藏
                </button>
                <button class="action-btn action-btn--icon" title="分享">
                  ↗ 分享
                </button>
              </div>
            </div>
          </div>

          <div class="detail-divider"></div>

          <div class="detail-body">
            <div class="info-section">
              <h3 class="section-title">歌曲信息</h3>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">时长</span>
                  <span class="info-value">{{ formatTime(songDetail.duration) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">音质</span>
                  <span class="info-value">{{ qualityLabel }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">比特率</span>
                  <span class="info-value">{{ formatBitrate(songDetail.bitrate) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">文件大小</span>
                  <span class="info-value">{{ formatSize(songDetail.size) }}</span>
                </div>
                <div v-if="songDetail.album?.genre" class="info-item">
                  <span class="info-label">流派</span>
                  <span class="info-value">{{ songDetail.album.genre }}</span>
                </div>
                <div v-if="songDetail.publishTime || songDetail.album?.publishTime" class="info-item">
                  <span class="info-label">发行时间</span>
                  <span class="info-value">{{ formatPublishTime(songDetail.publishTime || songDetail.album?.publishTime) }}</span>
                </div>
              </div>
            </div>

            <div v-if="songDetail.description" class="info-section">
              <h3 class="section-title">歌曲简介</h3>
              <p class="description-text">{{ songDetail.description }}</p>
            </div>

            <div v-if="songDetail.album?.description" class="info-section">
              <h3 class="section-title">专辑简介</h3>
              <p class="description-text">{{ songDetail.album.description }}</p>
            </div>
          </div>
        </template>

        <div v-else class="empty-state">
          未找到歌曲信息
        </div>
      </div>
    </div>
  </Transition>

  <CollectModal
    :visible="showCollectModal"
    :song="songDetail"
    @close="showCollectModal = false"
  />
</template>

<style scoped>
.song-detail {
  position: fixed;
  inset: 0;
  z-index: 350;
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
  width: min(560px, 92vw);
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
  gap: 20px;
  padding: 28px 28px 20px;
}

.detail-cover {
  width: 140px;
  height: 140px;
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
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-artists {
  margin-bottom: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.artist-link {
  font-size: 13px;
  color: #e87882;
  cursor: pointer;
  transition: color 0.2s;
}

.artist-link:hover {
  color: #d95b67;
  text-decoration: underline;
}

.detail-album {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
  cursor: pointer;
}

.album-link {
  color: #e87882;
}

.album-link:hover {
  text-decoration: underline;
}

.detail-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 7px 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
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
  padding: 7px 12px;
}

.action-btn--liked {
  background: rgba(255, 107, 107, 0.15);
  border-color: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
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

.detail-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 28px 24px;
}

.info-section {
  margin-bottom: 20px;
}

.info-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.info-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
}

.info-value {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.description-text {
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  white-space: pre-wrap;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
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
