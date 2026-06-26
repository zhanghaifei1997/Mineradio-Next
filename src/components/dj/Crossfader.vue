<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  labelA?: string
  labelB?: string
  colorA?: string
  colorB?: string
}>(), {
  min: 0,
  max: 1,
  step: 0.01,
  labelA: 'A',
  labelB: 'B',
  colorA: '#d95b67',
  colorB: '#4ecdc4',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const sliderRef = ref<HTMLDivElement | null>(null)
const isDragging = ref(false)

const percent = computed(() => {
  const range = props.max - props.min
  return ((props.modelValue - props.min) / range) * 100
})

function handleMouseDown(e: MouseEvent) {
  isDragging.value = true
  updateValue(e)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  updateValue(e)
}

function handleMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

function updateValue(e: MouseEvent) {
  if (!sliderRef.value) return
  const rect = sliderRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  let ratio = x / rect.width
  ratio = Math.max(0, Math.min(1, ratio))
  const range = props.max - props.min
  let value = props.min + ratio * range
  value = Math.round(value / props.step) * props.step
  emit('update:modelValue', value)
}

function setToA() {
  emit('update:modelValue', props.min)
}

function setToCenter() {
  const center = (props.min + props.max) / 2
  emit('update:modelValue', center)
}

function setToB() {
  emit('update:modelValue', props.max)
}
</script>

<template>
  <div class="crossfader-component">
    <div class="crossfader-labels">
      <span class="label label-a" :style="{ color: colorA }">{{ labelA }}</span>
      <span class="label label-b" :style="{ color: colorB }">{{ labelB }}</span>
    </div>
    <div
      ref="sliderRef"
      class="crossfader-slider"
      :class="{ dragging: isDragging }"
      @mousedown="handleMouseDown"
    >
      <div class="slider-track">
        <div
          class="slider-fill-a"
          :style="{ width: 100 - percent + '%', background: colorA }"
        />
        <div
          class="slider-fill-b"
          :style="{ width: percent + '%', background: colorB }"
        />
      </div>
      <div
        class="slider-thumb"
        :style="{ left: `calc(${percent}% - 14px)` }"
      >
        <div class="thumb-grip">
          <div class="grip-line"></div>
          <div class="grip-line"></div>
          <div class="grip-line"></div>
        </div>
      </div>
    </div>
    <div class="crossfader-buttons">
      <button class="xfade-btn" @click="setToA" :style="{ borderColor: colorA, color: colorA }">
        {{ labelA }}
      </button>
      <button class="xfade-btn xfade-center" @click="setToCenter">
        ●
      </button>
      <button class="xfade-btn" @click="setToB" :style="{ borderColor: colorB, color: colorB }">
        {{ labelB }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.crossfader-component {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.crossfader-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 4px;
}

.label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.crossfader-slider {
  position: relative;
  height: 36px;
  cursor: pointer;
  padding: 0 4px;
}

.slider-track {
  position: absolute;
  top: 50%;
  left: 4px;
  right: 4px;
  height: 8px;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}

.slider-fill-a,
.slider-fill-b {
  height: 100%;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.crossfader-slider:hover .slider-fill-a,
.crossfader-slider:hover .slider-fill-b,
.crossfader-slider.dragging .slider-fill-a,
.crossfader-slider.dragging .slider-fill-b {
  opacity: 0.8;
}

.slider-thumb {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 36px;
  transform: translateY(-50%);
  background: linear-gradient(180deg, #ffffff 0%, #e0e0e0 100%);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.15s;
}

.crossfader-slider.dragging .slider-thumb {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.thumb-grip {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.grip-line {
  width: 16px;
  height: 2px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 1px;
}

.crossfader-buttons {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.xfade-btn {
  width: 32px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.xfade-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.xfade-center {
  font-size: 8px;
}
</style>
