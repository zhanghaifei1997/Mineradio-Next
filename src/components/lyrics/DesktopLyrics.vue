<template>
  <div class="desktop-lyrics-root" :class="{ show: state.enabled, locked: isLocked, unlocked: !isLocked }">
    <canvas ref="canvasRef" class="fx-canvas"></canvas>
    <div class="wrap">
      <div ref="stageRef" class="stage" :class="{ 'hint-visible': hintVisible }">
        <div ref="viewportRef" class="lyric-viewport">
          <div class="lyric-scroll" :style="scrollStyle">
            <div
              ref="lineRef"
              class="line"
              :class="{ in: lineIn }"
              :data-text="state.text"
            >
              {{ state.text }}
            </div>
          </div>
        </div>
        <div class="lock-hint">
          <span class="lock-icon"></span>
          <span class="lock-text">{{ isLocked ? '中键解锁' : '中键锁定' }}</span>
          <button class="lyrics-close" type="button" aria-label="Close desktop lyrics" @click="onClose">
            关闭桌面歌词
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import {
  type DesktopLyricState,
  type LiveMotion,
  type Particle,
  type ScrollState,
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
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)
const lineRef = ref<HTMLDivElement | null>(null)

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

const liveMotion = ref<LiveMotion>(initLiveMotion())
const particles = ref<Particle[]>([])
const scrollState = ref<ScrollState>(initScrollState())
const renderedFontSize = ref(58)
const fitScaleX = ref(1)
const baseFontSize = ref(58)
const displayedProgress = ref(0)
const lineIn = ref(false)
const lastText = ref('')
const hintVisible = ref(false)
const hoverInside = ref(false)
const dragging = ref(false)
const hintTimer = ref<number | null>(null)
const lastPointerEvent = ref<PointerEvent | null>(null)

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

function setRootVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value)
}

