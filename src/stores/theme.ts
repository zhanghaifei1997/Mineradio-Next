import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'mineradio_theme'

function loadThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && ['dark', 'light', 'system'].includes(saved)) {
      return saved as ThemeMode
    }
  } catch (e) {
    console.warn('Failed to load theme setting:', e)
  }
  return 'dark'
}

function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch (e) {
    console.warn('Failed to save theme setting:', e)
  }
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return 'dark'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(loadThemeMode())
  const systemTheme = ref<'dark' | 'light'>(getSystemTheme())

  const actualTheme = computed(() => {
    if (mode.value === 'system') {
      return systemTheme.value
    }
    return mode.value
  })

  const isDark = computed(() => actualTheme.value === 'dark')

  function applyTheme(theme: 'dark' | 'light') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }

  function setMode(newMode: ThemeMode) {
    mode.value = newMode
    saveThemeMode(newMode)
  }

  function toggleTheme() {
    if (mode.value === 'dark') {
      setMode('light')
    } else if (mode.value === 'light') {
      setMode('system')
    } else {
      setMode('dark')
    }
  }

  function handleSystemThemeChange(e: MediaQueryListEvent) {
    systemTheme.value = e.matches ? 'light' : 'dark'
  }

  function init() {
    applyTheme(actualTheme.value)

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)')
      systemTheme.value = mediaQuery.matches ? 'light' : 'dark'

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleSystemThemeChange)
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleSystemThemeChange)
      }
    }
  }

  watch(actualTheme, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    mode,
    actualTheme,
    isDark,
    systemTheme,
    setMode,
    toggleTheme,
    init,
  }
})
