<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { extractPaletteFromImage, rgbToHex } from '@/utils/colorUtils'

const props = withDefaults(defineProps<{
  visible?: boolean
  targetColor?: 'accent' | 'glow' | 'bg'
}>(), {
  visible: false,
  targetColor: 'accent',
})

const emit = defineEmits<{
  (e: 'confirm', color: string): void
  (e: 'cancel'): void
}>()

const player = usePlayerStore()

const coverImageRef = ref<HTMLImageElement | null>(null)
const hiddenCanvasRef = ref<HTMLCanvasElement | null>(null)
const loupeCanvasRef = ref<HTMLCanvasElement | null>(null)

const isHovering = ref(false)
const hoverPos = ref({ x: 0, y: 0 })
const selectedColor = ref('#ffffff')
const palette = ref<string[]>([])
const isLoading = ref(false)
const imageLoaded = ref(false)

const coverUrl = computed(() => {
  return player.currentSong?.coverUrl || ''
})

const targetColorName = computed(() => {
  const names: Record<string, string> = {
    accent: '高亮色',
    glow: '发光色',
    bg: '背景色',
  }
  return names[props.targetColor] || '颜色'
})

const loupeSize = 120
const loupeZoom = 6

watch(() => props.visible, (val) => {
  if (val && coverUrl.value) {
    loadImageAndExtractPalette()
  }
})

function loadImageAndExtractPalette() {
  if (!coverUrl.value) return

  isLoading.value = true
  imageLoaded.value = false

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    palette.value = extractPaletteFromImage(img, 8)
    selectedColor.value = palette.value[0] || '#ffffff'
    isLoading.value = false
    imageLoaded.value = true
    nextTick(() => {
      drawCoverToCanvas()
    })
  }
  img.onerror = () => {
    isLoading.value = false
  }
  img.src = coverUrl.value
}

function drawCoverToCanvas() {
  const canvas = hiddenCanvasRef.value
  const img = coverImageRef.value
  if (!canvas || !img) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx.drawImage(img, 0, 0)
}

function getCoverPixelColor(clientX: number, clientY: number): { color: string; r: number; g: number; b: number } | null {
  const canvas = hiddenCanvasRef.value
  const img = coverImageRef.value
  if (!canvas || !img) return null

  const rect = img.getBoundingClientRect()
  const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width)
  const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height)

  if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) return null

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const pixel = ctx.getImageData(x, y, 1, 1).data
  return {
    color: rgbToHex(pixel[0], pixel[1], pixel[2]),
    r: pixel[0],
    g: pixel[1],
    b: pixel[2],
  }
}