function updateCssVars() {
  setRootVar('--lyric-primary', state.displayColors.primary)
  setRootVar('--lyric-secondary', state.displayColors.secondary)
  setRootVar('--lyric-highlight', state.displayColors.highlight)
  setRootVar('--lyric-glow', state.displayColors.glow)
  setRootVar('--lyric-shadow-soft', colorWithAlpha(state.displayColors.primary, 0.36))
  setRootVar('--lyric-shadow-glow', colorWithAlpha(state.displayColors.primary, 0.28))
  setRootVar('--lyric-shadow-hot', colorWithAlpha(state.displayColors.highlight, 0.28))
  setRootVar('--lyric-edge', 'rgba(4,6,12,.42)')
  setRootVar('--lyric-drop', colorWithAlpha(state.displayColors.primary, 0.26))
  setRootVar('--lyric-drop-paused', colorWithAlpha(state.displayColors.primary, 0.18))
  setRootVar('--lyric-font', state.fontFamily)
  setRootVar('--lyric-weight', String(state.fontWeight))
  setRootVar('--lyric-line-height', String(state.lineHeight))
  setRootVar('--lyric-feather', (state.feather * 100).toFixed(2) + '%')
  setRootVar('--lyric-size', renderedFontSize.value + 'px')
  setRootVar('--lyric-letter-spacing', (renderedFontSize.value * state.letterSpacing).toFixed(2) + 'px')
  setRootVar('--lyric-fit-x', fitScaleX.value.toFixed(4))
  setRootVar('--lyric-scroll-x', scrollState.value.offset.toFixed(2) + 'px')
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

function measureLineWidth(fontSize: number): number {
  if (!ctx) return fontSize * state.text.length * 0.6
  ctx.save()
  ctx.font = `${state.fontWeight} ${fontSize}px ${state.fontFamily}`
  const text = state.text || 'Mineradio'
  const width = ctx.measureText(text).width
  ctx.restore()
  const charCount = Array.from(text).length
  return Math.max(1, width + Math.max(0, charCount - 1) * fontSize * state.letterSpacing)
}

function fitLyricLayout(force: boolean = false) {
  if (!ctx) return

  const safeWidth = Math.max(300, window.innerWidth - 8)
  const edgeWidth = Math.round(Math.max(54, Math.min(116, safeWidth * 0.085)))
  const viewportWidth = Math.round(
    Math.max(280, Math.min(safeWidth - 12, window.innerWidth - Math.min(240, Math.max(88, window.innerWidth * 0.13))))
  )

  const nextLayoutKey = [
    state.text,
    baseFontSize.value,
    state.fontFamily,
    state.fontWeight,
    state.letterSpacing,
    state.lineHeight,
    window.innerWidth,
    window.innerHeight,
  ].join('|')

  if (!force && nextLayoutKey === layoutKey) return
  layoutKey = nextLayoutKey

  const result = fitLyricText(
    state.text,
    baseFontSize.value,
    {
      fontFamily: state.fontFamily,
      fontWeight: state.fontWeight,
      letterSpacing: state.letterSpacing,
      lineHeight: state.lineHeight,
      fontSize: baseFontSize.value,
      opacity: state.opacity,
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

    const glowStrength = state.lyricGlow ? state.lyricGlowStrength : 0

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

    if (scrollState.value.needed) {
      scrollState.value.offset = updateLyricScroll(
        scrollState.value,
        progress,
        state.progressSpan,
        window.innerWidth,
        nowMs
      )
      setRootVar('--lyric-scroll-x', scrollState.value.offset.toFixed(2) + 'px')
    }

    if (ctx && canvasRef.value && state.text && viewportRef.value) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

      const rect = viewportRef.value.getBoundingClientRect()

      if (state.lyricGlow && glowStrength > 0) {
        drawAura(ctx, rect, state.displayColors, liveMotion.value, state.opacity)
      }

      if (state.lyricGlow && state.highlightFollow && glowStrength > 0) {
        drawHighlightBloom(
          ctx,
          rect,
          progress,
          state.displayColors,
          liveMotion.value,
          renderedFontSize.value,
          state.opacity
        )
      }

      if (state.lyricGlow && glowStrength > 0) {
        drawGlowText(
          ctx,
          state.text,
          rect,
          state.displayColors,
          liveMotion.value,
          renderedFontSize.value,
          state.fontWeight,
          state.fontFamily,
          state.letterSpacing,
          fitScaleX.value,
          glowStrength,
          state.opacity
        )
      }

      if (state.lyricGlow && state.lyricGlowParticles) {
        drawParticles(
          ctx,
          rect,
          particles.value,
          state.displayColors,
          liveMotion.value,
          glowStrength,
          state.lyricGlowParticles,
          now,
          state.opacity
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
  lineIn.value = false
  requestAnimationFrame(() => {
    lineIn.value = true
  })
}

function applyState(next: Partial<DesktopLyricState>) {
  if (!next) return

  if (next.colors) {
    state.colors = { ...state.colors, ...next.colors }
  }

  Object.assign(state, next)

  state.displayColors = {
    primary: normalizeLyricColor(state.colors.primary || '#f6fdff', '#f6fdff'),
    secondary: normalizeLyricColor(state.colors.secondary || '#a8f6ff', '#a8f6ff'),
    highlight: normalizeLyricColor(state.colors.highlight || '#fff0b8', '#fff0b8'),
    glow: normalizeLyricColor(state.colors.glow || state.colors.secondary || '#9cffdf', '#9cffdf'),
  }

  baseFontSize.value = Math.round(58 * Math.max(0.72, Math.min(1.55, state.size)))
  progressReceivedAt = performance.now()

  document.body.classList.toggle('show', !!state.enabled)
  document.body.classList.toggle('paused', !state.playing)
  document.body.classList.toggle('highlight', state.highlightFollow === true)
  document.body.style.opacity = state.enabled ? String(Math.max(0.28, Math.min(1, state.opacity))) : '0'

  if (state.text !== lastText.value) {
    lastText.value = state.text
    scrollState.value.offset = 0
    scrollState.value.dir = -1
    scrollState.value.holdUntil = performance.now() + 320
    scrollState.value.lastAt = 0
    layoutKey = ''
    replayLineAnimation()
  }

  fitLyricLayout(false)
  updateCssVars()
}

function onClose() {
  emit('close')
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
    state.clickThrough = !state.clickThrough
    emit('lockChange', isLocked.value)
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
})

onActivated(() => {
  startAnimation()
})

onDeactivated(() => {
  stopAnimation()
})

defineExpose({
  applyState,
  state,
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
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  pointer-events: none;
}

.stage {
  position: relative;
  max-width: calc(100vw - 24px);
  padding: 104px 86px 94px;
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
  padding: 1.24em var(--lyric-edge-width, 92px) 1.34em;
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
  color: #fff;
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
  -webkit-text-stroke: 0.18px rgba(255, 255, 255, 0.72);
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

.highlight .line {
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
  animation: lyr-in 820ms cubic-bezier(0.16, 0.84, 0.32, 1.02) forwards;
}

.paused .line {
  filter: none;
  opacity: 0.84;
}

.lock-hint {
  position: absolute;
  z-index: 4;
  left: 50%;
  top: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 92px;
  min-height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--lyric-glow) 58%, rgba(255, 255, 255, 0.36));
  background: rgba(4, 6, 10, 0.44);
  color: rgba(255, 255, 255, 0.84);
  font: 800 12px/1 'Microsoft YaHei', sans-serif;
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.55);
  box-shadow:
    0 0 20px color-mix(in srgb, var(--lyric-glow) 30%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(-8px) scale(0.92);
  transition: opacity 0.16s ease, transform 0.16s ease;
  -webkit-app-region: no-drag;
}

.lock-icon {
  position: relative;
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
}

.lock-icon::before {
  content: '';
  position: absolute;
  left: 2px;
  bottom: 1px;
  width: 9px;
  height: 7px;
  border: 1.7px solid var(--lyric-highlight);
  border-radius: 2px;
  box-sizing: border-box;
}

.lock-icon::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  width: 7px;
  height: 8px;
  border: 1.7px solid var(--lyric-highlight);
  border-bottom: 0;
  border-radius: 7px 7px 0 0;
  box-sizing: border-box;
}

.unlocked .lock-icon::after {
  left: 7px;
  transform: rotate(24deg);
  transform-origin: left bottom;
}

.lyrics-close {
  display: none;
  align-items: center;
  justify-content: center;
  height: 22px;
  width: auto;
  margin-right: -4px;
  border: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.14);
  padding: 0 0 1px 9px;
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
  font: 800 12px/1 'Microsoft YaHei', sans-serif;
  cursor: pointer;
  text-shadow: 0 0 12px var(--lyric-primary);
  -webkit-app-region: no-drag;
}

.lyrics-close:hover {
  color: #fff;
}

.unlocked .lyrics-close {
  display: flex;
}

.unlocked .stage.hint-visible .lock-hint {
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

.stage.hint-visible .lock-hint {
  opacity: 0.94;
  transform: translateX(-50%) translateY(0) scale(1);
}

@keyframes lyr-in {
  0% {
    opacity: 0;
    transform: translate3d(0, 32px, -120px) rotateX(24deg) rotateY(-18deg) scale(0.78);
    filter: blur(12px);
  }
  58% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1);
    filter: blur(0);
  }
}
</style>
