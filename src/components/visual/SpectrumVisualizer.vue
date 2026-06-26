<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'

export type SpectrumMode = 'bars' | 'waveform' | 'circular'

const props = withDefaults(defineProps<{
  mode?: SpectrumMode
  width?: number
  height?: number
  barCount?: number
  showPeaks?: boolean
}>(), {
  mode: 'bars',
  width: 400,
  height: 100,
  barCount: 64,
  showPeaks: true,
})

const emit = defineEmits<{
  (e: 'modeChange', mode: SpectrumMode): void
}>()

const player = usePlayerStore()
const fx = useFxStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animationId: number | null = null
let ctx: CanvasRenderingContext2D | null = null

const peakBars = ref<number[]>([])
const peakDecay = 0.02

const currentMode = ref<SpectrumMode>(props.mode)

const displayWidth = computed(() => props.width)
const displayHeight = computed(() => props.height)

function initCanvas() {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = displayWidth.value * dpr
  canvasRef.value.height = displayHeight.value * dpr
  ctx.scale(dpr, dpr)

  peakBars.value = new Array(props.barCount).fill(0)
}

function getFrequencyData(): Uint8Array | null {
  const analyzer = player.audioAnalyzer
  if (!analyzer || !analyzer.analyser) return null
  return analyzer.getFrequencyData()
}

function getTimeDomainData(): Uint8Array | null {
  const analyzer = player.audioAnalyzer
  if (!analyzer || !analyzer.beatAnalyser) return null
  return analyzer.getTimeDomainData()
}

function drawBars() {
  if (!ctx || !canvasRef.value) return

  const w = displayWidth.value
  const h = displayHeight.value
  const data = getFrequencyData()

  ctx.clearRect(0, 0, w, h)

  if (!data) {
    drawPlaceholder(w, h)
    return
  }

  const barCount = props.barCount
  const barWidth = w / barCount - 2
  const usableBins = Math.floor(data.length * 0.7)

  const gradient = ctx.createLinearGradient(0, h, 0, 0)
  gradient.addColorStop(0, fx.settings.accentColor)
  gradient.addColorStop(0.5, fx.settings.glowColor)
  gradient.addColorStop(1, '#ffffff')

  for (let i = 0; i < barCount; i++) {
    const binIndex = Math.floor((i / barCount) * usableBins)
    const value = data[binIndex] / 255
    const barHeight = value * h * 0.9

    if (value > peakBars.value[i]) {
      peakBars.value[i] = value
    } else {
      peakBars.value[i] = Math.max(0, peakBars.value[i] - peakDecay)
    }

    const x = i * (barWidth + 2)
    const y = h - barHeight

    ctx.fillStyle = gradient
    ctx.fillRect(x, y, barWidth, barHeight)

    if (props.showPeaks) {
      const peakY = h - peakBars.value[i] * h * 0.9
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, peakY - 2, barWidth, 2)
    }
  }
}

function drawWaveform() {
  if (!ctx || !canvasRef.value) return

  const w = displayWidth.value
  const h = displayHeight.value
  const data = getTimeDomainData()

  ctx.clearRect(0, 0, w, h)

  if (!data) {
    drawPlaceholder(w, h)
    return
  }

  ctx.lineWidth = 2
  ctx.strokeStyle = fx.settings.accentColor
  ctx.beginPath()

  const sliceWidth = w / data.length
  let x = 0

  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const y = (v * h) / 2

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    x += sliceWidth
  }

  ctx.lineTo(w, h / 2)
  ctx.stroke()

  ctx.lineWidth = 1
  ctx.strokeStyle = fx.settings.glowColor + '60'
  ctx.beginPath()
  x = 0
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const y = h - (v * h) / 2

    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }

    x += sliceWidth
  }
  ctx.lineTo(w, h / 2)
  ctx.stroke()

  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, fx.settings.glowColor + '20')
  gradient.addColorStop(0.5, fx.settings.accentColor + '10')
  gradient.addColorStop(1, fx.settings.glowColor + '20')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}

function drawCircular() {
  if (!ctx || !canvasRef.value) return

  const w = displayWidth.value
  const h = displayHeight.value
  const data = getFrequencyData()

  ctx.clearRect(0, 0, w, h)

  if (!data) {
    drawPlaceholder(w, h)
    return
  }

  const centerX = w / 2
  const centerY = h / 2
  const baseRadius = Math.min(w, h) * 0.25
  const barCount = props.barCount * 2
  const usableBins = Math.floor(data.length * 0.7)

  const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.5, centerX, centerY, baseRadius * 1.5)
  gradient.addColorStop(0, fx.settings.accentColor)
  gradient.addColorStop(1, fx.settings.glowColor)

  for (let i = 0; i < barCount; i++) {
    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2
    const binIndex = Math.floor((i / barCount) * usableBins)
    const value = data[binIndex] / 255
    const barHeight = value * baseRadius * 0.8

    const innerRadius = baseRadius
    const outerRadius = baseRadius + barHeight

    const x1 = centerX + Math.cos(angle) * innerRadius
    const y1 = centerY + Math.sin(angle) * innerRadius
    const x2 = centerX + Math.cos(angle) * outerRadius
    const y2 = centerY + Math.sin(angle) * outerRadius

    ctx.strokeStyle = gradient
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(centerX, centerY, baseRadius - 2, 0, Math.PI * 2)
  ctx.strokeStyle = fx.settings.accentColor + '60'
  ctx.lineWidth = 2
  ctx.stroke()

  const timeData = getTimeDomainData()
  if (timeData) {
    ctx.beginPath()
    ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2)
    ctx.strokeStyle = fx.settings.glowColor + '40'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.beginPath()
    for (let i = 0; i < timeData.length; i++) {
      const angle = (i / timeData.length) * Math.PI * 2 - Math.PI / 2
      const v = (timeData[i] / 128.0 - 1) * 0.5
      const r = baseRadius * 0.5 + v * baseRadius * 0.3
      const x = centerX + Math.cos(angle) * r
      const y = centerY + Math.sin(angle) * r
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.strokeStyle = fx.settings.accentColor + '80'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawPlaceholder(w: number, h: number) {
  if (!ctx) return
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.fillRect(0, 0, w, h)
}

function animate() {
  switch (currentMode.value) {
    case 'bars':
      drawBars()
      break
    case 'waveform':
      drawWaveform()
      break
    case 'circular':
      drawCircular()
      break
  }
  animationId = requestAnimationFrame(animate)
}

function toggleMode() {
  const modes: SpectrumMode[] = ['bars', 'waveform', 'circular']
  const currentIndex = modes.indexOf(currentMode.value)
  currentMode.value = modes[(currentIndex + 1) % modes.length]
  emit('modeChange', currentMode.value)
}

onMounted(() => {
  initCanvas()
  animate()
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

watch(() => props.mode, (newMode) => {
  currentMode.value = newMode
})

watch([displayWidth, displayHeight], () => {
  initCanvas()
})

defineExpose({
  toggleMode,
  currentMode,
})
</script>

<template>
  <div class="spectrum-visualizer" @click="toggleMode">
    <canvas
      ref="canvasRef"
      class="spectrum-canvas"
      :style="{ width: displayWidth + 'px', height: displayHeight + 'px' }"
    />
    <div class="mode-indicator">{{ currentMode === 'bars' ? '频谱条' : currentMode === 'waveform' ? '波形' : '环形' }}</div>
  </div>
</template>

<style scoped>
.spectrum-visualizer {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}

.spectrum-canvas {
  display: block;
}

.mode-indicator {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  pointer-events: none;
}
</style>
