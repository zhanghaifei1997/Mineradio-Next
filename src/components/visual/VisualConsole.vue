<template>
  <Transition name="console-fade">
    <div v-if="visible" class="visual-console" :style="consoleStyle" @mousedown.stop="startDrag">
      <div class="console-header">
        <button
          class="auto-hide-btn"
          @click.stop="toggleAutoHide"
          :title="fx.fxFabAutoHide ? '取消自动隐藏' : '自动隐藏'"
        >
          {{ fx.fxFabAutoHide ? '›' : '‹' }}
        </button>
        <div class="console-title">
          <span class="title-icon">🎨</span>
          <span class="title-text">视觉控制台</span>
        </div>
        <div class="console-actions">
          <button class="icon-btn" @click.stop="toggleMinimize" :title="minimized ? '展开' : '收起'">
            {{ minimized ? '▽' : '△' }}
          </button>
          <button class="icon-btn" @click.stop="$emit('close')" title="关闭">
            ✕
          </button>
        </div>
      </div>

      <div v-if="!minimized" class="console-body">
        <div class="console-sidebar">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="sidebar-tab"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.name }}</span>
          </div>
        </div>

        <div class="console-content">
          <div v-show="activeTab === 'preset'" class="content-panel">
            <div class="panel-title">视觉预设</div>
            <div class="preset-grid">
              <div
                v-for="preset in presets"
                :key="preset.id"
                class="preset-card"
                :class="{ active: fx.preset === preset.id }"
                @click="setPreset(preset.id)"
              >
                <div class="preset-icon">{{ preset.icon }}</div>
                <div class="preset-name">{{ preset.name }}</div>
                <div class="preset-desc">{{ preset.description }}</div>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'appearance'" class="content-panel">
            <div class="panel-title">外观调节</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>粒子分辨率</label>
                <input
                  type="range"
                  min="0.75"
                  max="1.55"
                  step="0.01"
                  :value="fx.particleResolution"
                  @input="fx.update('particleResolution', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ fx.particleCountLabel }}</span>
              </div>
              <div class="setting-item">
                <label>粒子大小</label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.01"
                  :value="fx.settings.particleSize"
                  @input="fx.update('particleSize', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.particleSize * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>视觉强度</label>
                <input
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.01"
                  :value="fx.settings.visualIntensity"
                  @input="fx.update('visualIntensity', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.visualIntensity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>整体亮度</label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  :value="fx.settings.brightness"
                  @input="fx.update('brightness', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.brightness * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>对比度</label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  :value="fx.settings.contrast"
                  @input="fx.update('contrast', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.contrast * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <div class="panel-subtitle">颜色设置</div>
            <div class="color-row">
              <div class="color-item">
                <label>高亮色</label>
                <div class="color-swatch-wrapper">
                  <div
                    class="color-swatch"
                    :style="{ backgroundColor: fx.accentColor }"
                    @click="openColorLab('accent', $event)"
                  ></div>
                  <div class="color-actions">
                    <button class="color-action-btn" @click="openCoverPicker('accent')" title="封面取色">🖼️</button>
                    <button class="color-action-btn" @click="openColorLab('accent', $event)" title="颜色实验室">🎨</button>
                  </div>
                </div>
              </div>
              <div class="color-item">
                <label>发光色</label>
                <div class="color-swatch-wrapper">
                  <div
                    class="color-swatch"
                    :style="{ backgroundColor: fx.glowColor }"
                    @click="openColorLab('glow', $event)"
                  ></div>
                  <div class="color-actions">
                    <button class="color-action-btn" @click="openCoverPicker('glow')" title="封面取色">🖼️</button>
                    <button class="color-action-btn" @click="openColorLab('glow', $event)" title="颜色实验室">🎨</button>
                  </div>
                </div>
              </div>
              <div class="color-item">
                <label>背景色</label>
                <div class="color-swatch-wrapper">
                  <div
                    class="color-swatch"
                    :style="{ backgroundColor: fx.settings.bgColor }"
                    @click="openColorLab('bg', $event)"
                  ></div>
                  <div class="color-actions">
                    <button class="color-action-btn" @click="openCoverPicker('bg')" title="封面取色">🖼️</button>
                    <button class="color-action-btn" @click="openColorLab('bg', $event)" title="颜色实验室">🎨</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="setting-item">
              <label>封面取色</label>
              <div class="toggle-switch" :class="{ active: fx.settings.coverColorEnabled }" @click="toggleCoverColor">
                <div class="toggle-dot"></div>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'lyrics'" class="content-panel">
            <div class="panel-title">歌词设置</div>
            <div class="setting-item">
              <label>舞台歌词</label>
              <div class="toggle-switch" :class="{ active: lyrics.stageEnabled }" @click="toggleStageLyrics">
                <div class="toggle-dot"></div>
              </div>
            </div>
            <div class="setting-item">
              <label>歌词发光</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="lyrics.glow.strength"
                @input="lyrics.setGlow({ strength: parseFloat(($event.target as HTMLInputElement).value) })"
              />
              <span class="value">{{ (lyrics.glow.strength * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>歌词大小</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.01"
                :value="lyrics.layout.size"
                @input="lyrics.setLayout({ size: parseFloat(($event.target as HTMLInputElement).value) })"
              />
              <span class="value">{{ (lyrics.layout.size * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>上下位置</label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.01"
                :value="lyrics.layout.verticalPosition"
                @input="lyrics.setLayout({ verticalPosition: parseFloat(($event.target as HTMLInputElement).value) })"
              />
              <span class="value">{{ (lyrics.layout.verticalPosition * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>歌词镜头绑定</label>
              <div class="toggle-switch" :class="{ active: lyrics.cameraBind }" @click="toggleCameraBind">
                <div class="toggle-dot"></div>
              </div>
            </div>
            <div class="panel-subtitle">歌词预设</div>
            <div class="lyric-preset-row">
              <button
                v-for="preset in lyrics.builtinPresets"
                :key="preset.id"
                class="lyric-preset-btn"
                @click="lyrics.applyPreset(preset.id)"
              >
                {{ preset.name }}
              </button>
            </div>
          </div>

          <div v-show="activeTab === 'dynamic'" class="content-panel">
            <div class="panel-title">动态效果</div>
            <div class="setting-group">
              <div class="setting-item">
                <label>镜头模式</label>
                <div class="select-group">
                  <button
                    v-for="mode in cinemaModes"
                    :key="mode.id"
                    class="select-btn"
                    :class="{ active: fx.cinemaMode === mode.id }"
                    @click="fx.update('cinemaMode', mode.id)"
                  >
                    {{ mode.name }}
                  </button>
                </div>
              </div>
              <div class="setting-item">
                <label>镜头强度</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="fx.cinemaIntensity"
                  @input="fx.update('cinemaIntensity', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.cinemaIntensity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>节拍响应</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="fx.settings.beatResponseStrength"
                  @input="fx.update('beatResponseStrength', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.beatResponseStrength * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <label>粒子运动速度</label>
                <input
                  type="range"
                  min="0.2"
                  max="2"
                  step="0.01"
                  :value="fx.settings.particleMotionSpeed"
                  @input="fx.update('particleMotionSpeed', parseFloat(($event.target as HTMLInputElement).value))"
                />
                <span class="value">{{ (fx.settings.particleMotionSpeed * 100).toFixed(0) }}%</span>
              </div>
            </div>
          </div>

          <div v-show="activeTab === 'advanced'" class="content-panel">
            <div class="panel-title">高级设置</div>
            <div class="panel-subtitle">自由相机</div>
            <div class="setting-item">
              <label>自由相机模式</label>
              <div class="toggle-switch" :class="{ active: fx.freeCameraEnabled }" @click="toggleFreeCamera">
                <div class="toggle-dot"></div>
              </div>
            </div>
            <div class="setting-hint">快捷键：<kbd>F</kbd> 切换 · 右键拖拽旋转 · 滚轮缩放 · WASD 移动 · 空格重置</div>
            <div class="panel-subtitle">性能档位</div>
            <div class="select-group">
              <button
                v-for="quality in qualityLevels"
                :key="quality.id"
                class="select-btn"
                :class="{ active: fx.performanceQuality === quality.id }"
                @click="setPerformanceQuality(quality.id)"
              >
                {{ quality.name }}
              </button>
            </div>
            <div class="panel-subtitle">后台策略</div>
            <div class="select-group">
              <button
                v-for="mode in bgModes"
                :key="mode.id"
                class="select-btn"
                :class="{ active: fx.performanceBackground === mode.id }"
                @click="setBackgroundMode(mode.id)"
              >
                {{ mode.name }}
              </button>
            </div>
            <div class="panel-subtitle">歌单架</div>
            <div class="setting-item">
              <label>歌单架模式</label>
              <div class="select-group">
                <button
                  v-for="mode in shelfModes"
                  :key="mode.id"
                  class="select-btn"
                  :class="{ active: fx.shelfMode === mode.id }"
                  @click="fx.update('shelfMode', mode.id)"
                >
                  {{ mode.name }}
                </button>
              </div>
            </div>
            <div class="panel-subtitle">控制台玻璃</div>
            <div class="setting-item">
              <label>色调</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="fx.settings.consoleTint"
                @input="fx.update('consoleTint', parseFloat(($event.target as HTMLInputElement).value))"
              />
              <span class="value">{{ (fx.settings.consoleTint * 100).toFixed(0) }}%</span>
            </div>
            <div class="setting-item">
              <label>透明度</label>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.01"
                :value="fx.settings.consoleOpacity"
                @input="fx.update('consoleOpacity', parseFloat(($event.target as HTMLInputElement).value))"
              />
              <span class="value">{{ (fx.settings.consoleOpacity * 100).toFixed(0) }}%</span>
            </div>
            <div class="panel-subtitle">存档槽位</div>
            <div class="archive-slots">
              <button
                v-for="i in 4"
                :key="i"
                class="archive-slot"
                @click="handleArchiveSlot(i)"
                @contextmenu.prevent="saveToSlot(i)"
              >
                槽位 {{ i }}
              </button>
            </div>
            <div class="setting-actions">
              <button class="btn btn-reset" @click="resetSettings">重置为默认</button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="minimized" class="console-minimized" @click.stop="toggleMinimize">
        <span>🎨 视觉控制台</span>
        <span class="expand-hint">点击展开</span>
      </div>
    </div>
  </Transition>

  <ColorLab
    v-if="colorLabVisible"
    v-model="currentColorLabColor"
    :visible="colorLabVisible"
    :style="{ top: colorLabPosition.top + 'px', left: colorLabPosition.left + 'px', position: 'fixed' }"
    @update:model-value="handleColorLabUpdate"
    @confirm="handleColorLabConfirm"
    @cancel="handleColorLabCancel"
  />

  <CoverColorPicker
    :visible="coverPickerVisible"
    :target-color="coverPickerTarget"
    @confirm="handleCoverPickerConfirm"
    @cancel="handleCoverPickerCancel"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { usePerformanceStore } from '@/stores/performance'
import ColorLab from '@/components/color/ColorLab.vue'
import CoverColorPicker from '@/components/color/CoverColorPicker.vue'
import type { VisualPreset, PerformanceQuality, PerformanceBackgroundMode, CinemaMode, ShelfMode } from '@/types'

interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const fx = useFxStore()
const lyrics = useLyricsStore()
const performance = usePerformanceStore()

const activeTab = ref<'preset' | 'appearance' | 'lyrics' | 'dynamic' | 'advanced'>('preset')
const minimized = ref(false)
const position = ref({ x: 20, y: 80 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

const colorLabVisible = ref(false)
const colorLabTarget = ref<'accent' | 'glow' | 'bg'>('accent')
const colorLabPosition = ref({ top: 0, left: 0 })
const coverPickerVisible = ref(false)
const coverPickerTarget = ref<'accent' | 'glow' | 'bg'>('accent')

const currentColorLabColor = computed(() => {
  switch (colorLabTarget.value) {
    case 'accent': return fx.accentColor
    case 'glow': return fx.glowColor
    case 'bg': return fx.settings.bgColor
    default: return fx.accentColor
  }
})

function toggleAutoHide() {
  fx.fxFabAutoHide = !fx.fxFabAutoHide
}

const tabs = [
  { id: 'preset' as const, name: '预设', icon: '✨' },
  { id: 'appearance' as const, name: '外观', icon: '🎨' },
  { id: 'lyrics' as const, name: '歌词', icon: '🎤' },
  { id: 'dynamic' as const, name: '动态', icon: '💫' },
  { id: 'advanced' as const, name: '高级', icon: '⚙️' },
]

const presets = [
  { id: 'emily', name: 'Emily', icon: '🌸', description: '经典粒子效果' },
  { id: 'galaxy', name: '星河', icon: '🌌', description: '旋转的星系' },
  { id: 'vinyl', name: '黑胶', icon: '💿', description: '复古黑胶唱片' },
  { id: 'planet', name: '星球', icon: '🪐', description: '行星轨道' },
  { id: 'skull', name: '安魂', icon: '💀', description: '骷髅效果' },
  { id: 'aurora', name: '极光', icon: '🌈', description: '流动彩色光带' },
  { id: 'starry', name: '星空', icon: '⭐', description: '深邃星空闪烁' },
  { id: 'ocean', name: '海洋', icon: '🌊', description: '波浪起伏海底' },
  { id: 'flame', name: '火焰', icon: '🔥', description: '燃烧的火焰' },
  { id: 'matrix', name: '矩阵', icon: '💻', description: '数字雨效果' },
  { id: 'void', name: '虚空', icon: '🕳️', description: '极简虚空' },
  { id: 'podcast', name: '播客', icon: '🎙️', description: '舒缓长时聆听' },
]

const cinemaModes = [
  { id: 'static' as CinemaMode, name: '静态' },
  { id: 'breathing' as CinemaMode, name: '呼吸' },
  { id: 'cinema' as CinemaMode, name: '电影' },
  { id: 'dynamic' as CinemaMode, name: '动态' },
]

const qualityLevels = [
  { id: 'eco' as PerformanceQuality, name: '省电' },
  { id: 'balanced' as PerformanceQuality, name: '平衡' },
  { id: 'high' as PerformanceQuality, name: '高性能' },
  { id: 'ultra' as PerformanceQuality, name: '极致' },
]

const bgModes = [
  { id: 'auto' as PerformanceBackgroundMode, name: '自动' },
  { id: 'keep' as PerformanceBackgroundMode, name: '保持' },
  { id: 'release' as PerformanceBackgroundMode, name: '释放' },
]

const shelfModes = [
  { id: 'off' as ShelfMode, name: '关闭' },
  { id: 'sidebar' as ShelfMode, name: '侧边' },
  { id: 'stage' as ShelfMode, name: '舞台' },
]

const consoleStyle = computed(() => {
  const tint = fx.settings.consoleTint
  const opacity = fx.settings.consoleOpacity
  const hue = tint * 240
  return {
    top: `${position.value.y}px`,
    left: `${position.value.x}px`,
    '--console-bg': `hsla(${hue}, 30%, 8%, ${opacity})`,
    '--console-border': `hsla(${hue}, 40%, 30%, ${opacity * 0.5})`,
  }
})

function setPreset(preset: VisualPreset) {
  fx.update('preset', preset)
}

function setPerformanceQuality(quality: PerformanceQuality) {
  fx.setPerformanceQuality(quality)
  performance.setQuality(quality)
}

function setBackgroundMode(mode: PerformanceBackgroundMode) {
  fx.setPerformanceBackgroundMode(mode)
  performance.setBackgroundMode(mode, fx.settings.liveBackgroundKeep)
}

function toggleStageLyrics() {
  lyrics.toggleStageLyrics()
}

function toggleCameraBind() {
  lyrics.setCameraBind(!lyrics.cameraBind)
}

function toggleCoverColor() {
  fx.update('coverColorEnabled', !fx.settings.coverColorEnabled)
}

function toggleFreeCamera() {
  fx.toggleFreeCamera()
}

function openColorLab(target: 'accent' | 'glow' | 'bg', event: MouseEvent) {
  colorLabTarget.value = target
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  colorLabPosition.value = {
    top: rect.bottom + 8,
    left: Math.max(8, rect.left - 100),
  }
  colorLabVisible.value = true
}

function handleColorLabUpdate(color: string) {
  switch (colorLabTarget.value) {
    case 'accent':
      fx.update('accentColor', color)
      break
    case 'glow':
      fx.update('glowColor', color)
      break
    case 'bg':
      fx.update('bgColor', color)
      break
  }
}

function handleColorLabConfirm(color: string) {
  handleColorLabUpdate(color)
  colorLabVisible.value = false
}

function handleColorLabCancel() {
  colorLabVisible.value = false
}

function openCoverPicker(target: 'accent' | 'glow' | 'bg') {
  coverPickerTarget.value = target
  coverPickerVisible.value = true
}

function handleCoverPickerConfirm(color: string) {
  switch (coverPickerTarget.value) {
    case 'accent':
      fx.update('accentColor', color)
      break
    case 'glow':
      fx.update('glowColor', color)
      break
    case 'bg':
      fx.update('bgColor', color)
      break
  }
  coverPickerVisible.value = false
}

function handleCoverPickerCancel() {
  coverPickerVisible.value = false
}

function toggleMinimize() {
  minimized.value = !minimized.value
}

function resetSettings() {
  if (confirm('确定要重置所有视觉设置为默认值吗？')) {
    fx.reset()
    lyrics.resetToDefault()
  }
}

function handleArchiveSlot(slot: number) {
  const saved = localStorage.getItem(`mineradio_archive_${slot}`)
  if (saved) {
    if (confirm(`加载存档槽位 ${slot}？`)) {
      try {
        const data = JSON.parse(saved)
        if (data.fx) {
          Object.keys(data.fx).forEach(key => {
            if (key in fx.settings) {
              fx.update(key as keyof typeof fx.settings, data.fx[key])
            }
          })
        }
      } catch (e) {
        console.error('Load archive failed:', e)
      }
    }
  } else {
    saveToSlot(slot)
  }
}

function saveToSlot(slot: number) {
  const data = {
    fx: { ...fx.settings },
    savedAt: Date.now(),
  }
  localStorage.setItem(`mineradio_archive_${slot}`, JSON.stringify(data))
  alert(`已保存到槽位 ${slot}`)
}

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.icon-btn, .sidebar-tab, .console-content, .console-minimized')) {
    return
  }
  isDragging.value = true
  dragOffset.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y,
  }
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  position.value = {
    x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragOffset.value.x)),
    y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.value.y)),
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onMounted(() => {
  const saved = localStorage.getItem('mineradio_visual_console_pos')
  if (saved) {
    try {
      position.value = JSON.parse(saved)
    } catch (_) {}
  }
})

onUnmounted(() => {
  localStorage.setItem('mineradio_visual_console_pos', JSON.stringify(position.value))
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.visual-console {
  position: fixed;
  z-index: 1000;
  width: 360px;
  max-height: 80vh;
  background: var(--console-bg);
  backdrop-filter: var(--blur-fx-panel);
  -webkit-backdrop-filter: var(--blur-fx-panel);
  border: 1px solid var(--console-border);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  user-select: none;
  color: var(--color-text);
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.auto-hide-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  margin-right: 8px;
}

.auto-hide-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

:global(body.fx-fab-auto-hide) .visual-console {
  transform: translateX(-20px);
  opacity: 0.7;
}

:global(body.fx-fab-auto-hide) .visual-console:hover {
  transform: translateX(0);
  opacity: 1;
}

.console-fade-enter-active,
.console-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.console-fade-enter-from,
.console-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--console-border);
  cursor: move;
}

.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.title-icon {
  font-size: 16px;
}

.console-actions {
  display: flex;
  gap: 4px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.console-body {
  display: flex;
  max-height: calc(80vh - 52px);
}

.console-sidebar {
  width: 80px;
  padding: 12px 0;
  border-right: 1px solid var(--console-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 2px solid transparent;
}

.sidebar-tab:hover {
  background: rgba(255, 255, 255, 0.05);
}

.sidebar-tab.active {
  background: rgba(255, 255, 255, 0.08);
  border-left-color: var(--color-primary);
}

.tab-icon {
  font-size: 20px;
}

.tab-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.sidebar-tab.active .tab-label {
  color: var(--color-text);
}

.console-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  max-height: calc(80vh - 52px);
}

/* FX 面板品牌色滚动条 */
.visual-console::-webkit-scrollbar,
.console-content::-webkit-scrollbar {
  width: 3px;
}

.visual-console::-webkit-scrollbar-track,
.console-content::-webkit-scrollbar-track {
  background: transparent;
}

.visual-console::-webkit-scrollbar-thumb,
.console-content::-webkit-scrollbar-thumb {
  background: rgba(0, 245, 212, 0.24);
  border-radius: 999px;
}

.visual-console::-webkit-scrollbar-thumb:hover,
.console-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 245, 212, 0.4);
}

.console-content {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 245, 212, 0.24) transparent;
}

.content-panel {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text);
}

.panel-subtitle {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 16px 0 10px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setting-item label {
  width: 80px;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.setting-item input[type="range"] {
  flex: 1;
  height: 3px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  cursor: pointer;
}

.setting-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}

.setting-item .value {
  width: 50px;
  text-align: right;
  font-size: 11px;
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.setting-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  margin-left: 90px;
  line-height: 1.5;
}

.setting-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-card {
  padding: 12px 8px;
  text-align: center;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.03);
}

.preset-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.preset-card.active {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.1);
  animation: preset-card-pulse 0.6s ease-out;
}

.preset-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.preset-name {
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 2px;
}

.preset-desc {
  font-size: 10px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

.color-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

.color-item label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.color-swatch-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid var(--console-border);
  transition: transform 0.15s;
}

.color-swatch:hover {
  transform: scale(1.05);
}

.color-actions {
  display: flex;
  gap: 2px;
}

.color-action-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.15s;
}

.color-action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(1.1);
}

.select-group {
  display: flex;
  gap: 4px;
  flex: 1;
  flex-wrap: wrap;
}

.select-btn {
  padding: 6px 10px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.select-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.select-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.toggle-switch {
  width: 36px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
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
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-switch.active .toggle-dot {
  transform: translateX(16px);
}

.lyric-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.lyric-preset-btn {
  padding: 6px 12px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.lyric-preset-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary);
}

.archive-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.archive-slot {
  padding: 10px 4px;
  font-size: 11px;
  border: 1px solid var(--console-border);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.archive-slot:hover {
  background: rgba(var(--color-primary-rgb), 0.1);
  border-color: var(--color-primary);
  color: var(--color-text);
}

.setting-actions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--console-border);
}

.btn-reset {
  width: 100%;
  padding: 8px 12px;
  font-size: 12px;
  border: 1px solid var(--console-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset:hover {
  background: rgba(255, 82, 82, 0.1);
  border-color: #ff5252;
  color: #ff5252;
}

.console-minimized {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 13px;
}

.expand-hint {
  font-size: 11px;
  color: var(--color-text-secondary);
}
</style>
