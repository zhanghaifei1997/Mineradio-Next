<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useFxStore } from '@/stores/fx'
import { usePlayerStore } from '@/stores/player'
import { useDjStore } from '@/stores/dj'
import { VisualEngine } from '@/modules/visual'
import type { FxSettings } from '@/types'

const emit = defineEmits<{
  (e: 'freeCameraChange', active: boolean): void
}>()

const fx = useFxStore()
const player = usePlayerStore()
const dj = useDjStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const engineReady = ref(false)
let visualEngine: VisualEngine | null = null
let initTimer: number | null = null

const fxSettingsForEngine = computed<FxSettings>(() => ({
  ...fx.settings,
}))

function initVisualEngine() {
  if (!canvasRef.value || visualEngine) return

  visualEngine = new VisualEngine({
    canvas: canvasRef.value,
    fxSettings: fxSettingsForEngine.value,
  })

  connectToPlayerAudio()
  updateDjModeInEngine()

  if (fx.freeCameraEnabled) {
    visualEngine.getCameraSystem().toggleFreeCamera()
  }

  // 引擎初始化完成，触发淡入动画
  engineReady.value = true
}

function connectToPlayerAudio() {
  if (!visualEngine || !player.audio || !player.audioAnalyzer) return
  
  const audioAnalyzer = player.audioAnalyzer
  if (audioAnalyzer.audioContext && audioAnalyzer.analyser) {
    visualEngine.connectAnalyser(
      audioAnalyzer.audioContext,
      audioAnalyzer.analyser,
      player.audio
    )
  }
}

function updateDjModeInEngine() {
  if (!visualEngine) return
  visualEngine.setDjMode(dj.isDjModeActive, {
    intensity: dj.djConfig.intensity,
    visualBoost: dj.djConfig.visualBoost,
    cameraShake: dj.djConfig.cameraShake ? dj.djMode.visualPulse * dj.djConfig.intensity : 0,
    particleBoost: dj.djConfig.particleBoost ? 1 + dj.djMode.sectionEnergy * dj.djConfig.intensity * 0.5 : 1,
  })
}

watch(
  () => player.audioAnalyzer,
  (analyzer) => {
    if (visualEngine && analyzer && player.audio) {
      if (analyzer.audioContext && analyzer.analyser) {
        visualEngine.connectAnalyser(
          analyzer.audioContext,
          analyzer.analyser,
          player.audio
        )
      }
    }
  },
)

watch(
  fxSettingsForEngine,
  (settings) => {
    if (visualEngine) {
      visualEngine.updateFxSettings(settings)
    }
  },
  { deep: true },
)

watch(
  () => fx.resetVersion,
  () => {
    if (visualEngine) {
      // Force full preset reinitialization on settings reset
      visualEngine.forceReinitPreset()
    }
  },
)

watch(
  () => [dj.isDjModeActive, dj.djConfig, dj.djMode.visualPulse, dj.djMode.sectionEnergy],
  () => {
    updateDjModeInEngine()
  },
  { deep: true },
)

watch(
  () => fx.freeCameraEnabled,
  (enabled) => {
    if (!visualEngine) return
    const cam = visualEngine.getCameraSystem()
    if (enabled !== cam.isFreeCameraActive()) {
      cam.toggleFreeCamera()
      emit('freeCameraChange', enabled)
    }
  },
)

function handleKeyDown(e: KeyboardEvent) {
  if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const target = e.target as HTMLElement
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }
    e.preventDefault()
    fx.toggleFreeCamera()
  }
}

function handleContextLost(e: Event) {
  e.preventDefault()
  console.warn('[VisualCanvas] WebGL context lost, will attempt restore')
}

function handleContextRestored() {
  console.info('[VisualCanvas] WebGL context restored, reinitializing engine')
  if (visualEngine) {
    visualEngine.dispose()
    visualEngine = null
  }
  engineReady.value = false
  initVisualEngine()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  // WebGL 上下文丢失保护：Electron transparent 窗口可能导致 context lost
  canvasRef.value?.addEventListener('webglcontextlost', handleContextLost)
  canvasRef.value?.addEventListener('webglcontextrestored', handleContextRestored)

  // 延迟初始化 WebGL：让页面 UI 先渲染完成
  // 避免与 Splash 的 WebGL 上下文同时存在，防止 GPU 合成器冲突导致黑屏
  if (typeof requestIdleCallback !== 'undefined') {
    initTimer = requestIdleCallback(() => initVisualEngine(), { timeout: 2000 }) as unknown as number
  } else {
    initTimer = window.setTimeout(() => initVisualEngine(), 300)
  }
})

onUnmounted(() => {
  // 取消延迟初始化定时器
  if (initTimer !== null) {
    if (typeof cancelIdleCallback !== 'undefined') {
      cancelIdleCallback(initTimer)
    } else {
      clearTimeout(initTimer)
    }
    initTimer = null
  }
  window.removeEventListener('keydown', handleKeyDown)
  canvasRef.value?.removeEventListener('webglcontextlost', handleContextLost)
  canvasRef.value?.removeEventListener('webglcontextrestored', handleContextRestored)
  if (visualEngine) {
    visualEngine.dispose()
    visualEngine = null
  }
})

function toggleFreeCamera() {
  visualEngine?.getCameraSystem().toggleFreeCamera()
}

defineExpose({
  toggleFreeCamera,
  getEngine: () => visualEngine,
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="visual-canvas"
    :class="{ 'visual-canvas--ready': engineReady }"
  ></canvas>
</template>

<style scoped>
.visual-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 600ms ease-out;
}
.visual-canvas--ready {
  opacity: 1;
}
</style>
