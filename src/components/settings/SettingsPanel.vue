<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { usePerformanceStore } from '@/stores/performance'
import { usePlayerStore } from '@/stores/player'
import { useHotkeysStore } from '@/stores/hotkeys'
import type { VisualPreset, PerformanceQuality, PerformanceBackgroundMode } from '@/types'
import type {
  DesktopLyricsPosition,
  DesktopLyricsLineMode,
  DesktopLyricsStylePreset,
  DesktopLyricsSettings,
} from '@/modules/lyrics'
import EqualizerPanel from '@/components/player/EqualizerPanel.vue'
import HotkeySettings from '@/components/settings/HotkeySettings.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const fx = useFxStore()
const lyrics = useLyricsStore()
const performance = usePerformanceStore()
const player = usePlayerStore()
const hotkeys = useHotkeysStore()

type SettingsTab = 'general' | 'playback' | 'lyrics' | 'visual' | 'equalizer' | 'hotkeys' | 'about'

const activeTab = ref<SettingsTab>('visual')

const desktopLyricsSettings = ref<DesktopLyricsSettings>({
  enabled: false,
  locked: true,
  position: 'bottom',
  lineMode: 'double',
  stylePreset: 'gradient',
  fontSize: 48,
  opacity: 0.92,
  primaryColor: '#f6fdff',
  strokeColor: 'rgba(4,6,12,0.42)',
  glowColor: '#9cffdf',
  showProgressBar: false,
  showSongInfo: false,
  fontFamily: 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.2,
  glowEnabled: true,
  glowStrength: 0.35,
  strokeEnabled: true,
  strokeWidth: 1,
  smoothScroll: true,
  animationEnabled: true,
})

const tabs = [
  { id: 'general', name: '通用', icon: '⚙️' },
  { id: 'playback', name: '播放', icon: '🎵' },
  { id: 'lyrics', name: '歌词', icon: '🎤' },
  { id: 'visual', name: '视觉', icon: '🎨' },
  { id: 'equalizer', name: '均衡器', icon: '🎚️' },
  { id: 'hotkeys', name: '快捷键', icon: '⌨️' },
  { id: 'about', name: '关于', icon: 'ℹ️' },
]

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

const positionOptions: { id: DesktopLyricsPosition; name: string }[] = [
  { id: 'top', name: '顶部' },
  { id: 'center', name: '居中' },
  { id: 'bottom', name: '底部' },
]

const lineModeOptions: { id: DesktopLyricsLineMode; name: string }[] = [
  { id: 'single', name: '单行' },
  { id: 'double', name: '双行' },
]

const stylePresetOptions: { id: DesktopLyricsStylePreset; name: string; preview: string }[] = [
  { id: 'minimal', name: '简约', preview: '极简风格' },
  { id: 'neon', name: '霓虹', preview: '霓虹发光' },
  { id: 'gradient', name: '渐变', preview: '渐变色彩' },
  { id: 'stroke', name: '描边', preview: '粗体描边' },
]

const musicSources = [
  { id: 'netease', name: '网易云音乐' },
  { id: 'qqmusic', name: 'QQ 音乐' },
  { id: 'local', name: '本地音乐' },
]

const closeBehaviors = [
  { id: 'minimize', name: '最小化到托盘' },
  { id: 'quit', name: '直接退出' },
]

const electronAPI = (window as any).electronAPI

const appVersion = ref('2.0.0-alpha.1')

function setPreset(preset: VisualPreset) {
  fx.update('preset', preset)
}

function setPerformanceQuality(quality: PerformanceQuality) {
  fx.update('performanceQuality', quality)
  performance.setQuality(quality)
}

function setBackgroundMode(mode: PerformanceBackgroundMode) {
  fx.update('performanceBackground', mode)
  performance.setBackgroundMode(mode, fx.settings.liveBackgroundKeep)
}

function resetSettings() {
  fx.reset()
  performance.setQuality(fx.settings.performanceQuality)
  performance.setBackgroundMode(fx.settings.performanceBackground, fx.settings.liveBackgroundKeep)
  lyrics.setGlow({ strength: fx.settings.lyricGlow })
}

function toggleDesktopLyrics() {
  desktopLyricsSettings.value.enabled = !desktopLyricsSettings.value.enabled
  syncDesktopLyricsSettings()
}

function toggleLyricsLock() {
  desktopLyricsSettings.value.locked = !desktopLyricsSettings.value.locked
  syncDesktopLyricsSettings()
}

