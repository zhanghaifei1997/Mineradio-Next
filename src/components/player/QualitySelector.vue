<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import type { QualityLevel } from '@/types'

const props = defineProps<{
  showLabel?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', quality: QualityLevel): void
}>()

const player = usePlayerStore()
const showPopup = ref(false)
const popupRef = ref<HTMLElement | null>(null)

const qualityOptions = [
  { id: 'standard' as QualityLevel, name: '标准', bitrate: '128kbps', size: '约 1MB/分钟' },
  { id: 'higher' as QualityLevel, name: '较高', bitrate: '192kbps', size: '约 1.5MB/分钟' },
  { id: 'exhigh' as QualityLevel, name: '极高', bitrate: '320kbps', size: '约 2.5MB/分钟' },
  { id: 'lossless' as QualityLevel, name: '无损', bitrate: 'FLAC', size: '约 8MB/分钟' },
  { id: 'hires' as QualityLevel, name: 'Hi-Res', bitrate: '高解析', size: '约 15MB/分钟' },
]

const currentQualityInfo = computed(() => {
  return qualityOptions.find(q => q.id === player.currentQuality) || qualityOptions[2]
})

function togglePopup() {
  showPopup.value = !showPopup.value
}

async function selectQuality(quality: QualityLevel) {
  if (player.currentSong) {
    await player.switchQuality(quality)
  } else {
    player.setQuality(quality)
  }
  emit('change', quality)
  showPopup.value = false
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
  <div class="quality-selector" ref="popupRef">
    <button
      class="quality-btn"
      @click.stop="togglePopup"
      :title="'当前音质: ' + currentQualityInfo.name"
    >
      <span class="quality-icon">🎵</span>
      <span v-if="showLabel" class="quality-label">{{ currentQualityInfo.name }}</span>
    </button>

    <div v-show="showPopup" class="quality-popup">
      <div class="popup-header">
        <span class="popup-title">音质选择</span>
      </div>
      <div class="quality-list">
        <button
          v-for="q in qualityOptions"
          :key="q.id"
          class="quality-item"
          :class="{ active: player.currentQuality === q.id }"
          @click="selectQuality(q.id)"
        >
          <div class="quality-item__info">
            <span class="quality-item__name">{{ q.name }}</span>
            <span class="quality-item__bitrate">{{ q.bitrate }}</span>
          </div>
          <span class="quality-item__size">{{ q.size }}</span>
          <span v-if="player.currentQuality === q.id" class="quality-item__check">✓</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quality-selector {
  position: relative;
}

.quality-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 16px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.quality-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.quality-label {
  font-size: 12px;
  font-weight: 500;
}

.quality-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 200;
}

.popup-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.popup-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.quality-list {
  padding: 4px 0;
}

.quality-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.quality-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.quality-item.active {
  background: rgba(217, 91, 103, 0.15);
  color: #fff;
}

.quality-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quality-item__name {
  font-size: 13px;
  font-weight: 500;
}

.quality-item__bitrate {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.quality-item__size {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.quality-item__check {
  color: #d95b67;
  font-size: 14px;
  font-weight: 600;
}
</style>
