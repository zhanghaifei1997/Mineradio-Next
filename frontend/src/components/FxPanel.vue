<template>
  <div>
    <!-- FAB 按钮 -->
    <button
      id="fx-fab"
      :class="{ active: isOpen }"
      title="视觉控制台"
      @click="isOpen = !isOpen"
    >
      <svg width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24">
        <path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2"/>
        <path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>
      </svg>
    </button>

    <!-- 面板 -->
    <div id="fx-panel" :class="{ show: isOpen }">
      <div class="fx-head">
        <div>
          <div class="fx-title">视觉控制台</div>
          <div class="fx-sub">MINERADIO VISUALS</div>
        </div>
      </div>

      <!-- 视觉预设 -->
      <div class="fx-section-label">视觉预设</div>
      <div class="preset-grid">
        <div
          v-for="preset in presets"
          :key="preset.id"
          class="preset-card"
          :class="{ active: visual.currentPresetId === preset.id }"
          @click="visual.setPreset(preset.id)"
        >
          <div class="pc-name">{{ preset.name }}</div>
          <div class="pc-desc">{{ preset.desc }}</div>
        </div>
      </div>

      <!-- 自定义颜色 -->
      <div class="fx-section-label">自定义颜色</div>
      <div class="lyric-color-row">
        <input class="lyric-color-picker" type="color" :value="uiAccent" @input="uiAccent = ($event.target as HTMLInputElement).value" title="界面高亮色">
        <div class="fx-color-row-label">界面高亮<small>{{ uiAccent }}</small></div>
        <button class="fx-mini-btn ghost" style="flex:0 0 auto;width:56px" @click="uiAccent = '#00f5d4'">默认</button>
      </div>
      <div class="lyric-color-row">
        <input class="lyric-color-picker" type="color" :value="bgColor" @input="bgColor = ($event.target as HTMLInputElement).value" title="背景颜色">
        <div class="fx-color-row-label">背景颜色<small>{{ bgColor }}</small></div>
        <button class="fx-mini-btn ghost" style="flex:0 0 auto;width:56px" @click="bgColor = '#000000'">封面</button>
      </div>
      <div class="fx-slider">
        <label>背景透明度</label>
        <input type="range" min="0" max="1" step="0.01" :value="visual.bgOpacity" @input="visual.bgOpacity = parseFloat(($event.target as HTMLInputElement).value)">
        <output>{{ visual.bgOpacity.toFixed(2) }}</output>
      </div>

      <!-- 主控 -->
      <div class="fx-section-label">主控</div>
      <div class="fx-slider">
        <label>律动强度</label>
        <input type="range" min="0.2" max="1.6" step="0.01" :value="intensity" @input="intensity = parseFloat(($event.target as HTMLInputElement).value)">
        <output>{{ intensity.toFixed(2) }}</output>
      </div>
      <div class="fx-slider">
        <label>立体感</label>
        <input type="range" min="0.2" max="1.8" step="0.01" :value="depth" @input="depth = parseFloat(($event.target as HTMLInputElement).value)">
        <output>{{ depth.toFixed(2) }}</output>
      </div>
      <div class="fx-slider">
        <label>封面清晰度</label>
        <input type="range" min="0.75" max="1.55" step="0.01" :value="coverRes" @input="coverRes = parseFloat(($event.target as HTMLInputElement).value)">
        <output>{{ coverRes.toFixed(2) }}</output>
      </div>

      <!-- 歌词外观折叠 -->
      <div class="fx-fold" :class="{ open: lyricFoldOpen }">
        <div class="fx-fold-head" @click="lyricFoldOpen = !lyricFoldOpen">
          <span class="fx-fold-title"><strong>歌词外观</strong><small>颜色 / 字体 / 位置</small></span>
          <span class="arrow">▶</span>
        </div>
        <div class="fx-fold-body">
          <div class="fx-section-label">歌词颜色</div>
          <div class="lyric-color-grid">
            <div
              v-for="color in lyricColors"
              :key="color"
              class="lyric-swatch"
              :class="{ active: visual.lyricColor === color }"
              :style="{ '--swatch': color }"
              @click="visual.lyricColor = color"
            ></div>
          </div>
          <div class="lyric-color-row">
            <input class="lyric-color-picker" type="color" :value="visual.lyricColor" @input="visual.lyricColor = ($event.target as HTMLInputElement).value">
            <div class="lyric-color-value">{{ visual.lyricColor }}</div>
            <button class="fx-mini-btn ghost" style="flex:0 0 auto;width:56px" @click="visual.lyricColor = '#a9b8c8'">封面</button>
          </div>

          <div class="fx-section-label">歌词字体</div>
          <div class="fx-font-grid">
            <button
              v-for="font in lyricFonts"
              :key="font.key"
              :class="{ active: visual.lyricFont === font.key }"
              @click="visual.lyricFont = font.key"
            >{{ font.label }}</button>
          </div>

          <div class="fx-slider">
            <label>歌词大小</label>
            <input type="range" min="0.35" max="1.65" step="0.01" :value="lyricScale" @input="lyricScale = parseFloat(($event.target as HTMLInputElement).value)">
            <output>{{ lyricScale.toFixed(2) }}</output>
          </div>
        </div>
      </div>

      <!-- 叠加效果折叠 -->
      <div class="fx-fold" :class="{ open: overlayFoldOpen }">
        <div class="fx-fold-head" @click="overlayFoldOpen = !overlayFoldOpen">
          <span class="fx-fold-title"><strong>叠加效果</strong><small>粒子 / 镜头 / 溢光</small></span>
          <span class="arrow">▶</span>
        </div>
        <div class="fx-fold-body">
          <div class="fx-toggle-grid">
            <div class="fx-toggle" :class="{ on: toggles.cinema }" @click="toggles.cinema = !toggles.cinema">
              <span>电影镜头</span><span class="dot"></span>
            </div>
            <div class="fx-toggle" :class="{ on: toggles.lyricGlow }" @click="toggles.lyricGlow = !toggles.lyricGlow">
              <span>歌词溢光</span><span class="dot"></span>
            </div>
            <div class="fx-toggle" :class="{ on: toggles.bloom }" @click="toggles.bloom = !toggles.bloom">
              <span>粒子溢光</span><span class="dot"></span>
            </div>
            <div class="fx-toggle" :class="{ on: toggles.desktopLyrics }" @click="toggles.desktopLyrics = !toggles.desktopLyrics">
              <span>桌面歌词</span><span class="dot"></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 恢复默认 -->
      <div class="fx-actions">
        <button class="fx-mini-btn" @click="resetAll">恢复默认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useVisualStore } from '@/stores/visual'
