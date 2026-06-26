<template>
  <div class="desktop-lyrics-root" :class="{ show: state.enabled, locked: isLocked, unlocked: !isLocked }">
    <canvas ref="canvasRef" class="fx-canvas"></canvas>

    <div class="lyrics-container" :class="containerClasses">
      <div v-if="settings.showSongInfo && songInfo" class="song-info-bar">
        <div class="song-info-bar__cover" v-if="songInfo.coverUrl">
          <img :src="songInfo.coverUrl" alt="" />
        </div>
        <div class="song-info-bar__text">
          <div class="song-info-bar__name">{{ songInfo.name }}</div>
          <div class="song-info-bar__artist">{{ songInfo.artist }}</div>
        </div>
      </div>

      <div ref="stageRef" class="stage" :class="{ 'hint-visible': hintVisible }">
        <div ref="viewportRef" class="lyric-viewport">
          <div class="lyric-scroll" :style="scrollStyle">
            <div
              ref="currentLineRef"
              class="line line--current"
              :class="{ in: currentLineIn }"
              :data-text="state.text"
            >
              <span class="line-text">{{ state.text }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="settings.lineMode === 'double'"
          class="lyric-viewport lyric-viewport--next"
        >
          <div class="line line--next" :class="{ in: nextLineIn }">
            <span class="line-text">{{ nextText }}</span>
          </div>
        </div>
      </div>

      <div v-if="settings.showProgressBar" class="progress-bar-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" :style="{ width: totalProgress + '%' }"></div>
        </div>
      </div>

      <div class="toolbar" :class="{ 'toolbar--visible': toolbarVisible }">
        <button class="toolbar-btn" @click="toggleLock" :title="isLocked ? '解锁' : '锁定'">
          {{ isLocked ? '🔓' : '🔒' }}
        </button>
        <button class="toolbar-btn" @click="togglePlay" :title="isPlaying ? '暂停' : '播放'">
          {{ isPlaying ? '⏸' : '▶' }}
        </button>
        <button class="toolbar-btn" @click="onPrev" title="上一首">
          ⏮
        </button>
        <button class="toolbar-btn" @click="onNext" title="下一首">
          ⏭
        </button>
        <button class="toolbar-btn" @click="openSettings" title="设置">
          ⚙️
        </button>
        <button class="toolbar-btn toolbar-btn--close" @click="onClose" title="关闭">
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import {
  type DesktopLyricState,
  type DesktopLyricsSettings,
  type LiveMotion,
  type Particle,
  type ScrollState,
  type DesktopLyricsPosition,
  type DesktopLyricsLineMode,
  type DesktopLyricsStylePreset,
  effectiveLyricPalette,
  initLiveMotion,
  updateMotion,
  applyStageMotion,
  drawAura,
  drawGlowText,
  drawHighlightBloom,
  drawParticles,
  fitLyricText,
  updateLyricScroll,
  initScrollState,
  normalizeLyricColor,
  colorWithAlpha,
} from '@/modules/lyrics'

interface Props {
  initialState?: Partial<DesktopLyricState>
}

const props = withDefaults(defineProps<Props>(), {
  initialState: () => ({}),
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'lockChange', locked: boolean): void
  (e: 'stateChange', state: Partial<DesktopLyricState>): void
  (e: 'togglePlay'): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'openSettings'): void
}>()

