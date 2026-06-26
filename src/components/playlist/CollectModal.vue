<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import type { Song, UserPlaylist, MusicSource } from '@/types'
import CreatePlaylistModal from './CreatePlaylistModal.vue'

const props = defineProps<{
  visible: boolean
  song?: Song | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'changed'): void
}>()

const userStore = useUserStore()

const loading = ref(false)
const checkingStatus = ref(false)
const showCreateModal = ref(false)
const searchKeyword = ref('')
const successMessage = ref('')
const errorMessage = ref('')

const checkedPlaylists = ref<Set<string>>(new Set())
const pendingAdd = ref<Set<string>>(new Set())
const pendingRemove = ref<Set<string>>(new Set())

const localPlaylists = ref<UserPlaylist[]>([])
const LOCAL_PLAYLISTS_KEY = 'mineradio-local-playlists'
const LOCAL_FAVORITES_KEY = 'mineradio-local-favorites'

function loadLocalPlaylists() {
  try {
    const raw = localStorage.getItem(LOCAL_PLAYLISTS_KEY)
    if (raw) {
      localPlaylists.value = JSON.parse(raw)
    }
  } catch (_) {}
}

function saveLocalPlaylists() {
  try {
    localStorage.setItem(LOCAL_PLAYLISTS_KEY, JSON.stringify(localPlaylists.value))
  } catch (_) {}
}

function getLocalFavorites(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_FAVORITES_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

function saveLocalFavorites(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(ids))
  } catch (_) {}
}

