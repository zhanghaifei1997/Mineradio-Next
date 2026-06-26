<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { providerManager } from '@/modules/providers'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import type { Song, SearchSuggestItem, HotSearchItem } from '@/types'
import { formatDuration } from '@/utils'

const player = usePlayerStore()
const queue = playQueueStore()

const keyword = ref('')
const results = ref<Song[]>([])
const loading = ref(false)
const suggestLoading = ref(false)
const activeProvider = ref('netease')
const searchHistory = ref<string[]>([])
const showDropdown = ref(false)
const hotSearchList = ref<HotSearchItem[]>([])
const suggestItems = ref<SearchSuggestItem[]>([])
const selectedIndex = ref(-1)
const activeSuggestTab = ref<'all' | 'song' | 'artist' | 'album' | 'playlist'>('all')

const HISTORY_KEY = 'mineradio-search-history'
let suggestTimer: ReturnType<typeof setTimeout> | null = null

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

function removeHistoryItem(index: number) {
  searchHistory.value.splice(index, 1)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
  } catch (_) {}
}

function useHistoryItem(kw: string) {
  keyword.value = kw
  showDropdown.value = false
  doSearch()
}

async function loadHotSearch() {
  try {
    const provider = providerManager.get(activeProvider.value) || providerManager.default
    const result = await provider.getHotSearch()
    hotSearchList.value = result.hots.slice(0, 10)
  } catch (e) {
    console.error('Load hot search error:', e)
    hotSearchList.value = []
  }
}

async function fetchSuggestions(kw: string) {
  if (!kw.trim()) {
    suggestItems.value = []
    return
  }
  suggestLoading.value = true
  try {
    const provider = providerManager.get(activeProvider.value) || providerManager.default
    const result = await provider.getSearchSuggest(kw)
    const allItems: SearchSuggestItem[] = [
      ...result.songs,
      ...result.artists,
      ...result.albums,
      ...result.playlists,
    ]
    suggestItems.value = allItems.slice(0, 15)
  } catch (e) {
    console.error('Search suggest error:', e)
    suggestItems.value = []
  } finally {
    suggestLoading.value = false
  }
}

function debounceSuggest(kw: string) {
  if (suggestTimer) {
    clearTimeout(suggestTimer)
  }
  suggestTimer = setTimeout(() => {
    fetchSuggestions(kw)
  }, 300)
}

function onInputChange() {
  selectedIndex.value = -1
  if (keyword.value.trim()) {
    debounceSuggest(keyword.value)
    showDropdown.value = true
  } else {
    suggestItems.value = []
    showDropdown.value = true
  }
}

async function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    return
  }
  loading.value = true
  showDropdown.value = false
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
  showDropdown.value = true
  if (hotSearchList.value.length === 0) {
    loadHotSearch()
  }
}

function onInputBlur() {
  setTimeout(() => {
    showDropdown.value = false
    selectedIndex.value = -1
  }, 200)
}

function handleHotSearchClick(item: HotSearchItem) {
  keyword.value = item.keyword
  showDropdown.value = false
  doSearch()
}

function handleSuggestClick(item: SearchSuggestItem) {
  keyword.value = item.keyword
  showDropdown.value = false
  doSearch()
}

function getSuggestTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    song: '歌曲',
    artist: '歌手',
    album: '专辑',
    playlist: '歌单',
  }
  return labels[type] || ''
}

const filteredSuggestions = computed(() => {
  if (activeSuggestTab.value === 'all') {
    return suggestItems.value
  }
  return suggestItems.value.filter((item) => item.type === activeSuggestTab.value)
})

function handleKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) return

  const items = filteredSuggestions.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < items.length - 1) {
      selectedIndex.value++
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedIndex.value >= 0 && selectedIndex.value < items.length) {
      handleSuggestClick(items[selectedIndex.value])
    } else {
      doSearch()
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}

const providers = providerManager.getAll()

