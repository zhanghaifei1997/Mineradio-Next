import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  djModeEngine,
  podcastManager,
} from '@/modules/dj'
import type {
  DjModeState,
  DjModeConfig,
  DjRadio,
  DjProgram,
  DjCategory,
  DjToplist,
  DjToplistType,
  PlayHistoryItem,
  PodcastSearchResult,
  SubscribedRadioList,
  ProgramListResult,
} from '@/modules/dj'

export const useDjStore = defineStore('dj', () => {
  const djMode = ref<DjModeState>(djModeEngine.getState())
  const djConfig = ref<DjModeConfig>(djModeEngine.getConfig())

  const recommendRadios = ref<DjRadio[]>([])
  const subscribedRadios = ref<DjRadio[]>([])
  const subscribedCount = ref(0)
  const subscribedHasMore = ref(false)

  const currentRadio = ref<DjRadio | null>(null)
  const currentProgram = ref<DjProgram | null>(null)
  const programList = ref<DjProgram[]>([])
  const programListCount = ref(0)
  const programListHasMore = ref(false)

  const categories = ref<DjCategory[]>([])
  const toplist = ref<DjToplist | null>(null)

  const searchResult = ref<PodcastSearchResult>({
    programs: [],
    radios: [],
    total: 0,
    more: false,
  })

  const playHistory = ref<PlayHistoryItem[]>(podcastManager.getPlayHistory())

  const loadingRecommend = ref(false)
  const loadingSubscribed = ref(false)
  const loadingPrograms = ref(false)
  const loadingCategories = ref(false)
  const loadingToplist = ref(false)
  const loadingSearch = ref(false)
  const analyzing = ref(false)

  const isDjModeActive = computed(() => djMode.value.active && djConfig.value.enabled)
  const visualMultiplier = computed(() => djModeEngine.getVisualMultiplier())
  const cameraShakeIntensity = computed(() => djModeEngine.getCameraShakeIntensity())
  const particleBoost = computed(() => djModeEngine.getParticleBoost())

  djModeEngine.subscribe((state) => {
    djMode.value = state
  })

  podcastManager.subscribe(() => {
    playHistory.value = podcastManager.getPlayHistory()
  })

  function updateDjConfig(partial: Partial<DjModeConfig>): void {
    djModeEngine.updateConfig(partial)
    djConfig.value = djModeEngine.getConfig()
  }

  function toggleDjMode(): void {
    if (djMode.value.active) {
      djModeEngine.deactivate()
    } else {
      djModeEngine.activate(djMode.value.songKey)
    }
    djMode.value = djModeEngine.getState()
  }

  function activateDjMode(songKey: string): void {
    djModeEngine.activate(songKey)
    djMode.value = djModeEngine.getState()
  }

  function deactivateDjMode(): void {
    djModeEngine.deactivate()
    djMode.value = djModeEngine.getState()
  }

  async function loadRecommendRadios(force = false): Promise<void> {
    if (loadingRecommend.value) return
    if (recommendRadios.value.length > 0 && !force) return

    loadingRecommend.value = true
    try {
      const radios = await podcastManager.getRecommendRadios()
      recommendRadios.value = radios
    } finally {
      loadingRecommend.value = false
    }
  }

  async function loadSubscribedRadios(
    limit = 30,
    offset = 0,
    force = false
  ): Promise<void> {
    if (loadingSubscribed.value) return

    loadingSubscribed.value = true
    try {
      const result: SubscribedRadioList = await podcastManager.getSubscribedRadios(
        limit,
        offset
      )
      if (offset === 0) {
        subscribedRadios.value = result.radios
      } else {
        subscribedRadios.value = [...subscribedRadios.value, ...result.radios]
      }
      subscribedCount.value = result.count
      subscribedHasMore.value = result.hasMore
    } finally {
      loadingSubscribed.value = false
    }
  }

  async function loadRadioPrograms(
    rid: string,
    limit = 30,
    offset = 0
  ): Promise<void> {
    if (loadingPrograms.value) return

    loadingPrograms.value = true
    try {
      const result: ProgramListResult = await podcastManager.getRadioPrograms(
        rid,
        limit,
        offset
      )
      if (offset === 0) {
        programList.value = result.programs
      } else {
        programList.value = [...programList.value, ...result.programs]
      }
      programListCount.value = result.count
      programListHasMore.value = result.hasMore
    } finally {
      loadingPrograms.value = false
    }
  }

  async function loadProgramDetail(id: string): Promise<DjProgram | null> {
    const detail = await podcastManager.getProgramDetail(id)
    if (detail) {
      currentProgram.value = detail
    }
    return detail
  }

  async function loadCategories(force = false): Promise<void> {
    if (loadingCategories.value) return
    if (categories.value.length > 0 && !force) return

    loadingCategories.value = true
    try {
      const result = await podcastManager.getCategories()
      categories.value = result.categories
    } finally {
      loadingCategories.value = false
    }
  }

  async function loadToplist(
    type: DjToplistType = 'hot',
    limit = 100
  ): Promise<void> {
    if (loadingToplist.value) return

    loadingToplist.value = true
    try {
      const result = await podcastManager.getToplist(type, limit)
      toplist.value = result
    } finally {
      loadingToplist.value = false
    }
  }

  async function searchPodcasts(
    keywords: string,
    limit = 30,
    offset = 0
  ): Promise<void> {
    if (!keywords.trim()) {
      searchResult.value = { programs: [], radios: [], total: 0, more: false }
      return
    }

    loadingSearch.value = true
    try {
      const result = await podcastManager.searchPodcasts(keywords, limit, offset)
      if (offset === 0) {
        searchResult.value = result
      } else {
        searchResult.value = {
          programs: [...searchResult.value.programs, ...result.programs],
          radios: [...searchResult.value.radios, ...result.radios],
          total: result.total,
          more: result.more,
        }
      }
    } finally {
      loadingSearch.value = false
    }
  }

  function clearSearch(): void {
    searchResult.value = { programs: [], radios: [], total: 0, more: false }
  }

  function setCurrentRadio(radio: DjRadio | null): void {
    currentRadio.value = radio
    if (radio) {
      loadRadioPrograms(radio.id)
    } else {
      programList.value = []
      programListCount.value = 0
      programListHasMore.value = false
    }
  }

  function setCurrentProgram(program: DjProgram | null): void {
    currentProgram.value = program
  }

  function addToPlayHistory(
    program: DjProgram,
    radio?: DjRadio,
    progress = 0,
    duration = 0
  ): void {
    podcastManager.addToHistory(program, radio, progress, duration)
    playHistory.value = podcastManager.getPlayHistory()
  }

  function updatePlayProgress(programId: string, progress: number): void {
    podcastManager.updateProgress(programId, progress)
  }

  function clearPlayHistory(): void {
    podcastManager.clearHistory()
    playHistory.value = []
  }

  async function analyzeCurrentProgram(
    audioUrl: string,
    durationSec: number
  ): Promise<boolean> {
    if (!currentProgram.value) return false

    analyzing.value = true
    try {
      const songKey = `dj:${currentProgram.value.id}`
      const result = await djModeEngine.analyzeSong(
        audioUrl,
        songKey,
        durationSec,
        durationSec > 7200 ? { mode: 'range' } : { mode: 'full' }
      )
      if (result) {
        activateDjMode(songKey)
        return true
      }
      return false
    } finally {
      analyzing.value = false
    }
  }

  function getBeatMap() {
    return djModeEngine.getBeatMap()
  }

  function clearBeatMap(): void {
    djModeEngine.clearBeatMap()
  }

  function resetState(): void {
    currentRadio.value = null
    currentProgram.value = null
    programList.value = []
    programListCount.value = 0
    programListHasMore.value = false
    clearSearch()
    clearBeatMap()
    deactivateDjMode()
  }

  return {
    djMode,
    djConfig,
    recommendRadios,
    subscribedRadios,
    subscribedCount,
    subscribedHasMore,
    currentRadio,
    currentProgram,
    programList,
    programListCount,
    programListHasMore,
    categories,
    toplist,
    searchResult,
    playHistory,
    loadingRecommend,
    loadingSubscribed,
    loadingPrograms,
    loadingCategories,
    loadingToplist,
    loadingSearch,
    analyzing,
    isDjModeActive,
    visualMultiplier,
    cameraShakeIntensity,
    particleBoost,
    updateDjConfig,
    toggleDjMode,
    activateDjMode,
    deactivateDjMode,
    loadRecommendRadios,
    loadSubscribedRadios,
    loadRadioPrograms,
    loadProgramDetail,
    loadCategories,
    loadToplist,
    searchPodcasts,
    clearSearch,
    setCurrentRadio,
    setCurrentProgram,
    addToPlayHistory,
    updatePlayProgress,
    clearPlayHistory,
    analyzeCurrentProgram,
    getBeatMap,
    clearBeatMap,
    resetState,
  }
})
