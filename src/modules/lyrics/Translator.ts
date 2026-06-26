export type TranslatorProvider = 'youdao' | 'baidu' | 'google'
export type TranslationDisplayMode = 'original' | 'translation' | 'both'

export interface TranslationSettings {
  enabled: boolean
  provider: TranslatorProvider
  targetLanguage: string
  displayMode: TranslationDisplayMode
  apiKey?: string
}

interface TranslationCacheEntry {
  original: string
  translation: string
  targetLang: string
  provider: TranslatorProvider
  timestamp: number
}

const CACHE_KEY = 'mineradio-translation-cache'
const CACHE_MAX_ENTRIES = 500
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000

export class LyricTranslator {
  private settings: TranslationSettings
  private cache: Map<string, TranslationCacheEntry> = new Map()

  constructor(settings?: Partial<TranslationSettings>) {
    this.settings = {
      enabled: false,
      provider: 'youdao',
      targetLanguage: 'zh-CN',
      displayMode: 'both',
      ...settings,
    }
    this.loadCache()
  }

  updateSettings(settings: Partial<TranslationSettings>): void {
    this.settings = { ...this.settings, ...settings }
  }

  getSettings(): TranslationSettings {
    return { ...this.settings }
  }

  async translateText(text: string, targetLang?: string): Promise<string> {
    if (!this.settings.enabled || !text.trim()) {
      return ''
    }

    const target = targetLang || this.settings.targetLanguage
    const cacheKey = this.getCacheKey(text, target, this.settings.provider)

    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.translation
    }

    try {
      const translation = await this.doTranslate(text, target)
      this.setCache(cacheKey, {
        original: text,
        translation,
        targetLang: target,
        provider: this.settings.provider,
        timestamp: Date.now(),
      })
      return translation
    } catch (e) {
      console.error('Translation failed:', e)
      return ''
    }
  }

  async translateLines(lines: Array<{ time: number; text: string }>): Promise<Array<{ time: number; text: string; translation: string }>> {
    if (!this.settings.enabled || lines.length === 0) {
      return lines.map(l => ({ ...l, translation: '' }))
    }

    const results = await Promise.all(
      lines.map(async (line) => ({
        ...line,
        translation: await this.translateText(line.text),
      }))
    )

    return results
  }

  private async doTranslate(text: string, targetLang: string): Promise<string> {
    switch (this.settings.provider) {
      case 'youdao':
        return this.translateYoudao(text, targetLang)
      case 'baidu':
        return this.translateBaidu(text, targetLang)
      case 'google':
        return this.translateGoogle(text, targetLang)
      default:
        return ''
    }
  }

  private async translateYoudao(text: string, targetLang: string): Promise<string> {
    try {
      const from = 'auto'
      const to = this.mapLangCode(targetLang, 'youdao')
      const res = await fetch(
        `https://aidemo.youdao.com/trans?from=${from}&to=${to}&q=${encodeURIComponent(text)}`
      )
      const data = await res.json()
      return data?.translation?.[0] || ''
    } catch {
      return ''
    }
  }

  private async translateBaidu(text: string, targetLang: string): Promise<string> {
    try {
      const from = 'auto'
      const to = this.mapLangCode(targetLang, 'baidu')
      const res = await fetch(
        `https://fanyi.baidu.com/sug?from=${from}&to=${to}&kw=${encodeURIComponent(text)}`
      )
      const data = await res.json()
      return data?.data?.[0]?.v || ''
    } catch {
      return ''
    }
  }

  private async translateGoogle(text: string, targetLang: string): Promise<string> {
    try {
      const to = this.mapLangCode(targetLang, 'google')
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
      )
      const data = await res.json()
      if (Array.isArray(data) && data[0]) {
        return data[0].map((item: any) => item[0]).join('')
      }
      return ''
    } catch {
      return ''
    }
  }

  private mapLangCode(lang: string, provider: TranslatorProvider): string {
    const maps: Record<TranslatorProvider, Record<string, string>> = {
      youdao: {
        'zh-CN': 'zh-CHS',
        'zh': 'zh-CHS',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
      },
      baidu: {
        'zh-CN': 'zh',
        'zh': 'zh',
        'en': 'en',
        'ja': 'jp',
        'ko': 'kor',
      },
      google: {
        'zh-CN': 'zh-CN',
        'zh': 'zh-CN',
        'en': 'en',
        'ja': 'ja',
        'ko': 'ko',
      },
    }
    return maps[provider]?.[lang] || lang
  }

  private getCacheKey(text: string, targetLang: string, provider: TranslatorProvider): string {
    return `${provider}:${targetLang}:${text}`
  }

  private loadCache(): void {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const entries = JSON.parse(raw) as TranslationCacheEntry[]
        const now = Date.now()
        entries.forEach((entry) => {
          if (now - entry.timestamp < CACHE_TTL) {
            const key = this.getCacheKey(entry.original, entry.targetLang, entry.provider)
            this.cache.set(key, entry)
          }
        })
      }
    } catch (_) {}
  }

  private saveCache(): void {
    try {
      const entries = Array.from(this.cache.values()).slice(-CACHE_MAX_ENTRIES)
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries))
    } catch (_) {}
  }

  private setCache(key: string, entry: TranslationCacheEntry): void {
    this.cache.set(key, entry)
    if (this.cache.size > CACHE_MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.saveCache()
  }

  clearCache(): void {
    this.cache.clear()
    try {
      localStorage.removeItem(CACHE_KEY)
    } catch (_) {}
  }
}

export const lyricTranslator = new LyricTranslator()
