<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { localMusicLibrary } from '@/modules/local'
import type { LocalSong, ScanProgress, ScanStatus, LibraryStats } from '@/modules/local'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import { formatTime } from '@/utils/time'

const player = usePlayerStore()
const queue = playQueueStore()

const songs = ref<LocalSong[]>([])
const scanStatus = ref<ScanStatus>('idle')
const scanProgress = ref<ScanProgress>({ current: 0, total: 0, currentFile: '' })
const stats = ref<LibraryStats>({
  totalSongs: 0,
  totalArtists: 0,
  totalAlbums: 0,
  totalDuration: 0,
  totalFileSize: 0,
})
const searchKeyword = ref('')
const isAvailable = ref(false)
const errorMessage = ref('')

let unsubscribe: (() => void) | null = null

const filteredSongs = computed(() => {
  if (!searchKeyword.value) return songs.value
  const kw = searchKeyword.value.toLowerCase()
  return songs.value.filter(
    (s) =>
      s.title.toLowerCase().includes(kw) ||
      s.artist.toLowerCase().includes(kw) ||
      s.album.toLowerCase().includes(kw)
  )
})

const isScanning = computed(() => scanStatus.value === 'scanning')

const scanProgressPercent = computed(() => {
  if (scanProgress.value.total === 0) return 0
  return (scanProgress.value.current / scanProgress.value.total) * 100
})

function updateState() {
  songs.value = localMusicLibrary.getAllSongs()
  scanStatus.value = localMusicLibrary.getScanStatus()
  scanProgress.value = localMusicLibrary.getScanProgress()
  stats.value = localMusicLibrary.getStats()
}

async function handleSelectDirectory() {
  errorMessage.value = ''
  try {
    const dirPath = await localMusicLibrary.selectDirectory()
    if (dirPath) {
      await handleScan(dirPath)
    }
  } catch (e: any) {
    errorMessage.value = e.message || '选择目录失败'
  }
}

async function handleScan(dirPath: string) {
  errorMessage.value = ''
  try {
    await localMusicLibrary.scanDirectory(dirPath)
    updateState()
  } catch (e: any) {
    errorMessage.value = e.message || '扫描失败'
    scanStatus.value = 'error'
  }
}

function playSong(song: LocalSong) {
  const songData = localMusicLibrary.localSongToSong(song)
  player.play(songData)
}

function addToQueue(song: LocalSong) {
  const songData = localMusicLibrary.localSongToSong(song)
  queue.addToQueue(songData)
}

function playAll() {
  if (filteredSongs.value.length === 0) return
  const songList = filteredSongs.value.map((s) => localMusicLibrary.localSongToSong(s))
  queue.setQueue(songList, 0)
  if (songList[0]) {
    player.play(songList[0])
  }
}

