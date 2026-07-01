<template>
  <div id="bottom-bar" :class="{ visible: showControls }">
    <!-- 进度条 -->
    <div
      id="progress-bar"
      ref="progressBarRef"
      @click="onProgressClick"
      @mousedown="onProgressDragStart"
    >
      <div id="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      <div id="progress-thumb" aria-hidden="true"></div>
    </div>

    <!-- 控制区 -->
    <div id="controls">
      <!-- 左侧: 歌曲信息 + 红心 + 收藏 -->
      <div class="control-cluster actions">
        <div class="control-track">
          <div
            class="control-cover"
            :class="{ 'cover-empty': !currentCover }"
            :style="currentCover ? { backgroundImage: `url(${currentCover})` } : {}"
            aria-hidden="true"
          ></div>
          <div class="control-meta">
            <div class="control-title" :title="currentSong?.name">{{ currentSong?.name ?? '' }}</div>
            <div class="control-artist" :title="currentSong?.artist">{{ currentSong?.artist ?? '' }}</div>
          </div>
        </div>
        <button class="ctrl-btn" title="红心喜欢" @click="toggleLike">
          <svg class="heart-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 21.45c-.32 0-.62-.12-.86-.34l-1.23-1.12C5.54 16.03 2.25 13.05 2.25 8.9 2.25 5.48 4.88 2.9 8.28 2.9c1.7 0 3.35.72 4.52 1.96C13.97 3.62 15.62 2.9 17.32 2.9c3.4 0 6.03 2.58 6.03 6 0 4.15-3.29 7.13-7.66 11.09l-1.23 1.12c-.24.22-.54.34-.86.34z"/>
          </svg>
        </button>
        <button class="ctrl-btn" title="收藏到歌单">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </div>

      <!-- 中间: 播放控制 -->
      <div class="control-cluster transport">
        <button class="ctrl-btn" title="播放顺序" @click="cycleMode">
          <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <template v-if="player.playMode === 'loop'">
              <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </template>
            <template v-else-if="player.playMode === 'shuffle'">
              <path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>
            </template>
            <template v-else>
              <path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            </template>
          </svg>
        </button>
        <button class="ctrl-btn" title="上一首" @click="prevTrack">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button id="play-btn" class="ctrl-btn" title="播放/暂停" @click="togglePlay">
          <svg v-if="!player.playing" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <svg v-else width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        </button>
        <button class="ctrl-btn" title="下一首" @click="nextTrack">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
        <button class="ctrl-btn" title="当前队列">
          <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg>
        </button>
      </div>

      <!-- 右侧: 歌词/音量/沉浸/全屏/时间 -->
      <div class="control-cluster modes">
        <button class="ctrl-btn" title="歌词"><span class="lyrics-word-icon">词</span></button>
        <div class="volume-control">
          <button class="ctrl-btn" title="音量" @click="showVolumePopover = !showVolumePopover">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path v-if="player.volume > 0" d="M15 9.5a4 4 0 0 1 0 5"/>
              <line v-if="player.volume === 0" x1="23" y1="9" x2="17" y2="15"/>
              <line v-if="player.volume === 0" x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          </button>
          <div class="volume-popover" :class="{ open: showVolumePopover }" @click.stop>
            <input
              id="volume-slider"
              type="range" min="0" max="1" step="0.01"
              :value="player.volume"
              @input="onVolumeInput"
              aria-label="音量"
            >
            <span id="volume-value">{{ Math.round(player.volume * 100) }}%</span>
          </div>
        </div>
        <button class="ctrl-btn" :class="{ active: settings.immersiveMode }" title="全沉浸式" @click="settings.setImmersiveMode(!settings.immersiveMode)">
          <svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M15 4h4a1 1 0 0 1 1 1v4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M9 20H5a1 1 0 0 1-1-1v-4"/><circle cx="12" cy="12" r="2.2"/></svg>
        </button>
        <button class="ctrl-btn" title="全屏" @click="desktop.toggleFullscreen()">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7V3h4"/><path d="M21 7V3h-4"/><path d="M3 17v4h4"/><path d="M21 17v4h-4"/></svg>
        </button>
        <div id="time-display">{{ formatTime(player.currentTime) }} / {{ formatTime(player.duration) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'
import { desktop } from '@/services/desktop'

const player = usePlayerStore()
const settings = useSettingsStore()

// 注入全局播放器实例
const playerCtrl = inject('player') as ReturnType<typeof import('@/composables/usePlayer').usePlayer> | undefined

const showControls = ref(true)
const showVolumePopover = ref(false)
const progressBarRef = ref<HTMLElement | null>(null)

const currentSong = computed(() => player.currentSong)
const currentCover = computed(() => currentSong.value?.cover ?? '')

const progressPercent = computed(() => {
  if (player.duration <= 0) return 0
  return (player.currentTime / player.duration) * 100
})

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function togglePlay() {
  if (playerCtrl) {
    playerCtrl.togglePlay()
  } else if (player.playing) {
    player.setPlaying(false)
  } else {
    player.setPlaying(true)
  }
}

function prevTrack() {
  if (playerCtrl) {
    playerCtrl.handlePrev()
  } else if (player.currentIdx > 0) {
    player.setCurrentIdx(player.currentIdx - 1)
  } else if (player.playMode === 'loop' && player.playlist.length > 0) {
    player.setCurrentIdx(player.playlist.length - 1)
  }
}

function nextTrack() {
  if (playerCtrl) {
    playerCtrl.handleNext()
  } else if (player.playMode === 'shuffle' && player.playlist.length > 1) {
    let next: number
    do {
      next = Math.floor(Math.random() * player.playlist.length)
    } while (next === player.currentIdx)
    player.setCurrentIdx(next)
  } else if (player.currentIdx < player.playlist.length - 1) {
    player.setCurrentIdx(player.currentIdx + 1)
  } else if (player.playMode === 'loop' && player.playlist.length > 0) {
    player.setCurrentIdx(0)
  }
}

function cycleMode() {
  player.cyclePlayMode()
}

function toggleLike() {
  // TODO: 实现红心功能
}

function onVolumeInput(e: Event) {
  const target = e.target as HTMLInputElement
  const val = parseFloat(target.value)
  if (playerCtrl) {
    playerCtrl.setVolume(val)
  } else {
    player.setVolume(val)
  }
}

function onProgressClick(e: MouseEvent) {
  const bar = progressBarRef.value
  if (!bar || player.duration <= 0) return
  const rect = bar.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const time = ratio * player.duration
  if (playerCtrl) {
    playerCtrl.seekTo(time)
  } else {
    player.setCurrentTime(time)
  }
}

function onProgressDragStart(e: MouseEvent) {
  e.preventDefault()
  const bar = progressBarRef.value
  if (!bar || player.duration <= 0) return

  const onMove = (ev: MouseEvent) => {
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
    const time = ratio * player.duration
    if (playerCtrl) {
      playerCtrl.seekTo(time)
    } else {
      player.setCurrentTime(time)
    }
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// 控制栏自动显示/隐藏
let hideTimer: ReturnType<typeof setTimeout> | null = null
function resetHideTimer() {
  showControls.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!settings.controlsVisible) {
      showControls.value = false
    }
  }, 4000)
}

onMounted(() => {
  document.addEventListener('mousemove', resetHideTimer)
  resetHideTimer()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', resetHideTimer)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>
