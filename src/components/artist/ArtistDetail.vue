<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ArtistDetail, Song, Album, Artist, MV } from '@/types'
import { playQueueStore } from '@/stores/playQueue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { formatTime } from '@/utils/time'
import { providerManager } from '@/modules/providers'

const props = defineProps<{
  artistId: string | null
  source: string
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'open-album', album: Album): void
  (e: 'open-artist', artist: Artist): void
}>()

const queue = playQueueStore()
const player = usePlayerStore()
const userStore = useUserStore()

const loading = ref(false)
const actionLoading = ref(false)
const activeTab = ref<'songs' | 'albums' | 'mvs' | 'similar'>('songs')

const artistDetail = ref<ArtistDetail | null>(null)
const songs = ref<Song[]>([])
const albums = ref<Album[]>([])
const mvs = ref<MV[]>([])
const similarArtists = ref<Artist[]>([])

const songsPage = ref(1)
const songsHasMore = ref(false)
const loadingMoreSongs = ref(false)

const albumsPage = ref(1)
const albumsHasMore = ref(false)
const loadingMoreAlbums = ref(false)

function getProvider() {
  return providerManager.get(props.source) || providerManager.default
}

async function loadArtistDetail() {
  if (!props.artistId) return
  loading.value = true
  try {
    const provider = getProvider()
    const detail = await provider.getArtistDetail(props.artistId)
    artistDetail.value = detail

    const songsResult = await provider.getArtistSongs(props.artistId, 1, 50)
    songs.value = songsResult.songs
    songsHasMore.value = songsResult.more
    songsPage.value = 1

    const albumsResult = await provider.getArtistAlbums(props.artistId, 1, 30)
    albums.value = albumsResult.albums
    albumsHasMore.value = albumsResult.more
    albumsPage.value = 1

    const mvsResult = await provider.getArtistMVs(props.artistId, 1, 20)
    mvs.value = mvsResult.mvs

    const similar = await provider.getSimilarArtists(props.artistId)
    similarArtists.value = similar
  } catch (e) {
    console.error('Load artist detail error:', e)
  } finally {
    loading.value = false
  }
}

async function loadMoreSongs() {
  if (!props.artistId || loadingMoreSongs.value || !songsHasMore.value) return
  loadingMoreSongs.value = true
  try {
    const provider = getProvider()
    const nextPage = songsPage.value + 1
    const result = await provider.getArtistSongs(props.artistId, nextPage, 50)
    songs.value = [...songs.value, ...result.songs]
    songsHasMore.value = result.more
    songsPage.value = nextPage
  } catch (e) {
    console.error('Load more songs error:', e)
  } finally {
    loadingMoreSongs.value = false
  }
}

async function loadMoreAlbums() {
  if (!props.artistId || loadingMoreAlbums.value || !albumsHasMore.value) return
  loadingMoreAlbums.value = true
  try {
    const provider = getProvider()
    const nextPage = albumsPage.value + 1
    const result = await provider.getArtistAlbums(props.artistId, nextPage, 30)
    albums.value = [...albums.value, ...result.albums]
    albumsHasMore.value = result.more
    albumsPage.value = nextPage
  } catch (e) {
    console.error('Load more albums error:', e)
  } finally {
    loadingMoreAlbums.value = false
  }
}

async function handleToggleFollow() {
  if (!props.artistId || actionLoading.value || !userStore.isLoggedIn) return
  actionLoading.value = true
  try {
    const provider = getProvider()
    const isFollowed = artistDetail.value?.followed || false
    const result = await provider.followArtist(props.artistId, !isFollowed)
    if (result && artistDetail.value) {
      artistDetail.value.followed = !isFollowed
    }
  } catch (e) {
    console.error('Toggle follow error:', e)
  } finally {
    actionLoading.value = false
  }
}

function handlePlaySong(song: Song, index: number) {
  queue.setQueue(songs.value, index)
  player.play(song)
}

function handlePlayAll() {
  if (songs.value.length > 0) {
    queue.setQueue(songs.value, 0)
    player.play(songs.value[0])
  }
}

function handleAddToQueue() {
  songs.value.forEach((song) => {
    queue.addToQueue(song)
  })
}

function handleOpenAlbum(album: Album) {
  emit('open-album', album)
}

function handleOpenArtist(artist: Artist) {
  emit('open-artist', artist)
}

function getArtistsText(song: Song): string {
  return song.artists.map((a) => a.name).join(' / ')
}

function formatCount(count?: number): string {
  if (!count) return '0'
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + ' 万'
  }
  return String(count)
}

const coverGradient = computed(() => {
  return 'linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4))'
})

watch(
  () => props.artistId,
  (id) => {
    if (id && props.visible) {
      loadArtistDetail()
    }
  }
)

