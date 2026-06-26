// ============================================================
//  粒子指针交互 — 鼠标移动驱动粒子旋转 / 视差 / 惯性
//   对齐原项目 particleSpin / particlePointerSpin / gestureRotation
//   / headParallax / uHandActive / uHandXY 等机制
// ============================================================

export interface ParticleInteractionUniforms {
  /** 0..1，指针移动时升高，超时后淡出 */
  uHandActive: number
  /** 指针 NDC 坐标 [-1, 1] */
  uHandXY: [number, number]
  /** 缓动后的旋转量（主轴 = 水平指针位移） */
  uGestureGrip: number
  /** 视差偏移（指针 NDC × 0.15） */
  uParallax: [number, number]
  /** 拖拽惯性速度（弧度/秒），松手后保留并衰减 */
  particleSpin: { vx: number; vy: number }
  /** 旋转累积量（弧度） */
  gestureRotation: { x: number; y: number }
}

/**
 * 粒子指针交互系统：
 *   - 指针位置驱动持续旋转目标与视差
 *   - 拖拽时叠加冲量自旋（带惯性衰减）
 *   - uHandActive 在指针静止后平滑淡出
 *
 * 默认参数取自原项目：
 *   POINTER_SPIN_X = 0.0032  POINTER_SPIN_Y = 0.0034
 *   SPIN_MAX       = 6.2     SPIN_DAMPING ≈ 0.86 (60fps)
 */
export class ParticleInteraction {
  private pointerX = 0
  private pointerY = 0

  private targetSpinX = 0
  private targetSpinY = 0
  private currentSpinX = 0
  private currentSpinY = 0

  private parallaxX = 0
  private parallaxY = 0

  private handActive = 0
  private lastMoveAt = -10

  // 拖拽自旋（带惯性）
  private particleSpinVx = 0
  private particleSpinVy = 0
  private readonly SPIN_DAMPING = 0.86
  private readonly SPIN_MAX = 6.2

  // 拖拽状态
  private dragging = false
  private lastDragX = 0
  private lastDragY = 0
  private lastDragT = 0

  // 缩放系数（与原项目一致）
  private readonly POINTER_SPIN_X = 0.0032
  private readonly POINTER_SPIN_Y = 0.0034
  private readonly PARALLAX_SCALE = 0.15
  private readonly SPIN_TARGET_SCALE = 0.3

  /** 单位均为秒；currentTime 可注入便于测试 */
  private nowSec(): number {
    return performance.now() / 1000
  }

  /**
   * 指针移动：传入像素坐标与画布宽高。
   * 内部转换为 NDC [-1,1] 并更新旋转目标 / 视差 / handActive。
   */
  onPointerMove(x: number, y: number, width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.pointerX = (x / width) * 2 - 1
    this.pointerY = -(y / height) * 2 + 1

    this.targetSpinY = this.pointerX * this.SPIN_TARGET_SCALE
    this.targetSpinX = this.pointerY * this.SPIN_TARGET_SCALE
    this.parallaxX = this.pointerX * this.PARALLAX_SCALE
    this.parallaxY = this.pointerY * this.PARALLAX_SCALE

    this.handActive = Math.min(1, this.handActive + 0.2)
    this.lastMoveAt = this.nowSec()

    if (this.dragging) {
      const now = this.nowSec()
      const dt = Math.max(1 / 120, Math.min(0.08, now - this.lastDragT || 1 / 60))
      const dx = x - this.lastDragX
      const dy = y - this.lastDragY
      this.applyDragSpin(dx, dy, dt)
      this.lastDragX = x
      this.lastDragY = y
      this.lastDragT = now
    }
  }

  /** 指针按下：开始拖拽，重置惯性 */
  onPointerDown(x: number, y: number): void {
    this.dragging = true
    this.lastDragX = x
    this.lastDragY = y
    this.lastDragT = this.nowSec()
    this.particleSpinVx = 0
    this.particleSpinVy = 0
  }

  /** 指针抬起：结束拖拽，保留惯性 */
  onPointerUp(): void {
    this.dragging = false
  }

  /** 指针离开画布：结束拖拽并衰减 handActive */
  onPointerLeave(): void {
    this.dragging = false
    this.handActive *= 0.5
  }

  private applyDragSpin(dx: number, dy: number, dt: number): void {
    const rx = dy * this.POINTER_SPIN_X
    const ry = dx * this.POINTER_SPIN_Y
    this.currentSpinX += rx
    this.currentSpinY += ry
    if (dt > 0) {
      this.particleSpinVx = this.clampSpin(rx / dt * 0.46)
      this.particleSpinVy = this.clampSpin(ry / dt * 0.46)
    }
  }

  private clampSpin(v: number): number {
    if (!isFinite(v)) return 0
    return Math.max(-this.SPIN_MAX, Math.min(this.SPIN_MAX, v))
  }

  /** 每帧调用：缓动到目标旋转、应用惯性衰减、淡出 handActive */
  update(dt: number): void {
    const ease = 0.08
    this.currentSpinX += (this.targetSpinX - this.currentSpinX) * ease
    this.currentSpinY += (this.targetSpinY - this.currentSpinY) * ease

    // 应用拖拽惯性
    if (Math.abs(this.particleSpinVx) > 0.0001 || Math.abs(this.particleSpinVy) > 0.0001) {
      this.currentSpinX += this.particleSpinVx * dt
      this.currentSpinY += this.particleSpinVy * dt
    }
    this.particleSpinVx *= Math.pow(this.SPIN_DAMPING, dt * 60)
    this.particleSpinVy *= Math.pow(this.SPIN_DAMPING, dt * 60)
    if (Math.abs(this.particleSpinVx) < 0.01) this.particleSpinVx = 0
    if (Math.abs(this.particleSpinVy) < 0.01) this.particleSpinVy = 0

    // 指针超时淡出
    const now = this.nowSec()
    if (!this.dragging && now - this.lastMoveAt > 0.5) {
      this.handActive *= Math.pow(0.5, dt * 4)
      if (this.handActive < 0.02) this.handActive = 0
    }
  }

  getUniforms(): ParticleInteractionUniforms {
    return {
      uHandActive: this.handActive,
      uHandXY: [this.pointerX, this.pointerY],
      uGestureGrip: this.currentSpinY,
      uParallax: [this.parallaxX, this.parallaxY],
      particleSpin: { vx: this.particleSpinVx, vy: this.particleSpinVy },
      gestureRotation: { x: this.currentSpinX, y: this.currentSpinY },
    }
  }

  /** 当前指针 NDC */
  getPointer(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY }
  }

  /** 当前视差偏移 */
  getParallax(): { x: number; y: number } {
    return { x: this.parallaxX, y: this.parallaxY }
  }

  /** handActive 强度 0..1 */
  getHandActive(): number {
    return this.handActive
  }

  /** 是否正在拖拽 */
  isDragging(): boolean {
    return this.dragging
  }

  reset(): void {
    this.pointerX = 0
    this.pointerY = 0
    this.targetSpinX = 0
    this.targetSpinY = 0
    this.currentSpinX = 0
    this.currentSpinY = 0
    this.parallaxX = 0
    this.parallaxY = 0
    this.handActive = 0
    this.particleSpinVx = 0
    this.particleSpinVy = 0
    this.dragging = false
    this.lastMoveAt = -10
  }
}
