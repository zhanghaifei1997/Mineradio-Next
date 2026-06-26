import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song } from '@/types'

const STORAGE_KEY = 'mineradio_stats'

export interface PlayRecord {
  songId: string
  songName: string
  artistName: string
  artistId?: string
  albumName?: string
  source: string
  duration: number
  playedAt: number
  completed: boolean
}

export interface DailyStats {
  date: string
  playCount: number
  totalDuration: number
  songs: Map<string, number>
}

export interface ArtistStats {
  id: string
  name: string
  playCount: number
  totalDuration: number
}

export interface SongStats {
  id: string
  name: string
  artistName: string
  playCount: number
  totalDuration: number
  lastPlayedAt: number
}

export interface MusicProfile {
  topArtists: ArtistStats[]
  topSongs: SongStats[]
  totalPlayCount: number
  totalPlayDuration: number
  timePreference: TimePreference
  tasteTags: string[]
  personality: string
  generatedAt: number
}

export interface TimePreference {
  morning: number
  afternoon: number
  evening: number
  night: number
  preferredPeriod: string
}

export interface StatsData {
  records: PlayRecord[]
  totalPlayCount: number
  totalPlayDuration: number
  firstPlayAt: number
}

function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    console.warn('Failed to load stats:', e)
  }
  return {
    records: [],
    totalPlayCount: 0,
    totalPlayDuration: 0,
    firstPlayAt: 0,
  }
}

