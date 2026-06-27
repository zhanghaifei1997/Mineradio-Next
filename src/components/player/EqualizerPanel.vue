<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { EQ_BANDS, getPresetName, type EqPreset } from '@/modules/audio'

const player = usePlayerStore()

const presets: EqPreset[] = ['flat', 'pop', 'rock', 'jazz', 'classical', 'vocal', 'bass']

const localGains = ref<number[]>([...player.equalizerGains])
const isDragging = ref(false)

watch(
  () => player.equalizerGains,
  (newGains) => {
    if (!isDragging.value) {
      localGains.value = [...newGains]
    }
  },
  { deep: true }
)

function formatFreq(freq: number): string {
  if (freq >= 1000) {
    return `${freq / 1000}k`
  }
  return `${freq}`
}

function handleGainInput(index: number, event: Event) {
  const value = parseFloat((event.target as HTMLInputElement).value)
  localGains.value[index] = value
  player.setEqualizerGain(index, value)
}

function handlePresetClick(preset: EqPreset) {
  player.setEqualizerPreset(preset)
  localGains.value = [...player.equalizerGains]
}

function toggleEqualizer() {
  player.setEqualizerEnabled(!player.equalizerEnabled)
}

function resetEqualizer() {
  player.resetEqualizer()
  localGains.value = [...player.equalizerGains]
}

const frequencyResponse = computed(() => {
  return localGains.value
})
</script>

<template>
  <div class="equalizer-panel">
    <div class="eq-header">
      <div class="eq-title">
        <span class="eq-icon">🎚️</span>
        <span>均衡器</span>
      </div>
      <div class="eq-controls">
        <button
          class="toggle-btn"
          :class="{ active: player.equalizerEnabled }"
          @click="toggleEqualizer"
        >
          {{ player.equalizerEnabled ? '开启' : '关闭' }}
        </button>
      </div>
    </div>

    <div class="eq-presets">
      <div class="section-label">预设</div>
      <div class="preset-list">
        <button
          v-for="preset in presets"
          :key="preset"
          class="preset-btn"
          :class="{ active: player.equalizerPreset === preset }"
          @click="handlePresetClick(preset)"
        >
          {{ getPresetName(preset) }}
        </button>
      </div>
    </div>

    <div class="eq-visualizer">
      <svg class="freq-curve" viewBox="0 0 300 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#d95b67;stop-opacity:0.6" />
            <stop offset="100%" style="stop-color:#d95b67;stop-opacity:0.05" />
          </linearGradient>
        </defs>
        <path
          :d="(() => {
            const points = frequencyResponse.map((gain, i) => {
              const x = (i / (frequencyResponse.length - 1)) * 300
              const y = 50 - (gain / 12) * 45
              return `${x},${y}`
            })
            return `M 0,50 L ${points.join(' L ')} L 300,50 Z`
          })()"
          fill="url(#curveGradient)"
        />
        <path
          :d="(() => {
            const points = frequencyResponse.map((gain, i) => {
              const x = (i / (frequencyResponse.length - 1)) * 300
              const y = 50 - (gain / 12) * 45
              return `${x},${y}`
            })
            return `M ${points.join(' L ')}`
          })()"
          fill="none"
          stroke="#d95b67"
          stroke-width="2"
        />
      </svg>
    </div>

    <div class="eq-sliders">
      <div
        v-for="(freq, index) in EQ_BANDS"
        :key="freq"
        class="slider-column"
      >
        <div class="gain-value">{{ localGains[index] > 0 ? '+' : '' }}{{ localGains[index].toFixed(1) }}dB</div>
        <div class="slider-wrapper">
          <input
            type="range"
            min="-12"
            max="12"
            step="0.5"
            :value="localGains[index]"
            :disabled="!player.equalizerEnabled"
            @mousedown="isDragging = true"
            @mouseup="isDragging = false"
            @touchstart="isDragging = true"
            @touchend="isDragging = false"
            @input="handleGainInput(index, $event)"
            class="eq-slider"
          />
        </div>
        <div class="freq-label">{{ formatFreq(freq) }}Hz</div>
      </div>
    </div>

    <div class="eq-footer">
      <button class="reset-btn" @click="resetEqualizer">
        ↺ 重置
      </button>
    </div>
  </div>
</template>

<style scoped>
.equalizer-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.eq-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.eq-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.eq-icon {
  font-size: 18px;
}

.toggle-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  border-color: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.8);
}

.toggle-btn.active {
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.5);
  color: #fff;
}

.eq-presets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.4);
}

.preset-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}

.preset-btn.active {
  background: rgba(217, 91, 103, 0.15);
  border-color: rgba(217, 91, 103, 0.4);
  color: #fff;
}

.eq-visualizer {
  height: 80px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px;
  overflow: hidden;
}

.freq-curve {
  width: 100%;
  height: 100%;
}

.eq-sliders {
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  gap: 4px;
  padding: 0 4px;
}

.slider-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.gain-value {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
  min-width: 40px;
  text-align: center;
}

.slider-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eq-slider {
  -webkit-appearance: none;
  appearance: none;
  writing-mode: vertical-lr;
  direction: rtl;
  width: 8px;
  height: 120px;
  background: transparent;
  cursor: pointer;
}

.eq-slider:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.eq-slider::-webkit-slider-runnable-track {
  width: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.eq-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #d95b67;
  cursor: pointer;
  margin-left: -6px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.freq-label {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
}

.eq-footer {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.reset-btn {
  padding: 6px 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
}
</style>
