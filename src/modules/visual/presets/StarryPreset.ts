import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class StarryPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private sizes: Float32Array | null = null
  private originalSizes: Float32Array | null = null
  private twinklePhases: Float32Array | null = null
  private time = 0
  private shootingStars: { pos: THREE.Vector3; vel: THREE.Vector3; life: number; maxLife: number }[] = []
  private shootingStarTimer = 0

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.5)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.sizes = new Float32Array(count)
    this.originalSizes = new Float32Array(count)
    this.twinklePhases = new Float32Array(count)

    const starColors = [
      { r: 1, g: 1, b: 1 },
      { r: 0.9, g: 0.9, b: 1 },
      { r: 1, g: 0.95, b: 0.9 },
      { r: 0.9, g: 1, b: 0.95 },
      { r: 1, g: 0.9, b: 0.8 },
    ]

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 6 + Math.random() * 4

      this.positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      this.positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      this.positions[i3 + 2] = radius * Math.cos(phi)

      const color = starColors[Math.floor(Math.random() * starColors.length)]
      const brightness = 0.4 + Math.random() * 0.6
      this.colors[i3] = color.r * brightness
      this.colors[i3 + 1] = color.g * brightness
      this.colors[i3 + 2] = color.b * brightness

      const size = 0.015 + Math.random() * 0.04
      this.sizes[i] = size
      this.originalSizes[i] = size

      this.twinklePhases[i] = Math.random() * Math.PI * 2
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.group.add(this.points)
  }

  private spawnShootingStar(): void {
    const start = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      3 + Math.random() * 2,
      (Math.random() - 0.5) * 4 - 2,
    )
    const end = new THREE.Vector3(
      start.x + (Math.random() - 0.5) * 4,
      start.y - 2 - Math.random() * 2,
      start.z + (Math.random() - 0.5) * 2,
    )
    const velocity = end.clone().sub(start).normalize().multiplyScalar(6 + Math.random() * 4)

    this.shootingStars.push({
      pos: start,
      vel: velocity,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4,
    })
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.sizes || !this.originalSizes || !this.twinklePhases) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0

    const twinkleSpeed = 1 + mid * 2
    for (let i = 0; i < this.particleCount; i++) {
      const twinkle = Math.sin(this.time * twinkleSpeed + this.twinklePhases[i])
      const twinkleAmount = 0.3 + high * 0.5
      this.sizes[i] = this.originalSizes[i] * (1 + twinkle * twinkleAmount)
    }

    const colorAttr = this.geometry?.getAttribute('color') as THREE.BufferAttribute
    if (colorAttr && beatPulse > 0.3) {
      const colors = this.colors as Float32Array
      const boost = beatPulse * 0.5
      for (let i = 0; i < this.particleCount; i++) {
        const i3 = i * 3
        colors[i3] = Math.min(1, colors[i3] + boost * 0.3)
        colors[i3 + 1] = Math.min(1, colors[i3 + 1] + boost * 0.2)
        colors[i3 + 2] = Math.min(1, colors[i3 + 2] + boost)
      }
      colorAttr.needsUpdate = true
    }

    this.shootingStarTimer -= dt
    if (this.shootingStarTimer <= 0 && energy > 0.2) {
      this.spawnShootingStar()
      this.shootingStarTimer = 1 + Math.random() * 3 - energy * 2
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const star = this.shootingStars[i]
      star.pos.add(star.vel.clone().multiplyScalar(dt))
      star.life += dt

      if (star.life >= star.maxLife) {
        this.shootingStars.splice(i, 1)
      }
    }

    const rotationSpeed = 0.02 + energy * 0.05
    this.group.rotation.y += rotationSpeed * dt
    this.group.rotation.x = Math.sin(this.time * 0.05) * 0.1

    const scale = 1 + bass * 0.1
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
  }
}
