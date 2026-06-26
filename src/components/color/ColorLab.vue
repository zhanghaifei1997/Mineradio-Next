<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { hslToHex, hexToHsl, isValidHex, normalizeHex, type HSL } from '@/utils/colorUtils'

const props = withDefaults(defineProps<{
  modelValue: string
  visible?: boolean
}>(), {
  visible: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'confirm', value: string): void
  (e: 'cancel'): void
}>()

const svCanvasRef = ref<HTMLCanvasElement | null>(null)
const hueCanvasRef = ref<HTMLCanvasElement | null>(null)
const hexInput = ref('')
const isDraggingSv = ref(false)
const isDraggingHue = ref(false)

const hsl = ref<HSL>({ h: 0, s: 100, l: 50 })

const presetColors = [
  '#ff5252', '#ff9800', '#ffeb3b', '#4caf50',
  '#00bcd4', '#2196f3', '#9c27b0', '#e91e63',
  '#795548', '#607d8b', '#000000', '#ffffff',
]

watch(() => props.modelValue, (val) => {
  const result = hexToHsl(val)
  if (result) {
    hsl.value = result
    hexInput.value = val
  }
}, { immediate: true })

const currentColor = computed(() => {
  return hslToHex(hsl.value.h, hsl.value.s, hsl.value.l)
})

const hueColor = computed(() => {
  return hslToHex(hsl.value.h, 100, 50)
})

function drawSvCanvas() {
  const canvas = svCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  const hue = hsl.value.h
  const hueRgb = hexToHsl(hslToHex(hue, 100, 50))

  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(1, hslToHex(hue, 100, 50))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const gradientV = ctx.createLinearGradient(0, 0, 0, height)
  gradientV.addColorStop(0, 'rgba(0, 0, 0, 0)')
  gradientV.addColorStop(1, '#000000')
  ctx.fillStyle = gradientV
  ctx.fillRect(0, 0, width, height)
}

