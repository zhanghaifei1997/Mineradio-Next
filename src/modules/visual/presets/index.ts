import type { VisualPreset } from '../types'
import type { ParticlePresetOptions, ParticleSystem } from '../types'
import * as THREE from 'three'
import { EmilyPreset } from './EmilyPreset'
import { GalaxyPreset } from './GalaxyPreset'
import { VinylPreset } from './VinylPreset'
import { PlanetPreset } from './PlanetPreset'
import { CylinderPreset } from './CylinderPreset'
import { VoidPreset } from './VoidPreset'
import { SkullPreset } from './SkullPreset'

export function createPreset(
  name: VisualPreset,
  scene: THREE.Scene,
  options: ParticlePresetOptions,
): ParticleSystem {
  let preset: ParticleSystem

  switch (name) {
    case 'emily':
      preset = new EmilyPreset(options)
      break
    case 'galaxy':
      preset = new GalaxyPreset(options)
      break
    case 'vinyl':
      preset = new VinylPreset(options)
      break
    case 'planet':
      preset = new PlanetPreset(options)
      break
    case 'cylinder':
      preset = new CylinderPreset(options)
      break
    case 'void':
      preset = new VoidPreset(options)
      break
    case 'skull':
      preset = new SkullPreset(options)
      break
    default:
      preset = new EmilyPreset(options)
  }

  scene.add(preset.group)
  return preset
}

export { EmilyPreset, GalaxyPreset, VinylPreset, PlanetPreset, CylinderPreset, VoidPreset, SkullPreset }
