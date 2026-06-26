<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const showPopup = ref(false)
const popupRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)

const volumePercent = computed(() => Math.round((player.muted ? 0 : player.volume) * 100))

function togglePopup() {
  showPopup.value = !showPopup.value
}

function toggleMute() {
  player.toggleMute()
}

function handleVolumeBarClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
  player.setVolume(percent)
  if (player.muted) {
    player.toggleMute()
  }
}

function handleVolumeDragStart(e: MouseEvent) {
  isDragging.value = true
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
  player.setVolume(percent)
  if (player.muted) {
    player.toggleMute()
  }

  function onMouseMove(e: MouseEvent) {
    const rect = target.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    player.setVolume(percent)
  }

  function onMouseUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function handleClickOutside(e: MouseEvent) {
  if (popupRef.value && !popupRef.value.contains(e.target as Node)) {
    showPopup.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="volume-popover" ref="popupRef">
    <button
      class="volume-btn"
      @click.stop="togglePopup"
      :title="player.muted ? '取消静音' : '音量'"
    >
      <span class="volume-icon">{{ player.muted ? '🔇' : player.volume > 0.5 ? '🔊' : '🔉' }}</span>
    </button>

    <div v-show="showPopup" class="volume-popup">
      <div class="volume-popup__header">
        <span class="volume-popup__percent">{{ volumePercent }}%</span>
      </div>
      <div
        class="volume-popup__bar"
        :class="{ 'is-dragging': isDragging }"
        @mousedown="handleVolumeDragStart"
      >
        <div
          class="volume-popup__fill"
          :style="{ height: (player.muted ? 0 : player.volume * 100) + '%' }"
        ></div>
        <div
          class="volume-popup__thumb"
          :style="{ bottom: (player.muted ? 0 : player.volume * 100) + '%' }"
        ></div>
      </div>
      <button
        class="volume-popup__mute-btn"
        :class="{ 'is-muted': player.muted }"
        @click="toggleMute"
      >
        <span>{{ player.muted ? '🔇 取消静音' : '🔊 静音' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.volume-popover {
  position: relative;
}

.volume-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.volume-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.volume-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  padding: 12px 8px;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.volume-popup__header {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
}

.volume-popup__bar {
  position: relative;
  width: 6px;
  height: 120px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  cursor: pointer;
  overflow: visible;
}

.volume-popup__bar.is-dragging {
  cursor: grabbing;
}

.volume-popup__bar.is-dragging .volume-popup__thumb {
  transform: translateX(-50%) scale(1.3);
}

.volume-popup__fill {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: linear-gradient(to top, #d95b67, #f4d28a);
  border-radius: 3px;
  transition: height 0.05s linear;
}

.volume-popup__thumb {
  position: absolute;
  left: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translateX(-50%) translateY(50%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.volume-popup__bar:hover .volume-popup__thumb {
  transform: translateX(-50%) translateY(50%) scale(1.2);
}

.volume-popup__mute-btn {
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.volume-popup__mute-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.volume-popup__mute-btn.is-muted {
  background: rgba(217, 91, 103, 0.2);
  color: #f0a0a0;
}
</style>
