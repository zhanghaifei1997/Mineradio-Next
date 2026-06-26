import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Song } from '@/types'
import { providerManager } from '@/modules/providers'
import { useUserStore } from './user'

export type WeatherMood = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'night'

export interface WeatherData {
  temperature: number
  weatherCode: number
  weatherDescription: string
  humidity: number
  windSpeed: number
  city: string
  latitude: number
  longitude: number
  fetchedAt: number
}

const STORAGE_KEY = 'mineradio_weather'
const CACHE_DURATION = 30 * 60 * 1000

function loadCachedWeather(): WeatherData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (Date.now() - data.fetchedAt < CACHE_DURATION) {
        return data
      }
    }
  } catch (_) {}
  return null
}

function saveWeather(data: WeatherData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (_) {}
}

function weatherCodeToDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: '晴朗',
    1: '大部晴朗',
    2: '局部多云',
    3: '阴天',
    45: '有雾',
    48: '雾凇',
    51: '小毛毛雨',
    53: '毛毛雨',
    55: '大毛毛雨',
    56: '冻毛毛雨',
    57: '大冻毛毛雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '大冻雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '阵雨',
    81: '强阵雨',
    82: '暴雨',
    85: '阵雪',
    86: '强阵雪',
    95: '雷暴',
    96: '雷暴伴小冰雹',
    99: '雷暴伴大冰雹',
  }
  return descriptions[code] || '未知'
}

function weatherCodeToMood(code: number, isNight: boolean): WeatherMood {
  if (isNight) return 'night'
  
  if (code <= 1) return 'sunny'
  if (code <= 3) return 'cloudy'
  if (code >= 45 && code <= 48) return 'cloudy'
  if (code >= 51 && code <= 67) return 'rainy'
  if (code >= 71 && code <= 86) return 'snowy'
  if (code >= 80 && code <= 82) return 'rainy'
  if (code >= 95) return 'rainy'
  
  return 'cloudy'
}

function isNightTime(): boolean {
  const hour = new Date().getHours()
  return hour < 6 || hour >= 20
}

