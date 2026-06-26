import * as THREE from 'three'
import type { ParticleSystem as IParticleSystem, AudioAnalysisData, ParticlePresetOptions } from './types'

export abstract class BaseParticleSystem implements IParticleSystem {
  group: THREE.Group
  protected points: THREE.Points | null = null
  protected geometry: THREE.BufferGeometry | null = null
  protected material: THREE.PointsMaterial | THREE.ShaderMaterial | null = null
  protected options: ParticlePresetOptions
  protected particleCount = 0

  constructor(options: ParticlePresetOptions) {
    this.options = options
    this.group = new THREE.Group()
  }

  protected getParticleBaseCount(): number {
    const base = 3000
    const mult = { eco: 0.3, balanced: 1, high: 1.5, ultra: 2.2 }
    return Math.floor(base * (mult[this.options.quality] || 1) * this.options.resolution)
  }

  protected createPointsMaterial(color: string, size = 0.03): THREE.PointsMaterial {
    return new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  }

  protected hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 1, g: 0.5, b: 0.5 }
  }

  abstract update(dt: number, audio: AudioAnalysisData): void

  resize(): void {
    // 子类可覆盖
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
  }

  dispose(): void {
    if (this.geometry) {
      this.geometry.dispose()
      this.geometry = null
    }
    if (this.material) {
      if ('dispose' in this.material) {
        this.material.dispose()
      }
      this.material = null
    }
    this.points = null
    this.group.clear()
  }
}
