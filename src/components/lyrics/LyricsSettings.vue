<template>
  <div class="lyrics-settings">
    <div class="settings-section">
      <div class="section-title">歌词预设</div>
      <div class="preset-grid">
        <div
          v-for="preset in lyrics.builtinPresets"
          :key="preset.id"
          class="preset-item"
          :class="{ active: currentPreset === preset.id }"
          @click="applyPreset(preset.id)"
        >
          <div class="preset-preview" :style="getPresetPreviewStyle(preset)">
            <span class="preset-text">Aa</span>
          </div>
          <div class="preset-name">{{ preset.name }}</div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">位置调节</div>
      <div class="slider-group">
        <div class="slider-item">
          <label>上下位置</label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.01"
            :value="lyrics.layout.verticalPosition"
            @input="setLayout('verticalPosition', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ (lyrics.layout.verticalPosition * 100).toFixed(0) }}%</span>
        </div>
        <div class="slider-item">
          <label>左右位置</label>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.01"
            :value="lyrics.layout.horizontalPosition"
            @input="setLayout('horizontalPosition', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ (lyrics.layout.horizontalPosition * 100).toFixed(0) }}%</span>
        </div>
        <div class="slider-item">
          <label>前后景深</label>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            :value="lyrics.layout.depthPosition"
            @input="setLayout('depthPosition', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ (lyrics.layout.depthPosition * 100).toFixed(0) }}</span>
        </div>
        <div class="slider-item">
          <label>上下角度</label>
          <input
            type="range"
            min="-45"
            max="45"
            step="1"
            :value="lyrics.layout.rotationX"
            @input="setLayout('rotationX', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.layout.rotationX }}°</span>
        </div>
        <div class="slider-item">
          <label>左右角度</label>
          <input
            type="range"
            min="-45"
            max="45"
            step="1"
            :value="lyrics.layout.rotationY"
            @input="setLayout('rotationY', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.layout.rotationY }}°</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">外观调节</div>
      <div class="slider-group">
        <div class="slider-item">
          <label>字体大小</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.01"
            :value="lyrics.layout.size"
            @input="setLayout('size', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ (lyrics.layout.size * 100).toFixed(0) }}%</span>
        </div>
        <div class="slider-item">
          <label>字体粗细</label>
          <input
            type="range"
            min="100"
            max="900"
            step="100"
            :value="lyrics.style.fontWeight"
            @input="setStyle('fontWeight', parseInt(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.style.fontWeight }}</span>
        </div>
        <div class="slider-item">
          <label>歌词透明度</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            :value="lyrics.style.opacity"
            @input="setStyle('opacity', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ (lyrics.style.opacity * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <div class="color-group">
        <div class="color-item">
          <label>主色</label>
          <div class="color-input-wrap">
            <input
              type="color"
              :value="lyrics.palette.primary"
              @input="setPalette('primary', ($event.target as HTMLInputElement).value)"
            />
            <span class="color-value">{{ lyrics.palette.primary }}</span>
          </div>
        </div>
        <div class="color-item">
          <label>高亮色</label>
          <div class="color-input-wrap">
            <input
              type="color"
              :value="lyrics.palette.highlight"
              @input="setPalette('highlight', ($event.target as HTMLInputElement).value)"
            />
            <span class="color-value">{{ lyrics.palette.highlight }}</span>
          </div>
        </div>
        <div class="color-item">
          <label>发光色</label>
          <div class="color-input-wrap">
            <input
              type="color"
              :value="lyrics.palette.glow"
              @input="setPalette('glow', ($event.target as HTMLInputElement).value)"
            />
            <span class="color-value">{{ lyrics.palette.glow }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">
        描边效果
        <div class="toggle-switch" :class="{ active: lyrics.stroke.enabled }" @click="toggleStroke">
          <div class="toggle-dot"></div>
        </div>
      </div>
      <div v-if="lyrics.stroke.enabled" class="slider-group">
        <div class="slider-item">
          <label>描边宽度</label>
          <input
            type="range"
            min="0"
            max="8"
            step="0.5"
            :value="lyrics.stroke.width"
            @input="setStroke('width', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.stroke.width }}px</span>
        </div>
        <div class="color-item">
          <label>描边颜色</label>
          <div class="color-input-wrap">
            <input
              type="color"
              :value="rgbaToHex(lyrics.stroke.color)"
              @input="setStroke('color', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">
        发光效果
        <div class="toggle-switch" :class="{ active: lyrics.glow.enabled }" @click="toggleGlow">
          <div class="toggle-dot"></div>
        </div>
      </div>
      <div v-if="lyrics.glow.enabled" class="slider-group">
        <div class="slider-item">
          <label>发光强度</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="lyrics.glow.strength"
            @input="setGlow('strength', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ (lyrics.glow.strength * 100).toFixed(0) }}%</span>
        </div>
        <div class="toggle-item">
          <label>节拍同步</label>
          <div class="toggle-switch" :class="{ active: lyrics.glow.beatSync }" @click="toggleBeatSync">
            <div class="toggle-dot"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">
        阴影效果
        <div class="toggle-switch" :class="{ active: lyrics.shadow.enabled }" @click="toggleShadow">
          <div class="toggle-dot"></div>
        </div>
      </div>
      <div v-if="lyrics.shadow.enabled" class="slider-group">
        <div class="slider-item">
          <label>阴影模糊</label>
          <input
            type="range"
            min="0"
            max="30"
            step="1"
            :value="lyrics.shadow.blur"
            @input="setShadow('blur', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.shadow.blur }}px</span>
        </div>
        <div class="slider-item">
          <label>垂直偏移</label>
          <input
            type="range"
            min="-10"
            max="10"
            step="1"
            :value="lyrics.shadow.offsetY"
            @input="setShadow('offsetY', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.shadow.offsetY }}px</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">动画设置</div>
      <div class="slider-group">
        <div class="slider-item">
          <label>入场时长</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            :value="lyrics.animation.enterDuration"
            @input="setAnimation('enterDuration', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.animation.enterDuration.toFixed(2) }}s</span>
        </div>
        <div class="slider-item">
          <label>退场时长</label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.05"
            :value="lyrics.animation.exitDuration"
            @input="setAnimation('exitDuration', parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="value">{{ lyrics.animation.exitDuration.toFixed(2) }}s</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-title">
        歌词镜头绑定
        <div class="toggle-switch" :class="{ active: lyrics.cameraBind }" @click="toggleCameraBind">
          <div class="toggle-dot"></div>
        </div>
      </div>
      <div class="section-desc">开启后歌词将始终面向镜头</div>
    </div>

    <div class="settings-actions">
      <button class="btn btn-secondary" @click="resetToDefault">重置为默认</button>
      <button class="btn btn-primary" @click="saveCurrentPreset">保存为预设</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLyricsStore } from '@/stores/lyrics'
