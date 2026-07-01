<template>
  <div id="search-area" :class="{ peek: isVisible }">
    <div id="search-stack">
      <!-- 搜索框 -->
      <div id="search-box" @click="focusInput">
        <svg id="search-icon" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref="searchInputRef"
          id="search-input"
          type="text"
          placeholder="搜索歌曲、歌手..."
          autocomplete="off"
          spellcheck="false"
          :value="search.keywords"
          @input="onInput"
          @focus="onFocus"
          @blur="onBlur"
          @keydown.enter="doSearch"
          @keydown.escape="hideSearch"
        >
      </div>

      <!-- 搜索模式标签 -->
      <div class="search-mode-tabs" role="tablist">
        <button
          v-for="mode in searchModes"
          :key="mode.key"
          :class="{ active: search.searchMode === mode.key }"
          type="button"
          @click="switchMode(mode.key)"
          :aria-selected="search.searchMode === mode.key"
        >{{ mode.label }}</button>
      </div>

      <!-- 搜索结果 -->
      <SearchResults v-if="showResults" @close="showResults = false" @play-song="playSong" />
    </div>

    <!-- 上传按钮 -->
    <div id="upload-actions">
      <button
        id="upload-btn"
        class="icon-btn"
        @click="triggerFileInput"
        title="导入音乐或封面"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSearchStore } from '@/stores/search'
import type { SearchMode, Song } from '@/types'
import SearchResults from './SearchResults.vue'

const search = useSearchStore()
const searchInputRef = ref<HTMLInputElement | null>(null)
const isVisible = ref(false)
const showResults = ref(false)
const isFocused = ref(false)

const emit = defineEmits<{
  playSong: [song: Song]
}>()

const searchModes: Array<{ key: SearchMode; label: string }> = [
  { key: 'song', label: 'All' },
  { key: 'playlist', label: 'NE' },
  { key: 'artist', label: 'QQ' },
  { key: 'podcast', label: 'Podcast' },
]

function focusInput() {
  searchInputRef.value?.focus()
}

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  search.setKeywords(val)
}

function onFocus() {
  isFocused.value = true
  isVisible.value = true
  if (search.keywords.trim() || search.searchHistory.length > 0) {
    showResults.value = true
  }
}

function onBlur() {
  isFocused.value = false
  // 延迟隐藏，允许点击搜索结果
  setTimeout(() => {
    if (!isFocused.value) {
      isVisible.value = false
      showResults.value = false
    }
  }, 250)
}

function hideSearch() {
  isVisible.value = false
  showResults.value = false
  searchInputRef.value?.blur()
}

function switchMode(mode: SearchMode) {
  search.setSearchMode(mode)
  if (search.keywords.trim()) {
    doSearch()
  }
}

async function doSearch() {
  const kw = search.keywords.trim()
  if (!kw) return
  search.addToHistory(kw)
  showResults.value = true
  search.loading = true
  search.clearResults()

  try {
    // 根据搜索模式调用不同的 API
    if (search.searchMode === 'song' || search.searchMode === 'playlist' || search.searchMode === 'artist') {
      const { netease } = await import('@/services/netease')
      const typeMap: Record<string, number> = { song: 1, playlist: 1000, artist: 100 }
      const result = await netease.search({ keywords: kw, type: typeMap[search.searchMode] ?? 1 })
      if (result?.songs) {
        search.songs = result.songs as Song[]
      }
    } else if (search.searchMode === 'podcast') {
      const { netease } = await import('@/services/netease')
      const result = await netease.searchPodcast({ keywords: kw })
      if (result) {
        search.podcasts = (result as unknown as Record<string, unknown>).podcasts as unknown[] ?? []
      }
    }
  } catch (e) {
    console.error('[SearchBar] search failed:', e)
  } finally {
    search.loading = false
  }
}

function triggerFileInput() {
  document.getElementById('file-input')?.click()
}

function playSong(song: Song) {
  emit('playSong', song)
}

// 鼠标悬停到顶部时显示搜索区域
function onMouseMove(e: MouseEvent) {
  if (e.clientY < 80 && !isVisible.value) {
    isVisible.value = true
  }
}

onMounted(() => {
  document.addEventListener('mousemove', onMouseMove)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
})
</script>
