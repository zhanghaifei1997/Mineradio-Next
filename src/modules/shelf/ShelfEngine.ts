import * as THREE from 'three'
import type {
  ShelfMode,
  ShelfCameraMode,
  ShelfPresence,
  ShelfItem,
  ShelfCard,
  ShelfSettings,
  ShelfLayoutProfile,
  PointerParallax,
  ShelfEngineOptions,
  ShelfEngineEvents,
  ShelfCardAction,
} from './types'
import {
  getLayoutProfile,
  SHELF_CONSTANTS,
  smoothstep,
} from './ShelfLayout'
import { buildCard, disposeCard, drawCard } from './ShelfCard'
import { clamp } from '@/utils'

export class ShelfEngine {
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer | null = null
  private container: HTMLElement | null = null

  private group: THREE.Group | null = null
  private cards: ShelfCard[] = []
  private allItems: ShelfItem[] = []
  private renderedStart = -1

  private mode: ShelfMode = 'side'
  private cameraMode: ShelfCameraMode = 'dynamic'
  private presence: ShelfPresence = 'always'
  private selectedIdx = -1
  private centerTarget = 0
  private centerSmooth = 0
  private openCardIdx = -1

  private pointerParallax: PointerParallax = { x: 0, y: 0 }
  private pointerTarget: PointerParallax = { x: 0, y: 0 }

  private shelfVisibility = 0
  private shelfPinnedOpen = false
  private shelfOpenAnimAt = 0
  private edgeHover = false

  private settings: ShelfSettings = {
    size: 1.0,
    x: 0,
    y: 0,
    z: 0,
    angle: 0,
    opacity: 0.9,
    bgOpacity: 0.7,
    accent: '#f4d28a',
  }

  private events: ShelfEngineEvents = {}
  private animationId: number | null = null
  private lastTime = 0
  private time = 0

  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()
  private hoveredCard: ShelfCard | null = null

  private isPlaying = false
  private bass = 0
  private beatPulse = 0

