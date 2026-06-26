import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { providerManager } from '@/modules/providers'
import type { MusicSource, LoginQrCode, QrLoginStatus } from '@/types'

export function useAuth() {
  const user = useUserStore()

  const loginModalVisible = ref(false)
  const qrLoading = ref(false)
  const qrCode = ref<LoginQrCode | null>(null)
  const qrStatus = ref<QrLoginStatus>('waiting')
  const qrError = ref<string | null>(null)

  let qrPollTimer: number | null = null

  const isDesktop = computed(() => {
    return typeof window !== 'undefined' && !!(window as any).electronAPI
  })

  const canUseDesktopLogin = computed(() => isDesktop.value)

  function openLoginModal() {
    loginModalVisible.value = true
  }

  function closeLoginModal() {
    loginModalVisible.value = false
    stopQrPolling()
  }

  async function generateQrCode(source: MusicSource = 'netease'): Promise<void> {
    if (source !== 'netease') return

    qrLoading.value = true
    qrError.value = null
    qrStatus.value = 'waiting'
    qrCode.value = null

    try {
      const keyRes = await fetch('/api/netease/login/qr/key')
      const keyData = await keyRes.json()
      const qrKey = keyData?.data?.unikey || keyData?.key

      if (!qrKey) throw new Error('获取二维码 Key 失败')

      const createRes = await fetch(`/api/netease/login/qr/create?key=${qrKey}&qrimg=true`)
      const createData = await createRes.json()
      const qrUrl = createData?.data?.qrurl || createData?.url
      const qrImg = createData?.data?.qrimg || createData?.img

      if (!qrUrl) throw new Error('生成二维码失败')

      qrCode.value = {
        qrKey,
        qrUrl,
        qrImg,
      }

      startQrPolling(source, qrKey)
    } catch (e: any) {
      qrError.value = e.message || '生成二维码失败'
      qrStatus.value = 'error'
    } finally {
      qrLoading.value = false
    }
  }

  function startQrPolling(source: MusicSource, key: string) {
    stopQrPolling()

    const poll = async () => {
      try {
        const res = await fetch(`/api/netease/login/qr/check?key=${key}`)
        const data = await res.json()
        const code = data?.code

        if (code === 803) {
          qrStatus.value = 'success'
          stopQrPolling()
          await handleLoginSuccess(source)
        } else if (code === 800) {
          qrStatus.value = 'expired'
          qrError.value = '二维码已过期'
          stopQrPolling()
        } else if (code === 801) {
          qrStatus.value = 'waiting'
        } else if (code === 802) {
          qrStatus.value = 'scanned'
        }
      } catch (_) {}
    }

    qrPollTimer = window.setInterval(poll, 1500)
  }

  function stopQrPolling() {
    if (qrPollTimer !== null) {
      clearInterval(qrPollTimer)
      qrPollTimer = null
    }
  }

  async function handleLoginSuccess(source: MusicSource) {
    await user.fetchUserProfile(source)
    if (user.getAccount(source).loggedIn) {
      user.fetchUserPlaylists(source).catch(() => {})
      user.fetchLikedSongs(source).catch(() => {})
    }
  }

  async function desktopLogin(source: MusicSource): Promise<boolean> {
    if (!isDesktop.value) return false

    try {
      const electronAPI = (window as any).electronAPI
      let result: any

      if (source === 'netease') {
        result = await electronAPI?.login?.openNetease()
      } else {
        result = await electronAPI?.login?.openQQ()
      }

      if (result?.ok) {
        await handleLoginSuccess(source)
        return true
      }
      return false
    } catch (e) {
      console.error('Desktop login failed:', e)
      return false
    }
  }

  async function logout(source: MusicSource) {
    try {
      const provider = providerManager.get(source)
      if (provider) {
        await provider.logout()
      }
    } catch (_) {}
    user.logout(source)

    if (isDesktop.value) {
      try {
        const electronAPI = (window as any).electronAPI
        if (source === 'netease') {
          await electronAPI?.login?.clearNetease()
        } else {
          await electronAPI?.login?.clearQQ()
        }
      } catch (_) {}
    }
  }

  async function logoutAll() {
    await logout('netease')
    await logout('qqmusic')
  }

  async function checkLoginStatus(source?: MusicSource): Promise<boolean> {
    const sources: MusicSource[] = source ? [source] : ['netease', 'qqmusic']
    let anyLoggedIn = false

    for (const src of sources) {
      try {
        const provider = providerManager.get(src)
        if (!provider) continue
        const loggedIn = await provider.isLoggedIn()
        if (loggedIn) {
          await user.fetchUserProfile(src)
          anyLoggedIn = true
        }
      } catch (_) {}
    }

    return anyLoggedIn
  }

  function initAuth() {
    user.init()
  }

  return {
    loginModalVisible,
    qrLoading,
    qrCode,
    qrStatus,
    qrError,
    isDesktop,
    canUseDesktopLogin,
    openLoginModal,
    closeLoginModal,
    generateQrCode,
    startQrPolling,
    stopQrPolling,
    desktopLogin,
    logout,
    logoutAll,
    checkLoginStatus,
    initAuth,
    handleLoginSuccess,
  }
}
