import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class DJPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private velocities: Float32Array | null = null
  private time = 0
  private ringGroup: THREE.Group | null = null
  private spectrumBars: THREE.Mesh[] = []
  private spectrumBarCount = 32

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.8)
    this.createParticles()
    this.createSpectrumRings()
  }

  private createParticles(): void {
    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)

    const djColors = [
      { r: 1, g: 0.2, b: 0.5 },
      { r: 0.3, g: 0.8, b: 1 },
      { r: 1, g: 0.8, b: 0.2 },
      { r: 0.5, g: 0.3, b: 1 },
      { r: 0.2, g: 1, b: 0.6 },
    ]

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      const theta = Math.random() * Math.PI * 2
      const radius = 1 + Math.random() * 4
      const y = (Math.random() - 0.5) * 4

      this.positions[i3] = Math.cos(theta) * radius
      this.positions[i3 + 1] = y
      this.positions[i3 + 2] = Math.sin(theta) * radius

      const color = djColors[Math.floor(Math.random() * djColors.length)]
      this.colors[i3] = color.r
      this.colors[i3 + 1] = color.g
      this.colors[i3 + 2] = color.b

      this.velocities[i3] = (Math.random() - 0.5) * 0.02
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.02
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.02
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

  private createSpectrumRings(): void {
    this.ringGroup = new THREE.Group()

    const glowColor = new THREE.Color(this.options.glowColor)

    const ringGeo = new THREE.TorusGeometry(2.5, 0.02, 8, 64)
    const ringMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.6,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2
    this.ringGroup.add(ring)

    const ringGeo2 = new THREE.TorusGeometry(3.5, 0.015, 8, 64)
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.options.color),
      transparent: true,
      opacity: 0.4,
    })
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2)
    ring2.rotation.x = Math.PI / 2
    this.ringGroup.add(ring2)

    for (let i = 0; i < this.spectrumBarCount; i++) {
      const angle = (i / this.spectrumBarCount) * Math.PI * 2
      const barGeo = new THREE.BoxGeometry(0.08, 0.1, 0.08)
      const barMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? glowColor : new THREE.Color(this.options.color),
        transparent: true,
        opacity: 0.8,
      })
      const bar = new THREE.Mesh(barGeo, barMat)
      bar.position.set(Math.cos(angle) * 3, 0, Math.sin(angle) * 3)
      bar.userData.baseAngle = angle
      bar.userData.baseHeight = 0.1
      this.spectrumBars.push(bar)
      this.ringGroup.add(bar)
    }

    this.ringGroup.position.y = -0.5
    this.group.add(this.ringGroup)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.points || !this.positions || !this.velocities) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0
    const speedMult = audio.isPlaying ? 1 : 0.2

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3

      this.positions[i3] += this.velocities[i3] * (1 + bass * 5) * speedMult
      this.positions[i3 + 1] += this.velocities[i3 + 1] * (1 + mid * 3) * speedMult
      this.positions[i3 + 2] += this.velocities[i3 + 2] * (1 + high * 5) * speedMult

      const dist = Math.sqrt(
        this.positions[i3] ** 2 + this.positions[i3 + 2] ** 2
      )

      if (dist > 6 || Math.abs(this.positions[i3 + 1]) > 3) {
        const theta = Math.random() * Math.PI * 2
        const radius = 1 + Math.random() * 2
        const y = (Math.random() - 0.5) * 2
        this.positions[i3] = Math.cos(theta) * radius
        this.positions[i3 + 1] = y
        this.positions[i3 + 2] = Math.sin(theta) * radius
      }

      if (beatPulse > 0.5 && Math.random() < 0.1) {
        const colorBoost = beatPulse * 0.5
        this.colors[i3] = Math.min(1, this.colors[i3] + colorBoost)
        this.colors[i3 + 1] = Math.min(1, this.colors[i3 + 1] + colorBoost * 0.5)
        this.colors[i3 + 2] = Math.min(1, this.colors[i3 + 2] + colorBoost * 0.3)
      }
    }

    this.group.rotation.y += (0.1 + bass * 0.5) * dt * speedMult
    this.group.rotation.z = Math.sin(this.time * 0.3) * 0.05 * energy

    const scale = 1 + beatPulse * 0.15
    this.group.scale.setScalar(scale)

    if (this.ringGroup) {
      this.ringGroup.rotation.y += (0.2 + energy * 0.5) * dt * speedMult

      for (let i = 0; i < this.spectrumBars.length; i++) {
        const bar = this.spectrumBars[i]
        const angle = bar.userData.baseAngle
        const spectrumIndex = Math.floor((i / this.spectrumBars.length) * 8)
        const spectrumEnergy = (bass + mid + high) / 3 + Math.sin(this.time * 2 + i) * 0.1
        const height = 0.1 + spectrumEnergy * 2 * (1 + Math.sin(angle * 2 + this.time) * 0.3)

        bar.scale.y = Math.max(0.1, height * 2)
        bar.position.y = -0.5 + height

        const barMat = bar.material as THREE.MeshBasicMaterial
        barMat.opacity = 0.5 + beatPulse * 0.5
      }

      const rings = this.ringGroup.children
      if (rings[0] && rings[0] instanceof THREE.Mesh) {
        const ringMat = rings[0].material as THREE.MeshBasicMaterial
        ringMat.opacity = 0.4 + bass * 0.6
        rings[0].scale.setScalar(1 + beatPulse * 0.1)
      }
      if (rings[1] && rings[1] instanceof THREE.Mesh) {
        const ringMat = rings[1].material as THREE.MeshBasicMaterial
        ringMat.opacity = 0.3 + mid * 0.5
        rings[1].scale.setScalar(1 + energy * 0.05)
      }
    }

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = 0.7 + energy * 0.3
    mat.size = 0.03 + bass * 0.04

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true

    const colorAttr = this.points.geometry.getAttribute('color') as THREE.BufferAttribute
    colorAttr.needsUpdate = true
  }

  dispose(): void {
    if (this.ringGroup) {
      this.spectrumBars.forEach((bar) => {
        if (bar.geometry) bar.geometry.dispose()
        if (bar.material) {
          const mat = bar.material as THREE.Material
          if ('dispose' in mat) mat.dispose()
        }
      })
      this.spectrumBars = []
      this.ringGroup.clear()
      this.group.remove(this.ringGroup)
      this.ringGroup = null
    }
    super.dispose()
  }
}
