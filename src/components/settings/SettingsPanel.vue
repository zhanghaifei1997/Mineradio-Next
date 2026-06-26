<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useFxStore } from '@/stores/fx'
import { useLyricsStore } from '@/stores/lyrics'
import { usePerformanceStore } from '@/stores/performance'
import { usePlayerStore } from '@/stores/player'
import { useHotkeysStore } from '@/stores/hotkeys'
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'
import { useNotificationStore } from '@/stores/notification'
import type { VisualPreset, PerformanceQuality, PerformanceBackgroundMode, QualityLevel, ThemeMode, Language, PresetCategory, PresetInfo } from '@/types'
import type {
  DesktopLyricsPosition,
  DesktopLyricsLineMode,
  DesktopLyricsStylePreset,
  DesktopLyricsSettings,
} from '@/modules/lyrics'
import EqualizerPanel from '@/components/player/EqualizerPanel.vue'
import HotkeySettings from '@/components/settings/HotkeySettings.vue'
import CacheManager from '@/components/settings/CacheManager.vue'
import DownloadPanel from '@/components/settings/DownloadPanel.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const fx = useFxStore()
const lyrics = useLyricsStore()
const performance = usePerformanceStore()
const player = usePlayerStore()
const hotkeys = useHotkeysStore()
const theme = useThemeStore()
const i18n = useI18nStore()
const notification = useNotificationStore()

type SettingsTab = 'general' | 'playback' | 'cache' | 'download' | 'lyrics' | 'visual' | 'equalizer' | 'hotkeys' | 'about'

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
  { id: 'cache', name: '缓存', icon: '💾' },
  { id: 'download', name: '下载', icon: '📥' },
  { id: 'lyrics', name: '歌词', icon: '🎤' },
  { id: 'visual', name: '视觉', icon: '🎨' },
  { id: 'equalizer', name: '均衡器', icon: '🎚️' },
  { id: 'hotkeys', name: '快捷键', icon: '⌨️' },
  { id: 'about', name: '关于', icon: 'ℹ️' },
]

const presets: PresetInfo[] = [
  { id: 'emily', name: 'Emily', icon: '🌸', category: 'basic', description: '经典粒子效果' },
  { id: 'galaxy', name: '星河', icon: '🌌', category: 'basic', description: '旋转的星系' },
  { id: 'vinyl', name: '黑胶', icon: '💿', category: 'basic', description: '复古黑胶唱片' },
  { id: 'planet', name: '星球', icon: '🪐', category: 'basic', description: '行星轨道' },
  { id: 'cylinder', name: '圆柱', icon: '🏛️', category: 'basic', description: '圆柱形粒子' },
  { id: 'void', name: '虚空', icon: '🕳️', category: 'minimal', description: '极简虚空' },
  { id: 'skull', name: 'Skull', icon: '💀', category: 'cool', description: '骷髅头特效' },
  { id: 'aurora', name: '极光', icon: '🌈', category: 'cool', description: '流动的彩色光带' },
  { id: 'starry', name: '星空', icon: '⭐', category: 'cool', description: '深邃星空闪烁' },
  { id: 'ocean', name: '海洋', icon: '🌊', category: 'cool', description: '波浪起伏海底' },
  { id: 'flame', name: '火焰', icon: '🔥', category: 'cool', description: '燃烧的火焰' },
  { id: 'matrix', name: '矩阵', icon: '💻', category: 'cool', description: '数字雨效果' },
  { id: 'geometry', name: '几何', icon: '🔷', category: 'cool', description: '几何图形变换' },
  { id: 'particleFlow', name: '粒子流', icon: '💫', category: 'cool', description: '粒子流动效果' },
]

const presetCategories: { id: PresetCategory; name: string }[] = [
  { id: 'basic', name: '基础' },
  { id: 'cool', name: '炫酷' },
  { id: 'minimal', name: '简约' },
]

const activePresetCategory = ref<PresetCategory | 'all'>('all')

const filteredPresets = computed(() => {
  if (activePresetCategory.value === 'all') return presets
  return presets.filter(p => p.category === activePresetCategory.value)
})

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

