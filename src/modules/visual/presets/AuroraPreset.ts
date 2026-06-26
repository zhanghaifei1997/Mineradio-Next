import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class AuroraPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private originalPositions: Float32Array | null = null
  private time = 0
  private ribbonCount = 6
  private particlesPerRibbon = 0

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 0.8)
    this.particlesPerRibbon = Math.floor(this.particleCount / this.ribbonCount)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.originalPositions = new Float32Array(count * 3)

    const auroraColors = [
      { r: 0.2, g: 0.8, b: 0.4 },
      { r: 0.1, g: 0.6, b: 0.7 },
      { r: 0.4, g: 0.2, b: 0.8 },
      { r: 0.8, g: 0.3, b: 0.6 },
      { r: 0.1, g: 0.9, b: 0.8 },
      { r: 0.6, g: 0.9, b: 0.3 },
    ]

    for (let r = 0; r < this.ribbonCount; r++) {
      const ribbonColor = auroraColors[r % auroraColors.length]
      const yOffset = (r / this.ribbonCount - 0.5) * 4
      const zOffset = (r % 2 === 0 ? 1 : -1) * 0.5

      for (let i = 0; i < this.particlesPerRibbon; i++) {
        const idx = r * this.particlesPerRibbon + i
        const i3 = idx * 3
        const t = i / this.particlesPerRibbon

        const x = (t - 0.5) * 10
        const y = yOffset + Math.sin(t * Math.PI * 2 + r) * 0.5
        const z = zOffset + Math.sin(t * Math.PI + r * 0.5) * 0.3

        this.positions[i3] = x
        this.positions[i3 + 1] = y
        this.positions[i3 + 2] = z

        this.originalPositions[i3] = x
        this.originalPositions[i3 + 1] = y
        this.originalPositions[i3 + 2] = z

        const colorVariation = 0.3 + Math.random() * 0.7
        this.colors[i3] = ribbonColor.r * colorVariation
        this.colors[i3 + 1] = ribbonColor.g * colorVariation
        this.colors[i3 + 2] = ribbonColor.b * colorVariation
      }
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.06,
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
    if (!this.points || !this.positions || !this.originalPositions) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0

    const positions = this.positions
    const originals = this.originalPositions

    for (let r = 0; r < this.ribbonCount; r++) {
      const ribbonPhase = this.time * (0.3 + r * 0.1) + r * 0.8
      const waveAmplitude = 0.5 + bass * 2 + mid * 1.5

      for (let i = 0; i < this.particlesPerRibbon; i++) {
        const idx = r * this.particlesPerRibbon + i
        const i3 = idx * 3
        const t = i / this.particlesPerRibbon

        const wave1 = Math.sin(t * Math.PI * 3 + ribbonPhase) * waveAmplitude
        const wave2 = Math.sin(t * Math.PI * 5 + ribbonPhase * 1.3) * waveAmplitude * 0.5
        const wave3 = Math.cos(t * Math.PI * 2 + ribbonPhase * 0.7) * high * 1.5

        positions[i3] = originals[i3] + wave2 * 0.3
        positions[i3 + 1] = originals[i3 + 1] + wave1 + wave3
        positions[i3 + 2] = originals[i3 + 2] + wave1 * 0.5 + beatPulse * 0.5
      }
    }

    const posAttr = this.geometry?.getAttribute('position') as THREE.BufferAttribute
    if (posAttr) {
      posAttr.needsUpdate = true
    }

    this.group.rotation.y = Math.sin(this.time * 0.1) * 0.2
    this.group.rotation.z = Math.sin(this.time * 0.15) * 0.1

    const scale = 1 + beatPulse * 0.15
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.6 + energy * 0.35
    mat.size = 0.04 + bass * 0.05
  }
}