  private contentOpen = false

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, options?: ShelfEngineOptions, events?: ShelfEngineEvents) {
    this.scene = scene
    this.camera = camera
    if (options) {
      if (options.mode) this.mode = options.mode
      if (options.cameraMode) this.cameraMode = options.cameraMode
      if (options.presence) this.presence = options.presence
      if (options.accentColor) this.settings.accent = options.accentColor
      if (options.size != null) this.settings.size = options.size
      if (options.offsetX != null) this.settings.x = options.offsetX
      if (options.offsetY != null) this.settings.y = options.offsetY
      if (options.offsetZ != null) this.settings.z = options.offsetZ
      if (options.angleY != null) this.settings.angle = (options.angleY * Math.PI) / 180
      if (options.opacity != null) this.settings.opacity = options.opacity
      if (options.bgOpacity != null) this.settings.bgOpacity = options.bgOpacity
    }
    if (events) this.events = events
  }

  setContainer(container: HTMLElement, renderer: THREE.WebGLRenderer): void {
    this.container = container
    this.renderer = renderer
  }

  setItems(items: ShelfItem[]): void {
    this.allItems = items
    if (this.centerTarget >= items.length) {
      this.centerTarget = Math.max(0, items.length - 1)
      this.centerSmooth = this.centerTarget
    }
    if (this.selectedIdx >= items.length) {
      this.selectedIdx = -1
    }
    this.syncRenderedWindow(true)
  }

  setMode(mode: ShelfMode): void {
    if (mode === this.mode && this.group) return
    this.mode = mode

    if (mode === 'off') {
      this.disposeGroup()
      return
    }

    if (!this.group) {
      this.group = new THREE.Group()
      this.group.renderOrder = 50
      this.scene.add(this.group)
    }

    this.syncRenderedWindow(true)
    this.events.onModeChange?.(mode)
  }

  getMode(): ShelfMode {
    return this.mode
  }

  setCameraMode(mode: ShelfCameraMode): void {
    this.cameraMode = mode
  }

  getCameraMode(): ShelfCameraMode {
    return this.cameraMode
  }

  setPresence(presence: ShelfPresence): void {
    this.presence = presence
  }

  getPresence(): ShelfPresence {
    return this.presence
  }

  setEdgeHover(hovering: boolean): void {
    this.edgeHover = hovering
  }

  setAccentColor(color: string): void {
    this.settings.accent = color
    this.refreshTheme()
  }

  setSettings(settings: Partial<ShelfSettings>): void {
    Object.assign(this.settings, settings)
    this.refreshTheme()
  }

  getSettings(): ShelfSettings {
    return { ...this.settings }
  }

  setAudioData(isPlaying: boolean, bass: number, beatPulse: number): void {
    this.isPlaying = isPlaying
    this.bass = bass
    this.beatPulse = beatPulse
  }

  setPinnedOpen(pinned: boolean): void {
    this.shelfPinnedOpen = pinned
    if (pinned) {
      this.shelfOpenAnimAt = this.time
    }
  }

  isPinnedOpen(): boolean {
    return this.shelfPinnedOpen
  }

  hasOpenContent(): boolean {
    return this.contentOpen
  }

  getCards(): ShelfCard[] {
    return this.cards
  }

  getCenterIdx(): number {
    return Math.round(this.centerSmooth)
  }

  next(): void {
    this.step(1)
  }

  prev(): void {
    this.step(-1)
  }

  scrollBy(delta: number): void {
    this.step(delta)
  }

  setPointer(normalizedX: number, normalizedY: number): void {
    this.pointerTarget.x = clamp(normalizedX, -1, 1)
    this.pointerTarget.y = clamp(normalizedY, -1, 1)
  }

  handleClick(normalizedX: number, normalizedY: number): void {
    const card = this.pickCardAtScreen(normalizedX, normalizedY)
    if (card) {
      const action = card.mesh.userData.action as ShelfCardAction
      this.events.onCardClick?.(card, action)
      if (action.kind === 'loadPlaylist') {
        this.openContent(card.index)
      }
    }
  }

  handlePointerMove(normalizedX: number, normalizedY: number): void {
    this.setPointer(normalizedX, normalizedY)
    const card = this.pickCardAtScreen(normalizedX, normalizedY)
    if (card !== this.hoveredCard) {
      this.hoveredCard = card
      this.setSelected(card ? card.index : -1)
      this.events.onCardHover?.(card)
    }
  }

  handleWheel(deltaY: number): void {
    const sensitivity = 0.003
    this.scrollBy(deltaY * sensitivity)
  }

  openContent(cardIdx: number): void {
    const card = this.cards.find((c) => c.index === cardIdx)
    if (!card) return
    this.openCardIdx = cardIdx
    this.contentOpen = true
    this.shelfPinnedOpen = true
    this.events.onContentOpen?.(card)
  }

  closeContent(): void {
    this.openCardIdx = -1
    this.contentOpen = false
    this.events.onContentClose?.()
  }

  start(): void {
    if (this.animationId) return
    this.lastTime = performance.now()
    this.animate()
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  dispose(): void {
    this.stop()
    this.disposeGroup()
  }

  refreshTheme(): void {
    this.cards.forEach((c) => {
      c.drawKey = ''
      drawCard(c, c.item, this.settings, this.bass, this.beatPulse)
    })
  }

  private step(direction: number): void {
    if (!this.allItems.length) return
    const prevTarget = Math.round(this.centerTarget)
    this.centerTarget = Math.max(0, Math.min(this.allItems.length - 1, this.centerTarget + direction))
    const nextTarget = Math.round(this.centerTarget)
    if (prevTarget !== nextTarget) {
      this.events.onScroll?.(direction > 0 ? 1 : -1)
      this.events.onSelect?.(nextTarget)
    }
    this.syncRenderedWindow(false)
    this.setSelected(nextTarget)
  }

  private setSelected(idx: number): void {
    const nextIdx = idx == null || idx < 0 ? -1 : Math.round(idx)
    this.selectedIdx = nextIdx
    this.cards.forEach((c) => {
      const next = c.index === nextIdx
      if (c.selected !== next) {
        c.selected = next
        c.drawKey = ''
        drawCard(c, c.item, this.settings, this.bass, this.beatPulse)
      }
    })
  }

  private syncRenderedWindow(force: boolean): void {
    if (!this.group) return
    const total = this.allItems.length
    if (!total) {
      this.disposeCards()
      return
    }

    const center = Math.round(this.centerTarget)
    const start = Math.max(0, center - SHELF_CONSTANTS.VISIBLE_RADIUS)
    const end = Math.min(total - 1, start + SHELF_CONSTANTS.MAX_RENDER - 1)
    const finalStart = Math.max(0, end - SHELF_CONSTANTS.MAX_RENDER + 1)

    if (!force && finalStart === this.renderedStart && this.cards.length === end - finalStart + 1) {
      this.cards.forEach((c) => {
        const nextItem = this.allItems[c.index] || c.item
        if (c.item !== nextItem) {
          c.item = nextItem
          c.drawKey = ''
          drawCard(c, c.item, this.settings, this.bass, this.beatPulse)
        }
      })
      return
    }

    this.disposeCards()
    this.renderedStart = finalStart

    for (let itemIdx = finalStart; itemIdx <= end; itemIdx++) {
      const card = buildCard(this.allItems[itemIdx], itemIdx, this.group, this.settings)
      this.cards.push(card)
    }
  }

  private pickCardAtScreen(nx: number, ny: number): ShelfCard | null {
    if (!this.group || !this.group.visible || !this.cards.length) return null

    this.mouse.x = nx
    this.mouse.y = ny
    this.raycaster.setFromCamera(this.mouse, this.camera)

    const visibleMeshes = this.cards.filter((c) => c.mesh.visible).map((c) => c.mesh)
    const hits = this.raycaster.intersectObjects(visibleMeshes, false)
    if (!hits.length) return null

    return this.cards.find((c) => c.mesh === hits[0].object) || null
  }

  private disposeCards(): void {
    while (this.cards.length) {
      const card = this.cards.pop()!
      disposeCard(card)
    }
    this.renderedStart = -1
  }

  private disposeGroup(): void {
    this.disposeCards()
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group)
    }
    this.group = null
  }

  private animate = (): void => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastTime) / 1000)
    this.lastTime = now
    this.time += dt

    this.update(dt)

    this.animationId = requestAnimationFrame(this.animate)
  }

  private update(dt: number): void {
    if (!this.group) return

    this.centerSmooth += (this.centerTarget - this.centerSmooth) * 0.16
    if (Math.abs(this.centerSmooth - this.centerTarget) < 0.001) {
      this.centerSmooth = this.centerTarget
    }

    this.pointerParallax.x += (this.pointerTarget.x - this.pointerParallax.x) * 0.08
    this.pointerParallax.y += (this.pointerTarget.y - this.pointerParallax.y) * 0.08

    const targetVis = this.calculateTargetVisibility()
    this.shelfVisibility += (targetVis - this.shelfVisibility) * (targetVis > this.shelfVisibility ? 0.22 : 0.18)
    if (this.shelfVisibility < 0.01 && targetVis === 0) this.shelfVisibility = 0

    this.group.visible = this.mode !== 'off' && this.shelfVisibility > 0 && this.allItems.length > 0

    this.updateGroupTransform()

    for (let i = 0; i < this.cards.length; i++) {
      this.placeCard(this.cards[i])
    }
  }

  private calculateTargetVisibility(): number {
    if (this.mode === 'off') return 0
    if (this.contentOpen) return 1.0
    if (this.shelfPinnedOpen) return 1.0
    if (this.hoveredCard) return 0.95

    if (this.presence === 'auto') {
      return this.edgeHover ? 0.9 : 0
    }
    return 0.35
  }

  private updateGroupTransform(): void {
    if (!this.group) return

    const px = this.pointerParallax.x
    const py = this.pointerParallax.y

    const parallaxFactor = this.cameraMode === 'dynamic' ? 1 : 0

    if (this.mode === 'side') {
      this.group.position.set(0, 0, 0)
      this.group.rotation.y += (px * 0.018 * parallaxFactor - this.group.rotation.y) * 0.045
      this.group.rotation.x += (-py * 0.010 * parallaxFactor - this.group.rotation.x) * 0.045
      this.group.rotation.z += (0 - this.group.rotation.z) * 0.045
    } else {
      this.group.position.y = Math.sin(this.time * 0.3) * 0.04
      this.group.position.x = px * 0.10 * parallaxFactor
      this.group.rotation.y = px * 0.025 * parallaxFactor
      this.group.rotation.x = -py * 0.012 * parallaxFactor
    }
  }

  private placeCard(card: ShelfCard): void {
    const delta = card.index - this.centerSmooth
    const absD = Math.abs(delta)

    if (absD > SHELF_CONSTANTS.VISIBLE_RADIUS + 0.5) {
      card.mesh.visible = false
      return
    }
    card.mesh.visible = true

    const layout = this.getLayout()
    const sideLayer = Math.max(0, SHELF_CONSTANTS.VISIBLE_RADIUS + 1 - Math.min(absD, SHELF_CONSTANTS.VISIBLE_RADIUS + 1))
    card.mesh.renderOrder = 60 + Math.round(sideLayer * 10)

    const nextDof = Math.max(0, Math.min(1, (absD - 0.45) / 3.2))
    const nextDofBucket = Math.round(nextDof * 5)
    if (card.dofBucket !== nextDofBucket) {
      card.dofBucket = nextDofBucket
      card.dofBlur = nextDof
      card.drawKey = ''
      drawCard(card, card.item, this.settings, this.bass, this.beatPulse)
    }

    if (this.mode === 'side') {
      this.placeCardSide(card, delta, absD, layout)
    } else {
      this.placeCardStage(card, delta, absD, layout)
    }

    this.setCardCenter(card, absD < 0.5)
  }

  private placeCardSide(card: ShelfCard, delta: number, absD: number, layout: ShelfLayoutProfile): void {
    const px = this.pointerParallax.x
    const py = this.pointerParallax.y
    const parWeight = Math.max(0, 1 - absD * 0.16)
    const pulse = card.fxPulse || 0
    const parallaxFactor = this.cameraMode === 'dynamic' ? 1 : 0

    const liftTarget = card.selected && !this.contentOpen ? 1 : 0
    const liftRate = liftTarget > (card.floatMix || 0) ? 0.2 : 0.13
    card.floatMix = (card.floatMix || 0) + (liftTarget - (card.floatMix || 0)) * liftRate
    if (!liftTarget && card.floatMix < 0.004) card.floatMix = 0
    const lift = card.floatMix || 0

    const revealRaw = smoothstep(0, 0.62, Math.max(0, this.time - this.shelfOpenAnimAt - absD * 0.035))
    const entry = (1 - revealRaw) * (0.82 + absD * 0.075)

    let posX = layout.sideX + absD * layout.sideXStep - (this.contentOpen ? layout.sideDetailShift : 0) + entry * layout.sideEntryX
    let posY = (layout.sideY || 0) - delta * layout.sideYStep + (1 - revealRaw) * (delta < 0 ? -0.18 : 0.18)
    let posZ = layout.sideZ - absD * layout.sideZStep - (1 - revealRaw) * 0.2

    posX += px * 0.06 * parWeight * parallaxFactor
    posY += py * 0.046 * parWeight * parallaxFactor
    posZ += (py * 0.026 - px * 0.028) * parWeight * parallaxFactor

    if (lift > 0.001) {
      posX -= lift * (layout.portrait ? 0.065 : 0.145)
      posY += lift * (layout.portrait ? 0.075 : 0.105)
      posZ += lift * 0.22
    }

    let scale = (absD < 0.5 ? 1.12 : Math.max(0.55, 1.04 - absD * 0.14)) * (0.88 + revealRaw * 0.12) * (1 + pulse * 0.056 + lift * 0.075) * layout.sideScale

    card.mesh.position.set(posX, posY, posZ)
    card.mesh.rotation.y = layout.sideRotY + (1 - revealRaw) * 0.16 + px * 0.038 * parWeight * parallaxFactor
    card.mesh.rotation.x = -delta * layout.sideRotX - py * 0.024 * parWeight * parallaxFactor
    card.mesh.scale.setScalar(scale)

    const isForeground = card.selected || this.hoveredCard === card || this.contentOpen
    const baseRenderOrder = 60 + Math.round((SHELF_CONSTANTS.VISIBLE_RADIUS + 1 - Math.min(absD, SHELF_CONSTANTS.VISIBLE_RADIUS + 1)) * 10)
    card.mesh.renderOrder = isForeground ? baseRenderOrder + 100 : baseRenderOrder

    let opacity = absD < 0.5 ? 1.0 : Math.max(0.22, 1.0 - absD * 0.3)
    if (this.contentOpen) {
      opacity *= card.index === this.openCardIdx ? 0.16 : 0.08
      ;(card.mesh.material as THREE.MeshBasicMaterial).color.setScalar(
        card.index === this.openCardIdx ? 0.42 : 0.25
      )
    } else {
      ;(card.mesh.material as THREE.MeshBasicMaterial).color.setScalar(1)
    }

    ;(card.mesh.material as THREE.MeshBasicMaterial).opacity =
      Math.min(1, opacity * this.shelfVisibility * revealRaw + pulse * 0.1 * revealRaw) * this.settings.opacity
  }

  private placeCardStage(card: ShelfCard, delta: number, absD: number, layout: ShelfLayoutProfile): void {
    const px = this.pointerParallax.x
    const py = this.pointerParallax.y
    const parWeight = Math.max(0, 1 - absD * 0.16)
    const pulse = card.fxPulse || 0
    const parallaxFactor = this.cameraMode === 'dynamic' ? 1 : 0

    const posX = (layout.stageX || 0) + delta * layout.stageXStep + px * 0.11 * parWeight * parallaxFactor
    const posY = layout.stageY + py * 0.06 * parWeight * parallaxFactor
    const posZ =
      (absD < 0.5 ? layout.stageZ : layout.stageZ - Math.min(2.0, absD) * 0.55) +
      (py * 0.04 - px * 0.035) * parWeight * parallaxFactor

    const scale =
      (absD < 0.5 ? 1.2 : Math.max(0.45, 1.0 - absD * 0.22)) *
      (1 + pulse * 0.06) *
      layout.stageScale

    card.mesh.position.set(posX, posY, posZ)
    card.mesh.rotation.y = -delta * 0.22 + px * 0.05 * parWeight * parallaxFactor
    card.mesh.rotation.x = 0.1 - absD * 0.04 - py * 0.028 * parWeight * parallaxFactor
    card.mesh.scale.setScalar(scale)

    const isForeground = card.selected || this.hoveredCard === card || this.contentOpen
    const baseRenderOrder = 60 + Math.round((SHELF_CONSTANTS.VISIBLE_RADIUS + 1 - Math.min(absD, SHELF_CONSTANTS.VISIBLE_RADIUS + 1)) * 10)
    card.mesh.renderOrder = isForeground ? baseRenderOrder + 100 : baseRenderOrder

    let op = absD < 0.5 ? 1.0 : Math.max(0.18, 1.0 - absD * 0.32)
    if (this.contentOpen) {
      op *= card.index === this.openCardIdx ? 0.16 : 0.08
      ;(card.mesh.material as THREE.MeshBasicMaterial).color.setScalar(
        card.index === this.openCardIdx ? 0.42 : 0.25
      )
    } else {
      ;(card.mesh.material as THREE.MeshBasicMaterial).color.setScalar(1)
    }

    ;(card.mesh.material as THREE.MeshBasicMaterial).opacity =
      Math.min(1, op * this.shelfVisibility + pulse * 0.1) * this.settings.opacity
  }

  private setCardCenter(card: ShelfCard, isCenter: boolean): void {
    if (card.isCenter !== isCenter) {
      card.isCenter = isCenter
      card.drawKey = ''
      drawCard(card, card.item, this.settings, this.bass, this.beatPulse)
    } else {
      card.isCenter = isCenter
    }
  }

  private getLayout(): ShelfLayoutProfile {
    const width = this.renderer ? this.renderer.domElement.width : window.innerWidth
    const height = this.renderer ? this.renderer.domElement.height : window.innerHeight
    return getLayoutProfile(width, height, this.settings)
  }
}
