import { describe, it, expect } from 'vitest'
import { MusicProvider } from './MusicProvider'
import type {
  Song,
  SearchResult,
  LyricData,
  Playlist,
  UserProfile,
  QualityLevel,
  Artist,
  Album,
} from '@/types'
import type { SongUrlResult, LoginResult, SearchOptions } from './MusicProvider'

class TestProvider extends MusicProvider {
  readonly id = 'test'
  readonly name = 'Test Provider'
  readonly color = '#ff0000'

  async isLoggedIn(): Promise<boolean> {
    return false
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return null
  }

  async login(): Promise<LoginResult> {
    return { success: false }
  }

  async logout(): Promise<void> {}

  async search(keyword: string, options?: SearchOptions): Promise<SearchResult> {
    return {
      songs: [],
      total: 0,
      more: false,
    }
  }

  async getSongDetail(id: string): Promise<Song | null> {
    return null
  }

  async getSongUrl(id: string, quality?: QualityLevel): Promise<SongUrlResult | null> {
    return null
  }

  async getLyric(id: string): Promise<LyricData | null> {
    return null
  }

  async getPlaylist(id: string): Promise<Playlist | null> {
    return null
  }

  async getUserPlaylists(uid?: string): Promise<Playlist[]> {
    return []
  }

  async getRecommendSongs(): Promise<Song[]> {
    return []
  }

  async getRecommendResources(): Promise<Playlist[]> {
    return []
  }

  async getArtistDetail(id: string): Promise<Artist | null> {
    return null
  }

  async getArtistSongs(id: string): Promise<Song[]> {
    return []
  }

  async getAlbum(id: string): Promise<Album | null> {
    return null
  }

  async likeSong(id: string, like: boolean): Promise<boolean> {
    return false
  }

  async isSongLiked(id: string): Promise<boolean> {
    return false
  }

  async getLikedSongs(): Promise<Song[]> {
    return []
  }
}

describe('MusicProvider 基类', () => {
  it('应该能够创建子类实例', () => {
    const provider = new TestProvider()
    expect(provider.id).toBe('test')
    expect(provider.name).toBe('Test Provider')
    expect(provider.color).toBe('#ff0000')
  })

  it('getSongUrls 应该批量获取歌曲 URL', async () => {
    const provider = new TestProvider()

    const mockGetSongUrl = vi.spyOn(provider, 'getSongUrl').mockResolvedValue({
      url: 'https://example.com/song.mp3',
      quality: 'standard',
    })

    const ids = ['1', '2', '3']
    const results = await provider.getSongUrls(ids, 'standard')

    expect(results.size).toBe(3)
    expect(mockGetSongUrl).toHaveBeenCalledTimes(3)
    expect(mockGetSongUrl).toHaveBeenCalledWith('1', 'standard')
    expect(mockGetSongUrl).toHaveBeenCalledWith('2', 'standard')
    expect(mockGetSongUrl).toHaveBeenCalledWith('3', 'standard')

    const result1 = results.get('1')
    expect(result1).not.toBeNull()
    expect(result1!.url).toBe('https://example.com/song.mp3')

    mockGetSongUrl.mockRestore()
  })

  it('getSongUrls 应该处理部分失败的情况', async () => {
    const provider = new TestProvider()

    const mockGetSongUrl = vi
      .spyOn(provider, 'getSongUrl')
      .mockImplementation(async (id: string) => {
        if (id === '2') return null
        return { url: `https://example.com/${id}.mp3`, quality: 'standard' as QualityLevel }
      })

    const ids = ['1', '2', '3']
    const results = await provider.getSongUrls(ids)

    expect(results.size).toBe(3)
    expect(results.get('1')).not.toBeNull()
    expect(results.get('2')).toBeNull()
    expect(results.get('3')).not.toBeNull()

    mockGetSongUrl.mockRestore()
  })

  it('getSongUrls 空数组应该返回空 Map', async () => {
    const provider = new TestProvider()
    const results = await provider.getSongUrls([], 'standard')
    expect(results.size).toBe(0)
  })
})