function clearLibrary() {
  if (confirm('确定要清空本地音乐库吗？')) {
    localMusicLibrary.clearLibrary()
    updateState()
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

onMounted(() => {
  isAvailable.value = localMusicLibrary.isAvailable()
  updateState()
  unsubscribe = localMusicLibrary.subscribe(updateState)
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>

<template>
  <div class="local-music-panel">
    <div class="panel-header">
      <h2 class="panel-title">本地音乐</h2>
      <div class="panel-actions">
        <button
          v-if="isAvailable"
          class="btn btn-primary"
          @click="handleSelectDirectory"
          :disabled="isScanning"
        >
          {{ isScanning ? '扫描中...' : '选择文件夹' }}
        </button>
        <button
          v-if="songs.length > 0"
          class="btn btn-secondary"
          @click="playAll"
        >
          播放全部
        </button>
        <button
          v-if="songs.length > 0"
          class="btn btn-danger"
          @click="clearLibrary"
        >
          清空
        </button>
      </div>
    </div>

    <div v-if="!isAvailable" class="not-available">
      <div class="not-available-icon">💻</div>
      <p>本地音乐功能仅在桌面端可用</p>
      <p class="hint">请使用 Mineradio 桌面客户端体验此功能</p>
    </div>

    <div v-else-if="isScanning" class="scanning">
      <div class="scan-progress">
        <div class="scan-progress-bar">
          <div
            class="scan-progress-fill"
            :style="{ width: scanProgressPercent + '%' }"
          ></div>
        </div>
        <div class="scan-info">
          <span>正在扫描: {{ scanProgress.current }} / {{ scanProgress.total }}</span>
        </div>
        <div class="scan-file" v-if="scanProgress.currentFile">
          {{ scanProgress.currentFile.split(/[\\/]/).pop() }}
        </div>
      </div>
    </div>

    <div v-else-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <template v-else>
      <div v-if="songs.length > 0" class="library-stats">
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalSongs }}</span>
          <span class="stat-label">首歌曲</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalArtists }}</span>
          <span class="stat-label">位艺术家</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalAlbums }}</span>
          <span class="stat-label">张专辑</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatTime(stats.totalDuration) }}</span>
          <span class="stat-label">总时长</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ formatFileSize(stats.totalFileSize) }}</span>
          <span class="stat-label">总大小</span>
        </div>
      </div>

      <div class="search-bar">
        <input
          type="text"
          v-model="searchKeyword"
          placeholder="搜索本地音乐..."
          class="search-input"
        />
      </div>

      <div class="song-list" v-if="filteredSongs.length > 0">
        <div class="song-list-header">
          <div class="col-index">#</div>
          <div class="col-title">标题</div>
          <div class="col-artist">艺术家</div>
          <div class="col-album">专辑</div>
          <div class="col-duration">时长</div>
          <div class="col-actions">操作</div>
        </div>
        <div
          v-for="(song, index) in filteredSongs"
          :key="song.id"
          class="song-item"
          @dblclick="playSong(song)"
        >
          <div class="col-index">{{ index + 1 }}</div>
          <div class="col-title">
            <div class="song-cover">
              <img :src="song.coverUrl" v-if="song.coverUrl" alt="" />
              <div class="cover-placeholder" v-else>♪</div>
            </div>
            <span class="song-title">{{ song.title }}</span>
          </div>
          <div class="col-artist">{{ song.artist }}</div>
          <div class="col-album">{{ song.album }}</div>
          <div class="col-duration">{{ formatTime(song.duration) }}</div>
          <div class="col-actions">
            <button class="action-btn" @click.stop="playSong(song)" title="播放">
              ▶
            </button>
            <button class="action-btn" @click.stop="addToQueue(song)" title="添加到队列">
              +
            </button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <div class="empty-icon">🎵</div>
        <p>暂无本地音乐</p>
        <p class="hint">点击"选择文件夹"开始扫描本地音乐</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.local-music-panel {
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

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.panel-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
}

.btn-danger {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}

.btn-danger:hover {
  background: rgba(255, 82, 82, 0.3);
}

.not-available,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.not-available-icon,
.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.hint {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  margin-top: 8px;
}

.scanning {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.scan-progress {
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.scan-progress-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 12px;
}

.scan-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
  border-radius: 4px;
  transition: width 0.3s;
}

.scan-info {
  font-size: 14px;
  margin-bottom: 8px;
}

.scan-file {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.error-message {
  padding: 16px 24px;
  background: rgba(255, 82, 82, 0.1);
  color: #ff5252;
  border-bottom: 1px solid rgba(255, 82, 82, 0.2);
}

.library-stats {
  display: flex;
  gap: 24px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #4CAF50;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.search-bar {
  padding: 12px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: rgba(76, 175, 80, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.song-list {
  flex: 1;
  overflow-y: auto;
}

.song-list-header {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 1fr 80px 100px;
  gap: 12px;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  position: sticky;
  top: 0;
  z-index: 1;
}

.song-item {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 1fr 80px 100px;
  gap: 12px;
  padding: 10px 24px;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: background 0.15s;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.col-index {
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  text-align: center;
}

.col-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.song-cover {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
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
  font-size: 16px;
  color: rgba(255, 255, 255, 0.3);
}

.song-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-artist,
.col-album {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-duration {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.col-actions {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
</style>