export const useStatsStore = defineStore('stats', () => {
  const data = ref<StatsData>(loadStats())

  const todayPlayCount = computed(() => {
    const today = new Date().toDateString()
    return data.value.records.filter(r => new Date(r.playedAt).toDateString() === today).length
  })

  const todayPlayDuration = computed(() => {
    const today = new Date().toDateString()
    return data.value.records
      .filter(r => new Date(r.playedAt).toDateString() === today)
      .reduce((sum, r) => sum + r.duration, 0)
  })

  const weekPlayCount = computed(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return data.value.records.filter(r => r.playedAt >= weekAgo).length
  })

  const weekPlayDuration = computed(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return data.value.records
      .filter(r => r.playedAt >= weekAgo)
      .reduce((sum, r) => sum + r.duration, 0)
  })

  const monthPlayCount = computed(() => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return data.value.records.filter(r => r.playedAt >= monthAgo).length
  })

  const monthPlayDuration = computed(() => {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return data.value.records
      .filter(r => r.playedAt >= monthAgo)
      .reduce((sum, r) => sum + r.duration, 0)
  })

  const topArtists = computed(() => {
    const artistMap = new Map<string, ArtistStats>()
    
    data.value.records.forEach(record => {
      const key = record.artistName
      if (!artistMap.has(key)) {
        artistMap.set(key, {
          id: record.artistId || key,
          name: record.artistName,
          playCount: 0,
          totalDuration: 0,
        })
      }
      const stats = artistMap.get(key)!
      stats.playCount++
      stats.totalDuration += record.duration
    })

    return Array.from(artistMap.values())
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10)
  })

  const topSongs = computed(() => {
    const songMap = new Map<string, SongStats>()
    
    data.value.records.forEach(record => {
      const key = record.songId
      if (!songMap.has(key)) {
        songMap.set(key, {
          id: record.songId,
          name: record.songName,
          artistName: record.artistName,
          playCount: 0,
          totalDuration: 0,
          lastPlayedAt: 0,
        })
      }
      const stats = songMap.get(key)!
      stats.playCount++
      stats.totalDuration += record.duration
      stats.lastPlayedAt = Math.max(stats.lastPlayedAt, record.playedAt)
    })

    return Array.from(songMap.values())
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 20)
  })

  const weeklyTrend = computed(() => {
    const days: { date: string; count: number; duration: number }[] = []
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toDateString()
      
      const dayRecords = data.value.records.filter(
        r => new Date(r.playedAt).toDateString() === dateStr
      )
      
      days.push({
        date: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
        count: dayRecords.length,
        duration: dayRecords.reduce((sum, r) => sum + r.duration, 0),
      })
    }
    
    return days
  })

  const timePreference = computed<TimePreference>(() => {
    let morning = 0
    let afternoon = 0
    let evening = 0
    let night = 0

    data.value.records.forEach(record => {
      const hour = new Date(record.playedAt).getHours()
      if (hour >= 6 && hour < 12) {
        morning++
      } else if (hour >= 12 && hour < 18) {
        afternoon++
      } else if (hour >= 18 && hour < 22) {
        evening++
      } else {
        night++
      }
    })

    const total = morning + afternoon + evening + night
    let preferredPeriod = '晚上'
    let maxCount = evening

    if (morning > maxCount) {
      maxCount = morning
      preferredPeriod = '早上'
    }
    if (afternoon > maxCount) {
      maxCount = afternoon
      preferredPeriod = '下午'
    }
    if (night > maxCount) {
      maxCount = night
      preferredPeriod = '深夜'
    }

    return {
      morning: total > 0 ? Math.round((morning / total) * 100) : 0,
      afternoon: total > 0 ? Math.round((afternoon / total) * 100) : 0,
      evening: total > 0 ? Math.round((evening / total) * 100) : 0,
      night: total > 0 ? Math.round((night / total) * 100) : 0,
      preferredPeriod,
    }
  })

  const tasteTags = computed<string[]>(() => {
    const tags: string[] = []
    const records = data.value.records

    if (records.length === 0) {
      return ['音乐探索者']
    }

    const top5Artists = topArtists.value.slice(0, 5)
    if (top5Artists.length >= 3) {
      tags.push('博爱听众')
    }

    const totalHours = data.value.totalPlayDuration / 3600
    if (totalHours > 100) {
      tags.push('重度音乐爱好者')
    } else if (totalHours > 50) {
      tags.push('音乐发烧友')
    } else if (totalHours > 10) {
      tags.push('音乐爱好者')
    }

    if (timePreference.value.preferredPeriod === '深夜') {
      tags.push('夜猫子')
    } else if (timePreference.value.preferredPeriod === '早上') {
      tags.push('晨型人')
    }

    if (records.length > 0) {
      const uniqueArtists = new Set(records.map(r => r.artistName)).size
      if (uniqueArtists > 50) {
        tags.push('探索型')
      } else if (uniqueArtists < 10) {
        tags.push('专一型')
      }
    }

    if (topSongs.value.length > 0) {
      const topSongPlays = topSongs.value[0].playCount
      if (topSongPlays > 20) {
        tags.push('单曲循环党')
      }
    }

    if (tags.length === 0) {
      tags.push('音乐新手')
    }

    return tags.slice(0, 6)
  })

  const personality = computed(() => {
    const records = data.value.records
    if (records.length === 0) return '音乐探索者'

    const uniqueArtists = new Set(records.map(r => r.artistName)).size
    const totalHours = data.value.totalPlayDuration / 3600
    const nightRatio = timePreference.value.night

    let result = ''
    
    if (uniqueArtists < 10) {
      result = '专一深情型'
    } else if (uniqueArtists > 50 && totalHours > 50) {
      result = '音乐冒险家'
    } else if (nightRatio > 40) {
      result = '深夜治愈系'
    } else if (totalHours > 100) {
      result = '重度沉迷型'
    } else if (timePreference.value.morning > 30) {
      result = '晨间活力型'
    } else if (uniqueArtists > 30) {
      result = '品味多元型'
    } else {
      result = '悠然自得型'
    }

    return result
  })

  const musicProfile = computed<MusicProfile>(() => {
    return {
      topArtists: topArtists.value.slice(0, 5),
      topSongs: topSongs.value.slice(0, 10),
      totalPlayCount: data.value.totalPlayCount,
      totalPlayDuration: data.value.totalPlayDuration,
      timePreference: timePreference.value,
      tasteTags: tasteTags.value,
      personality: personality.value,
      generatedAt: Date.now(),
    }
  })

  function recordPlay(song: Song, duration: number, completed: boolean = false): void {
    const record: PlayRecord = {
      songId: song.id,
      songName: song.name,
      artistName: song.artists?.map(a => a.name).join(' / ') || '未知艺术家',
      artistId: song.artists?.[0]?.id,
      albumName: song.album?.name,
      source: song.source,
      duration,
      playedAt: Date.now(),
      completed,
    }

    data.value.records.push(record)
    data.value.totalPlayCount++
    data.value.totalPlayDuration += duration
    
    if (data.value.firstPlayAt === 0) {
      data.value.firstPlayAt = record.playedAt
    }

    if (data.value.records.length > 5000) {
      data.value.records = data.value.records.slice(-5000)
    }

    save()
  }

  function clearStats(): void {
    data.value = {
      records: [],
      totalPlayCount: 0,
      totalPlayDuration: 0,
      firstPlayAt: 0,
    }
    save()
  }

  function exportJSON(): string {
    return JSON.stringify(data.value, null, 2)
  }

  function exportCSV(): string {
    const headers = ['歌曲名', '艺术家', '来源', '播放时长(秒)', '播放时间', '是否完整播放']
    const rows = data.value.records.map(r => [
      `"${r.songName.replace(/"/g, '""')}"`,
      `"${r.artistName.replace(/"/g, '""')}"`,
      r.source,
      r.duration.toString(),
      new Date(r.playedAt).toISOString(),
      r.completed ? '是' : '否',
    ])
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }

  function save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.value))
    } catch (e) {
      console.warn('Failed to save stats:', e)
    }
  }

  return {
    data,
    todayPlayCount,
    todayPlayDuration,
    weekPlayCount,
    weekPlayDuration,
    monthPlayCount,
    monthPlayDuration,
    topArtists,
    topSongs,
    weeklyTrend,
    timePreference,
    tasteTags,
    personality,
    musicProfile,
    recordPlay,
    clearStats,
    exportJSON,
    exportCSV,
  }
})