watch(activeProvider, () => {
  hotSearchList.value = []
  if (showDropdown.value) {
    loadHotSearch()
  }
  if (keyword.value) {
    doSearch()
  }
})

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
        @input="onInputChange"
        @keyup.enter="doSearch"
        @keydown="handleKeydown"
        @focus="onInputFocus"
        @blur="onInputBlur"
      />
      <button class="search-btn" @click="doSearch" :disabled="loading">
        {{ loading ? '...' : '🔍' }}
      </button>
    </div>

    <Transition name="dropdown">
      <div v-if="showDropdown && !loading" class="search-dropdown">
        <template v-if="!keyword && hotSearchList.length > 0">
          <div class="dropdown-section">
            <div class="section-header">
              <span class="section-title">🔥 热搜榜</span>
            </div>
            <div class="hot-search-list">
              <div
                v-for="(item, index) in hotSearchList"
                :key="index"
                class="hot-search-item"
                @mousedown="handleHotSearchClick(item)"
              >
                <span class="hot-rank" :class="{ 'rank-top': index < 3 }">
                  {{ item.rank }}
                </span>
                <span class="hot-keyword">{{ item.keyword }}</span>
                <span v-if="item.hotValue" class="hot-value">
                  {{ Math.floor(item.hotValue / 10000) }}万
                </span>
                <span v-if="item.isHot" class="hot-tag hot">热</span>
                <span v-if="item.isNew" class="hot-tag new">新</span>
              </div>
            </div>
          </div>
        </template>

        <template v-if="!keyword && searchHistory.length > 0">
          <div class="dropdown-divider" v-if="hotSearchList.length > 0"></div>
          <div class="dropdown-section">
            <div class="section-header">
              <span class="section-title">🕐 搜索历史</span>
              <button class="section-action" @mousedown.stop="clearHistory">
                清空
              </button>
            </div>
            <div class="history-list">
              <div
                v-for="(item, index) in searchHistory.slice(0, 8)"
                :key="index"
                class="history-item"
                @mousedown="useHistoryItem(item)"
              >
                <span class="history-text">{{ item }}</span>
                <button
                  class="history-delete"
                  @mousedown.stop="removeHistoryItem(index)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-if="keyword && suggestItems.length > 0">
          <div class="dropdown-section">
            <div class="section-header">
              <span class="section-title">💡 搜索建议</span>
              <div class="suggest-tabs">
                <button
                  v-for="tab in (['all', 'song', 'artist', 'album', 'playlist'] as const)"
                  :key="tab"
                  class="suggest-tab"
                  :class="{ active: activeSuggestTab === tab }"
                  @mousedown.stop="activeSuggestTab = tab; selectedIndex = -1"
                >
                  {{ tab === 'all' ? '全部' : getSuggestTypeLabel(tab) }}
                </button>
              </div>
            </div>
            <div class="suggest-list" v-if="filteredSuggestions.length > 0">
              <div
                v-for="(item, index) in filteredSuggestions"
                :key="index"
                class="suggest-item"
                :class="{ selected: selectedIndex === index }"
                @mousedown="handleSuggestClick(item)"
                @mouseenter="selectedIndex = index"
              >
                <div class="suggest-icon">
                  <template v-if="item.type === 'song'">🎵</template>
                  <template v-else-if="item.type === 'artist'">👤</template>
                  <template v-else-if="item.type === 'album'">💿</template>
                  <template v-else-if="item.type === 'playlist'">📋</template>
                </div>
                <div class="suggest-info">
                  <div class="suggest-name">{{ item.name || item.keyword }}</div>
                  <div v-if="item.artist" class="suggest-artist">
                    {{ item.artist }}
                  </div>
                </div>
                <span class="suggest-type">{{ getSuggestTypeLabel(item.type) }}</span>
              </div>
            </div>
            <div v-else class="empty-suggest">
              没有找到相关建议
            </div>
          </div>
        </template>

        <div v-if="suggestLoading" class="suggest-loading">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      </div>
    </Transition>

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

.search-dropdown {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  max-height: 400px;
  overflow-y: auto;
}

.dropdown-section {
  padding: 8px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.section-title {
  font-weight: 500;
}

.section-action {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.section-action:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
}

.dropdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 0 16px;
}

.hot-search-list {
  padding: 0 8px 8px;
}

.hot-search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.hot-search-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.hot-rank {
  width: 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.rank-top {
  color: #d95b67;
}

.hot-keyword {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hot-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.hot-tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.hot-tag.hot {
  background: rgba(255, 77, 79, 0.2);
  color: #ff4d4f;
}

.hot-tag.new {
  background: rgba(24, 144, 255, 0.2);
  color: #1890ff;
}

.history-list {
  padding: 0 8px 8px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.history-text {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-delete {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  opacity: 0;
}

.history-item:hover .history-delete {
  opacity: 1;
}

.history-delete:hover {
  background: rgba(255, 77, 79, 0.2);
  color: #ff4d4f;
}

.suggest-tabs {
  display: flex;
  gap: 4px;
}

.suggest-tab {
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.suggest-tab:hover {
  color: rgba(255, 255, 255, 0.7);
}

.suggest-tab.active {
  color: #d95b67;
  background: rgba(217, 91, 103, 0.1);
}

.suggest-list {
  padding: 0 8px 8px;
}

.suggest-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.suggest-item:hover,
.suggest-item.selected {
  background: rgba(255, 255, 255, 0.08);
}

.suggest-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  flex-shrink: 0;
}

.suggest-info {
  flex: 1;
  min-width: 0;
}

.suggest-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggest-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggest-type {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  flex-shrink: 0;
}

.empty-suggest {
  padding: 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}

.suggest-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #d95b67;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, max-height 0.25s ease;
  overflow: hidden;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
