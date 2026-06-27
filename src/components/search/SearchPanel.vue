<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { providerManager } from '@/modules/providers'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import { useFxStore } from '@/stores/fx'
import type { Song, SearchSuggestItem, HotSearchItem } from '@/types'
import { formatDuration } from '@/utils'

const player = usePlayerStore()
const queue = playQueueStore()
const fx = useFxStore()

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
const searchMode = ref<'all' | 'netease' | 'qq' | 'podcast'>('all')

const HISTORY_KEY = 'mineradio-search-history'
const HISTORY_MAX = 10
const SEARCH_AUTOS_SEARCH_DELAY = 180
let suggestTimer: ReturnType<typeof setTimeout> | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestSeq = 0

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        searchHistory.value = parsed
          .map((v: unknown) => String(v ?? '').trim())
          .filter(Boolean)
          .slice(0, HISTORY_MAX)
      }
    }
  } catch (_) {}
}

function saveHistory(kw: string) {
  const trimmed = kw.trim()
  if (!trimmed) return

  const lower = trimmed.toLowerCase()
  // 按小写去重，原项目行为
  searchHistory.value = searchHistory.value.filter(
    (item) => item.toLowerCase() !== lower
  )
  searchHistory.value.unshift(trimmed)
  if (searchHistory.value.length > HISTORY_MAX) {
    searchHistory.value = searchHistory.value.slice(0, HISTORY_MAX)
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
  const q = keyword.value.trim()
  if (q) {
    debounceSuggest(keyword.value)
    showDropdown.value = true
    // 自动搜索：180ms 防抖，原项目行为
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      // 防抖触发时再次校验当前输入，避免用户在等待期间清空输入
      if (keyword.value.trim()) {
        doSearch()
      }
    }, SEARCH_AUTOS_SEARCH_DELAY)
  } else {
    suggestItems.value = []
    showDropdown.value = true
    // 输入为空时取消挂起的自动搜索并清空结果
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    searchRequestSeq++ // 让任何 in-flight 的 doSearch 结果失效
    results.value = []
  }
}

async function doSearch() {
  const query = keyword.value.trim()
  if (!query) {
    results.value = []
    return
  }
  // 显式触发搜索时取消任何挂起的自动搜索防抖，避免重复请求
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  // 竞态保护：本次搜索请求分配一个递增的 seq
  const seq = ++searchRequestSeq
  loading.value = true
  showDropdown.value = false
  saveHistory(query)
  try {
    let combined: Song[]
    if (searchMode.value === 'all') {
      const allResults = await providerManager.searchAll(query)
      // seq 校验：异步返回时若已有更新的请求，丢弃结果
      if (seq !== searchRequestSeq) return
      combined = []
      for (const [, res] of allResults) {
        combined.push(...res.songs)
      }
    } else if (searchMode.value === 'podcast') {
      const provider = providerManager.get('netease') || providerManager.default
      const res = await provider.search(query, { type: 'song' })
      if (seq !== searchRequestSeq) return
      combined = res.songs.filter((s: Song) => s.isPodcast)
    } else {
      const providerId = searchMode.value === 'netease' ? 'netease' : 'qqmusic'
      const provider = providerManager.get(providerId) || providerManager.default
      const res = await provider.search(query)
      if (seq !== searchRequestSeq) return
      combined = res.songs
    }
    // 最终写入结果前再次校验，确保用户在此期间没有继续输入
    if (seq !== searchRequestSeq) return
    results.value = combined
  } catch (e) {
    console.error('Search error:', e)
    if (seq !== searchRequestSeq) return
    results.value = []
  } finally {
    if (seq === searchRequestSeq) {
      loading.value = false
    }
  }
}

const searchModeTabs = [
  { key: 'all', label: 'All' },
  { key: 'netease', label: 'NE' },
  { key: 'qq', label: 'QQ' },
  { key: 'podcast', label: 'Podcast' },
] as const

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

    <div v-if="fx.layoutMode === 'diy'" class="search-mode-tabs">
      <button
        v-for="tab in searchModeTabs"
        :key="tab.key"
        class="search-mode-tab"
        :class="{ active: searchMode === tab.key }"
        @click="searchMode = tab.key; if (keyword) doSearch()"
      >
        {{ tab.label }}
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
                v-for="(item, index) in searchHistory"
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
  width: min(520px, 58vw);
  max-height: calc(100vh - 180px);
  background: transparent;
  border-radius: 22px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.search-bar {
  display: flex;
  align-items: center;
  height: 58px;
  padding: 0 20px;
  gap: 8px;
  border-radius: 22px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(34px) saturate(1.34);
  -webkit-backdrop-filter: blur(34px) saturate(1.34);
  transition: border-color .28s, background .28s, box-shadow .28s, transform .28s;
  cursor: text;
}

