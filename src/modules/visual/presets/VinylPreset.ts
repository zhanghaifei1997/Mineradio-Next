import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class VinylPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private rings = 8

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 0.9)
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
      const ring = Math.floor(Math.random() * this.rings)
      const baseRadius = 0.8 + (ring / this.rings) * 3.2
      const ringJitter = (Math.random() - 0.5) * 0.15
      const radius = baseRadius + ringJitter
      const angle = Math.random() * Math.PI * 2

      this.positions[i3] = Math.cos(angle) * radius
      this.positions[i3 + 1] = (Math.random() - 0.5) * 0.05
      this.positions[i3 + 2] = Math.sin(angle) * radius

      const colorMix = ring / this.rings
      this.colors[i3] = baseColor.r * (1 - colorMix * 0.6) + glowColor.r * colorMix * 0.6
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix * 0.4) + glowColor.g * colorMix * 0.4
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix * 0.8) + glowColor.b * colorMix * 0.8
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.03,
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

    this.group.rotation.x = -Math.PI * 0.35
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0

    const rotationSpeed = (0.4 + bass * 0.8) * (audio.isPlaying ? 1 : 0.15)
    this.group.rotation.z += rotationSpeed * dt

    const pulseScale = 1 + beatPulse * 0.25
    this.group.scale.setScalar(pulseScale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.6 + energy * 0.35
    mat.size = 0.02 + bass * 0.025
  }
}
