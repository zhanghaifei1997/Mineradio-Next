<script setup lang="ts">
import { ref, computed } from 'vue'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'
import { useUserStore } from '@/stores/user'
import { useDjStore } from '@/stores/dj'
import { formatTime } from '@/utils/time'
import type { Song, UserPlaylist } from '@/types'

const queue = playQueueStore()
const player = usePlayerStore()
const fx = useFxStore()
const user = useUserStore()
const dj = useDjStore()

const activeTab = ref<'queue' | 'playlists' | 'podcasts'>('queue')
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const playModeLabel = computed(() => {
  const map: Record<string, string> = {
    sequence: '顺序播放',
    loop: '列表循环',
    single: '单曲循环',
    shuffle: '随机播放',
  }
  return map[player.playMode] || '顺序播放'
})

const playModeIcon = computed(() => {
  const map: Record<string, string> = {
    sequence: '🔁',
    loop: '🔂',
    single: '🔄',
    shuffle: '🔀',
  }
  return map[player.playMode] || '🔁'
})

function playSong(index: number) {
  const song = queue.playAt(index)
  if (song) {
    player.play(song)
  }
}

function removeSong(index: number) {
  queue.removeFromQueue(index)
}

function clearQueue() {
  if (queue.isEmpty) return
  if (confirm('确定要清空播放队列吗？')) {
    queue.clearQueue()
  }
}

function cyclePlayMode() {
  player.cyclePlayMode()
  if (player.playMode === 'shuffle') {
    queue.reshuffle()
  }
}

function togglePin() {
  fx.queuePinned = !fx.queuePinned
}

function shuffleQueue() {
  queue.reshuffle()
  player.setPlayMode('shuffle')
}

async function refreshPlaylists() {
  await user.fetchAllUserPlaylists()
}

function openPlaylist(pl: UserPlaylist) {
  // Emit event to parent to open playlist detail
  // For now, load the playlist into queue
  if (pl.trackCount > 0) {
    // The parent component will handle opening the detail view
    console.log('Open playlist:', pl.name)
  }
}

async function refreshPodcasts() {
  await dj.loadSubscribedRadios(true)
}

function getArtistNames(song: Song): string {
  return song.artists.map((a) => a.name).join(' / ')
}

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverIndex.value = index
}

