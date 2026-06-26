import * as THREE from 'three'
import type { OrbitState, FreeCameraState, BeatCameraState, CinemaDynamics } from './types'
import type { CinemaMode } from '@/types'

const BASE_FOV = 45
const FREE_CAMERA_STORE_KEY = 'mineradio-free-camera-v1'
const FREE_CAMERA_STORE_KEY_LEGACY = 'mineradio_free_camera_state'

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function easeOutCubic01(t: number): number {
  t = clamp01(t)
  return 1 - Math.pow(1 - t, 3)
}

function shortestAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export class CameraSystem {
  camera: THREE.PerspectiveCamera
  orbit: OrbitState
  freeCamera: FreeCameraState
  beatCam: BeatCameraState
  cinemaDynamics: CinemaDynamics

  private domElement: HTMLElement
  private isPointerLocked = false
  private freeCameraDragging = false
  private freeCameraLastMouse = { x: 0, y: 0 }
  private freeCameraResetTween: {
    start: number
    duration: number
    from: {
      position: THREE.Vector3
      yaw: number
      pitch: number
      roll: number
      fov: number
    }
    to: {
      position: THREE.Vector3
      yaw: number
      pitch: number
      roll: number
      fov: number
    }
  } | null = null

  private freeCameraDeferredSaveTimer: number | null = null
  private camPunch = 0
  private cinemaT = 0

  private freeCameraMove = new THREE.Vector3()
  private freeCameraTargetVel = new THREE.Vector3()
  private freeCameraShakeDir = new THREE.Vector3()
  private freeCameraEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  private freeCameraResetMat = new THREE.Matrix4()
  private freeCameraResetQuat = new THREE.Quaternion()
  private freeCameraUp = new THREE.Vector3(0, 1, 0)
  private zeroVec = new THREE.Vector3(0, 0, 0)

  private cinemaMode: CinemaMode = 'cinema'
  private breathingPhase = 0
  private cinemaShakeX = 0
  private cinemaShakeY = 0
  private cinemaShakeZ = 0

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera
    this.domElement = domElement

    this.orbit = {
      userTheta: 0.0,
      userPhi: 0.08,
      userRadius: 6.6,
      cineTheta: 0.0,
      cinePhi: 0.0,
      cineRadius: 0.0,
      theta: 0.0,
      phi: 0.08,
      radius: 6.6,
      minPhi: -Math.PI * 0.45,
      maxPhi: Math.PI * 0.45,
      minRadius: 2.4,
      maxRadius: 14.0,
      baselineTheta: 0.0,
      baselinePhi: 0.08,
      baselineRadius: 6.6,
      rotating: false,
      last: { x: 0, y: 0 },
      recentering: false,
      centerLocked: false,
      lookAt: new THREE.Vector3(0, 0, 0),
      beatGlow: 0,
    }

    this.freeCamera = this.readFreeCameraState()

    this.beatCam = {
      punch: 0,
      thetaKick: 0,
      phiKick: 0,
      radiusKick: 0,
      rollKick: 0,
      events: [],
      nextIdx: 0,
      lastTriggerAt: -10,
      lastRealtimeAt: -10,
      prevAudioTime: -1,
      attack: 0.024,
      hold: 0.032,
      release: 0.180,
      lookahead: 0.06,
      minInterval: 0.180,
      realtimeMinInterval: 0.220,
      realtimeMergeWindow: 0.120,
      stats: {
        map: 0,
        live: 0,
        merged: 0,
        liveBlocked: 0,
      },
    }

    this.cinemaDynamics = {
      avg: 0,
      lowAvg: 0,
      peak: 0.30,
      scale: 0.82,
    }

    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    const el = this.domElement

    el.addEventListener('mousedown', this.onMouseDown.bind(this))
    window.addEventListener('mousemove', this.onMouseMove.bind(this))
    window.addEventListener('mouseup', this.onMouseUp.bind(this))
    el.addEventListener('wheel', this.onWheel.bind(this), { passive: false })
    el.addEventListener('dblclick', this.onDoubleClick.bind(this))
    el.addEventListener('contextmenu', this.onContextMenu.bind(this))

    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this))
    window.addEventListener('keydown', this.onKeyDown.bind(this))
    window.addEventListener('keyup', this.onKeyUp.bind(this))
  }

  private onContextMenu(e: MouseEvent): void {
    if (this.freeCamera.active) {
      e.preventDefault()
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.freeCamera.active) {
      if (e.button === 2) {
        this.freeCameraDragging = true
        this.freeCameraLastMouse.x = e.clientX
        this.freeCameraLastMouse.y = e.clientY
        e.preventDefault()
      }
      return
    }
    if (e.button !== 0) return
    this.orbit.rotating = true
    this.orbit.last.x = e.clientX
    this.orbit.last.y = e.clientY
    this.orbit.recentering = false
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.freeCamera.active) {
      if (this.isPointerLocked) {
        const sensitivity = 0.002
        this.freeCamera.yaw -= e.movementX * sensitivity
        this.freeCamera.pitch -= e.movementY * sensitivity
        this.freeCamera.pitch = clampRange(this.freeCamera.pitch, -Math.PI * 0.49, Math.PI * 0.49)
        this.scheduleFreeCameraStateSave(720)
        return
      }
      if (this.freeCameraDragging) {
        const sensitivity = 0.003
        const dx = e.clientX - this.freeCameraLastMouse.x
        const dy = e.clientY - this.freeCameraLastMouse.y
        this.freeCameraLastMouse.x = e.clientX
        this.freeCameraLastMouse.y = e.clientY
        this.freeCamera.yaw -= dx * sensitivity
        this.freeCamera.pitch -= dy * sensitivity
        this.freeCamera.pitch = clampRange(this.freeCamera.pitch, -Math.PI * 0.49, Math.PI * 0.49)
        this.scheduleFreeCameraStateSave(720)
        return
      }
    }

    if (!this.orbit.rotating) return
    const dx = e.clientX - this.orbit.last.x
    const dy = e.clientY - this.orbit.last.y
    this.orbit.last.x = e.clientX
    this.orbit.last.y = e.clientY

    this.orbit.userTheta -= dx * 0.005
    this.orbit.userPhi += dy * 0.005
    this.orbit.userPhi = clampRange(this.orbit.userPhi, this.orbit.minPhi, this.orbit.maxPhi)
  }

  private onMouseUp(e: MouseEvent): void {
    if (this.freeCamera.active && e.button === 2) {
      this.freeCameraDragging = false
      return
    }
    this.orbit.rotating = false
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault()
    if (this.freeCamera.active) {
      const speed = e.deltaY > 0 ? -0.3 : 0.3
      this.freeCamera.fov = clampRange(this.freeCamera.fov + speed, 26, 72)
      this.scheduleFreeCameraStateSave(720)
      return
    }
    const delta = e.deltaY * 0.003
    this.orbit.userRadius += delta * this.orbit.userRadius * 0.3
    this.orbit.userRadius = clampRange(this.orbit.userRadius, this.orbit.minRadius, this.orbit.maxRadius)
  }

  private onDoubleClick(): void {
    this.recenterCamera()
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.freeCamera.active) return
    this.freeCamera.keys[e.code] = true

    if (e.code === 'Space') {
      e.preventDefault()
      this.resetFreeCameraToDefault()
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!this.freeCamera.active) return
    this.freeCamera.keys[e.code] = false
  }

  private onPointerLockChange(): void {
    this.isPointerLocked = document.pointerLockElement === this.domElement
  }

  recenterCamera(): void {
    this.orbit.recentering = true
  }

  toggleFreeCamera(): void {
    if (this.freeCamera.active) {
      this.freeCamera.active = false
      this.freeCamera.locked = true
      this.freeCamera.keys = {}
      this.freeCameraDragging = false
      if (this.freeCamera.velocity) this.freeCamera.velocity.set(0, 0, 0)
      try { if (document.pointerLockElement === this.domElement) document.exitPointerLock() } catch (e) { /* ignore */ }
      this.saveFreeCameraState()
      return
    }

    this.captureFreeCameraFromCurrent()
    this.freeCamera.active = true
    this.freeCamera.locked = true
    this.freeCameraResetTween = null
    this.freeCamera.keys = {}
    this.freeCameraDragging = false
    if (!this.freeCamera.velocity) this.freeCamera.velocity = new THREE.Vector3()

    this.saveFreeCameraState()
  }

  isFreeCameraActive(): boolean {
    return this.freeCamera.active
  }

  private captureFreeCameraFromCurrent(): void {
    this.camera.updateMatrixWorld(true)
    this.freeCamera.position.copy(this.camera.position)
    this.freeCameraEuler.setFromQuaternion(this.camera.quaternion, 'YXZ')
    this.freeCamera.pitch = this.freeCameraEuler.x
    this.freeCamera.yaw = this.freeCameraEuler.y
    this.freeCamera.roll = this.freeCameraEuler.z
    this.freeCamera.fov = clampRange(this.camera.fov || BASE_FOV, 26, 72)
  }

  private resetFreeCameraToDefault(): void {
    if (this.freeCameraDeferredSaveTimer) {
      clearTimeout(this.freeCameraDeferredSaveTimer)
      this.freeCameraDeferredSaveTimer = null
    }

    const fromPos = this.freeCamera.position ? this.freeCamera.position.clone() : new THREE.Vector3(0, 0, 6.6)
    const resetPose = this.getDefaultFreeCameraResetPose()

    this.freeCameraResetTween = {
      start: performance.now(),
      duration: 620,
      from: {
        position: fromPos,
        yaw: Number(this.freeCamera.yaw) || 0,
        pitch: Number(this.freeCamera.pitch) || 0,
        roll: Number(this.freeCamera.roll) || 0,
        fov: Number(this.freeCamera.fov) || BASE_FOV,
      },
      to: {
        position: resetPose.position,
        yaw: resetPose.yaw,
        pitch: resetPose.pitch,
        roll: resetPose.roll,
        fov: resetPose.fov,
      },
    }

    this.freeCamera.active = false
    this.freeCamera.locked = true
    this.freeCamera.keys = {}
    if (this.freeCamera.velocity) this.freeCamera.velocity.set(0, 0, 0)
    try { if (document.pointerLockElement === this.domElement) document.exitPointerLock() } catch (e) { /* ignore */ }
  }

  private getDefaultFreeCameraResetPose(): {
    position: THREE.Vector3
    yaw: number
    pitch: number
    roll: number
    fov: number
  } {
    return {
      position: new THREE.Vector3(0, 0, 6.6),
      yaw: 0,
      pitch: 0,
      roll: 0,
      fov: BASE_FOV,
    }
  }

  private readFreeCameraState(): FreeCameraState {
    const state: FreeCameraState = {
      active: false,
      locked: false,
      position: new THREE.Vector3(0, 0, 6.6),
      yaw: 0,
      pitch: 0,
      roll: 0,
      fov: BASE_FOV,
      velocity: new THREE.Vector3(),
      keys: {},
    }

    try {
      let rawStr = localStorage.getItem(FREE_CAMERA_STORE_KEY)
      if (!rawStr) {
        rawStr = localStorage.getItem(FREE_CAMERA_STORE_KEY_LEGACY)
        if (rawStr) {
          // 迁移旧数据到新键名
          localStorage.setItem(FREE_CAMERA_STORE_KEY, rawStr)
          try {
            localStorage.removeItem(FREE_CAMERA_STORE_KEY_LEGACY)
          } catch (_) {}
        }
      }
      const raw = JSON.parse(rawStr || '{}') || {}
      if (raw.position) {
        state.position.set(
          clampRange(Number(raw.position.x) || 0, -80, 80),
          clampRange(Number(raw.position.y) || 0, -80, 80),
          clampRange(Number(raw.position.z) || 6.6, -80, 80),
        )
      }
      state.yaw = clampRange(Number(raw.yaw) || 0, -Math.PI * 8, Math.PI * 8)
      state.pitch = clampRange(Number(raw.pitch) || 0, -Math.PI * 0.49, Math.PI * 0.49)
      state.roll = clampRange(Number(raw.roll) || 0, -Math.PI, Math.PI)
      state.fov = clampRange(Number(raw.fov) || BASE_FOV, 26, 72)
      state.locked = !!(raw.locked || raw.active)
      state.active = false
    } catch (e) { /* ignore */ }

    return state
  }

  private saveFreeCameraState(): void {
    try {
      localStorage.setItem(FREE_CAMERA_STORE_KEY, JSON.stringify({
        locked: !!this.freeCamera.locked,
        active: !!this.freeCamera.active,
        position: { x: this.freeCamera.position.x, y: this.freeCamera.position.y, z: this.freeCamera.position.z },
        yaw: this.freeCamera.yaw,
        pitch: this.freeCamera.pitch,
        roll: this.freeCamera.roll,
        fov: this.freeCamera.fov,
      }))
    } catch (e) { /* ignore */ }
  }

  private scheduleFreeCameraStateSave(delay: number): void {
    if (this.freeCameraDeferredSaveTimer) return
    this.freeCameraDeferredSaveTimer = window.setTimeout(() => {
      this.freeCameraDeferredSaveTimer = 0
      this.saveFreeCameraState()
    }, delay || 720)
  }

  setCinemaMode(mode: CinemaMode): void {
    this.cinemaMode = mode
  }

  updateCinemaDynamics(rawEnergy: number, rawLow: number, cinemaIntensity: number): void {
    const e = clamp01(rawEnergy || 0)
    const l = clamp01(rawLow || 0)
    const composite = clamp01(e * 0.62 + l * 0.38)

    this.cinemaDynamics.avg += (composite - this.cinemaDynamics.avg) * (composite > this.cinemaDynamics.avg ? 0.010 : 0.004)
    this.cinemaDynamics.lowAvg += (l - this.cinemaDynamics.lowAvg) * (l > this.cinemaDynamics.lowAvg ? 0.012 : 0.005)
    this.cinemaDynamics.peak = Math.max(0.30, this.cinemaDynamics.peak * 0.9988, composite)

    const floor = Math.max(0.10, this.cinemaDynamics.avg * 0.82)
    const span = Math.max(0.18, this.cinemaDynamics.peak - floor)
    const lift = clamp01((composite - floor) / span)
    const liftSmooth = lift * lift * (3 - 2 * lift)

    const target = 0.42 + liftSmooth * 0.56 + clamp01((l - this.cinemaDynamics.lowAvg) / 0.36) * 0.12
    const scaledTarget = clampRange(target * cinemaIntensity, 0.18, 1.08)

    this.cinemaDynamics.scale += (scaledTarget - this.cinemaDynamics.scale) * (scaledTarget > this.cinemaDynamics.scale ? 0.045 : 0.022)

    if (this.cinemaMode === 'dynamic' && composite > 0.3) {
      const shakeAmount = composite * cinemaIntensity * 0.02
      this.cinemaShakeX += (Math.random() - 0.5) * shakeAmount
      this.cinemaShakeY += (Math.random() - 0.5) * shakeAmount
      this.cinemaShakeZ += (Math.random() - 0.5) * shakeAmount * 0.5
    }
  }

  update(dt: number, isPlaying: boolean, cinemaIntensity: number): void {
    this.cinemaT += dt

    this.updateFreeCamera(dt)
    this.updateOrbit(dt, cinemaIntensity)

    if (this.applyFreeCameraToCamera(cinemaIntensity)) {
      return
    }

    this.applyOrbitCamera(isPlaying, cinemaIntensity)
  }

  private updateOrbit(dt: number, cinemaIntensity: number): void {
    const t = this.cinemaT
    const dynScale = this.cinemaDynamics.scale
    const mode = this.cinemaMode

    this.breathingPhase += dt * 0.5

    let thetaScale = 0
    let phiScale = 0
    let radiusScale = 0

    switch (mode) {
      case 'static':
        thetaScale = 0
        phiScale = 0
        radiusScale = 0
        break
      case 'breathing':
        radiusScale = Math.sin(this.breathingPhase) * 0.05 * cinemaIntensity
        thetaScale = Math.sin(this.breathingPhase * 0.7) * 0.02 * cinemaIntensity
        phiScale = Math.sin(this.breathingPhase * 1.3) * 0.01 * cinemaIntensity
        break
      case 'cinema':
        thetaScale = Math.sin(t * 0.12) * 0.08 * dynScale
        phiScale = Math.sin(t * 0.18 + 0.5) * 0.04 * dynScale
        radiusScale = Math.sin(t * 0.22 + 1.2) * 0.15 * dynScale
        break
      case 'dynamic':
        thetaScale = Math.sin(t * 0.18) * 0.12 * dynScale
        phiScale = Math.sin(t * 0.25 + 0.5) * 0.08 * dynScale
        radiusScale = Math.sin(t * 0.3 + 1.2) * 0.25 * dynScale
        break
    }

    this.orbit.cineTheta = thetaScale
    this.orbit.cinePhi = phiScale
    this.orbit.cineRadius = radiusScale

    if (this.orbit.recentering) {
      const ease = 0.04
      this.orbit.userTheta += (this.orbit.baselineTheta - this.orbit.userTheta) * ease
      this.orbit.userPhi += (this.orbit.baselinePhi - this.orbit.userPhi) * ease
      this.orbit.userRadius += (this.orbit.baselineRadius - this.orbit.userRadius) * ease

      if (
        Math.abs(this.orbit.userTheta - this.orbit.baselineTheta) < 0.001 &&
        Math.abs(this.orbit.userPhi - this.orbit.baselinePhi) < 0.001 &&
        Math.abs(this.orbit.userRadius - this.orbit.baselineRadius) < 0.001
      ) {
        this.orbit.recentering = false
      }
    }

    this.orbit.theta = this.orbit.userTheta + this.orbit.cineTheta + this.beatCam.thetaKick + this.cinemaShakeX
    this.orbit.phi = this.orbit.userPhi + this.orbit.cinePhi + this.beatCam.phiKick + this.cinemaShakeY
    this.orbit.radius = this.orbit.userRadius + this.orbit.cineRadius + this.beatCam.radiusKick + this.cinemaShakeZ

    this.beatCam.punch *= Math.pow(0.08, dt)
    this.beatCam.thetaKick *= Math.pow(0.05, dt)
    this.beatCam.phiKick *= Math.pow(0.05, dt)
    this.beatCam.radiusKick *= Math.pow(0.05, dt)
    this.beatCam.rollKick *= Math.pow(0.05, dt)

    this.cinemaShakeX *= Math.pow(0.01, dt)
    this.cinemaShakeY *= Math.pow(0.01, dt)
    this.cinemaShakeZ *= Math.pow(0.01, dt)
  }

  private applyOrbitCamera(isPlaying: boolean, cinemaIntensity: number): void {
    const { theta, phi, radius, lookAt } = this.orbit

    const x = lookAt.x + radius * Math.cos(phi) * Math.sin(theta)
    const y = lookAt.y + radius * Math.sin(phi)
    const z = lookAt.z + radius * Math.cos(phi) * Math.cos(theta)

    this.camera.position.set(x, y, z)
    this.camera.lookAt(lookAt)

    const cameraPunch = Math.max(this.camPunch * 0.55, this.beatCam.punch * 0.54) * cinemaIntensity
    const targetFov = BASE_FOV - cameraPunch * 1.75
    this.camera.fov += (targetFov - this.camera.fov) * (targetFov < this.camera.fov ? 0.24 : 0.12)
    this.camera.updateProjectionMatrix()

    this.camPunch *= 0.86
  }

  private updateFreeCamera(dt: number): void {
    if (this.freeCameraResetTween) {
      const tw = this.freeCameraResetTween
      const t = easeOutCubic01((performance.now() - tw.start) / Math.max(1, tw.duration || 620))

      this.freeCamera.position.copy(tw.from.position).lerp(tw.to.position, t)
      this.freeCamera.yaw = tw.from.yaw + shortestAngleDelta(tw.from.yaw, tw.to.yaw) * t
      this.freeCamera.pitch = tw.from.pitch + (tw.to.pitch - tw.from.pitch) * t
      this.freeCamera.roll = tw.from.roll + shortestAngleDelta(tw.from.roll, tw.to.roll) * t
      this.freeCamera.fov = tw.from.fov + (tw.to.fov - tw.from.fov) * t

      if (t >= 0.999) {
        this.freeCamera.position.copy(tw.to.position)
        this.freeCamera.yaw = tw.to.yaw
        this.freeCamera.pitch = tw.to.pitch
        this.freeCamera.roll = tw.to.roll
        this.freeCamera.fov = tw.to.fov
        this.freeCameraResetTween = null
        this.freeCamera.active = false
        this.freeCamera.locked = false
        this.saveFreeCameraState()
        this.recenterCamera()
      }
      return
    }

    if (!this.freeCamera.active) return

    const keys = this.freeCamera.keys || {}
    this.freeCameraMove.set(0, 0, 0)

    if (keys.KeyW) this.freeCameraMove.z -= 1
    if (keys.KeyS) this.freeCameraMove.z += 1
    if (keys.KeyA) this.freeCameraMove.x -= 1
    if (keys.KeyD) this.freeCameraMove.x += 1
    if (keys.Space) this.freeCameraMove.y += 1
    if (keys.ControlLeft || keys.ControlRight) this.freeCameraMove.y -= 1

    if (!this.freeCamera.velocity) this.freeCamera.velocity = new THREE.Vector3()

    const targetVel = this.freeCameraTargetVel.set(0, 0, 0)
    if (this.freeCameraMove.lengthSq() > 0) {
      this.freeCameraMove.normalize()
      this.freeCameraEuler.set(this.freeCamera.pitch, this.freeCamera.yaw, 0, 'YXZ')
      this.freeCameraMove.applyEuler(this.freeCameraEuler)
      const speed = (keys.ShiftLeft || keys.ShiftRight ? 6.2 : 2.35)
      targetVel.copy(this.freeCameraMove).multiplyScalar(speed)
    }

    const ease = targetVel.lengthSq() > 0 ? 8.2 : 13.5
    this.freeCamera.velocity.lerp(targetVel, clampRange(ease * Math.max(0.001, dt || 1 / 60), 0, 1))
    if (this.freeCamera.velocity.lengthSq() < 0.0004) this.freeCamera.velocity.set(0, 0, 0)

    this.freeCamera.position.addScaledVector(this.freeCamera.velocity, Math.max(0.001, dt || 1 / 60))

    const rollDir = (keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0)
    if (rollDir) this.freeCamera.roll = clampRange(this.freeCamera.roll + rollDir * dt * 0.9, -Math.PI, Math.PI)

    this.scheduleFreeCameraStateSave(720)
  }

  private applyFreeCameraToCamera(cinemaIntensity: number): boolean {
    if (!this.freeCamera || !(this.freeCamera.active || this.freeCamera.locked)) return false

    const cameraShake = clampRange(cinemaIntensity || 0, 0, 1.8)

    this.camera.position.copy(this.freeCamera.position)
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.set(
      this.freeCamera.pitch + this.beatCam.phiKick * cameraShake * 0.45,
      this.freeCamera.yaw + this.beatCam.thetaKick * cameraShake * 0.45,
      this.freeCamera.roll + this.beatCam.rollKick * cameraShake,
    )

    if (cameraShake > 0 && Math.abs(this.beatCam.radiusKick) > 0.0001) {
      this.freeCameraShakeDir.set(0, 0, -1).applyEuler(this.camera.rotation)
      this.camera.position.addScaledVector(this.freeCameraShakeDir, this.beatCam.radiusKick * cameraShake * 0.52)
    }

    const cameraPunch = Math.max(this.camPunch * 0.55, this.beatCam.punch * 0.54 + this.beatCam.radiusKick * 0.16) * cameraShake
    const targetFov = clampRange(this.freeCamera.fov || BASE_FOV, 26, 72) - cameraPunch * 1.75
    this.camera.fov += (targetFov - this.camera.fov) * (targetFov < this.camera.fov ? 0.24 : 0.12)
    this.camera.updateProjectionMatrix()
    this.camPunch *= 0.86

    return true
  }

  triggerBeatKick(strength: number, zoomAmp: number, phiAmp: number, thetaAmp = 0, rollAmp = 0): void {
    this.beatCam.punch = Math.max(this.beatCam.punch, strength)
    this.beatCam.radiusKick = Math.max(this.beatCam.radiusKick, strength * zoomAmp)
    this.beatCam.phiKick = Math.max(this.beatCam.phiKick, -strength * phiAmp)
    this.beatCam.thetaKick += (Math.random() - 0.5) * strength * thetaAmp
    this.beatCam.rollKick += (Math.random() - 0.5) * strength * rollAmp
    this.camPunch = Math.max(this.camPunch, strength * 0.6)
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    const el = this.domElement
    el.removeEventListener('mousedown', this.onMouseDown.bind(this))
    window.removeEventListener('mousemove', this.onMouseMove.bind(this))
    window.removeEventListener('mouseup', this.onMouseUp.bind(this))
    el.removeEventListener('wheel', this.onWheel.bind(this))
    el.removeEventListener('dblclick', this.onDoubleClick.bind(this))
    el.removeEventListener('contextmenu', this.onContextMenu.bind(this))
    document.removeEventListener('pointerlockchange', this.onPointerLockChange.bind(this))
    window.removeEventListener('keydown', this.onKeyDown.bind(this))
    window.removeEventListener('keyup', this.onKeyUp.bind(this))
  }
}
