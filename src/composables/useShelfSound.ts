import { ref } from 'vue'

// ============================================================
//  歌单架音效 — 4 振荡器 + 噪声层 + 方向感 + row 变体
//   对齐原项目 index.html:17763 playShelfSelectTick 参数
// ============================================================

export type ShelfSoundDirection = 'up' | 'down' | 'none'

export interface ShelfSoundOptions {
  /** 上行/下行产生轻微 pitch 偏移，'none' 时为 1.0 */
  direction?: ShelfSoundDirection
  /** 行内变体（更柔和、节流更短） */
  isRow?: boolean
  /** 0..1 主播放音量，用于 volumeScale = 0.38 + v * 0.62，缺省 0.65 */
  targetVolume?: number
}

let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null

const initialized = ref(false)
// 默认 1.0 以保留原项目金属 tick 的目标响度；
// setVolume/getVolume 仍对外开放，可在 0..1 之间衰减。
const volume = ref(1.0)

let lastShelfSelectAt = 0
let targetVolumeProvider: () => number = () => 0.65

function initAudio(): void {
  if (initialized.value) return
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    masterGain = audioContext.createGain()
    masterGain.gain.value = volume.value
    masterGain.connect(audioContext.destination)
    initialized.value = true
  } catch (e) {
    console.warn('Failed to init shelf sound:', e)
  }
}

function resumeAudio(): void {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume()
  }
}

/**
 * 让 useShelfSound 在每次播放 tick 时读取 player.volume 作为 volumeScale 输入。
 * 在使用方（如 PlaylistShelf3D.vue）调用以接入主播放音量。
 */
function setTargetVolumeProvider(provider: () => number): void {
  if (typeof provider === 'function') targetVolumeProvider = provider
}

function resolveTargetVolume(opts: ShelfSoundOptions | undefined): number {
  const v = opts?.targetVolume
  if (typeof v === 'number' && isFinite(v)) {
    return Math.max(0, Math.min(1, v))
  }
  let dyn = 0.65
  try { dyn = targetVolumeProvider() } catch (_) { /* keep default */ }
  if (!isFinite(dyn)) dyn = 0.65
  return Math.max(0, Math.min(1, dyn))
}

function playShelfSelectTick(opts: ShelfSoundOptions = {}): void {
  if (!initialized.value || !audioContext || !masterGain) return
  resumeAudio()

  const nowMs = performance.now()
  const isRow = !!opts.isRow
  // row 变体节流 36ms, 普通 42ms
  const minGap = isRow ? 36 : 42
  if (nowMs - lastShelfSelectAt < minGap) return
  lastShelfSelectAt = nowMs

  const ctx = audioContext
  const direction = opts.direction || 'none'
  // 方向感：上行 1.035, 下行 0.965
  const pitch = direction === 'up' ? 1.035 : direction === 'down' ? 0.965 : 1.0
  // row 变体整体衰减到 0.74
  const rowScale = isRow ? 0.74 : 1.0
  // 主音量跟随：volumeScale = 0.38 + targetVolume * 0.62
  const targetVol = resolveTargetVolume(opts)
  const volumeScale = 0.38 + targetVol * 0.62

  const t = ctx.currentTime + 0.002

  // OUT 主增益（5 段 ADSR 包络：attack 2ms → 峰值 0.058*rowScale*volumeScale → exp 衰减 82ms）
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t)
  out.gain.linearRampToValueAtTime(0.058 * rowScale * volumeScale, t + 0.002)
  out.gain.exponentialRampToValueAtTime(0.0001, t + 0.082)
  out.connect(masterGain)

  // 噪声层：34ms 白噪声缓冲，包络 e=(1-i/len)^4.2
  //   highpass 4200Hz + bandpass 8400Hz (Q=7.2)
  const sampleRate = ctx.sampleRate || 44100
  const len = Math.max(1, Math.floor(sampleRate * 0.034))
  const buf = ctx.createBuffer(1, len, sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const e = Math.pow(1 - i / len, 4.2)
    data[i] = (Math.random() * 2 - 1) * e
  }
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(4200 * pitch, t)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(8400 * pitch, t)
  bp.Q.setValueAtTime(7.2, t)
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.56, t)
  noise.connect(hp)
  hp.connect(bp)
  bp.connect(ng)
  ng.connect(out)
  noise.start(t)
  noise.stop(t + 0.040)

  // 4 振荡器 click 工具
  function clickOsc(
    type: OscillatorType,
    freq: number,
    delay: number,
    dur: number,
    gainValue: number,
    bend: number,
  ): void {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const start = t + delay
    const end = start + dur
    osc.type = type
    osc.frequency.setValueAtTime(freq * pitch, start)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq * pitch * bend), end)
    g.gain.setValueAtTime(0.0001, start)
    g.gain.linearRampToValueAtTime(gainValue, start + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(g)
    g.connect(out)
    osc.start(start)
    osc.stop(end + 0.004)
  }

  // 4 振荡器：triangle 720Hz / square 2180Hz / triangle 4200Hz / square 7100Hz
  clickOsc('triangle', 720, 0.000, 0.030, 0.18, 0.70)
  clickOsc('square', 2180, 0.004, 0.022, 0.30, 0.86)
  clickOsc('triangle', 4200, 0.011, 0.018, 0.18, 0.94)
  clickOsc('square', 7100, 0.018, 0.012, 0.070, 0.98)

  // 清理 OUT 节点
  window.setTimeout(() => {
    try { out.disconnect() } catch (_) { /* ignore */ }
  }, 200)
}

/** 卡片点击：方向中性，普通变体 */
function playClick(opts?: ShelfSoundOptions): void {
  playShelfSelectTick(opts)
}

/** 滚动：可携带 direction 让上下行产生 pitch 偏移 */
function playScroll(opts?: ShelfSoundOptions): void {
  playShelfSelectTick(opts)
}

/** 选中：方向中性，普通变体 */
function playSelect(opts?: ShelfSoundOptions): void {
  playShelfSelectTick(opts)
}

function setVolume(v: number): void {
  volume.value = Math.max(0, Math.min(1, v))
  if (masterGain) {
    masterGain.gain.value = volume.value
  }
}

function getVolume(): number {
  return volume.value
}

export function useShelfSound() {
  return {
    initialized,
    volume,
    initAudio,
    playClick,
    playScroll,
    playSelect,
    playShelfSelectTick,
    setVolume,
    getVolume,
    setTargetVolumeProvider,
  }
}
