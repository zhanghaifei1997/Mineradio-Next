<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  onClick?: () => void
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const isDesktop = (window as any).electronAPI?.isDesktop || false

const updateState = ref<any>({
  state: 'idle',
  currentVersion: '',
  latestVersion: null,
  updateAvailable: false,
  downloadProgress: 0,
  extractProgress: 0,
  error: null,
  releaseInfo: null,
})

let removeStateListener: (() => void) | null = null

const showButton = computed(() => {
  if (!isDesktop) return false
  return updateState.value.updateAvailable || 
         updateState.value.state === 'downloading' ||
         updateState.value.state === 'extracting' ||
         updateState.value.state === 'verifying' ||
         updateState.value.state === 'ready'
})

const isDownloading = computed(() => {
  return updateState.value.state === 'downloading' ||
         updateState.value.state === 'extracting' ||
         updateState.value.state === 'verifying'
})

const progress = computed(() => {
  if (updateState.value.state === 'downloading') {
    return updateState.value.downloadProgress || 0
  }
  if (updateState.value.state === 'extracting') {
    return updateState.value.extractProgress || 0
  }
  if (updateState.value.state === 'ready') {
    return 100
  }
  return 0
})

const isReady = computed(() => updateState.value.state === 'ready')

const circumference = 2 * Math.PI * 18

const strokeDashoffset = computed(() => {
  return circumference - (progress.value / 100) * circumference
})

async function loadInitialState() {
  if (!isDesktop) return
  try {
    const state = await (window as any).electronAPI.update.getState()
    if (state) {
      updateState.value = state
    }
  } catch (e) {
    console.warn('Failed to get update state:', e)
  }
}

function handleClick() {
  if (props.onClick) {
    props.onClick()
  }
  emit('click')
}

onMounted(() => {
  loadInitialState()

  if (isDesktop && (window as any).electronAPI?.update?.onStateChanged) {
    removeStateListener = (window as any).electronAPI.update.onStateChanged((state: any) => {
      updateState.value = state
    })
  }
})

onUnmounted(() => {
  if (removeStateListener) {
    removeStateListener()
  }
})
</script>

<template>
  <Transition name="update-fade">
    <button
      v-if="showButton"
      class="update-entry-btn"
      :class="{ 
        'glow': updateState.updateAvailable && !isDownloading && !isReady,
        'downloading': isDownloading,
        'ready': isReady
      }"
      @click="handleClick"
      :title="isReady ? '更新已就绪，点击重启安装' : '有新版本可用，点击查看详情'"
    >
      <svg class="progress-ring" viewBox="0 0 44 44">
        <circle
          class="progress-ring-bg"
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke-width="2"
        />
        <circle
          v-if="isDownloading || isReady"
          class="progress-ring-fill"
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke-width="2"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="strokeDashoffset"
          stroke-linecap="round"
        />
      </svg>
      <span class="update-icon">
        <template v-if="isReady">
          ↻
        </template>
        <template v-else-if="isDownloading">
          ⬇
        </template>
        <template v-else>
          ⬆
        </template>
      </span>
    </button>
  </Transition>
</template>

<style scoped>
.update-entry-btn {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s ease;
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
  overflow: hidden;
}

.update-entry-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
  transform: scale(1.05);
}

.update-entry-btn.glow {
  animation: glowPulse 2s ease-in-out infinite;
  border-color: rgba(217, 91, 103, 0.5);
  color: #d95b67;
}

@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(217, 91, 103, 0.4);
  }
  50% {
    box-shadow: 0 0 16px 4px rgba(217, 91, 103, 0.3);
  }
}

.update-entry-btn.downloading {
  color: #f0a020;
}

.update-entry-btn.ready {
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.5);
  animation: readyPulse 1.5s ease-in-out infinite;
}

@keyframes readyPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4);
  }
  50% {
    box-shadow: 0 0 12px 3px rgba(76, 175, 80, 0.3);
  }
}

.progress-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-bg {
  stroke: rgba(255, 255, 255, 0.1);
}

.progress-ring-fill {
  stroke: #d95b67;
  transition: stroke-dashoffset 0.3s ease;
}

.update-entry-btn.ready .progress-ring-fill {
  stroke: #4caf50;
}

.update-icon {
  position: relative;
  z-index: 1;
  font-weight: bold;
  line-height: 1;
}

.update-fade-enter-active,
.update-fade-leave-active {
  transition: all 0.3s ease;
}

.update-fade-enter-from,
.update-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
