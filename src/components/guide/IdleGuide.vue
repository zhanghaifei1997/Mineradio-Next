<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'

const STORAGE_KEY = 'mineradio_idle_guide_shown'
const IDLE_TIMEOUT = 30000

const player = usePlayerStore()

const visible = ref(false)
let idleTimer: number | null = null

const tips = [
  {
    id: 'search',
    text: '搜索音乐',
    icon: '🔍',
    position: { top: '80px', left: '50%' },
    delay: '0s',
  },
  {
    id: 'controls',
    text: '播放控制',
    icon: '🎵',
    position: { bottom: '100px', left: '50%' },
    delay: '0.3s',
  },
  {
    id: 'visual',
    text: '视觉效果',
    icon: '🎨',
    position: { top: '80px', right: '160px' },
    delay: '0.6s',
  },
  {
    id: 'user',
    text: '用户中心',
    icon: '👤',
    position: { top: '80px', right: '24px' },
    delay: '0.9s',
  },
]

const canShow = computed(() => {
  return !player.isPlaying && !player.currentSong
})

function hasShownBefore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markAsShown(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // ignore
  }
}

function startIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer)
  }
  idleTimer = window.setTimeout(() => {
    if (canShow.value) {
      showGuide()
    } else {
      startIdleTimer()
    }
  }, IDLE_TIMEOUT)
}

function resetIdleTimer() {
  if (visible.value) {
    hideGuide()
  }
  startIdleTimer()
}

function showGuide() {
  if (!canShow.value) return
  visible.value = true
}

function hideGuide() {
  visible.value = false
  markAsShown()
}

function handleInteraction() {
  resetIdleTimer()
}

function resetGuide() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  showGuide()
}

onMounted(() => {
  window.addEventListener('mousemove', handleInteraction)
  window.addEventListener('mousedown', handleInteraction)
  window.addEventListener('keydown', handleInteraction)
  window.addEventListener('touchstart', handleInteraction)
  window.addEventListener('scroll', handleInteraction)

  startIdleTimer()
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleInteraction)
  window.removeEventListener('mousedown', handleInteraction)
  window.removeEventListener('keydown', handleInteraction)
  window.removeEventListener('touchstart', handleInteraction)
  window.removeEventListener('scroll', handleInteraction)

  if (idleTimer) {
    clearTimeout(idleTimer)
  }
})

defineExpose({
  resetGuide,
  showGuide,
  hideGuide,
})
</script>

<template>
  <Transition name="guide-fade">
    <div v-if="visible" class="idle-guide-canvas" @click="hideGuide">
      <div class="guide-overlay"></div>

      <div class="guide-tips">
        <div
          v-for="tip in tips"
          :key="tip.id"
          class="guide-tip"
          :style="{
            top: tip.position.top,
            left: tip.position.left,
            right: tip.position.right,
            bottom: tip.position.bottom,
            animationDelay: tip.delay,
          }"
        >
          <div class="tip-pulse-ring" :style="{ animationDelay: tip.delay }"></div>
          <div class="tip-pulse-ring tip-pulse-ring--second" :style="{ animationDelay: `${parseFloat(tip.delay) + 0.5}s` }"></div>
          <div class="tip-dot"></div>
          <div class="tip-label">{{ tip.text }}</div>
        </div>
      </div>

      <div class="guide-hint">
        <span>移动鼠标或点击任意处关闭</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.idle-guide-canvas {
  position: fixed;
  inset: 0;
  z-index: 9998;
  cursor: pointer;
}

.guide-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.2) 0%,
    rgba(0, 0, 0, 0.5) 100%
  );
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.guide-tips {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.guide-tip {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0;
  animation: tipFadeIn 0.6s ease-out forwards;
}

.guide-tip:nth-child(3),
.guide-tip:nth-child(4) {
  transform: translate(0, -50%);
}

.tip-pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid rgba(244, 210, 138, 0.6);
  transform: translate(-50%, -50%) scale(1);
  opacity: 0;
  animation: pulse 2s ease-out infinite;
  pointer-events: none;
}

.tip-pulse-ring--second {
  animation-delay: 1s !important;
}

.tip-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f4d28a, #d95b67);
  box-shadow: 0 0 20px rgba(244, 210, 138, 0.5);
  z-index: 1;
}

.tip-label {
  padding: 6px 14px;
  background: rgba(20, 20, 28, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  white-space: nowrap;
  opacity: 0.9;
}

.guide-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  animation: hintPulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

@keyframes tipFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.guide-tip:nth-child(3).tip-fade-enter-from,
.guide-tip:nth-child(4).tip-fade-enter-to,
.guide-tip:nth-child(3).tip-fade-leave-from,
.guide-tip:nth-child(4).tip-fade-leave-to {
  transform: translate(0, -50%) scale(0.8);
}

@keyframes hintPulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: opacity 0.5s ease;
}

.guide-fade-enter-from,
.guide-fade-leave-to {
  opacity: 0;
}
</style>
