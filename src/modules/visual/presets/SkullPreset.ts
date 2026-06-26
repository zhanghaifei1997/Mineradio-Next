import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class SkullPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private basePositions: Float32Array | null = null
  private jawOpenAmount = 0

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.5)
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.basePositions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)

    this.generateSkullShape(count, baseColor, glowColor)

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.025,
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

    this.group.scale.setScalar(2.5)
    this.group.position.y = 0.2
  }

  private generateSkullShape(
    count: number,
    baseColor: { r: number; g: number; b: number },
    glowColor: { r: number; g: number; b: number },
  ): void {
    const positions = this.positions!
    const basePositions = this.basePositions!
    const colors = this.colors!

    const skullParts = [
      { ratio: 0.4, type: 'cranium' },
      { ratio: 0.25, type: 'jaw' },
      { ratio: 0.15, type: 'eyeSockets' },
      { ratio: 0.1, type: 'nasal' },
      { ratio: 0.1, type: 'teeth' },
    ]

    let idx = 0
    for (const part of skullParts) {
      const partCount = Math.floor(count * part.ratio)
      for (let i = 0; i < partCount && idx < count; i++, idx++) {
        const i3 = idx * 3
        let x = 0, y = 0, z = 0
        let colorMix = 0

        switch (part.type) {
          case 'cranium': {
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)
            const r = 1 + (Math.random() - 0.5) * 0.1
            x = r * Math.sin(phi) * Math.cos(theta) * 1.1
            y = r * Math.cos(phi) * 0.9 + 0.3
            z = r * Math.sin(phi) * Math.sin(theta) * 1.0
            colorMix = 0.1 + Math.random() * 0.2
            break
          }
          case 'jaw': {
            const angle = (Math.random() - 0.5) * Math.PI * 0.8
            const jitter = (Math.random() - 0.5) * 0.15
            x = Math.sin(angle) * 0.8 + jitter
            y = -0.6 + Math.random() * 0.2
            z = Math.cos(angle) * 0.5 + 0.3 + jitter
            colorMix = 0.2 + Math.random() * 0.3
            break
          }
          case 'eyeSockets': {
            const side = Math.random() > 0.5 ? 1 : -1
            const eyeX = side * 0.45
            const eyeY = 0.4
            const eyeZ = 0.7
            const r = Math.random() * 0.25
            const theta = Math.random() * Math.PI * 2
            x = eyeX + Math.cos(theta) * r
            y = eyeY + Math.sin(theta) * r * 0.7
            z = eyeZ + (Math.random() - 0.5) * 0.1
            colorMix = 0.5 + Math.random() * 0.5
            break
          }
          case 'nasal': {
            x = (Math.random() - 0.5) * 0.12
            y = -0.05 + (Math.random() - 0.5) * 0.15
            z = 0.9 + (Math.random() - 0.5) * 0.05
            colorMix = 0.3 + Math.random() * 0.3
            break
          }
          case 'teeth': {
            const toothIdx = Math.floor(Math.random() * 8)
            const side = toothIdx < 4 ? 1 : -1
            const localIdx = toothIdx % 4
            x = side * (0.15 + localIdx * 0.12)
            y = -0.5 + (Math.random() - 0.5) * 0.08
            z = 0.6 + (Math.random() - 0.5) * 0.08
            colorMix = 0.1 + Math.random() * 0.2
            break
          }
        }

        positions[i3] = x
        positions[i3 + 1] = y
        positions[i3 + 2] = z

        basePositions[i3] = x
        basePositions[i3 + 1] = y
        basePositions[i3 + 2] = z

        colors[i3] = baseColor.r * (1 - colorMix) + glowColor.r * colorMix
        colors[i3 + 1] = baseColor.g * (1 - colorMix) + glowColor.g * colorMix
        colors[i3 + 2] = baseColor.b * (1 - colorMix) + glowColor.b * colorMix
      }
    }

    while (idx < count) {
      const i3 = idx * 3
      positions[i3] = (Math.random() - 0.5) * 2
      positions[i3 + 1] = (Math.random() - 0.5) * 2
      positions[i3 + 2] = (Math.random() - 0.5) * 2
      basePositions[i3] = positions[i3]
      basePositions[i3 + 1] = positions[i3 + 1]
      basePositions[i3 + 2] = positions[i3 + 2]
      colors[i3] = baseColor.r
      colors[i3 + 1] = baseColor.g
      colors[i3 + 2] = baseColor.b
      idx++
    }
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.positions || !this.basePositions || !this.points) return

    this.time += dt
    const count = this.particleCount
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0
    const speedMult = audio.isPlaying ? 1 : 0.2

    const targetJawOpen = bass * 0.8
    this.jawOpenAmount += (targetJawOpen - this.jawOpenAmount) * 0.1

    const positions = this.positions
    const base = this.basePositions

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const by = base[i3 + 1]

      let jawOffset = 0
      if (by < -0.3) {
        const jawFactor = Math.min(1, (-by - 0.3) / 0.5)
        jawOffset = -this.jawOpenAmount * jawFactor * 0.3
      }

      const breatheOffset = Math.sin(this.time * 0.8 + i * 0.01) * 0.02 * energy

      positions[i3] = base[i3] + (Math.random() - 0.5) * 0.01 * bass
      positions[i3 + 1] = base[i3 + 1] + jawOffset + breatheOffset
      positions[i3 + 2] = base[i3 + 2] + (Math.random() - 0.5) * 0.01 * bass
    }

    const scale = 1 + beatPulse * 0.12
    this.group.scale.setScalar(2.5 * scale)

    this.group.rotation.y = Math.sin(this.time * 0.15) * 0.1 + beatPulse * 0.05
    this.group.rotation.x = Math.sin(this.time * 0.2) * 0.05

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.75 + energy * 0.2
    mat.size = 0.02 + bass * 0.02

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }
}
