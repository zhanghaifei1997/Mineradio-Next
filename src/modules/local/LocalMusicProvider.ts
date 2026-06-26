import { MusicProvider, type SearchOptions, type SongUrlResult, type LoginResult } from '../providers/MusicProvider'
import type { Song, SearchResult, LyricData, Playlist, UserProfile, Artist, Album } from '@/types'
import { localMusicLibrary } from './LocalMusicLibrary'
import type { LocalSong } from './types'

export class LocalMusicProvider extends MusicProvider {
  readonly id = 'local'
  readonly name = '本地音乐'
  readonly color = '#4CAF50'

  async isLoggedIn(): Promise<boolean> {
    return true
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return {
      id: 'local-user',
      nickname: '本地音乐',
    }
  }

  async login(): Promise<LoginResult> {
    return { success: true }
  }

  async logout(): Promise<void> {}

  async search(keyword: string, options?: SearchOptions): Promise<SearchResult> {
    const results = localMusicLibrary.search(keyword)
    const limit = options?.limit || 30
    const offset = options?.offset || 0
    const paginated = results.slice(offset, offset + limit)

    return {
      songs: paginated.map((s) => this.localToSong(s)),
      total: results.length,
      more: offset + limit < results.length,
    }
  }

  async getSongDetail(id: string): Promise<Song | null> {
    const local = localMusicLibrary.getSongById(id)
    return local ? this.localToSong(local) : null
  }

  async getSongUrl(id: string): Promise<SongUrlResult | null> {
    const url = await localMusicLibrary.getSongUrl(id)
    if (!url) return null

    return {
      url,
      quality: 'standard',
    }
  }

  async getLyric(id: string): Promise<LyricData | null> {
    return null
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    if (id === 'local-all') {
      const songs = localMusicLibrary.getAllSongs().map((s) => this.localToSong(s))
      return {
        id: 'local-all',
        name: '本地音乐',
        tracks: songs,
        trackCount: songs.length,
        source: 'local',
      }
    }
    return null
  }

  async getUserPlaylists(): Promise<Playlist[]> {
    const songs = localMusicLibrary.getAllSongs()
    if (songs.length === 0) return []

    return [
      {
        id: 'local-all',
        name: '本地音乐',
        trackCount: songs.length,
        tracks: [],
        source: 'local',
      },
    ]
  }

  async getRecommendSongs(): Promise<Song[]> {
    const all = localMusicLibrary.getAllSongs()
    const shuffled = [...all].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 10).map((s) => this.localToSong(s))
  }

  async getRecommendResources(): Promise<Playlist[]> {
    return []
  }

  async getArtistDetail(id: string): Promise<Artist | null> {
    const artistName = id.replace('local-artist:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.artist === artistName)
    if (songs.length === 0) return null

    return {
      id,
      name: artistName,
    }
  }

  async getArtistSongs(id: string): Promise<Song[]> {
    const artistName = id.replace('local-artist:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.artist === artistName)
    return songs.map((s) => this.localToSong(s))
  }

  async getAlbum(id: string): Promise<Album | null> {
    const albumName = id.replace('local-album:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.album === albumName)
    if (songs.length === 0) return null

    const first = songs[0]
    return {
      id,
      name: albumName,
      coverUrl: first.coverUrl,
    }
  }

  async likeSong(): Promise<boolean> {
    return false
  }

  async isSongLiked(): Promise<boolean> {
    return false
  }

  async getLikedSongs(): Promise<Song[]> {
    return []
  }

  private localToSong(local: LocalSong): Song {
    return localMusicLibrary.localSongToSong(local)
  }
}

export const localMusicProvider = new LocalMusicProvider()