import type { LyricPreset, LyricPresetConfig, LyricLayoutConfig, LyricStyleConfig, LyricPalette, LyricGlowConfig, LyricStrokeConfig, LyricShadowConfig, LyricAnimationConfig } from '@/modules/lyrics'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const lyrics = useLyricsStore()

const currentPreset = ref<LyricPreset | null>(null)

function applyPreset(presetId: LyricPreset) {
  currentPreset.value = presetId
  lyrics.applyPreset(presetId)
}

function setLayout<K extends keyof LyricLayoutConfig>(key: K, value: LyricLayoutConfig[K]) {
  lyrics.setLayout({ [key]: value } as Partial<LyricLayoutConfig>)
  currentPreset.value = null
}

function setStyle<K extends keyof LyricStyleConfig>(key: K, value: LyricStyleConfig[K]) {
  lyrics.setStyle({ [key]: value } as Partial<LyricStyleConfig>)
  currentPreset.value = null
}

function setPalette<K extends keyof LyricPalette>(key: K, value: LyricPalette[K]) {
  lyrics.setPalette({ [key]: value } as Partial<LyricPalette>)
  currentPreset.value = null
}

function setGlow<K extends keyof LyricGlowConfig>(key: K, value: LyricGlowConfig[K]) {
  lyrics.setGlow({ [key]: value } as Partial<LyricGlowConfig>)
  currentPreset.value = null
}