.search-bar:focus-within {
  border-color: rgba(var(--fc-accent-rgb), .50);
  background: var(--glass-bg-focus);
  box-shadow: var(--glass-shadow-focus);
  transform: translateY(-1px);
}

.search-mode-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  width: max-content;
  margin: 8px auto 0;
  padding: 3px;
  border-radius: 999px;
  background: rgba(255,255,255,.045);
  border: 1px solid rgba(var(--fc-accent-rgb),.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.search-mode-tab {
  height: 24px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255,255,255,.42);
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: .7px;
  cursor: pointer;
  transition: background .22s, color .22s, box-shadow .22s, transform .22s;
}

.search-mode-tab:hover {
  color: rgba(255,255,255,.78);
}

.search-mode-tab.active {
  color: #eafffb;
  background: rgba(0,245,212,.11);
  box-shadow: inset 0 0 0 1px rgba(0,245,212,.22), 0 8px 24px rgba(0,245,212,.055);
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  color: #fff;
  font-size: 13.5px;
  font-family: inherit;
  outline: none;
  letter-spacing: 0.3px;
}

.search-input::placeholder {
  color: rgba(255,255,255,0.22);
}

.search-btn {
  padding: 0 16px;
  height: 36px;
  border: none;
  border-radius: 18px;
  background: rgba(var(--fc-accent-rgb),.12);
  color: rgba(var(--fc-accent-rgb),.88);
  cursor: pointer;
  font-size: 14px;
  transition: all .22s;
  flex-shrink: 0;
}

.search-btn:hover {
  background: rgba(var(--fc-accent-rgb),.22);
  color: #fff;
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.search-dropdown {
  margin-top: 8px;
  background: rgba(12,12,18,0.55);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  max-height: 360px;
  overflow-y: auto;
  overscroll-behavior: contain;
  backdrop-filter: blur(40px) saturate(1.4);
  -webkit-backdrop-filter: blur(40px) saturate(1.4);
}

.search-dropdown.show,
.search-dropdown {
  border-color: rgba(var(--fc-accent-rgb),.16);
  box-shadow: 0 18px 54px rgba(0,0,0,.34), 0 0 0 1px rgba(var(--fc-accent-rgb),.05);
}

.dropdown-section {
  padding: 8px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  font-size: 10.5px;
  color: rgba(255,255,255,.42);
  letter-spacing: .8px;
}

.section-title {
  font-weight: 600;
}

.section-action {
  border: 0;
  background: transparent;
  color: rgba(var(--fc-accent-rgb),.68);
  font-family: inherit;
  font-size: 10.5px;
  cursor: pointer;
  padding: 2px 0;
}

.section-action:hover {
  color: #fff;
  text-shadow: 0 0 14px rgba(var(--fc-accent-rgb),.22);
}

.dropdown-divider {
  height: 1px;
  background: rgba(255,255,255,.05);
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
  transition: background .15s;
}

.hot-search-item:hover {
  background: rgba(var(--fc-accent-rgb),.075);
}

.hot-rank {
  width: 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,.3);
  flex-shrink: 0;
}

.rank-top {
  color: #d95b67;
}

.hot-keyword {
  flex: 1;
  font-size: 13px;
  color: rgba(255,255,255,.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hot-value {
  font-size: 11px;
  color: rgba(255,255,255,.3);
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
  background: rgba(255,77,79,.2);
  color: #ff4d4f;
}

.hot-tag.new {
  background: rgba(24,144,255,.2);
  color: #1890ff;
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 0 8px 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.04);
  cursor: pointer;
  transition: all .18s;
}

.history-item:hover {
  background: rgba(var(--fc-accent-rgb),.10);
  border-color: rgba(var(--fc-accent-rgb),.30);
  box-shadow: 0 8px 22px rgba(var(--fc-accent-rgb),.07);
  transform: translateY(-1px);
}

.history-text {
  font-size: 11.5px;
  color: rgba(255,255,255,.66);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item:hover .history-text {
  color: #fff;
}

.history-delete {
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.3);
  font-size: 10px;
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
  background: rgba(255,77,79,.2);
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
  color: rgba(255,255,255,.4);
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.suggest-tab:hover {
  color: rgba(255,255,255,.7);
}

.suggest-tab.active {
  color: var(--fc-accent);
  background: rgba(var(--fc-accent-rgb),.1);
}

.suggest-list {
  padding: 0 8px 8px;
}

.suggest-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 0;
  cursor: pointer;
  transition: background .2s;
  border-bottom: 1px solid rgba(255,255,255,.025);
}

.suggest-item:last-child {
  border-bottom: none;
}

.suggest-item:hover,
.suggest-item.selected {
  background: rgba(var(--fc-accent-rgb),.075);
}

.suggest-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background: rgba(255,255,255,.05);
  border-radius: 6px;
  flex-shrink: 0;
}

