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

export interface ArtistDetail extends Artist {
  briefDesc?: string
  description?: string
  fansCount?: number
  songCount?: number
  albumCount?: number
  mvCount?: number
  followed?: boolean
  followedCount?: number
}

export interface ArtistSong extends Song {
  rank?: number
  playCount?: number
}

export interface Album {
  id: string
  name: string
  coverUrl?: string
}

export interface AlbumDetail extends Album {
  artists?: Artist[]
  publishTime?: number
  genre?: string
  description?: string
  songCount?: number
  playCount?: number
  subscribed?: boolean
  subCount?: number
  tracks?: Song[]
}

export interface CommentUser {
  id: string
  nickname: string
  avatarUrl?: string
  vipType?: number
  vipLevel?: string
  isSvip?: boolean
}

export interface Comment {
  id: string
  content: string
  user: CommentUser
  time: number
  timeStr?: string
  likedCount?: number
  liked?: boolean
  replyCount?: number
  isHot?: boolean
}

export interface CommentList {
  total: number
  hasMore: boolean
  comments: Comment[]
  hotComments?: Comment[]
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

export type MusicSource = 'netease' | 'qqmusic' | 'kugou' | 'local'

export interface LocalMusicConfig {
  directories: string[]
  extensions: string[]
}

export interface LocalSongMetadata {
  title: string
  artist: string
  album: string
  duration: number
  year?: string
  track?: number
  genre?: string
  coverData?: string
}

export interface LocalScanResult {
  songs: Song[]
  total: number
  scanned: number
  failed: number
}

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
  | 'aurora'
  | 'starry'
  | 'ocean'
  | 'flame'
  | 'matrix'
  | 'geometry'
  | 'particleFlow'
  | 'podcast'
  | 'dj'
  | 'wallpaper'

export type PresetCategory = 'basic' | 'cool' | 'minimal'

export interface PresetInfo {
  id: VisualPreset
  name: string
  icon: string
  category: PresetCategory
  description: string
}

export type SpectrumMode = 'bars' | 'waveform' | 'circular'

export type CinemaMode = 'static' | 'breathing' | 'cinema' | 'dynamic'

export type ShelfMode = 'off' | 'sidebar' | 'stage'
export type ShelfCameraMode = 'dynamic' | 'static'
export type ShelfPresence = 'auto' | 'always'

export interface UserFxArchive {
  name: string
  snapshot: Partial<FxSettings>
  savedAt: number
}

export interface FxSettings {
  preset: VisualPreset
  particleResolution: number
  particleSize: number
  particleColorMode: 'mono' | 'colorful' | 'gradient'
  cinemaIntensity: number
  cinemaMode: CinemaMode
  lyricGlow: number
  accentColor: string
  glowColor: string
  bgColor: string
  brightness: number
  contrast: number
  visualIntensity: number
  beatResponseStrength: number
  particleMotionSpeed: number
  autoSwitchPreset: boolean
  visualWithSong: boolean
  shelfMode: ShelfMode
  shelfCameraMode: ShelfCameraMode
  shelfPresence: ShelfPresence
  shelfShowPodcasts: boolean
  shelfMergeCollections: boolean
  shelfSize: number
  shelfOffsetX: number
  shelfOffsetY: number
  shelfOffsetZ: number
  shelfAngleY: number
  shelfOpacity: number
  shelfBgOpacity: number
  shelfAccentColor: string
  shelfSoundEnabled: boolean
  liveBackgroundKeep: boolean
  performanceBackground: 'auto' | 'keep' | 'release'
  performanceQuality: 'eco' | 'balanced' | 'high' | 'ultra'
  workerwEnabled: boolean
  workerwWallpaperMode: boolean
  workerwOpacity: number
  workerwVisualIntensity: number
  spectrumEnabled: boolean
  spectrumMode: SpectrumMode
  spectrumPosition: 'playerbar' | 'stage' | 'hidden'
  glassEffect: boolean
  glassOpacity: number
  glassBlur: number
  consoleTint: number
  consoleOpacity: number
  coverColorEnabled: boolean
  onboardingCompleted: boolean
  layoutMode: LayoutMode
  homeWallpaperEnabled?: boolean
  homeWallpaperPreset?: VisualPreset
  controlsAutoHide: boolean
  controlsHideDelay: number
  userCapsuleAutoHide: boolean
  fxFabAutoHide: boolean
  queuePinned: boolean
  freeCameraEnabled: boolean

  // === 以下字段从老项目 fxDefaults 补齐 ===

  // 主控参数
  intensity: number
  cinemaShake: number
  depth: number
  coverResolution: number

