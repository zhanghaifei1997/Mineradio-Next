<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'

const player = usePlayerStore()
const fx = useFxStore()

const depthModes = ['low', 'medium', 'high', 'ultra'] as const
type DepthMode = typeof depthModes[number]

const currentDepthMode = ref<DepthMode>('medium')
const beatPulse = ref(false)
let beatPulseTimer: number | null = null

const beatState = computed(() => {
  if (!player.isPlaying) return 'idle'
  if (player.bpm > 0) return 'locked'
  if (player.isAnalyzing) return 'analyzing'
  return 'detecting'
})

const beatStateText = computed(() => {
  switch (beatState.value) {
    case 'locked': return '已锁定'
    case 'analyzing': return '分析中'
    case 'detecting': return '检测中'
    default: return '无信号'
  }
})

const beatIntensity = computed(() => {
  if (!player.beatState) return 0
  return Math.min(1, player.beatState.bass / 0.8)
})

const bpmDisplay = computed(() => {
  if (player.bpm <= 0) return '--'
  return Math.round(player.bpm)
})

const depthModeText = computed(() => {
  switch (currentDepthMode.value) {
    case 'low': return '浅'
    case 'medium': return '中'
    case 'high': return '深'
    case 'ultra': return '极深'
  }
})

const depthModeIcon = computed(() => {
  switch (currentDepthMode.value) {
    case 'low': return '◉'
    case 'medium': return '◉◉'
    case 'high': return '◉◉◉'
    case 'ultra': return '◉◉◉◉'
  }
})

function toggleDepthMode() {
  const currentIndex = depthModes.indexOf(currentDepthMode.value)
  const nextIndex = (currentIndex + 1) % depthModes.length
  currentDepthMode.value = depthModes[nextIndex]
}

function triggerBeatPulse() {
  beatPulse.value = true
  if (beatPulseTimer) {
    clearTimeout(beatPulseTimer)
  }
  beatPulseTimer = window.setTimeout(() => {
    beatPulse.value = false
  }, 150)
}

let lastBeatTime = 0
function checkBeat() {
  if (!player.beatState) return
  const now = performance.now()
  if (player.beatState.bass > 0.5 && now - lastBeatTime > 300) {
    triggerBeatPulse()
    lastBeatTime = now
  }
}

let rafId: number | null = null
function beatLoop() {
  checkBeat()
  rafId = requestAnimationFrame(beatLoop)
}

onMounted(() => {
  beatLoop()
})

onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
  if (beatPulseTimer) {
    clearTimeout(beatPulseTimer)
  }
})
</script>

<template>
  <div class="status-chips">
    <button
      class="status-chip ai-depth-chip"
      :class="{ 'beat-pulse': beatPulse }"
      @click="toggleDepthMode"
      title="AI 深度模式"
    >
      <span class="chip-icon">🎨</span>
      <span class="chip-text">
        <span class="chip-label">深度</span>
        <span class="chip-value">{{ depthModeText }}</span>
      </span>
      <span class="chip-depth-indicator">
        <span
          v-for="i in 4"
          :key="i"
          class="depth-dot"
          :class="{ active: i <= depthModes.indexOf(currentDepthMode) + 1 }"
        ></span>
      </span>
    </button>

    <div
      class="status-chip beat-chip"
      :class="{
        'beat-pulse': beatPulse,
        'is-locked': beatState === 'locked',
        'is-analyzing': beatState === 'analyzing',
        'is-idle': beatState === 'idle'
      }"
      title="节拍检测"
    >
      <span class="chip-icon">🎵</span>
      <span class="chip-text">
        <span class="chip-label">BPM</span>
        <span class="chip-value">{{ bpmDisplay }}</span>
      </span>
      <span class="beat-indicator">
        <span
          v-for="i in 5"
          :key="i"
          class="beat-bar"
          :style="{ height: `${Math.max(10, beatIntensity * (i * 20) + 10)}%` }"
        ></span>
      </span>
      <span class="chip-status">{{ beatStateText }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: absolute;
  top: 68px;
  right: 24px;
  z-index: 30;
}

.status-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  user-select: none;
}

.status-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.ai-depth-chip {
  border-color: rgba(100, 180, 255, 0.2);
  background: rgba(100, 180, 255, 0.08);
}

.ai-depth-chip:hover {
  border-color: rgba(100, 180, 255, 0.4);
  background: rgba(100, 180, 255, 0.15);
}

.beat-chip {
  border-color: rgba(255, 100, 150, 0.2);
  background: rgba(255, 100, 150, 0.08);
  cursor: default;
}

.beat-chip.is-locked {
  border-color: rgba(100, 255, 150, 0.3);
  background: rgba(100, 255, 150, 0.08);
}

.beat-chip.is-analyzing {
  border-color: rgba(255, 200, 100, 0.3);
  background: rgba(255, 200, 100, 0.08);
}

.beat-chip.is-idle {
  opacity: 0.6;
}

.chip-icon {
  font-size: 14px;
}

.chip-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.chip-label {
  font-size: 10px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chip-value {
  font-size: 13px;
  font-weight: 600;
}

.chip-depth-indicator {
  display: flex;
  gap: 3px;
  margin-left: 4px;
}

.depth-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.depth-dot.active {
  background: #64b4ff;
  box-shadow: 0 0 8px rgba(100, 180, 255, 0.5);
}

.beat-indicator {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;
  margin-left: 4px;
}

.beat-bar {
  width: 3px;
  min-height: 4px;
  border-radius: 2px;
  background: linear-gradient(to top, #ff6496, #ffb4c8);
  transition: height 0.1s ease;
}

.beat-chip.is-locked .beat-bar {
  background: linear-gradient(to top, #64ff96, #b4ffc8);
}

.chip-status {
  font-size: 10px;
  opacity: 0.6;
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.beat-pulse {
  animation: chipPulse 0.15s ease-out;
}

@keyframes chipPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@media (max-width: 768px) {
  .status-chips {
    top: auto;
    bottom: 100px;
    right: 16px;
  }
}
</style>
