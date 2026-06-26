<script setup lang="ts">
import { ref } from 'vue'
import { providerManager } from '@/modules/providers'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import type { Song } from '@/types'

const player = usePlayerStore()
const queue = playQueueStore()

const keyword = ref('')
const results = ref<Song[]>([])
const loading = ref(false)
const activeProvider = ref('netease')

async function doSearch() {
  if (!keyword.value.trim()) {
    results.value = []
    return
  }
  loading.value = true
  try {
    const provider = providerManager.get(activeProvider.value) || providerManager.default
    const res = await provider.search(keyword.value)
    results.value = res.songs
  } catch (e) {
    console.error('Search error:', e)
  } finally {
    loading.value = false
  }
}

function playSong(song: Song, index: number) {
  if (index === 0) {
    queue.setQueue(results.value, 0)
  }
  player.play(song)
}

const providers = providerManager.getAll()
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
      />
      <button class="search-btn" @click="doSearch" :disabled="loading">
        {{ loading ? '...' : '🔍' }}
      </button>
    </div>

    <div class="provider-tabs">
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
          <button class="result-item__play" @click.stop="playSong(song, idx)">
            ▶
          </button>
        </div>
      </div>
    </div>

    <div class="search-empty" v-else-if="!loading && keyword">
      没有找到相关结果
    </div>
  </div>
</template>

<script lang="ts">
function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const ss = s % 60
  return `${m}:${ss.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.search-panel {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  max-height: 80vh;
  background: rgba(15, 15, 20, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
}

.result-item__play {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(217, 91, 103, 0.8);
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-item:hover .result-item__play {
  opacity: 1;
}

.result-item__play:hover {
  background: rgba(217, 91, 103, 1);
}

.search-empty {
  padding: 60px 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}
</style>
