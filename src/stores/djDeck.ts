import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Song } from '@/types'
import { BeatMapData, analyzePodcastDjStream } from '@/modules/audio'
import type { BeatMap } from '@/modules/audio'

export type DeckId = 'A' | 'B'

export interface DeckState {
  song: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  cuePoint: number
  pitch: number
  volume: number
  eqLow: number
  eqMid: number
  eqHigh: number
  beatMap: BeatMapData | null
  beatMapReady: boolean
  isAnalyzing: boolean
  syncLocked: boolean
}

export interface BeatMapCacheEntry {
  songKey: string
  beatMap: BeatMap
  bpm: number
  lastUsed: number
}

const BEATMAP_CACHE_KEY = 'mineradio_dj_beatmap_cache'
const MAX_CACHE_SIZE = 20
const PITCH_MIN = -8
const PITCH_MAX = 8

function createInitialDeckState(): DeckState {
  return {
    song: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    cuePoint: 0,
    pitch: 0,
    volume: 0.8,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    beatMap: null,
    beatMapReady: false,
    isAnalyzing: false,
    syncLocked: false,
  }
}

function getSongKey(song: Song): string {
  return `${song.source}:${song.id}`
}

function loadBeatMapCache(): Map<string, BeatMapCacheEntry> {
  try {
    const raw = localStorage.getItem(BEATMAP_CACHE_KEY)
    if (raw) {
      const arr: BeatMapCacheEntry[] = JSON.parse(raw)
      return new Map(arr.map((entry) => [entry.songKey, entry]))
    }
  } catch (e) {
    console.warn('[DjDeckStore] Failed to load beatmap cache:', e)
  }
  return new Map()
}

function saveBeatMapCache(cache: Map<string, BeatMapCacheEntry>): void {
  try {
    const arr = Array.from(cache.values()).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_CACHE_SIZE)
    localStorage.setItem(BEATMAP_CACHE_KEY, JSON.stringify(arr))
  } catch (e) {
    console.warn('[DjDeckStore] Failed to save beatmap cache:', e)
  }
}

