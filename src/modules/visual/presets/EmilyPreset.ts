import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class EmilyPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private velocities: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private spinSpeed = 0.05
  private riseSpeed = 0.3

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = this.getParticleBaseCount()
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const radius = Math.random() * 3.5 + 0.5
      const angle = Math.random() * Math.PI * 2
      const height = (Math.random() - 0.5) * 4

      this.positions[i3] = Math.cos(angle) * radius
      this.positions[i3 + 1] = height
      this.positions[i3 + 2] = Math.sin(angle) * radius

      this.velocities[i3] = (Math.random() - 0.5) * 0.02
      this.velocities[i3 + 1] = Math.random() * 0.01 + 0.005
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.02

      const colorMix = Math.random()
      this.colors[i3] = baseColor.r * (1 - colorMix) + glowColor.r * colorMix
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix) + glowColor.g * colorMix
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix) + glowColor.b * colorMix
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
    if (!this.positions || !this.points) return

    this.time += dt
    const count = this.particleCount
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0

    const rotationSpeed = (this.spinSpeed + bass * 0.3) * (audio.isPlaying ? 1 : 0.3)
    this.group.rotation.y += rotationSpeed * dt

    const positions = this.positions
    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      positions[i3 + 1] += (this.riseSpeed + energy * 0.5) * dt * 0.3

      if (positions[i3 + 1] > 2.5) {
        positions[i3 + 1] = -2.5
        const radius = Math.random() * 3.5 + 0.5
        const angle = Math.random() * Math.PI * 2
        positions[i3] = Math.cos(angle) * radius
        positions[i3 + 2] = Math.sin(angle) * radius
      }
    }

    const scale = 1 + beatPulse * 0.15
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
    mat.size = 0.03 + bass * 0.025

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }
}
