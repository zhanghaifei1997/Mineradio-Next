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
let visualEngine: VisualEngine | null = null

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

onMounted(() => {
  initVisualEngine()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
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
  <canvas ref="canvasRef" class="visual-canvas"></canvas>
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
}
</style>
