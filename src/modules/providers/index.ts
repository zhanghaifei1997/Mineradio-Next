import { MusicProvider } from './MusicProvider'
import { neteaseProvider } from './NeteaseProvider'
import { qqMusicProvider } from './QQMusicProvider'

class ProviderManager {
  private providers: Map<string, MusicProvider> = new Map()
  private defaultProviderId = 'netease'

  constructor() {
    this.register(neteaseProvider)
    this.register(qqMusicProvider)
  }

  register(provider: MusicProvider): void {
    this.providers.set(provider.id, provider)
  }

  unregister(id: string): void {
    this.providers.delete(id)
  }

  get(id: string): MusicProvider | undefined {
    return this.providers.get(id)
  }

  getAll(): MusicProvider[] {
    return Array.from(this.providers.values())
  }

  get default(): MusicProvider {
    const p = this.providers.get(this.defaultProviderId)
    if (!p) throw new Error('Default provider not found')
    return p
  }

  setDefault(id: string): void {
    if (this.providers.has(id)) {
      this.defaultProviderId = id
    }
  }

  async searchAll(keyword: string): Promise<Map<string, import('@/types').SearchResult>> {
    const results = new Map()
    const promises = this.getAll().map(async (provider) => {
      try {
        const result = await provider.search(keyword)
        results.set(provider.id, result)
      } catch (e) {
        console.warn(`Search failed for ${provider.id}:`, e)
        results.set(provider.id, { songs: [], total: 0, more: false })
      }
    })
    await Promise.all(promises)
    return results
  }
}

export const providerManager = new ProviderManager()