const stylePresets: Record<DesktopLyricsStylePreset, {
  primaryColor: string
  strokeColor: string
  glowColor: string
  glowEnabled: boolean
  strokeEnabled: boolean
  glowStrength: number
  strokeWidth: number
}> = {
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

const defaultSettings: DesktopLyricsSettings = {
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
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)
const currentLineRef = ref<HTMLDivElement | null>(null)

const defaultPalette = {
  primary: '#f6fdff',
  secondary: '#a8f6ff',
  highlight: '#fff0b8',
  glow: '#9cffdf',
}

const state = reactive<DesktopLyricState>({
  enabled: false,
  text: 'Mineradio',
  progress: 0,
  progressSpan: 4.8,
  playing: false,
  playbackTime: 0,
  playbackDuration: 0,
  playbackRate: 1,
  size: 1,
  opacity: 0.92,
  clickThrough: true,
  cinema: true,
  highlightFollow: false,
  frameRate: 60,
  colors: { ...defaultPalette },
  displayColors: { ...defaultPalette },
  fontFamily: 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1,
  lyricGlow: true,
  lyricGlowBeat: true,
  lyricGlowStrength: 0.35,
  lyricGlowParticles: false,
  highBloom: 0,
  beatGlow: 0,
  beatPulse: 0,
  bass: 0,
  feather: 0.055,
  ...props.initialState,
})

const settings = reactive<DesktopLyricsSettings>({ ...defaultSettings })

const nextText = ref('')
const totalProgress = ref(0)
const isPlaying = ref(false)
const songInfo = ref<{ name: string; artist: string; coverUrl?: string } | null>(null)

const liveMotion = ref<LiveMotion>(initLiveMotion())
const particles = ref<Particle[]>([])
const scrollState = ref<ScrollState>(initScrollState())
const renderedFontSize = ref(48)
const fitScaleX = ref(1)
const baseFontSize = ref(48)
const displayedProgress = ref(0)
const currentLineIn = ref(false)
const nextLineIn = ref(false)
const lastText = ref('')
const lastNextText = ref('')
const hintVisible = ref(false)
const hoverInside = ref(false)
const dragging = ref(false)
const hintTimer = ref<number | null>(null)
const lastPointerEvent = ref<PointerEvent | null>(null)
const toolbarVisible = ref(false)
const toolbarTimer = ref<number | null>(null)

let animationId: number | null = null
let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
let lastDrawAt = 0
let layoutKey = ''
let progressReceivedAt = 0

const isLocked = computed(() => state.clickThrough !== false)

const scrollStyle = computed(() => ({
  transform: `translate3d(${scrollState.value.offset.toFixed(2)}px, 0, 0) scaleX(${fitScaleX.value.toFixed(4)})`,
}))

const containerClasses = computed(() => ({
  [`position-${settings.position}`]: true,
  [`preset-${settings.stylePreset}`]: true,
  'single-line': settings.lineMode === 'single',
  'double-line': settings.lineMode === 'double',
}))

function setRootVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value)
}

function applyStylePreset(preset: DesktopLyricsStylePreset) {
  const presetConfig = stylePresets[preset]
  if (!presetConfig) return

  settings.primaryColor = presetConfig.primaryColor
  settings.strokeColor = presetConfig.strokeColor
  settings.glowColor = presetConfig.glowColor
  settings.glowEnabled = presetConfig.glowEnabled
  settings.strokeEnabled = presetConfig.strokeEnabled
  settings.glowStrength = presetConfig.glowStrength
  settings.strokeWidth = presetConfig.strokeWidth

  updateCssVars()
}

function updateCssVars() {
  setRootVar('--lyric-primary', settings.primaryColor)
  setRootVar('--lyric-secondary', settings.glowColor)
  setRootVar('--lyric-highlight', settings.glowColor)
  setRootVar('--lyric-glow', settings.glowColor)
  setRootVar('--lyric-shadow-soft', colorWithAlpha(settings.glowColor, 0.36))
  setRootVar('--lyric-shadow-glow', colorWithAlpha(settings.glowColor, 0.28))
  setRootVar('--lyric-shadow-hot', colorWithAlpha(settings.primaryColor, 0.28))
  setRootVar('--lyric-edge', settings.strokeColor)
  setRootVar('--lyric-drop', colorWithAlpha(settings.primaryColor, 0.26))
  setRootVar('--lyric-drop-paused', colorWithAlpha(settings.primaryColor, 0.18))
  setRootVar('--lyric-font', settings.fontFamily)
  setRootVar('--lyric-weight', String(settings.fontWeight))
  setRootVar('--lyric-line-height', String(settings.lineHeight))
  setRootVar('--lyric-feather', (state.feather * 100).toFixed(2) + '%')
  setRootVar('--lyric-size', renderedFontSize.value + 'px')
  setRootVar('--lyric-letter-spacing', (renderedFontSize.value * settings.letterSpacing).toFixed(2) + 'px')
  setRootVar('--lyric-fit-x', fitScaleX.value.toFixed(4))
  setRootVar('--lyric-scroll-x', scrollState.value.offset.toFixed(2) + 'px')
  setRootVar('--lyric-stroke-width', settings.strokeWidth + 'px')
  setRootVar('--lyric-glow-strength', String(settings.glowStrength))
}