function onDragLeave() {
  dragOverIndex.value = null
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault()
  if (dragIndex.value !== null && dragIndex.value !== toIndex) {
    queue.move(dragIndex.value, toIndex)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}
</script>

<template>
  <div class="playlist-queue">
    <div class="queue-header">
      <div class="queue-info">
        <h3 class="queue-title">歌单 / 队列</h3>
      </div>
      <div class="queue-actions">
        <button
          class="pin-btn"
          @click="togglePin"
          :class="{ 'pin-btn--pinned': fx.queuePinned }"
          :title="fx.queuePinned ? '取消固定' : '固定面板'"
        >
          {{ fx.queuePinned ? '📌' : '📍' }}
        </button>
        <button class="shuffle-btn" @click="shuffleQueue" title="随机播放">随机</button>
      </div>
    </div>

    <div class="panel-tabs">
      <button class="panel-tab" :class="{ active: activeTab === 'queue' }" @click="activeTab = 'queue'">当前队列</button>
      <button class="panel-tab" :class="{ active: activeTab === 'playlists' }" @click="activeTab = 'playlists'">我的歌单</button>
      <button class="panel-tab" :class="{ active: activeTab === 'podcasts' }" @click="activeTab = 'podcasts'">我的播客</button>
    </div>

    <!-- Queue Tab -->
    <template v-if="activeTab === 'queue'">
      <div class="queue-toolbar">
        <div class="queue-chip" @click="cyclePlayMode" :title="playModeLabel">
          <span class="chip-icon">{{ playModeIcon }}</span>
          <span>{{ playModeLabel }}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="mini-btn" @click="cyclePlayMode">切换模式</button>
          <button class="mini-btn" @click="clearQueue" :disabled="queue.isEmpty">清空</button>
        </div>
      </div>

      <div class="queue-content" v-if="!queue.isEmpty">
        <div
          v-for="(song, index) in queue.queue"
          :key="song.id + '-' + index"
          class="queue-item"
          :class="{
            'is-current': index === queue.currentIndex,
            'is-dragging': dragIndex === index,
            'is-drag-over': dragOverIndex === index && dragIndex !== index,
          }"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover="onDragOver($event, index)"
          @dragleave="onDragLeave"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
          @dblclick="playSong(index)"
        >
          <div class="item-index">
            <span v-if="index === queue.currentIndex && player.isPlaying" class="playing-indicator">
              <span class="bar"></span><span class="bar"></span><span class="bar"></span>
            </span>
            <span v-else>{{ index + 1 }}</span>
          </div>
          <div class="item-cover">
            <img :src="song.coverUrl" v-if="song.coverUrl" alt="" />
            <div class="cover-placeholder" v-else>♪</div>
          </div>
          <div class="item-info">
            <div class="item-title">{{ song.name }}</div>
            <div class="item-artist">{{ getArtistNames(song) }}</div>
          </div>
          <div class="item-duration">{{ formatTime(song.duration) }}</div>
          <div class="item-actions">
            <button class="action-btn" @click.stop="playSong(index)" title="播放">▶</button>
            <button class="action-btn remove-btn" @click.stop="removeSong(index)" title="移除">✕</button>
          </div>
          <div class="drag-handle" title="拖动排序">⋮⋮</div>
        </div>
      </div>
      <div v-else class="queue-empty">
        <div class="empty-icon">📋</div>
        <p>播放队列为空</p>
        <p class="hint">添加歌曲到队列开始播放</p>
      </div>
    </template>

    <!-- Playlists Tab -->
    <template v-if="activeTab === 'playlists'">
      <div class="queue-toolbar">
        <div class="queue-chip">{{ user.isLoggedIn ? '网易云 / QQ 歌单' : '登录后显示歌单' }}</div>
        <button class="mini-btn" @click="refreshPlaylists">刷新</button>
      </div>
      <div class="pane-list">
        <template v-if="user.userPlaylists.length > 0">
          <div
            v-for="pl in user.userPlaylists"
            :key="pl.id + '-' + pl.source"
            class="pl-item"
            @click="openPlaylist(pl)"
          >
            <div class="pl-cover">
              <img v-if="pl.coverUrl" :src="pl.coverUrl" alt="" />
              <div v-else class="cover-placeholder">🎵</div>
            </div>
            <div class="pl-info">
              <div class="pl-name">{{ pl.name }}</div>
              <div class="pl-meta">{{ pl.trackCount }} 首 · {{ pl.source === 'netease' ? '网易云' : pl.source === 'qqmusic' ? 'QQ音乐' : '酷狗' }}</div>
            </div>
          </div>
        </template>
        <div v-else class="queue-empty">
          <p class="hint">{{ user.isLoggedIn ? '暂无歌单' : '请先登录' }}</p>
        </div>
      </div>
    </template>

    <!-- Podcasts Tab -->
    <template v-if="activeTab === 'podcasts'">
      <div class="queue-toolbar">
        <div class="queue-chip">收藏 / 创建 / 喜欢</div>
        <button class="mini-btn" @click="refreshPodcasts">刷新</button>
      </div>
      <div class="pane-list">
        <template v-if="dj.subscribedRadios.length > 0">
          <div
            v-for="radio in dj.subscribedRadios"
            :key="radio.id"
            class="pl-item"
          >
            <div class="pl-cover">
              <img v-if="radio.picUrl" :src="radio.picUrl" alt="" />
              <div v-else class="cover-placeholder">🎙️</div>
            </div>
            <div class="pl-info">
              <div class="pl-name">{{ radio.name }}</div>
              <div class="pl-meta">{{ radio.programCount || 0 }} 期 · {{ radio.category || '播客' }}</div>
            </div>
          </div>
        </template>
        <div v-else class="queue-empty">
          <p class="hint">暂无订阅播客</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.playlist-queue {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 25, 0.9);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  overflow: hidden;
  color: #fff;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.queue-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.queue-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.queue-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 10px;
}

