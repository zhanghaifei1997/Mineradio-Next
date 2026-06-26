<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Playlist, Song } from '@/types'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/time'

const props = defineProps<{
  playlist: Playlist | null
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const queue = playQueueStore()
const player = usePlayerStore()

const loading = ref(false)

function handlePlaySong(song: Song, index: number) {
  if (props.playlist) {
    queue.setQueue(props.playlist.tracks, index)
    player.play(song)
  }
}

function handlePlayAll() {
  if (props.playlist && props.playlist.tracks.length > 0) {
    queue.setQueue(props.playlist.tracks, 0)
    player.play(props.playlist.tracks[0])
  }
}

function handleAddToQueue() {
  if (props.playlist) {
    props.playlist.tracks.forEach((song) => {
      queue.addToQueue(song)
    })
  }
}

function getArtistsText(song: Song): string {
  return song.artists.map((a) => a.name).join(' / ')
}

const coverGradient = computed(() => {
  if (!props.playlist?.coverUrl) {
    return 'linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4))'
  }
  return 'none'
})
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && playlist" class="playlist-detail">
      <div class="detail-backdrop" @click="emit('close')"></div>
      <div class="detail-panel" @click.stop>
        <button class="detail-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div class="detail-header">
          <div class="detail-cover" :style="{ background: coverGradient }">
            <img v-if="playlist.coverUrl" :src="playlist.coverUrl" alt="" />
          </div>
          <div class="detail-info">
            <h2 class="detail-title">{{ playlist.name }}</h2>
            <div class="detail-meta">
              <span v-if="playlist.trackCount">{{ playlist.trackCount }} 首歌曲</span>
              <span v-if="playlist.playCount" class="play-count">
                ▶ {{ Math.floor(playlist.playCount / 10000) }} 万
              </span>
            </div>
            <p v-if="playlist.description" class="detail-desc">{{ playlist.description }}</p>
            <div class="detail-actions">
              <button class="action-btn action-btn--primary" @click="handlePlayAll">
                ▶ 播放全部
              </button>
              <button class="action-btn" @click="handleAddToQueue">
                + 加入队列
              </button>
            </div>
          </div>
        </div>

        <div class="detail-divider"></div>

        <div class="song-list">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <template v-else>
            <div
              v-for="(song, index) in playlist.tracks"
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
                <div class="song-artist">{{ getArtistsText(song) }}</div>
              </div>
              <div class="song-duration">{{ formatTime(song.duration) }}</div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.playlist-detail {
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
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
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
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-actions {
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
  background: linear-gradient(135deg, #d95b67, #e87882);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
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
  border-top-color: #f4d28a;
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
