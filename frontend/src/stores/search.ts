import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Song, SearchMode, ArtistInfo, Playlist } from '@/types'

export const useSearchStore = defineStore('search', () => {
  const keywords = ref('')
  const searchMode = ref<SearchMode>('song')
  const loading = ref(false)
  const songs = ref<Song[]>([])
  const playlists = ref<Playlist[]>([])
  const artists = ref<ArtistInfo[]>([])
  const podcasts = ref<unknown[]>([])
  const searchHistory = ref<string[]>([])

  function setKeywords(kw: string) {
    keywords.value = kw
  }

  function setSearchMode(mode: SearchMode) {
    searchMode.value = mode
  }

  function addToHistory(kw: string) {
    if (!kw.trim()) return
    searchHistory.value = [kw, ...searchHistory.value.filter(h => h !== kw)].slice(0, 20)
  }

  function clearResults() {
    songs.value = []
    playlists.value = []
    artists.value = []
    podcasts.value = []
  }

  return {
    keywords, searchMode, loading, songs, playlists, artists, podcasts, searchHistory,
    setKeywords, setSearchMode, addToHistory, clearResults,
  }
})
