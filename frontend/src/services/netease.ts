/**
 * 网易云音乐服务
 * 封装所有网易云相关的 Tauri IPC 调用
 * 对应 legacy/src-tauri/src/server/routes/ 中的网易云相关路由
 *
 * 注意：这些命令需要在 Rust 后端 Task 4 中实现对应的 #[tauri::command]
 * 目前部分命令可能尚未实现，调用会报错
 */
import { tauriInvoke, tauriInvokeSafe } from './api'
import type { Song, Playlist, LyricData, SearchResults, ArtistInfo, Comment, LoginStatus } from '@/types'

export const netease = {
  // ── 搜索 ────────────────────────────────────────────────

  /** 搜索歌曲/歌单/歌手/播客 */
  search: (params: { keywords: string; type: number; offset?: number; limit?: number }) =>
    tauriInvokeSafe<SearchResults>('netease_search', params),

  // ── 歌曲 ────────────────────────────────────────────────

  /** 获取歌曲播放 URL */
  getSongUrl: (params: { id: string; quality?: string }) =>
    tauriInvokeSafe<{ url: string; quality: string }>('netease_song_url', params),

  // ── 歌词 ────────────────────────────────────────────────

  /** 获取歌词 */
  getLyric: (params: { id: string }) =>
    tauriInvokeSafe<LyricData>('netease_lyric', params),

  // ── 歌单 ────────────────────────────────────────────────

  /** 获取用户歌单列表 */
  getUserPlaylists: (params?: { uid?: string }) =>
    tauriInvokeSafe<Playlist[]>('netease_user_playlists', params || {}),

  /** 获取歌单内歌曲列表 */
  getPlaylistTracks: (params: { id: string; offset?: number; limit?: number }) =>
    tauriInvokeSafe<Song[]>('netease_playlist_tracks', params),

  /** 创建歌单 */
  createPlaylist: (params: { name: string }) =>
    tauriInvokeSafe<Playlist>('netease_playlist_create', params),

  /** 添加歌曲到歌单 */
  addSongToPlaylist: (params: { playlistId: string; songIds: string[] }) =>
    tauriInvokeSafe<boolean>('netease_playlist_add_song', params),

  // ── 红心 ────────────────────────────────────────────────

  /** 红心/取消红心歌曲 */
  likeSong: (params: { id: string; like: boolean }) =>
    tauriInvokeSafe<boolean>('netease_song_like', params),

  /** 检查歌曲是否已红心 */
  checkLike: (params: { id: string }) =>
    tauriInvokeSafe<boolean>('netease_song_like_check', params),

  // ── 歌手 ────────────────────────────────────────────────

  /** 获取歌手详情 */
  getArtistDetail: (params: { id: string }) =>
    tauriInvokeSafe<ArtistInfo>('netease_artist_detail', params),

  // ── 评论 ────────────────────────────────────────────────

  /** 获取歌曲评论 */
  getComments: (params: { id: string; offset?: number; limit?: number }) =>
    tauriInvokeSafe<Comment[]>('netease_song_comments', params),

  // ── 播客 ────────────────────────────────────────────────

  /** 搜索播客 */
  searchPodcast: (params: { keywords: string; offset?: number; limit?: number }) =>
    tauriInvokeSafe<unknown>('netease_podcast_search', params),

  /** 获取热门播客 */
  getHotPodcasts: (params?: { limit?: number }) =>
    tauriInvokeSafe<unknown>('netease_podcast_hot', params || {}),

  /** 获取播客详情 */
  getPodcastDetail: (params: { id: string }) =>
    tauriInvokeSafe<unknown>('netease_podcast_detail', params),

  /** 获取播客节目列表 */
  getPodcastPrograms: (params: { id: string; offset?: number; limit?: number }) =>
    tauriInvokeSafe<unknown>('netease_podcast_programs', params),

  /** 获取我的播客 */
  getMyPodcasts: () =>
    tauriInvokeSafe<unknown>('netease_podcast_my', {}),

  // ── 发现页 ──────────────────────────────────────────────

  /** 获取发现页推荐内容 */
  getDiscoverHome: () =>
    tauriInvokeSafe<unknown>('netease_discover_home', {}),

  // ── 登录状态 ────────────────────────────────────────────

  /** 获取登录状态 */
  getLoginStatus: () =>
    tauriInvokeSafe<LoginStatus>('netease_login_status', {}),

  /** 登出 */
  logout: () =>
    tauriInvokeSafe<boolean>('netease_logout', {}),

  // ── 更新 ────────────────────────────────────────────────

  /** 检查最新版本 */
  getLatestUpdate: () =>
    tauriInvokeSafe<unknown>('update_latest', {}),
}