export const useWeatherStore = defineStore('weather', () => {
  const weather = ref<WeatherData | null>(loadCachedWeather())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const weatherSongs = ref<Song[]>([])
  const loadingSongs = ref(false)

  const mood = computed<WeatherMood>(() => {
    if (!weather.value) return 'sunny'
    return weatherCodeToMood(weather.value.weatherCode, isNightTime())
  })

  const moodDescription = computed(() => {
    const moodMap: Record<WeatherMood, string> = {
      sunny: '今天阳光明媚，适合听轻快的歌',
      cloudy: '多云的天气，来些舒缓的音乐吧',
      rainy: '下雨啦，安静的治愈音乐陪你度过',
      snowy: '下雪了，纯净空灵的音乐最配',
      night: '夜深了，柔和的音乐助你入眠',
    }
    return moodMap[mood.value]
  })

  const moodEmoji = computed(() => {
    const emojiMap: Record<WeatherMood, string> = {
      sunny: '☀️',
      cloudy: '☁️',
      rainy: '🌧️',
      snowy: '❄️',
      night: '🌙',
    }
    return emojiMap[mood.value]
  })

  const moodGradient = computed(() => {
    const gradients: Record<WeatherMood, string> = {
      sunny: 'linear-gradient(135deg, rgba(255, 183, 77, 0.4), rgba(255, 138, 101, 0.4))',
      cloudy: 'linear-gradient(135deg, rgba(120, 144, 156, 0.4), rgba(96, 125, 139, 0.4))',
      rainy: 'linear-gradient(135deg, rgba(66, 165, 245, 0.4), rgba(92, 107, 192, 0.4))',
      snowy: 'linear-gradient(135deg, rgba(179, 229, 252, 0.4), rgba(200, 230, 201, 0.4))',
      night: 'linear-gradient(135deg, rgba(103, 58, 183, 0.4), rgba(63, 81, 181, 0.4))',
    }
    return gradients[mood.value]
  })

  async function fetchWeatherByCoords(lat: number, lon: number, city?: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m`
      )
      if (!response.ok) throw new Error('Weather API request failed')
      
      const data = await response.json()
      const current = data.current
      
      const weatherData: WeatherData = {
        temperature: Math.round(current.temperature_2m),
        weatherCode: current.weather_code,
        weatherDescription: weatherCodeToDescription(current.weather_code),
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        city: city || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        latitude: lat,
        longitude: lon,
        fetchedAt: Date.now(),
      }
      
      weather.value = weatherData
      saveWeather(weatherData)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '获取天气失败'
      console.warn('Fetch weather failed:', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchWeatherByIP(): Promise<void> {
    try {
      const response = await fetch('https://ipapi.co/json/')
      if (!response.ok) throw new Error('IP geolocation failed')
      const data = await response.json()
      await fetchWeatherByCoords(data.latitude, data.longitude, data.city || data.region)
    } catch (e) {
      console.warn('IP geolocation failed, using default:', e)
      await fetchWeatherByCoords(39.9042, 116.4074, '北京')
    }
  }

  async function fetchWeather(): Promise<void> {
    if (weather.value && Date.now() - weather.value.fetchedAt < CACHE_DURATION) {
      return
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeatherByCoords(position.coords.latitude, position.coords.longitude)
        },
        () => {
          fetchWeatherByIP()
        },
        { timeout: 5000 }
      )
    } else {
      await fetchWeatherByIP()
    }
  }

  async function generateWeatherPlaylist(): Promise<Song[]> {
    if (weatherSongs.value.length > 0) {
      return weatherSongs.value
    }
    
    loadingSongs.value = true
    try {
      const userStore = useUserStore()
      const provider = providerManager.default
      
      const moodKeywords: Record<WeatherMood, string[]> = {
        sunny: ['欢快', '阳光', '轻快', '夏日', '明亮'],
        cloudy: ['舒缓', '放松', '轻音乐', '治愈', '安静'],
        rainy: ['安静', '治愈', '雨声', '睡前', '轻音乐'],
        snowy: ['纯净', '空灵', '治愈', '冬日', '安静'],
        night: ['助眠', '安静', '轻音乐', '睡前', '柔和'],
      }
      
      const keywords = moodKeywords[mood.value]
      const keyword = keywords[Math.floor(Math.random() * keywords.length)]
      
      try {
        const searchResult = await provider.searchSongs(keyword, 1, 30)
        if (searchResult.songs.length > 0) {
          const shuffled = [...searchResult.songs].sort(() => Math.random() - 0.5)
          weatherSongs.value = shuffled.slice(0, 20)
          return weatherSongs.value
        }
      } catch (_) {}
      
      try {
        const dailyRec = await provider.getDailyRecommend()
        if (dailyRec.songs.length > 0) {
          const shuffled = [...dailyRec.songs].sort(() => Math.random() - 0.5)
          weatherSongs.value = shuffled.slice(0, 20)
          return weatherSongs.value
        }
      } catch (_) {}
      
      if (userStore.likedSongs.length > 0) {
        const shuffled = [...userStore.likedSongs].sort(() => Math.random() - 0.5)
        weatherSongs.value = shuffled.slice(0, 20)
        return weatherSongs.value
      }
      
      return []
    } catch (e) {
      console.error('Generate weather playlist failed:', e)
      return []
    } finally {
      loadingSongs.value = false
    }
  }

  async function refreshPlaylist(): Promise<Song[]> {
    weatherSongs.value = []
    return await generateWeatherPlaylist()
  }

  return {
    weather,
    loading,
    error,
    mood,
    moodDescription,
    moodEmoji,
    moodGradient,
    weatherSongs,
    loadingSongs,
    fetchWeather,
    fetchWeatherByCoords,
    fetchWeatherByIP,
    generateWeatherPlaylist,
    refreshPlaylist,
  }
})