function resizeCanvas() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  dpr = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1))
  canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr))
  canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr))
  canvas.style.width = window.innerWidth + 'px'
  canvas.style.height = window.innerHeight + 'px'
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  fitLyricLayout(true)
}

function measureLineWidth(fontSize: number, text: string): number {
  if (!ctx) return fontSize * text.length * 0.6
  ctx.save()
  ctx.font = `${settings.fontWeight} ${fontSize}px ${settings.fontFamily}`
  const width = ctx.measureText(text || 'Mineradio').width
  ctx.restore()
  const charCount = Array.from(text || 'Mineradio').length
  return Math.max(1, width + Math.max(0, charCount - 1) * fontSize * settings.letterSpacing)
}

function fitLyricLayout(force: boolean = false) {
  if (!ctx) return

  const safeWidth = Math.max(300, window.innerWidth - 8)
  const edgeWidth = Math.round(Math.max(54, Math.min(116, safeWidth * 0.085)))

  const nextLayoutKey = [
    state.text,
    baseFontSize.value,
    settings.fontFamily,
    settings.fontWeight,
    settings.letterSpacing,
    settings.lineHeight,
    window.innerWidth,
    window.innerHeight,
  ].join('|')

  if (!force && nextLayoutKey === layoutKey) return
  layoutKey = nextLayoutKey

  const result = fitLyricText(
    state.text,
    baseFontSize.value,
    {
      fontFamily: settings.fontFamily,
      fontWeight: settings.fontWeight,
      letterSpacing: settings.letterSpacing,
      lineHeight: settings.lineHeight,
      fontSize: baseFontSize.value,
      opacity: settings.opacity,
      feather: state.feather,
    },
    window.innerWidth,
    window.innerHeight,
    ctx
  )

  renderedFontSize.value = result.fontSize
  fitScaleX.value = result.fitScaleX

  scrollState.value.needed = result.scrollNeeded
  scrollState.value.limit = result.scrollLimit
  scrollState.value.overflow = result.scrollOverflow

  const maskEdgeWidth = result.scrollNeeded ? Math.round(Math.max(26, Math.min(58, edgeWidth * 0.44))) : edgeWidth

  if (!result.scrollNeeded) {
    scrollState.value.offset = 0
    scrollState.value.dir = -1
    scrollState.value.holdUntil = 0
    scrollState.value.lastAt = 0
  } else {
    scrollState.value.offset = 0
    scrollState.value.dir = -1
    scrollState.value.holdUntil = performance.now() + 320
    scrollState.value.lastAt = 0
  }

  setRootVar('--lyric-edge-width', edgeWidth + 'px')
  setRootVar('--lyric-mask-edge-width', maskEdgeWidth + 'px')
  setRootVar('--lyric-vertical-feather', result.verticalFeather + 'px')

  updateCssVars()
}

function currentDisplayProgress(nowMs: number): number {
  let target = Math.max(0, Math.min(1, state.progress))
  if (state.playing && state.progressSpan > 0) {
    target += Math.max(0, nowMs - progressReceivedAt) / (state.progressSpan * 1000)
  }
  target = Math.max(0, Math.min(1, target))

  if (lastText.value !== state.text) {
    lastText.value = state.text
    displayedProgress.value = target
  }

  const delta = target - displayedProgress.value
  if (delta < -0.018 && target > 0.035 && displayedProgress.value < 0.985) {
    displayedProgress.value = Math.max(
      0,
      Math.min(1, displayedProgress.value + Math.max(delta * 0.018, -0.0028))
    )
    return displayedProgress.value
  }
  const ease = delta >= 0 ? Math.min(0.3, 0.074 + Math.abs(delta) * 0.5) : Math.min(0.03, 0.008 + Math.abs(delta) * 0.045)
  displayedProgress.value = Math.max(0, Math.min(1, displayedProgress.value + delta * ease))
  return displayedProgress.value
}

