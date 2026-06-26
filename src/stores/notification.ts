import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NotificationSettings, Song } from '@/types'
import { useI18nStore } from './i18n'

const STORAGE_KEY = 'mineradio_notification_settings'

function loadSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        enabled: parsed.enabled !== false,
        trackChange: parsed.trackChange !== false,
        downloadComplete: parsed.downloadComplete !== false,
        updateAvailable: parsed.updateAvailable !== false,
      }
    }
  } catch (e) {
    console.warn('Failed to load notification settings:', e)
  }
  return {
    enabled: true,
    trackChange: true,
    downloadComplete: true,
    updateAvailable: true,
  }
}

function saveSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.warn('Failed to save notification settings:', e)
  }
}

const electronAPI = (typeof window !== 'undefined') ? (window as any).electronAPI : null

export const useNotificationStore = defineStore('notification', () => {
  const settings = ref<NotificationSettings>(loadSettings())
  const permissionGranted = ref(false)

  const isSupported = computed(() => {
    return typeof Notification !== 'undefined' || (electronAPI && electronAPI.notification)
  })

  function setEnabled(enabled: boolean) {
    settings.value.enabled = enabled
    saveSettings(settings.value)
    if (enabled) {
      requestPermission()
    }
  }

  function setTrackChangeEnabled(enabled: boolean) {
    settings.value.trackChange = enabled
    saveSettings(settings.value)
  }

  function setDownloadCompleteEnabled(enabled: boolean) {
    settings.value.downloadComplete = enabled
    saveSettings(settings.value)
  }

  function setUpdateAvailableEnabled(enabled: boolean) {
    settings.value.updateAvailable = enabled
    saveSettings(settings.value)
  }

  async function requestPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
      permissionGranted.value = false
      return false
    }

    if (Notification.permission === 'granted') {
      permissionGranted.value = true
      return true
    }

    if (Notification.permission === 'denied') {
      permissionGranted.value = false
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      permissionGranted.value = permission === 'granted'
      return permissionGranted.value
    } catch (e) {
      console.warn('Notification permission request failed:', e)
      return false
    }
  }

  function showNotification(title: string, options?: NotificationOptions): Notification | null {
    if (!settings.value.enabled) return null
    if (typeof Notification === 'undefined') return null
    if (Notification.permission !== 'granted') return null

    try {
      const notification = new Notification(title, {
        ...options,
        icon: options?.icon || undefined,
      })

      if (options?.onclick) {
        notification.onclick = options.onclick as any
      }

      return notification
    } catch (e) {
      console.warn('Failed to show notification:', e)
      return null
    }
  }

  function notifyTrackChange(song: Song) {
    if (!settings.value.trackChange) return

    const i18n = useI18nStore()
    const artistName = song.artists?.map((a: any) => a.name).join(' / ') || ''
    const title = i18n.t('notification.nowPlaying')
    const body = `${song.name} - ${artistName}`

    showNotification(title, {
      body,
      icon: song.coverUrl || undefined,
      tag: 'track-change',
      requireInteraction: false,
    })
  }

  function notifyDownloadComplete(songName: string, size?: string) {
    if (!settings.value.downloadComplete) return

    const i18n = useI18nStore()
    const title = i18n.t('notification.downloadFinished')
    const body = size ? `${songName} (${size})` : songName

    showNotification(title, {
      body,
      tag: 'download-complete',
      requireInteraction: false,
    })
  }

  function notifyUpdateAvailable(version: string, onClick?: () => void) {
    if (!settings.value.updateAvailable) return

    const i18n = useI18nStore()
    const title = i18n.t('notification.newVersionAvailable')
    const body = `v${version}`

    showNotification(title, {
      body,
      tag: 'update-available',
      requireInteraction: true,
      onclick: onClick,
    })
  }

  return {
    settings,
    isSupported,
    permissionGranted,
    setEnabled,
    setTrackChangeEnabled,
    setDownloadCompleteEnabled,
    setUpdateAvailableEnabled,
    requestPermission,
    showNotification,
    notifyTrackChange,
    notifyDownloadComplete,
    notifyUpdateAvailable,
  }
})