const themeOptions: { id: ThemeMode; name: string; icon: string }[] = [
  { id: 'dark', name: '暗色', icon: '🌙' },
  { id: 'light', name: '亮色', icon: '☀️' },
  { id: 'system', name: '跟随系统', icon: '💻' },
]

const languageOptions: { id: Language; name: string }[] = [
  { id: 'zh-CN', name: '简体中文' },
  { id: 'en-US', name: 'English' },
]

const closeBehaviors = [
  { id: 'minimize', name: '最小化到托盘' },
  { id: 'quit', name: '直接退出' },
]

const qualityOptions: { id: QualityLevel; name: string }[] = [
  { id: 'standard', name: '标准' },
  { id: 'higher', name: '较高' },
  { id: 'exhigh', name: '极高' },
  { id: 'lossless', name: '无损' },
  { id: 'hires', name: 'Hi-Res' },
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

async function selectOutputDevice(deviceId: string) {
  await player.setOutputDevice(deviceId)
}

async function refreshDevices() {
  await player.refreshAudioDevices()
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
            <div class="section-title">外观</div>
            <div class="setting-row">
              <label>主题</label>
              <div class="segmented">
                <button
                  v-for="t in themeOptions"
                  :key="t.id"
                  class="seg-btn"
                  :class="{ active: theme.mode === t.id }"
                  @click="theme.setMode(t.id)"
                >
                  <span class="seg-icon">{{ t.icon }}</span>
                  {{ t.name }}
                </button>
              </div>
            </div>
            <div class="setting-row">
              <label>主题色</label>
              <input
                type="color"
                :value="fx.settings.accentColor"
                @input="fx.update('accentColor', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">语言</div>
            <div class="segmented">
              <button
                v-for="lang in languageOptions"
                :key="lang.id"
                class="seg-btn"
                :class="{ active: i18n.locale === lang.id }"
                @click="i18n.setLocale(lang.id)"
              >
                {{ lang.name }}
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">通知</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="notification.settings.enabled"
                  @change="notification.setEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>启用系统通知</span>
              </label>
            </div>
            <div class="setting-row" v-if="notification.settings.enabled">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="notification.settings.trackChange"
                  @change="notification.setTrackChangeEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>切歌通知</span>
              </label>
            </div>
            <div class="setting-row" v-if="notification.settings.enabled">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="notification.settings.downloadComplete"
                  @change="notification.setDownloadCompleteEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>下载完成通知</span>
              </label>
            </div>
            <div class="setting-row" v-if="notification.settings.enabled">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="notification.settings.updateAvailable"
                  @change="notification.setUpdateAvailableEnabled(($event.target as HTMLInputElement).checked)"
                />
                <span>更新通知</span>
              </label>
            </div>
          </div>

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
            <div class="section-title">音质设置</div>
            <div class="setting-row">
              <label>默认音质 (WiFi)</label>
              <div class="segmented">
                <button
                  v-for="q in qualityOptions"
                  :key="q.id"
                  class="seg-btn"
                  :class="{ active: player.wifiQuality === q.id }"
                  @click="player.setWifiQuality(q.id)"
                >
                  {{ q.name }}
                </button>
              </div>
            </div>
            <div class="setting-row">
              <label>默认音质 (移动网络)</label>
              <div class="segmented">
                <button
                  v-for="q in qualityOptions"
                  :key="q.id"
                  class="seg-btn"
                  :class="{ active: player.mobileQuality === q.id }"
                  @click="player.setMobileQuality(q.id)"
                >
                  {{ q.name }}
                </button>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">输出设备</div>
            <div class="setting-row">
              <div class="device-list">
                <button
                  v-for="device in player.audioDevices"
                  :key="device.deviceId"
                  class="device-item"
                  :class="{ active: player.currentOutputDeviceId === device.deviceId }"
                  @click="selectOutputDevice(device.deviceId)"
                >
                  <span class="device-icon">🔊</span>
                  <div class="device-info">
                    <span class="device-name">{{ device.label || '默认设备' }}</span>
                    <span class="device-hint">{{ device.deviceId === 'default' ? '系统默认' : device.deviceId.slice(0, 8) + '...' }}</span>
                  </div>
                  <span v-if="player.currentOutputDeviceId === device.deviceId" class="device-check">✓</span>
                </button>
                <div v-if="player.audioDevices.length === 0" class="no-devices">
                  <span class="no-devices-icon">🎧</span>
                  <span class="no-devices-text">正在检测音频设备...</span>
                </div>
              </div>
            </div>
            <div class="setting-row">
              <button class="action-btn" @click="refreshDevices">
                🔄 刷新设备列表
              </button>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'cache'" class="settings-tab-content">
          <div class="settings-section" style="padding: 14px 16px;">
            <CacheManager />
          </div>
        </div>

        <div v-show="activeTab === 'download'" class="settings-tab-content">
          <div class="settings-section" style="padding: 14px 16px;">
            <DownloadPanel />
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
            <div class="preset-category-tabs">
              <button
                class="preset-cat-btn"
                :class="{ active: activePresetCategory === 'all' }"
                @click="activePresetCategory = 'all'"
              >
                全部
              </button>
              <button
                v-for="cat in presetCategories"
                :key="cat.id"
                class="preset-cat-btn"
                :class="{ active: activePresetCategory === cat.id }"
                @click="activePresetCategory = cat.id"
              >
                {{ cat.name }}
              </button>
            </div>
            <div class="preset-grid">
              <button
                v-for="p in filteredPresets"
                :key="p.id"
                class="preset-item"
                :class="{ active: fx.settings.preset === p.id }"
                @click="setPreset(p.id)"
                :title="p.description"
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

          <div class="settings-section">
            <div class="section-title">频谱可视化</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="fx.settings.spectrumEnabled"
                  @change="fx.update('spectrumEnabled', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用频谱可视化</span>
              </label>
            </div>
            <div class="setting-row" v-if="fx.settings.spectrumEnabled">
              <label>显示模式</label>
              <div class="segmented">
                <button
                  class="seg-btn"
                  :class="{ active: fx.settings.spectrumMode === 'bars' }"
                  @click="fx.update('spectrumMode', 'bars')"
                >
                  频谱条
                </button>
                <button
                  class="seg-btn"
                  :class="{ active: fx.settings.spectrumMode === 'waveform' }"
                  @click="fx.update('spectrumMode', 'waveform')"
                >
                  波形
                </button>
                <button
                  class="seg-btn"
                  :class="{ active: fx.settings.spectrumMode === 'circular' }"
                  @click="fx.update('spectrumMode', 'circular')"
                >
                  环形
                </button>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">毛玻璃效果</div>
            <div class="setting-row">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="fx.settings.glassEffect"
                  @change="fx.update('glassEffect', ($event.target as HTMLInputElement).checked)"
                />
                <span>启用毛玻璃效果</span>
              </label>
            </div>
            <div class="setting-row" v-if="fx.settings.glassEffect">
              <label>不透明度: {{ Math.round(fx.settings.glassOpacity * 100) }}%</label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                :value="fx.settings.glassOpacity"
                @input="fx.update('glassOpacity', parseFloat(($event.target as HTMLInputElement).value))"
              />
            </div>
            <div class="setting-row" v-if="fx.settings.glassEffect">
              <label>模糊程度: {{ fx.settings.glassBlur }}px</label>
              <input
                type="range"
                min="5"
                max="40"
                step="1"
                :value="fx.settings.glassBlur"
                @input="fx.update('glassBlur', parseFloat(($event.target as HTMLInputElement).value))"
              />
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
            <div class="section-title">常见问题</div>
            <div class="faq-list">
              <div class="faq-item">
                <div class="faq-question">❓ 如何添加本地音乐？</div>
                <div class="faq-answer">
                  点击底部控制栏的「本地音乐」按钮，或在设置中配置本地音乐文件夹路径。
                </div>
              </div>
              <div class="faq-item">
                <div class="faq-question">❓ 如何切换视觉预设？</div>
                <div class="faq-answer">
                  打开设置 → 视觉 → 视觉预设，点击喜欢的预设即可切换。也可以使用快捷键快速切换。
                </div>
              </div>
              <div class="faq-item">
                <div class="faq-question">❓ DJ 模式怎么用？</div>
                <div class="faq-answer">
                  点击顶部 DJ 模式指示器进入 DJ 模式，可以使用双盘混音、交叉推子等专业 DJ 功能。
                </div>
              </div>
              <div class="faq-item">
                <div class="faq-question">❓ 歌词不显示怎么办？</div>
                <div class="faq-answer">
                  请检查网络连接，或尝试切换音乐源。部分歌曲可能没有歌词资源。
                </div>
              </div>
              <div class="faq-item">
                <div class="faq-question">❓ 如何提升性能？</div>
                <div class="faq-answer">
                  在设置 → 视觉 → 性能设置中，降低性能等级或粒子密度可以提升性能。
                </div>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <div class="section-title">反馈与支持</div>
            <div class="feedback-buttons">
              <button class="action-btn feedback-btn">
                📧 发送反馈邮件
              </button>
              <button class="action-btn feedback-btn">
                🐛 提交 Bug 报告
              </button>
              <button class="action-btn feedback-btn">
                💡 功能建议
              </button>
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
  background: var(--color-surface);
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  transition: var(--transition-theme);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.settings-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.close-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 50%;
  font-size: 14px;
}

.close-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.settings-tabs {
  display: flex;
  padding: 8px;
  gap: 2px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  justify-content: space-around;
}

.tab-btn {
  flex: 1;
  padding: 8px 4px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: var(--color-text-secondary);
  background: var(--color-hover);
}

.tab-btn.active {
  color: var(--color-text);
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
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.preset-category-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.preset-cat-btn {
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-input-bg);
  color: var(--color-text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.preset-cat-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.preset-cat-btn.active {
  border-color: rgba(217, 91, 103, 0.5);
  background: rgba(217, 91, 103, 0.15);
  color: var(--color-text);
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
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-input-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s;
}

.preset-item:hover {
  background: var(--color-hover);
  border-color: var(--color-text-muted);
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
  color: var(--color-text-secondary);
}

.preset-desc {
  font-size: 10px;
  color: var(--color-text-muted);
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
  color: var(--color-text-secondary);
}

.setting-row input[type='range'] {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-border);
  border-radius: 2px;
  outline: none;
}

.setting-row input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.setting-row input[type='color'] {
  width: 40px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  padding: 2px;
}

.setting-hint {
  font-size: 11px;
  color: var(--color-text-muted);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.segmented {
  display: flex;
  background: var(--color-input-bg);
  border-radius: var(--radius-md);
  padding: 2px;
}

.seg-btn {
  flex: 1;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.seg-btn:hover {
  color: var(--color-text-secondary);
}

.seg-btn.active {
  background: var(--color-accent);
  color: #fff;
}

.seg-icon {
  font-size: 14px;
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

.device-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.device-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: var(--color-input-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.device-item:hover {
  background: var(--color-hover);
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.device-item.active {
  background: rgba(217, 91, 103, 0.12);
  border-color: rgba(217, 91, 103, 0.4);
  color: var(--color-text);
}

.device-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.device-info {
  flex: 1;
  min-width: 0;
}

.device-info .device-name {
  font-size: 13px;
  color: inherit;
  display: block;
}

.device-info .device-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 2px;
  display: block;
}

.device-check {
  color: var(--color-accent);
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.no-devices {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  text-align: center;
}

.no-devices-icon {
  font-size: 32px;
  opacity: 0.5;
}

.no-devices-text {
  font-size: 12px;
  color: var(--color-text-muted);
}

.action-btn {
  padding: 10px 20px;
  border: 1px solid rgba(217, 91, 103, 0.4);
  border-radius: 20px;
  background: rgba(217, 91, 103, 0.1);
  color: var(--color-text);
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
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.license-desc {
  color: var(--color-text-muted);
  margin-top: 8px;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  padding: 10px 12px;
  background: var(--color-input-bg);
  border-radius: var(--radius-sm);
}

.faq-question {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.faq-answer {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.feedback-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feedback-btn {
  width: 100%;
  text-align: center;
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
  background: var(--color-input-bg);
  border-radius: var(--radius-sm);
}

.credit-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.credit-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}
</style>
