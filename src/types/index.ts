export interface Song {
  id: string
  name: string
  artists: Artist[]
  album?: Album
  duration: number
  source: string
  url?: string
  quality?: QualityLevel
  coverUrl?: string
  isPodcast?: boolean
  djProgramId?: string
}

export interface Artist {
  id: string
  name: string
  avatar?: string
}

export interface Album {
  id: string
  name: string
  coverUrl?: string
}

export interface Playlist {
  id: string
  name: string
  coverUrl?: string
  description?: string
  tracks: Song[]
  trackCount: number
  playCount?: number
  creator?: UserProfile
  source: string
}

export interface LyricLine {
  time: number
  text: string
  translation?: string
}

export interface LyricData {
  lines: LyricLine[]
  hasTranslation: boolean
  offset: number
}

export type QualityLevel = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires'

export interface UserProfile {
  id: string
  nickname: string
  avatarUrl?: string
  signature?: string
  vipType?: number
  vipLevel?: string
  isSvip?: boolean
}

export type MusicSource = 'netease' | 'qqmusic'

export interface UserAccount {
  source: MusicSource
  profile: UserProfile | null
  loggedIn: boolean
  cookie?: string
}

export interface LoginQrCode {
  qrKey: string
  qrUrl: string
  qrImg?: string
}

export type QrLoginStatus = 'waiting' | 'scanned' | 'success' | 'expired' | 'error'

export interface LoginState {
  activeTab: MusicSource
  qrCode: LoginQrCode | null
  qrStatus: QrLoginStatus
  loading: boolean
  errorMessage: string | null
}

export interface UserPlaylist {
  id: string
  name: string
  coverUrl?: string
  trackCount: number
  playCount?: number
  source: MusicSource
  isFavorite?: boolean
  isOwned?: boolean
}

export interface SearchResult {
  songs: Song[]
  total: number
  more: boolean
}

export type VisualPreset = 
  | 'emily' 
  | 'skull' 
  | 'galaxy' 
  | 'vinyl' 
  | 'planet' 
  | 'cylinder' 
  | 'void'

export interface FxSettings {
  preset: VisualPreset
  particleResolution: number
  cinemaIntensity: number
  lyricGlow: number
  accentColor: string
  glowColor: string
  shelfShowPodcasts: boolean
  shelfMergeCollections: boolean
  liveBackgroundKeep: boolean
  performanceBackground: 'auto' | 'keep' | 'release'
  performanceQuality: 'eco' | 'balanced' | 'high' | 'ultra'
}

export interface BeatAnalysisResult {
  bpm: number
  confidence: number
  energy: number
  lowFrequency: number
  midFrequency: number
  highFrequency: number
  beatTimes: number[]
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

export interface PlayerState {
  currentSong: Song | null
  playlist: Song[]
  playlistIndex: number
  status: PlayerStatus
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  playMode: 'sequence' | 'loop' | 'single' | 'shuffle'
  speed: number
}

export type PerformanceQuality = 'eco' | 'balanced' | 'high' | 'ultra'

export type PerformanceBackgroundMode = 'auto' | 'keep' | 'release'
