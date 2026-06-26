import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class OceanPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private originalY: Float32Array | null = null
  private time = 0
  private gridSize = 0
  private bubbleParticles: THREE.Points | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.gridSize = Math.floor(Math.sqrt(this.getParticleBaseCount() * 0.6))
    this.particleCount = this.gridSize * this.gridSize
    this.createParticles()
    this.createBubbles()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.originalY = new Float32Array(count)

    const oceanColors = [
      { r: 0.0, g: 0.3, b: 0.6 },
      { r: 0.0, g: 0.5, b: 0.7 },
      { r: 0.1, g: 0.6, b: 0.8 },
      { r: 0.2, g: 0.7, b: 0.9 },
    ]

    const spread = 8

    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        const idx = z * this.gridSize + x
        const i3 = idx * 3

        const px = (x / this.gridSize - 0.5) * spread
        const pz = (z / this.gridSize - 0.5) * spread
        const py = -1 + Math.sin(x * 0.3) * 0.2 + Math.cos(z * 0.3) * 0.2

        this.positions[i3] = px
        this.positions[i3 + 1] = py
        this.positions[i3 + 2] = pz

        this.originalY[idx] = py

        const depthFactor = (z / this.gridSize)
        const color = oceanColors[Math.floor(depthFactor * (oceanColors.length - 1))]
        const brightness = 0.5 + (1 - depthFactor) * 0.5
        this.colors[i3] = color.r * brightness
        this.colors[i3 + 1] = color.g * brightness
        this.colors[i3 + 2] = color.b * brightness
      }
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(this.geometry, this.material)
    this.points.frustumCulled = false
    this.group.add(this.points)
  }

  private createBubbles(): void {
    const bubbleCount = Math.floor(this.getParticleBaseCount() * 0.2)
    const positions = new Float32Array(bubbleCount * 3)
    const velocities = new Float32Array(bubbleCount)

    for (let i = 0; i < bubbleCount; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 8
      positions[i3 + 1] = -2 + Math.random() * 2
      positions[i3 + 2] = (Math.random() - 0.5) * 8
      velocities[i] = 0.5 + Math.random() * 1.5
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      size: 0.03,
      color: 0x88ccff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.bubbleParticles = new THREE.Points(geometry, material)
    this.bubbleParticles.frustumCulled = false
    ;(this.bubbleParticles as any).velocities = velocities
    this.group.add(this.bubbleParticles)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.positions || !this.originalY) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0

    const waveSpeed = 0.8 + mid * 2
    const waveHeight = 0.3 + bass * 1.5 + beatPulse * 0.5

    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        const idx = z * this.gridSize + x
        const i3 = idx * 3

        const px = this.positions[i3]
        const pz = this.positions[i3 + 2]

        const wave1 = Math.sin(px * 0.8 + this.time * waveSpeed) * waveHeight
        const wave2 = Math.cos(pz * 0.6 + this.time * waveSpeed * 0.7) * waveHeight * 0.6
        const wave3 = Math.sin((px + pz) * 0.5 + this.time * waveSpeed * 1.2) * waveHeight * 0.4
        const wave4 = high * Math.sin(px * 2 + this.time * waveSpeed * 2) * 0.3

        this.positions[i3 + 1] = this.originalY[idx] + wave1 + wave2 + wave3 + wave4
      }
    }

    const posAttr = this.geometry?.getAttribute('position') as THREE.BufferAttribute
    if (posAttr) {
      posAttr.needsUpdate = true
    }

    if (this.bubbleParticles) {
      const positions = this.bubbleParticles.geometry.getAttribute('position') as THREE.BufferAttribute
      const velocities = (this.bubbleParticles as any).velocities as Float32Array
      const arr = positions.array as Float32Array
      const bubbleSpeed = 1 + energy * 2

      for (let i = 0; i < velocities.length; i++) {
        const i3 = i * 3
        arr[i3 + 1] += velocities[i] * bubbleSpeed * dt

        if (arr[i3 + 1] > 1.5) {
          arr[i3] = (Math.random() - 0.5) * 8
          arr[i3 + 1] = -2
          arr[i3 + 2] = (Math.random() - 0.5) * 8
          velocities[i] = 0.5 + Math.random() * 1.5
        }

        arr[i3] += Math.sin(this.time * 2 + i) * 0.01
        arr[i3 + 2] += Math.cos(this.time * 1.5 + i * 0.5) * 0.01
      }
      positions.needsUpdate = true
    }

    this.group.rotation.y = Math.sin(this.time * 0.1) * 0.15
    this.group.rotation.x = -0.3 + Math.sin(this.time * 0.08) * 0.05

    const scale = 1 + beatPulse * 0.1
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.6 + energy * 0.3
    mat.size = 0.04 + bass * 0.03
  }

  dispose(): void {
    if (this.bubbleParticles) {
      this.bubbleParticles.geometry.dispose()
      ;(this.bubbleParticles.material as THREE.Material).dispose()
      this.bubbleParticles = null
    }
    super.dispose()
  }
}
