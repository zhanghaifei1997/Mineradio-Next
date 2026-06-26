import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class FlamePreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private velocities: Float32Array | null = null
  private lifetimes: Float32Array | null = null
  private time = 0
  private emberParticles: THREE.Points | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.0)
    this.createParticles()
    this.createEmbers()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.lifetimes = new Float32Array(count)

    const flameColors = [
      { r: 1, g: 0.1, b: 0 },
      { r: 1, g: 0.4, b: 0 },
      { r: 1, g: 0.7, b: 0.1 },
      { r: 1, g: 0.9, b: 0.3 },
    ]

    for (let i = 0; i < count; i++) {
      this.resetParticle(i, flameColors)
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.08,
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

  private resetParticle(i: number, flameColors: { r: number; g: number; b: number }[]): void {
    const i3 = i * 3

    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * 0.8

    this.positions[i3] = Math.cos(angle) * radius
    this.positions[i3 + 1] = -1.5
    this.positions[i3 + 2] = Math.sin(angle) * radius

    this.velocities[i3] = (Math.random() - 0.5) * 0.5
    this.velocities[i3 + 1] = 1.5 + Math.random() * 1.5
    this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.5

    const color = flameColors[Math.floor(Math.random() * flameColors.length)]
    this.colors[i3] = color.r
    this.colors[i3 + 1] = color.g
    this.colors[i3 + 2] = color.b

    this.lifetimes[i] = Math.random()
  }

  private createEmbers(): void {
    const emberCount = Math.floor(this.getParticleBaseCount() * 0.3)
    const positions = new Float32Array(emberCount * 3)
    const velocities = new Float32Array(emberCount * 3)
    const lifetimes = new Float32Array(emberCount)

    for (let i = 0; i < emberCount; i++) {
      const i3 = i * 3
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 0.5

      positions[i3] = Math.cos(angle) * radius
      positions[i3 + 1] = -1
      positions[i3 + 2] = Math.sin(angle) * radius

      velocities[i3] = (Math.random() - 0.5) * 1
      velocities[i3 + 1] = 2 + Math.random() * 2
      velocities[i3 + 2] = (Math.random() - 0.5) * 1

      lifetimes[i] = Math.random()
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    const material = new THREE.PointsMaterial({
      size: 0.02,
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.emberParticles = new THREE.Points(geometry, material)
    this.emberParticles.frustumCulled = false
    ;(this.emberParticles as any).velocities = velocities
    ;(this.emberParticles as any).lifetimes = lifetimes
    this.group.add(this.emberParticles)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.positions || !this.velocities || !this.lifetimes) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const beatPulse = audio.beatPulse || 0

    const riseSpeed = 1 + energy * 2 + bass * 3
    const turbulence = 0.3 + mid * 1.5

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3

      this.lifetimes[i] += dt * (0.3 + energy * 0.7)

      if (this.lifetimes[i] >= 1) {
        const flameColors = [
          { r: 1, g: 0.1, b: 0 },
          { r: 1, g: 0.4, b: 0 },
          { r: 1, g: 0.7, b: 0.1 },
          { r: 1, g: 0.9, b: 0.3 },
        ]
        this.resetParticle(i, flameColors)
        continue
      }

      const life = this.lifetimes[i]
      const turbX = Math.sin(this.time * 3 + i * 0.1) * turbulence * dt
      const turbZ = Math.cos(this.time * 2.5 + i * 0.15) * turbulence * dt

      this.positions[i3] += this.velocities[i3] * dt * riseSpeed + turbX
      this.positions[i3 + 1] += this.velocities[i3 + 1] * dt * riseSpeed
      this.positions[i3 + 2] += this.velocities[i3 + 2] * dt * riseSpeed + turbZ

      const colorT = life
      this.colors[i3] = 1
      this.colors[i3 + 1] = Math.max(0.1, 0.8 - colorT * 0.7)
      this.colors[i3 + 2] = Math.max(0, 0.3 - colorT * 0.3)
    }

    const posAttr = this.geometry?.getAttribute('position') as THREE.BufferAttribute
    const colAttr = this.geometry?.getAttribute('color') as THREE.BufferAttribute
    if (posAttr) posAttr.needsUpdate = true
    if (colAttr) colAttr.needsUpdate = true

    if (this.emberParticles) {
      const positions = this.emberParticles.geometry.getAttribute('position') as THREE.BufferAttribute
      const velocities = (this.emberParticles as any).velocities as Float32Array
      const lifetimes = (this.emberParticles as any).lifetimes as Float32Array
      const arr = positions.array as Float32Array

      for (let i = 0; i < lifetimes.length; i++) {
        const i3 = i * 3
        lifetimes[i] += dt * (0.2 + energy * 0.5)

        if (lifetimes[i] >= 1) {
          const angle = Math.random() * Math.PI * 2
          const radius = Math.random() * 0.5 * (1 + beatPulse)
          arr[i3] = Math.cos(angle) * radius
          arr[i3 + 1] = -1
          arr[i3 + 2] = Math.sin(angle) * radius
          velocities[i3] = (Math.random() - 0.5) * 1
          velocities[i3 + 1] = 2 + Math.random() * 2
          velocities[i3 + 2] = (Math.random() - 0.5) * 1
          lifetimes[i] = 0
          continue
        }

        arr[i3] += velocities[i3] * dt * riseSpeed
        arr[i3 + 1] += velocities[i3 + 1] * dt * riseSpeed
        arr[i3 + 2] += velocities[i3 + 2] * dt * riseSpeed

        arr[i3] += Math.sin(this.time * 4 + i) * 0.02
        arr[i3 + 2] += Math.cos(this.time * 3 + i * 0.5) * 0.02
      }
      positions.needsUpdate = true
    }

    this.group.rotation.y = Math.sin(this.time * 0.1) * 0.1

    const scale = 1 + beatPulse * 0.2
    this.group.scale.setScalar(scale)

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.25
    mat.size = 0.06 + bass * 0.05
  }

  dispose(): void {
    if (this.emberParticles) {
      this.emberParticles.geometry.dispose()
      ;(this.emberParticles.material as THREE.Material).dispose()
      this.emberParticles = null
    }
    super.dispose()
  }
}
