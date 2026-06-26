<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as THREE from 'three'
import { ShelfEngine } from '@/modules/shelf'
import type { ShelfItem, ShelfCard, ShelfCardAction } from '@/modules/shelf'
import { useFxStore } from '@/stores/fx'
import { usePlayerStore } from '@/stores/player'
import { providerManager } from '@/modules/providers'
import type { Playlist } from '@/types'
import { formatPlayCount } from '@/utils'

const props = defineProps<{
  playlists: Playlist[]
}>()

const emit = defineEmits<{
  (e: 'playlist-click', playlist: Playlist): void
  (e: 'close-detail'): void
}>()

const fx = useFxStore()
const player = usePlayerStore()

const containerRef = ref<HTMLDivElement | null>(null)
const detailPanelRef = ref<HTMLDivElement | null>(null)
const detailTracks = ref<Playlist['tracks']>([])
const detailTitle = ref('')
const detailLoading = ref(false)
const selectedPlaylistId = ref<string | null>(null)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let shelfEngine: ShelfEngine | null = null
let animationId: number | null = null
let audioDataTimer: number | null = null

const shelfItems = computed<ShelfItem[]>(() => {
  return props.playlists.map((pl, idx) => ({
    type: 'playlist' as const,
    id: pl.id,
    title: pl.name,
    sub: `${pl.source === 'netease' ? '网易' : 'QQ'} · ${pl.trackCount} 首 · 播放 ${formatPlayCount(pl.playCount || 0)}`,
    cover: pl.coverUrl || '',
    tag: idx === 0 ? '推荐歌单' : `#${idx + 1}`,
    playlistId: pl.id,
    provider: pl.source,
    isNowPlaying: false,
  }))
})

function initThree() {
  if (!containerRef.value) return

  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(
    60,
    containerRef.value.clientWidth / containerRef.value.clientHeight,
    0.1,
    1000
  )
  camera.position.z = 5

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  renderer.setClearColor(0x000000, 0)
  containerRef.value.appendChild(renderer.domElement)

  shelfEngine = new ShelfEngine(
    scene,
    camera,
    {
      mode: 'side',
      accentColor: fx.settings.accentColor,
      size: 0.9,
      offsetX: 0.2,
      opacity: 0.95,
      bgOpacity: 0.75,
    },
    {
      onCardClick: handleCardClick,
      onCardHover: handleCardHover,
      onContentOpen: handleContentOpen,
      onContentClose: handleContentClose,
    }
  )

  shelfEngine.setItems(shelfItems.value)
  shelfEngine.setPinnedOpen(true)
  shelfEngine.start()

  animate()
  startAudioDataPolling()
}

function animate() {
  if (!renderer || !scene || !camera) return
  renderer.render(scene, camera)
  animationId = requestAnimationFrame(animate)
}

function startAudioDataPolling() {
  audioDataTimer = window.setInterval(() => {
    if (!shelfEngine) return
    const isPlaying = player.status === 'playing'
    const bass = isPlaying ? 0.3 + Math.random() * 0.3 : 0
    const beatPulse = isPlaying ? 0.2 + Math.random() * 0.2 : 0
    shelfEngine.setAudioData(isPlaying, bass, beatPulse)
  }, 100)
}