function setLyricsPosition(position: DesktopLyricsPosition) {
  desktopLyricsSettings.value.position = position
  syncDesktopLyricsSettings()
}

function setLineMode(mode: DesktopLyricsLineMode) {
  desktopLyricsSettings.value.lineMode = mode
  syncDesktopLyricsSettings()
}

function setStylePreset(preset: DesktopLyricsStylePreset) {
  desktopLyricsSettings.value.stylePreset = preset
  applyStylePreset(preset)
  syncDesktopLyricsSettings()
}

function applyStylePreset(preset: DesktopLyricsStylePreset) {
  const presets: Record<DesktopLyricsStylePreset, Partial<DesktopLyricsSettings>> = {
    minimal: {
      primaryColor: '#ffffff',
      strokeColor: 'rgba(0,0,0,0.5)',
      glowColor: '#ffffff',
      glowEnabled: false,
      strokeEnabled: true,
      glowStrength: 0,
      strokeWidth: 2,
    },
    neon: {
      primaryColor: '#00ffff',
      strokeColor: '#00ffff',
      glowColor: '#00ffff',
      glowEnabled: true,
      strokeEnabled: false,
      glowStrength: 0.8,
      strokeWidth: 0,
    },
    gradient: {
      primaryColor: '#ff6b6b',
      strokeColor: 'rgba(0,0,0,0.3)',
      glowColor: '#feca57',
      glowEnabled: true,
      strokeEnabled: true,
      glowStrength: 0.4,
      strokeWidth: 1,
    },
    stroke: {
      primaryColor: '#ffffff',
      strokeColor: '#000000',
      glowColor: '#ffffff',
      glowEnabled: false,
      strokeEnabled: true,
      glowStrength: 0,
      strokeWidth: 3,
    },
  }
  
  const presetConfig = presets[preset]
  if (presetConfig) {
    Object.assign(desktopLyricsSettings.value, presetConfig)
  }
}

function syncDesktopLyricsSettings() {
  if (electronAPI?.desktopLyrics) {
    if (desktopLyricsSettings.value.enabled) {
      electronAPI.desktopLyrics.show()
    } else {
      electronAPI.desktopLyrics.hide()
    }
    electronAPI.desktopLyrics.setLock(desktopLyricsSettings.value.locked)
    electronAPI.desktopLyrics.sendToOverlay('settings', { ...desktopLyricsSettings.value })
  }
}

function updateDesktopLyricsSetting<K extends keyof DesktopLyricsSettings>(
  key: K,
  value: DesktopLyricsSettings[K]
) {
  desktopLyricsSettings.value[key] = value
  syncDesktopLyricsSettings()
}

function setDefaultVolume(volume: number) {
  player.setVolume(volume)
}

function setFadeEnabled(enabled: boolean) {
  player.setFadeEnabled(enabled)
}

function setReplayGainEnabled(enabled: boolean) {
  player.setReplayGainEnabled(enabled)
}

watch(
  () => fx.settings.lyricGlow,
  (val) => {
    lyrics.setGlow({ strength: val })
  },
  { immediate: true },
)

function closePanel() {
  emit('close')
}
</script>