  // 粒子参数
  point: number
  speed: number
  twist: number
  color: number
  scatter: number
  bgFade: number
  bloomStrength: number

  // 歌词外观
  lyricGlowStrength: number
  lyricScale: number
  lyricOffsetX: number
  lyricOffsetY: number
  lyricOffsetZ: number
  lyricTiltX: number
  lyricTiltY: number
  lyricColorMode: 'auto' | 'manual'
  lyricColor: string
  lyricHighlightMode: 'auto' | 'follow' | 'manual'
  lyricHighlightColor: string
  lyricGlowLinked: boolean
  lyricGlowColor: string
  lyricFont: string
  lyricLetterSpacing: number
  lyricLineHeight: number
  lyricWeight: number
  lyricCameraLock: boolean

  // 视觉色调
  visualTintMode: 'auto' | 'manual'
  visualTintColor: string

  // UI 颜色
  uiAccentColor: string
  homeAccentColor: string
  homeIconColor: string
  visualIconColor: string

  // 背景
  backgroundColorMode: 'cover' | 'custom' | 'black'
  backgroundColor: string
  backgroundOpacity: number
  controlGlassChromaticOffset: number
  backgroundColorCustom: boolean
  backgroundImage: string
  backgroundMedia: string | null

  // 叠加效果开关
  floatLayer: boolean
  cinema: boolean
  edge: boolean
  aiDepth: boolean
  bloom: boolean
  lyricGlowEnabled: boolean
  lyricGlowBeat: boolean
  lyricGlowParticles: boolean
  particleLyrics: boolean
  backCover: boolean

  // 桌面歌词
  desktopLyrics: boolean
  desktopLyricsSize: number
  desktopLyricsOpacity: number
  desktopLyricsY: number
  desktopLyricsClickThrough: boolean
  desktopLyricsCinema: boolean
  desktopLyricsHighlight: boolean
  desktopLyricsFps: number

  // 壁纸模式
  wallpaperMode: boolean
  wallpaperOpacity: number

  // 摄像头/手势
  cam: 'off' | 'gesture'

  // 歌单架
  shelfAngleYManual: boolean

  // 用户存档槽位
  userFxArchives: UserFxArchive[]
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

export type LayoutMode = 'simple' | 'diy'

export interface TopListItem {
  id: string
  name: string
  coverUrl?: string
  description?: string
  playCount?: number
  updateTime?: number
  trackCount?: number
  tracks?: Song[]
  source: string
  ToplistType?: string
  updateFrequency?: string
}

export interface TopListDetail {
  id: string
  name: string
  coverUrl?: string
  description?: string
  playCount?: number
  updateTime?: number
  trackCount: number
  tracks: TopListSong[]
  source: string
}

export interface TopListSong extends Song {
  rank?: number
  lastRank?: number
  changeType?: 'up' | 'down' | 'same' | 'new'
  changeValue?: number
}

export interface SearchSuggestItem {
  keyword: string
  type: 'song' | 'artist' | 'album' | 'playlist'
  id?: string
  name?: string
  artist?: string
  coverUrl?: string
}

export interface SearchSuggestResult {
  songs: SearchSuggestItem[]
  artists: SearchSuggestItem[]
  albums: SearchSuggestItem[]
  playlists: SearchSuggestItem[]
}

export interface HotSearchItem {
  rank: number
  keyword: string
  hotValue?: number
  iconType?: number
  isHot?: boolean
  isNew?: boolean
}

export interface HotSearchResult {
  hots: HotSearchItem[]
  time?: number
}

export interface FMSong extends Song {
  fmId?: string
  liked?: boolean
}

export interface FMState {
  isFMMode: boolean
  currentSong: FMSong | null
  queue: FMSong[]
  history: FMSong[]
  loading: boolean
}

export interface DailyRecommendSong extends Song {
  reason?: string
  alg?: string
}

export interface DailyRecommend {
  date: string
  songs: DailyRecommendSong[]
  recommendReason?: string
}

export type ThemeMode = 'dark' | 'light' | 'system'

export type Language = 'zh-CN' | 'en-US'

export interface NotificationSettings {
  enabled: boolean
  trackChange: boolean
  downloadComplete: boolean
  updateAvailable: boolean
  sourceFallback?: boolean
}

export interface MV {
  id: string
  name: string
  coverUrl?: string
  playCount?: number
  artistName?: string
  artistId?: string
  duration?: number
}

export interface SongDetail extends Song {
  album?: AlbumDetail
  description?: string
  size?: number
  bitrate?: number
  publishTime?: number
}
