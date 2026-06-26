import { MusicProvider, type SearchOptions, type SongUrlResult, type LoginResult } from '../providers/MusicProvider'
import type { Song, SearchResult, LyricData, Playlist, UserProfile, Artist, Album, ArtistDetail, AlbumDetail, CommentList, MV, SongDetail } from '@/types'
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

  async getArtistDetail(id: string): Promise<ArtistDetail | null> {
    const artistName = id.replace('local-artist:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.artist === artistName)
    if (songs.length === 0) return null

    const albums = new Set(songs.map((s) => s.album).filter(Boolean))

    return {
      id,
      name: artistName,
      songCount: songs.length,
      albumCount: albums.size,
      fansCount: 0,
      mvCount: 0,
    }
  }

  async getArtistSongs(id: string, page: number = 1, limit: number = 50): Promise<{ songs: Song[]; total: number; more: boolean }> {
    const artistName = id.replace('local-artist:', '')
    const allSongs = localMusicLibrary.getAllSongs().filter((s) => s.artist === artistName)
    const offset = (page - 1) * limit
    const songs = allSongs.slice(offset, offset + limit).map((s) => this.localToSong(s))
    return {
      songs,
      total: allSongs.length,
      more: offset + limit < allSongs.length,
    }
  }

  async getArtistAlbums(id: string, page: number = 1, limit: number = 30): Promise<{ albums: Album[]; total: number; more: boolean }> {
    const artistName = id.replace('local-artist:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.artist === artistName)
    const albumMap = new Map<string, Album>()
    songs.forEach((s) => {
      if (s.album && !albumMap.has(s.album)) {
        albumMap.set(s.album, {
          id: `local-album:${s.album}`,
          name: s.album,
          coverUrl: s.coverUrl,
        })
      }
    })
    const allAlbums = Array.from(albumMap.values())
    const offset = (page - 1) * limit
    const albums = allAlbums.slice(offset, offset + limit)
    return {
      albums,
      total: allAlbums.length,
      more: offset + limit < allAlbums.length,
    }
  }

  async getArtistMVs(_id: string, _page?: number, _limit?: number): Promise<{ mvs: MV[]; total: number; more: boolean }> {
    return { mvs: [], total: 0, more: false }
  }

  async getSimilarArtists(_id: string): Promise<Artist[]> {
    return []
  }

  async followArtist(_id: string, _follow: boolean): Promise<boolean> {
    return false
  }

  async getAlbum(id: string): Promise<AlbumDetail | null> {
    const albumName = id.replace('local-album:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.album === albumName)
    if (songs.length === 0) return null

    const first = songs[0]
    const trackSongs = songs.map((s) => this.localToSong(s))

    return {
      id,
      name: albumName,
      coverUrl: first.coverUrl,
      artists: first.artist
        ? [
            {
              id: `local-artist:${first.artist}`,
              name: first.artist,
            },
          ]
        : [],
      songCount: songs.length,
      tracks: trackSongs,
    }
  }

  async getAlbumSongs(id: string): Promise<Song[]> {
    const albumName = id.replace('local-album:', '')
    const songs = localMusicLibrary.getAllSongs().filter((s) => s.album === albumName)
    return songs.map((s) => this.localToSong(s))
  }

  async subscribeAlbum(_id: string, _subscribe: boolean): Promise<boolean> {
    return false
  }

  async getSongComments(_id: string, _page?: number, _limit?: number, _type?: 'hot' | 'new'): Promise<CommentList | null> {
    return null
  }

  async likeComment(_id: string, _cid: string, _like: boolean): Promise<boolean> {
    return false
  }

  async sendComment(_id: string, _content: string): Promise<boolean> {
    return false
  }

  async getSongFullDetail(id: string): Promise<SongDetail | null> {
    const song = await this.getSongDetail(id)
    return song as SongDetail
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

  async getTopList(): Promise<any[]> {
    return []
  }

  async getTopListDetail(_id: string): Promise<any | null> {
    return null
  }

  async getSearchSuggest(_keyword: string): Promise<any> {
    return { songs: [], artists: [], albums: [], playlists: [] }
  }

  async getHotSearch(): Promise<any[]> {
    return []
  }

  async getPersonalFM(): Promise<Song[]> {
    return this.getRecommendSongs()
  }

  async likeFMSong(_id: string, _like: boolean): Promise<boolean> {
    return false
  }

  async getDailyRecommend(): Promise<Song[]> {
    return this.getRecommendSongs()
  }

  async createPlaylist(_name: string, _privacy?: 'public' | 'private'): Promise<Playlist | null> {
    return null
  }

  async updatePlaylist(_id: string, _data: { name?: string; description?: string; coverUrl?: string; privacy?: 'public' | 'private' }): Promise<boolean> {
    return false
  }

  async deletePlaylist(_id: string): Promise<boolean> {
    return false
  }

  async subscribePlaylist(_id: string): Promise<boolean> {
    return false
  }

  async unsubscribePlaylist(_id: string): Promise<boolean> {
    return false
  }

  async addToPlaylist(_playlistId: string, _songIds: string[]): Promise<boolean> {
    return false
  }

  async removeFromPlaylist(_playlistId: string, _songIds: string[]): Promise<boolean> {
    return false
  }

  private localToSong(local: LocalSong): Song {
    return localMusicLibrary.localSongToSong(local)
  }
}

export const localMusicProvider = new LocalMusicProvider()
