import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class VoidPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private velocities: Float32Array | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 0.7)
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

      const radius = Math.random() * 0.2 + 0.1
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      this.positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      this.positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      this.positions[i3 + 2] = radius * Math.cos(phi)

      const speed = 0.02 + Math.random() * 0.08
      this.velocities![i3] = this.positions[i3] * speed / radius
      this.velocities![i3 + 1] = this.positions[i3 + 1] * speed / radius
      this.velocities![i3 + 2] = this.positions[i3 + 2] * speed / radius

      const colorMix = Math.random()
      this.colors[i3] = baseColor.r * (1 - colorMix * 0.3) + glowColor.r * colorMix * 0.3
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix * 0.2) + glowColor.g * colorMix * 0.2
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix * 0.5) + glowColor.b * colorMix * 0.5
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.group.add(this.points)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.positions || !this.velocities || !this.points) return

    this.time += dt
    const count = this.particleCount
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0
    const speedMult = (audio.isPlaying ? 1 : 0.15) * (1 + bass * 2)

    const positions = this.positions
    const velocities = this.velocities

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      positions[i3] += velocities[i3] * dt * speedMult
      positions[i3 + 1] += velocities[i3 + 1] * dt * speedMult
      positions[i3 + 2] += velocities[i3 + 2] * dt * speedMult

      const dist = Math.sqrt(
        positions[i3] * positions[i3] +
        positions[i3 + 1] * positions[i3 + 1] +
        positions[i3 + 2] * positions[i3 + 2]
      )

      if (dist > 5) {
        const radius = Math.random() * 0.2 + 0.1
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)

        positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
        positions[i3 + 2] = radius * Math.cos(phi)

        const speed = 0.02 + Math.random() * 0.08
        velocities[i3] = positions[i3] * speed / radius
        velocities[i3 + 1] = positions[i3 + 1] * speed / radius
        velocities[i3 + 2] = positions[i3 + 2] * speed / radius
      }
    }

    const pulseScale = 1 - beatPulse * 0.1
    this.group.scale.setScalar(pulseScale)

    this.group.rotation.y += (0.05 + energy * 0.1) * dt * speedMult
    this.group.rotation.x += (0.03 + energy * 0.05) * dt * speedMult

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
    mat.size = 0.04 + bass * 0.04

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }
}