export const useDjDeckStore = defineStore('djDeck', () => {
  const active = ref(false)
  const deckA = ref<DeckState>(createInitialDeckState())
  const deckB = ref<DeckState>(createInitialDeckState())
  const crossfader = ref(0.5)
  const masterVolume = ref(0.8)
  const beatMapCache = ref<Map<string, BeatMapCacheEntry>>(loadBeatMapCache())

  const audioElements = new Map<DeckId, HTMLAudioElement>()
  const audioContexts = new Map<DeckId, AudioContext>()
  const sourceNodes = new Map<DeckId, MediaElementAudioSourceNode>()
  const gainNodes = new Map<DeckId, GainNode>()
  const eqFilters = new Map<DeckId, { low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode }>()
  const masterGainNode = ref<GainNode | null>(null)
  const animationFrameId = ref<number | null>(null)

  const deckABpm = computed(() => deckA.value.beatMap?.bpm || 0)
  const deckBBpm = computed(() => deckB.value.beatMap?.bpm || 0)

  const deckAProgress = computed(() =>
    deckA.value.duration > 0 ? (deckA.value.currentTime / deckA.value.duration) * 100 : 0
  )
  const deckBProgress = computed(() =>
    deckB.value.duration > 0 ? (deckB.value.currentTime / deckB.value.duration) * 100 : 0
  )

  function getDeck(deck: DeckId): DeckState {
    return deck === 'A' ? deckA.value : deckB.value
  }

  function setDeck(deck: DeckId, updates: Partial<DeckState>): void {
    if (deck === 'A') {
      deckA.value = { ...deckA.value, ...updates }
    } else {
      deckB.value = { ...deckB.value, ...updates }
    }
  }

  function toggleDjMode(): void {
    active.value = !active.value
    if (!active.value) {
      stopAllDecks()
      cleanupAudio()
    }
  }

  function activateDjMode(): void {
    active.value = true
  }

  function deactivateDjMode(): void {
    active.value = false
    stopAllDecks()
    cleanupAudio()
  }

  function ensureAudioContext(deck: DeckId): void {
    const audio = audioElements.get(deck)
    if (!audio) return

    if (!audioContexts.has(deck)) {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()

      const lowFilter = ctx.createBiquadFilter()
      lowFilter.type = 'lowshelf'
      lowFilter.frequency.value = 200
      lowFilter.gain.value = 0

      const midFilter = ctx.createBiquadFilter()
      midFilter.type = 'peaking'
      midFilter.frequency.value = 1000
      midFilter.Q.value = 1
      midFilter.gain.value = 0

      const highFilter = ctx.createBiquadFilter()
      highFilter.type = 'highshelf'
      highFilter.frequency.value = 4000
      highFilter.gain.value = 0

      source.connect(lowFilter)
      lowFilter.connect(midFilter)
      midFilter.connect(highFilter)
      highFilter.connect(gain)

      audioContexts.set(deck, ctx)
      sourceNodes.set(deck, source)
      gainNodes.set(deck, gain)
      eqFilters.set(deck, { low: lowFilter, mid: midFilter, high: highFilter })
    }

    ensureMasterGain()
    connectToMaster(deck)
  }

  function ensureMasterGain(): void {
    if (masterGainNode.value) return

    const anyCtx = audioContexts.get('A') || audioContexts.get('B')
    if (anyCtx) {
      masterGainNode.value = anyCtx.createGain()
      masterGainNode.value.gain.value = masterVolume.value
      masterGainNode.value.connect(anyCtx.destination)
    }
  }

  function connectToMaster(deck: DeckId): void {
    const gain = gainNodes.get(deck)
    const master = masterGainNode.value
    const ctx = audioContexts.get(deck)
    if (!gain || !master || !ctx) return

    try {
      gain.disconnect()
    } catch {
      // ignore
    }

    if (ctx !== master.context) {
      console.warn('[DjDeckStore] AudioContext mismatch, using direct output')
      gain.connect(ctx.destination)
    } else {
      gain.connect(master)
    }
  }

  function applyCrossfader(): void {
    const gainA = gainNodes.get('A')
    const gainB = gainNodes.get('B')
    const deckVolA = deckA.value.volume
    const deckVolB = deckB.value.volume
    const xfade = crossfader.value

    const factorA = 1 - xfade
    const factorB = xfade

    if (gainA) {
      gainA.gain.value = deckVolA * factorA
    }
    if (gainB) {
      gainB.gain.value = deckVolB * factorB
    }
  }

  function applyEq(deck: DeckId): void {
    const filters = eqFilters.get(deck)
    const state = getDeck(deck)
    if (!filters) return

    filters.low.gain.value = state.eqLow
    filters.mid.gain.value = state.eqMid
    filters.high.gain.value = state.eqHigh
  }

  async function loadToDeck(deck: DeckId, song: Song, audioUrl: string): Promise<void> {
    let audio = audioElements.get(deck)
    if (!audio) {
      audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audioElements.set(deck, audio)

      audio.addEventListener('timeupdate', () => {
        setDeck(deck, { currentTime: audio!.currentTime })
      })
      audio.addEventListener('loadedmetadata', () => {
        setDeck(deck, { duration: audio!.duration })
        analyzeDeckBeatMap(deck)
      })
      audio.addEventListener('ended', () => {
        setDeck(deck, { isPlaying: false })
      })
      audio.addEventListener('play', () => {
        setDeck(deck, { isPlaying: true })
      })
      audio.addEventListener('pause', () => {
        setDeck(deck, { isPlaying: false })
      })
    }

    ensureAudioContext(deck)

    setDeck(deck, {
      song,
      currentTime: 0,
      duration: 0,
      cuePoint: 0,
      beatMap: null,
      beatMapReady: false,
      isAnalyzing: false,
      syncLocked: false,
    })

    audio.src = audioUrl
    audio.load()

    applyEq(deck)
    applyCrossfader()
    startUpdateLoop()
  }

  async function analyzeDeckBeatMap(deck: DeckId): Promise<void> {
    const state = getDeck(deck)
    const audio = audioElements.get(deck)
    if (!state.song || !audio || !audio.src) return

    const songKey = getSongKey(state.song)

    const cached = beatMapCache.value.get(songKey)
    if (cached) {
      const beatMapData = BeatMapData.fromBeatMap(cached.beatMap)
      setDeck(deck, { beatMap: beatMapData, beatMapReady: true })
      cached.lastUsed = Date.now()
      beatMapCache.value.set(songKey, cached)
      saveBeatMapCache(beatMapCache.value)
      return
    }

    setDeck(deck, { isAnalyzing: true })

    try {
      const beatMap = await analyzePodcastDjStream(audio.src, {
        durationSec: state.duration || audio.duration,
      })

      const beatMapData = BeatMapData.fromBeatMap(beatMap)
      const entry: BeatMapCacheEntry = {
        songKey,
        beatMap,
        bpm: beatMapData.bpm,
        lastUsed: Date.now(),
      }

      if (beatMapCache.value.size >= MAX_CACHE_SIZE) {
        const oldestKey = Array.from(beatMapCache.value.entries())
          .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0]?.[0]
        if (oldestKey) {
          beatMapCache.value.delete(oldestKey)
        }
      }

      beatMapCache.value.set(songKey, entry)
      saveBeatMapCache(beatMapCache.value)

      setDeck(deck, { beatMap: beatMapData, beatMapReady: true })
    } catch (e) {
      console.error('[DjDeckStore] Beat analysis failed:', e)
    } finally {
      setDeck(deck, { isAnalyzing: false })
    }
  }

  function togglePlay(deck: DeckId): void {
    const audio = audioElements.get(deck)
    if (!audio || !getDeck(deck).song) return

    if (getDeck(deck).isPlaying) {
      audio.pause()
    } else {
      const ctx = audioContexts.get(deck)
      if (ctx && ctx.state === 'suspended') {
        ctx.resume()
      }
      audio.play().catch((e) => console.error('Play failed:', e))
    }
  }

  function playDeck(deck: DeckId): void {
    const audio = audioElements.get(deck)
    if (!audio) return
    const ctx = audioContexts.get(deck)
    if (ctx && ctx.state === 'suspended') {
      ctx.resume()
    }
    audio.play().catch((e) => console.error('Play failed:', e))
  }

  function pauseDeck(deck: DeckId): void {
    const audio = audioElements.get(deck)
    if (!audio) return
    audio.pause()
  }

  function seekDeck(deck: DeckId, time: number): void {
    const audio = audioElements.get(deck)
    const state = getDeck(deck)
    if (!audio || !state.duration) return

    const clampedTime = Math.max(0, Math.min(time, state.duration))
    audio.currentTime = clampedTime
    setDeck(deck, { currentTime: clampedTime })

    if (state.beatMap) {
      state.beatMap.seekTo(clampedTime)
    }
  }

  function setCue(deck: DeckId): void {
    const state = getDeck(deck)
    setDeck(deck, { cuePoint: state.currentTime })
  }

  function gotoCue(deck: DeckId): void {
    const state = getDeck(deck)
    seekDeck(deck, state.cuePoint)
    pauseDeck(deck)
  }

  function setPitch(deck: DeckId, value: number): void {
    const clampedPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, value))
    const audio = audioElements.get(deck)
    if (audio) {
      audio.playbackRate = 1 + clampedPitch / 100
    }
    setDeck(deck, { pitch: clampedPitch })
  }

  function setVolume(deck: DeckId, value: number): void {
    const clampedVol = Math.max(0, Math.min(1, value))
    setDeck(deck, { volume: clampedVol })
    applyCrossfader()
  }

  function setEq(deck: DeckId, band: 'low' | 'mid' | 'high', value: number): void {
    const clampedGain = Math.max(-12, Math.min(12, value))
    if (band === 'low') {
      setDeck(deck, { eqLow: clampedGain })
    } else if (band === 'mid') {
      setDeck(deck, { eqMid: clampedGain })
    } else {
      setDeck(deck, { eqHigh: clampedGain })
    }
    applyEq(deck)
  }

  function setCrossfader(value: number): void {
    crossfader.value = Math.max(0, Math.min(1, value))
    applyCrossfader()
  }

  function setMasterVolume(value: number): void {
    masterVolume.value = Math.max(0, Math.min(1, value))
    if (masterGainNode.value) {
      masterGainNode.value.gain.value = masterVolume.value
    }
  }

  function syncBeat(targetDeck: DeckId): void {
    const sourceDeck: DeckId = targetDeck === 'A' ? 'B' : 'A'
    const targetState = getDeck(targetDeck)
    const sourceState = getDeck(sourceDeck)

    if (!sourceState.beatMapReady || !targetState.beatMapReady) return
    if (!sourceState.beatMap || !targetState.beatMap) return
    if (sourceState.beatMap.bpm === 0 || targetState.beatMap.bpm === 0) return

    const sourceBpm = sourceState.beatMap.bpm
    const targetBpm = targetState.beatMap.bpm
    const pitchDiff = ((sourceBpm - targetBpm) / targetBpm) * 100

    const newPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitchDiff))
    setPitch(targetDeck, newPitch)
    setDeck(targetDeck, { syncLocked: true })

    const audio = audioElements.get(targetDeck)
    if (audio) {
      const sourceAudio = audioElements.get(sourceDeck)
      if (sourceAudio) {
        const sourceTime = sourceAudio.currentTime
        const sourceBeat = findNearestBeat(sourceState.beatMap, sourceTime)
        if (sourceBeat >= 0) {
          const adjustedTargetBeat = sourceBeat
          const targetBeatTime = getBeatTime(targetState.beatMap, adjustedTargetBeat)
          if (targetBeatTime >= 0) {
            const currentTargetTime = audio.currentTime
            const beatDuration = 60 / (targetBpm * (1 + newPitch / 100))
            const beatsDiff = Math.round((currentTargetTime - targetBeatTime) / beatDuration)
            const newTime = targetBeatTime + beatsDiff * beatDuration
            if (Math.abs(newTime - currentTargetTime) < beatDuration * 2) {
              audio.currentTime = newTime
              setDeck(targetDeck, { currentTime: newTime })
            }
          }
        }
      }
    }
  }

  function findNearestBeat(beatMap: BeatMapData, time: number): number {
    const beats = beatMap.beats
    if (beats.length === 0) return -1

    let left = 0
    let right = beats.length - 1
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      if (beats[mid].time < time) {
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    if (left >= beats.length) return beats.length - 1
    if (left === 0) return 0

    const prevDiff = time - beats[left - 1].time
    const nextDiff = beats[left].time - time
    return prevDiff < nextDiff ? left - 1 : left
  }

  function getBeatTime(beatMap: BeatMapData, index: number): number {
    const beats = beatMap.beats
    if (index < 0 || index >= beats.length) return -1
    return beats[index].time
  }

  function toggleSyncLock(deck: DeckId): void {
    const state = getDeck(deck)
    setDeck(deck, { syncLocked: !state.syncLocked })
  }

  function getBeatMap(songKey: string): BeatMap | null {
    const entry = beatMapCache.value.get(songKey)
    return entry?.beatMap || null
  }

  function cacheBeatMap(songKey: string, beatMap: BeatMap): void {
    const entry: BeatMapCacheEntry = {
      songKey,
      beatMap,
      bpm: BeatMapData.fromBeatMap(beatMap).bpm,
      lastUsed: Date.now(),
    }
    beatMapCache.value.set(songKey, entry)
    saveBeatMapCache(beatMapCache.value)
  }

  function clearBeatMapCache(): void {
    beatMapCache.value.clear()
    try {
      localStorage.removeItem(BEATMAP_CACHE_KEY)
    } catch {
      // ignore
    }
  }

  function startUpdateLoop(): void {
    if (animationFrameId.value !== null) return

    function loop() {
      const audioA = audioElements.get('A')
      const audioB = audioElements.get('B')

      if (audioA && !audioA.paused && deckA.value.beatMap) {
        checkBeatMapBeats('A', audioA.currentTime)
      }
      if (audioB && !audioB.paused && deckB.value.beatMap) {
        checkBeatMapBeats('B', audioB.currentTime)
      }

      animationFrameId.value = requestAnimationFrame(loop)
    }

    animationFrameId.value = requestAnimationFrame(loop)
  }

  function checkBeatMapBeats(deck: DeckId, currentTime: number): void {
    const state = getDeck(deck)
    if (!state.beatMap || !state.beatMapReady) return
    state.beatMap.getNextBeat(currentTime)
  }

  function stopAllDecks(): void {
    const audioA = audioElements.get('A')
    const audioB = audioElements.get('B')
    if (audioA) audioA.pause()
    if (audioB) audioB.pause()
  }

  function cleanupAudio(): void {
    if (animationFrameId.value !== null) {
      cancelAnimationFrame(animationFrameId.value)
      animationFrameId.value = null
    }

    ;(['A', 'B'] as DeckId[]).forEach((deck) => {
      const audio = audioElements.get(deck)
      if (audio) {
        audio.pause()
        audio.src = ''
      }
      try {
        gainNodes.get(deck)?.disconnect()
        sourceNodes.get(deck)?.disconnect()
        const filters = eqFilters.get(deck)
        if (filters) {
          filters.low.disconnect()
          filters.mid.disconnect()
          filters.high.disconnect()
        }
      } catch {
        // ignore
      }
      audioContexts.get(deck)?.close().catch(() => {})
    })

    if (masterGainNode.value) {
      try {
        masterGainNode.value.disconnect()
      } catch {
        // ignore
      }
      masterGainNode.value = null
    }

    audioElements.clear()
    audioContexts.clear()
    sourceNodes.clear()
    gainNodes.clear()
    eqFilters.clear()
  }

  function getAudioElement(deck: DeckId): HTMLAudioElement | undefined {
    return audioElements.get(deck)
  }

  watch(crossfader, () => {
    applyCrossfader()
  })

  return {
    active,
    deckA,
    deckB,
    crossfader,
    masterVolume,
    deckABpm,
    deckBBpm,
    deckAProgress,
    deckBProgress,
    beatMapCache,
    toggleDjMode,
    activateDjMode,
    deactivateDjMode,
    loadToDeck,
    togglePlay,
    playDeck,
    pauseDeck,
    seekDeck,
    setCue,
    gotoCue,
    setPitch,
    setVolume,
    setEq,
    setCrossfader,
    setMasterVolume,
    syncBeat,
    toggleSyncLock,
    getBeatMap,
    cacheBeatMap,
    clearBeatMapCache,
    getAudioElement,
    getDeck,
  }
})
