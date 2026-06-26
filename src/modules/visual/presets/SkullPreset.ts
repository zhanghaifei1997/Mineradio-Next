import * as THREE from 'three'
import { BaseParticleSystem } from '../ParticleSystem'
import type { AudioAnalysisData, ParticlePresetOptions } from '../types'

const SKULL_ASSET_PATH = 'assets/skull-decimation-points.bin'

let skullAssetCache: Float32Array | null = null
let skullAssetLoading = false
let skullAssetFailed = false
let skullAssetPromise: Promise<Float32Array | null> | null = null

function loadSkullAsset(): Promise<Float32Array | null> {
  if (skullAssetCache) return Promise.resolve(skullAssetCache)
  if (skullAssetFailed) return Promise.resolve(null)
  if (skullAssetPromise) return skullAssetPromise

  skullAssetLoading = true
  skullAssetPromise = fetch(SKULL_ASSET_PATH)
    .then((res) => {
      if (!res.ok) throw new Error(`skull asset ${res.status}`)
      return res.arrayBuffer()
    })
    .then((buf) => {
      if (!buf || buf.byteLength < 20 || buf.byteLength % 20 !== 0) {
        throw new Error('invalid skull asset')
      }
      skullAssetCache = new Float32Array(buf)
      skullAssetLoading = false
      skullAssetPromise = null
      return skullAssetCache
    })
    .catch((err) => {
      console.warn('skull particle asset load failed:', err)
      skullAssetFailed = true
      skullAssetLoading = false
      skullAssetPromise = null
      return null
    })

  return skullAssetPromise
}

export class SkullPreset extends BaseParticleSystem {
  private positions: Float32Array | null = null
  private colors: Float32Array | null = null
  private basePositions: Float32Array | null = null
  private kinds: Float32Array | null = null
  private seeds: Float32Array | null = null
  private time = 0
  private jawOpenAmount = 0
  private assetLoaded = false
  private loading = false
  private crossMesh: THREE.Mesh | null = null
  private crossGlow: THREE.Mesh | null = null

  constructor(options: ParticlePresetOptions) {
    super(options)
    this.particleCount = Math.floor(this.getParticleBaseCount() * 1.5)
    this.init()
  }

  private async init(): Promise<void> {
    this.loading = true
    this.createPlaceholder()
    this.createCross()

    const asset = await loadSkullAsset()
    this.loading = false

    if (asset) {
      this.assetLoaded = true
      this.rebuildFromAsset(asset)
    } else {
      this.generateFallbackSkull()
    }
  }

  private createPlaceholder(): void {
    const count = Math.floor(this.particleCount * 0.3)
    this.positions = new Float32Array(count * 3)
    this.basePositions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.kinds = new Float32Array(count)
    this.seeds = new Float32Array(count)

    const baseColor = this.hexToRgb(this.options.glowColor)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 1.2 + (Math.random() - 0.5) * 0.3

      this.positions[i3] = r * Math.sin(phi) * Math.cos(theta)
      this.positions[i3 + 1] = r * Math.cos(phi)
      this.positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta)

      this.basePositions[i3] = this.positions[i3]
      this.basePositions[i3 + 1] = this.positions[i3 + 1]
      this.basePositions[i3 + 2] = this.positions[i3 + 2]

      const brightness = 0.3 + Math.random() * 0.4
      this.colors[i3] = baseColor.r * brightness
      this.colors[i3 + 1] = baseColor.g * brightness
      this.colors[i3 + 2] = baseColor.b * brightness

