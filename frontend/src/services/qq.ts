/**
 * QQ 音乐服务
 * 封装所有 QQ 音乐相关的 Tauri IPC 调用
 * 对应 legacy/src-tauri/src/server/routes/qq.rs
 *
 * 注意：这些命令需要在 Rust 后端 Task 4 中实现对应的 #[tauri::command]
 */
import { tauriInvokeSafe } from './api'
import type { Song, Playlist, LyricData, ArtistInfo, Comment, QQLoginStatus } from '@/types'

export const qq = {
  // ── 搜索 ────────────────────────────────────────────────

  /** 搜索歌曲 */
  search: (params: { keywords: string; type?: number; offset?: number; limit?: number }) =>
    tauriInvokeSafe<unknown>('qq_search', params),

  // ── 歌曲 ────────────────────────────────────────────────

  /** 获取歌曲播放 URL */
  getSongUrl: (params: { id: string; quality?: string }) =>
    tauriInvokeSafe<{ url: string; quality: string }>('qq_song_url', params),

  // ── 歌词 ────────────────────────────────────────────────

  /** 获取歌词 */
  getLyric: (params: { id: string }) =>
    tauriInvokeSafe<LyricData>('qq_lyric', params),

  // ── 歌手 ────────────────────────────────────────────────

  /** 获取歌手详情 */
  getArtistDetail: (params: { id: string }) =>
    tauriInvokeSafe<ArtistInfo>('qq_artist_detail', params),

  // ── 歌单 ────────────────────────────────────────────────

  /** 获取歌单内歌曲 */
  getPlaylistTracks: (params: { id: string; offset?: number; limit?: number }) =>
    tauriInvokeSafe<Song[]>('qq_playlist_tracks', params),

  // ── 评论 ────────────────────────────────────────────────

  /** 获取歌曲评论 */
  getComments: (params: { id: string; offset?: number; limit?: number }) =>
    tauriInvokeSafe<Comment[]>('qq_song_comments', params),

  // ── 登录 ────────────────────────────────────────────────

  /** 获取 QQ 登录状态 */
  getLoginStatus: () =>
    tauriInvokeSafe<QQLoginStatus>('qq_login_status', {}),

  /** QQ 登出 */
  logout: () =>
    tauriInvokeSafe<boolean>('qq_logout', {}),

  /** 获取 QQ 用户歌单 */
  getUserPlaylists: () =>
    tauriInvokeSafe<Playlist[]>('qq_user_playlists', {}),
}
