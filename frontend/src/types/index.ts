/**
 * Mineradio-Next 核心类型定义
 * 从 legacy/public/index.html 的 JS 逻辑中提取
 */

// ── 歌曲相关 ──────────────────────────────────────────────────

/** 音乐来源平台 */
export type MusicSource = 'netease' | 'qq' | 'local'

/** 歌曲信息 */
export interface Song {
  id: string
  name: string
  artist: string
  artistId?: string
  album?: string
  albumId?: string
  cover?: string
  duration: number // 毫秒
  source: MusicSource
  url?: string
  quality?: SongQuality
  /** 播客特有字段 */
  podcastId?: string
  podcastName?: string
  /** 本地文件路径 */
  localPath?: string
  /** 额外元数据 */
  meta?: Record<string, unknown>
}

/** 音质等级 */
export type SongQuality = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires'

// ── 歌单相关 ──────────────────────────────────────────────────

/** 歌单信息 */
export interface Playlist {
  id: string
  name: string
  cover?: string
  description?: string
  trackCount: number
  creator?: string
  creatorId?: string
  source: MusicSource
  /** 是否为用户自建歌单 */
  isUserCreated?: boolean
  /** 歌单内歌曲（延迟加载时为 undefined） */
  tracks?: Song[]
}

// ── 歌词相关 ──────────────────────────────────────────────────

/** 单行歌词 */
export interface LyricLine {
  /** 开始时间（毫秒） */
  time: number
  /** 歌词文本 */
  text: string
  /** 翻译文本 */
  translation?: string
  /** 逐字时间轴（卡拉OK） */
  wordTimes?: number[]
  /** 是否纯音乐标记 */
  isInstrumental?: boolean
}

/** 歌词数据 */
export interface LyricData {
  lines: LyricLine[]
  hasKaraoke: boolean
  timingSource: 'native' | 'lrc' | 'none'
  /** 原始 LRC 文本 */
  rawLrc?: string
}

// ── 搜索相关 ──────────────────────────────────────────────────

/** 搜索模式 */
export type SearchMode = 'song' | 'playlist' | 'artist' | 'podcast'

/** 搜索结果 */
export interface SearchResults {
  songs: Song[]
  playlists: Playlist[]
  artists: ArtistInfo[]
  podcasts: PodcastInfo[]
}

/** 歌手信息 */
export interface ArtistInfo {
  id: string
  name: string
  cover?: string
  description?: string
  songCount?: number
  albumCount?: number
  mvCount?: number
  source: MusicSource
}

/** 播客信息 */
export interface PodcastInfo {
  id: string
  name: string
  cover?: string
  description?: string
  programCount?: number
  source: MusicSource
}

// ── 账号相关 ──────────────────────────────────────────────────

/** 登录状态 */
export interface LoginStatus {
  loggedIn: boolean
  vipType: number
  vipLevel: string
  isVip: boolean
  isSvip: boolean
  vipLabel: string
  nickname?: string
  userId?: string
  avatar?: string
}

/** QQ 登录状态 */
export interface QQLoginStatus {
  provider: 'qq'
  loggedIn: boolean
  preview: boolean
  nickname: string
  userId: string
  avatar: string
  vipType: number
}

// ── 视觉相关 ──────────────────────────────────────────────────

/** 视觉预设 */
export interface VisualPreset {
  id: number
  name: string
  description: string
  /** 预设参数快照 */
  params: VisualParams
}

/** 视觉参数 */
export interface VisualParams {
  /** 粒子密度 */
  particleDensity?: number
  /** 粒子大小 */
  particleSize?: number
  /** 颜色色调 */
  colorTint?: string
  /** 背景模糊 */
  bgBlur?: number
  /** 背景亮度 */
  bgBrightness?: number
  /** 歌词颜色 */
  lyricColor?: string
  /** 地形高度 */
  terrainHeight?: number
  /** 地形细节 */
  terrainDetail?: number
  /** 其他自由参数 */
  [key: string]: number | string | boolean | undefined
}

/** 背景模式 */
export type BackgroundMode = 'album' | 'video' | 'image' | 'flat'

// ── 播放相关 ──────────────────────────────────────────────────

/** 播放模式 */
export type PlayMode = 'loop' | 'shuffle' | 'single'

/** 播放状态 */
export interface PlayerState {
  playing: boolean
  currentIdx: number
  currentTime: number // 秒
  duration: number // 秒
  volume: number // 0-1
  muted: boolean
  playMode: PlayMode
  quality: SongQuality
}

// ── 桌面窗口相关 ──────────────────────────────────────────────

/** 窗口状态 */
export interface WindowState {
  isMaximized: boolean
  isMinimized: boolean
  isFullscreen: boolean
  isFullScreen: boolean
  isNativeFullScreen: boolean
  width: number
  height: number
  x: number
  y: number
  focused: boolean
}

/** 桌面窗口接口（对应 tauri-adapter.js 的 window.desktopWindow） */
export interface DesktopWindow {
  isDesktop: boolean
  minimize: () => Promise<unknown>
  toggleMaximize: () => Promise<unknown>
  toggleFullscreen: () => Promise<unknown>
  exitFullscreenWindowed: () => Promise<unknown>
  getState: () => Promise<WindowState>
  close: () => Promise<unknown>
  openNeteaseMusicLogin: () => Promise<LoginResult>
  clearNeteaseMusicLogin: () => Promise<unknown>
  openQQMusicLogin: () => Promise<LoginResult>
  clearQQMusicLogin: () => Promise<unknown>
  openUpdateInstaller: (filePath: string) => Promise<unknown>
  restartApp: () => Promise<unknown>
  configureGlobalHotkeys: (bindings: HotkeyBinding[]) => Promise<unknown>
  onGlobalHotkey: (callback: (payload: { action: string }) => void) => () => void
  exportJsonFile: (payload: unknown) => Promise<unknown>
  importJsonFile: () => Promise<unknown>
  setDesktopLyricsEnabled: (enabled: boolean, payload?: unknown) => Promise<unknown>
  updateDesktopLyrics: (payload: unknown) => Promise<unknown>
  onDesktopLyricsLockState: (callback: (payload: unknown) => void) => () => void
  onDesktopLyricsEnabledState: (callback: (payload: unknown) => void) => () => void
  setWallpaperMode: (enabled: boolean, payload?: unknown) => Promise<unknown>
  updateWallpaperMode: (payload: unknown) => Promise<unknown>
  onStateChange: (callback: (state: WindowState) => void) => () => void
}

/** 登录结果 */
export interface LoginResult {
  ok: boolean
  cookie?: string
  error?: string
}

/** 快捷键绑定 */
export interface HotkeyBinding {
  accelerator: string
  action: string
}

// ── 更新相关 ──────────────────────────────────────────────────

/** 更新信息 */
export interface UpdateInfo {
  version: string
  releaseNotes?: string
  downloadUrl?: string
  hasUpdate: boolean
}

// ── 评论相关 ──────────────────────────────────────────────────

/** 评论 */
export interface Comment {
  id: string
  content: string
  user: {
    nickname: string
    avatar?: string
  }
  time: number
  likedCount: number
}

// ── 全局声明 ──────────────────────────────────────────────────

declare global {
  interface Window {
    desktopWindow?: DesktopWindow
  }
}
