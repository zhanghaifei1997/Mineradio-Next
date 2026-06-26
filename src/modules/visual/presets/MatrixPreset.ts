import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class MatrixPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private time = 0
  private columns = 0
  private rows = 0
  private speeds: Float32Array | null = null
  private headPositions: Float32Array | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.columns = 40
    this.rows = 30
    this.particleCount = this.columns * this.rows
    this.createParticles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.speeds = new Float32Array(this.columns)
    this.headPositions = new Float32Array(this.columns)

    const spreadX = 8
    const spreadY = 6

    for (let col = 0; col < this.columns; col++) {
      this.speeds[col] = 2 + Math.random() * 4
      this.headPositions[col] = Math.random() * this.rows

      for (let row = 0; row < this.rows; row++) {
        const idx = col * this.rows + row
        const i3 = idx * 3

        this.positions[i3] = (col / this.columns - 0.5) * spreadX
        this.positions[i3 + 1] = (row / this.rows - 0.5) * spreadY
        this.positions[i3 + 2] = 0

        this.colors[i3] = 0.1
        this.colors[i3 + 1] = 0.3
        this.colors[i3 + 2] = 0.1
      }
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.06,
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
    if (!this.points || !this.colors || !this.speeds || !this.headPositions) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0

    const speedMultiplier = 1 + energy * 2 + bass * 2
    const greenIntensity = 0.3 + mid * 0.5 + high * 0.4

    for (let col = 0; col < this.columns; col++) {
      this.headPositions[col] += this.speeds[col] * speedMultiplier * dt

      if (this.headPositions[col] >= this.rows) {
        this.headPositions[col] = 0
        this.speeds[col] = 2 + Math.random() * 4
      }

      for (let row = 0; row < this.rows; row++) {
        const idx = col * this.rows + row
        const i3 = idx * 3

        const headPos = this.headPositions[col]
        const dist = row - Math.floor(headPos)

        if (dist === 0) {
          this.colors[i3] = 0.8 + beatPulse * 0.2
          this.colors[i3 + 1] = 1
          this.colors[i3 + 2] = 0.8 + greenIntensity * 0.2
        } else if (dist > 0 && dist < 8) {
          const fade = 1 - dist / 8
          this.colors[i3] = 0.1 * fade
          this.colors[i3 + 1] = (0.4 + greenIntensity * 0.4) * fade
          this.colors[i3 + 2] = 0.1 * fade
        } else {
          this.colors[i3] = 0.02
          this.colors[i3 + 1] = 0.08
          this.colors[i3 + 2] = 0.02
        }
      }
    }

    const colAttr = this.geometry?.getAttribute('color') as THREE.BufferAttribute
    if (colAttr) {
      colAttr.needsUpdate = true
    }

    this.group.rotation.y = Math.sin(this.time * 0.05) * 0.1
    this.group.rotation.x = Math.sin(this.time * 0.03) * 0.05

    const scale = 1 + beatPulse * 0.08
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
    mat.size = 0.04 + bass * 0.04 + high * 0.02
  }
}