.suggest-info {
  flex: 1;
  min-width: 0;
}

.suggest-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggest-artist {
  font-size: 11px;
  font-weight: 300;
  color: rgba(255,255,255,.35);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggest-type {
  font-size: 11px;
  color: rgba(255,255,255,.3);
  padding: 2px 6px;
  background: rgba(255,255,255,.05);
  border-radius: 4px;
  flex-shrink: 0;
}

.empty-suggest {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,.42);
  letter-spacing: .4px;
}

.suggest-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: rgba(255,255,255,.5);
  font-size: 13px;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,.1);
  border-top-color: var(--fc-accent);
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
  margin-top: 8px;
}

.provider-tab {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,.5);
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.provider-tab:hover {
  color: rgba(255,255,255,.8);
}

.provider-tab.active {
  color: var(--provider-color, var(--fc-accent));
  border-bottom-color: var(--provider-color, var(--fc-accent));
}

.search-results {
  flex: 1;
  overflow-y: auto;
  margin-top: 8px;
  background: rgba(12,12,18,0.55);
  border: 1px solid rgba(var(--fc-accent-rgb),.16);
  border-radius: 14px;
  max-height: 360px;
  overscroll-behavior: contain;
  backdrop-filter: blur(40px) saturate(1.4);
  -webkit-backdrop-filter: blur(40px) saturate(1.4);
  box-shadow: 0 18px 54px rgba(0,0,0,.34), 0 0 0 1px rgba(var(--fc-accent-rgb),.05);
}

/* 搜索结果区品牌色滚动条 */
.search-results::-webkit-scrollbar {
  width: 3px;
}

.search-results::-webkit-scrollbar-track {
  background: transparent;
}

.search-results::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,.1);
  border-radius: 2px;
}

.search-results {
  scrollbar-width: thin;
  scrollbar-color: rgba(0,245,212,.22) transparent;
}

.result-header {
  padding: 8px 16px;
  font-size: 12px;
  color: rgba(255,255,255,.4);
  position: sticky;
  top: 0;
  background: rgba(12,12,18,.88);
  backdrop-filter: blur(10px);
  z-index: 1;
}

.result-list {
  padding: 0;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 0;
  cursor: pointer;
  transition: background .2s;
  border-bottom: 1px solid rgba(255,255,255,.025);
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: rgba(var(--fc-accent-rgb),.075);
}

.result-item__index {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,.3);
}

.result-item__cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255,255,255,.05);
}

.result-item__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217,91,103,.3), rgba(100,50,150,.3));
}

.result-item__info {
  flex: 1;
  min-width: 0;
}

.result-item__name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item__artist {
  font-size: 11px;
  font-weight: 300;
  color: rgba(255,255,255,.35);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-item__duration {
  font-size: 11px;
  color: rgba(255,255,255,.3);
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
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 50%;
  background: rgba(255,255,255,.05);
  color: rgba(255,255,255,.55);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .2s;
}

.result-item__add {
  font-size: 16px;
}

.result-item__play:hover {
  background: rgba(0,245,212,.12);
  color: #eafffb;
  border-color: rgba(0,245,212,.34);
}

.result-item__add:hover {
  background: rgba(0,245,212,.12);
  color: #eafffb;
  border-color: rgba(0,245,212,.34);
}

.search-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,.42);
  letter-spacing: .4px;
}

/* --- Responsive (aligned with original) --- */

/* 桌面模式：搜索栏下移至标题栏下方 */
:global(body.desktop-titlebar-active) .search-panel {
  top: 58px;
}

@media (max-width: 720px) {
  .search-panel {
    width: calc(100vw - 28px);
    left: 14px;
    right: 14px;
  }
  .search-results {
    max-height: 50vh;
  }
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
