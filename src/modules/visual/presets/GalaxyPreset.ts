import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class GalaxyPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private spiralArms = 4

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.2)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const t = i / count
      const arm = Math.floor(Math.random() * this.spiralArms)
      const armAngle = (arm / this.spiralArms) * Math.PI * 2

      const radius = Math.pow(Math.random(), 0.5) * 5
      const spiralAngle = armAngle + radius * 0.8
      const spread = radius * 0.15 + 0.1

      this.positions[i3] = Math.cos(spiralAngle) * radius + (Math.random() - 0.5) * spread
      this.positions[i3 + 1] = (Math.random() - 0.5) * 0.3
      this.positions[i3 + 2] = Math.sin(spiralAngle) * radius + (Math.random() - 0.5) * spread

      const colorMix = Math.min(1, radius / 5)
      this.colors[i3] = baseColor.r * (1 - colorMix * 0.5) + glowColor.r * colorMix * 0.5
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix * 0.3) + glowColor.g * colorMix * 0.3
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix * 0.7) + glowColor.b * colorMix * 0.7
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.035,
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

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0

    const rotationSpeed = (0.08 + bass * 0.2) * (audio.isPlaying ? 1 : 0.2)
    this.group.rotation.y += rotationSpeed * dt

    const scale = 1 + beatPulse * 0.2
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
    mat.size = 0.025 + bass * 0.03
  }
}
