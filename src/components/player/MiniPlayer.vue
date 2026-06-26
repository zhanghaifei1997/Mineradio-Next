<template>
  <div class="mini-player" :class="{ 'mini-player--expanded': expanded }">
    <div class="mini-player__header" @mousedown="startDrag" @dblclick="toggleExpand">
      <div class="mini-player__drag-handle">⠿</div>
      <div class="mini-player__title">Mineradio</div>
      <div class="mini-player__window-controls">
        <button class="window-btn window-btn--minimize" @click.stop="minimize" title="最小化">
          —
        </button>
        <button class="window-btn window-btn--close" @click.stop="close" title="关闭">
          ✕
        </button>
      </div>
    </div>

    <div class="mini-player__content">
      <div class="mini-player__cover" @click="toggleExpand">
        <img v-if="currentSong?.coverUrl" :src="currentSong.coverUrl" alt="" />
        <div v-else class="cover-placeholder"></div>
        <div class="mini-player__play-overlay" v-if="!isPlaying">
          <span class="play-icon">▶</span>
        </div>
      </div>

      <div class="mini-player__info">
        <div class="mini-player__song-name" :title="currentSong?.name || '未播放'">
          {{ currentSong?.name || '未播放' }}
        </div>
        <div class="mini-player__artist" :title="artistName">
          {{ artistName || '选择一首歌开始' }}
        </div>
      </div>

      <div class="mini-player__controls" :class="{ 'mini-player__controls--visible': controlsVisible }">
        <button class="ctrl-btn ctrl-btn--prev" @click="prev" title="上一首">
          ⏮
        </button>
        <button class="ctrl-btn ctrl-btn--play" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        <button class="ctrl-btn ctrl-btn--next" @click="next" title="下一首">
          ⏭
        </button>
      </div>

      <div class="mini-player__progress">
        <div class="progress-bar">
          <div class="progress-bar__fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="mini-player__time">
          <span>{{ formatTime(currentTime) }}</span>
          <span>{{ formatTime(duration) }}</span>
        </div>
      </div>

      <div class="mini-player__extra-controls" v-if="expanded">
        <button class="ctrl-btn ctrl-btn--mode" @click="cyclePlayMode" :title="playModeLabel">
          {{ playModeIcon }}
        </button>
        <div class="mini-player__volume">
          <span class="volume-icon" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</span>
          <div class="volume-bar" @click="onVolumeClick">
            <div class="volume-bar__fill" :style="{ width: (muted ? 0 : volume * 100) + '%' }"></div>
          </div>
        </div>
        <button class="ctrl-btn ctrl-btn--expand" @click="toggleExpand" title="展开">
          ⤢
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/time'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'expand'): void
}>()

const player = usePlayerStore()

const expanded = ref(false)
const controlsVisible = ref(false)
const dragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragWindowStartX = 0
let dragWindowStartY = 0

const electronAPI = (window as any).electronAPI

const currentSong = computed(() => player.currentSong)
const isPlaying = computed(() => player.isPlaying)
const currentTime = computed(() => player.currentTime)
const duration = computed(() => player.duration)
const volume = computed(() => player.volume)
const muted = computed(() => player.muted)
const playMode = computed(() => player.playMode)

const progressPercent = computed(() => player.progress)

const artistName = computed(() => {
  if (!currentSong.value?.artists) return ''
  return currentSong.value.artists.map(a => a.name).join(' / ')
})

const playModeLabel = computed(() => {
  const map: Record<string, string> = { sequence: '顺序', loop: '列表循环', single: '单曲循环', shuffle: '随机' }
  return map[playMode.value] || '顺序'
})

const playModeIcon = computed(() => {
  const map: Record<string, string> = { sequence: '🔁', loop: '🔂', single: '🔄', shuffle: '🔀' }
  return map[playMode.value] || '🔁'
})

function togglePlay() {
  player.togglePlay()
}

function prev() {
  player.prev()
}

function next() {
  player.next()
}

function toggleMute() {
  player.toggleMute()
}

function cyclePlayMode() {
  player.cyclePlayMode()
}

function onVolumeClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  player.setVolume(percent)
}

function minimize() {
  if (electronAPI?.window?.minimize) {
    electronAPI.window.minimize()
  }
}

function close() {
  emit('close')
}

function toggleExpand() {
  expanded.value = !expanded.value
  if (expanded.value) {
    emit('expand')
  }
}

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.window-btn')) return
  
  dragging.value = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  
  if (electronAPI?.window?.getState) {
    electronAPI.window.getState().then((state: any) => {
      if (state?.bounds) {
        dragWindowStartX = state.bounds.x
        dragWindowStartY = state.bounds.y
      }
    })
  }
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging.value) return
  
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  
  if (electronAPI?.window?.getState) {
    electronAPI.window.getState().then((state: any) => {
      if (state?.bounds) {
        const newX = dragWindowStartX + dx
        const newY = dragWindowStartY + dy
        if (electronAPI?.window?.setBounds) {
          electronAPI.window.setBounds({ x: newX, y: newY })
        }
      }
    })
  }
}

function stopDrag() {
  dragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function showControls() {
  controlsVisible.value = true
}

function hideControls() {
  controlsVisible.value = false
}

onMounted(() => {
  document.addEventListener('mouseenter', showControls)
  document.addEventListener('mouseleave', hideControls)
})

onUnmounted(() => {
  document.removeEventListener('mouseenter', showControls)
  document.removeEventListener('mouseleave', hideControls)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.mini-player {
  width: 100%;
  height: 100%;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 12px;
  overflow: hidden;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  user-select: none;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.mini-player__header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  cursor: move;
  -webkit-app-region: drag;
}

.mini-player__drag-handle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-right: 8px;
  cursor: move;
}

.mini-player__title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.mini-player__window-controls {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 10px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}

.window-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.window-btn--close:hover {
  background: rgba(255, 82, 82, 0.4);
  color: #ff5252;
}

.mini-player__content {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mini-player__cover {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.mini-player__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.5), rgba(100, 50, 150, 0.5));
}

.mini-player__play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.mini-player__cover:hover .mini-player__play-overlay {
  opacity: 1;
}

.play-icon {
  font-size: 20px;
  color: #fff;
}

.mini-player__info {
  min-width: 0;
  flex: 1;
}

.mini-player__song-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-player__artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-player__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.2s ease;
}

.mini-player__controls--visible {
  opacity: 1;
  transform: translateY(0);
}

.ctrl-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.ctrl-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: scale(1.05);
}

.ctrl-btn--play {
  width: 40px;
  height: 40px;
  font-size: 16px;
  background: rgba(217, 91, 103, 0.9);
  color: #fff;
}

.ctrl-btn--play:hover {
  background: rgba(217, 91, 103, 1);
}

.mini-player__progress {
  margin-top: 4px;
}

.progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
}

.progress-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.mini-player__time {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}

.mini-player__extra-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.mini-player__volume {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.volume-icon {
  font-size: 12px;
  cursor: pointer;
}

.volume-bar {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
}

.volume-bar__fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
}

.ctrl-btn--mode {
  width: 28px;
  height: 28px;
  font-size: 12px;
}

.ctrl-btn--expand {
  width: 28px;
  height: 28px;
  font-size: 12px;
}
</style>
