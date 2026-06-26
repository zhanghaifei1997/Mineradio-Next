import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { UserProfile, UserAccount, MusicSource, UserPlaylist, Song, Playlist } from '@/types'
import { providerManager } from '@/modules/providers'

const STORAGE_KEY = 'mineradio-user-state'
const LIKED_SONGS_KEY = 'mineradio-liked-songs'
const USER_PLAYLISTS_KEY = 'mineradio-user-playlists'

function loadFromStorage(): { netease: UserAccount; qqmusic: UserAccount; kugou: UserAccount } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        netease: parsed.netease || createEmptyAccount('netease'),
        qqmusic: parsed.qqmusic || createEmptyAccount('qqmusic'),
        kugou: parsed.kugou || createEmptyAccount('kugou'),
      }
    }
  } catch (_) {}
  return {
    netease: createEmptyAccount('netease'),
    qqmusic: createEmptyAccount('qqmusic'),
    kugou: createEmptyAccount('kugou'),
  }
}

function loadLikedSongsFromStorage(): Song[] {
  try {
    const raw = localStorage.getItem(LIKED_SONGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

function saveLikedSongsToStorage(songs: Song[]) {
  try {
    localStorage.setItem(LIKED_SONGS_KEY, JSON.stringify(songs))
  } catch (_) {}
}

function loadUserPlaylistsFromStorage(): UserPlaylist[] {
  try {
    const raw = localStorage.getItem(USER_PLAYLISTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return []
}

function saveUserPlaylistsToStorage(playlists: UserPlaylist[]) {
  try {
    localStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(playlists))
  } catch (_) {}
}

function createEmptyAccount(source: MusicSource): UserAccount {
  return {
    source,
    profile: null,
    loggedIn: false,
  }
}

function saveToStorage(accounts: { netease: UserAccount; qqmusic: UserAccount; kugou: UserAccount }) {
  try {
    const toSave = {
      netease: { ...accounts.netease, cookie: undefined },
      qqmusic: { ...accounts.qqmusic, cookie: undefined },
      kugou: { ...accounts.kugou, cookie: undefined },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch (_) {}
}

export const useUserStore = defineStore('user', () => {
  const initial = loadFromStorage()

  const neteaseAccount = ref<UserAccount>(initial.netease)
  const qqmusicAccount = ref<UserAccount>(initial.qqmusic)
  const kugouAccount = ref<UserAccount>(initial.kugou)
  const userPlaylists = ref<UserPlaylist[]>(loadUserPlaylistsFromStorage())
  const likedSongs = ref<Song[]>(loadLikedSongsFromStorage())
  const likedSongIds = ref<Set<string>>(new Set(loadLikedSongsFromStorage().map(s => `${s.source}:${s.id}`)))
  const recentPlayed = ref<Song[]>([])
  const loadingProfile = ref(false)
  const loadingPlaylists = ref(false)
  const loadingLiked = ref(false)
  const isRefreshingLogin = ref(false)
  const lastLoginRefreshTime = ref(0)
  // 登录弹窗可见性：允许其他 store（如 player）在检测到 login_required 时触发
  const loginModalVisible = ref(false)
  // 指定登录弹窗应优先展示的音源（可选）
  const loginModalSource = ref<MusicSource | null>(null)

  const isLoggedIn = computed(() => neteaseAccount.value.loggedIn || qqmusicAccount.value.loggedIn || kugouAccount.value.loggedIn)

  const hasMultipleAccounts = computed(() => {
    let count = 0
    if (neteaseAccount.value.loggedIn) count++
    if (qqmusicAccount.value.loggedIn) count++
    if (kugouAccount.value.loggedIn) count++
    return count >= 2
  })

  const primaryAccount = computed<UserAccount | null>(() => {
    if (neteaseAccount.value.loggedIn) return neteaseAccount.value
    if (qqmusicAccount.value.loggedIn) return qqmusicAccount.value
    if (kugouAccount.value.loggedIn) return kugouAccount.value
    return null
  })

  const primaryProfile = computed<UserProfile | null>(() => primaryAccount.value?.profile || null)

  const ownedPlaylists = computed(() => userPlaylists.value.filter(p => p.isOwned && !p.isFavorite))
  const subscribedPlaylists = computed(() => userPlaylists.value.filter(p => !p.isOwned && !p.isFavorite))
  const favoritePlaylist = computed(() => userPlaylists.value.find(p => p.isFavorite))

  function getAccount(source: MusicSource): UserAccount {
    switch (source) {
      case 'netease':
        return neteaseAccount.value
      case 'qqmusic':
        return qqmusicAccount.value
      case 'kugou':
        return kugouAccount.value
      default:
        return neteaseAccount.value
    }
  }

  function setAccount(source: MusicSource, account: Partial<UserAccount>) {
    switch (source) {
      case 'netease':
        neteaseAccount.value = { ...neteaseAccount.value, ...account }
        break
      case 'qqmusic':
        qqmusicAccount.value = { ...qqmusicAccount.value, ...account }
        break
      case 'kugou':
        kugouAccount.value = { ...kugouAccount.value, ...account }
        break
    }
    saveToStorage({
      netease: neteaseAccount.value,
      qqmusic: qqmusicAccount.value,
      kugou: kugouAccount.value,
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
    userPlaylists.value = userPlaylists.value.filter(p => p.source !== source)
    saveUserPlaylistsToStorage(userPlaylists.value)
    likedSongs.value = likedSongs.value.filter(s => s.source !== source)
    likedSongIds.value = new Set(likedSongs.value.map(s => `${s.source}:${s.id}`))
    saveLikedSongsToStorage(likedSongs.value)
  }

  function logoutAll() {
    logout('netease')
    logout('qqmusic')
    logout('kugou')
    userPlaylists.value = []
    likedSongs.value = []
    likedSongIds.value = new Set()
    recentPlayed.value = []
    saveUserPlaylistsToStorage([])
    saveLikedSongsToStorage([])
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
      saveUserPlaylistsToStorage(userPlaylists.value)

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
    if (kugouAccount.value.loggedIn) {
      const list = await fetchUserPlaylists('kugou')
      results.push(...list)
    }
    return results
  }

  async function fetchLikedSongs(source: MusicSource): Promise<Song[]> {
    loadingLiked.value = true
    try {
      const provider = providerManager.get(source)
      if (!provider) return []
      const songs = await provider.getLikedSongs()
      if (source === 'netease') {
        likedSongs.value = songs
        likedSongIds.value = new Set(songs.map(s => `${s.source}:${s.id}`))
        saveLikedSongsToStorage(songs)
      }
      return songs
    } catch (e) {
      console.error(`[User] Failed to fetch ${source} liked songs:`, e)
      return []
    } finally {
      loadingLiked.value = false
    }
  }

  async function likeSong(source: MusicSource, songId: string, like: boolean, song?: Song): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.likeSong(songId, like)
      if (result) {
        const key = `${source}:${songId}`
        if (like) {
          likedSongIds.value.add(key)
          if (song && !likedSongs.value.find(s => s.id === songId && s.source === source)) {
            likedSongs.value.unshift(song)
          }
        } else {
          likedSongIds.value.delete(key)
          likedSongs.value = likedSongs.value.filter(s => !(s.id === songId && s.source === source))
        }
        saveLikedSongsToStorage(likedSongs.value)
      }
      return result
    } catch (e) {
      console.error(`[User] Failed to ${like ? 'like' : 'unlike'} song:`, e)
      return false
    }
  }

  function isSongLikedSync(source: string, songId: string): boolean {
    return likedSongIds.value.has(`${source}:${songId}`)
  }

  async function isSongLiked(source: MusicSource, songId: string): Promise<boolean> {
    if (likedSongIds.value.has(`${source}:${songId}`)) {
      return true
    }
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const liked = await provider.isSongLiked(songId)
      if (liked) {
        likedSongIds.value.add(`${source}:${songId}`)
      }
      return liked
    } catch (e) {
      return false
    }
  }

  async function createPlaylist(source: MusicSource, name: string, privacy: 'public' | 'private' = 'private'): Promise<UserPlaylist | null> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return null
      const playlist = await provider.createPlaylist(name, privacy)
      if (playlist) {
        const newPlaylist: UserPlaylist = {
          id: playlist.id,
          name: playlist.name,
          coverUrl: playlist.coverUrl,
          trackCount: playlist.trackCount,
          playCount: playlist.playCount,
          source: source as MusicSource,
          isFavorite: false,
          isOwned: true,
        }
        userPlaylists.value.unshift(newPlaylist)
        saveUserPlaylistsToStorage(userPlaylists.value)
        return newPlaylist
      }
      return null
    } catch (e) {
      console.error('[User] Failed to create playlist:', e)
      return null
    }
  }

  async function deletePlaylist(source: MusicSource, playlistId: string): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.deletePlaylist(playlistId)
      if (result) {
        userPlaylists.value = userPlaylists.value.filter(p => !(p.id === playlistId && p.source === source))
        saveUserPlaylistsToStorage(userPlaylists.value)
      }
      return result
    } catch (e) {
      console.error('[User] Failed to delete playlist:', e)
      return false
    }
  }

  async function updatePlaylist(source: MusicSource, playlistId: string, data: { name?: string; description?: string; privacy?: 'public' | 'private' }): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.updatePlaylist(playlistId, data)
      if (result) {
        const idx = userPlaylists.value.findIndex(p => p.id === playlistId && p.source === source)
        if (idx >= 0 && data.name) {
          userPlaylists.value[idx].name = data.name
          saveUserPlaylistsToStorage(userPlaylists.value)
        }
      }
      return result
    } catch (e) {
      console.error('[User] Failed to update playlist:', e)
      return false
    }
  }

  async function subscribePlaylist(source: MusicSource, playlistId: string): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.subscribePlaylist(playlistId)
      if (result) {
        fetchUserPlaylists(source)
      }
      return result
    } catch (e) {
      console.error('[User] Failed to subscribe playlist:', e)
      return false
    }
  }

  async function unsubscribePlaylist(source: MusicSource, playlistId: string): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.unsubscribePlaylist(playlistId)
      if (result) {
        userPlaylists.value = userPlaylists.value.filter(p => !(p.id === playlistId && p.source === source && !p.isOwned))
        saveUserPlaylistsToStorage(userPlaylists.value)
      }
      return result
    } catch (e) {
      console.error('[User] Failed to unsubscribe playlist:', e)
      return false
    }
  }

  async function addToPlaylist(source: MusicSource, playlistId: string, songIds: string[]): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.addToPlaylist(playlistId, songIds)
      if (result) {
        const idx = userPlaylists.value.findIndex(p => p.id === playlistId && p.source === source)
        if (idx >= 0) {
          userPlaylists.value[idx].trackCount += songIds.length
          saveUserPlaylistsToStorage(userPlaylists.value)
        }
      }
      return result
    } catch (e) {
      console.error('[User] Failed to add to playlist:', e)
      return false
    }
  }

  async function removeFromPlaylist(source: MusicSource, playlistId: string, songIds: string[]): Promise<boolean> {
    try {
      const provider = providerManager.get(source)
      if (!provider) return false
      const result = await provider.removeFromPlaylist(playlistId, songIds)
      if (result) {
        const idx = userPlaylists.value.findIndex(p => p.id === playlistId && p.source === source)
        if (idx >= 0) {
          userPlaylists.value[idx].trackCount = Math.max(0, userPlaylists.value[idx].trackCount - songIds.length)
          saveUserPlaylistsToStorage(userPlaylists.value)
        }
      }
      return result
    } catch (e) {
      console.error('[User] Failed to remove from playlist:', e)
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

  async function refreshLoginStatus(timeoutMs: number = 5000): Promise<{
    netease: boolean
    qqmusic: boolean
    kugou: boolean
    newlyLoggedIn: MusicSource[]
  }> {
    if (isRefreshingLogin.value) {
      return {
        netease: neteaseAccount.value.loggedIn,
        qqmusic: qqmusicAccount.value.loggedIn,
        kugou: kugouAccount.value.loggedIn,
        newlyLoggedIn: [],
      }
    }

    isRefreshingLogin.value = true

    const wasLoggedIn = {
      netease: neteaseAccount.value.loggedIn,
      qqmusic: qqmusicAccount.value.loggedIn,
      kugou: kugouAccount.value.loggedIn,
    }

    const newlyLoggedIn: MusicSource[] = []

    try {
      const sources: MusicSource[] = ['netease', 'qqmusic', 'kugou']

      const refreshPromises = sources.map(async (source) => {
        try {
          const provider = providerManager.get(source)
          if (!provider) return { source, success: false }

          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

          try {
            const profile = await provider.getCurrentUser()
            clearTimeout(timeoutId)

            if (profile) {
              const wasLogged = wasLoggedIn[source as keyof typeof wasLoggedIn]
              if (!wasLogged) {
                newlyLoggedIn.push(source)
              }
              setProfile(source, profile)
              return { source, success: true }
            } else {
              return { source, success: false }
            }
          } catch {
            clearTimeout(timeoutId)
            return { source, success: false }
          }
        } catch {
          return { source, success: false }
        }
      })

      await Promise.all(refreshPromises)

      lastLoginRefreshTime.value = Date.now()

      return {
        netease: neteaseAccount.value.loggedIn,
        qqmusic: qqmusicAccount.value.loggedIn,
        kugou: kugouAccount.value.loggedIn,
        newlyLoggedIn,
      }
    } finally {
      isRefreshingLogin.value = false
    }
  }

  async function init() {
    loadRecentPlayed()
    if (neteaseAccount.value.loggedIn) {
      fetchUserProfile('netease').catch(() => {})
      fetchUserPlaylists('netease').catch(() => {})
    }
    if (qqmusicAccount.value.loggedIn) {
      fetchUserProfile('qqmusic').catch(() => {})
    }
    if (kugouAccount.value.loggedIn) {
      fetchUserProfile('kugou').catch(() => {})
    }
  }

  function showLoginModal(source?: MusicSource): void {
    loginModalSource.value = source || null
    loginModalVisible.value = true
  }

  function closeLoginModal(): void {
    loginModalVisible.value = false
    loginModalSource.value = null
  }

  return {
    neteaseAccount,
    qqmusicAccount,
    kugouAccount,
    userPlaylists,
    likedSongs,
    likedSongIds,
    recentPlayed,
    loadingProfile,
    loadingPlaylists,
    loadingLiked,
    isRefreshingLogin,
    lastLoginRefreshTime,
    loginModalVisible,
    loginModalSource,
    isLoggedIn,
    hasMultipleAccounts,
    primaryAccount,
    primaryProfile,
    ownedPlaylists,
    subscribedPlaylists,
    favoritePlaylist,
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
    isSongLikedSync,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    subscribePlaylist,
    unsubscribePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    addToRecentPlayed,
    loadRecentPlayed,
    refreshLoginStatus,
    showLoginModal,
    closeLoginModal,
    init,
  }
})
