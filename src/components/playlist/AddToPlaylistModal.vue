<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import type { Song, UserPlaylist } from '@/types'
import CreatePlaylistModal from './CreatePlaylistModal.vue'

const props = defineProps<{
  visible: boolean
  song?: Song | null
  songs?: Song[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'added'): void
}>()

const userStore = useUserStore()

const loading = ref(false)
const showCreateModal = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const songList = computed(() => {
  if (props.songs && props.songs.length > 0) return props.songs
  if (props.song) return [props.song]
  return []
})

const availablePlaylists = computed(() => {
  return userStore.ownedPlaylists.filter(p => !p.isFavorite)
})

async function handleAddToPlaylist(playlist: UserPlaylist) {
  if (songList.value.length === 0 || loading.value) return
  
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    const songIds = songList.value.map(s => s.id)
    const result = await userStore.addToPlaylist(playlist.source, playlist.id, songIds)
    if (result) {
      successMessage.value = `已添加到「${playlist.name}」`
      setTimeout(() => {
        emit('added')
        emit('close')
      }, 800)
    } else {
      errorMessage.value = '添加失败，请重试'
    }
  } catch (e) {
    errorMessage.value = '添加失败，请重试'
  } finally {
    loading.value = false
  }
}

function handlePlaylistCreated() {
  showCreateModal.value = false
}

function handleClose() {
  successMessage.value = ''
  errorMessage.value = ''
  emit('close')
}

watch(() => props.visible, (val) => {
  if (val && userStore.isLoggedIn) {
    userStore.fetchAllUserPlaylists()
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="add-to-playlist-modal">
      <div class="modal-backdrop" @click="handleClose"></div>
      <div class="modal-panel" @click.stop>
        <div class="modal-header">
          <h3>添加到歌单</h3>
          <button class="modal-close" @click="handleClose">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="songList.length > 1" class="song-count">
            已选择 {{ songList.length }} 首歌曲
          </div>

          <div class="create-row">
            <button class="create-btn" @click="showCreateModal = true">
              <span class="create-icon">+</span>
              新建歌单
            </button>
          </div>

          <div class="playlist-list">
            <div v-if="availablePlaylists.length === 0" class="empty-state">
              暂无歌单，点击上方创建
            </div>
            <div
              v-for="pl in availablePlaylists"
              :key="pl.id + '-' + pl.source"
              class="playlist-item"
              @click="handleAddToPlaylist(pl)"
            >
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
                  {{ pl.source === 'netease' ? '网易云' : pl.source === 'qqmusic' ? 'QQ' : '酷狗' }}
                </span>
              </div>
            </div>
          </div>

          <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
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
.add-to-playlist-modal {
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
  backdrop-filter: var(--blur-modal);
  -webkit-backdrop-filter: var(--blur-modal);
}

.modal-panel {
  position: relative;
  width: min(400px, 92vw);
  max-height: 70vh;
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

.song-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 12px;
}

.create-row {
  margin-bottom: 16px;
}

.create-btn {
  width: 100%;
  padding: 12px 16px;
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
  font-size: 16px;
  font-weight: 600;
}

.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.playlist-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.playlist-cover {
  width: 48px;
  height: 48px;
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

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4));
}

.playlist-info {
  flex: 1;
  min-width: 0;
}

.playlist-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.playlist-count {
  font-size: 12px;
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
