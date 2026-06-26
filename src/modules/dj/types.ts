export interface DjRadio {
  id: string
  name: string
  picUrl?: string
  desc?: string
  subCount?: number
  programCount?: number
  categoryId?: number
  category?: string
  secondCategoryId?: number
  secondCategory?: string
  rcmdtext?: string
  dj?: DjProfile
  playCount?: number
  score?: number
  lastProgramName?: string
  lastProgramId?: string
  lastProgramCreateTime?: number
  subed?: boolean
  feeScope?: number
  finish?: boolean
  underShelf?: boolean
  buyed?: boolean
}

export interface DjProfile {
  userId: string
  nickname: string
  avatarUrl?: string
  signature?: string
  gender?: number
  userType?: number
  followed?: boolean
  vipType?: number
}

export interface DjProgram {
  id: string
  name: string
  description?: string
  coverUrl?: string
  dj?: DjProfile
  radio?: DjRadio
  duration: number
  playCount?: number
  commentCount?: number
  likeCount?: number
  shareCount?: number
  subscribeCount?: number
  createTime?: number
  pubStatus?: number
  mainSong?: {
    id: string
    name: string
    duration: number
    artists?: { id: string; name: string }[]
  }
  songs?: Array<{
    id: string
    name: string
    duration: number
    artists?: { id: string; name: string }[]
  }>
  audioUrl?: string
  isPublish?: boolean
  serialNum?: number
}

export interface DjCategory {
  id: number
  name: string
  picUrl?: string
  radioCategory?: number
}

export interface DjTopListEntry {
  program: DjProgram
  rank: number
  score?: number
  lastRank?: number
  rate?: number
}

export interface DjToplist {
  id: string
  name: string
  coverUrl?: string
  updateTime?: number
  tracks: DjTopListEntry[]
  top3?: DjTopListEntry[]
  totalRank?: number
  subTitle?: string
  description?: string
  playCount?: number
  subscribedCount?: number
  commentCount?: number
}

export interface PodcastRecommendItem {
  id: string
  name: string
  picUrl?: string
  desc?: string
  playCount?: number
  programCount?: number
  source?: string
  type?: 'radio' | 'program' | 'category'
}

export interface PlayHistoryItem {
  id: string
  program: DjProgram
  radio?: DjRadio
  playedAt: number
  progress: number
  duration: number
}

export interface DjModeState {
  active: boolean
  songKey: string
  startedAt: number
  tempoGap: number
  tempoConfidence: number
  sectionEnergy: number
  sectionLow: number
  sectionChange: number
  visualPulse: number
  lastBeatAt: number
  lastNoticeAt: number
}

export interface DjModeConfig {
  enabled: boolean
  intensity: number
  autoTransition: boolean
  transitionDuration: number
  visualBoost: number
  cameraShake: boolean
  particleBoost: boolean
}

export interface PodcastSearchResult {
  programs: DjProgram[]
  radios: DjRadio[]
  total: number
  more: boolean
}

export interface SubscribedRadioList {
  count: number
  hasMore: boolean
  radios: DjRadio[]
}

export interface ProgramListResult {
  count: number
  hasMore: boolean
  programs: DjProgram[]
}

export interface DjCategoryList {
  categories: DjCategory[]
  secondCategories?: DjCategory[]
}

export type DjToplistType = 'hot' | 'new' | 'rising'

export interface DjAnalysisOptions {
  mode: 'intro' | 'full' | 'range'
  introSec?: number
  sampleCount?: number
  sampleWindowSec?: number
}