function drawHueCanvas() {
  const canvas = hueCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height

  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  const hueStops = [0, 60, 120, 180, 240, 300, 360]
  for (let i = 0; i < hueStops.length; i++) {
    gradient.addColorStop(i / (hueStops.length - 1), `hsl(${hueStops[i]}, 100%, 50%)`)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

function getSvPosition(e: MouseEvent) {
  const canvas = svCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  return { x, y, rect }
}
function handleSvMouseDown(e: MouseEvent) {
  isDraggingSv.value = true
  updateFromSv(e)
  window.addEventListener('mousemove', handleSvMouseMove)
  window.addEventListener('mouseup', handleSvMouseUp)
}

function handleSvMouseMove(e: MouseEvent) {
  if (!isDraggingSv.value) return
  updateFromSv(e)
}

function handleSvMouseUp() {
  isDraggingSv.value = false
  window.removeEventListener('mousemove', handleSvMouseMove)
  window.removeEventListener('mouseup', handleSvMouseUp)
}

function updateFromSv(e: MouseEvent) {
  const pos = getSvPosition(e)
  if (!pos) return
  const { x, y, rect } = pos
  hsl.value.s = (x / rect.width) * 100
  hsl.value.l = (1 - y / rect.height) * 100
  emit('update:modelValue', currentColor.value)
  hexInput.value = currentColor.value
}

function getHuePosition(e: MouseEvent) {
  const canvas = hueCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  return { y, rect }
}

function handleHueMouseDown(e: MouseEvent) {
  isDraggingHue.value = true
  updateFromHue(e)
  window.addEventListener('mousemove', handleHueMouseMove)
  window.addEventListener('mouseup', handleHueMouseUp)
}

function handleHueMouseMove(e: MouseEvent) {
  if (!isDraggingHue.value) return
  updateFromHue(e)
}

function handleHueMouseUp() {
  isDraggingHue.value = false
  window.removeEventListener('mousemove', handleHueMouseMove)
  window.removeEventListener('mouseup', handleHueMouseUp)
}

function updateFromHue(e: MouseEvent) {
  const pos = getHuePosition(e)
  if (!pos) return
  const { y, rect } = pos
  hsl.value.h = (y / rect.height) * 360
  drawSvCanvas()
  emit('update:modelValue', currentColor.value)
  hexInput.value = currentColor.value
}

function handleHexInput(e: Event) {
  const target = e.target as HTMLInputElement
  const val = target.value
  hexInput.value = val
  if (isValidHex(val)) {
    const normalized = normalizeHex(val)
    const result = hexToHsl(normalized)
    if (result) {
      hsl.value = result
      drawSvCanvas()
      emit('update:modelValue', normalized)
    }
  }
}

function selectPreset(color: string) {
  const result = hexToHsl(color)
  if (result) {
    hsl.value = result
    drawSvCanvas()
    emit('update:modelValue', color)
    hexInput.value = color
  }
}

function handleConfirm() {
  emit('confirm', currentColor.value)
}

function handleCancel() {
  emit('cancel')
}

onMounted(() => {
  nextTick(() => {
    drawSvCanvas()
    drawHueCanvas()
  })
})

watch(() => hsl.value.h, () => {
  drawSvCanvas()
})
</script>

<template>
  <Transition name="color-lab-fade">
    <div v-if="visible" class="color-lab" @mousedown.stop>
      <div class="color-lab__header">
        <span class="color-lab__title">颜色实验室</span>
        <button class="color-lab__close" @click="handleCancel">✕</button>
      </div>

      <div class="color-lab__body">
        <div class="color-lab__main">
          <div
            class="sv-panel"
            @mousedown="handleSvMouseDown"
          >
            <canvas ref="svCanvasRef" width="220" height="220"></canvas>
            <div
              class="sv-handle"
              :style="{
                left: `${hsl.s}%`,
                top: `${100 - hsl.l}%`,
                borderColor: hsl.l > 50 ? '#000' : '#fff',
              }"
            ></div>
          </div>

          <div
            class="hue-panel"
            @mousedown="handleHueMouseDown"
          >
            <canvas ref="hueCanvasRef" width="20" height="220"></canvas>
            <div
              class="hue-handle"
              :style="{ top: `${(hsl.h / 360) * 100}%` }"
            ></div>
          </div>
        </div>

        <div class="color-lab__preview-row">
          <div class="color-preview" :style="{ backgroundColor: currentColor }"></div>
          <div class="color-lab__hex">
            <label>Hex</label>
            <input
              type="text"
              v-model="hexInput"
              @input="handleHexInput"
              maxlength="7"
            />
          </div>
        </div>

        <div class="color-lab__presets">
          <div class="presets-label">预设色板</div>
          <div class="presets-grid">
            <div
              v-for="color in presetColors"
              :key="color"
              class="preset-color"
              :style="{ backgroundColor: color }"
              :class="{ active: currentColor.toLowerCase() === color.toLowerCase() }"
              @click="selectPreset(color)"
            ></div>
          </div>
        </div>

        <div class="color-lab__actions">
          <button class="btn btn-cancel" @click="handleCancel">取消</button>
          <button class="btn btn-confirm" @click="handleConfirm">确认</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.color-lab {
  position: absolute;
  z-index: 100;
  width: 300px;
  background: var(--color-surface);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  color: var(--color-text);
}

.color-lab-fade-enter-active,
.color-lab-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.color-lab-fade-enter-from,
.color-lab-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.color-lab__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.color-lab__title {
  font-size: 14px;
  font-weight: 600;
}

.color-lab__close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.color-lab__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.color-lab__body {
  padding: 16px;
}

.color-lab__main {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.sv-panel {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 8px;
  cursor: crosshair;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.sv-panel canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.sv-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  border: 2px solid;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.hue-panel {
  position: relative;
  width: 20px;
  height: 220px;
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.hue-panel canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.hue-handle {
  position: absolute;
  left: -2px;
  right: -2px;
  height: 6px;
  transform: translateY(-50%);
  border: 2px solid white;
  border-radius: 3px;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.color-lab__preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.color-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid var(--color-border);
  flex-shrink: 0;
}

.color-lab__hex {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-lab__hex label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.color-lab__hex input {
  padding: 6px 10px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.color-lab__hex input:focus {
  border-color: var(--color-primary);
}

.color-lab__presets {
  margin-bottom: 16px;
}

.presets-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 4px;
}

.preset-color {
  aspect-ratio: 1;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.15s, border-color 0.15s;
}

.preset-color:hover {
  transform: scale(1.15);
}

.preset-color.active {
  border-color: var(--color-text);
}

.color-lab__actions {
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid var(--color-border);
  transition: all 0.2s;
}

.btn-cancel {
  background: transparent;
  color: var(--color-text-secondary);
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text);
}

.btn-confirm {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.btn-confirm:hover {
  filter: brightness(1.1);
}
</style>
