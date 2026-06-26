import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class PlanetPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private orbitSpeeds: Float32Array | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 0.8)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.orbitSpeeds = new Float32Array(count)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const radius = Math.random() * 4 + 1
      const angle = Math.random() * Math.PI * 2
      const inclination = (Math.random() - 0.5) * Math.PI * 0.4

      this.positions[i3] = Math.cos(angle) * radius * Math.cos(inclination)
      this.positions[i3 + 1] = Math.sin(inclination) * radius
      this.positions[i3 + 2] = Math.sin(angle) * radius * Math.cos(inclination)

      this.orbitSpeeds![i] = (0.2 + Math.random() * 0.8) / Math.sqrt(radius)

      const colorMix = Math.min(1, (radius - 1) / 4)
      this.colors[i3] = baseColor.r * (1 - colorMix) + glowColor.r * colorMix
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix * 0.5) + glowColor.g * colorMix * 0.5
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix * 0.8) + glowColor.b * colorMix * 0.8
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.04,
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
    if (!this.positions || !this.orbitSpeeds || !this.points) return

    this.time += dt
    const count = this.particleCount
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0
    const speedMult = (audio.isPlaying ? 1 : 0.2) * (1 + bass * 0.5)

    const positions = this.positions
    const speeds = this.orbitSpeeds

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const x = positions[i3]
      const z = positions[i3 + 2]

      const currentAngle = Math.atan2(z, x)
      const radius = Math.sqrt(x * x + z * z)
      const newAngle = currentAngle + speeds[i] * dt * speedMult

      positions[i3] = Math.cos(newAngle) * radius
      positions[i3 + 2] = Math.sin(newAngle) * radius
    }

    const scale = 1 + beatPulse * 0.2
    this.group.scale.setScalar(scale)
    this.group.rotation.y += (0.02 + energy * 0.05) * dt

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
    mat.size = 0.03 + bass * 0.025

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }
}