watch(
  () => props.visible,
  (v) => {
    if (v && props.artistId && !artistDetail.value) {
      loadArtistDetail()
    }
  }
)
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && artistId" class="artist-detail">
      <div class="detail-backdrop" @click="emit('close')"></div>
      <div class="detail-panel" @click.stop>
        <button class="detail-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>

        <template v-else-if="artistDetail">
          <div class="detail-header">
            <div class="detail-avatar" :style="{ background: coverGradient }">
              <img v-if="artistDetail.avatar" :src="artistDetail.avatar" alt="" />
            </div>
            <div class="detail-info">
              <h2 class="detail-title">{{ artistDetail.name }}</h2>
              <div class="detail-stats">
                <span v-if="artistDetail.fansCount" class="stat-item">
                  粉丝 {{ formatCount(artistDetail.fansCount) }}
                </span>
                <span v-if="artistDetail.songCount" class="stat-item">
                  歌曲 {{ artistDetail.songCount }}
                </span>
                <span v-if="artistDetail.albumCount" class="stat-item">
                  专辑 {{ artistDetail.albumCount }}
                </span>
              </div>
              <p v-if="artistDetail.briefDesc" class="detail-desc">{{ artistDetail.briefDesc }}</p>
              <div class="detail-actions">
                <button class="action-btn action-btn--primary" @click="handlePlayAll">
                  ▶ 播放全部
                </button>
                <button class="action-btn" @click="handleAddToQueue">
                  + 加入队列
                </button>
                <button
                  v-if="userStore.isLoggedIn"
                  class="action-btn action-btn--icon"
                  :class="{ 'action-btn--liked': artistDetail.followed }"
                  @click="handleToggleFollow"
                  :disabled="actionLoading"
                  :title="artistDetail.followed ? '取消关注' : '关注'"
                >
                  {{ artistDetail.followed ? '✓ 已关注' : '+ 关注' }}
                </button>
                <button class="action-btn action-btn--icon" title="分享">
                  ↗ 分享
                </button>
              </div>
            </div>
          </div>

          <div class="detail-divider"></div>

          <div class="tabs">
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'songs' }"
              @click="activeTab = 'songs'"
            >
              热门歌曲
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'albums' }"
              @click="activeTab = 'albums'"
            >
              专辑
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'mvs' }"
              @click="activeTab = 'mvs'"
            >
              MV
            </button>
            <button
              class="tab-btn"
              :class="{ active: activeTab === 'similar' }"
              @click="activeTab = 'similar'"
            >
              相似歌手
            </button>
          </div>

          <div class="tab-content">
            <div v-if="activeTab === 'songs'" class="song-list">
              <div
                v-for="(song, index) in songs"
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
                <div class="song-duration">{{ formatTime(song.duration) }}</div>
              </div>
              <div v-if="loadingMoreSongs" class="loading-more">
                <div class="loading-spinner-small"></div>
                <span>加载更多...</span>
              </div>
              <button
                v-else-if="songsHasMore"
                class="load-more-btn"
                @click="loadMoreSongs"
              >
                加载更多
              </button>
            </div>

            <div v-if="activeTab === 'albums'" class="album-grid">
              <div
                v-for="album in albums"
                :key="album.id"
                class="album-item"
                @click="handleOpenAlbum(album)"
              >
                <div class="album-cover">
                  <img v-if="album.coverUrl" :src="album.coverUrl" alt="" />
                  <div class="album-play-btn">▶</div>
                </div>
                <div class="album-name">{{ album.name }}</div>
              </div>
              <div v-if="loadingMoreAlbums" class="loading-more">
                <div class="loading-spinner-small"></div>
                <span>加载更多...</span>
              </div>
              <button
                v-else-if="albumsHasMore"
                class="load-more-btn"
                @click="loadMoreAlbums"
              >
                加载更多
              </button>
            </div>

            <div v-if="activeTab === 'mvs'" class="mv-grid">
              <div
                v-for="mv in mvs"
                :key="mv.id"
                class="mv-item"
              >
                <div class="mv-cover">
                  <img v-if="mv.coverUrl" :src="mv.coverUrl" alt="" />
                  <div class="mv-play-btn">▶</div>
                  <div v-if="mv.playCount" class="mv-play-count">
                    ▶ {{ formatCount(mv.playCount) }}
                  </div>
                </div>
                <div class="mv-name">{{ mv.name }}</div>
              </div>
              <div v-if="mvs.length === 0" class="empty-state">
                暂无 MV
              </div>
            </div>

            <div v-if="activeTab === 'similar'" class="artist-grid">
              <div
                v-for="artist in similarArtists"
                :key="artist.id"
                class="artist-item"
                @click="handleOpenArtist(artist)"
              >
                <div class="artist-avatar">
                  <img v-if="artist.avatar" :src="artist.avatar" alt="" />
                </div>
                <div class="artist-name">{{ artist.name }}</div>
              </div>
              <div v-if="similarArtists.length === 0" class="empty-state">
                暂无相似歌手
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-state">
          未找到歌手信息
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.artist-detail {
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
  width: min(720px, 92vw);
  max-height: 85vh;
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

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.detail-header {
  display: flex;
  gap: 24px;
  padding: 28px 28px 20px;
}

.detail-avatar {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.detail-avatar img {
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
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}

.detail-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stat-item {
  font-size: 13px;
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
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.4);
  color: #e87882;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.detail-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0 28px;
}

.tabs {
  display: flex;
  gap: 8px;
  padding: 12px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #fff;
  background: rgba(217, 91, 103, 0.15);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.song-list {
  display: flex;
  flex-direction: column;
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

.song-duration {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 16px;
}

.album-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.album-item:hover {
  transform: translateY(-2px);
}

.album-cover {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
}

.album-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-play-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.2s;
}

.album-item:hover .album-play-btn {
  opacity: 1;
}

.album-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.mv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.mv-item {
  cursor: pointer;
  transition: transform 0.2s;
}

.mv-item:hover {
  transform: translateY(-2px);
}

.mv-cover {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
}

.mv-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mv-play-btn {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 28px;
  opacity: 0;
  transition: opacity 0.2s;
}

.mv-item:hover .mv-play-btn {
  opacity: 1;
}

.mv-play-count {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
}

.mv-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 16px;
}

.artist-item {
  cursor: pointer;
  transition: transform 0.2s;
  text-align: center;
}

.artist-item:hover {
  transform: translateY(-2px);
}

.artist-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  margin: 0 auto 8px;
}

.artist-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.load-more-btn {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  margin-top: 8px;
}

.load-more-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
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
</style>
