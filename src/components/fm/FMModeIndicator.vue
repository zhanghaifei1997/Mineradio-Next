<script setup lang="ts">
import { computed } from 'vue'
import { useFMStore } from '@/stores/fm'

const fm = useFMStore()

const emit = defineEmits<{
  (e: 'toggle'): void
}>()

const pulseScale = computed(() => {
  return fm.isFMMode ? 1 + Math.sin(Date.now() / 500) * 0.05 : 1
})
</script>

<template>
  <div
    class="fm-mode-indicator"
    :class="{ 'fm-mode-indicator--active': fm.isFMMode }"
    @click="emit('toggle')"
  >
    <div class="fm-mode-indicator__icon" :style="{ transform: `scale(${pulseScale})` }">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>

    <div class="fm-mode-indicator__info">
      <div class="fm-mode-indicator__label">
        {{ fm.isFMMode ? '私人FM' : '开启FM' }}
      </div>
      <div v-if="fm.isFMMode && fm.currentSong" class="fm-mode-indicator__song">
        {{ fm.currentSong.name }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.fm-mode-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.fm-mode-indicator:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(217, 91, 103, 0.3);
}

.fm-mode-indicator--active {
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.2), rgba(100, 50, 150, 0.2));
  border-color: rgba(217, 91, 103, 0.5);
  box-shadow: 0 0 20px rgba(217, 91, 103, 0.2);
}

.fm-mode-indicator__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(217, 91, 103, 0.3);
  color: #fff;
  transition: transform 0.08s ease-out;
}

.fm-mode-indicator--active .fm-mode-indicator__icon {
  background: linear-gradient(135deg, #d95b67, #f0a0a0);
  box-shadow: 0 0 12px rgba(217, 91, 103, 0.6);
}

.fm-mode-indicator__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 60px;
}

.fm-mode-indicator__label {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.fm-mode-indicator__song {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
