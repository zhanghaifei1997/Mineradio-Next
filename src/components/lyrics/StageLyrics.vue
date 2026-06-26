<template>
  <div v-if="visible" class="stage-lyrics-container">
    <canvas ref="canvasRef" class="lyrics-canvas"></canvas>
    <div class="lyrics-wrap" :style="wrapStyle">
      <div ref="stageRef" class="lyrics-stage" :style="stageStyle">
        <div class="lyric-viewport" :style="viewportStyle">
          <div class="lyric-scroll" :style="scrollStyle">
            <LyricLine
              :key="currentKey"
              :text="currentText"
              :translation="currentTranslation"
              :progress="displayProgress"
              :show="!!currentText"
              :highlight-follow="highlightFollow"
              :primary-color="palette.primary"
              :highlight-color="palette.highlight"
              :glow-color="palette.glow"
              :feather="feather"
              :font-size="renderedFontSize"
              :font-weight="fontWeight"
              :font-family="fontFamily"
              :letter-spacing="letterSpacing"
              :line-height="lineHeight"
              :beat-glow="liveMotion.beat"
              :stroke-color="strokeColor"
              :stroke-width="strokeWidth"
              :stroke-enabled="strokeEnabled"
              :shadow-color="shadowColor"
              :shadow-blur="shadowBlur"
              :shadow-offset-x="shadowOffsetX"
              :shadow-offset-y="shadowOffsetY"
              :shadow-enabled="shadowEnabled"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import LyricLine from './LyricLine.vue'
import {
  type LyricLine as LyricLineType,
  type LyricPalette,
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
} from '@/modules/lyrics'

interface Props {
  visible?: boolean
  lines?: LyricLineType[]
  currentTime?: number
  duration?: number
  playing?: boolean
  currentIndex?: number
  progress?: number
  palette?: Partial<LyricPalette>
  size?: number
  verticalPosition?: number
  horizontalPosition?: number
  depthPosition?: number
  rotationX?: number
  rotationY?: number
  highlightFollow?: boolean
  feather?: number
  fontFamily?: string
  fontWeight?: number
  letterSpacing?: number
  lineHeight?: number
  lyricGlow?: boolean
  lyricGlowBeat?: boolean
  lyricGlowStrength?: number
  lyricGlowParticles?: boolean
  highBloom?: number
  beatGlow?: number
  beatPulse?: number
  bass?: number
  cinema?: boolean
  opacity?: number
  strokeEnabled?: boolean
  strokeColor?: string
  strokeWidth?: number
  shadowEnabled?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  cameraBind?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  lines: () => [],
  currentTime: 0,
  duration: 0,
  playing: false,
  currentIndex: -1,
  progress: 0,
  palette: () => ({}),
  size: 1,
  verticalPosition: 0.76,
  horizontalPosition: 0.5,
  depthPosition: 0,
  rotationX: 0,
  rotationY: 0,
  highlightFollow: false,
  feather: 0.055,
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
  cinema: true,
  opacity: 0.92,
  strokeEnabled: false,
  strokeColor: 'rgba(4, 6, 12, 0.8)',
  strokeWidth: 2,
  shadowEnabled: true,
  shadowColor: 'rgba(4, 6, 12, 0.5)',
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  cameraBind: false,
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)

const liveMotion = ref<LiveMotion>(initLiveMotion())
const particles = ref<Particle[]>([])
const scrollState = ref<ScrollState>(initScrollState())
const renderedFontSize = ref(58)
const fitScaleX = ref(1)
const displayProgress = ref(0)
const displayedProgressInternal = ref(0)
const progressReceivedAt = ref(0)
const lastText = ref('')

let animationId: number | null = null
let ctx: CanvasRenderingContext2D | null = null
let dpr = 1
let lastDrawAt = 0

const palette = computed(() => effectiveLyricPalette(props.palette || {}))

const currentLine = computed(() => {
  if (props.currentIndex >= 0 && props.currentIndex < props.lines.length) {
    return props.lines[props.currentIndex]
  }
  return null
})

const currentText = computed(() => currentLine.value?.text || '')
const currentTranslation = computed(() => currentLine.value?.translation || '')
const currentKey = computed(() => `${props.currentIndex}-${currentText.value}`)

const baseFontSize = computed(() => Math.round(58 * Math.max(0.72, Math.min(1.55, props.size))))

const wrapStyle = computed(() => ({
  alignItems: props.verticalPosition < 0.33 ? 'flex-start' : props.verticalPosition > 0.66 ? 'flex-end' : 'center',
  justifyContent: props.horizontalPosition < 0.33 ? 'flex-start' : props.horizontalPosition > 0.66 ? 'flex-end' : 'center',
  paddingTop: `${props.verticalPosition * 10}vh`,
  paddingBottom: `${(1 - props.verticalPosition) * 10}vh`,
}))

const stageStyle = computed(() => ({
  transform: `perspective(1000px) translateZ(${props.depthPosition * 100}px) rotateX(${props.rotationX}deg) rotateY(${props.rotationY}deg)`,
}))

const viewportStyle = computed(() => ({
  opacity: props.opacity,
}))

