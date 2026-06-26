import * as THREE from 'three'
import type { ShelfCard, ShelfItem, ShelfSettings, CoverCacheEntry, ShelfCardAction } from './types'
import { makeRoundRect, wrapText, rgbaFromHex, readableInkForHex, SHELF_CONSTANTS } from './ShelfLayout'

const coverCache = new Map<string, CoverCacheEntry>()

export function requestCover(url: string, onLoad?: () => void): void {
  if (!url) return
  let entry = coverCache.get(url)
  if (!entry) {
    entry = { url, loaded: false, loading: false, failed: false, img: null }
    coverCache.set(url, entry)
  }
  if (entry.loaded || entry.loading || entry.failed) return
  entry.loading = true
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    if (entry) {
      entry.loaded = true
      entry.loading = false
      entry.img = img
      onLoad?.()
    }
  }
  img.onerror = () => {
    if (entry) {
      entry.failed = true
      entry.loading = false
    }
  }
  img.src = url
}

export function getCoverCache(url: string): CoverCacheEntry | undefined {
  return coverCache.get(url)
}

function cardDrawSignature(
  card: ShelfCard,
  item: ShelfItem,
  accent: string,
  bgOpacity: number,
  bass: number,
  beatPulse: number
): string {
  const rec = item.cover ? getCoverCache(item.cover) : null
  const coverState = item.cover
    ? rec && rec.loaded
      ? 'ready'
      : rec && rec.failed
      ? 'fail'
      : 'wait'
    : 'none'
  const pulseBucket = card && card.isCenter ? Math.round((bass + beatPulse * 0.85) * 6) : 0
  return [
    item.type || '',
    item.title || '',
    item.sub || '',
    item.tag || '',
    item.playlistId || '',
    item.podcastKey || '',
    item.queueIndex == null ? '' : item.queueIndex,
    item.cover || '',
    coverState,
    card && card.isCenter ? 1 : 0,
    card && card.selected ? 1 : 0,
    card && card.dofBucket == null ? -1 : card.dofBucket,
    pulseBucket,
    accent,
    bgOpacity,
  ].join('|')
}

