<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'mineradio_idle_guide_shown'
const IDLE_TIMEOUT = 30000

const visible = ref(false)
const currentTipIndex = ref(0)
let idleTimer: number | null = null

const tips = [
  {
    id: 'shelf',
    text: '右键打开歌单架',
    icon: '📚',
    position: { top: '50%', left: '50%' }
  },
  {
    id: 'search',
    text: '点击顶部搜索栏搜索音乐',
    icon: '🔍',
    position: { top: '80px', left: '50%' }
  },
  {
    id: 'controls',
    text: '底部控制栏播放音乐',
    icon: '🎵',
    position: { bottom: '100px', left: '50%' }
  },
  {
    id: 'visual',
    text: '点击右上角切换视觉效果',
    icon: '🎨',
    position: { top: '80px', right: '150px' }
  }
]

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
    if (!hasShownBefore()) {
      showGuide()
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
  visible.value = true
  currentTipIndex.value = 0
  startTipRotation()
}

function hideGuide() {
  visible.value = false
  markAsShown()
  stopTipRotation()
}

let tipInterval: number | null = null

function startTipRotation() {
  stopTipRotation()
  tipInterval = window.setInterval(() => {
    currentTipIndex.value = (currentTipIndex.value + 1) % tips.length
  }, 3000)
}

function stopTipRotation() {
  if (tipInterval) {
    clearInterval(tipInterval)
    tipInterval = null
  }
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
  stopTipRotation()
})

defineExpose({
  resetGuide,
  showGuide,
  hideGuide
})
</script>

<template>
  <Transition name="guide-fade">
    <div v-if="visible" class="idle-guide-canvas" @click="hideGuide">
      <div class="guide-overlay"></div>
      
      <div class="guide-tips">
        <TransitionGroup name="tip-fade">
          <div
            v-for="(tip, index) in tips"
            :key="tip.id"
            v-show="index === currentTipIndex"
            class="guide-tip"
            :style="{
              top: tip.position.top,
              left: tip.position.left,
              right: tip.position.right,
              bottom: tip.position.bottom,
            }"
          >
            <div class="tip-icon">{{ tip.icon }}</div>
            <div class="tip-text">{{ tip.text }}</div>
            <div class="tip-pulse"></div>
          </div>
        </TransitionGroup>
      </div>

      <div class="guide-hint">
        <span>点击任意处关闭</span>
        <div class="guide-dots">
          <span
            v-for="(_, i) in tips"
            :key="i"
            class="guide-dot"
            :class="{ active: i === currentTipIndex }"
          ></span>
        </div>
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
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.7) 100%
  );
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.guide-tips {
  position: absolute;
  inset: 0;
}

.guide-tip {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.guide-tip:nth-child(4) {
  transform: translate(0, -50%);
}

.tip-icon {
  font-size: 48px;
  animation: tipBounce 2s ease-in-out infinite;
}

.tip-text {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  color: white;
  font-size: 15px;
  font-weight: 500;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  white-space: nowrap;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.tip-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
  animation: tipPulse 2s ease-out infinite;
  pointer-events: none;
}

.guide-hint {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.guide-dots {
  display: flex;
  gap: 8px;
}

.guide-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transition: all 0.3s ease;
}

.guide-dot.active {
  background: white;
  width: 20px;
  border-radius: 3px;
}

@keyframes tipBounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes tipPulse {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.8);
    opacity: 0;
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

.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.tip-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.tip-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.1);
}

.guide-tip:nth-child(4).tip-fade-enter-from,
.guide-tip:nth-child(4).tip-fade-leave-to {
  transform: translate(0, -50%) scale(0.8);
}

.guide-tip:nth-child(4).tip-fade-leave-to {
  transform: translate(0, -50%) scale(1.1);
}
</style>
