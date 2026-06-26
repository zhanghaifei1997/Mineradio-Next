<script setup lang="ts">
import { ref } from 'vue'
import { useFxStore } from '@/stores/fx'
import type { VisualPreset } from '@/types'

const fx = useFxStore()
const showPanel = ref(false)

const presets: { id: VisualPreset; name: string; icon: string }[] = [
  { id: 'emily', name: 'Emily', icon: '🌸' },
  { id: 'skull', name: 'Skull', icon: '💀' },
  { id: 'galaxy', name: '星河', icon: '🌌' },
  { id: 'vinyl', name: '黑胶', icon: '💿' },
  { id: 'planet', name: '星球', icon: '🪐' },
  { id: 'cylinder', name: '圆柱', icon: '🏛️' },
  { id: 'void', name: '虚空', icon: '🕳️' },
]

const qualityLevels = [
  { id: 'eco', name: '省电' },
  { id: 'balanced', name: '平衡' },
  { id: 'high', name: '高性能' },
  { id: 'ultra', name: '极致' },
]

const bgModes = [
  { id: 'auto', name: '自动' },
  { id: 'keep', name: '保持渲染' },
  { id: 'release', name: '后台释放' },
]
</script>

<template>
  <div class="settings-wrap">
    <button class="settings-fab" @click="showPanel = !showPanel" title="设置">
      ⚙️
    </button>

    <div class="settings-panel" v-if="showPanel">
      <div class="settings-header">
        <h3>视觉设置</h3>
        <button class="close-btn" @click="showPanel = false">✕</button>
      </div>

      <div class="settings-section">
        <div class="section-title">视觉预设</div>
        <div class="preset-grid">
          <button
            v-for="p in presets"
            :key="p.id"
            class="preset-item"
            :class="{ active: fx.settings.preset === p.id }"
            @click="fx.update('preset', p.id)"
          >
            <span class="preset-icon">{{ p.icon }}</span>
            <span class="preset-name">{{ p.name }}</span>
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">性能设置</div>
        <div class="setting-row">
          <label>性能等级</label>
          <div class="segmented">
            <button
              v-for="q in qualityLevels"
              :key="q.id"
              class="seg-btn"
              :class="{ active: fx.settings.performanceQuality === q.id }"
              @click="fx.update('performanceQuality', q.id as any)"
            >
              {{ q.name }}
            </button>
          </div>
        </div>
        <div class="setting-row">
          <label>粒子密度: {{ Math.round(fx.settings.particleResolution * 100) }}%</label>
          <input
            type="range"
            min="0.2"
            max="2"
            step="0.1"
            :value="fx.settings.particleResolution"
            @input="fx.update('particleResolution', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="setting-row">
          <label>动感强度: {{ Math.round(fx.settings.cinemaIntensity * 100) }}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="fx.settings.cinemaIntensity"
            @input="fx.update('cinemaIntensity', parseFloat(($event.target as HTMLInputElement).value))"
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">颜色</div>
        <div class="setting-row">
          <label>主题色</label>
          <input
            type="color"
            :value="fx.settings.accentColor"
            @input="fx.update('accentColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="setting-row">
          <label>辉光色</label>
          <input
            type="color"
            :value="fx.settings.glowColor"
            @input="fx.update('glowColor', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">后台模式</div>
        <div class="segmented">
          <button
            v-for="b in bgModes"
            :key="b.id"
            class="seg-btn"
            :class="{ active: fx.settings.performanceBackground === b.id }"
            @click="fx.update('performanceBackground', b.id as any)"
          >
            {{ b.name }}
          </button>
        </div>
      </div>

      <div class="settings-footer">
        <button class="reset-btn" @click="fx.reset()">恢复默认</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-wrap {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 50;
}

.settings-fab {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(15, 15, 20, 0.8);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.settings-fab:hover {
  background: rgba(30, 30, 40, 0.9);
  transform: rotate(30deg);
}

.settings-panel {
  position: absolute;
  top: 56px;
  right: 0;
  width: 320px;
  max-height: 70vh;
  overflow-y: auto;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.settings-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.close-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  border-radius: 50%;
  font-size: 14px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.settings-section {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.preset-item.active {
  border-color: rgba(217, 91, 103, 0.6);
  background: rgba(217, 91, 103, 0.1);
}

.preset-icon {
  font-size: 18px;
}

.preset-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.setting-row input[type='range'] {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  outline: none;
}

.setting-row input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #d95b67;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.setting-row input[type='color'] {
  width: 40px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  padding: 2px;
}

.segmented {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 2px;
}

.seg-btn {
  flex: 1;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.seg-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

.seg-btn.active {
  background: rgba(217, 91, 103, 0.8);
  color: #fff;
}

.settings-footer {
  padding: 12px 16px;
  text-align: center;
}

.reset-btn {
  padding: 6px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}
</style>