function frameIntervalMs(): number {
  const fps = state.frameRate
  return fps > 0 ? 1000 / fps : 0
}

function draw(nowMs: number) {
  if (state.enabled) {
    const interval = frameIntervalMs()
    if (interval > 0 && lastDrawAt && nowMs - lastDrawAt < Math.max(4, interval - 1.25)) {
      animationId = requestAnimationFrame(draw)
      return
    }
  }

  const dt = lastDrawAt ? Math.min(0.12, Math.max(0.001, (nowMs - lastDrawAt) / 1000)) : 1 / 60
  lastDrawAt = nowMs
  const now = nowMs * 0.001

  if (state.enabled) {
    const progress = currentDisplayProgress(nowMs)
    setRootVar('--lyric-progress', (progress * 100).toFixed(2) + '%')

    const glowStrength = settings.glowEnabled ? settings.glowStrength : 0

    updateMotion(
      liveMotion.value,
      now,
      glowStrength,
      state.lyricGlowBeat,
      state.beatGlow,
      state.beatPulse,
      state.bass,
      state.highBloom,
      state.cinema,
      state.playing
    )

    if (stageRef.value) {
      applyStageMotion(stageRef.value, liveMotion.value, now, state.cinema)
    }

    if (scrollState.value.needed && settings.smoothScroll) {
      scrollState.value.offset = updateLyricScroll(
        scrollState.value,
        progress,
        state.progressSpan,
        window.innerWidth,
        nowMs
      )
      setRootVar('--lyric-scroll-x', scrollState.value.offset.toFixed(2) + 'px')
    }

    if (ctx && canvasRef.value && state.text && viewportRef.value && settings.glowEnabled) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      const rect = viewportRef.value.getBoundingClientRect()

      if (glowStrength > 0) {
        drawAura(ctx, rect, state.displayColors, liveMotion.value, settings.opacity)
      }

      if (state.highlightFollow && glowStrength > 0) {
        drawHighlightBloom(
          ctx,
          rect,
          progress,
          state.displayColors,
          liveMotion.value,
          renderedFontSize.value,
          settings.opacity
        )
      }

      if (glowStrength > 0) {
        drawGlowText(
          ctx,
          state.text,
          rect,
          state.displayColors,
          liveMotion.value,
          renderedFontSize.value,
          settings.fontWeight,
          settings.fontFamily,
          settings.letterSpacing,
          fitScaleX.value,
          glowStrength,
          settings.opacity
        )
      }

      if (state.lyricGlowParticles) {
        drawParticles(
          ctx,
          rect,
          particles.value,
          state.displayColors,
          liveMotion.value,
          glowStrength,
          state.lyricGlowParticles,
          now,
          settings.opacity
        )
      }
    }
  }

  animationId = requestAnimationFrame(draw)
}

function startAnimation() {
  if (animationId) return
  lastDrawAt = 0
  animationId = requestAnimationFrame(draw)
}

function stopAnimation() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

function replayLineAnimation() {
  currentLineIn.value = false
  requestAnimationFrame(() => {
    currentLineIn.value = true
  })
}

function replayNextLineAnimation() {
  nextLineIn.value = false
  requestAnimationFrame(() => {
    nextLineIn.value = true
  })
}

