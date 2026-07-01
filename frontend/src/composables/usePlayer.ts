/**
 * 播放控制 composable
 * 桥接 useAudio（底层音频引擎）和 playerStore（状态管理）
 * 提供业务层播放/切歌/进度等高层操作
 */
import { watch, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useAudio } from './useAudio'
import { netease } from '@/services/netease'
import { qq } from '@/services/qq'
import type { Song } from '@/types'

// 模块级单例，避免多个组件各自创建 AudioContext
const audio = useAudio()

export function usePlayer() {
  const player = usePlayerStore()

  // 同步音频引擎状态到 store
  watch(audio.currentTime, (t) => player.setCurrentTime(t))
  watch(audio.duration, (d) => player.setDuration(d))
  watch(audio.playing, (p) => player.setPlaying(p))

  // 播放结束时自动切歌
  const unwatchEnded = audio.onEnded(() => {
    handleNext()
  })

  /**
   * 播放指定歌曲
   */
  async function playSong(song: Song, playlist?: Song[]) {
    // 如果传入了播放列表，设置到 store
    if (playlist) {
      player.setPlaylist(playlist)
      const idx = playlist.findIndex(s => s.id === song.id && s.source === song.source)
      player.setCurrentIdx(idx >= 0 ? idx : 0)
    }

    // 获取歌曲 URL
    let url = song.url
    if (!url) {
      try {
        if (song.source === 'qq') {
          const result = await qq.getSongUrl({ id: song.id, quality: player.quality })
          url = result?.url || ''
        } else {
          const result = await netease.getSongUrl({ id: song.id, quality: player.quality })
          url = result?.url || ''
        }
      } catch (e) {
        console.error('[usePlayer] getSongUrl failed:', e)
        return
      }
    }

    if (!url) {
      console.warn('[usePlayer] No URL for song:', song.name)
      return
    }

    // 加载并播放
    audio.initAudio()
    audio.loadUrl(url)
    audio.setVolume(player.volume)
    await audio.play()
  }

  /**
   * 切换播放/暂停
   */
  async function togglePlay() {
    if (!audio.ready.value) {
      // 没有初始化过音频，如果有当前歌曲就播放它
      if (player.currentSong) {
        await playSong(player.currentSong)
      }
      return
    }
    if (player.playing) {
      audio.pause()
    } else {
      await audio.play()
    }
  }

  /**
   * 下一首
   */
  function handleNext() {
    if (player.playMode === 'shuffle' && player.playlist.length > 1) {
      let next: number
      do {
        next = Math.floor(Math.random() * player.playlist.length)
      } while (next === player.currentIdx)
      player.setCurrentIdx(next)
    } else if (player.currentIdx < player.playlist.length - 1) {
      player.setCurrentIdx(player.currentIdx + 1)
    } else if (player.playMode === 'loop' && player.playlist.length > 0) {
      player.setCurrentIdx(0)
    } else {
      // 单曲循环或列表结束
      audio.seek(0)
      audio.play()
      return
    }

    // 播放新歌曲
    const song = player.currentSong
    if (song) playSong(song)
  }

  /**
   * 上一首
   */
  function handlePrev() {
    if (player.currentIdx > 0) {
      player.setCurrentIdx(player.currentIdx - 1)
    } else if (player.playMode === 'loop' && player.playlist.length > 0) {
      player.setCurrentIdx(player.playlist.length - 1)
    }

    const song = player.currentSong
    if (song) playSong(song)
  }

  /**
   * Seek 到指定时间
   */
  function seekTo(time: number) {
    audio.seek(time)
  }

  /**
   * 设置音量
   */
  function setVolume(v: number) {
    audio.setVolume(v)
    player.setVolume(v)
  }

  /**
   * 添加歌曲到播放队列
   */
  function addToQueue(song: Song) {
    player.addToQueue(song)
  }

  onUnmounted(() => {
    unwatchEnded()
  })

  return {
    audio,
    player,
    playSong,
    togglePlay,
    handleNext,
    handlePrev,
    seekTo,
    setVolume,
    addToQueue,
  }
}