      this.kinds[i] = 0
      this.seeds[i] = Math.random() * 1000
    }

    this.buildGeometry()
  }

  private rebuildFromAsset(asset: Float32Array): void {
    if (this.geometry) {
      this.geometry.dispose()
      this.geometry = null
    }
    if (this.points) {
      this.group.remove(this.points)
      this.points = null
    }

    const totalPoints = Math.floor(asset.length / 5)
    const qualityMult = { eco: 0.4, balanced: 0.7, high: 1, ultra: 1 }[this.options.quality] || 1
    const resolutionMult = this.options.resolution
    const targetCount = Math.floor(totalPoints * qualityMult * resolutionMult)
    const stride = Math.max(1, Math.floor(totalPoints / targetCount))
    const count = Math.floor(totalPoints / stride)

    this.particleCount = count
    this.positions = new Float32Array(count * 3)
    this.basePositions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.kinds = new Float32Array(count)
    this.seeds = new Float32Array(count)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)

    let idx = 0
    for (let i = 0; i < totalPoints && idx < count; i += stride, idx++) {
      const i5 = i * 5
      const i3 = idx * 3

      const x = asset[i5]
      const y = asset[i5 + 1]
      const z = asset[i5 + 2]
      const kind = asset[i5 + 3]
      const seed = asset[i5 + 4]

      this.positions[i3] = x
      this.positions[i3 + 1] = y
      this.positions[i3 + 2] = z

      this.basePositions[i3] = x
      this.basePositions[i3 + 1] = y
      this.basePositions[i3 + 2] = z

      this.kinds[idx] = kind
      this.seeds[idx] = seed

      const colorMix = this.getColorMixForKind(kind, seed)
      this.colors[i3] = baseColor.r * (1 - colorMix) + glowColor.r * colorMix
      this.colors[i3 + 1] = baseColor.g * (1 - colorMix) + glowColor.g * colorMix
      this.colors[i3 + 2] = baseColor.b * (1 - colorMix) + glowColor.b * colorMix
    }

    this.buildGeometry()
  }

  private getColorMixForKind(kind: number, seed: number): number {
    const rand = (seed % 1000) / 1000
    switch (Math.floor(kind)) {
      case 0:
        return 0.15 + rand * 0.2
      case 1:
        return 0.3 + rand * 0.3
      case 2:
        return 0.5 + rand * 0.4
      case 3:
        return 0.2 + rand * 0.25
      default:
        return 0.2 + rand * 0.3
    }
  }

  private generateFallbackSkull(): void {
    if (this.geometry) {
      this.geometry.dispose()
      this.geometry = null
    }
    if (this.points) {
      this.group.remove(this.points)
      this.points = null
    }

    const count = this.particleCount
    this.positions = new Float32Array(count * 3)
    this.basePositions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.kinds = new Float32Array(count)
    this.seeds = new Float32Array(count)

    const baseColor = this.hexToRgb(this.options.color)
    const glowColor = this.hexToRgb(this.options.glowColor)

    const skullParts = [
      { ratio: 0.4, type: 'cranium', kind: 0 },
      { ratio: 0.25, type: 'jaw', kind: 1 },
      { ratio: 0.15, type: 'eyeSockets', kind: 2 },
      { ratio: 0.1, type: 'nasal', kind: 3 },
      { ratio: 0.1, type: 'teeth', kind: 1 },
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

        this.positions[i3] = x
        this.positions[i3 + 1] = y
        this.positions[i3 + 2] = z

        this.basePositions[i3] = x
        this.basePositions[i3 + 1] = y
        this.basePositions[i3 + 2] = z

        this.kinds[idx] = part.kind
        this.seeds[idx] = Math.random() * 1000

        this.colors[i3] = baseColor.r * (1 - colorMix) + glowColor.r * colorMix
        this.colors[i3 + 1] = baseColor.g * (1 - colorMix) + glowColor.g * colorMix
        this.colors[i3 + 2] = baseColor.b * (1 - colorMix) + glowColor.b * colorMix
      }
    }

    while (idx < count) {
      const i3 = idx * 3
      this.positions[i3] = (Math.random() - 0.5) * 2
      this.positions[i3 + 1] = (Math.random() - 0.5) * 2
      this.positions[i3 + 2] = (Math.random() - 0.5) * 2
      this.basePositions[i3] = this.positions[i3]
      this.basePositions[i3 + 1] = this.positions[i3 + 1]
      this.basePositions[i3 + 2] = this.positions[i3 + 2]
      this.colors[i3] = baseColor.r
      this.colors[i3 + 1] = baseColor.g
      this.colors[i3 + 2] = baseColor.b
      this.kinds[idx] = 0
      this.seeds[idx] = Math.random() * 1000
      idx++
    }

    this.buildGeometry()
  }

  private buildGeometry(): void {
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions as Float32Array, 3))
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors as Float32Array, 3))

    this.material = new THREE.PointsMaterial({
      size: 0.022,
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

    this.group.scale.setScalar(2.34)
    this.group.position.y = 0.22
    this.group.position.z = 0.1
    this.group.rotation.x = -0.26
  }

  private createCross(): void {
    const crossGroup = new THREE.Group()

    const verticalGeo = new THREE.BoxGeometry(0.08, 0.6, 0.08)
    const horizontalGeo = new THREE.BoxGeometry(0.35, 0.08, 0.08)

    const crossMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.options.glowColor),
      transparent: true,
      opacity: 0.85,
    })

    const vertical = new THREE.Mesh(verticalGeo, crossMaterial)
    const horizontal = new THREE.Mesh(horizontalGeo, crossMaterial)

    vertical.position.y = 0
    horizontal.position.y = 0.1

    crossGroup.add(vertical)
    crossGroup.add(horizontal)

    crossGroup.position.set(0, 0.5, -1.5)
    crossGroup.scale.setScalar(0.6)

    this.crossMesh = vertical
    this.crossGlow = horizontal

    const glowGeo = new THREE.SphereGeometry(0.25, 16, 16)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.options.glowColor),
      transparent: true,
      opacity: 0.15,
    })
    const glowSphere = new THREE.Mesh(glowGeo, glowMaterial)
    glowSphere.position.set(0, 0.1, 0)
    crossGroup.add(glowSphere)
    this.crossGlow = glowSphere

    crossGroup.name = 'skull-cross'
    this.group.add(crossGroup)
  }

  update(dt: number, audio: AudioAnalysisData): void {
    if (!this.positions || !this.basePositions || !this.points) return

    this.time += dt
    const energy = audio.energy || 0
    const bass = audio.bass || 0
    const beatPulse = audio.beatPulse || 0
    const speedMult = audio.isPlaying ? 1 : 0.2

    const targetJawOpen = bass * 0.8
    this.jawOpenAmount += (targetJawOpen - this.jawOpenAmount) * 0.1

    const positions = this.positions
    const base = this.basePositions
    const kinds = this.kinds

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3
      const by = base[i3 + 1]
      const kind = kinds ? kinds[i] : 0

      let jawOffset = 0
      if (by < -0.3 && (kind === 1 || by < -0.4)) {
        const jawFactor = Math.min(1, (-by - 0.3) / 0.5)
        jawOffset = -this.jawOpenAmount * jawFactor * 0.3
      }

      const seed = this.seeds ? this.seeds[i] : i * 0.01
      const breatheOffset = Math.sin(this.time * 0.8 + seed * 0.01) * 0.015 * energy

      positions[i3] = base[i3] + (Math.random() - 0.5) * 0.008 * bass
      positions[i3 + 1] = base[i3 + 1] + jawOffset + breatheOffset
      positions[i3 + 2] = base[i3 + 2] + (Math.random() - 0.5) * 0.008 * bass
    }

    const scale = 1 + beatPulse * 0.12
    this.group.scale.setScalar(2.34 * scale)

    this.group.rotation.y = Math.sin(this.time * 0.15) * 0.08 + beatPulse * 0.04
    this.group.rotation.x = -0.26 + Math.sin(this.time * 0.2) * 0.03

    const mat = this.material as THREE.PointsMaterial
    mat.opacity = (this.loading ? 0.5 : 0.75) + energy * 0.2
    mat.size = 0.018 + bass * 0.018

    const cross = this.group.getObjectByName('skull-cross')
    if (cross) {
      cross.rotation.z = Math.sin(this.time * 0.3) * 0.05
      const crossScale = 0.6 + beatPulse * 0.15
      cross.scale.setScalar(crossScale)
      const crossMat = (cross.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
      if (crossMat) {
        crossMat.opacity = 0.7 + beatPulse * 0.3
      }
    }

    const posAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.needsUpdate = true
  }

  dispose(): void {
    if (this.crossMesh) {
      if (this.crossMesh.geometry) this.crossMesh.geometry.dispose()
      if (this.crossMesh.material) {
        const mat = this.crossMesh.material as THREE.Material
        if ('dispose' in mat) mat.dispose()
      }
      this.crossMesh = null
    }
    if (this.crossGlow) {
      if (this.crossGlow.geometry) this.crossGlow.geometry.dispose()
      if (this.crossGlow.material) {
        const mat = this.crossGlow.material as THREE.Material
        if ('dispose' in mat) mat.dispose()
      }
      this.crossGlow = null
    }
    super.dispose()
  }
}
