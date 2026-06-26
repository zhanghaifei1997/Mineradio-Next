import * as THREE from 'three'
import { CameraSystem } from './CameraSystem'
import { BeatSync } from './BeatSync'
import { RippleSystem } from './RippleSystem'
import { ParticleInteraction } from './ParticleInteraction'
import { CoverDepth } from './CoverDepth'
import { createPreset } from './presets'
import type {
  VisualEngineOptions,
  PerformanceQualityProfile,
  ParticleSystem,
  AudioAnalysisData,
} from './types'
import type { VisualPreset, FxSettings } from '@/types'
import { PerformanceManager, getPerformanceManager } from '@/modules/performance'

export class VisualEngine {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  cameraSystem: CameraSystem
  beatSync: BeatSync
  rippleSystem: RippleSystem
  particleInteraction: ParticleInteraction
  coverDepth: CoverDepth
  performanceManager: PerformanceManager

  private canvas: HTMLCanvasElement
  private currentPreset: VisualPreset = 'emily'
  private particleSystem: ParticleSystem | null = null
  private animationId: number | null = null
  private lastTime = 0
  private lastRenderAt = 0
  private frameCount = 0
  private fps = 0
  private skippedFrames = 0
  private longFrames = 0
  private fxSettings: FxSettings

  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private frequencyData: Uint8Array | null = null
  private timeDomainData: Uint8Array | null = null
  private audioSource: MediaElementAudioSourceNode | null = null
  private connectedAudioElement: HTMLAudioElement | null = null

  private smoothEnergy = 0
  private smoothLow = 0
  private smoothMid = 0
  private smoothHigh = 0
  private smoothBass = 0
  private smoothTreble = 0
  private beatPulse = 0

  private isPaused = false
  private isHidden = false
  private cleanupListeners: Array<() => void> = []

  private djModeActive = false
  private djIntensity = 0
  private djVisualBoost = 1
  private djCameraShakeIntensity = 0
  private djParticleBoost = 1

  private transitionActive = false
  private transitionProgress = 1
  private transitionDuration = 0.6
  private oldParticleSystem: ParticleSystem | null = null

  constructor(options: VisualEngineOptions) {
    this.canvas = options.canvas
    this.fxSettings = options.fxSettings
    this.performanceManager = options.performanceManager || getPerformanceManager()

    this.scene = new THREE.Scene()
    this.scene.background = null

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(this.getRenderPixelRatio())
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.domElement.style.background = 'transparent'
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.renderer.domElement.tabIndex = 0

    this.cameraSystem = new CameraSystem(this.camera, this.renderer.domElement)
    this.cameraSystem.setCinemaMode(this.fxSettings.cinemaMode)
    this.beatSync = new BeatSync()
    this.rippleSystem = new RippleSystem()
    this.particleInteraction = new ParticleInteraction()
    this.coverDepth = new CoverDepth()

    this.setupEventListeners()
    this.setupPerformanceHooks()
    this.initPreset(this.fxSettings.preset)
    this.startAnimationLoop()
  }