<template>
  <div class="settings-wrap">
    <div class="settings-panel">
      <div class="settings-header">
        <h3>设置</h3>
        <button class="close-btn" @click="closePanel">✕</button>
      </div>

      <div class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id as SettingsTab"
          :title="tab.name"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
        </button>
      </div>

      <div class="settings-content">
        <div v-show="activeTab === 'general'" class="settings-tab-content">
          <div class="settings-section">
            <div class="section-title">通用设置</div>
            <div class="setting-row">
              <label>默认音乐源</label>
              <div class="segmented">
                <button
                  v-for="src in musicSources"
                  :key="src.id"
                  class="seg-btn"
                  :class="{ active: true }"
                >
                  {{ src.name }}
                </button>
              </div>
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="true"
                />
                <span>启动时自动播放</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">关闭行为</div>
            <div class="segmented">
              <button
                v-for="behavior in closeBehaviors"
                :key="behavior.id"
                class="seg-btn"
                :class="{ active: behavior.id === 'minimize' }"
              >
                {{ behavior.name }}
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">界面</div>
            <div class="setting-row">
              <label>主题色</label>
              <input
                type="color"
                :value="fx.settings.accentColor"
                @input="fx.update('accentColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'playback'" class="settings-tab-content">
          <div class="settings-section">
            <div class="section-title">播放设置</div>
            <div class="setting-row">
              <label>默认音量: {{ Math.round(player.volume * 100) }}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="player.volume"
                @input="setDefaultVolume(parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="player.fadeEnabled"
                  @change="setFadeEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>启用淡入淡出</span>
              </label>
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="player.replayGainEnabled"
                  @change="setReplayGainEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>音量归一化 (ReplayGain)</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">播放速度</div>
            <div class="setting-row">
              <label>速度: {{ player.speed.toFixed(2) }}x</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                :value="player.speed"
                @input="player.setSpeed(parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">输出设备</div>
            <div class="setting-row">
              <div class="device-selector">
                <span class="device-name">默认输出设备</span>
                <span class="device-hint">系统默认</span>
              </div>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'lyrics'" class="settings-tab-content">
          <div class="settings-section">
            <div class="section-title">桌面歌词</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.enabled"
                  @change="toggleDesktopLyrics"
                />
                <span>启用桌面歌词</span>
              </label>
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.locked"
                  @change="toggleLyricsLock"
                />
                <span>锁定位置（穿透模式）</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">显示位置</div>
            <div class="segmented">
              <button
                v-for="p in positionOptions"
                :key="p.id"
                class="seg-btn"
                :class="{ active: desktopLyricsSettings.position === p.id }"
                @click="setLyricsPosition(p.id)"
              >
                {{ p.name }}
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">显示行数</div>
            <div class="segmented">
              <button
                v-for="m in lineModeOptions"
                :key="m.id"
                class="seg-btn"
                :class="{ active: desktopLyricsSettings.lineMode === m.id }"
                @click="setLineMode(m.id)"
              >
                {{ m.name }}
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">样式预设</div>
            <div class="preset-grid">
              <button
                v-for="p in stylePresetOptions"
                :key="p.id"
                class="preset-item preset-item--style"
                :class="{ active: desktopLyricsSettings.stylePreset === p.id }"
                @click="setStylePreset(p.id)"
              >
                <span class="preset-name">{{ p.name }}</span>
                <span class="preset-desc">{{ p.preview }}</span>
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">字体大小</div>
            <div class="setting-row">
              <label>字号: {{ desktopLyricsSettings.fontSize }}px</label>
              <input
                type="range"
                min="24"
                max="96"
                step="2"
                :value="desktopLyricsSettings.fontSize"
                @input="updateDesktopLyricsSetting('fontSize', parseInt(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">透明度</div>
            <div class="setting-row">
              <label>透明度: {{ Math.round(desktopLyricsSettings.opacity * 100) }}%</label>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                :value="desktopLyricsSettings.opacity"
                @input="updateDesktopLyricsSetting('opacity', parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">颜色设置</div>
            <div class="setting-row">
              <label>主色</label>
              <input
                type="color"
                :value="desktopLyricsSettings.primaryColor"
                @input="updateDesktopLyricsSetting('primaryColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="setting-row">
              <label>描边色</label>
              <input
                type="color"
                :value="desktopLyricsSettings.strokeColor"
                @input="updateDesktopLyricsSetting('strokeColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="setting-row">
              <label>发光色</label>
              <input
                type="color"
                :value="desktopLyricsSettings.glowColor"
                @input="updateDesktopLyricsSetting('glowColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">效果设置</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.glowEnabled"
                  @change="updateDesktopLyricsSetting('glowEnabled', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用发光效果</span>
              </label>
            </div>
            <div class="setting-row" v-if="desktopLyricsSettings.glowEnabled">
              <label>发光强度: {{ Math.round(desktopLyricsSettings.glowStrength * 100) }}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="desktopLyricsSettings.glowStrength"
                @input="updateDesktopLyricsSetting('glowStrength', parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.strokeEnabled"
                  @change="updateDesktopLyricsSetting('strokeEnabled', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用描边效果</span>
              </label>
            </div>
            <div class="setting-row" v-if="desktopLyricsSettings.strokeEnabled">
              <label>描边宽度: {{ desktopLyricsSettings.strokeWidth }}px</label>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                :value="desktopLyricsSettings.strokeWidth"
                @input="updateDesktopLyricsSetting('strokeWidth', parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">其他选项</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.showProgressBar"
                  @change="updateDesktopLyricsSetting('showProgressBar', ($event.target as HTMLInputElement).checked)"
                />
                <span>显示播放进度条</span>
              </label>
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.showSongInfo"
                  @change="updateDesktopLyricsSetting('showSongInfo', ($event.target as HTMLInputElement).checked)"
                />
                <span>显示歌曲信息</span>
              </label>
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.smoothScroll"
                  @change="updateDesktopLyricsSetting('smoothScroll', ($event.target as HTMLInputElement).checked)"
                />
                <span>平滑滚动</span>
              </label>
            </div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="desktopLyricsSettings.animationEnabled"
                  @change="updateDesktopLyricsSetting('animationEnabled', ($event.target as HTMLInputElement).checked)"
                />
                <span>入场动画</span>
              </label>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">舞台歌词</div>
            <div class="setting-row">
              <label>歌词发光强度: {{ Math.round(fx.settings.lyricGlow * 100) }}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                :value="fx.settings.lyricGlow"
                @input="fx.update('lyricGlow', parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">翻译设置</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="true"
                />
                <span>显示翻译歌词</span>
              </label>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'visual'" class="settings-tab-content">
          <div class="settings-section">
            <div class="section-title">视觉预设</div>
            <div class="preset-grid">
              <button
                v-for="p in presets"
                :key="p.id"
                class="preset-item"
                :class="{ active: fx.settings.preset === p.id }"
                @click="setPreset(p.id)"
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
                  @click="setPerformanceQuality(q.id as PerformanceQuality)"
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
              <div class="setting-hint">{{ fx.particleCountLabel }} 粒子网格</div>
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
                @click="setBackgroundMode(b.id as PerformanceBackgroundMode)"
              >
                {{ b.name }}
              </button>
            </div>
            <div class="setting-row" style="margin-top: 10px;">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="fx.settings.liveBackgroundKeep"
                  @change="fx.update('liveBackgroundKeep', ($event.target as HTMLInputElement).checked)"
                />
                <span>后台保持活动背景</span>
              </label>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'equalizer'" class="settings-tab-content">
          <EqualizerPanel />
        </div>

        <div v-show="activeTab === 'hotkeys'" class="settings-tab-content">
          <HotkeySettings />
        </div>

        <div v-show="activeTab === 'about'" class="settings-tab-content">
          <div class="settings-section">
            <div class="about-section">
              <div class="about-logo">🎵</div>
              <div class="about-name">Mineradio</div>
              <div class="about-version">v{{ appVersion }}</div>
              <div class="about-desc">沉浸式音乐播放器</div>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">更新</div>
            <div class="setting-row">
              <button class="action-btn">
                检查更新
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">开源协议</div>
            <div class="license-info">
              <p>GPL-3.0 License</p>
              <p class="license-desc">
                Mineradio 是一款开源的沉浸式音乐播放器，采用 GPL-3.0 协议发布。
              </p>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">致谢</div>
            <div class="credits-list">
              <div class="credit-item">
                <span class="credit-name">Vue 3</span>
                <span class="credit-desc">渐进式 JavaScript 框架</span>
              </div>
              <div class="credit-item">
                <span class="credit-name">Three.js</span>
                <span class="credit-desc">3D 图形库</span>
              </div>
              <div class="credit-item">
                <span class="credit-name">Pinia</span>
                <span class="credit-desc">状态管理</span>
              </div>
              <div class="credit-item">
                <span class="credit-name">Electron</span>
                <span class="credit-desc">跨平台桌面应用</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-footer">
        <button class="reset-btn" @click="resetSettings()">恢复默认</button>
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

