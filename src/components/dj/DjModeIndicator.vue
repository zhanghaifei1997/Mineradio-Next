<script setup lang="ts">
import { computed } from 'vue'
import { useDjStore } from '@/stores/dj'

const dj = useDjStore()

const pulseScale = computed(() => {
  return 1 + dj.djMode.visualPulse * 0.3
})

const energyPercent = computed(() => {
  return Math.min(100, dj.djMode.sectionEnergy * 100)
})

const confidencePercent = computed(() => {
  return Math.min(100, dj.djMode.tempoConfidence * 100)
})
</script>

<template>
  <div
    class="dj-mode-indicator"
    :class="{ 'dj-mode-indicator--active': dj.isDjModeActive }"
    @click="dj.toggleDjMode()"
  >
    <div class="dj-mode-indicator__icon" :style="{ transform: `scale(${pulseScale})` }">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>

    <div class="dj-mode-indicator__info" v-if="dj.isDjModeActive">
      <div class="dj-mode-indicator__label">DJ 模式</div>
      <div class="dj-mode-indicator__meters">
        <div class="dj-meter">
          <span class="dj-meter__label">能量</span>
          <div class="dj-meter__bar">
            <div
              class="dj-meter__fill"
              :style="{ width: energyPercent + '%' }"
            ></div>
          </div>
        </div>
        <div class="dj-meter">
          <span class="dj-meter__label">节拍</span>
          <div class="dj-meter__bar">
            <div
              class="dj-meter__fill dj-meter__fill--confidence"
              :style="{ width: confidencePercent + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    <div class="dj-mode-indicator__info" v-else>
      <div class="dj-mode-indicator__label">开启 DJ 模式</div>
    </div>
  </div>
</template>

<style scoped>
.dj-mode-indicator {
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

.dj-mode-indicator:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(217, 91, 103, 0.3);
}

.dj-mode-indicator--active {
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.2), rgba(100, 50, 150, 0.2));
  border-color: rgba(217, 91, 103, 0.5);
  box-shadow: 0 0 20px rgba(217, 91, 103, 0.2);
}

.dj-mode-indicator__icon {
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

.dj-mode-indicator--active .dj-mode-indicator__icon {
  background: linear-gradient(135deg, #d95b67, #f0a0a0);
  box-shadow: 0 0 12px rgba(217, 91, 103, 0.6);
}

.dj-mode-indicator__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 80px;
}

.dj-mode-indicator__label {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.dj-mode-indicator__meters {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dj-meter {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dj-meter__label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 24px;
}

.dj-meter__bar {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  min-width: 40px;
}

.dj-meter__fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
  border-radius: 2px;
  transition: width 0.1s ease-out;
}

.dj-meter__fill--confidence {
  background: linear-gradient(90deg, #5b8fd9, #a0c0f0);
}
</style>
