<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { providerManager } from '@/modules/providers'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import type { Song } from '@/types'
import { formatDuration } from '@/utils'

const player = usePlayerStore()
const queue = playQueueStore()

const keyword = ref('')
const results = ref<Song[]>([])
const loading = ref(false)
const activeProvider = ref('netease')
const searchHistory = ref<string[]>([])
const showHistory = ref(false)

const HISTORY_KEY = 'mineradio-search-history'

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      searchHistory.value = JSON.parse(raw)
    }
  } catch (_) {}
}

function saveHistory(kw: string) {
  const trimmed = kw.trim()
  if (!trimmed) return
  
  const exists = searchHistory.value.indexOf(trimmed)
  if (exists >= 0) {
    searchHistory.value.splice(exists, 1)
  }
  searchHistory.value.unshift(trimmed)
  if (searchHistory.value.length > 20) {
    searchHistory.value = searchHistory.value.slice(0, 20)
  }
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
  } catch (_) {}
}

function clearHistory() {
  searchHistory.value = []
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch (_) {}
}

function useHistoryItem(kw: string) {
  keyword.value = kw
  showHistory.value = false
  doSearch()
}

async function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    return
  }
  loading.value = true
  showHistory.value = false
  saveHistory(keyword.value)
  try {
    const provider = providerManager.get(activeProvider.value) || providerManager.default
    const res = await provider.search(keyword.value)
    results.value = res.songs
  } catch (e) {
    console.error('Search error:', e)
    results.value = []
  } finally {
    loading.value = false
  }
}

function playSong(song: Song, index: number) {
  queue.setQueue(results.value, index)
  player.play(song)
}

function addToQueue(song: Song) {
  queue.addToQueue(song)
}

function onInputFocus() {
  if (searchHistory.value.length > 0 && !keyword.value) {
    showHistory.value = true
  }
}

function onInputBlur() {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

const providers = providerManager.getAll()

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="search-panel">
    <div class="search-bar">
      <input
        v-model="keyword"
        type="text"
        class="search-input"
        placeholder="搜索歌曲、歌手、专辑..."
        @keyup.enter="doSearch"
        @focus="onInputFocus"
        @blur="onInputBlur"
      />
      <button class="search-btn" @click="doSearch" :disabled="loading">
        {{ loading ? '...' : '🔍' }}
      </button>
    </div>

    <div class="search-history" v-if="showHistory && searchHistory.length > 0">
      <div class="history-header">
        <span class="history-title">搜索历史</span>
        <button class="history-clear" @click="clearHistory">清空</button>
      </div>
      <div class="history-list">
        <div
          v-for="(item, idx) in searchHistory"
          :key="idx"
          class="history-item"
          @mousedown="useHistoryItem(item)"
        >
          <span class="history-icon">🕐</span>
          <span class="history-text">{{ item }}</span>
        </div>
      </div>
    </div>

    <div class="provider-tabs" v-if="results.length > 0 || loading">
      <button
        v-for="p in providers"
        :key="p.id"
        class="provider-tab"
        :class="{ active: activeProvider === p.id }"
        :style="{ '--provider-color': p.color }"
        @click="activeProvider = p.id; doSearch()"
      >
        {{ p.name }}
      </button>
    </div>

    <div class="search-results" v-if="results.length > 0">
      <div class="result-header">
        <span>找到 {{ results.length }} 首歌曲</span>
      </div>
      <div class="result-list">
        <div
          v-for="(song, idx) in results"
          :key="song.id"
          class="result-item"
          @dblclick="playSong(song, idx)"
        >
          <div class="result-item__index">{{ idx + 1 }}</div>
          <div class="result-item__cover">
            <img :src="song.coverUrl" v-if="song.coverUrl" alt="" />
            <div class="cover-placeholder" v-else></div>
          </div>
          <div class="result-item__info">
            <div class="result-item__name">{{ song.name }}</div>
            <div class="result-item__artist">
              {{ song.artists.map(a => a.name).join(' / ') }}
            </div>
          </div>
          <div class="result-item__duration">
            {{ formatDuration(song.duration) }}
          </div>
          <div class="result-item__actions">
            <button class="result-item__play" @click.stop="playSong(song, idx)" title="播放">
              ▶
            </button>
            <button class="result-item__add" @click.stop="addToQueue(song)" title="添加到队列">
              +
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="search-empty" v-else-if="!loading && keyword && results.length === 0">
      没有找到相关结果
    </div>
  </div>
</template>

<style scoped>
.search-panel {
  position: absolute;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  max-height: calc(100vh - 180px);
  background: rgba(15, 15, 20, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.search-bar {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: rgba(217, 91, 103, 0.5);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.search-btn {
  padding: 0 20px;
  border: none;
  border-radius: 20px;
  background: rgba(217, 91, 103, 0.8);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.search-btn:hover {
  background: rgba(217, 91, 103, 1);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-history {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.history-title {
  font-weight: 500;
}

.history-clear {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.history-clear:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px 8px 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.history-icon {
  font-size: 14px;
  opacity: 0.5;
}

.history-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.provider-tabs {
  display: flex;
  padding: 0 16px;
  gap: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.provider-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
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

.search-results {
  flex: 1;
  overflow-y: auto;
}

.result-header {
  padding: 8px 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  position: sticky;
  top: 0;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(10px);
  z-index: 1;
}

.result-list {
  padding: 4px 8px 16px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.result-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.result-item__index {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.result-item__cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.result-item__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(100, 50, 150, 0.3));
}

.result-item__info {
  flex: 1;
  min-width: 0;
}

.result-item__name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item__artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item__duration {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.result-item__actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.result-item:hover .result-item__actions {
  opacity: 1;
}

.result-item__play,
.result-item__add {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(217, 91, 103, 0.8);
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.result-item__add {
  background: rgba(255, 255, 255, 0.15);
  font-size: 16px;
}

.result-item__play:hover {
  background: rgba(217, 91, 103, 1);
}

.result-item__add:hover {
  background: rgba(255, 255, 255, 0.25);
}

.search-empty {
  padding: 60px 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}
</style>
