// ============================================================
//  封面 + 边缘 + 启发式深度 CPU 管线
//   对齐原项目 index.html:9426-9539 buildEdgeAndDepth
//   生成 256×256 RGBA 纹理: R=depth G=edge B=fg-mask A=lum
//   FNV-1a 哈希缓存键，LRU 上限 18 条
// ============================================================

export interface CoverDepthResult {
  /** 256×256 RGBA ImageData：R=depth G=edge B=fg-mask A=lum */
  imageData: ImageData
  /** FNV-1a 缓存键 */
  cacheId: string
  /** 是否命中缓存 */
  fromCache: boolean
}

interface CoverDepthCacheEntry {
  imageData: ImageData
  at: number
}

/**
 * 封面深度 CPU 管线：
 *   1. 将源图像绘制到 256×256 canvas
 *   2. 计算亮度 (Rec.601)
 *   3. 两次 box blur（半径 4）作为深度基底并降噪
 *   4. Sobel 边缘检测（在模糊图上）
 *   5. 启发式深度 = 亮度*0.45 + 中心偏置*0.55
 *   6. 前景 mask = 深度*0.6 + 边缘*0.5
 *   7. 输出 RGBA：R=depth G=edge B=fg-mask A=lum
 *
 * 缓存：FNV-1a 哈希源 URL/dataURL 作为键，LRU 上限 18 条。
 */
export class CoverDepth {
  private cache = new Map<string, CoverDepthCacheEntry>()
  private cacheKeys: string[] = []
  private readonly CACHE_MAX = 18
  private readonly SIZE = 256