function applyState(next: Partial<DesktopLyricState>) {
  if (!next) return

  if (next.colors) {
    state.colors = { ...state.colors, ...next.colors }
  }

  Object.assign(state, next)

  state.displayColors = {
    primary: normalizeLyricColor(settings.primaryColor || '#f6fdff', '#f6fdff'),
    secondary: normalizeLyricColor(settings.glowColor || '#a8f6ff', '#a8f6ff'),
    highlight: normalizeLyricColor(settings.glowColor || '#fff0b8', '#fff0b8'),
    glow: normalizeLyricColor(settings.glowColor || '#9cffdf', '#9cffdf'),
  }

  baseFontSize.value = settings.fontSize
  progressReceivedAt = performance.now()

  document.body.classList.toggle('show', !!state.enabled)
  document.body.classList.toggle('paused', !state.playing)
  document.body.classList.toggle('highlight', state.highlightFollow === true)
  document.body.style.opacity = state.enabled ? String(Math.max(0.28, Math.min(1, settings.opacity))) : '0'

  if (state.text !== lastText.value) {
    lastText.value = state.text
    scrollState.value.offset = 0
    scrollState.value.dir = -1
    scrollState.value.holdUntil = performance.now() + 320
    scrollState.value.lastAt = 0
    layoutKey = ''
    if (settings.animationEnabled) {
      replayLineAnimation()
    } else {
      currentLineIn.value = true
    }
  }

  fitLyricLayout(false)
  updateCssVars()
}

function applySettings(next: Partial<DesktopLyricsSettings>) {
  if (!next) return
  Object.assign(settings, next)

  if (next.stylePreset && stylePresets[next.stylePreset]) {
    applyStylePreset(next.stylePreset)
  }

  state.opacity = settings.opacity
  state.clickThrough = settings.locked
  state.lyricGlow = settings.glowEnabled
  state.lyricGlowStrength = settings.glowStrength
  state.fontFamily = settings.fontFamily
  state.fontWeight = settings.fontWeight
  state.letterSpacing = settings.letterSpacing
  state.lineHeight = settings.lineHeight

  baseFontSize.value = settings.fontSize

  state.displayColors = {
    primary: normalizeLyricColor(settings.primaryColor || '#f6fdff', '#f6fdff'),
    secondary: normalizeLyricColor(settings.glowColor || '#a8f6ff', '#a8f6ff'),
    highlight: normalizeLyricColor(settings.glowColor || '#fff0b8', '#fff0b8'),
    glow: normalizeLyricColor(settings.glowColor || '#9cffdf', '#9cffdf'),
  }

  document.body.style.opacity = state.enabled ? String(Math.max(0.28, Math.min(1, settings.opacity))) : '0'
  fitLyricLayout(true)
  updateCssVars()
}

function updateNextText(text: string) {
  if (text !== lastNextText.value) {
    lastNextText.value = text
    nextText.value = text
    if (settings.animationEnabled) {
      replayNextLineAnimation()
    } else {
      nextLineIn.value = true
    }
  }
}

function onClose() {
  emit('close')
}

function toggleLock() {
  settings.locked = !settings.locked
  state.clickThrough = settings.locked
  emit('lockChange', settings.locked)
}

function togglePlay() {
  emit('togglePlay')
}

function onPrev() {
  emit('prev')
}

function onNext() {
  emit('next')
}

function openSettings() {
  emit('openSettings')
}

function pointInRect(evt: PointerEvent, rect: DOMRect, padX: number, padY: number): boolean {
  return (
    evt.clientX >= rect.left - padX &&
    evt.clientX <= rect.right + padX &&
    evt.clientY >= rect.top - padY &&
    evt.clientY <= rect.bottom + padY
  )
}

function pointInStage(evt: PointerEvent): boolean {
  if (!state.enabled) return false
  if (dragging.value) return true

  if (!isLocked.value && stageRef.value) {
    const stageRect = stageRef.value.getBoundingClientRect()
    return pointInRect(evt, stageRect, 0, 0)
  }

  if (viewportRef.value) {
    const padX = Math.max(24, Math.min(68, window.innerWidth * 0.034))
    const padY = Math.max(22, Math.min(46, window.innerHeight * 0.045))
    const lyricRect = viewportRef.value.getBoundingClientRect()
    if (pointInRect(evt, lyricRect, padX, padY)) return true
  }

  return false
}

function setHintVisible(visible: boolean) {
  hintVisible.value = visible
}

function showToolbar() {
  toolbarVisible.value = true
  if (toolbarTimer.value) {
    clearTimeout(toolbarTimer.value)
    toolbarTimer.value = null
  }
}