function handleResize() {
  if (!containerRef.value || !camera || !renderer) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

function handlePointerMove(e: PointerEvent) {
  if (!containerRef.value || !shelfEngine) return
  const rect = containerRef.value.getBoundingClientRect()
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
  const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
  shelfEngine.handlePointerMove(nx, ny)
}

function handleClick(e: MouseEvent) {
  if (!containerRef.value || !shelfEngine) return
  const rect = containerRef.value.getBoundingClientRect()
  const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
  const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
  shelfEngine.handleClick(nx, ny)
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (!shelfEngine) return
  shelfEngine.handleWheel(e.deltaY)
}

function handleCardClick(card: ShelfCard, action: ShelfCardAction) {
  if (action.kind === 'loadPlaylist' && action.playlistId) {
    const playlist = props.playlists.find((p) => p.id === action.playlistId)
    if (playlist) {
      emit('playlist-click', playlist)
    }
  }
}

function handleCardHover(card: ShelfCard | null) {
  if (card) {
    document.body.style.cursor = 'pointer'
  } else {
    document.body.style.cursor = ''
  }
}

async function handleContentOpen(card: ShelfCard) {
  const playlist = props.playlists.find((p) => p.id === card.item.playlistId)
  if (!playlist) return

  selectedPlaylistId.value = playlist.id
  detailTitle.value = playlist.name
  detailLoading.value = true
  detailTracks.value = []

  try {
    const provider = providerManager.get(playlist.source) || providerManager.default
    const detail = await provider.getPlaylist(playlist.id)
    if (detail) {
      detailTracks.value = detail.tracks.slice(0, 20)
    }
  } catch (e) {
    console.error('Load playlist detail error:', e)
  } finally {
    detailLoading.value = false
  }
}

function handleContentClose() {
  selectedPlaylistId.value = null
  detailTracks.value = []
  detailTitle.value = ''
  emit('close-detail')
}

function closeDetail() {
  if (shelfEngine) {
    shelfEngine.closeContent()
  }
  handleContentClose()
}

function playSong(song: Playlist['tracks'][0]) {
  const queue = detailTracks.value
  const idx = queue.findIndex((s) => s.id === song.id)
  player.replaceQueue(queue, idx >= 0 ? idx : 0)
}

watch(shelfItems, (items) => {
  if (shelfEngine) {
    shelfEngine.setItems(items)
  }
})

watch(
  () => fx.settings.accentColor,
  (color) => {
    if (shelfEngine) {
      shelfEngine.setAccentColor(color)
    }
  }
)

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (audioDataTimer) clearInterval(audioDataTimer)
  if (shelfEngine) shelfEngine.dispose()
  if (renderer && containerRef.value) {
    containerRef.value.removeChild(renderer.domElement)
    renderer.dispose()
  }
  window.removeEventListener('resize', handleResize)
  document.body.style.cursor = ''
})
</script>

<template>
  <div class="playlist-shelf-3d">
    <div
      ref="containerRef"
      class="shelf-canvas"
      @pointermove="handlePointerMove"
      @click="handleClick"
      @wheel.passive="handleWheel"
    ></div>

    <Transition name="detail-fade">
      <div v-if="selectedPlaylistId" ref="detailPanelRef" class="detail-panel">
        <div class="detail-header">
          <h3>{{ detailTitle }}</h3>
          <button class="close-btn" @click="closeDetail">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="detail-sub" v-if="!detailLoading">
          {{ detailTracks.length }} 首歌曲
        </div>
        <div class="detail-tracks" v-if="!detailLoading">
          <div
            v-for="(song, idx) in detailTracks"
            :key="song.id"
            class="track-row"
            @click="playSong(song)"
          >
            <span class="track-index">{{ String(idx + 1).padStart(2, '0') }}</span>
            <div class="track-info">
              <div class="track-name">{{ song.name }}</div>
              <div class="track-artist">{{ song.artists?.map((a) => a.name).join(' / ') }}</div>
            </div>
          </div>
        </div>
        <div class="detail-loading" v-else>
          <div class="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      </div>
    </Transition>

    <div class="shelf-hint">
      <span>滚轮滚动浏览</span>
      <span class="dot">·</span>
      <span>点击卡片查看详情</span>
    </div>
  </div>
</template>

<style scoped>
.playlist-shelf-3d {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.shelf-canvas {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.detail-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(480px, 80vw);
  max-height: 70vh;
  background: linear-gradient(145deg, rgba(18, 21, 26, 0.92), rgba(8, 9, 13, 0.96));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 245, 212, 0.08);
  padding: 24px;
  display: flex;
  flex-direction: column;
  z-index: 20;
  pointer-events: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: rgba(255, 246, 220, 0.94);
}

.close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 122, 144, 0.15);
  border-color: rgba(255, 122, 144, 0.4);
  color: #fff;
}

.detail-sub {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16px;
}

.detail-tracks {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-tracks::-webkit-scrollbar {
  width: 4px;
}

.detail-tracks::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.track-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.track-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.track-index {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: rgba(0, 245, 212, 0.6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.shelf-hint {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.05em;
  pointer-events: none;
}

.shelf-hint .dot {
  color: rgba(255, 255, 255, 0.2);
}

.detail-fade-enter-active,
.detail-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.detail-fade-enter-from,
.detail-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}
</style>
