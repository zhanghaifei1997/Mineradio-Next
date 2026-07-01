<template>
  <div
    id="search-results"
    :class="{ show: true }"
    @mousedown.prevent
  >
    <!-- 加载状态 -->
    <div v-if="search.loading" class="search-empty">搜索中...</div>

    <!-- 搜索历史（无关键词时显示） -->
    <div v-else-if="!search.keywords.trim() && search.searchHistory.length > 0" class="search-history">
      <div class="search-history-head">
        <span>HISTORY</span>
        <button class="search-history-clear" @click="clearHistory">清除</button>
      </div>
      <div class="search-history-list">
        <button
          v-for="item in search.searchHistory"
          :key="item"
          class="search-history-chip"
          @click="searchFromHistory(item)"
        >{{ item }}</button>
      </div>
    </div>

    <!-- 歌曲结果 -->
    <template v-else-if="search.songs.length > 0">
      <div
        v-for="song in search.songs"
        :key="`${song.source}-${song.id}`"
        class="search-result"
        :class="[song.source === 'qq' ? 'qq-source' : 'netease-source']"
        @click="$emit('playSong', song)"
      >
        <img :src="song.cover || ''" :alt="song.name" loading="lazy">
        <div class="search-result-info">
          <div class="search-result-title">
            <span>{{ song.name }}</span>
            <span v-if="song.fee === 1" class="tag-vip">VIP</span>
            <span v-if="song.source" class="tag-source" :class="song.source">{{ song.source === 'qq' ? 'QQ' : 'NE' }}</span>
          </div>
          <div class="search-result-meta">
            <button class="search-artist-link" @click.stop>{{ song.artist }}</button>
            · {{ song.album || '未知专辑' }}
          </div>
        </div>
        <button class="add-btn" @click.stop title="添加到队列">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </div>
    </template>

    <!-- 播客结果 -->
    <template v-else-if="search.podcasts.length > 0">
      <div
        v-for="(podcast, idx) in search.podcasts"
        :key="idx"
        class="search-result"
      >
        <img :src="(podcast as Record<string, unknown>).cover as string || ''" :alt="(podcast as Record<string, unknown>).name as string || ''" loading="lazy">
        <div class="search-result-info">
          <div class="search-result-title">
            <span>{{ (podcast as Record<string, unknown>).name }}</span>
          </div>
          <div class="search-result-meta">{{ (podcast as Record<string, unknown>).desc || '' }}</div>
        </div>
      </div>
    </template>

    <!-- 空结果 -->
    <div v-else-if="search.keywords.trim()" class="search-empty">
      未找到相关结果
    </div>

    <!-- 默认提示 -->
    <div v-else class="search-empty">
      输入关键词开始搜索
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSearchStore } from '@/stores/search'

const search = useSearchStore()

defineEmits<{
  close: []
  playSong: [song: import('@/types').Song]
}>()

function clearHistory() {
  search.searchHistory = []
}

function searchFromHistory(kw: string) {
  search.setKeywords(kw)
  // 触发搜索（父组件监听 input 变化）
}
</script>