  /**
   * 计算源图像的 256×256 深度/边缘/前景/亮度 RGBA 数据。
   * 同步执行（256×256 工作量很小），返回 Promise 便于未来异步化。
   */
  async buildEdgeAndDepth(
    src: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ): Promise<ImageData> {
    const W = this.SIZE
    const H = this.SIZE
    const N = W * H

    const normalized = document.createElement('canvas')
    normalized.width = W
    normalized.height = H
    const sctx = normalized.getContext('2d')
    if (!sctx) throw new Error('CoverDepth: 2d context unavailable')
    sctx.drawImage(src as CanvasImageSource, 0, 0, W, H)
    const srcData = sctx.getImageData(0, 0, W, H).data

    const lum = new Float32Array(N)
    const blur = new Float32Array(N)
    const tmp = new Float32Array(N)

    // 1) 亮度 (Rec.601)
    for (let i = 0; i < N; i++) {
      const di = i * 4
      lum[i] = (srcData[di] * 0.299 + srcData[di + 1] * 0.587 + srcData[di + 2] * 0.114) / 255
    }

    // 2) 两次 box blur（水平 + 垂直，半径 4）
    this.blurH(lum, tmp, W, H, 4)
    this.blurV(tmp, blur, W, H, 4)

    // 3) Sobel 边缘（在 blur 上做，减少噪声）
    const edge = new Float32Array(N)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x
        const gx =
          -blur[(y - 1) * W + (x - 1)] -
          2 * blur[y * W + (x - 1)] -
          blur[(y + 1) * W + (x - 1)] +
          blur[(y - 1) * W + (x + 1)] +
          2 * blur[y * W + (x + 1)] +
          blur[(y + 1) * W + (x + 1)]
        const gy =
          -blur[(y - 1) * W + (x - 1)] -
          2 * blur[(y - 1) * W + x] -
          blur[(y - 1) * W + (x + 1)] +
          blur[(y + 1) * W + (x - 1)] +
          2 * blur[(y + 1) * W + x] +
          blur[(y + 1) * W + (x + 1)]
        edge[i] = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) * 1.4)
      }
    }

    // 4) 启发式深度：亮度 + 中心 mask + 边缘累积
    const depth = new Float32Array(N)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const cx = (x / (W - 1) - 0.5) * 2.0
        const cy = (y / (H - 1) - 0.5) * 2.0
        const rr = Math.sqrt(cx * cx + cy * cy)
        const centerBias = 1.0 - Math.min(1, rr * 0.75)
        const bright = blur[i]
        depth[i] = Math.min(1.0, bright * 0.45 + centerBias * 0.55)
      }
    }

    // 5) 前景 mask：中心 + 高对比区
    const fg = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      fg[i] = Math.min(1.0, depth[i] * 0.6 + edge[i] * 0.5)
    }

    // 6) 输出 256×256 RGBA：R=depth G=edge B=fg A=lum
    const imgOut = new ImageData(W, H)
    const out = imgOut.data
    for (let i = 0; i < N; i++) {
      const di = i * 4
      out[di] = Math.round(depth[i] * 255)
      out[di + 1] = Math.round(edge[i] * 255)
      out[di + 2] = Math.round(fg[i] * 255)
      out[di + 3] = Math.round(lum[i] * 255)
    }
    return imgOut
  }

  private blurH(s: Float32Array, d: Float32Array, W: number, H: number, r: number): void {
    const win = 2 * r + 1
    for (let y = 0; y < H; y++) {
      let sum = 0
      for (let x = -r; x <= r; x++) sum += s[y * W + Math.max(0, Math.min(W - 1, x))]
      for (let x = 0; x < W; x++) {
        d[y * W + x] = sum / win
        const xR = Math.min(W - 1, x + r + 1)
        const xL = Math.max(0, x - r)
        sum += s[y * W + xR] - s[y * W + xL]
      }
    }
  }

  private blurV(s: Float32Array, d: Float32Array, W: number, H: number, r: number): void {
    const win = 2 * r + 1
    for (let x = 0; x < W; x++) {
      let sum = 0
      for (let y = -r; y <= r; y++) sum += s[Math.max(0, Math.min(H - 1, y)) * W + x]
      for (let y = 0; y < H; y++) {
        d[y * W + x] = sum / win
        const yD = Math.min(H - 1, y + r + 1)
        const yU = Math.max(0, y - r)
        sum += s[yD * W + x] - s[yU * W + x]
      }
    }
  }

  /**
   * FNV-1a 哈希生成缓存键。
   * 与原项目 coverDepthCacheId 等价：
   *   h = 2166136261 (0x811c9dc5)
   *   h ^= charCode; h += (h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)
   *   返回 length + ':' + (h>>>0).toString(36)
   */
  makeCacheId(src: string): string {
    const str = String(src || '')
    if (!str) return ''
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0
    }
    return str.length + ':' + h.toString(36)
  }

  /**
   * 按源（URL/dataURL）构建或读取缓存。
   * @param src 源标识（用于缓存键）
   * @param img 已加载的图像元素
   */
  async buildForSource(
    src: string,
    img: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ): Promise<CoverDepthResult> {
    const id = this.makeCacheId(src)
    if (id) {
      const cached = this.cache.get(id)
      if (cached) {
        cached.at = Date.now()
        const idx = this.cacheKeys.indexOf(id)
        if (idx >= 0) this.cacheKeys.splice(idx, 1)
        this.cacheKeys.push(id)
        return { imageData: cached.imageData, cacheId: id, fromCache: true }
      }
    }
    const imageData = await this.buildEdgeAndDepth(img)
    if (id) this.putCache(id, imageData)
    return { imageData, cacheId: id, fromCache: false }
  }

  private putCache(id: string, imageData: ImageData): void {
    const idx = this.cacheKeys.indexOf(id)
    if (idx >= 0) this.cacheKeys.splice(idx, 1)
    this.cacheKeys.push(id)
    this.cache.set(id, { imageData, at: Date.now() })
    while (this.cacheKeys.length > this.CACHE_MAX) {
      const drop = this.cacheKeys.shift()
      if (drop) this.cache.delete(drop)
    }
  }

  /** 当前缓存条目数 */
  getCacheSize(): number {
    return this.cache.size
  }

  /** 清空缓存 */
  clearCache(): void {
    this.cache.clear()
    this.cacheKeys = []
  }

  /** 缓存中是否包含指定源 */
  has(src: string): boolean {
    const id = this.makeCacheId(src)
    return !!id && this.cache.has(id)
  }
}