.play-mode-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(217, 91, 103, 0.15);
  border: 1px solid rgba(217, 91, 103, 0.3);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.play-mode-chip:hover {
  background: rgba(217, 91, 103, 0.25);
  border-color: rgba(217, 91, 103, 0.5);
}

.chip-icon {
  font-size: 12px;
}

.pin-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.pin-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.pin-btn--pinned {
  color: #f4d28a;
  border-color: rgba(244, 210, 138, 0.3);
  background: rgba(244, 210, 138, 0.1);
}

.pin-btn--pinned:hover {
  background: rgba(244, 210, 138, 0.2);
  color: #f4d28a;
}

.queue-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shuffle-btn {
  padding: 4px 12px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.shuffle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0 16px;
}

.panel-tab {
  flex: 1;
  padding: 10px 0;
  font-size: 12px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.panel-tab:hover {
  color: rgba(255, 255, 255, 0.7);
}

.panel-tab.active {
  color: #fff;
  border-bottom-color: var(--fc-accent, #00f5d4);
}

.queue-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.queue-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.05);
  padding: 4px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
}

.queue-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.chip-icon {
  font-size: 12px;
}

.mini-btn {
  padding: 4px 10px;
  font-size: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  height: 26px;
}

.mini-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.mini-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pane-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--fc-accent-rgb), 0.2) transparent;
}

.pl-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  transition: background 0.15s;
}

.pl-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.pl-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.pl-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pl-cover .cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.2);
}

.pl-info {
  flex: 1;
  min-width: 0;
}

.pl-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-meta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 3px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

.mode-icon {
  font-size: 14px;
}

.clear-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn:hover:not(:disabled) {
  background: rgba(255, 82, 82, 0.1);
  color: #ff5252;
}

.clear-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.queue-content {
  flex: 1;
  overflow-y: auto;
}

/* 歌单面板品牌色滚动条 */
.playlist-queue::-webkit-scrollbar,
.queue-content::-webkit-scrollbar {
  width: 3px;
}

.playlist-queue::-webkit-scrollbar-track,
.queue-content::-webkit-scrollbar-track {
  background: transparent;
}

.playlist-queue::-webkit-scrollbar-thumb,
.queue-content::-webkit-scrollbar-thumb {
  background: rgba(var(--fc-accent-rgb), 0.2);
  border-radius: 999px;
}

.playlist-queue::-webkit-scrollbar-thumb:hover,
.queue-content::-webkit-scrollbar-thumb:hover {
  background: rgba(var(--fc-accent-rgb), 0.36);
}

.queue-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--fc-accent-rgb), 0.2) transparent;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.queue-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.queue-item.is-current {
  background: rgba(217, 91, 103, 0.1);
}

.queue-item.is-current .item-title {
  color: #d95b67;
}

.queue-item.is-dragging {
  opacity: 0.5;
}

.queue-item.is-drag-over::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #d95b67;
}

.item-index {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.playing-indicator {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  height: 16px;
}

.playing-indicator .bar {
  width: 3px;
  background: #d95b67;
  border-radius: 1px;
  animation: playing-bounce 0.8s ease-in-out infinite;
}

.playing-indicator .bar:nth-child(1) {
  height: 40%;
  animation-delay: -0.4s;
}

.playing-indicator .bar:nth-child(2) {
  height: 100%;
  animation-delay: -0.2s;
}

.playing-indicator .bar:nth-child(3) {
  height: 60%;
  animation-delay: 0s;
}

@keyframes playing-bounce {
  0%, 100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}

.item-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.item-cover img {
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
  font-size: 16px;
  color: rgba(255, 255, 255, 0.2);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-duration {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  min-width: 40px;
  text-align: right;
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.queue-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.remove-btn:hover {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}

.drag-handle {
  color: rgba(255, 255, 255, 0.2);
  font-size: 12px;
  cursor: grab;
  flex-shrink: 0;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.queue-item:hover .drag-handle {
  opacity: 1;
}

.drag-handle:active {
  cursor: grabbing;
}

.queue-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.queue-empty p {
  margin: 4px 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.queue-empty .hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}
</style>
