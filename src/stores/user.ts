import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserProfile, UserAccount, MusicSource, UserPlaylist, Song } from '@/types'
import { providerManager } from '@/modules/providers'

const STORAGE_KEY = 'mineradio-user-state'

function loadFromStorage(): { netease: UserAccount; qqmusic: UserAccount } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        netease: parsed.netease || createEmptyAccount('netease'),
        qqmusic: parsed.qqmusic || createEmptyAccount('qqmusic'),
      }
    }
  } catch (_) {}
  return {
    netease: createEmptyAccount('netease'),
    qqmusic: createEmptyAccount('qqmusic'),
  }
}

function createEmptyAccount(source: MusicSource): UserAccount {
  return {
    source,
    profile: null,
    loggedIn: false,
  }
}

function saveToStorage(accounts: { netease: UserAccount; qqmusic: UserAccount }) {
  try {
    const toSave = {
      netease: { ...accounts.netease, cookie: undefined },
      qqmusic: { ...accounts.qqmusic, cookie: undefined },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (_) {}
}

export const useUserStore = defineStore('user', () => {
  const initial = loadFromStorage()

  const neteaseAccount = ref<UserAccount>(initial.netease)
  const qqmusicAccount = ref<UserAccount>(initial.qqmusic)
  const userPlaylists = ref<UserPlaylist[]>([])
  const likedSongs = ref<Song[]>([])
  const recentPlayed = ref<Song[]>([])
  const loadingProfile = ref(false)
  const loadingPlaylists = ref(false)

  const isLoggedIn = computed(() => neteaseAccount.value.loggedIn || qqmusicAccount.value.loggedIn)

  const hasMultipleAccounts = computed(() => neteaseAccount.value.loggedIn && qqmusicAccount.value.loggedIn)

  const primaryAccount = computed<UserAccount | null>(() => {
    if (neteaseAccount.value.loggedIn) return neteaseAccount.value
    if (qqmusicAccount.value.loggedIn) return qqmusicAccount.value
    return null
  })

  const primaryProfile = computed<UserProfile | null>(() => primaryAccount.value?.profile || null)

  function getAccount(source: MusicSource): UserAccount {
    return source === 'netease' ? neteaseAccount.value : qqmusicAccount.value
  }

  function setAccount(source: MusicSource, account: Partial<UserAccount>) {
    if (source === 'netease') {
      neteaseAccount.value = { ...neteaseAccount.value, ...account }
    } else {
      qqmusicAccount.value = { ...qqmusicAccount.value, ...account }
    }
    saveToStorage({
      netease: neteaseAccount.value,
      qqmusic: qqmusicAccount.value,
    })
  }

  function setProfile(source: MusicSource, profile: UserProfile | null) {
    setAccount(source, { profile, loggedIn: !!profile })
  }

  function setLoggedIn(source: MusicSource, loggedIn: boolean, profile?: UserProfile) {
    setAccount(source, { loggedIn, profile: profile || (loggedIn ? undefined : null) as UserProfile | undefined })
  }

  function logout(source: MusicSource) {
    setAccount(source, {
      loggedIn: false,
      profile: null,
      cookie: undefined,
    })
    if (source === 'netease') {
      userPlaylists.value = userPlaylists.value.filter(p => p.source !== 'netease')
    } else {
      userPlaylists.value = userPlaylists.value.filter(p => p.source !== 'qqmusic')
    }
  }

  function logoutAll() {
    logout('netease')
    logout('qqmusic')
    userPlaylists.value = []
    likedSongs.value = []
    recentPlayed.value = []
  }

  async function fetchUserProfile(source: MusicSource): Promise<UserProfile | null> {
    loadingProfile.value = true
    try {
      const provider = providerManager.get(source)
      if (!provider) return null
      const profile = await provider.getCurrentUser()
      if (profile) {
        setProfile(source, profile)
      }
      return profile
    } catch (e) {
      console.error(`[User] Failed to fetch ${source} profile:`, e)
      return null
    } finally {
      loadingProfile.value = false
    }
  }

  async function fetchUserPlaylists(source: MusicSource): Promise<UserPlaylist[]> {
    loadingPlaylists.value = true
    try {
      const provider = providerManager.get(source)
      if (!provider) return []
      const account = getAccount(source)
      if (!account.loggedIn || !account.profile) return []

      const playlists = await provider.getUserPlaylists(account.profile.id)
      const mapped: UserPlaylist[] = playlists.map(p => ({
        id: p.id,
        name: p.name,
        coverUrl: p.coverUrl,
        trackCount: p.trackCount,
        playCount: p.playCount,
        source: source as MusicSource,
        isFavorite: /我喜欢的音乐|favorite|喜欢/i.test(p.name),
        isOwned: !p.creator || p.creator.id === account.profile?.id,
      }))

      const otherSource = userPlaylists.value.filter(p => p.source !== source)
      userPlaylists.value = [...otherSource, ...mapped]

      return mapped
    } catch (e) {
      console.error(`[User] Failed to fetch ${source} playlists:`, e)
      return []
    } finally {
      loadingPlaylists.value = false
    }
  }

  async function fetchAllUserPlaylists(): Promise<UserPlaylist[]> {
    const results: UserPlaylist[] = []
    if (neteaseAccount.value.loggedIn) {
      const list = await fetchUserPlaylists('netease')
      results.push(...list)
    }
    if (qqmusicAccount.value.loggedIn) {
      const list = await fetchUserPlaylists('qqmusic')
      results.push(...list)
    }
    return results
  }

  async function fetchLikedSongs(source: MusicSource): Promise<Song[]> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return []
      const songs = await provider.getLikedSongs()
      if (source === 'netease') {
        likedSongs.value = songs
      }
      return songs
    } catch (e) {
      console.error(`[User] Failed to fetch ${source} liked songs:`, e)
      return []
    }
  }

  async function likeSong(source: MusicSource, songId: string, like: boolean): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.likeSong(songId, like)
      return result
    } catch (e) {
      console.error(`[User] Failed to ${like ? 'like' : 'unlike'} song:`, e)
      return false
    }
  }

  async function isSongLiked(source: MusicSource, songId: string): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      return await provider.isSongLiked(songId)
    } catch (e) {
      return false
    }
  }

  function addToRecentPlayed(song: Song) {
    const exists = recentPlayed.value.findIndex(s => s.id === song.id && s.source === song.source)
    if (exists >= 0) {
      recentPlayed.value.splice(exists, 1)
    }
    recentPlayed.value.unshift(song)
    if (recentPlayed.value.length > 100) {
      recentPlayed.value = recentPlayed.value.slice(0, 100)
    }
    try {
      localStorage.setItem('mineradio-recent-played', JSON.stringify(recentPlayed.value))
    } catch (_) {}
  }

  function loadRecentPlayed() {
    try {
      const raw = localStorage.getItem('mineradio-recent-played')
      if (raw) {
        recentPlayed.value = JSON.parse(raw)
      }
    } catch (_) {}
  }

  async function init() {
    loadRecentPlayed()
    if (neteaseAccount.value.loggedIn) {
      fetchUserProfile('netease').catch(() => {})
    }
    if (qqmusicAccount.value.loggedIn) {
      fetchUserProfile('qqmusic').catch(() => {})
    }
  }

  return {
    neteaseAccount,
    qqmusicAccount,
    userPlaylists,
    likedSongs,
    recentPlayed,
    loadingProfile,
    loadingPlaylists,
    isLoggedIn,
    hasMultipleAccounts,
    primaryAccount,
    primaryProfile,
    getAccount,
    setAccount,
    setProfile,
    setLoggedIn,
    logout,
    logoutAll,
    fetchUserProfile,
    fetchUserPlaylists,
    fetchAllUserPlaylists,
    fetchLikedSongs,
    likeSong,
    isSongLiked,
    addToRecentPlayed,
    loadRecentPlayed,
    init,
  }
})