function hideToolbar() {
  toolbarTimer.value = window.setTimeout(() => {
    toolbarVisible.value = false
    toolbarTimer.value = null
  }, 2000)
}

function hideInteractionHint() {
  hoverInside.value = false
  lastPointerEvent.value = null
  if (hintTimer.value) {
    clearTimeout(hintTimer.value)
    hintTimer.value = null
  }
  setHintVisible(false)
}

function scheduleInteractionHint() {
  if (hintVisible.value || hintTimer.value) return
  hintTimer.value = window.setTimeout(() => {
    hintTimer.value = null
    if (!hoverInside.value || !lastPointerEvent.value || !pointInStage(lastPointerEvent.value)) return
    setHintVisible(true)
  }, 1500)
}

function handlePointerMove(evt: PointerEvent) {
  const inside = !!state.enabled && pointInStage(evt)
  hoverInside.value = inside
  lastPointerEvent.value = evt

  if (inside) {
    showToolbar()
  } else {
    hideToolbar()
  }

  if (isLocked.value) {
    if (inside || dragging.value) {
      scheduleInteractionHint()
    } else {
      hideInteractionHint()
    }
    return
  }

  if (inside || dragging.value) {
    scheduleInteractionHint()
  } else {
    hideInteractionHint()
  }
}

function handlePointerDown(evt: PointerEvent) {
  if (evt.button === 1) {
    evt.preventDefault()
    toggleLock()
    return
  }
  if (isLocked.value) return
  if (!pointInStage(evt)) return

  dragging.value = true
  ;(evt.target as Element)?.setPointerCapture?.(evt.pointerId)
}

function handlePointerUp() {
  dragging.value = false
}

watch(
  () => state.enabled,
  (enabled) => {
    if (enabled) {
      startAnimation()
    }
  }
)

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointerup', handlePointerUp)
  startAnimation()
  applyState(state)
  applySettings(settings)
})

onUnmounted(() => {
  stopAnimation()
  window.removeEventListener('resize', resizeCanvas)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointerup', handlePointerUp)
  if (hintTimer.value) {
    clearTimeout(hintTimer.value)
  }
  if (toolbarTimer.value) {
    clearTimeout(toolbarTimer.value)
  }
})

onActivated(() => {
  startAnimation()
})

onDeactivated(() => {
  stopAnimation()
})

defineExpose({
  applyState,
  applySettings,
  updateNextText,
  state,
  settings,
  totalProgress,
  isPlaying,
  songInfo,
})
</script>

<style scoped>
.desktop-lyrics-root {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
  user-select: none;
}

.fx-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.lyrics-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 1200px;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.lyrics-container.position-top {
  top: 40px;
}

.lyrics-container.position-center {
  top: 50%;
  transform: translate(-50%, -50%);
}

.lyrics-container.position-bottom {
  bottom: 60px;
}

.song-info-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: var(--blur-desktop-lyrics);
  -webkit-backdrop-filter: var(--blur-desktop-lyrics);
  border-radius: 999px;
  pointer-events: auto;
}

.song-info-bar__cover {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.song-info-bar__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info-bar__text {
  min-width: 0;
}

.song-info-bar__name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.song-info-bar__artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.stage {
  position: relative;
  max-width: calc(100vw - 24px);
  padding: 20px 40px;
  box-sizing: border-box;
  pointer-events: auto;
  cursor: default;
  transform-style: preserve-3d;
  transform-origin: center;
  will-change: transform, filter;
  contain: layout style;
  backface-visibility: hidden;
  -webkit-app-region: no-drag;
}

.unlocked .stage {
  cursor: move;
}

.unlocked .stage.hint-visible {
  cursor: move;
  -webkit-app-region: no-drag;
}

.lyric-viewport {
  position: relative;
  z-index: 2;
  display: block;
  width: min(100%, 1120px);
  max-width: calc(100vw - 24px);
  margin: 0 auto;
  padding: 0.6em var(--lyric-edge-width, 92px);
  box-sizing: border-box;
  overflow: hidden;
  text-align: center;
  pointer-events: none;
  isolation: isolate;
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 var(--lyric-mask-edge-width, 92px),
    #000 calc(100% - var(--lyric-mask-edge-width, 92px)),
    transparent 100%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 var(--lyric-mask-edge-width, 92px),
    #000 calc(100% - var(--lyric-mask-edge-width, 92px)),
    transparent 100%
  );
  filter: drop-shadow(0 1px 2.4px rgba(4, 6, 12, 0.58)) drop-shadow(0 0 4.8px rgba(4, 6, 12, 0.3));
  transform: translateZ(0);
  will-change: transform, filter;
}

