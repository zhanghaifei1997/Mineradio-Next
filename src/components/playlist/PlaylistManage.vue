<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import type { UserPlaylist, Playlist } from '@/types'
import { providerManager } from '@/modules/providers'
import CreatePlaylistModal from './CreatePlaylistModal.vue'
import PlaylistDetail from './PlaylistDetail.vue'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const userStore = useUserStore()
const queue = playQueueStore()
const player = usePlayerStore()

const activeTab = ref<'owned' | 'subscribed' | 'liked'>('owned')
const showCreateModal = ref(false)
const selectedPlaylist = ref<Playlist | null>(null)
const showDetail = ref(false)
const detailLoading = ref(false)
const loading = ref(false)

const tabs = [
  { key: 'owned', label: '创建的歌单' },
  { key: 'subscribed', label: '收藏的歌单' },
  { key: 'liked', label: '我喜欢的音乐' },
] as const

const displayPlaylists = computed(() => {
  switch (activeTab.value) {
    case 'owned':
      return userStore.ownedPlaylists
    case 'subscribed':
      return userStore.subscribedPlaylists
    case 'liked':
      return userStore.favoritePlaylist ? [userStore.favoritePlaylist] : []
    default:
      return []
  }
})

async function loadPlaylists() {
  if (!userStore.isLoggedIn) return
  loading.value = true
  try {
    await userStore.fetchAllUserPlaylists()
    if (userStore.neteaseAccount.loggedIn) {
      await userStore.fetchLikedSongs('netease')
    }
  } catch (e) {
    console.error('Load playlists error:', e)
  } finally {
    loading.value = false
  }
}

async function openPlaylist(pl: UserPlaylist) {
  detailLoading.value = true
  showDetail.value = true
  
  try {
    const provider = providerManager.get(pl.source)
    if (!provider) return
    const detail = await provider.getPlaylist(pl.id)
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

function handlePlaylistCreated() {
  loadPlaylists()
}

function handlePlaylistDeleted() {
  loadPlaylists()
  closeDetail()
}

function handlePlaylistUpdated() {
  loadPlaylists()
}

function playPlaylist(pl: UserPlaylist, event: MouseEvent) {
  event.stopPropagation()
  openPlaylist(pl)
}

function formatPlayCount(count?: number): string {
  if (!count) return ''
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + ' 万'
  }
  return String(count)
}

onMounted(() => {
  if (props.visible) {
    loadPlaylists()
  }
})
</script>

<template>
  <Transition name="slide-right">
    <div v-if="visible" class="playlist-manage">
      <div class="manage-backdrop" @click="emit('close')"></div>
      <div class="manage-panel" @click.stop>
        <div class="manage-header">
          <h2>我的歌单</h2>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="manage-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="manage-actions">
          <button
            v-if="activeTab === 'owned'"
            class="create-btn"
            @click="showCreateModal = true"
          >
            + 新建歌单
          </button>
          <button class="refresh-btn" @click="loadPlaylists" :disabled="loading">
            {{ loading ? '加载中...' : '刷新' }}
          </button>
        </div>

        <div class="playlist-list">
          <div v-if="loading" class="empty-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="displayPlaylists.length === 0" class="empty-state">
            <span class="empty-icon">📭</span>
            <span>暂无歌单</span>
          </div>
          <template v-else>
            <div
              v-for="pl in displayPlaylists"
              :key="pl.id + '-' + pl.source"
              class="playlist-item"
              @click="openPlaylist(pl)"
            >
              <div class="playlist-cover">
                <img v-if="pl.coverUrl" :src="pl.coverUrl" alt="" />
                <div class="cover-placeholder" v-else></div>
                <div class="play-overlay" @click="playPlaylist(pl, $event)">
                  ▶
                </div>
              </div>
              <div class="playlist-info">
                <div class="playlist-name">{{ pl.name }}</div>
                <div class="playlist-meta">
                  <span>{{ pl.trackCount }} 首</span>
                  <span v-if="pl.playCount">· {{ formatPlayCount(pl.playCount) }} 播放</span>
                </div>
              </div>
              <div class="playlist-source">
                <span class="source-tag" :class="pl.source">
                  {{ pl.source === 'netease' ? '网易云' : pl.source === 'qqmusic' ? 'QQ' : '酷狗' }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <CreatePlaylistModal
        :visible="showCreateModal"
        @close="showCreateModal = false"
        @created="handlePlaylistCreated"
      />

      <PlaylistDetail
        :playlist="selectedPlaylist"
        :visible="showDetail"
        @close="closeDetail"
        @playlist-deleted="handlePlaylistDeleted"
        @playlist-updated="handlePlaylistUpdated"
      />
    </div>
  </Transition>
</template>

<style scoped>
.playlist-manage {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
}

.manage-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.manage-panel {
  position: relative;
  width: min(420px, 90vw);
  height: 100%;
  margin-left: auto;
  background: linear-gradient(
    180deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
}

.manage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 20px 16px;
}

.manage-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.manage-tabs {
  display: flex;
  gap: 4px;
  padding: 0 16px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  flex: 1;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
}

.tab-btn.active {
  background: rgba(217, 91, 103, 0.15);
  color: #fff;
}

.manage-actions {
  display: flex;
  gap: 8px;
  padding: 16px 20px;
}

.create-btn {
  flex: 1;
  padding: 10px 16px;
  background: linear-gradient(135deg, #d95b67, #e87882);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 91, 103, 0.3);
}

.refresh-btn {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.playlist-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px 24px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.playlist-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.playlist-cover {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4));
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font-size: 20px;
  opacity: 0;
  transition: opacity 0.2s;
}

.playlist-item:hover .play-overlay {
  opacity: 1;
}

.playlist-info {
  flex: 1;
  min-width: 0;
}

.playlist-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.playlist-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  gap: 6px;
}

.playlist-source {
  flex-shrink: 0;
}

.source-tag {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}

.source-tag.netease {
  background: rgba(217, 91, 103, 0.15);
  color: #e87882;
}

.source-tag.qqmusic {
  background: rgba(0, 245, 212, 0.15);
  color: #00f5d4;
}

.source-tag.kugou {
  background: rgba(44, 162, 249, 0.15);
  color: #2ca2f9;
}

.slide-right-enter-active,
.slide-right-leave-active {
  transition: opacity 0.3s ease;
}

.slide-right-enter-active .manage-panel,
.slide-right-leave-active .manage-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-right-enter-from,
.slide-right-leave-to {
  opacity: 0;
}

.slide-right-enter-from .manage-panel,
.slide-right-leave-to .manage-panel {
  transform: translateX(100%);
}
</style>
