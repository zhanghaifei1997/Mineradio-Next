<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Playlist, Song } from '@/types'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { providerManager } from '@/modules/providers'

const props = defineProps<{
  playlist: Playlist | null
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'playlist-deleted'): void
  (e: 'playlist-updated'): void
}>()

const queue = playQueueStore()
const player = usePlayerStore()
const userStore = useUserStore()

const loading = ref(false)
const actionLoading = ref(false)
const showMoreMenu = ref(false)
const showDeleteConfirm = ref(false)
const showEditModal = ref(false)

const renderLimit = ref(50)
const batchSize = ref(50)
const showBackToTop = ref(false)
const songListRef = ref<HTMLDivElement | null>(null)

const displayedTracks = computed(() => {
  if (!props.playlist) return []
  return props.playlist.tracks.slice(0, renderLimit.value)
})

const hasMore = computed(() => {
  if (!props.playlist) return false
  return renderLimit.value < props.playlist.tracks.length
})

function loadMore() {
  if (!props.playlist) return
  renderLimit.value = Math.min(
    renderLimit.value + batchSize.value,
    props.playlist.tracks.length
  )
}

function scrollToTop() {
  if (songListRef.value) {
    songListRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function handleSongListScroll() {
  if (!songListRef.value) return
  showBackToTop.value = songListRef.value.scrollTop > 300
}

watch(() => props.playlist, (pl) => {
  if (pl) {
    renderLimit.value = batchSize.value
    showBackToTop.value = false
    checkSubscriptionStatus()
    loadLikeStatuses()
  }
}, { immediate: true })

const editName = ref('')
const editDesc = ref('')
const editPrivacy = ref<'public' | 'private'>('private')

const isSubscribed = ref(false)
const isOwned = ref(false)

const likedMap = ref<Map<string, boolean>>(new Map())

watch(() => props.playlist, (pl) => {
  if (pl) {
    checkSubscriptionStatus()
    loadLikeStatuses()
  }
}, { immediate: true })

async function checkSubscriptionStatus() {
  if (!props.playlist) return
  const source = props.playlist.source
  const account = userStore.getAccount(source as any)
  if (!account.loggedIn || !account.profile) {
    isSubscribed.value = false
    isOwned.value = false
    return
  }
  const localPl = userStore.userPlaylists.find(p => p.id === props.playlist!.id && p.source === props.playlist!.source)
  if (localPl) {
    isSubscribed.value = true
    isOwned.value = !!localPl.isOwned
  } else {
    isSubscribed.value = false
    isOwned.value = props.playlist.creator?.id === account.profile.id
  }
}

async function loadLikeStatuses() {
  if (!props.playlist || props.playlist.tracks.length === 0) return
  const source = props.playlist.source
  const account = userStore.getAccount(source as any)
  if (!account.loggedIn) return
  
  const newMap = new Map<string, boolean>()
  for (const song of props.playlist.tracks) {
    const liked = userStore.isSongLikedSync(song.source, song.id)
    newMap.set(song.id, liked)
  }
  likedMap.value = newMap
}

function handlePlaySong(song: Song, index: number) {
  if (props.playlist) {
    queue.setQueue(props.playlist.tracks, index)
    player.play(song)
  }
}

function handlePlayAll() {
  if (props.playlist && props.playlist.tracks.length > 0) {
    queue.setQueue(props.playlist.tracks, 0)
    player.play(props.playlist.tracks[0])
  }
}

function handleAddToQueue() {
  if (props.playlist) {
    props.playlist.tracks.forEach((song) => {
      queue.addToQueue(song)
    })
  }
}

async function handleToggleSubscribe() {
  if (!props.playlist || actionLoading.value) return
  actionLoading.value = true
  try {
    const source = props.playlist.source as any
    if (isSubscribed.value) {
      const result = await userStore.unsubscribePlaylist(source, props.playlist.id)
      if (result) {
        isSubscribed.value = false
      }
    } else {
      const result = await userStore.subscribePlaylist(source, props.playlist.id)
      if (result) {
        isSubscribed.value = true
      }
    }
  } catch (e) {
    console.error('Toggle subscribe error:', e)
  } finally {
    actionLoading.value = false
  }
}

async function handleToggleLike(song: Song, event: MouseEvent) {
  event.stopPropagation()
  const source = song.source as any
  const account = userStore.getAccount(source)
  if (!account.loggedIn) return
  
  const currentLiked = likedMap.value.get(song.id) || false
  likedMap.value.set(song.id, !currentLiked)
  
  try {
    const result = await userStore.likeSong(source, song.id, !currentLiked, song)
    if (!result) {
      likedMap.value.set(song.id, currentLiked)
    }
  } catch (e) {
    likedMap.value.set(song.id, currentLiked)
  }
}

function handleEdit() {
  if (!props.playlist) return
  editName.value = props.playlist.name
  editDesc.value = props.playlist.description || ''
  showEditModal.value = true
  showMoreMenu.value = false
}

async function handleSaveEdit() {
  if (!props.playlist || actionLoading.value) return
  actionLoading.value = true
  try {
    const source = props.playlist.source as any
    const result = await userStore.updatePlaylist(source, props.playlist.id, {
      name: editName.value,
      description: editDesc.value,
      privacy: editPrivacy.value,
    })
    if (result) {
      if (props.playlist) {
        props.playlist.name = editName.value
        props.playlist.description = editDesc.value
      }
      emit('playlist-updated')
      showEditModal.value = false
    }
  } catch (e) {
    console.error('Edit playlist error:', e)
  } finally {
    actionLoading.value = false
  }
}

function handleDelete() {
  showDeleteConfirm.value = true
  showMoreMenu.value = false
}

async function handleConfirmDelete() {
  if (!props.playlist || actionLoading.value) return
  actionLoading.value = true
  try {
    const source = props.playlist.source as any
    const result = await userStore.deletePlaylist(source, props.playlist.id)
    if (result) {
      emit('playlist-deleted')
      showDeleteConfirm.value = false
      emit('close')
    }
  } catch (e) {
    console.error('Delete playlist error:', e)
  } finally {
    actionLoading.value = false
  }
}

function getArtistsText(song: Song): string {
  return song.artists.map((a) => a.name).join(' / ')
}

const coverGradient = computed(() => {
  if (!props.playlist?.coverUrl) {
    return 'linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4))'
  }
  return 'none'
})

const canManage = computed(() => {
  if (!props.playlist) return false
  const source = props.playlist.source
  const account = userStore.getAccount(source as any)
  return account.loggedIn && isOwned.value
})
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && playlist" class="playlist-detail">
      <div class="detail-backdrop" @click="emit('close')"></div>
      <div class="detail-panel" @click.stop>
        <button class="detail-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div class="detail-header">
          <div class="detail-cover" :style="{ background: coverGradient }">
            <img v-if="playlist.coverUrl" :src="playlist.coverUrl" alt="" />
          </div>
          <div class="detail-info">
            <h2 class="detail-title">{{ playlist.name }}</h2>
            <div class="detail-meta">
              <span v-if="playlist.trackCount">{{ playlist.trackCount }} 首歌曲</span>
              <span v-if="playlist.playCount" class="play-count">
                ▶ {{ Math.floor(playlist.playCount / 10000) }} 万
              </span>
              <span v-if="playlist.creator" class="creator">
                by {{ playlist.creator.nickname }}
              </span>
            </div>
            <p v-if="playlist.description" class="detail-desc">{{ playlist.description }}</p>
            <div class="detail-actions">
              <button class="action-btn action-btn--primary" @click="handlePlayAll">
                ▶ 播放全部
              </button>
              <button class="action-btn" @click="handleAddToQueue">
                + 加入队列
              </button>
              <button
                v-if="userStore.isLoggedIn && !isOwned"
                class="action-btn action-btn--icon"
                :class="{ 'action-btn--liked': isSubscribed }"
                @click="handleToggleSubscribe"
                :disabled="actionLoading"
                :title="isSubscribed ? '取消收藏' : '收藏歌单'"
              >
                {{ isSubscribed ? '★ 已收藏' : '☆ 收藏' }}
              </button>
              <div v-if="canManage" class="more-actions">
                <button class="action-btn action-btn--icon" @click="showMoreMenu = !showMoreMenu">
                  ⋯
                </button>
                <Transition name="menu-fade">
                  <div v-if="showMoreMenu" class="more-menu" @click.stop>
                    <button class="menu-item" @click="handleEdit">
                      ✏️ 编辑歌单
                    </button>
                    <button class="menu-item menu-item--danger" @click="handleDelete">
                      🗑️ 删除歌单
                    </button>
                  </div>
                </Transition>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-divider"></div>

        <div class="song-list" ref="songListRef" @scroll="handleSongListScroll">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>
          <template v-else>
            <div
              v-for="(song, index) in displayedTracks"
              :key="song.id + '-' + index"
              class="song-item"
              @click="handlePlaySong(song, index)"
            >
              <div class="song-index">{{ index + 1 }}</div>
              <div class="song-cover">
                <img v-if="song.coverUrl" :src="song.coverUrl" alt="" />
              </div>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ getArtistsText(song) }}</div>
              </div>
              <button
                v-if="userStore.isLoggedIn"
                class="like-btn"
                :class="{ 'like-btn--liked': likedMap.get(song.id) }"
                @click="handleToggleLike(song, $event)"
                :title="likedMap.get(song.id) ? '取消喜欢' : '喜欢'"
              >
                {{ likedMap.get(song.id) ? '❤️' : '🤍' }}
              </button>
              <div class="song-duration">{{ formatTime(song.duration) }}</div>
            </div>

            <div v-if="hasMore" class="load-more-container">
              <button class="load-more-btn" @click="loadMore">
                加载更多 {{ Math.min(renderLimit + batchSize, playlist!.tracks.length) }} / {{ playlist!.tracks.length }}
              </button>
            </div>
            <div v-else-if="playlist && playlist.tracks.length > batchSize" class="load-more-container">
              <div class="all-loaded-text">已加载全部 {{ playlist.tracks.length }} 首</div>
            </div>
          </template>

          <Transition name="fade">
            <button
              v-if="showBackToTop"
              class="back-to-top-btn"
              @click="scrollToTop"
              title="回到顶部"
            >
              ↑
            </button>
          </Transition>
        </div>
      </div>

      <Transition name="fade">
        <div v-if="showDeleteConfirm" class="confirm-modal">
          <div class="confirm-backdrop" @click="showDeleteConfirm = false"></div>
          <div class="confirm-panel">
            <h4>确认删除</h4>
            <p>确定要删除歌单「{{ playlist.name }}」吗？此操作不可恢复。</p>
            <div class="confirm-actions">
              <button class="btn btn--secondary" @click="showDeleteConfirm = false">取消</button>
              <button class="btn btn--danger" @click="handleConfirmDelete" :disabled="actionLoading">
                {{ actionLoading ? '删除中...' : '确认删除' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showEditModal" class="edit-modal">
          <div class="modal-backdrop" @click="showEditModal = false"></div>
          <div class="modal-panel edit-panel" @click.stop>
            <div class="modal-header">
              <h3>编辑歌单</h3>
              <button class="modal-close" @click="showEditModal = false">✕</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>歌单名称</label>
                <input
                  v-model="editName"
                  type="text"
                  class="form-input"
                  placeholder="请输入歌单名称"
                  maxlength="40"
                />
              </div>
              <div class="form-group">
                <label>歌单描述</label>
                <textarea
                  v-model="editDesc"
                  class="form-textarea"
                  placeholder="请输入歌单描述"
                  rows="3"
                  maxlength="300"
                ></textarea>
              </div>
              <div class="form-group">
                <label>歌单类型</label>
                <div class="privacy-options">
                  <button
                    class="privacy-option"
                    :class="{ active: editPrivacy === 'private' }"
                    @click="editPrivacy = 'private'"
                  >
                    🔒 私密
                  </button>
                  <button
                    class="privacy-option"
                    :class="{ active: editPrivacy === 'public' }"
                    @click="editPrivacy = 'public'"
                  >
                    🌐 公开
                  </button>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn--secondary" @click="showEditModal = false">取消</button>
              <button class="btn btn--primary" @click="handleSaveEdit" :disabled="actionLoading || !editName.trim()">
                {{ actionLoading ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<style scoped>
.playlist-detail {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.detail-panel {
  position: relative;
  width: min(680px, 92vw);
  max-height: 80vh;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.95),
    rgba(15, 15, 22, 0.98)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.detail-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.detail-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

.detail-header {
  display: flex;
  gap: 24px;
  padding: 28px 28px 20px;
}

.detail-cover {
  width: 160px;
  height: 160px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.detail-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.detail-title {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  flex-wrap: wrap;
}

.play-count {
  color: rgba(255, 255, 255, 0.4);
}

.creator {
  color: rgba(255, 255, 255, 0.5);
}

.detail-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  position: relative;
}

.action-btn {
  padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.action-btn--primary {
  background: linear-gradient(135deg, #d95b67, #e87882);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
}

.action-btn--icon {
  padding: 8px 14px;
}

.action-btn--liked {
  background: rgba(255, 193, 7, 0.15);
  border-color: rgba(255, 193, 7, 0.3);
  color: #ffc107;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.more-actions {
  position: relative;
}

.more-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: rgba(20, 20, 28, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 6px;
  min-width: 140px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.menu-item {
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.menu-item--danger {
  color: #ff6b6b;
}

.menu-item--danger:hover {
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
}

.detail-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0 28px;
}

.song-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 20px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
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

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.song-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.song-index {
  width: 24px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
  flex-shrink: 0;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.like-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
  opacity: 0;
}

.song-item:hover .like-btn {
  opacity: 1;
}

.like-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: scale(1.1);
}

.like-btn--liked {
  opacity: 1 !important;
}

.song-duration {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 20px 12px;
}

.load-more-btn {
  padding: 12px 32px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.15), rgba(232, 120, 130, 0.1));
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.load-more-btn:hover {
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.25), rgba(232, 120, 130, 0.2));
  border-color: rgba(217, 91, 103, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.2);
}

.all-loaded-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  padding: 8px 0;
}

.song-list {
  position: relative;
}

.back-to-top-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  background: rgba(20, 20, 28, 0.9);
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  font-family: inherit;
  z-index: 10;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.back-to-top-btn:hover {
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.4);
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.confirm-modal,
.edit-modal {
  position: fixed;
  inset: 0;
  z-index: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-backdrop,
.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.confirm-panel {
  position: relative;
  width: min(380px, 90vw);
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.confirm-panel h4 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.confirm-panel p {
  margin: 0 0 20px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 10px;
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
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
}

.btn--danger {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-panel {
  width: min(440px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
}

.modal-panel {
  position: relative;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
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
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  resize: vertical;
}

.form-input:focus,
.form-textarea:focus {
  border-color: rgba(217, 91, 103, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.form-input::placeholder,
.form-textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.privacy-options {
  display: flex;
  gap: 10px;
}

.privacy-option {
  flex: 1;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.privacy-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.privacy-option.active {
  background: rgba(217, 91, 103, 0.15);
  border-color: rgba(217, 91, 103, 0.5);
  color: #fff;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.25s ease;
}

.slide-enter-active .detail-panel,
.slide-leave-active .detail-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.slide-enter-from .detail-panel,
.slide-leave-to .detail-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-active .confirm-panel,
.fade-leave-active .confirm-panel,
.fade-enter-active .edit-panel,
.fade-leave-active .edit-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .confirm-panel,
.fade-leave-to .confirm-panel,
.fade-enter-from .edit-panel,
.fade-leave-to .edit-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
