import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class WallpaperPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private twinklePhases: Float32Array | null = null
  private time = 0
  private nebulaGroup: THREE.Group | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 2)
    this.createParticles()
    this.createNebula()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.twinklePhases = new Float32Array(count)

    const starColors = [
      { r: 0.8, g: 0.85, b: 1 },
      { r: 0.7, g: 0.75, b: 0.95 },
      { r: 0.9, g: 0.9, b: 1 },
      { r: 0.6, g: 0.7, b: 0.9 },
      { r: 0.85, g: 0.8, b: 0.95 },
    ]

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 8 + Math.random() * 8

      this.positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      this.positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      this.positions[i3 + 2] = radius * Math.cos(phi)

      const color = starColors[Math.floor(Math.random() * starColors.length)]
      const brightness = 0.2 + Math.random() * 0.6
      this.colors[i3] = color.r * brightness
      this.colors[i3 + 1] = color.g * brightness
      this.colors[i3 + 2] = color.b * brightness

      this.twinklePhases[i] = Math.random() * Math.PI * 2
    }

    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.015,
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

  private createNebula(): void {
    this.nebulaGroup = new THREE.Group()

    const nebulaColors = [
      new THREE.Color(0x2a3f5f),
      new THREE.Color(0x3d2f5f),
      new THREE.Color(0x1f3d4f),
    ]

    for (let i = 0; i < 5; i++) {
      const nebulaGeo = new THREE.SphereGeometry(3 + Math.random() * 2, 16, 16)
      const nebulaMat = new THREE.MeshBasicMaterial({
        color: nebulaColors[i % nebulaColors.length],
        transparent: true,
        opacity: 0.03 + Math.random() * 0.05,
        side: THREE.BackSide,
      })
      const nebula = new THREE.Mesh(nebulaGeo, nebulaMat)
      nebula.position.set(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 6
      )
      nebula.scale.setScalar(1 + Math.random() * 1.5)
      this.nebulaGroup.add(nebula)
    }

    this.group.add(this.nebulaGroup)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.colors || !this.twinklePhases) return

    this.time += dt * 0.15
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const high = audio.high || 0
    const speedMult = audio.isPlaying ? 1 : 0.5

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3
      const twinkle = Math.sin(this.time * 0.5 + this.twinklePhases[i])
      const twinkleAmount = 0.15 + high * 0.2

      const baseBrightness = 0.2 + (this.colors[i3] + this.colors[i3 + 1] + this.colors[i3 + 2]) / 9
      const brightness = baseBrightness * (1 + twinkle * twinkleAmount)

      this.colors[i3] = Math.min(1, this.colors[i3] * (brightness / baseBrightness) * 0.5)
      this.colors[i3 + 1] = Math.min(1, this.colors[i3 + 1] * (brightness / baseBrightness) * 0.5)
      this.colors[i3 + 2] = Math.min(1, this.colors[i3 + 2] * (brightness / baseBrightness) * 0.5)
    }

    const rotationSpeed = 0.008 + energy * 0.02
    this.group.rotation.y += rotationSpeed * dt * speedMult
    this.group.rotation.x = Math.sin(this.time * 0.1) * 0.05

    const scale = 1 + bass * 0.05
    this.group.scale.setScalar(scale)

    if (this.nebulaGroup) {
      this.nebulaGroup.rotation.y += 0.003 * dt * speedMult
      this.nebulaGroup.rotation.z = Math.sin(this.time * 0.05) * 0.03
    }

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.6 + energy * 0.3
    mat.size = 0.01 + bass * 0.01

    const colorAttr = this.points.geometry.getAttribute('color') as THREE.BufferAttribute
    colorAttr.needsUpdate = true
  }

  dispose(): void {
    if (this.nebulaGroup) {
      this.nebulaGroup.children.forEach((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose()
          if (child.material) {
            const mat = child.material as THREE.Material
            if ('dispose' in mat) mat.dispose()
          }
        }
      })
      this.nebulaGroup.clear()
      this.group.remove(this.nebulaGroup)
      this.nebulaGroup = null
    }
    super.dispose()
  }
}
