<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import type { Song } from '@/types'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'play-song', song: Song): void
}>()

const history = useHistoryStore()
const player = usePlayerStore()
const playQueue = playQueueStore()

const searchQuery = ref('')

const historyList = computed(() => {
  if (!searchQuery.value.trim()) {
    return history.history
  }
  const query = searchQuery.value.toLowerCase()
  return history.history.filter((entry) => {
    const song = entry.song
    const nameMatch = song.name?.toLowerCase().includes(query)
    const artistMatch = song.artists?.some((a) => a.name.toLowerCase().includes(query))
    const albumMatch = song.album?.name?.toLowerCase().includes(query)
    return nameMatch || artistMatch || albumMatch
  })
})

function playSong(song: Song) {
  playQueue.clearQueue()
  playQueue.addToQueue(song)
  player.play(song)
  emit('play-song', song)
}

function removeSong(index: number) {
  const entry = history.history[index]
  if (entry) {
    history.removeFromHistory(entry.song.id, entry.song.source)
  }
}

function clearAll() {
  if (confirm('确定要清空播放历史吗？')) {
    history.clearHistory()
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function getSourceLabel(source: string): string {
  const map: Record<string, string> = {
    netease: '网易云',
    qqmusic: 'QQ音乐',
    kugou: '酷狗',
    local: '本地',
  }
  return map[source] || source
}

function getSourceColor(source: string): string {
  const map: Record<string, string> = {
    netease: '#d95b67',
    qqmusic: '#00F5D4',
    kugou: '#2CA2F9',
    local: '#666',
  }
  return map[source] || '#888'
}
</script>

<template>
  <div class="recent-panel">
    <div class="panel-header">
      <h3>最近播放</h3>
      <div class="header-actions">
        <span class="count-badge">{{ historyList.length }} 首</span>
        <button
          v-if="history.history.length > 0"
          class="clear-btn"
          @click="clearAll"
          title="清空历史"
        >
          🗑️
        </button>
      </div>
    </div>

    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索历史..."
        class="search-input"
      />
    </div>

    <div class="panel-content">
      <div v-if="historyList.length === 0" class="empty-state">
        <div class="empty-icon">📻</div>
        <div class="empty-text">暂无播放历史</div>
        <div class="empty-hint">开始播放歌曲吧</div>
      </div>

      <div v-else class="song-list">
        <div
          v-for="(entry, index) in historyList"
          :key="`${entry.song.source}-${entry.song.id}-${entry.playedAt}`"
          class="song-item"
          :class="{ active: player.currentSong?.id === entry.song.id && player.currentSong?.source === entry.song.source }"
          @click="playSong(entry.song)"
        >
          <div class="song-index">{{ index + 1 }}</div>

          <div class="song-cover">
            <img v-if="entry.song.coverUrl" :src="entry.song.coverUrl" alt="" />
            <div v-else class="cover-placeholder">🎵</div>
          </div>

          <div class="song-info">
            <div class="song-name">{{ entry.song.name }}</div>
            <div class="song-artist">
              {{ entry.song.artists?.map(a => a.name).join(' / ') }}
            </div>
          </div>

          <div class="song-meta">
            <span class="source-tag" :style="{ color: getSourceColor(entry.song.source) }">
              {{ getSourceLabel(entry.song.source) }}
            </span>
            <span class="play-time">{{ history.formatPlayedAt(entry.playedAt) }}</span>
            <span class="song-duration">{{ formatDuration(entry.song.duration) }}</span>
          </div>

          <button
            class="remove-btn"
            @click.stop="removeSong(index)"
            title="从历史中移除"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recent-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.count-badge {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
}

.clear-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.clear-btn:hover {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.search-bar {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  font-size: 12px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: rgba(217, 91, 103, 0.4);
  background: rgba(255, 255, 255, 0.06);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.3);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  opacity: 0.7;
}

.song-list {
  padding: 8px 0;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.song-item.active {
  background: rgba(217, 91, 103, 0.15);
}

.song-item.active .song-name {
  color: #d95b67;
}

.song-index {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.song-cover img {
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
  font-size: 18px;
  opacity: 0.5;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 13px;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.song-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.source-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
}

.play-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  min-width: 50px;
  text-align: right;
}

.song-duration {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  min-width: 40px;
  text-align: right;
}

.remove-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: all 0.2s;
  flex-shrink: 0;
}

.song-item:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}
</style>