  private setupEventListeners(): void {
    const onResize = this.onResize.bind(this)
    const onVisibilityChange = this.onVisibilityChange.bind(this)
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibilityChange)
    this.cleanupListeners.push(() => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    })

    // 粒子指针交互 — 不干扰 CameraSystem 的相机控制
    const dom = this.renderer.domElement
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      this.particleInteraction.onPointerDown(e.clientX, e.clientY)
    }
    const onPointerMove = (e: PointerEvent) => {
      this.particleInteraction.onPointerMove(
        e.clientX,
        e.clientY,
        window.innerWidth,
        window.innerHeight,
      )
    }
    const onPointerUp = () => {
      this.particleInteraction.onPointerUp()
    }
    const onPointerLeave = () => {
      this.particleInteraction.onPointerLeave()
    }
    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('pointerleave', onPointerLeave)
    this.cleanupListeners.push(() => {
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('pointerleave', onPointerLeave)
    })
  }

  private setupPerformanceHooks(): void {
    const offRenderPower = this.performanceManager.on('renderPowerChange', () => {
      this.applyRendererPowerMode()
    })
    const offQualityChange = this.performanceManager.on('qualityChange', () => {
      this.applyRendererPowerMode()
      this.initPreset(this.currentPreset)
    })
    this.cleanupListeners.push(offRenderPower, offQualityChange)
  }

  private applyRendererPowerMode(): void {
    const state = this.performanceManager.getRenderPowerState()
    if (state.mode === 'sleep') {
      if (this.renderer.renderLists && (this.renderer.renderLists as any).dispose) {
        try { (this.renderer.renderLists as any).dispose() } catch (e) { /* ignore */ }
      }
    }
    this.renderer.setPixelRatio(this.getRenderPixelRatio())
    this.renderer.setSize(
      state.width || window.innerWidth,
      state.height || window.innerHeight,
      false
    )
  }

  private onResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.setPixelRatio(this.getRenderPixelRatio())
    this.renderer.setSize(width, height)
    this.cameraSystem.resize(width / height)
    if (this.particleSystem) {
      this.particleSystem.resize()
    }
  }

  private onVisibilityChange(): void {
    this.isHidden = document.hidden
  }

  private getQualityProfile(): PerformanceQualityProfile {
    return this.performanceManager.getQualityProfile()
  }

  private getRenderPixelRatio(): number {
    return this.performanceManager.getRenderPixelRatio()
  }

  private initPreset(presetName: VisualPreset, withTransition = false): void {
    if (withTransition && this.particleSystem) {
      if (this.oldParticleSystem) {
        this.scene.remove(this.oldParticleSystem.group)
        this.oldParticleSystem.dispose()
        this.oldParticleSystem = null
      }

      this.oldParticleSystem = this.particleSystem
      this.transitionActive = true
      this.transitionProgress = 0
    } else if (this.particleSystem) {
      this.scene.remove(this.particleSystem.group)
      this.particleSystem.dispose()
      this.particleSystem = null
    }

    this.currentPreset = presetName

    this.particleSystem = createPreset(presetName, this.scene, {
      quality: this.fxSettings.performanceQuality,
      resolution: this.fxSettings.particleResolution,
      color: this.fxSettings.accentColor,
      glowColor: this.fxSettings.glowColor,
    })

    if (withTransition && this.particleSystem) {
      this.particleSystem.group.scale.setScalar(0.8)
      ;(this.particleSystem.group as any).materialOpacity = 0
    }
  }

  setPreset(presetName: VisualPreset): void {
    if (presetName === this.currentPreset) return
    this.initPreset(presetName, true)
  }

  updateFxSettings(settings: Partial<FxSettings>): void {
    const prevQuality = this.fxSettings.performanceQuality
    const prevResolution = this.fxSettings.particleResolution
    const prevColor = this.fxSettings.accentColor
    const prevGlowColor = this.fxSettings.glowColor

    this.fxSettings = { ...this.fxSettings, ...settings }

    const needsReinit = 
      (settings.performanceQuality !== undefined && settings.performanceQuality !== prevQuality) ||
      (settings.particleResolution !== undefined && settings.particleResolution !== prevResolution) ||
      (settings.accentColor !== undefined && settings.accentColor !== prevColor) ||
      (settings.glowColor !== undefined && settings.glowColor !== prevGlowColor)

    if (needsReinit) {
      const hasPresetChange = settings.preset !== undefined
      if (!hasPresetChange) {
        this.initPreset(this.currentPreset, false)
      }
    }

    if (settings.preset) {
      this.setPreset(settings.preset)
    }

    if (settings.cinemaMode) {
      this.cameraSystem.setCinemaMode(settings.cinemaMode)
    }
  }

  private updateTransition(dt: number): void {
    if (!this.transitionActive) return

    this.transitionProgress = Math.min(1, this.transitionProgress + dt / this.transitionDuration)
    const eased = this.easeOutCubic(this.transitionProgress)

    if (this.particleSystem) {
      const scale = 0.8 + eased * 0.2
      this.particleSystem.group.scale.setScalar(scale)
    }

    if (this.oldParticleSystem) {
      const oldScale = 1 - eased * 0.2
      this.oldParticleSystem.group.scale.setScalar(oldScale)
      this.oldParticleSystem.group.opacity = 1 - eased
    }

    if (this.transitionProgress >= 1) {
      this.transitionActive = false
      if (this.oldParticleSystem) {
        this.scene.remove(this.oldParticleSystem.group)
        this.oldParticleSystem.dispose()
        this.oldParticleSystem = null
      }
      if (this.particleSystem) {
        this.particleSystem.group.scale.setScalar(1)
        this.particleSystem.group.opacity = 1
      }
    }
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
  }

  connectAudio(audioElement: HTMLAudioElement): void {
    if (this.connectedAudioElement === audioElement) return

    this.disconnectAudio()

    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.8

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeDomainData = new Uint8Array(this.analyser.fftSize)

      this.audioSource = this.audioContext.createMediaElementSource(audioElement)
      this.audioSource.connect(this.analyser)
      this.analyser.connect(this.audioContext.destination)

      this.connectedAudioElement = audioElement
    } catch (e) {
      console.warn('Failed to connect audio to visual engine:', e)
    }
  }

  connectAnalyser(
    audioContext: AudioContext,
    analyser: AnalyserNode,
    audioElement: HTMLAudioElement
  ): void {
    if (this.connectedAudioElement === audioElement && this.analyser === analyser) return

    this.disconnectAudio()

    try {
      this.audioContext = audioContext
      this.analyser = analyser
      this.connectedAudioElement = audioElement

      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
      this.timeDomainData = new Uint8Array(this.analyser.fftSize)
    } catch (e) {
      console.warn('Failed to connect analyser to visual engine:', e)
    }
  }

  disconnectAudio(): void {
    if (this.audioSource) {
      try {
        this.audioSource.disconnect()
      } catch (e) { /* ignore */ }
      this.audioSource = null
    }
    this.analyser = null
    this.frequencyData = null
    this.timeDomainData = null
    this.connectedAudioElement = null
    this.beatSync.reset()
    this.rippleSystem.reset()
  }

  private analyseAudio(dt: number): AudioAnalysisData {
    if (!this.analyser || !this.frequencyData || !this.timeDomainData || !this.audioContext) {
      return {
        energy: 0,
        low: 0,
        mid: 0,
        high: 0,
        bass: 0,
        treble: 0,
        beatPulse: 0,
        isPlaying: false,
        currentTime: 0,
      }
    }

    this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>)
    this.analyser.getByteTimeDomainData(this.timeDomainData as Uint8Array<ArrayBuffer>)

    const isPlaying = this.connectedAudioElement ? !this.connectedAudioElement.paused : false
    const currentTime = this.connectedAudioElement ? this.connectedAudioElement.currentTime : 0

    const beatResult = this.beatSync.processAudioData(
      this.frequencyData as Uint8Array,
      this.timeDomainData as Uint8Array,
      this.audioContext.sampleRate,
      this.analyser.fftSize,
      currentTime,
      isPlaying,
      dt,
    )

    const sampleRate = this.audioContext.sampleRate
    const fftSize = this.analyser.fftSize

    const beatBandRms = (hz0: number, hz1: number): number => {
      const binHz = sampleRate / fftSize
      const a = Math.max(1, Math.floor(hz0 / binHz))
      const b = Math.min(this.frequencyData!.length - 1, Math.ceil(hz1 / binHz))
      let sum = 0
      let count = 0
      for (let i = a; i <= b; i++) {
        const v = this.frequencyData![i] / 255
        sum += v * v
        count++
      }
      return count ? Math.sqrt(sum / count) : 0
    }

    const bass = beatBandRms(20, 250)
    const lowMid = beatBandRms(250, 500)
    const mid = beatBandRms(500, 2000)
    const highMid = beatBandRms(2000, 4000)
    const treble = beatBandRms(4000, 16000)

    const low = (bass + lowMid) / 2
    const high = (highMid + treble) / 2

    let totalEnergy = 0
    const bins = Math.min(512, this.frequencyData.length)
    for (let i = 0; i < bins; i++) {
      totalEnergy += this.frequencyData[i] / 255
    }
    const energy = totalEnergy / bins

    const ease = (cur: number, next: number, k: number): number => cur + (next - cur) * k

    this.smoothEnergy = ease(this.smoothEnergy, energy, energy > this.smoothEnergy ? 0.15 : 0.05)
    this.smoothLow = ease(this.smoothLow, low, low > this.smoothLow ? 0.12 : 0.04)
    this.smoothMid = ease(this.smoothMid, mid, mid > this.smoothMid ? 0.10 : 0.04)
    this.smoothHigh = ease(this.smoothHigh, high, high > this.smoothHigh ? 0.08 : 0.03)
    this.smoothBass = ease(this.smoothBass, bass, bass > this.smoothBass ? 0.18 : 0.06)
    this.smoothTreble = ease(this.smoothTreble, treble, treble > this.smoothTreble ? 0.10 : 0.04)

    this.beatPulse = beatResult.beatPulse || 0

    return {
      energy: this.smoothEnergy,
      low: this.smoothLow,
      mid: this.smoothMid,
      high: this.smoothHigh,
      bass: this.smoothBass,
      treble: this.smoothTreble,
      beatPulse: this.beatPulse,
      isPlaying,
      currentTime,
    }
  }

  private startAnimationLoop(): void {
    this.lastTime = performance.now()
    let lastFpsUpdate = performance.now()
    let frameCount = 0

    const animate = (time: number): void => {
      this.animationId = requestAnimationFrame(animate)

      const dt = Math.min(0.05, (time - this.lastTime) / 1000)
      this.lastTime = time

      if (this.performanceManager.isDeepBackgroundMode()) {
        this.skippedFrames++
        return
      }

      if (this.isPaused || this.isHidden) return

      const audioData = this.analyseAudio(dt)

      const cinemaIntensity = this.fxSettings.cinemaIntensity * (this.djModeActive ? this.djVisualBoost : 1)

      this.cameraSystem.updateCinemaDynamics(
        audioData.energy,
        audioData.bass,
        cinemaIntensity,
      )

      this.cameraSystem.update(dt, audioData.isPlaying, cinemaIntensity)

      if (audioData.isPlaying && this.beatSync.rtBeat.beatCount > 0) {
        const lastHitDiff = audioData.currentTime - this.beatSync.rtBeat.lastHitAt
        if (lastHitDiff < 0.05) {
          const kickIntensity = this.djModeActive
            ? 0.3 + (audioData.bass || 0) * 0.5 * this.djVisualBoost
            : 0.3 + (audioData.bass || 0) * 0.5
          this.cameraSystem.triggerBeatKick(
            kickIntensity,
            0.1,
            0.005,
            0.001,
            0.002,
          )
        }
      }

      if (this.djModeActive && this.djCameraShakeIntensity > 0) {
        const shakeX = (Math.random() - 0.5) * this.djCameraShakeIntensity * 0.02
        const shakeY = (Math.random() - 0.5) * this.djCameraShakeIntensity * 0.02
        this.camera.position.x += shakeX
        this.camera.position.y += shakeY
      }

      // 涟漪系统：bass 上升沿触发，更新 uniform 数据
      this.rippleSystem.update(audioData.bass, audioData.currentTime, dt)

      // 粒子指针交互：缓动到目标旋转、衰减惯性、淡出 handActive
      this.particleInteraction.update(dt)

      // 把涟漪/指针信息挂到 audioData 上，让预设可以按需消费
      const rippleUniforms = this.rippleSystem.getUniforms()
      const pointerUniforms = this.particleInteraction.getUniforms()
      const augmentedAudio: AudioAnalysisData = {
        ...audioData,
        rippleScatter: rippleUniforms.uScatter,
        rippleBurst: rippleUniforms.uBurstAmt,
        rippleCount: rippleUniforms.count,
        pointerParallaxX: pointerUniforms.uParallax[0],
        pointerParallaxY: pointerUniforms.uParallax[1],
        pointerX: pointerUniforms.uHandXY[0],
        pointerY: pointerUniforms.uHandXY[1],
        handActive: pointerUniforms.uHandActive,
      }

      this.updateTransition(dt)

      if (this.oldParticleSystem && this.transitionActive) {
        this.oldParticleSystem.update(dt, augmentedAudio)
      }

      if (this.particleSystem) {
        const boostedAudio: AudioAnalysisData = this.djModeActive
          ? {
              ...augmentedAudio,
              energy: augmentedAudio.energy * this.djParticleBoost,
              bass: augmentedAudio.bass * this.djParticleBoost,
              low: augmentedAudio.low * this.djParticleBoost,
              beatPulse: Math.min(1, augmentedAudio.beatPulse * this.djParticleBoost),
            }
          : augmentedAudio
        this.particleSystem.update(dt, boostedAudio)
      }

      const renderStart = performance.now()
      this.renderer.render(this.scene, this.camera)
      const renderTime = performance.now() - renderStart

      if (renderTime > 33) {
        this.longFrames++
      }

      frameCount++
      this.lastRenderAt = time

      if (time - lastFpsUpdate >= 1000) {
        this.fps = Math.round((frameCount * 1000) / (time - lastFpsUpdate))
        frameCount = 0
        lastFpsUpdate = time

        this.performanceManager.updateRenderPerf({
          fps: this.fps,
          skipped: this.skippedFrames,
          longFrames: this.longFrames,
          lastRenderAt: this.lastRenderAt,
        })

        this.performanceManager.maybeTrimRuntimeCaches(time)
      }
    }

    this.animationId = requestAnimationFrame(animate)
  }

  pause(): void {
    this.isPaused = true
  }

  resume(): void {
    this.isPaused = false
    this.lastTime = performance.now()
  }

  getCameraSystem(): CameraSystem {
    return this.cameraSystem
  }

  getBeatSync(): BeatSync {
    return this.beatSync
  }

  getRippleSystem(): RippleSystem {
    return this.rippleSystem
  }

  getParticleInteraction(): ParticleInteraction {
    return this.particleInteraction
  }

  getCoverDepth(): CoverDepth {
    return this.coverDepth
  }

  getCurrentPreset(): VisualPreset {
    return this.currentPreset
  }

  setDjMode(active: boolean, options?: {
    intensity?: number
    visualBoost?: number
    cameraShake?: number
    particleBoost?: number
  }): void {
    this.djModeActive = active
    if (options) {
      if (options.intensity !== undefined) this.djIntensity = options.intensity
      if (options.visualBoost !== undefined) this.djVisualBoost = options.visualBoost
      if (options.cameraShake !== undefined) this.djCameraShakeIntensity = options.cameraShake
      if (options.particleBoost !== undefined) this.djParticleBoost = options.particleBoost
    }
  }

  updateDjMode(options: {
    intensity?: number
    visualBoost?: number
    cameraShake?: number
    particleBoost?: number
  }): void {
    if (options.intensity !== undefined) this.djIntensity = options.intensity
    if (options.visualBoost !== undefined) this.djVisualBoost = options.visualBoost
    if (options.cameraShake !== undefined) this.djCameraShakeIntensity = options.cameraShake
    if (options.particleBoost !== undefined) this.djParticleBoost = options.particleBoost
  }

  dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    this.cleanupListeners.forEach((cleanup) => {
      try { cleanup() } catch (e) { /* ignore */ }
    })
    this.cleanupListeners = []

    this.disconnectAudio()

    if (this.audioContext) {
      try {
        this.audioContext.close()
      } catch (e) { /* ignore */ }
      this.audioContext = null
    }

    if (this.particleSystem) {
      this.scene.remove(this.particleSystem.group)
      this.particleSystem.dispose()
      this.particleSystem = null
    }

    this.rippleSystem.reset()
    this.particleInteraction.reset()
    this.coverDepth.clearCache()

    this.cameraSystem.dispose()
    this.renderer.dispose()
  }
}
