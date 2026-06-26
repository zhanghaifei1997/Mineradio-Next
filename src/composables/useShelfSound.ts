import { ref } from 'vue'

let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null

const initialized = ref(false)
const volume = ref(0.15)

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

function playClick(): void {
  if (!initialized.value || !audioContext || !masterGain) return
  resumeAudio()

  const now = audioContext.currentTime

  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(1800, now)
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.02)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.25, now + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

  osc.connect(gain)
  gain.connect(masterGain)

  osc.start(now)
  osc.stop(now + 0.08)

  const osc2 = audioContext.createOscillator()
  const gain2 = audioContext.createGain()

  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(900, now + 0.005)
  osc2.frequency.exponentialRampToValueAtTime(600, now + 0.04)

  gain2.gain.setValueAtTime(0, now + 0.005)
  gain2.gain.linearRampToValueAtTime(0.15, now + 0.008)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05)

  osc2.connect(gain2)
  gain2.connect(masterGain)

  osc2.start(now + 0.005)
  osc2.stop(now + 0.07)
}

function playScroll(): void {
  if (!initialized.value || !audioContext || !masterGain) return
  resumeAudio()

  const now = audioContext.currentTime

  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()

  osc.type = 'square'
  osc.frequency.setValueAtTime(2400, now)
  osc.frequency.exponentialRampToValueAtTime(1600, now + 0.012)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

  osc.connect(gain)
  gain.connect(masterGain)

  osc.start(now)
  osc.stop(now + 0.04)
}

function playSelect(): void {
  if (!initialized.value || !audioContext || !masterGain) return
  resumeAudio()

  const now = audioContext.currentTime

  const osc1 = audioContext.createOscillator()
  const gain1 = audioContext.createGain()

  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now)
  osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.06)

  gain1.gain.setValueAtTime(0, now)
  gain1.gain.linearRampToValueAtTime(0.2, now + 0.005)
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

  osc1.connect(gain1)
  gain1.connect(masterGain)

  osc1.start(now)
  osc1.stop(now + 0.14)

  const osc2 = audioContext.createOscillator()
  const gain2 = audioContext.createGain()

  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(440, now + 0.01)
  osc2.frequency.exponentialRampToValueAtTime(660, now + 0.08)

  gain2.gain.setValueAtTime(0, now + 0.01)
  gain2.gain.linearRampToValueAtTime(0.1, now + 0.015)
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

  osc2.connect(gain2)
  gain2.connect(masterGain)

  osc2.start(now + 0.01)
  osc2.stop(now + 0.12)
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
    setVolume,
    getVolume,
  }
}
