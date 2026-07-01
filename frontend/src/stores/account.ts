import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LoginStatus, QQLoginStatus } from '@/types'

export const useAccountStore = defineStore('account', () => {
  // ── 网易云账号 ──
  const netease = ref<LoginStatus>({
    loggedIn: false,
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    vipLabel: '无VIP',
  })

  // ── QQ 音乐账号 ──
  const qq = ref<QQLoginStatus>({
    provider: 'qq',
    loggedIn: false,
    preview: false,
    nickname: 'QQ 音乐',
    userId: '',
    avatar: '',
    vipType: 0,
  })

  // ── 活跃账号源 ──
  const activeSource = ref<'netease' | 'qq'>('netease')

  // ── 计算属性 ──
  const isLoggedIn = computed(() => netease.value.loggedIn || qq.value.loggedIn)

  const displayName = computed(() => {
    if (activeSource.value === 'netease' && netease.value.loggedIn) {
      return netease.value.nickname ?? '网易云用户'
    }
    if (activeSource.value === 'qq' && qq.value.loggedIn) {
      return qq.value.nickname
    }
    return '未登录'
  })

  function setNeteaseStatus(status: Partial<LoginStatus>) {
    netease.value = { ...netease.value, ...status }
  }

  function setQQStatus(status: Partial<QQLoginStatus>) {
    qq.value = { ...qq.value, ...status }
  }

  function setActiveSource(source: 'netease' | 'qq') {
    activeSource.value = source
  }

  function clearNetease() {
    netease.value = {
      loggedIn: false, vipType: 0, vipLevel: 'none',
      isVip: false, isSvip: false, vipLabel: '无VIP',
    }
  }

  function clearQQ() {
    qq.value = {
      provider: 'qq', loggedIn: false, preview: false,
      nickname: 'QQ 音乐', userId: '', avatar: '', vipType: 0,
    }
  }

  return {
    netease, qq, activeSource, isLoggedIn, displayName,
    setNeteaseStatus, setQQStatus, setActiveSource, clearNetease, clearQQ,
  }
})
