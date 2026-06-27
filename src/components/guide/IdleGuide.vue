<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useImmersiveStore } from '@/stores/immersive'
import { useFxStore } from '@/stores/fx'

const player = usePlayerStore()
const immersive = useImmersiveStore()
const fx = useFxStore()

// --- Canvas state ---
let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
let cw = 0, ch = 0, dpr = 1
let particles: Particle[] = []
let trails: TrailPoint[][] = [[], [], [], []]
let startedAt = performance.now()
let isVisible = false
let lastFrameAt = performance.now()
let delayTimer: ReturnType<typeof setTimeout> | null = null

// --- Interaction state ---
const interaction = ref({
  angle: 0,
  velocity: 0,
  rotX: -0.12,
  rotY: 0,
  spinX: 0,
  spinY: 0,
  zoom: 1,
  zoomTarget: 1,
  zoomPulse: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  lastT: 0,
  pointerX: 0.5,
  pointerY: 0.5,
  pointerActive: false,
  focus: 0,
  press: 0,
  tiltX: 0,
  tiltY: 0,
})

// --- Particle type ---
interface Particle {
  a: number
  r: number
  cx: number
  cy: number
  size: number
  speed: number
  phase: number
  wobbleAmp: number
  wobbleSpeed: number
  oval: number
  zAmp: number
  driftX: number
  driftY: number
  layer: number
  z: number
  ring: boolean
}

interface TrailPoint {
  x: number
  y: number
  scale: number
  alpha: number
  t: number
}

// --- Should show idle guide ---
const shouldShow = computed(() => {
  if (immersive.isImmersive) return false
  if (player.isPlaying) return false
  return true
})

// --- Clamp helper ---
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, isFinite(v) ? v : 0))
}

function clampSpin(v: number): number {
  return clamp(v, -4.8, 4.8)
}

// --- 3D projection ---
function projectPoint(x: number, y: number, z: number, rot: RotData, cx: number, cy: number, depth: number) {
  const x1 = x * rot.cy + z * rot.sy
  const z1 = -x * rot.sy + z * rot.cy
  const y1 = y * rot.cx - z1 * rot.sx
  const z2 = y * rot.sx + z1 * rot.cx
  let scale = depth / (depth - z2 * 0.72)
  scale = clamp(scale, 0.52, 1.74)
  return { x: cx + x1 * scale, y: cy + y1 * scale, z: z2, scale }
}

interface RotData {
  sx: number; cx: number; sy: number; cy: number
}

// --- Trail helpers ---
function pushTrail(index: number, pt: { x: number; y: number; z: number; scale: number }, alpha: number, now: number) {
  const trail = trails[index]
  const last = trail[trail.length - 1]
  const dx = last ? pt.x - last.x : 999
  const dy = last ? pt.y - last.y : 999
  if (!last || Math.sqrt(dx * dx + dy * dy) > 1.4 || now - last.t > 42) {
    trail.push({ x: pt.x, y: pt.y, scale: pt.scale, alpha, t: now })
  }
  while (trail.length > 26) trail.shift()
}

function drawTrail(c: CanvasRenderingContext2D, trail: TrailPoint[], now: number, alpha: number, energy: number) {
  if (!trail || trail.length < 2) return
  while (trail.length && now - trail[0].t > 680) trail.shift()
  if (trail.length < 2) return
  c.save()
  c.lineCap = 'round'
  c.lineJoin = 'round'
  for (let i = 1; i < trail.length; i++) {
    const prev = trail[i - 1]
    const cur = trail[i]
    const age = (now - cur.t) / 680
    const order = i / Math.max(1, trail.length - 1)
    const fade = Math.max(0, 1 - age) * order
    if (fade <= 0) continue
    c.strokeStyle = `rgba(255,255,255,${(alpha * fade * (0.18 + energy * 0.24)).toFixed(3)})`
    c.lineWidth = (0.7 + cur.scale * 0.9 + energy * 1.2) * fade
    c.beginPath()
    c.moveTo(prev.x, prev.y)
    const mx = (prev.x + cur.x) * 0.5
    const my = (prev.y + cur.y) * 0.5
    c.quadraticCurveTo(mx, my, cur.x, cur.y)
    c.stroke()
  }
  c.restore()
}

