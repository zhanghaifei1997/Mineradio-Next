import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class ParticleFlowPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private velocities: Float32Array | null = null
  private time = 0
  private flowPoints: THREE.Vector3[] = []

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.2)
    this.createFlowPath()
    this.createParticles()
  }

  private createFlowPath(): void {
    const pointCount = 8
    for (let i = 0; i < pointCount; i++) {
      const t = i / pointCount
      const angle = t * Math.PI * 4
      const radius = 3 + Math.sin(t * Math.PI * 2) * 1.5
      this.flowPoints.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        (t - 0.5) * 4,
        Math.sin(angle) * radius,
      ))
    }
  }

  private getPathPosition(t: number): THREE.Vector3 {
    const n = this.flowPoints.length
    const p = (t % 1 + 1) % 1
    const total = p * n
    const idx = Math.floor(total) % n
    const nextIdx = (idx + 1) % n
    const localT = total - Math.floor(total)

    const p0 = this.flowPoints[(idx - 1 + n) % n]
    const p1 = this.flowPoints[idx]
    const p2 = this.flowPoints[nextIdx]
    const p3 = this.flowPoints[(nextIdx + 1) % n]

    return this.catmullRom(p0, p1, p2, p3, localT)
  }

  private catmullRom(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number): THREE.Vector3 {
    const t2 = t * t
    const t3 = t2 * t
    const v0 = (p2.clone().sub(p0)).multiplyScalar(0.5)
    const v1 = (p3.clone().sub(p1)).multiplyScalar(0.5)

    return new THREE.Vector3(
      (2 * p1.x - 2 * p2.x + v0.x + v1.x) * t3 + (-3 * p1.x + 3 * p2.x - 2 * v0.x - v1.x) * t2 + v0.x * t + p1.x,
      (2 * p1.y - 2 * p2.y + v0.y + v1.y) * t3 + (-3 * p1.y + 3 * p2.y - 2 * v0.y - v1.y) * t2 + v0.y * t + p1.y,
      (2 * p1.z - 2 * p2.z + v0.z + v1.z) * t3 + (-3 * p1.z + 3 * p2.z - 2 * v0.z - v1.z) * t2 + v0.z * t + p1.z,
    )
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.velocities = new Float32Array(count)

    const flowColors = [
      { r: 1, g: 0.4, b: 0.2 },
      { r: 1, g: 0.7, b: 0.3 },
      { r: 0.4, g: 0.8, b: 1 },
      { r: 0.6, g: 0.4, b: 1 },
      { r: 0.3, g: 1, b: 0.6 },
    ]

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const t = i / count

      const pathPos = this.getPathPosition(t)
      const spread = 0.3
      this.positions[i3] = pathPos.x + (Math.random() - 0.5) * spread
      this.positions[i3 + 1] = pathPos.y + (Math.random() - 0.5) * spread
      this.positions[i3 + 2] = pathPos.z + (Math.random() - 0.5) * spread

      const color = flowColors[Math.floor(Math.random() * flowColors.length)]
      const brightness = 0.4 + Math.random() * 0.6
      this.colors[i3] = color.r * brightness
      this.colors[i3 + 1] = color.g * brightness
      this.colors[i3 + 2] = color.b * brightness

      this.velocities[i] = 0.0008 + Math.random() * 0.0012
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.group.add(this.points)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.positions || !this.velocities) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0

    const speedMultiplier = 1 + energy * 3 + bass * 2
    const turbulence = 0.1 + mid * 0.5 + high * 0.3

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3

      const speed = this.velocities[i] * speedMultiplier
      let t = (i / this.particleCount + this.time * speed * 60) % 1

      const pathPos = this.getPathPosition(t)
      const nextT = (t + 0.01) % 1
      const nextPos = this.getPathPosition(nextT)
      const tangent = nextPos.clone().sub(pathPos).normalize()

      const noiseX = Math.sin(this.time * 2 + i * 0.1) * turbulence
      const noiseY = Math.cos(this.time * 1.5 + i * 0.15) * turbulence
      const noiseZ = Math.sin(this.time * 2.5 + i * 0.05) * turbulence

      const spread = 0.2 + beatPulse * 0.3
      const spreadX = Math.sin(i * 0.5 + this.time) * spread
      const spreadY = Math.cos(i * 0.3 + this.time * 0.7) * spread
      const spreadZ = Math.sin(i * 0.7 + this.time * 1.2) * spread

      this.positions[i3] = pathPos.x + tangent.x * 0 + noiseX + spreadX
      this.positions[i3 + 1] = pathPos.y + tangent.y * 0 + noiseY + spreadY
      this.positions[i3 + 2] = pathPos.z + tangent.z * 0 + noiseZ + spreadZ
    }

    const posAttr = this.geometry?.getAttribute('position') as THREE.BufferAttribute
    if (posAttr) {
      posAttr.needsUpdate = true
    }

    this.group.rotation.y += (0.03 + energy * 0.1) * dt

    const scale = 1 + beatPulse * 0.15
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.6 + energy * 0.35
    mat.size = 0.03 + bass * 0.04
  }
}
