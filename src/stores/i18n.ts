import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Language } from '@/types'
import zhCN from '@/locales/zh-CN'
import enUS from '@/locales/en-US'

const STORAGE_KEY = 'mineradio_locale'

const messages: Record<Language, any> = {
  'zh-CN': zhCN,
  'en-US': enUS,
}

function loadLocale(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ['zh-CN', 'en-US'].includes(saved)) {
      return saved as Language
    }
  } catch (e) {
    console.warn('Failed to load locale setting:', e)
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language
    if (lang.startsWith('zh')) return 'zh-CN'
    if (lang.startsWith('en')) return 'en-US'
  }
  return 'zh-CN'
}

function saveLocale(locale: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch (e) {
    console.warn('Failed to save locale setting:', e)
  }
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.')
  let result = obj
  for (const key of keys) {
    if (result == null) return undefined
    result = result[key]
  }
  return result
}

function interpolate(text: string, params?: Record<string, any>): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match
  })
}

export const useI18nStore = defineStore('i18n', () => {
  const locale = ref<Language>(loadLocale())

  const currentMessages = computed(() => messages[locale.value] || messages['zh-CN'])

  function setLocale(newLocale: Language) {
    locale.value = newLocale
    saveLocale(newLocale)
  }

  function t(key: string, params?: Record<string, any>): string {
    const value = getNestedValue(currentMessages.value, key)
    if (typeof value === 'string') {
      return interpolate(value, params)
    }
    const fallback = getNestedValue(messages['zh-CN'], key)
    if (typeof fallback === 'string') {
      return interpolate(fallback, params)
    }
    return key
  }

  function availableLocales(): { code: Language; name: string }[] {
    return [
      { code: 'zh-CN', name: '简体中文' },
      { code: 'en-US', name: 'English' },
    ]
  }

  return {
    locale,
    currentMessages,
    setLocale,
    t,
    availableLocales,
  }
})

let i18nInstance: ReturnType<typeof useI18nStore> | null = null

export function useI18n() {
  if (!i18nInstance) {
    i18nInstance = useI18nStore()
  }
  return {
    t: i18nInstance.t,
    locale: i18nInstance.locale,
    setLocale: i18nInstance.setLocale,
  }
}
