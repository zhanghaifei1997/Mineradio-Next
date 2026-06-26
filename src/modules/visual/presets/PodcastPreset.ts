import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class PodcastPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private baseY: Float32Array | null = null
  private time = 0

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 0.6)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.baseY = new Float32Array(count)

    const podcastColors = [
      { r: 0.4, g: 0.5, b: 0.7 },
      { r: 0.3, g: 0.45, b: 0.65 },
      { r: 0.5, g: 0.55, b: 0.7 },
      { r: 0.35, g: 0.4, b: 0.6 },
    ]

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      const x = (Math.random() - 0.5) * 12
      const y = (Math.random() - 0.5) * 8
      const z = (Math.random() - 0.5) * 6 - 2

      this.positions[i3] = x
      this.positions[i3 + 1] = y
      this.positions[i3 + 2] = z

      this.baseY[i] = y

      const color = podcastColors[Math.floor(Math.random() * podcastColors.length)]
      const brightness = 0.5 + Math.random() * 0.3
      this.colors[i3] = color.r * brightness
      this.colors[i3 + 1] = color.g * brightness
      this.colors[i3 + 2] = color.b * brightness
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.group.add(this.points)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.positions || !this.baseY) return

    this.time += dt * 0.3
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const speedMult = audio.isPlaying ? 1 : 0.3

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3
      const x = this.positions[i3]
      const z = this.positions[i3 + 2]

      const breathe = Math.sin(this.time * 0.5 + x * 0.3 + z * 0.2) * 0.05
      const drift = Math.sin(this.time * 0.2 + i * 0.05) * 0.01

      this.positions[i3 + 1] = this.baseY[i] + breathe + energy * 0.1
      this.positions[i3] = x + drift * speedMult
    }

    const rotationSpeed = 0.01 + energy * 0.01
    this.group.rotation.y += rotationSpeed * dt * speedMult

    const scale = 1 + bass * 0.05
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.5 + energy * 0.2
    mat.size = 0.015 + bass * 0.01

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }
}