// --- Resize + init particles ---
function resizeCanvas() {
  if (!canvas || !ctx) return
  dpr = Math.min(window.devicePixelRatio || 1, 1.6)
  cw = window.innerWidth
  ch = window.innerHeight
  canvas.width = Math.max(1, Math.floor(cw * dpr))
  canvas.height = Math.max(1, Math.floor(ch * dpr))
  canvas.style.width = cw + 'px'
  canvas.style.height = ch + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  initParticles()
}

function initParticles() {
  particles = []
  trails = [[], [], [], []]
  const minDim = Math.min(cw, ch)
  const maxDim = Math.max(cw, ch)
  const count = cw < 800 ? 150 : 240
  for (let i = 0; i < count; i++) {
    const ring = i < count * 0.76
    const a = Math.random() * Math.PI * 2
    const r = ring
      ? (minDim * 0.035 + Math.pow(Math.random(), 0.58) * minDim * 0.335)
      : (Math.pow(Math.random(), 0.82) * maxDim * 0.58)
    const wobbleAmp = minDim * (ring ? (0.012 + Math.random() * 0.035) : (0.010 + Math.random() * 0.055))
    particles.push({
      a, r,
      cx: ring ? 0.5 : Math.random(),
      cy: ring ? 0.5 : Math.random(),
      size: ring ? (0.30 + Math.random() * 0.62) : (0.18 + Math.random() * 0.44),
      speed: ((ring ? 0.018 : 0.010) + Math.random() * (ring ? 0.045 : 0.030)) * (Math.random() < 0.5 ? -1 : 1),
      phase: Math.random() * Math.PI * 2,
      wobbleAmp,
      wobbleSpeed: 0.18 + Math.random() * 0.76,
      oval: 0.56 + Math.random() * 0.36,
      zAmp: 0.34 + Math.random() * 0.82,
      driftX: (Math.random() * 2 - 1) * wobbleAmp * 0.75,
      driftY: (Math.random() * 2 - 1) * wobbleAmp * 0.75,
      layer: Math.random(),
      z: (Math.random() * 2 - 1) * (ring ? minDim * 0.28 : maxDim * 0.42),
      ring,
    })
  }
}

// --- Pointer handlers ---
function onPointerDown(e: PointerEvent) {
  const g = interaction.value
  if (!shouldShow.value) return
  g.dragging = true
  g.pointerActive = true
  g.lastX = e.clientX
  g.lastY = e.clientY
  g.lastT = performance.now()
  g.pointerX = e.clientX / Math.max(1, cw || window.innerWidth)
  g.pointerY = e.clientY / Math.max(1, ch || window.innerHeight)
  document.body.classList.add('idle-guide-dragging')
}

function onPointerMove(e: PointerEvent) {
  const g = interaction.value
  if (!canvas) return
  const canReact = shouldShow.value || g.dragging
  g.pointerActive = canReact
  if (canReact) {
    g.pointerX = e.clientX / Math.max(1, cw || window.innerWidth)
    g.pointerY = e.clientY / Math.max(1, ch || window.innerHeight)
  }
  if (!g.dragging) return
  const now = performance.now()
  const dt = clamp((now - g.lastT) / 1000 || 1 / 60, 1 / 120, 0.08)
  const dx = e.clientX - g.lastX
  const dy = e.clientY - g.lastY
  const rx = -dy * 0.0032
  const ry = dx * 0.0034
  g.rotX += rx
  g.rotY += ry
  g.angle += ry * 0.22
  g.spinX = clampSpin(rx / dt * 0.46)
  g.spinY = clampSpin(ry / dt * 0.46)
  g.velocity = Math.sqrt(g.spinX * g.spinX + g.spinY * g.spinY)
  g.lastX = e.clientX
  g.lastY = e.clientY
  g.lastT = now
}

function onPointerUp() {
  const g = interaction.value
  if (!g.dragging) return
  g.dragging = false
  document.body.classList.remove('idle-guide-dragging')
}

function onPointerLeave() {
  if (!interaction.value.dragging) interaction.value.pointerActive = false
}

