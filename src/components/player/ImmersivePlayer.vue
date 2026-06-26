<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useImmersiveStore } from '@/stores/immersive'
import { useLyricsStore } from '@/stores/lyrics'

const player = usePlayerStore()
const immersive = useImmersiveStore()
const lyrics = useLyricsStore()

const progressBarRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)
const isDiyMode = ref(true)

function toggleDiyMode() {
  isDiyMode.value = !isDiyMode.value
  if (isDiyMode.value) {
    lyrics.applyPreset('classic')
  } else {
    lyrics.applyPreset('minimal')
  }
}

const currentTimeFormatted = computed(() => {
  return formatTime(player.currentTime)
})

const durationFormatted = computed(() => {
  return formatTime(player.duration)
})

const progressPercent = computed(() => {
  return player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0
})

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function togglePlay() {
  player.togglePlay()
}

function prevTrack() {
  player.prev()
}

function nextTrack() {
  player.next()
}

function handleProgressClick(e: MouseEvent) {
  if (!progressBarRef.value || !player.duration) return
  const rect = progressBarRef.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const time = percent * player.duration
  player.seek(time)
}

function handleProgressDragStart(e: MouseEvent) {
  isDragging.value = true
  handleProgressClick(e)
  
  function onMove(e: MouseEvent) {
    handleProgressClick(e)
  }
  
  function onUp() {
    isDragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<template>
  <Transition name="slide-up">
    <div v-if="immersive.isImmersive && immersive.showControls" class="immersive-player" @mouseenter="immersive.showPlayerControls()">
      <div class="fullscreen-diy-zone">
        <button class="fullscreen-diy-btn" @click="toggleDiyMode" :title="isDiyMode ? '切换到简约模式' : '切换到 DIY 模式'">
          {{ isDiyMode ? 'DIY' : '简约' }}
        </button>
      </div>

      <div class="immersive-player__progress" ref="progressBarRef" @mousedown="handleProgressDragStart">
        <div class="immersive-player__progress-bg"></div>
        <div class="immersive-player__progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        <div class="immersive-player__progress-thumb" :style="{ left: `${progressPercent}%` }"></div>
      </div>
      
      <div class="immersive-player__controls">
        <div class="immersive-player__time">{{ currentTimeFormatted }}</div>
        
        <div class="immersive-player__buttons">
          <button class="immersive-player__btn" @click="prevTrack" title="上一首">
            ⏮
          </button>
          <button class="immersive-player__btn immersive-player__btn--play" @click="togglePlay" :title="player.isPlaying ? '暂停' : '播放'">
            {{ player.isPlaying ? '⏸' : '▶' }}
          </button>
          <button class="immersive-player__btn" @click="nextTrack" title="下一首">
            ⏭
          </button>
        </div>
        
        <div class="immersive-player__time">{{ durationFormatted }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.immersive-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 20px 40px 30px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: slideUp 0.3s ease;
}

.fullscreen-diy-zone {
  position: absolute;
  top: -50px;
  right: 40px;
  z-index: 1001;
}

.fullscreen-diy-btn {
  padding: 8px 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  background: rgba(20, 20, 28, 0.6);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  opacity: 0.6;
  transform: translateX(10px);
}

.fullscreen-diy-zone:hover .fullscreen-diy-btn {
  opacity: 1;
  transform: translateX(0);
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.4);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.immersive-player__progress {
  position: relative;
  height: 4px;
  cursor: pointer;
  margin-bottom: 20px;
}

.immersive-player__progress-bg {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1px;
}

.immersive-player__progress-fill {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  height: 2px;
  background: var(--color-accent, #d95b67);
  border-radius: 1px;
  transition: width 0.1s ease;
}

.immersive-player__progress-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--color-accent, #d95b67);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.immersive-player__progress:hover .immersive-player__progress-thumb {
  opacity: 1;
}

.immersive-player__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 600px;
  margin: 0 auto;
}

.immersive-player__time {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  min-width: 50px;
}

.immersive-player__buttons {
  display: flex;
  align-items: center;
  gap: 30px;
}

.immersive-player__btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: white;
  font-size: 24px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.immersive-player__btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(1.1);
}

.immersive-player__btn--play {
  width: 56px;
  height: 56px;
  font-size: 28px;
  background: var(--color-accent, #d95b67);
}

.immersive-player__btn--play:hover {
  background: var(--color-accent-light, #f0a0a0);
  transform: scale(1.05);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