function getLocalPlaylistSongIds(playlistId: string): string[] {
  try {
    const raw = localStorage.getItem(`mineradio-local-pl-${playlistId}`)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

function saveLocalPlaylistSongIds(playlistId: string, songIds: string[]) {
  try {
    localStorage.setItem(`mineradio-local-pl-${playlistId}`, JSON.stringify(songIds))
  } catch (_) {}
}

const isLocalSong = computed(() => props.song?.source === 'local')

const allPlaylists = computed(() => {
  if (isLocalSong.value) {
    return localPlaylists.value
  }
  return userStore.ownedPlaylists
})

const filteredPlaylists = computed(() => {
  if (!searchKeyword.value.trim()) return allPlaylists.value
  const kw = searchKeyword.value.toLowerCase()
  return allPlaylists.value.filter(p => p.name.toLowerCase().includes(kw))
})

const hasChanges = computed(() => pendingAdd.value.size > 0 || pendingRemove.value.size > 0)

function getPlaylistKey(pl: UserPlaylist): string {
  return `${pl.source}-${pl.id}`
}

function isPlaylistChecked(pl: UserPlaylist): boolean {
  const key = getPlaylistKey(pl)
  if (pendingAdd.value.has(key)) return true
  if (pendingRemove.value.has(key)) return false
  return checkedPlaylists.value.has(key)
}

async function checkSongInPlaylists() {
  if (!props.song) return
  checkingStatus.value = true
  checkedPlaylists.value.clear()
  pendingAdd.value.clear()
  pendingRemove.value.clear()

  try {
    if (isLocalSong.value) {
      for (const pl of localPlaylists.value) {
        const songIds = getLocalPlaylistSongIds(pl.id)
        if (songIds.includes(props.song.id)) {
          checkedPlaylists.value.add(getPlaylistKey(pl))
        }
      }
    } else {
      if (userStore.isSongLikedSync(props.song.source as MusicSource, props.song.id)) {
        const favPl = userStore.favoritePlaylist
        if (favPl) {
          checkedPlaylists.value.add(getPlaylistKey(favPl))
        }
      }
    }
  } catch (_) {
  } finally {
    checkingStatus.value = false
  }
}

function togglePlaylist(pl: UserPlaylist) {
  const key = getPlaylistKey(pl)
  const currentlyChecked = isPlaylistChecked(pl)

  if (currentlyChecked) {
    if (checkedPlaylists.value.has(key)) {
      pendingRemove.value.add(key)
    } else {
      pendingAdd.value.delete(key)
    }
  } else {
    if (checkedPlaylists.value.has(key)) {
      pendingRemove.value.delete(key)
    } else {
      pendingAdd.value.add(key)
    }
  }
}

async function handleConfirm() {
  if (!props.song || loading.value) return
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const songId = props.song.id
    const source = props.song.source as MusicSource

    if (isLocalSong.value) {
      for (const key of pendingAdd.value) {
        const plId = key.split('-').slice(1).join('-')
        const songIds = getLocalPlaylistSongIds(plId)
        if (!songIds.includes(songId)) {
          songIds.push(songId)
          saveLocalPlaylistSongIds(plId, songIds)
        }
      }
      for (const key of pendingRemove.value) {
        const plId = key.split('-').slice(1).join('-')
        const songIds = getLocalPlaylistSongIds(plId)
        const idx = songIds.indexOf(songId)
        if (idx >= 0) {
          songIds.splice(idx, 1)
          saveLocalPlaylistSongIds(plId, songIds)
        }
      }
    } else {
      const addIds: string[] = []
      const removeIds: string[] = []

      for (const key of pendingAdd.value) {
        const parts = key.split('-')
        const plSource = parts[0] as MusicSource
        const plId = parts.slice(1).join('-')
        if (plSource === source) {
          addIds.push(plId)
        }
      }
      for (const key of pendingRemove.value) {
        const parts = key.split('-')
        const plSource = parts[0] as MusicSource
        const plId = parts.slice(1).join('-')
        if (plSource === source) {
          removeIds.push(plId)
        }
      }

      for (const plId of addIds) {
        await userStore.addToPlaylist(source, plId, [songId])
      }
      for (const plId of removeIds) {
        await userStore.removeFromPlaylist(source, plId, [songId])
      }
    }

    successMessage.value = '操作成功'
    await checkSongInPlaylists()
    emit('changed')

    setTimeout(() => {
      emit('close')
    }, 600)
  } catch (e) {
    errorMessage.value = '操作失败，请重试'
  } finally {
    loading.value = false
  }
}

function handleCreateLocalPlaylist(name: string) {
  const id = `local-${Date.now()}`
  const newPl: UserPlaylist = {
    id,
    name,
    trackCount: 0,
    source: 'local',
    isFavorite: false,
    isOwned: true,
  }
  localPlaylists.value.unshift(newPl)
  saveLocalPlaylists()
}

function handlePlaylistCreated(playlist: any) {
  showCreateModal.value = false
  if (playlist && isLocalSong.value) {
    loadLocalPlaylists()
  }
  nextTick(() => {
    userStore.fetchAllUserPlaylists()
  })
}

function handleClose() {
  successMessage.value = ''
  errorMessage.value = ''
  searchKeyword.value = ''
  emit('close')
}

watch(() => props.visible, (val) => {
  if (val) {
    loadLocalPlaylists()
    if (props.song) {
      checkSongInPlaylists()
    }
    if (!isLocalSong.value && userStore.isLoggedIn) {
      userStore.fetchAllUserPlaylists()
    }
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="collect-modal">
      <div class="modal-backdrop" @click="handleClose"></div>
      <div class="modal-panel" @click.stop>
        <div class="modal-header">
          <h3>收藏到歌单</h3>
          <button class="modal-close" @click="handleClose">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="song" class="song-info-bar">
            <div class="song-cover">
              <img v-if="song.coverUrl" :src="song.coverUrl" alt="" />
              <div class="cover-placeholder" v-else></div>
            </div>
            <div class="song-meta">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-artist">{{ song.artists.map(a => a.name).join(' / ') }}</div>
            </div>
          </div>

          <div class="search-row">
            <input
              v-model="searchKeyword"
              type="text"
              class="search-input"
              placeholder="搜索歌单..."
            />
          </div>

          <div class="create-row">
            <button class="create-btn" @click="showCreateModal = true">
              <span class="create-icon">+</span>
              新建歌单
            </button>
          </div>

          <div class="playlist-list">
            <div v-if="checkingStatus" class="loading-state">
              <div class="loading-spinner"></div>
              <span>加载中...</span>
            </div>
            <div v-else-if="filteredPlaylists.length === 0" class="empty-state">
              暂无歌单，点击上方创建
            </div>
            <div
              v-for="pl in filteredPlaylists"
              :key="getPlaylistKey(pl)"
              class="playlist-item"
              :class="{ 'playlist-item--checked': isPlaylistChecked(pl) }"
              @click="togglePlaylist(pl)"
            >
              <div class="checkbox-wrap">
                <div class="checkbox" :class="{ 'checkbox--checked': isPlaylistChecked(pl) }">
                  <span v-if="isPlaylistChecked(pl)" class="check-icon">✓</span>
                </div>
              </div>
              <div class="playlist-cover">
                <img v-if="pl.coverUrl" :src="pl.coverUrl" alt="" />
                <div class="cover-placeholder" v-else></div>
              </div>
              <div class="playlist-info">
                <div class="playlist-name">{{ pl.name }}</div>
                <div class="playlist-count">{{ pl.trackCount }} 首歌曲</div>
              </div>
              <div class="playlist-source">
                <span class="source-tag" :class="pl.source">
                  {{ pl.source === 'netease' ? '网易云' : pl.source === 'qqmusic' ? 'QQ' : pl.source === 'kugou' ? '酷狗' : '本地' }}
                </span>
              </div>
            </div>
          </div>

          <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn--secondary" @click="handleClose">取消</button>
          <button class="btn btn--primary" :disabled="!hasChanges || loading" @click="handleConfirm">
            {{ loading ? '处理中...' : '完成' }}
          </button>
        </div>
      </div>

      <CreatePlaylistModal
        :visible="showCreateModal"
        @close="showCreateModal = false"
        @created="handlePlaylistCreated"
      />
    </div>
  </Transition>
</template>

<style scoped>
.collect-modal {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.modal-panel {
  position: relative;
  width: min(420px, 92vw);
  max-height: 75vh;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.modal-close {
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.song-info-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  margin-bottom: 14px;
}

.song-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4));
}

.song-meta {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-row {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: rgba(217, 91, 103, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.create-row {
  margin-bottom: 14px;
}

.create-btn {
  width: 100%;
  padding: 11px 16px;
  background: rgba(217, 91, 103, 0.1);
  border: 1px dashed rgba(217, 91, 103, 0.4);
  border-radius: 10px;
  color: #e87882;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.create-btn:hover {
  background: rgba(217, 91, 103, 0.15);
  border-color: rgba(217, 91, 103, 0.6);
}

.create-icon {
  font-size: 15px;
  font-weight: 600;
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 340px;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.playlist-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.playlist-item--checked {
  background: rgba(217, 91, 103, 0.08);
}

.checkbox-wrap {
  flex-shrink: 0;
}

.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  background: transparent;
}

.checkbox--checked {
  background: linear-gradient(135deg, #d95b67, #e87882);
  border-color: transparent;
}

.check-icon {
  color: #fff;
  font-size: 12px;
  font-weight: bold;
  line-height: 1;
}

.playlist-cover {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-info {
  flex: 1;
  min-width: 0;
}

.playlist-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
}

.playlist-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.playlist-source {
  flex-shrink: 0;
}

.source-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
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

.source-tag.local {
  background: rgba(100, 200, 100, 0.15);
  color: #6ee76e;
}

.success-message {
  margin: 12px 0 0;
  font-size: 13px;
  color: #4ade80;
  text-align: center;
}

.error-message {
  margin: 12px 0 0;
  font-size: 13px;
  color: #ff6b6b;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.btn {
  flex: 1;
  padding: 11px 20px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  border: none;
}

.btn--secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.btn--secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.btn--primary {
  background: linear-gradient(135deg, #d95b67, #e87882);
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-active .modal-panel,
.fade-leave-active .modal-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .modal-panel,
.fade-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
