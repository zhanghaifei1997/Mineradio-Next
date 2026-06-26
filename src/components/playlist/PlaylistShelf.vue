<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { providerManager } from '@/modules/providers'
import type { Playlist } from '@/types'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const queue = playQueueStore()

const playlists = ref<Playlist[]>([])
const loading = ref(false)

async function loadPlaylists() {
  loading.value = true
  try {
    const provider = providerManager.default
    const recs = await provider.getRecommendResources()
    playlists.value = recs
  } catch (e) {
    console.error('Load playlists error:', e)
  } finally {
    loading.value = false
  }
}

async function openPlaylist(playlist: Playlist) {
  const provider = providerManager.get(playlist.source) || providerManager.default
  const detail = await provider.getPlaylist(playlist.id)
  if (detail && detail.tracks.length > 0) {
    queue.setQueue(detail.tracks, 0)
    player.play(detail.tracks[0])
  }
}

onMounted(() => {
  loadPlaylists()
})
</script>

<template>
  <div class="playlist-shelf">
    <div class="shelf-header">
      <h3>推荐歌单</h3>
      <button class="refresh-btn" @click="loadPlaylists" :disabled="loading">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </div>
    <div class="shelf-grid">
      <div
        v-for="pl in playlists"
        :key="pl.id"
        class="playlist-card"
        @click="openPlaylist(pl)"
      >
        <div class="playlist-card__cover">
          <img :src="pl.coverUrl" alt="" v-if="pl.coverUrl" />
          <div class="cover-placeholder" v-else></div>
          <div class="play-count" v-if="pl.playCount">
            ▶ {{ formatPlayCount(pl.playCount) }}
          </div>
        </div>
        <div class="playlist-card__name">{{ pl.name }}</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
function formatPlayCount(count: number): string {
  if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  return String(count)
}
</script>

<style scoped>
.playlist-shelf {
  position: absolute;
  top: 120px;
  left: 24px;
  right: 24px;
  bottom: 120px;
  display: flex;
  flex-direction: column;
}

.shelf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.shelf-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.refresh-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  overflow-y: auto;
  padding-right: 8px;
}

.playlist-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-card:hover {
  transform: translateY(-4px);
}

.playlist-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.playlist-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4));
}

.play-count {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
}

.playlist-card__name {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
