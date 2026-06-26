import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

export class GeometryPreset extends BaseParticleSystem {
  private time = 0
  private shapes: THREE.Group[] = []
  private shapeCount = 5

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 0.3)
    this.createShapes()
  }

  private createShapes(): void {
    const shapeTypes = [
      () => new THREE.TetrahedronGeometry(0.6, 0),
      () => new THREE.OctahedronGeometry(0.6, 0),
      () => new THREE.IcosahedronGeometry(0.6, 0),
      () => new THREE.DodecahedronGeometry(0.5, 0),
      () => new THREE.TorusGeometry(0.4, 0.15, 8, 16),
      () => new THREE.TorusKnotGeometry(0.35, 0.12, 32, 8),
    ]

    const colors = [
      0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da,
    ]

    for (let i = 0; i < this.shapeCount; i++) {
      const shapeGroup = new THREE.Group()

      const geometry = shapeTypes[i % shapeTypes.length]()
      const material = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        wireframe: true,
        transparent: true,
        opacity: 0.8,
      })
      const mesh = new THREE.Mesh(geometry, material)
      shapeGroup.add(mesh)

      const innerGeometry = shapeTypes[(i + 2) % shapeTypes.length]()
      const innerMaterial = new THREE.MeshBasicMaterial({
        color: colors[(i + 3) % colors.length],
        wireframe: false,
        transparent: true,
        opacity: 0.3,
      })
      const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial)
      innerMesh.scale.setScalar(0.5)
      shapeGroup.add(innerMesh)

      const angle = (i / this.shapeCount) * Math.PI * 2
      const radius = 2.5
      shapeGroup.position.x = Math.cos(angle) * radius
      shapeGroup.position.y = Math.sin(angle * 0.7) * 1.5
      shapeGroup.position.z = Math.sin(angle) * radius

      ;(shapeGroup as any).baseRotationSpeed = {
        x: 0.3 + Math.random() * 0.5,
        y: 0.5 + Math.random() * 0.5,
        z: 0.2 + Math.random() * 0.3,
      }
      ;(shapeGroup as any).basePosition = shapeGroup.position.clone()
      ;(shapeGroup as any).phase = Math.random() * Math.PI * 2

      this.shapes.push(shapeGroup)
      this.group.add(shapeGroup)
    }

    const particleCount = Math.floor(this.getParticleBaseCount() * 0.4)
    const positions = new Float32Array(particleCount * 3)
    const particleColors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const radius = 3.5 + Math.random() * 1.5

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = radius * Math.cos(phi)

      const color = colors[Math.floor(Math.random() * colors.length)]
      particleColors[i3] = ((color >> 16) & 255) / 255
      particleColors[i3 + 1] = ((color >> 8) & 255) / 255
      particleColors[i3 + 2] = (color & 255) / 255
    }

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    this.points = new THREE.Points(particleGeometry, particleMaterial)
    this.points.frustumCulled = false
    this.geometry = particleGeometry
    this.material = particleMaterial
    this.group.add(this.points)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const mid = audio.mid || 0
    const high = audio.high || 0
    const beatPulse = audio.beatPulse || 0

    for (let i = 0; i < this.shapes.length; i++) {
      const shape = this.shapes[i]
      const base = (shape as any).basePosition as THREE.Vector3
      const speed = (shape as any).baseRotationSpeed as { x: number; y: number; z: number }
      const phase = (shape as any).phase as number

      const rotationMultiplier = 1 + energy * 2 + bass * 3
      shape.rotation.x += speed.x * rotationMultiplier * dt
      shape.rotation.y += speed.y * rotationMultiplier * dt
      shape.rotation.z += speed.z * rotationMultiplier * dt

      const pulseScale = 1 + beatPulse * 0.3 + bass * 0.2
      shape.scale.setScalar(pulseScale)

      shape.position.x = base.x + Math.sin(this.time * 0.8 + phase) * 0.5 * (1 + mid)
      shape.position.y = base.y + Math.cos(this.time * 0.6 + phase * 1.2) * 0.5 * (1 + high)
      shape.position.z = base.z + Math.sin(this.time * 0.7 + phase * 0.8) * 0.5 * (1 + mid)

      shape.children.forEach((child, idx) => {
        const mesh = child as THREE.Mesh
        const mat = mesh.material as THREE.MeshBasicMaterial
        if (idx === 0) {
          mat.opacity = 0.6 + energy * 0.4
        } else {
          mat.opacity = 0.2 + beatPulse * 0.3
        }
      })
    }

    if (this.points) {
      const positions = this.geometry?.getAttribute('position') as THREE.BufferAttribute
      if (positions) {
        const arr = positions.array as Float32Array
        const count = arr.length / 3
        for (let i = 0; i < count; i++) {
          const i3 = i * 3
          arr[i3 + 1] += Math.sin(this.time * 0.5 + i * 0.01) * 0.002 * (1 + energy)
        }
        positions.needsUpdate = true
      }
    }

    this.group.rotation.y += (0.05 + energy * 0.15) * dt
    this.group.rotation.x = Math.sin(this.time * 0.1) * 0.1

    const globalScale = 1 + beatPulse * 0.12
    this.group.scale.setScalar(globalScale)

    if (this.material) {
      const mat = this.material as THREE.PointsMaterial
      mat.opacity = 0.5 + energy * 0.3
      mat.size = 0.02 + bass * 0.02
    }
  }

  dispose(): void {
    this.shapes.forEach((shape) => {
      shape.traverse((child) => {
        if ((child as THREE.Mesh).geometry) {
          (child as THREE.Mesh).geometry.dispose()
        }
        if ((child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material as THREE.Material
          mat.dispose()
        }
      })
    })
    this.shapes = []
    super.dispose()
  }
}