function onWheel(e: WheelEvent) {
  if (!shouldShow.value) return
  const g = interaction.value
  g.pointerActive = true
  g.pointerX = e.clientX / Math.max(1, cw || window.innerWidth)
  g.pointerY = e.clientY / Math.max(1, ch || window.innerHeight)
  const nextZoom = g.zoomTarget * Math.exp(-e.deltaY * 0.0012)
  g.zoomTarget = clamp(nextZoom, 0.58, 1.82)
  g.zoomPulse = Math.min(1, g.zoomPulse + Math.min(0.28, Math.abs(e.deltaY) * 0.0014))
}

// --- Core draw frame ---
function drawFrame() {
  if (!canvas || !ctx) return
  const c = ctx
  const nowFrame = performance.now()
  const dtFrame = clamp((nowFrame - lastFrameAt) / 1000 || 1 / 60, 1 / 120, 0.05)
  lastFrameAt = nowFrame
  const show = shouldShow.value

  // Toggle body class for visibility
  if (isVisible !== show) {
    isVisible = show
    document.body.classList.toggle('idle-guide-on', show)
    document.body.classList.toggle('idle-guide-interactive', show)
  }

  if (!show) {
    c.clearRect(0, 0, cw, ch)
    trails = [[], [], [], []]
    scheduleFrame(140)
    return
  }

  const t = (nowFrame - startedAt) / 1000
  const cxv = cw * 0.5
  const cyv = ch * 0.50
  const g = interaction.value

  // Inertia decay
  if (!g.dragging) {
    g.rotX += g.spinX * dtFrame
    g.rotY += g.spinY * dtFrame
    g.spinX *= Math.pow(0.90, dtFrame * 60)
    g.spinY *= Math.pow(0.90, dtFrame * 60)
    if (Math.abs(g.spinX) < 0.01) g.spinX = 0
    if (Math.abs(g.spinY) < 0.01) g.spinY = 0
  }
  g.rotY += 0.012 * dtFrame
  g.angle += g.spinY * dtFrame * 0.20 + 0.010 * dtFrame
  g.velocity = Math.sqrt(g.spinX * g.spinX + g.spinY * g.spinY)

  // Smooth transitions
  const targetFocus = g.pointerActive ? 1 : 0
  const targetPress = g.dragging ? 1 : 0
  g.focus += (targetFocus - g.focus) * 0.10
  g.press += (targetPress - g.press) * 0.16
  g.zoom += (g.zoomTarget - g.zoom) * 0.13
  g.zoomPulse *= Math.pow(0.84, dtFrame * 60)
  if (g.zoomPulse < 0.002) g.zoomPulse = 0
  g.tiltX += (((g.pointerX - 0.5) * 0.26) - g.tiltX) * 0.08
  g.tiltY += (((g.pointerY - 0.5) * 0.18) - g.tiltY) * 0.08

  c.clearRect(0, 0, cw, ch)
  c.globalCompositeOperation = 'lighter'

  // Center halo
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.72)
  const zoom = g.zoom
  const zoomBoost = g.zoomPulse
  const haloRadius = Math.min(cw, ch) * ((0.36 + breathe * 0.035 + g.press * 0.018) * zoom)
  const halo = c.createRadialGradient(cxv, cyv, 0, cxv, cyv, haloRadius)
  const haloAlpha = 0.034 + breathe * 0.020 + g.focus * 0.014 + g.press * 0.018 + zoomBoost * 0.018
  halo.addColorStop(0, `rgba(255,255,255,${haloAlpha.toFixed(3)})`)
  halo.addColorStop(0.44, `rgba(255,255,255,${(0.014 + g.focus * 0.010).toFixed(3)})`)
  halo.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = halo
  c.fillRect(0, 0, cw, ch)

  // Particle drawing
  const ringPts: { x: number; y: number; z: number; scale: number; alpha: number }[] = []
  const pointerPx = g.pointerX * cw
  const pointerPy = g.pointerY * ch
  const spinEnergy = Math.min(1, g.velocity / 1.5 + g.press * 0.42)
  const rot: RotData = {
    sx: Math.sin(g.rotX),
    cx: Math.cos(g.rotX),
    sy: Math.sin(g.rotY),
    cy: Math.cos(g.rotY),
  }
  const depth = Math.max(520, Math.min(cw, ch) * 0.92)

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const localA = p.a + t * p.speed
    const wanderA = p.phase + t * p.wobbleSpeed
    const wobble = Math.sin(wanderA) * p.wobbleAmp + Math.sin(t * (p.wobbleSpeed * 0.57 + 0.11) + p.phase * 1.7) * p.wobbleAmp * 0.45
    let x: number, y: number
    let projected: { x: number; y: number; z: number; scale: number } | null = null
    let pointScale = 1

    if (p.ring) {
      const rr = (p.r + wobble + breathe * 12) * zoom * (1 + g.press * 0.030 + zoomBoost * 0.018)
      const baseX = Math.cos(localA) * rr + Math.sin(wanderA * 0.73) * p.wobbleAmp * 0.54 + p.driftX
      const baseY = Math.sin(localA + Math.sin(wanderA) * 0.10) * rr * p.oval + Math.sin(t * 0.33 + p.phase) * p.wobbleAmp * 0.68 + p.driftY
      const baseZ = (Math.sin(localA * 0.84 + p.phase * 0.31) * rr * p.zAmp + p.z * 0.54 + Math.cos(wanderA * 0.91) * p.wobbleAmp) * zoom
      projected = projectPoint(baseX, baseY, baseZ, rot, cxv, cyv, depth)
      pointScale = projected.scale
      x = projected.x + g.tiltX * projected.z * 0.020
      y = projected.y + g.tiltY * projected.z * 0.018
      // Pointer attraction
      const nDx = pointerPx - x
      const nDy = pointerPy - y
      const near = g.focus * Math.max(0, 1 - Math.sqrt(nDx * nDx + nDy * nDy) / 210)
      x += nDx * near * 0.040
      y += nDy * near * 0.040
      ringPts.push({ x, y, z: projected.z, scale: projected.scale, alpha: 0.08 + breathe * 0.04 + near * 0.08 })
    } else {
      const driftX = ((p.cx - 0.5) * cw * 0.92 + Math.cos(localA) * (12 + p.wobbleAmp * 0.28) + wobble * 0.28) * zoom
      const driftY = ((p.cy - 0.5) * ch * 0.72 + Math.sin(localA * 0.8 + p.phase * 0.2) * (12 + p.wobbleAmp * 0.24)) * zoom
      const driftZ = (p.z + Math.sin(localA + p.phase) * (32 + p.wobbleAmp * 0.32)) * zoom
      const fieldPt = projectPoint(driftX, driftY, driftZ, rot, cxv, cyv, depth * 1.16)
      pointScale = fieldPt.scale
      x = fieldPt.x
      y = fieldPt.y
    }

    const depthGlow = p.ring && projected ? (0.66 + projected.scale * 0.20) : 1
    const aP = p.ring
      ? ((0.070 + breathe * 0.065 + Math.sin(t * (0.8 + p.layer) + p.phase) * 0.024 + spinEnergy * 0.032) * depthGlow)
      : (0.034 + g.focus * 0.010)

    c.beginPath()
    c.arc(x, y, p.size * pointScale * Math.sqrt(zoom) * (1 + spinEnergy * (p.ring ? 0.24 : 0.08) + zoomBoost * 0.12), 0, Math.PI * 2)
    c.fillStyle = `rgba(255,255,255,${Math.max(0, aP).toFixed(3)})`
    c.fill()
  }

  // Ring connections
  c.lineWidth = 1
  for (let j = 0; j < ringPts.length; j += 3) {
    const aPt = ringPts[j]
    const bPt = ringPts[(j + 7) % ringPts.length]
    if (!aPt || !bPt) continue
    const dx = aPt.x - bPt.x
    const dy = aPt.y - bPt.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > Math.min(cw, ch) * 0.17) continue
    c.strokeStyle = `rgba(255,255,255,${(0.018 + breathe * 0.020 + g.focus * 0.012 + spinEnergy * 0.018).toFixed(3)})`
    c.beginPath()
    c.moveTo(aPt.x, aPt.y)
    c.lineTo(bPt.x, bPt.y)
    c.stroke()
  }

  // 4 anchors + trails
  if (g.focus > 0.03 || spinEnergy > 0.05) {
    const orbitR = Math.min(cw, ch) * (0.305 + g.press * 0.018) * zoom
    const anchorAlpha = Math.min(0.68, 0.16 + g.focus * 0.24 + spinEnergy * 0.38)
    for (let k = 0; k < 4; k++) {
      const anchorA = g.angle + t * 0.08 + k * 1.72 + (k === 2 ? 0.38 : 0)
      const anchorPt = projectPoint(
        Math.cos(anchorA) * orbitR,
        Math.sin(anchorA) * orbitR * 0.52,
        Math.sin(anchorA + k * 0.54) * orbitR * 0.48,
        rot, cxv, cyv, depth
      )
      pushTrail(k, anchorPt, anchorAlpha, nowFrame)
      drawTrail(c, trails[k], nowFrame, anchorAlpha, spinEnergy)
      c.beginPath()
      c.arc(anchorPt.x, anchorPt.y, (2.0 + spinEnergy * 1.8 + (k === 0 ? g.press * 1.8 : 0)) * anchorPt.scale, 0, Math.PI * 2)
      c.fillStyle = `rgba(255,255,255,${anchorAlpha.toFixed(3)})`
      c.fill()
    }
  }

  // Pointer focus handle
  if (g.focus > 0.03) {
    const handleA = g.angle + t * 0.36
    const handleR = Math.min(cw, ch) * (0.315 + breathe * 0.012 + g.press * 0.012) * zoom
    const handlePt = projectPoint(
      Math.cos(handleA) * handleR,
      Math.sin(handleA) * handleR * 0.52,
      Math.sin(handleA + 0.62) * handleR * 0.48,
      rot, cxv, cyv, depth
    )
    const hx = handlePt.x
    const hy = handlePt.y
    const handleGlow = c.createRadialGradient(hx, hy, 0, hx, hy, 28 + g.press * 12)
    handleGlow.addColorStop(0, `rgba(255,255,255,${(0.22 * g.focus + 0.16 * g.press).toFixed(3)})`)
    handleGlow.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = handleGlow
    c.beginPath()
    c.arc(hx, hy, 28 + g.press * 12, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    c.arc(hx, hy, 2.4 + g.press * 1.6, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,255,255,${(0.54 * g.focus + 0.24 * g.press).toFixed(3)})`
    c.fill()
  }

  c.globalCompositeOperation = 'source-over'
  scheduleFrame(0)
}

// --- Frame scheduling ---
function scheduleFrame(delay?: number) {
  if (delayTimer) { clearTimeout(delayTimer); delayTimer = null }
  if (delay && delay > 0) {
    delayTimer = setTimeout(() => {
      delayTimer = null
      requestAnimationFrame(drawFrame)
    }, delay)
  } else {
    requestAnimationFrame(drawFrame)
  }
}

// --- Lifecycle ---
onMounted(() => {
  canvas = document.getElementById('idle-guide-canvas') as HTMLCanvasElement
  if (!canvas) return
  ctx = canvas.getContext('2d')
  if (!ctx) return
  startedAt = performance.now()
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('wheel', onWheel, { passive: true })
  drawFrame()
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('wheel', onWheel)
  }
  if (delayTimer) { clearTimeout(delayTimer); delayTimer = null }
  document.body.classList.remove('idle-guide-on', 'idle-guide-interactive', 'idle-guide-dragging')
})
</script>

<template>
  <canvas id="idle-guide-canvas" aria-hidden="true"></canvas>
</template>

<style>
/* These styles must be global since the canvas uses body class toggles */
#idle-guide-canvas {
  position: fixed;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}

body.idle-guide-on #idle-guide-canvas {
  opacity: 1 !important;
  pointer-events: auto;
}

body.idle-guide-interactive #idle-guide-canvas {
  cursor: grab;
}

body.idle-guide-dragging #idle-guide-canvas {
  cursor: grabbing;
}

body.immersive-mode #idle-guide-canvas {
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
</style>
