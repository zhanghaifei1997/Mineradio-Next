<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTimerStore, type SleepAction } from '@/stores/timer'

const props = defineProps<{
  showLabel?: boolean
}>()

const timer = useTimerStore()
const showPopup = ref(false)
const popupRef = ref<HTMLElement | null>(null)
const customMinutes = ref(30)
const showCustomInput = ref(false)

const presets = [15, 30, 45, 60, 90, 120]

const actions: { id: SleepAction; name: string; icon: string }[] = [
  { id: 'pause', name: '暂停播放', icon: '⏸️' },
  { id: 'quit', name: '退出程序', icon: '🚪' },
  { id: 'shutdown', name: '关闭电脑', icon: '💤' },
]

const timerButtonLabel = computed(() => {
  if (timer.isRunning) {
    return timer.remainingTimeFormatted
  }
  return '⏰'
})

function togglePopup() {
  showPopup.value = !showPopup.value
  if (showPopup.value) {
    showCustomInput.value = false
  }
}

function startPreset(minutes: number) {
  timer.startTimer(minutes)
  showPopup.value = false
}

function startCustom() {
  const mins = Math.max(1, Math.min(300, customMinutes.value))
  timer.startTimer(mins)
  showPopup.value = false
  showCustomInput.value = false
}

function stopTimer() {
  timer.stopTimer()
  showPopup.value = false
}

function setAction(action: SleepAction) {
  timer.setAction(action)
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
  <div class="sleep-timer" ref="popupRef">
    <button
      class="timer-btn"
      :class="{ active: timer.isRunning, fading: timer.isFading }"
      @click.stop="togglePopup"
      :title="timer.isRunning ? '睡眠定时: ' + timer.remainingTimeFormatted : '睡眠定时'"
    >
      <span class="timer-icon">{{ timerButtonLabel }}</span>
      <span v-if="showLabel && timer.isRunning" class="timer-label">
        {{ timer.remainingTimeFormatted }}
      </span>
    </button>

    <div v-show="showPopup" class="timer-popup">
      <div class="popup-header">
        <span class="popup-title">睡眠定时</span>
        <button v-if="timer.isRunning" class="stop-btn" @click="stopTimer">
          取消
        </button>
      </div>

      <div v-if="timer.isRunning" class="timer-status">
        <div class="status-time">{{ timer.remainingTimeFormatted }}</div>
        <div class="status-label">
          {{ timer.isFading ? '音量淡出中...' : '剩余时间' }}
        </div>
      </div>

      <div class="popup-section">
        <div class="section-label">预设时间</div>
        <div class="preset-grid">
          <button
            v-for="p in presets"
            :key="p"
            class="preset-btn"
            :class="{ active: timer.settings.duration === p && !timer.isRunning }"
            @click="startPreset(p)"
          >
            {{ p }}分钟
          </button>
        </div>
      </div>

      <div class="popup-section">
        <div class="section-label">自定义</div>
        <div v-if="!showCustomInput" class="custom-trigger" @click="showCustomInput = true">
          <span>设置自定义时间</span>
          <span class="arrow">›</span>
        </div>
        <div v-else class="custom-input">
          <input
            type="number"
            v-model.number="customMinutes"
            min="1"
            max="300"
            @keyup.enter="startCustom"
          />
          <span class="unit">分钟</span>
          <button class="start-btn" @click="startCustom">开始</button>
        </div>
      </div>

      <div class="popup-section">
        <div class="section-label">到点动作</div>
        <div class="action-list">
          <button
            v-for="a in actions"
            :key="a.id"
            class="action-item"
            :class="{ active: timer.settings.action === a.id }"
            @click="setAction(a.id)"
          >
            <span class="action-icon">{{ a.icon }}</span>
            <span class="action-name">{{ a.name }}</span>
            <span v-if="timer.settings.action === a.id" class="action-check">✓</span>
          </button>
        </div>
      </div>

      <div class="popup-section">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="timer.settings.fadeOut"
            @change="timer.setFadeOut(($event.target as HTMLInputElement).checked)"
          />
          <span>到点前 1 分钟音量淡出</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sleep-timer {
  position: relative;
}

.timer-btn {
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

.timer-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.timer-btn.active {
  color: #d95b67;
}

.timer-btn.fading {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.timer-icon {
  font-size: 16px;
}

.timer-label {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.timer-popup {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  width: 280px;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 200;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.popup-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.stop-btn {
  padding: 4px 10px;
  border: 1px solid rgba(217, 91, 103, 0.4);
  border-radius: 12px;
  background: rgba(217, 91, 103, 0.1);
  color: #d95b67;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.stop-btn:hover {
  background: rgba(217, 91, 103, 0.2);
}

.timer-status {
  padding: 20px 16px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.status-time {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
  margin-bottom: 4px;
}

.status-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.popup-section {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.popup-section:last-child {
  border-bottom: none;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.preset-btn {
  padding: 8px 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.preset-btn.active {
  border-color: rgba(217, 91, 103, 0.6);
  background: rgba(217, 91, 103, 0.15);
  color: #fff;
}

.custom-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.custom-trigger:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.arrow {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}

.custom-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-input input[type='number'] {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  font-size: 13px;
  outline: none;
  width: 80px;
}

.custom-input input[type='number']:focus {
  border-color: rgba(217, 91, 103, 0.5);
}

.custom-input input::-webkit-outer-spin-button,
.custom-input input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.start-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 16px;
  background: #d95b67;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.start-btn:hover {
  background: #e06b77;
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.action-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.action-item.active {
  background: rgba(217, 91, 103, 0.12);
  color: #fff;
}

.action-icon {
  font-size: 16px;
}

.action-name {
  flex: 1;
}

.action-check {
  color: #d95b67;
  font-size: 12px;
  font-weight: 600;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #d95b67;
  cursor: pointer;
}
</style>
