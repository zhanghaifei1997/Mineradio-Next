<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

interface Particle {
  id: number
  x: number
  y: number
  size: number
  color: string
  delay: number
  distance: number
}

const props = defineProps<{
  active: boolean
  originX?: number
  originY?: number
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const particles = ref<Particle[]>([])
const containerRef = ref<HTMLElement | null>(null)
let animationTimer: ReturnType<typeof setTimeout> | null = null

const colors = ['#f4d28a', '#00f5d4', '#d95b67']

function generateParticles(): Particle[] {
  const count = 20
  const result: Particle[] = []

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
    const distance = 40 + Math.random() * 60
    const size = 3 + Math.random() * 5

    result.push({
      id: i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 200,
      distance,
    })
  }

  return result
}

function startAnimation() {
  particles.value = generateParticles()

  animationTimer = setTimeout(() => {
    emit('complete')
  }, 1000)
}

function stopAnimation() {
  if (animationTimer) {
    clearTimeout(animationTimer)
    animationTimer = null
  }
  particles.value = []
}

defineExpose({
  startAnimation,
  stopAnimation,
})

onUnmounted(() => {
  stopAnimation()
})
</script>

<template>
  <div
    v-if="active || particles.length > 0"
    ref="containerRef"
    class="login-particles"
  >
    <div
      v-for="particle in particles"
      :key="particle.id"
      class="particle"
      :style="{
        width: particle.size + 'px',
        height: particle.size + 'px',
        backgroundColor: particle.color,
        boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
        '--tx': particle.x + 'px',
        '--ty': particle.y + 'px',
        animationDelay: particle.delay + 'ms',
      }"
    ></div>
  </div>
</template>

<style scoped>
.login-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 100;
}

.particle {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
  animation: particleExpand 1s ease-out forwards;
}

@keyframes particleExpand {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.5);
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(1);
  }
}
</style>