.settings-panel {
  position: absolute;
  top: 56px;
  right: 0;
  width: 380px;
  max-height: 75vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  flex-shrink: 0;
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

.settings-tabs {
  display: flex;
  padding: 8px;
  gap: 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
  justify-content: space-around;
}

.tab-btn {
  flex: 1;
  padding: 8px 4px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #fff;
  background: rgba(217, 91, 103, 0.2);
}

.tab-icon {
  display: inline-block;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.settings-tab-content {
  padding: 4px 0;
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

.preset-item--style {
  padding: 8px 6px;
}

.preset-icon {
  font-size: 18px;
}

.preset-name {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.preset-desc {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
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

.setting-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
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

.about-section {
  text-align: center;
  padding: 20px 0;
}

.about-logo {
  font-size: 48px;
  margin-bottom: 12px;
}

.about-name {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.about-version {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 8px;
}

.about-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.settings-footer {
  padding: 12px 16px;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
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

.device-selector {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.device-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.device-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.action-btn {
  padding: 10px 20px;
  border: 1px solid rgba(217, 91, 103, 0.4);
  border-radius: 20px;
  background: rgba(217, 91, 103, 0.1);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.6);
}

.license-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
}

.license-desc {
  color: rgba(255, 255, 255, 0.4);
  margin-top: 8px;
}

.credits-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.credit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.credit-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.credit-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}
</style>
