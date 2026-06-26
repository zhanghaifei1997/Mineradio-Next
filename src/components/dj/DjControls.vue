<script setup lang="ts">
import { computed } from 'vue'
import { useDjStore } from '@/stores/dj'
import { useFxStore } from '@/stores/fx'

const dj = useDjStore()
const fx = useFxStore()

const intensityPercent = computed(() => Math.round(dj.djConfig.intensity * 100))
const visualBoostPercent = computed(() => Math.round(dj.djConfig.visualBoost * 100))

function onIntensityChange(e: Event) {
  const target = e.target as HTMLInputElement
  dj.updateDjConfig({ intensity: Number(target.value) / 100 })
}

function onVisualBoostChange(e: Event) {
  const target = e.target as HTMLInputElement
  dj.updateDjConfig({ visualBoost: 1 + (Number(target.value) - 50) / 50 })
}

function toggleAutoTransition() {
  dj.updateDjConfig({ autoTransition: !dj.djConfig.autoTransition })
}

function toggleCameraShake() {
  dj.updateDjConfig({ cameraShake: !dj.djConfig.cameraShake })
}

function toggleParticleBoost() {
  dj.updateDjConfig({ particleBoost: !dj.djConfig.particleBoost })
}
</script>

<template>
  <div class="dj-controls">
    <div class="dj-controls__header">
      <h3>DJ 模式设置</h3>
      <div
        class="dj-toggle"
        :class="{ 'dj-toggle--active': dj.isDjModeActive }"
        @click="dj.toggleDjMode()"
      >
        <div class="dj-toggle__thumb"></div>
      </div>
    </div>

    <div class="dj-controls__section">
      <div class="control-row">
        <span class="control-label">强度</span>
        <span class="control-value">{{ intensityPercent }}%</span>
      </div>
      <input
        type="range"
        class="slider"
        min="0"
        max="100"
        :value="intensityPercent"
        @input="onIntensityChange"
      />
    </div>

    <div class="dj-controls__section">
      <div class="control-row">
        <span class="control-label">视觉增强</span>
        <span class="control-value">{{ visualBoostPercent }}%</span>
      </div>
      <input
        type="range"
        class="slider"
        min="0"
        max="100"
        :value="visualBoostPercent"
        @input="onVisualBoostChange"
      />
    </div>

    <div class="dj-controls__section">
      <div
        class="toggle-option"
        :class="{ 'toggle-option--active': dj.djConfig.autoTransition }"
        @click="toggleAutoTransition"
      >
        <span class="toggle-option__label">自动过渡</span>
        <div class="toggle-option__switch">
          <div class="toggle-option__thumb"></div>
        </div>
      </div>

      <div
        class="toggle-option"
        :class="{ 'toggle-option--active': dj.djConfig.cameraShake }"
        @click="toggleCameraShake"
      >
        <span class="toggle-option__label">镜头抖动</span>
        <div class="toggle-option__switch">
          <div class="toggle-option__thumb"></div>
        </div>
      </div>

      <div
        class="toggle-option"
        :class="{ 'toggle-option--active': dj.djConfig.particleBoost }"
        @click="toggleParticleBoost"
      >
        <span class="toggle-option__label">粒子增强</span>
        <div class="toggle-option__switch">
          <div class="toggle-option__thumb"></div>
        </div>
      </div>
    </div>

    <div class="dj-controls__section dj-controls__stats">
      <div class="stat-row">
        <span class="stat-label">节拍能量</span>
        <div class="stat-bar">
          <div
            class="stat-bar__fill"
            :style="{ width: Math.min(100, dj.djMode.sectionEnergy * 100) + '%' }"
          ></div>
        </div>
      </div>
      <div class="stat-row">
        <span class="stat-label">低频强度</span>
        <div class="stat-bar">
          <div
            class="stat-bar__fill stat-bar__fill--low"
            :style="{ width: Math.min(100, dj.djMode.sectionLow * 100) + '%' }"
          ></div>
        </div>
      </div>
      <div class="stat-row">
        <span class="stat-label">节拍置信</span>
        <div class="stat-bar">
          <div
            class="stat-bar__fill stat-bar__fill--conf"
            :style="{ width: Math.min(100, dj.djMode.tempoConfidence * 100) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <div v-if="dj.analyzing" class="dj-controls__analyzing">
      <div class="analyzing-spinner"></div>
      <span>正在分析音频...</span>
    </div>
  </div>
</template>

<style scoped>
.dj-controls {
  background: rgba(15, 15, 20, 0.95);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 280px;
}

.dj-controls__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dj-controls__header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.dj-toggle {
  width: 48px;
  height: 26px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 13px;
  position: relative;
  cursor: pointer;
  transition: background 0.3s ease;
}

.dj-toggle--active {
  background: linear-gradient(135deg, #d95b67, #f0a0a0);
  box-shadow: 0 0 12px rgba(217, 91, 103, 0.5);
}

.dj-toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.3s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.dj-toggle--active .dj-toggle__thumb {
  transform: translateX(22px);
}

.dj-controls__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.control-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.control-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.slider {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #d95b67;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(217, 91, 103, 0.4);
  transition: transform 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #d95b67;
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(217, 91, 103, 0.4);
}

.toggle-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.toggle-option:hover {
  opacity: 0.8;
}

.toggle-option__label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.toggle-option__switch {
  width: 36px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  position: relative;
  transition: background 0.3s ease;
}

.toggle-option--active .toggle-option__switch {
  background: rgba(217, 91, 103, 0.5);
}

.toggle-option__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  transition: transform 0.3s ease;
}

.toggle-option--active .toggle-option__thumb {
  transform: translateX(16px);
  background: #fff;
}

.dj-controls__stats {
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 60px;
}

.stat-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  overflow: hidden;
}

.stat-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
  border-radius: 2px;
  transition: width 0.1s ease-out;
}

.stat-bar__fill--low {
  background: linear-gradient(90deg, #5b8fd9, #a0c0f0);
}

.stat-bar__fill--conf {
  background: linear-gradient(90deg, #5bd9a0, #a0f0c0);
}

.dj-controls__analyzing {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  background: rgba(217, 91, 103, 0.1);
  border-radius: 10px;
  font-size: 13px;
  color: #d95b67;
}

.analyzing-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(217, 91, 103, 0.3);
  border-top-color: #d95b67;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
