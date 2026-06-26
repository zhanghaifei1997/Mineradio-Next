<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useFxStore } from '@/stores/fx'
import { usePlayerStore } from '@/stores/player'

const fx = useFxStore()
const player = usePlayerStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animationId: number | null = null
let time = 0
let particles: Array<{
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  hue: number
}> = []

const particleCount = computed(() => {
  const base = 150
  const mult = { eco: 0.3, balanced: 1, high: 1.5, ultra: 2 }
  return Math.floor(base * (mult[fx.settings.performanceQuality] || 1) * fx.settings.particleResolution)
})

import { computed } from 'vue'

function initCanvas() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  ctx = canvas.getContext('2d')
  initParticles()
}

function initParticles() {
  particles = []
  const w = window.innerWidth
  const h = window.innerHeight
  for (let i = 0; i < particleCount.value; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.2,
      hue: Math.random() * 60 + 340,
    })
  }
}

function animate() {
  if (!ctx || !canvasRef.value) return
  const w = canvasRef.value.width
  const h = canvasRef.value.height

  ctx.fillStyle = 'rgba(10, 10, 15, 0.15)'
  ctx.fillRect(0, 0, w, h)

  const intensity = player.isPlaying ? fx.settings.cinemaIntensity : 0.2
  const glowColor = fx.settings.glowColor

  for (const p of particles) {
    p.x += p.vx * (1 + intensity * 2)
    p.y += p.vy * (1 + intensity * 2)

    if (p.x < 0) p.x = w
    if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h
    if (p.y > h) p.y = 0

    const gradient = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (1 + intensity * 2))
    gradient.addColorStop(0, `hsla(${p.hue}, 70%, 65%, ${p.alpha * (0.5 + intensity)})`)
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

    ctx!.fillStyle = gradient
    ctx!.beginPath()
    ctx!.arc(p.x, p.y, p.size * (1 + intensity * 2), 0, Math.PI * 2)
    ctx!.fill()
  }

  if (player.isPlaying) {
    const centerX = w / 2
    const centerY = h / 2
    const pulseRadius = 100 + Math.sin(time * 0.02) * 30 * intensity

    const pulseGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseRadius * 3)
    pulseGradient.addColorStop(0, `${glowColor}22`)
    pulseGradient.addColorStop(0.3, `${glowColor}11`)
    pulseGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = pulseGradient
    ctx.fillRect(0, 0, w, h)
  }

  time++
  animationId = requestAnimationFrame(animate)
}

function onResize() {
  initCanvas()
}

onMounted(() => {
  initCanvas()
  animate()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  window.removeEventListener('resize', onResize)
})

watch(particleCount, () => {
  initParticles()
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
}
</style>
