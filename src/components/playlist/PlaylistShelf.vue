<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { providerManager } from '@/modules/providers'
import type { Playlist } from '@/types'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import PlaylistShelf3D from './PlaylistShelf3D.vue'
import PlaylistDetail from './PlaylistDetail.vue'
import { formatPlayCount } from '@/utils'

const player = usePlayerStore()
const queue = playQueueStore()
const user = useUserStore()

const playlists = ref<Playlist[]>([])
const loading = ref(false)
const viewMode = ref<'2d' | '3d'>('3d')
const selectedPlaylist = ref<Playlist | null>(null)
const showDetail = ref(false)
const detailLoading = ref(false)
const shelfMode = ref<'recommend' | 'user'>('recommend')

const headerTitle = computed(() => {
  if (shelfMode.value === 'user') {
    return '我的歌单'
  }
  return '推荐歌单'
})

const canShowUserPlaylists = computed(() => user.isLoggedIn && user.userPlaylists.length > 0)

async function loadRecommendPlaylists() {
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

async function loadUserPlaylists() {
  if (!user.isLoggedIn) {
    shelfMode.value = 'recommend'
    await loadRecommendPlaylists()
    return
  }

  loading.value = true
  try {
    if (user.userPlaylists.length === 0) {
      await user.fetchAllUserPlaylists()
    }

    if (user.userPlaylists.length > 0) {
      const userPls: Playlist[] = user.userPlaylists.map(up => ({
        id: up.id,
        name: up.name,
        coverUrl: up.coverUrl,
        description: '',
        tracks: [],
        trackCount: up.trackCount,
        playCount: up.playCount,
        creator: undefined,
        source: up.source,
      }))
      playlists.value = userPls
    } else {
      shelfMode.value = 'recommend'
      await loadRecommendPlaylists()
    }
  } catch (e) {
    console.error('Load user playlists error:', e)
    shelfMode.value = 'recommend'
    await loadRecommendPlaylists()
  } finally {
    loading.value = false
  }
}

async function loadPlaylists() {
  if (shelfMode.value === 'user' && user.isLoggedIn) {
    await loadUserPlaylists()
  } else {
    await loadRecommendPlaylists()
  }
}

function toggleShelfMode() {
  if (shelfMode.value === 'recommend' && canShowUserPlaylists.value) {
    shelfMode.value = 'user'
    loadUserPlaylists()
  } else {
    shelfMode.value = 'recommend'
    loadRecommendPlaylists()
  }
}

async function openPlaylist(playlist: Playlist) {
  detailLoading.value = true
  showDetail.value = true
  selectedPlaylist.value = playlist

  try {
    const provider = providerManager.get(playlist.source) || providerManager.default
    const detail = await provider.getPlaylist(playlist.id)
    if (detail) {
      selectedPlaylist.value = detail
    }
  } catch (e) {
    console.error('Load playlist detail error:', e)
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  showDetail.value = false
  setTimeout(() => {
    selectedPlaylist.value = null
  }, 300)
}

function toggleViewMode() {
  viewMode.value = viewMode.value === '2d' ? '3d' : '2d'
}

watch(
  () => user.isLoggedIn,
  (loggedIn) => {
    if (loggedIn && user.userPlaylists.length > 0) {
      shelfMode.value = 'user'
      loadUserPlaylists()
    } else if (!loggedIn && shelfMode.value === 'user') {
      shelfMode.value = 'recommend'
      loadRecommendPlaylists()
    }
  }
)

onMounted(() => {
  if (user.isLoggedIn && user.userPlaylists.length > 0) {
    shelfMode.value = 'user'
    loadUserPlaylists()
  } else {
    loadRecommendPlaylists()
  }
})
</script>

<template>
  <div class="playlist-shelf" :class="{ 'mode-3d': viewMode === '3d' }">
    <div class="shelf-header">
      <h3>{{ headerTitle }}</h3>
      <div class="header-actions">
        <button
          v-if="canShowUserPlaylists"
          class="mode-toggle"
          @click="toggleShelfMode"
          :title="shelfMode === 'user' ? '切换到推荐歌单' : '切换到我的歌单'"
        >
          <span v-if="shelfMode === 'user'">👤 我的</span>
          <span v-else>✨ 推荐</span>
        </button>
        <button class="view-toggle" @click="toggleViewMode" :title="viewMode === '3d' ? '切换到 2D 视图' : '切换到 3D 视图'">
          <svg v-if="viewMode === '3d'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span>{{ viewMode === '3d' ? '3D' : '2D' }}</span>
        </button>
        <button class="refresh-btn" @click="loadPlaylists" :disabled="loading">
          {{ loading ? '加载中...' : '刷新' }}
        </button>
      </div>
    </div>

    <Transition name="mode-fade" mode="out-in">
      <div v-if="viewMode === '2d'" key="2d" class="shelf-2d">
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

      <div v-else key="3d" class="shelf-3d">
        <PlaylistShelf3D
          :playlists="playlists"
          @playlist-click="openPlaylist"
        />
      </div>
    </Transition>

    <PlaylistDetail
      :playlist="selectedPlaylist"
      :visible="showDetail"
      @close="closeDetail"
    />
  </div>
</template>

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

.playlist-shelf.mode-3d {
  top: 80px;
  left: 0;
  right: 0;
  bottom: 80px;
}

.shelf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 8px;
  position: relative;
  z-index: 10;
}

.mode-3d .shelf-header {
  position: absolute;
  top: 0;
  left: 24px;
  right: 24px;
}

.shelf-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(244, 210, 138, 0.3);
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(0, 245, 212, 0.3);
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

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shelf-2d {
  flex: 1;
  overflow: hidden;
}

.shelf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
  overflow-y: auto;
  padding-right: 8px;
  height: 100%;
  align-content: start;
}

/* 迷你队列 / 歌单架滚动条 */
.mini-queue-list::-webkit-scrollbar,
.shelf-grid::-webkit-scrollbar {
  width: 3px;
}

.mini-queue-list::-webkit-scrollbar-track,
.shelf-grid::-webkit-scrollbar-track {
  background: transparent;
}

.mini-queue-list::-webkit-scrollbar-thumb,
.shelf-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
}

.mini-queue-list::-webkit-scrollbar-thumb:hover,
.shelf-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.34);
}

.shelf-grid {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.shelf-3d {
  position: absolute;
  inset: 0;
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

.mode-fade-enter-active,
.mode-fade-leave-active {
  transition: opacity 0.3s ease;
}

.mode-fade-enter-from,
.mode-fade-leave-to {
  opacity: 0;
}
</style>
