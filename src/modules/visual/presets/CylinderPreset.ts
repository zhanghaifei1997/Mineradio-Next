import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class CylinderPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private initialPositions: Float32Array | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.1)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.initialPositions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)
    const cylinderRadius = 3
    const cylinderHeight = 5

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const angle = Math.random() * Math.PI * 2
      const height = (Math.random() - 0.5) * cylinderHeight
      const radiusJitter = (Math.random() - 0.5) * 0.4
      const radius = cylinderRadius + radiusJitter

      const x = Math.cos(angle) * radius
      const y = height
      const z = Math.sin(angle) * radius

      this.positions[i3] = x
      this.positions[i3 + 1] = y
      this.positions[i3 + 2] = z

      this.initialPositions![i3] = x
      this.initialPositions![i3 + 1] = y
      this.initialPositions![i3 + 2] = z

      const colorMix = Math.abs(height) / (cylinderHeight / 2)
      this.colors[i3] = baseColor.r * (1 - colorMix * 0.4) + glowColor.r * colorMix * 0.4
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix * 0.3) + glowColor.g * colorMix * 0.3
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix * 0.6) + glowColor.b * colorMix * 0.6
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.035,
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
    if (!this.positions || !this.initialPositions || !this.points) return

    this.time += dt
    const count = this.particleCount
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const beatPulse = audio.beatPulse || 0
    const speedMult = audio.isPlaying ? 1 : 0.25

    const positions = this.positions
    const initial = this.initialPositions

    this.group.rotation.y += (0.1 + bass * 0.3) * dt * speedMult

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const ix = initial[i3]
      const iy = initial[i3 + 1]
      const iz = initial[i3 + 2]

      const distFromCenter = Math.sqrt(ix * ix + iz * iz)
      const waveOffset = Math.sin(this.time * 2 + iy * 0.5 + distFromCenter * 0.3) * mid * 0.3

      positions[i3] = ix + ix * waveOffset * 0.1
      positions[i3 + 1] = iy + waveOffset
      positions[i3 + 2] = iz + iz * waveOffset * 0.1
    }

    const scale = 1 + beatPulse * 0.15
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.65 + energy * 0.3
    mat.size = 0.025 + bass * 0.025

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }
}