import { useSettingsStore } from '@/stores/settings'

const visual = useVisualStore()
const settings = useSettingsStore()

const isOpen = ref(false)
const lyricFoldOpen = ref(false)
const overlayFoldOpen = ref(false)

// 本地参数（后续可同步到 visual store）
const uiAccent = ref('#00f5d4')
const bgColor = ref('#000000')
const intensity = ref(1.0)
const depth = ref(1.0)
const coverRes = ref(1.0)
const lyricScale = ref(1.0)

const toggles = reactive({
  cinema: false,
  lyricGlow: true,
  bloom: false,
  desktopLyrics: false,
})

// 预设列表
const presets = [
  { id: 0, name: '默认', desc: '经典粒子漂浮' },
  { id: 1, name: '星河', desc: '银河系粒子流' },
  { id: 2, name: '极光', desc: '北极光色彩带' },
  { id: 3, name: '水墨', desc: '中国水墨晕染' },
  { id: 4, name: '赛博', desc: '霓虹电子脉冲' },
  { id: 5, name: '暖阳', desc: '金色暖光粒子' },
]

// 歌词颜色预设
const lyricColors = [
  '#a9b8c8', '#e8c8a0', '#c8e8a0', '#a0c8e8',
  '#e8a0c8', '#f0f0f0', '#f5d28a', '#7fd8ff',
  '#ff8f9d', '#9cffdf', '#d4a0ff', '#fff0b8',
]

// 歌词字体列表
const lyricFonts = [
  { key: 'sans', label: '默认' },
  { key: 'hei', label: '黑体' },
  { key: 'song', label: '宋体' },
  { key: 'serif-en', label: 'Serif' },
  { key: 'mono', label: '等宽' },
  { key: 'display', label: '标题' },
]

function resetAll() {
  uiAccent.value = '#00f5d4'
  bgColor.value = '#000000'
  intensity.value = 1.0
  depth.value = 1.0
  coverRes.value = 1.0
  lyricScale.value = 1.0
  visual.lyricColor = '#a9b8c8'
  visual.lyricFont = 'sans'
  visual.setPreset(0)
  toggles.cinema = false
  toggles.lyricGlow = true
  toggles.bloom = false
  toggles.desktopLyrics = false
}
</script>
