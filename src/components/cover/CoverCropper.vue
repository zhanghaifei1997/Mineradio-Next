<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  imageUrl: string
  aspectRatio?: number
  outputSize?: number
}>()

const emit = defineEmits<{
  (e: 'confirm', dataUrl: string): void
  (e: 'cancel'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const imageLoaded = ref(false)
const img = new Image()
img.crossOrigin = 'anonymous'

const containerSize = ref({ width: 0, height: 0 })
const imagePosition = ref({ x: 0, y: 0 })
const imageScale = ref(1)
const cropSize = ref(0)

let isDragging = false
let startX = 0
let startY = 0
let startImgX = 0
let startImgY = 0

const aspect = props.aspectRatio || 1
const outputSize = props.outputSize || 512

function loadImage() {
  imageLoaded.value = false
  img.onload = () => {
    imageLoaded.value = true
    resetImagePosition()
    draw()
  }
  img.src = props.imageUrl
}

function resetImagePosition() {
  if (!containerRef.value || !img.width) return
  
  const container = containerRef.value
  const minSide = Math.min(container.clientWidth, container.clientHeight)
  cropSize.value = minSide * 0.8
  
  const imgRatio = img.width / img.height
  const cropRatio = aspect
  
  let scale: number
  if (imgRatio > cropRatio) {
    scale = cropSize.value / img.height
  } else {
    scale = cropSize.value / img.width
  }
  
  imageScale.value = Math.max(scale, 1)
  
  imagePosition.value = {
    x: container.clientWidth / 2,
    y: container.clientHeight / 2,
  }
}

function draw() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container || !imageLoaded.value) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  const imgW = img.width * imageScale.value
  const imgH = img.height * imageScale.value
  const imgX = imagePosition.value.x - imgW / 2
  const imgY = imagePosition.value.y - imgH / 2
  
  ctx.drawImage(img, imgX, imgY, imgW, imgH)
  
  const cropX = (canvas.width - cropSize.value) / 2
  const cropY = (canvas.height - cropSize.value) / 2
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  ctx.fillRect(0, 0, canvas.width, cropY)
  ctx.fillRect(0, cropY + cropSize.value, canvas.width, canvas.height - cropY - cropSize.value)
  ctx.fillRect(0, cropY, cropX, cropSize.value)
  ctx.fillRect(cropX + cropSize.value, cropY, canvas.width - cropX - cropSize.value, cropSize.value)
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.lineWidth = 2
  ctx.strokeRect(cropX, cropY, cropSize.value, cropSize.value)
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 1
  const third = cropSize.value / 3
  ctx.beginPath()
  ctx.moveTo(cropX + third, cropY)
  ctx.lineTo(cropX + third, cropY + cropSize.value)
  ctx.moveTo(cropX + third * 2, cropY)
  ctx.lineTo(cropX + third * 2, cropY + cropSize.value)
  ctx.moveTo(cropX, cropY + third)
  ctx.lineTo(cropX + cropSize.value, cropY + third)
  ctx.moveTo(cropX, cropY + third * 2)
  ctx.lineTo(cropX + cropSize.value, cropY + third * 2)
  ctx.stroke()
}

function getCroppedImage(): string | null {
  if (!imageLoaded.value || !img.width) return null
  
  const cropX = imagePosition.value.x - cropSize.value / 2
  const cropY = imagePosition.value.y - cropSize.value / 2
  
  const sourceX = (cropX - (imagePosition.value.x - (img.width * imageScale.value) / 2)) / imageScale.value
  const sourceY = (cropY - (imagePosition.value.y - (img.height * imageScale.value) / 2)) / imageScale.value
  const sourceSize = cropSize.value / imageScale.value
  
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputSize
  outputCanvas.height = outputSize
  const ctx = outputCanvas.getContext('2d')
  if (!ctx) return null
  
  ctx.drawImage(
    img,
    Math.max(0, sourceX),
    Math.max(0, sourceY),
    Math.min(img.width - sourceX, sourceSize),
    Math.min(img.height - sourceY, sourceSize),
    Math.max(0, -sourceX * (outputSize / sourceSize)),
    Math.max(0, -sourceY * (outputSize / sourceSize)),
    Math.min(img.width - sourceX, sourceSize) * (outputSize / sourceSize),
    Math.min(img.height - sourceY, sourceSize) * (outputSize / sourceSize)
  )
  
  return outputCanvas.toDataURL('image/jpeg', 0.92)
}

function handleMouseDown(e: MouseEvent) {
  if (!imageLoaded.value) return
  isDragging = true
  startX = e.clientX
  startY = e.clientY
  startImgX = imagePosition.value.x
  startImgY = imagePosition.value.y
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  imagePosition.value.x = startImgX + dx
  imagePosition.value.y = startImgY + dy
  draw()
}

function handleMouseUp() {
  isDragging = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  if (!imageLoaded.value) return
  
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newScale = Math.max(0.5, Math.min(5, imageScale.value * delta))
  imageScale.value = newScale
  draw()
}

function handleConfirm() {
  const result = getCroppedImage()
  if (result) {
    emit('confirm', result)
  }
}

function handleCancel() {
  emit('cancel')
}

function handleResize() {
  if (containerRef.value) {
    containerSize.value = {
      width: containerRef.value.clientWidth,
      height: containerRef.value.clientHeight,
    }
    resetImagePosition()
    draw()
  }
}

watch(() => props.imageUrl, () => {
  loadImage()
})

onMounted(() => {
  loadImage()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <div class="cover-cropper">
    <div class="cover-cropper__container" ref="containerRef" @mousedown="handleMouseDown" @wheel="handleWheel">
      <canvas ref="canvasRef" class="cover-cropper__canvas"></canvas>
    </div>
    
    <div class="cover-cropper__hint">
      <span>拖动移动 · 滚轮缩放</span>
    </div>
    
    <div class="cover-cropper__actions">
      <button class="cover-cropper__btn cover-cropper__btn--cancel" @click="handleCancel">
        取消
      </button>
      <button class="cover-cropper__btn cover-cropper__btn--confirm" @click="handleConfirm">
        确认裁剪
      </button>
    </div>
  </div>
</template>

<style scoped>
.cover-cropper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cover-cropper__container {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: #000;
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.cover-cropper__container:active {
  cursor: grabbing;
}

.cover-cropper__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.cover-cropper__hint {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.cover-cropper__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cover-cropper__btn {
  padding: 10px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cover-cropper__btn--cancel {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.cover-cropper__btn--cancel:hover {
  background: var(--color-hover);
}

.cover-cropper__btn--confirm {
  background: var(--color-accent);
  color: white;
}

.cover-cropper__btn--confirm:hover {
  background: var(--color-accent-light);
}
</style>
