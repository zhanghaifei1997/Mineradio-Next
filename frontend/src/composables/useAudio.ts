/**
 * 音频引擎 composable
 * 封装 Web Audio API (AudioContext, AnalyserNode, GainNode)
 * 提供播放控制和频谱分析能力
 */
import { ref, shallowRef, readonly } from 'vue'

// ── 模块级单例 ──
let audioElement: HTMLAudioElement | null = null
let audioCtx: AudioContext | null = null
let sourceNode: MediaElementAudioSourceNode | null = null
let analyserNode: AnalyserNode | null = null
let gainNode: GainNode | null = null

const FFT_SIZE = 2048

export function useAudio() {
  const ready = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const playing = ref(false)
  const volume = ref(0.8)

  // 频谱数据（每帧更新）
  const frequencyData = shallowRef(new Uint8Array(FFT_SIZE / 2))
  const timeDomainData = shallowRef(new Uint8Array(FFT_SIZE))

  // 音频能量计算
  const bass = ref(0)
  const mid = ref(0)
  const treble = ref(0)
  const energy = ref(0)

  let animFrameId = 0

  /**
   * 初始化音频上下文（懒初始化，需用户交互后才能调用）
   */
  function initAudio() {
    if (audioElement) return

    audioElement = new Audio()
    audioElement.crossOrigin = 'anonymous'
    audioElement.preload = 'auto'

    audioCtx = new AudioContext()
    analyserNode = audioCtx.createAnalyser()
    analyserNode.fftSize = FFT_SIZE
    analyserNode.smoothingTimeConstant = 0.82

    gainNode = audioCtx.createGain()
    gainNode.gain.value = volume.value

    sourceNode = audioCtx.createMediaElementSource(audioElement)
    sourceNode.connect(analyserNode)
    analyserNode.connect(gainNode)
    gainNode.connect(audioCtx.destination)

    // 事件监听
    audioElement.addEventListener('timeupdate', onTimeUpdate)
    audioElement.addEventListener('durationchange', onDurationChange)
    audioElement.addEventListener('play', () => { playing.value = true })
    audioElement.addEventListener('pause', () => { playing.value = false })
    audioElement.addEventListener('ended', onEnded)
    audioElement.addEventListener('error', onError)

    ready.value = true
    startAnalysisLoop()
  }

  function onTimeUpdate() {
    if (audioElement) currentTime.value = audioElement.currentTime
  }

  function onDurationChange() {
    if (audioElement) duration.value = audioElement.duration || 0
  }

  const endedCallbacks: Array<() => void> = []
  function onEnded() {
    playing.value = false
    endedCallbacks.forEach(cb => cb())
  }

  function onError() {
    playing.value = false
    console.error('[useAudio] audio error', audioElement?.error)
  }

  /**
   * 频谱分析循环
   */
  function startAnalysisLoop() {
    const freqBuf = new Uint8Array(FFT_SIZE / 2)
    const timeBuf = new Uint8Array(FFT_SIZE)

    function tick() {
      if (analyserNode && playing.value) {
        analyserNode.getByteFrequencyData(freqBuf)
        analyserNode.getByteTimeDomainData(timeBuf)

        frequencyData.value = freqBuf
        timeDomainData.value = timeBuf

        // 计算低/中/高频能量
        const len = freqBuf.length
        const bassEnd = Math.floor(len * 0.1)
        const midEnd = Math.floor(len * 0.4)
        let bassSum = 0, midSum = 0, trebSum = 0

        for (let i = 0; i < bassEnd; i++) bassSum += freqBuf[i] ?? 0
        for (let i = bassEnd; i < midEnd; i++) midSum += freqBuf[i] ?? 0
        for (let i = midEnd; i < len; i++) trebSum += freqBuf[i] ?? 0

        bass.value = bassSum / (bassEnd * 255)
        mid.value = midSum / ((midEnd - bassEnd) * 255)
        treble.value = trebSum / ((len - midEnd) * 255)
        energy.value = (bass.value + mid.value + treble.value) / 3
      }
      animFrameId = requestAnimationFrame(tick)
    }
    tick()
  }

  // ── 播放控制 API ──

  function loadUrl(url: string) {
    if (!audioElement) initAudio()
    if (!audioElement) return
    audioElement.src = url
    audioElement.load()
    currentTime.value = 0
  }

  async function play() {
    if (!audioElement) initAudio()
    if (!audioElement || !audioCtx) return
    if (audioCtx.state === 'suspended') await audioCtx.resume()
    try {
      await audioElement.play()
    } catch (e) {
      console.warn('[useAudio] play failed:', e)
    }
  }

  function pause() {
    audioElement?.pause()
  }

  function seek(time: number) {
    if (audioElement) {
      audioElement.currentTime = Math.max(0, Math.min(time, duration.value))
    }
  }

  function setVolume(v: number) {
    const clamped = Math.max(0, Math.min(1, v))
    volume.value = clamped
    if (gainNode) gainNode.gain.value = clamped
    if (audioElement) audioElement.volume = clamped
  }

  function onEndedCallback(cb: () => void) {
    endedCallbacks.push(cb)
    return () => {
      const idx = endedCallbacks.indexOf(cb)
      if (idx >= 0) endedCallbacks.splice(idx, 1)
    }
  }

  function destroy() {
    cancelAnimationFrame(animFrameId)
    audioElement?.pause()
    audioElement?.remove()
    audioCtx?.close()
    audioElement = null
    audioCtx = null
    sourceNode = null
    analyserNode = null
    gainNode = null
    ready.value = false
  }

  return {
    // 状态
    ready: readonly(ready),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    playing: readonly(playing),
    volume: readonly(volume),
    // 频谱
    frequencyData: readonly(frequencyData),
    timeDomainData: readonly(timeDomainData),
    bass: readonly(bass),
    mid: readonly(mid),
    treble: readonly(treble),
    energy: readonly(energy),
    // 控制
    initAudio,
    loadUrl,
    play,
    pause,
    seek,
    setVolume,
    onEnded: onEndedCallback,
    destroy,
  }
}