export function drawCard(
  card: ShelfCard,
  item: ShelfItem,
  settings: ShelfSettings,
  bass: number = 0,
  beatPulse: number = 0
): void {
  const nextDrawKey = cardDrawSignature(card, item, settings.accent, settings.bgOpacity, bass, beatPulse)
  if (card.drawKey === nextDrawKey) return
  card.drawKey = nextDrawKey

  const cv = card.canvas
  const ctx = card.ctx
  const W = cv.width
  const H = cv.height
  ctx.clearRect(0, 0, W, H)

  const pad = 18
  const isNow = item.isNowPlaying || item.type === 'queue'

  makeRoundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32)
  ctx.fillStyle = `rgba(0, 0, 0, ${settings.bgOpacity.toFixed(3)})`
  ctx.fill()

  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.10)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.018)')
  ctx.fillStyle = grad
  ctx.fill()

  if (isNow) {
    ctx.strokeStyle = rgbaFromHex(settings.accent, 0.72)
    ctx.lineWidth = 1.8 + Math.sin(performance.now() / 1000 * 3) * 0.28 + bass * 1.2
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
    ctx.lineWidth = 1.1
  }
  ctx.stroke()

  if (card.selected) {
    ctx.save()
    makeRoundRect(ctx, pad + 2, pad + 2, W - pad * 2 - 4, H - pad * 2 - 4, 30)
    ctx.shadowColor = rgbaFromHex(settings.accent, 0.58)
    ctx.shadowBlur = 18
    ctx.strokeStyle = rgbaFromHex(settings.accent, 0.72)
    ctx.lineWidth = 2.2
    ctx.stroke()
    ctx.restore()
  }

  const coverSize = H - pad * 2 - 8
  const cx = pad + 6
  const cy = pad + 4
  makeRoundRect(ctx, cx, cy, coverSize, coverSize, 26)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.fill()

  if (item.cover) {
    const rec = getCoverCache(item.cover)
    if (rec && rec.loaded && rec.img) {
      ctx.save()
      makeRoundRect(ctx, cx, cy, coverSize, coverSize, 26)
      ctx.clip()
      ctx.drawImage(rec.img, cx, cy, coverSize, coverSize)
      ctx.restore()
    } else if (!rec || (!rec.loading && !rec.failed)) {
      requestCover(item.cover, () => {
        card.drawKey = ''
        drawCard(card, item, settings, bass, beatPulse)
      })
    }
  }

  const tx = pad + coverSize + 32
  ctx.font = '700 17px Inter, Arial, "Noto Sans SC", sans-serif'
  ctx.fillStyle = isNow ? rgbaFromHex(settings.accent, 0.92) : 'rgba(255, 255, 255, 0.92)'
  ctx.fillText(item.tag || '', tx, pad + 36)

  ctx.font = '700 30px Inter, Arial, "Noto Sans SC", sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
  wrapText(ctx, item.title || '', tx, pad + 78, W - tx - pad - 14, 36, 2)

  ctx.font = '400 17px Inter, Arial, "Noto Sans SC", sans-serif'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)'
  wrapText(ctx, item.sub || '', tx, pad + 156, W - tx - pad - 14, 24, 2)

  ctx.strokeStyle = isNow ? rgbaFromHex(settings.accent, 0.90) : 'rgba(255, 255, 255, 0.30)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(tx, H - pad - 22)
  ctx.lineTo(tx + Math.min(260, 80 + bass * 320), H - pad - 22)
  ctx.stroke()

  if (card.isCenter) {
    const actionY = H - pad - 78
    if (item.type === 'playlist' || item.type === 'podcastCollection') {
      makeRoundRect(ctx, tx, actionY, 138, 38, 18)
      const playGrad = ctx.createLinearGradient(tx, actionY, tx + 138, actionY + 38)
      playGrad.addColorStop(0, 'rgba(255, 255, 255, 0.88)')
      playGrad.addColorStop(0.55, rgbaFromHex(settings.accent, 0.94))
      playGrad.addColorStop(1, rgbaFromHex(settings.accent, 0.58))
      ctx.fillStyle = playGrad
      ctx.fill()
      ctx.strokeStyle = rgbaFromHex(settings.accent, 0.44)
      ctx.lineWidth = 1.1
      ctx.stroke()
      ctx.font = '800 14px Inter, "Microsoft YaHei", Arial, sans-serif'
      ctx.fillStyle = readableInkForHex(settings.accent)
      ctx.fillText('▶ 播放歌单', tx + 25, actionY + 24)

      makeRoundRect(ctx, tx + 150, actionY, 104, 38, 18)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.055)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.lineWidth = 1.1
      ctx.stroke()
      ctx.font = '700 14px Inter, "Microsoft YaHei", Arial, sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.78)'
      ctx.fillText('详情', tx + 184, actionY + 24)
    } else if (item.type === 'queue') {
      ctx.font = '600 14px Inter, "Microsoft YaHei", Arial, sans-serif'
      ctx.fillStyle = rgbaFromHex(settings.accent, 0.84)
      ctx.fillText('点击播放', tx, actionY + 25)
    }
  }

  const dof = card.dofBlur || 0
  if (dof > 0.12) {
    makeRoundRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 32)
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.28, dof * 0.18).toFixed(3)})`
    ctx.fill()
  }

  card.texture.needsUpdate = true
}

export function buildCard(
  item: ShelfItem,
  index: number,
  group: THREE.Group,
  settings: ShelfSettings
): ShelfCard {
  const cv = document.createElement('canvas')
  cv.width = SHELF_CONSTANTS.CANVAS_WIDTH
  cv.height = SHELF_CONSTANTS.CANVAS_HEIGHT
  const ctx = cv.getContext('2d')!
  const tx = new THREE.CanvasTexture(cv)
  tx.minFilter = THREE.LinearFilter
  tx.magFilter = THREE.LinearFilter
  tx.generateMipmaps = false

  const mat = new THREE.MeshBasicMaterial({
    map: tx,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  })

  const geo = new THREE.PlaneGeometry(SHELF_CONSTANTS.CARD_WIDTH, SHELF_CONSTANTS.CARD_HEIGHT, 1, 1)
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 50 + index

  const action: ShelfCardAction =
    item.type === 'playlist'
      ? { kind: 'loadPlaylist', playlistId: item.playlistId, title: item.title }
      : item.type === 'podcastCollection'
      ? { kind: 'loadPlaylist', playlistId: 'podcast:' + item.podcastKey, title: item.title }
      : item.type === 'queue'
      ? { kind: 'playQueue', index: item.queueIndex }
      : { kind: 'empty' }

  mesh.userData.action = action
  group.add(mesh)

  const card: ShelfCard = {
    canvas: cv,
    ctx,
    texture: tx,
    mesh,
    item,
    index,
    isCenter: false,
    selected: false,
    floatMix: 0,
    fxPulse: 0,
    dofBlur: 0,
    dofBucket: -1,
    drawKey: '',
  }

  drawCard(card, item, settings)
  return card
}

export function disposeCard(card: ShelfCard): void {
  if (card.mesh && card.mesh.parent) {
    card.mesh.parent.remove(card.mesh)
  }
  if (card.texture) card.texture.dispose()
  if (card.mesh && card.mesh.material) {
    if (Array.isArray(card.mesh.material)) {
      card.mesh.material.forEach((m) => m.dispose())
    } else {
      card.mesh.material.dispose()
    }
  }
  if (card.mesh && card.mesh.geometry) {
    card.mesh.geometry.dispose()
  }
}