const scrollStyle = computed(() => ({
  transform: `translate3d(${scrollState.value.offset.toFixed(2)}px, 0, 0) scaleX(${fitScaleX.value.toFixed(4)})`,
}))

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
}

function updateLayout() {
  if (!ctx || !currentText.value) return

  const result = fitLyricText(
    currentText.value,
    baseFontSize.value,
    {
      fontFamily: props.fontFamily,
      fontWeight: props.fontWeight,
      letterSpacing: props.letterSpacing,
      lineHeight: props.lineHeight,
      fontSize: baseFontSize.value,
      opacity: props.opacity,
      feather: props.feather,
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
}

function currentDisplayProgress(nowMs: number): number {
  const target = Math.max(0, Math.min(1, props.progress))
  const progressSpan = currentLine.value?.duration || 4.8
  let t = target
  if (props.playing && progressSpan > 0) {
    t += Math.max(0, nowMs - progressReceivedAt.value) / (progressSpan * 1000)
  }
  t = Math.max(0, Math.min(1, t))

  if (lastText.value !== currentText.value) {
    lastText.value = currentText.value
    displayedProgressInternal.value = t
  }

  const delta = t - displayedProgressInternal.value
  if (delta < -0.018 && t > 0.035 && displayedProgressInternal.value < 0.985) {
    displayedProgressInternal.value = Math.max(
      0,
      Math.min(1, displayedProgressInternal.value + Math.max(delta * 0.018, -0.0028))
    )
    return displayedProgressInternal.value
  }
  const ease = delta >= 0 ? Math.min(0.3, 0.074 + Math.abs(delta) * 0.5) : Math.min(0.03, 0.008 + Math.abs(delta) * 0.045)
  displayedProgressInternal.value = Math.max(0, Math.min(1, displayedProgressInternal.value + delta * ease))
  return displayedProgressInternal.value
}

function draw(nowMs: number) {
  if (!props.visible) {
    animationId = requestAnimationFrame(draw)
    return
  }

  const dt = lastDrawAt ? Math.min(0.12, Math.max(0.001, (nowMs - lastDrawAt) / 1000)) : 1 / 60
  lastDrawAt = nowMs
  const now = nowMs * 0.001

  const progress = currentDisplayProgress(nowMs)
  displayProgress.value = progress

  const glowStrength = props.lyricGlow ? props.lyricGlowStrength : 0

  updateMotion(
    liveMotion.value,
    now,
    glowStrength,
    props.lyricGlowBeat,
    props.beatGlow,
    props.beatPulse,
    props.bass,
    props.highBloom,
    props.cinema,
    props.playing
  )

  if (stageRef.value) {
    applyStageMotion(stageRef.value, liveMotion.value, now, props.cinema)
  }

  if (scrollState.value.needed) {
    scrollState.value.offset = updateLyricScroll(
      scrollState.value,
      progress,
      currentLine.value?.duration || 4.8,
      window.innerWidth,
      nowMs
    )
  }

  if (ctx && canvasRef.value && currentText.value && stageRef.value) {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    const stageRect = stageRef.value.getBoundingClientRect()

    if (props.lyricGlow && glowStrength > 0) {
      drawAura(ctx, stageRect, palette.value, liveMotion.value, props.opacity)
    }

    if (props.lyricGlow && props.highlightFollow && glowStrength > 0) {
      drawHighlightBloom(
        ctx,
        stageRect,
        progress,
        palette.value,
        liveMotion.value,
        renderedFontSize.value,
        props.opacity
      )
    }

    if (props.lyricGlow && glowStrength > 0) {
      drawGlowText(
        ctx,
        currentText.value,
        stageRect,
        palette.value,
        liveMotion.value,
        renderedFontSize.value,
        props.fontWeight,
        props.fontFamily,
        props.letterSpacing,
        fitScaleX.value,
        glowStrength,
        props.opacity
      )
    }

    if (props.lyricGlow && props.lyricGlowParticles) {
      drawParticles(
        ctx,
        stageRect,
        particles.value,
        palette.value,
        liveMotion.value,
        glowStrength,
        props.lyricGlowParticles,
        now,
        props.opacity
      )
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

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resizeCanvas()
      updateLayout()
      startAnimation()
    } else {
      stopAnimation()
    }
  }
)

watch(currentText, () => {
  progressReceivedAt.value = performance.now()
  updateLayout()
})

watch(
  () => [props.size, props.fontFamily, props.fontWeight, props.letterSpacing, props.lineHeight],
  () => {
    updateLayout()
  }
)

onMounted(() => {
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  if (props.visible) {
    updateLayout()
    startAnimation()
  }
})

onUnmounted(() => {
  stopAnimation()
  window.removeEventListener('resize', resizeCanvas)
})

onActivated(() => {
  if (props.visible) {
    startAnimation()
  }
})

onDeactivated(() => {
  stopAnimation()
})
</script>

<style scoped>
.stage-lyrics-container {
  position: fixed;
  inset: 0;
  z-index: 500;
  pointer-events: none;
  overflow: hidden;
}

.lyrics-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.lyrics-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  pointer-events: none;
}

.lyrics-stage {
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

.lyric-scroll {
  display: inline-block;
  transform-origin: center;
  will-change: transform;
  backface-visibility: hidden;
}
</style>
