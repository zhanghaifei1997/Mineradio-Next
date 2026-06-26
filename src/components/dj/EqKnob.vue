<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  modelValue: number
  min?: number
  max?: number
  step?: number
  color?: string
}>(), {
  min: -12,
  max: 12,
  step: 0.5,
  color: '#d95b67',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const isDragging = ref(false)
const startY = ref(0)
const startValue = ref(0)

const normalizedValue = computed(() => {
  const range = props.max - props.min
  return ((props.modelValue - props.min) / range) * 100
})

const rotation = computed(() => {
  const range = props.max - props.min
  const percent = (props.modelValue - props.min) / range
  return -135 + percent * 270
})

const displayValue = computed(() => {
  const val = props.modelValue
  return val > 0 ? `+${val.toFixed(1)}` : val.toFixed(1)
})

function handleMouseDown(e: MouseEvent) {
  isDragging.value = true
  startY.value = e.clientY
  startValue.value = props.modelValue
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  const dy = startY.value - e.clientY
  const range = props.max - props.min
  const sensitivity = range / 100
  let newValue = startValue.value + dy * sensitivity
  newValue = Math.max(props.min, Math.min(props.max, newValue))
  newValue = Math.round(newValue / props.step) * props.step
  emit('update:modelValue', newValue)
}

function handleMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -props.step : props.step
  let newValue = props.modelValue + delta
  newValue = Math.max(props.min, Math.min(props.max, newValue))
  emit('update:modelValue', newValue)
}

function reset() {
  emit('update:modelValue', 0)
}
</script>

<template>
  <div class="eq-knob-wrapper" @wheel="handleWheel">
    <span class="eq-knob-label">{{ label }}</span>
    <div
      class="eq-knob"
      :class="{ dragging: isDragging }"
      @mousedown="handleMouseDown"
      @dblclick="reset"
    >
      <svg viewBox="0 0 64 64" class="knob-svg">
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          stroke-width="4"
        />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          :stroke="color"
          stroke-width="4"
          stroke-linecap="round"
          :stroke-dasharray="`${normalizedValue * 1.63} 163"
          transform="rotate(-135 32 32)"
          class="knob-progress"
        />
        <g :style="{ transform: `rotate(${rotation}deg)`, transformOrigin: '32px 32px' }">
          <circle cx="32" cy="12" r="3" :fill="color" class="knob-indicator" />
        </g>
        <circle cx="32" cy="32" r="18" fill="rgba(20,20,25,0.9)" class="knob-inner" />
        <circle cx="32" cy="32" r="14" fill="rgba(30,30,35,0.8)" />
      </svg>
    </div>
    <span class="eq-knob-value">{{ displayValue }}dB</span>
  </div>
</template>

<style scoped>
.eq-knob-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.eq-knob-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.eq-knob {
  width: 48px;
  height: 48px;
  cursor: grab;
  transition: transform 0.15s ease;
}

.eq-knob:hover {
  transform: scale(1.05);
}

.eq-knob.dragging {
  cursor: grabbing;
  transform: scale(1.1);
}

.knob-svg {
  width: 100%;
  height: 100%;
}

.knob-progress {
  transition: stroke-dasharray 0.1s ease;
}

.knob-inner {
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
}

.knob-indicator {
  filter: drop-shadow(0 0 4px currentColor);
}

.eq-knob-value {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  font-variant-numeric: tabular-nums;
}
</style>