function updateLoupe(clientX: number, clientY: number) {
  const canvas = loupeCanvasRef.value
  const srcCanvas = hiddenCanvasRef.value
  const img = coverImageRef.value
  if (!canvas || !srcCanvas || !img) return

  const rect = img.getBoundingClientRect()
  const imgX = ((clientX - rect.left) / rect.width) * srcCanvas.width
  const imgY = ((clientY - rect.top) / rect.height) * srcCanvas.height

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = loupeSize
  const half = size / 2
  const zoom = loupeZoom
  const srcSize = size / zoom

  ctx.clearRect(0, 0, size, size)

  ctx.save()
  ctx.beginPath()
  ctx.arc(half, half, half - 1, 0, Math.PI * 2)
  ctx.clip()

  const sx = Math.max(0, imgX - srcSize / 2)
  const sy = Math.max(0, imgY - srcSize / 2)
  const sw = Math.min(srcSize, srcCanvas.width - sx)
  const sh = Math.min(srcSize, srcCanvas.height - sy)

  const dx = half - (imgX - sx) * zoom
  const dy = half - (imgY - sy) * zoom

  ctx.drawImage(srcCanvas, sx, sy, sw, sh, dx, dy, sw * zoom, sh * zoom)

  ctx.restore()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(half, half, half - 1, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(half - 10, half)
  ctx.lineTo(half + 10, half)
  ctx.moveTo(half, half - 10)
  ctx.lineTo(half, half + 10)
  ctx.stroke()
}

function handleMouseMove(e: MouseEvent) {
  if (!imageLoaded.value) return

  isHovering.value = true
  hoverPos.value = { x: e.clientX, y: e.clientY }

  const pixel = getCoverPixelColor(e.clientX, e.clientY)
  if (pixel) {
    selectedColor.value = pixel.color
    updateLoupe(e.clientX, e.clientY)
  }
}

function handleMouseLeave() {
  isHovering.value = false
}

function handleClick(e: MouseEvent) {
  if (!imageLoaded.value) return

  const pixel = getCoverPixelColor(e.clientX, e.clientY)
  if (pixel) {
    selectedColor.value = pixel.color
  }
}

function selectPaletteColor(color: string) {
  selectedColor.value = color
}

function handleConfirm() {
  emit('confirm', selectedColor.value)
}

function handleCancel() {
  emit('cancel')
}

const loupeStyle = computed(() => {
  const offset = loupeSize / 2 + 20
  return {
    left: `${hoverPos.value.x + offset}px`,
    top: `${hoverPos.value.y - offset}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cover-picker-fade">
      <div v-if="visible" class="cover-color-picker" @mousedown.stop>
        <div class="cover-picker__header">
          <span class="cover-picker__title">封面取色器</span>
          <button class="cover-picker__close" @click="handleCancel">✕</button>
        </div>

        <div class="cover-picker__body">
          <div class="cover-picker__target">
            <span>取色目标：{{ targetColorName }}</span>
          </div>

          <div
            class="cover-picker__image-wrapper"
            @mousemove="handleMouseMove"
            @mouseleave="handleMouseLeave"
            @click="handleClick"
          >
            <div v-if="isLoading" class="cover-picker__loading">加载中...</div>
            <img
              ref="coverImageRef"
              :src="coverUrl"
              :alt="player.currentSong?.name || '封面'"
              class="cover-picker__image"
              crossorigin="anonymous"
              @load="imageLoaded = true; drawCoverToCanvas"
              draggable="false"
            />
            <canvas ref="hiddenCanvasRef" class="cover-picker__hidden-canvas"></canvas>
          </div>

          <div class="cover-picker__palette">
            <div class="palette-label">推荐色板</div>
            <div class="palette-grid">
              <div
                v-for="color in palette"
                :key="color"
                class="palette-color"
                :style="{ backgroundColor: color }"
                :class="{ active: selectedColor.toLowerCase() === color.toLowerCase() }"
                @click="selectPaletteColor(color)"
              ></div>
            </div>
          </div>

          <div class="cover-picker__selected">
            <div class="selected-label">当前选中</div>
            <div class="selected-preview" :style="{ backgroundColor: selectedColor }"></div>
            <div class="selected-hex">{{ selectedColor.toUpperCase() }}</div>
          </div>

          <div class="cover-picker__actions">
            <button class="btn btn-cancel" @click="handleCancel">取消</button>
            <button class="btn btn-confirm" @click="handleConfirm">确认应用</button>
          </div>
        </div>

        <Transition name="loupe-fade">
          <div
            v-if="isHovering && imageLoaded"
            class="cover-picker__loupe"
            :style="loupeStyle"
          >
            <canvas ref="loupeCanvasRef" :width="loupeSize" :height="loupeSize"></canvas>
            <div class="loupe-color" :style="{ backgroundColor: selectedColor }"></div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cover-color-picker {
  position: fixed;
  z-index: 2000;
  width: 320px;
  background: var(--color-surface);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  color: var(--color-text);
}

.cover-picker-fade-enter-active,
.cover-picker-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.cover-picker-fade-enter-from,
.cover-picker-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.cover-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.cover-picker__title {
  font-size: 14px;
  font-weight: 600;
}

.cover-picker__close {
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

.cover-picker__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.cover-picker__body {
  padding: 16px;
}

.cover-picker__target {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 12px;
}

.cover-picker__image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  cursor: crosshair;
  margin-bottom: 16px;
  border: 1px solid var(--color-border);
}

.cover-picker__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

.cover-picker__hidden-canvas {
  display: none;
}

.cover-picker__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 13px;
}

.cover-picker__palette {
  margin-bottom: 16px;
}

.palette-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.palette-grid {
  display: flex;
  gap: 6px;
}

.palette-color {
  flex: 1;
  aspect-ratio: 1;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.15s, border-color 0.15s;
}

.palette-color:hover {
  transform: scale(1.1);
}

.palette-color.active {
  border-color: var(--color-text);
}

.cover-picker__selected {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.selected-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.selected-preview {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.selected-hex {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--color-text);
}

.cover-picker__actions {
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

.cover-picker__loupe {
  position: fixed;
  pointer-events: none;
  z-index: 2001;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.loupe-fade-enter-active,
.loupe-fade-leave-active {
  transition: opacity 0.15s ease;
}

.loupe-fade-enter-from,
.loupe-fade-leave-to {
  opacity: 0;
}

.cover-picker__loupe canvas {
  display: block;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.loupe-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
</style>