function setStroke<K extends keyof LyricStrokeConfig>(key: K, value: LyricStrokeConfig[K]) {
  lyrics.setStroke({ [key]: value } as Partial<LyricStrokeConfig>)
  currentPreset.value = null
}

function setShadow<K extends keyof LyricShadowConfig>(key: K, value: LyricShadowConfig[K]) {
  lyrics.setShadow({ [key]: value } as Partial<LyricShadowConfig>)
  currentPreset.value = null
}

function setAnimation<K extends keyof LyricAnimationConfig>(key: K, value: LyricAnimationConfig[K]) {
  lyrics.setAnimation({ [key]: value } as Partial<LyricAnimationConfig>)
  currentPreset.value = null
}

function toggleStroke() {
  lyrics.setStroke({ enabled: !lyrics.stroke.enabled })
  currentPreset.value = null
}

function toggleGlow() {
  lyrics.setGlow({ enabled: !lyrics.glow.enabled })
  currentPreset.value = null
}

function toggleBeatSync() {
  lyrics.setGlow({ beatSync: !lyrics.glow.beatSync })
  currentPreset.value = null
}

function toggleShadow() {
  lyrics.setShadow({ enabled: !lyrics.shadow.enabled })
  currentPreset.value = null
}

function toggleCameraBind() {
  lyrics.setCameraBind(!lyrics.cameraBind)
}

function resetToDefault() {
  lyrics.resetToDefault()
  currentPreset.value = null
}

function saveCurrentPreset() {
  const name = prompt('输入预设名称：', '我的预设')
  if (name) {
    lyrics.savePreset(name, '自定义预设')
  }
}

function getPresetPreviewStyle(preset: LyricPresetConfig) {
  return {
    color: preset.palette?.primary || '#ffffff',
    textShadow: preset.glow?.enabled
      ? `0 0 10px ${preset.palette?.glow || '#ffffff'}`
      : 'none',
    WebkitTextStroke: preset.stroke?.enabled
      ? `${preset.stroke.width || 2}px ${preset.stroke.color || '#000'}`
      : 'none',
  }
}

function rgbaToHex(color: string): string {
  if (color.startsWith('#')) return color
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `#${r}${g}${b}`
  }
  return '#000000'
}
</script>

<style scoped>
.lyrics-settings {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-md);
  transition: all 0.2s;
  border: 2px solid transparent;
}

.preset-item:hover {
  background: var(--color-hover);
}

.preset-item.active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.1);
}

.preset-preview {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin-bottom: 6px;
}

.preset-text {
  font-size: 24px;
  font-weight: 900;
}

.preset-name {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.slider-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slider-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider-item label {
  width: 100px;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.slider-item input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: var(--color-border);
  border-radius: 2px;
  cursor: pointer;
}

.slider-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}

.slider-item .value {
  width: 60px;
  text-align: right;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.color-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-item label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.color-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-input-wrap input[type="color"] {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: transparent;
}

.color-input-wrap input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input-wrap input[type="color"]::-webkit-color-swatch {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.color-value {
  font-size: 11px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.toggle-item label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.toggle-switch {
  width: 40px;
  height: 22px;
  background: var(--color-border);
  border-radius: 11px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: var(--color-primary);
}

.toggle-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-dot {
  transform: translateX(18px);
}

.settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.btn {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-hover);
}
</style>