.lyric-viewport--next {
  opacity: 0.5;
  margin-top: 8px;
}

.unlocked .stage.hint-visible .lyric-viewport {
  pointer-events: auto;
  cursor: move;
  -webkit-app-region: no-drag;
}

.lyric-scroll {
  display: inline-block;
  transform-origin: center;
  will-change: transform;
  backface-visibility: hidden;
}

.line {
  position: relative;
  z-index: 2;
  display: inline-block;
  max-width: none;
  font-family: var(--lyric-font);
  font-size: var(--lyric-size);
  font-weight: var(--lyric-weight);
  line-height: var(--lyric-line-height);
  letter-spacing: var(--lyric-letter-spacing);
  text-align: center;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  padding: 0.2em 0.12em 0.34em;
  margin: -0.2em -0.12em -0.34em;
  background: linear-gradient(90deg, var(--lyric-primary), var(--lyric-primary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke: var(--lyric-stroke-width, 0px) var(--lyric-edge, rgba(4, 6, 12, 0.42));
  paint-order: stroke fill;
  text-shadow:
    0 0 1px rgba(255, 255, 255, 0.34),
    0 0 calc(6px + var(--lyric-css-beat-glow, 0px)) var(--lyric-shadow-soft),
    0 0 calc(14px + var(--lyric-css-beat-glow, 0px)) var(--lyric-shadow-glow);
  filter: none;
  opacity: 0;
  transform: translate3d(0, 0, 0);
  transform-origin: center;
  backface-visibility: hidden;
  will-change: opacity, filter, transform, background;
}

.line--next {
  font-size: calc(var(--lyric-size) * 0.7);
  opacity: 0.4;
}

.line--next.in {
  opacity: 0.5;
}

.highlight .line--current {
  background: linear-gradient(
    90deg,
    var(--lyric-highlight) 0%,
    var(--lyric-highlight) max(0%, calc(var(--lyric-progress) - var(--lyric-feather))),
    var(--lyric-glow) calc(var(--lyric-progress) + 1.2%),
    var(--lyric-primary) calc(var(--lyric-progress) + var(--lyric-feather)),
    var(--lyric-primary) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
}

.line.in {
  animation: lyr-in 600ms cubic-bezier(0.16, 0.84, 0.32, 1.02) forwards;
}

.line--next.in {
  animation: lyr-in-next 600ms cubic-bezier(0.16, 0.84, 0.32, 1.02) forwards;
}

.paused .line {
  filter: none;
}

.progress-bar-wrap {
  width: 300px;
  pointer-events: auto;
}

.progress-bar-bg {
  height: 3px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--lyric-glow), var(--lyric-primary));
  border-radius: 2px;
  transition: width 0.3s ease;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: var(--blur-desktop-lyrics);
  -webkit-backdrop-filter: var(--blur-desktop-lyrics);
  border-radius: 999px;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.2s ease;
  pointer-events: none;
}

.toolbar--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.toolbar-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s ease;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.toolbar-btn--close:hover {
  background: rgba(255, 82, 82, 0.4);
}

@keyframes lyr-in {
  0% {
    opacity: 0;
    transform: translate3d(0, 20px, -80px) rotateX(12deg) scale(0.9);
    filter: blur(8px);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotateX(0deg) scale(1);
    filter: blur(0);
  }
}

@keyframes lyr-in-next {
  0% {
    opacity: 0;
    transform: translateY(10px);
    filter: blur(4px);
  }
  100% {
    opacity: 0.5;
    transform: translateY(0);
    filter: blur(0);
  }
}
</style>
