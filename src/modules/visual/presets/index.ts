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
import { AuroraPreset } from './AuroraPreset'
import { StarryPreset } from './StarryPreset'
import { OceanPreset } from './OceanPreset'
import { FlamePreset } from './FlamePreset'
import { MatrixPreset } from './MatrixPreset'
import { GeometryPreset } from './GeometryPreset'
import { ParticleFlowPreset } from './ParticleFlowPreset'

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
    case 'aurora':
      preset = new AuroraPreset(options)
      break
    case 'starry':
      preset = new StarryPreset(options)
      break
    case 'ocean':
      preset = new OceanPreset(options)
      break
    case 'flame':
      preset = new FlamePreset(options)
      break
    case 'matrix':
      preset = new MatrixPreset(options)
      break
    case 'geometry':
      preset = new GeometryPreset(options)
      break
    case 'particleFlow':
      preset = new ParticleFlowPreset(options)
      break
    default:
      preset = new EmilyPreset(options)
  }

  scene.add(preset.group)
  return preset
}

export {
  EmilyPreset,
  GalaxyPreset,
  VinylPreset,
  PlanetPreset,
  CylinderPreset,
  VoidPreset,
  SkullPreset,
  AuroraPreset,
  StarryPreset,
  OceanPreset,
  FlamePreset,
  MatrixPreset,
  GeometryPreset,
  ParticleFlowPreset,
}
