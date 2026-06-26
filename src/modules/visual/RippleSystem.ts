// ============================================================
//  涟漪触发系统 — 3×3 九宫格 + bass 上升沿
//   对齐原项目 index.html:9360-9420 updateRipples
//   涟漪在着色器中驱动 uScatter/uBurstAmt 等动态量
// ============================================================

export interface Ripple {
  /** 涟漪中心 X（视觉平面坐标，非 NDC） */
  x: number
  /** 涟漪中心 Y（视觉平面坐标，非 NDC） */
  y: number
  /** 年龄（秒），<=0 表示未激活 */
  age: number
  /** 强度，<=0.005 视为死亡 */
  str: number
}

export interface RippleUniforms {
  /** RGBA 编码的涟漪数据，长度 = MAX_RIPPLES * 4，每条 = [x, y, age, str] */
  data: Float32Array
  /** 当前活跃涟漪数量 */
  count: number
  /** 涟漪驱动的散射量（缓动），典型 0..0.4 */
  uScatter: number
  /** 涟漪驱动的爆发量（每次触发跳升、指数衰减） */
  uBurstAmt: number
}

/**
 * 涟漪系统：检测 bass 上升沿，在 3×3 九宫格内随机若干区域
 * 触发涟漪，维护一个固定大小的涟漪池（环形复用）。
 *
 * 默认参数与原项目一致：
 *   MAX_RIPPLES    = 12   涟漪池大小
 *   BASS_THRESHOLD = 0.30 bass 触发阈值
 *   COOLDOWN       = 0.32 触发冷却（秒）
 *   LIFETIME       = 2.0  单条涟漪寿命（秒）
 */
export class RippleSystem {
  private readonly MAX_RIPPLES: number
  private readonly BASS_THRESHOLD: number
  private readonly COOLDOWN: number
  private readonly LIFETIME: number
  private readonly REGIONS: Array<{ x: number; y: number }>

  private ripples: Ripple[]
  private rippleIdx = 0
  private lastBassRising = false
  private lastRippleAt = -10

  private data: Float32Array
  private scatter = 0
  private burstAmt = 0
  private activeCount = 0

  constructor(opts: {
    maxRipples?: number
    bassThreshold?: number
    cooldown?: number
    lifetime?: number
    /** 视觉平面尺寸，原项目 PLANE_SIZE 默认 8 */
    planeSize?: number
  } = {}) {
    this.MAX_RIPPLES = Math.max(1, opts.maxRipples ?? 12)
    this.BASS_THRESHOLD = opts.bassThreshold ?? 0.30
    this.COOLDOWN = opts.cooldown ?? 0.32
    this.LIFETIME = opts.lifetime ?? 2.0

    const planeSize = opts.planeSize ?? 8
    this.REGIONS = []
    for (let ry = 0; ry < 3; ry++) {
      for (let rx = 0; rx < 3; rx++) {
        this.REGIONS.push({
          x: (rx / 2 - 0.5) * planeSize * 0.72,
          y: (ry / 2 - 0.5) * planeSize * 0.72,
        })
      }
    }

    this.ripples = []
    for (let i = 0; i < this.MAX_RIPPLES; i++) {
      this.ripples.push({ x: 0, y: 0, age: -10, str: 0 })
    }
    this.data = new Float32Array(this.MAX_RIPPLES * 4)
  }

  /**
   * 每帧调用：检测 bass 上升沿并触发涟漪，更新涟漪年龄与 uniform 数据。
   *
   * @param bass 当前 bass 强度（0..1）
   * @param currentTime 当前播放时间（秒），用于冷却判断
   * @param dt 帧间隔（秒）
   */
  update(bass: number, currentTime: number, dt: number): void {
    // bass 上升沿检测：当前高于阈值、上一帧未处于"上升区"
    const isBassHit = bass > this.BASS_THRESHOLD && !this.lastBassRising
    this.lastBassRising = bass > this.BASS_THRESHOLD * 0.75

    if (isBassHit && currentTime - this.lastRippleAt > this.COOLDOWN) {
      this.lastRippleAt = currentTime
      // 每次触发 2~3 条涟漪
      const count = 2 + (Math.random() < 0.5 ? 0 : 1)
      const used: boolean[] = new Array(this.REGIONS.length).fill(false)
      for (let k = 0; k < count; k++) {
        let idx = 0
        let tries = 0
        do {
          idx = Math.floor(Math.random() * this.REGIONS.length)
          tries++
        } while (used[idx] && tries < 12)
        used[idx] = true
        const reg = this.REGIONS[idx]
        const jx = reg.x + (Math.random() - 0.5) * 0.7
        const jy = reg.y + (Math.random() - 0.5) * 0.7
        const str = 0.65 + bass * 1.4 + Math.random() * 0.25
        this.triggerRipple(jx, jy, str)
      }
      // 每次触发跳升 burstAmt
      this.burstAmt = Math.min(1, this.burstAmt + 0.5 + bass * 0.4)
    }

    // 更新涟漪年龄并打包 data
    let active = 0
    for (let i = 0; i < this.MAX_RIPPLES; i++) {
      const r = this.ripples[i]
      if (r.str > 0.005) {
        r.age += dt
        if (r.age > this.LIFETIME) {
          r.str = 0
          r.age = -10
        } else {
          active++
        }
      }
      const off = i * 4
      this.data[off] = r.x
      this.data[off + 1] = r.y
      this.data[off + 2] = r.age
      this.data[off + 3] = r.str
    }
    this.activeCount = active

    // 涟漪活跃度驱动 uScatter（缓动）和 uBurstAmt（指数衰减）
    const energy = active / this.MAX_RIPPLES
    this.scatter += (energy * 0.4 - this.scatter) * 0.1
    this.burstAmt *= Math.pow(0.05, Math.max(0.001, dt))
    if (this.burstAmt < 0.001) this.burstAmt = 0
  }

  private triggerRipple(x: number, y: number, strength: number): void {
    const r = this.ripples[this.rippleIdx]
    r.x = x
    r.y = y
    r.age = 0
    r.str = strength
    this.rippleIdx = (this.rippleIdx + 1) % this.MAX_RIPPLES
  }

  /** 返回涟漪相关的 uniform 值，用于驱动着色器 */
  getUniforms(): RippleUniforms {
    return {
      data: this.data,
      count: this.activeCount,
      uScatter: this.scatter,
      uBurstAmt: this.burstAmt,
    }
  }

  /** 当前活跃涟漪数量 */
  getActiveCount(): number {
    return this.activeCount
  }

  /** 涟漪数据数组（只读视图） */
  getData(): Float32Array {
    return this.data
  }

  reset(): void {
    for (const r of this.ripples) {
      r.x = 0
      r.y = 0
      r.age = -10
      r.str = 0
    }
    this.rippleIdx = 0
    this.lastBassRising = false
    this.lastRippleAt = -10
    this.scatter = 0
    this.burstAmt = 0
    this.activeCount = 0
    this.data.fill(0)
  }
}
