import type * as THREE from 'three'

export type ShelfMode = 'off' | 'side' | 'stage'
export type ShelfCameraMode = 'dynamic' | 'static'
export type ShelfPresence = 'auto' | 'always'

export type ShelfItemType = 'playlist' | 'podcastCollection' | 'queue' | 'empty'

export interface ShelfItem {
  type: ShelfItemType
  id: string
  title: string
  sub: string
  cover: string
  tag: string
  playlistId?: string
  podcastKey?: string
  queueIndex?: number
  provider?: string
  isNowPlaying?: boolean
}

export interface ShelfCard {
  index: number
  item: ShelfItem
  mesh: THREE.Mesh
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  texture: THREE.CanvasTexture
  isCenter: boolean
  selected: boolean
  floatMix: number
  fxPulse: number
  dofBlur: number
  dofBucket: number
  drawKey: string
}

export interface ShelfSettings {
  size: number
  x: number
  y: number
  z: number
  angle: number
  opacity: number
  bgOpacity: number
  accent: string
}

export interface ShelfLayoutProfile {
  portrait: boolean
  sideX: number
  sideXStep: number
  sideY: number
  sideYStep: number
  sideZ: number
  sideZStep: number
  sideRotX: number
  sideRotY: number
  sideScale: number
  sideEntryX: number
  sideDetailShift: number
  stageX: number
  stageXStep: number
  stageY: number
  stageZ: number
  stageScale: number
  detail: ShelfDetailLayout
}

export interface ShelfDetailLayout {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rowStep: number
  rowScale: number
}

export interface PointerParallax {
  x: number
  y: number
}

export interface ShelfEngineOptions {
  mode?: ShelfMode
  cameraMode?: ShelfCameraMode
  presence?: ShelfPresence
  accentColor?: string
  showPodcasts?: boolean
  mergeCollections?: boolean
  size?: number
  offsetX?: number
  offsetY?: number
  offsetZ?: number
  angleY?: number
  opacity?: number
  bgOpacity?: number
}

export interface ShelfEngineEvents {
  onCardClick?: (card: ShelfCard, action: ShelfCardAction) => void
  onCardHover?: (card: ShelfCard | null) => void
  onContentOpen?: (card: ShelfCard) => void
  onContentClose?: () => void
  onModeChange?: (mode: ShelfMode) => void
  onScroll?: (direction: number) => void
  onSelect?: (index: number) => void
}

export interface ShelfCardAction {
  kind: 'loadPlaylist' | 'playQueue' | 'empty'
  playlistId?: string
  title?: string
  index?: number
}

export interface CoverCacheEntry {
  url: string
  loaded: boolean
  loading: boolean
  failed: boolean
  img: HTMLImageElement | null
}
