<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal dual-login-modal">
      <!-- 平台切换 -->
      <div class="login-platform-tabs">
        <button
          :class="{ active: provider === 'netease', netease: true }"
          type="button"
          @click="provider = 'netease'"
        >网易云</button>
        <button
          :class="{ active: provider === 'qq', qq: true }"
          type="button"
          @click="provider = 'qq'"
        >QQ 音乐</button>
      </div>

      <!-- 介绍 -->
      <div class="login-intro">
        <div class="login-intro-kicker">Mineradio</div>
        <div class="login-intro-title">音乐播放器，也是一座视觉舞台</div>
        <div class="login-intro-body">搜索或导入一首歌即可播放；登录后会同步歌单、红心和播客，让封面、歌词和粒子跟着音乐动起来。</div>
      </div>

      <!-- 标题 -->
      <h2>{{ provider === 'netease' ? '扫码登录网易云音乐' : 'QQ 音乐登录' }}</h2>
      <div class="desc">
        {{ provider === 'netease' ? '使用 网易云音乐 App 扫码，可同步歌单、红心与播客。' : '使用 QQ 音乐 App 扫码登录。' }}
      </div>

      <!-- 二维码区域 -->
      <div class="qr-shell">
        <template v-if="provider === 'netease'">
          <img v-if="qrImage" id="qr-img" :src="qrImage" alt="QR Code">
          <div v-else style="color:rgba(255,255,255,.5);font-size:12px">正在生成二维码…</div>
        </template>
        <template v-else>
          <button class="qq-login-mark" type="button" @click="openQQLogin" :disabled="qqLoading">
            <b>QQ</b>
            <span>打开官方扫码窗口</span>
          </button>
        </template>
      </div>

      <!-- 状态 -->
      <div id="qr-status" :class="qrStatusClass">{{ qrStatusText }}</div>

      <!-- 按钮行 -->
      <div class="btn-row">
        <button class="modal-btn" @click="$emit('close')">取消</button>
        <button class="modal-btn" @click="$emit('close')">先搜索一首歌</button>
        <button v-if="provider === 'netease'" class="modal-btn primary" @click="refreshQR">刷新二维码</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAccountStore } from '@/stores/account'
import { desktop } from '@/services/desktop'
import { netease } from '@/services/netease'

const emit = defineEmits<{ close: [] }>()
const account = useAccountStore()

const provider = ref<'netease' | 'qq'>('netease')
const qrImage = ref('')
const qrStatusText = ref('正在生成二维码…')
const qrStatusClass = ref('')
const qqLoading = ref(false)
let checkTimer: ReturnType<typeof setInterval> | null = null
let currentKey = ''

async function generateQR() {
  qrStatusText.value = '正在生成二维码…'
  qrStatusClass.value = ''
  qrImage.value = ''

  try {
    const keyResult = await netease.getQRKey()
    currentKey = keyResult?.key || ''
    if (!currentKey) {
      qrStatusText.value = '获取二维码失败'
      qrStatusClass.value = 'fail'
      return
    }

    const createResult = await netease.getQRCreate({ key: currentKey })
    qrImage.value = createResult?.img || ''
    qrStatusText.value = '请使用网易云音乐 App 扫码'

    // 开始轮询扫码状态
    startPolling()
  } catch (e) {
    console.error('[LoginModal] generateQR failed:', e)
    qrStatusText.value = '网络错误，请稍后重试'
    qrStatusClass.value = 'fail'
  }
}

function startPolling() {
  stopPolling()
  checkTimer = setInterval(async () => {
    if (!currentKey) return
    try {
      const result = await netease.getQRCheck({ key: currentKey })
      const code = result?.code ?? 0

      if (code === 801) {
        qrStatusText.value = '请使用网易云音乐 App 扫码'
      } else if (code === 802) {
        qrStatusText.value = '已扫描，请在手机上确认'
        qrStatusClass.value = 'scan'
      } else if (code === 803) {
        // 登录成功
        qrStatusText.value = '登录成功！'
        qrStatusClass.value = 'scan'
        stopPolling()
        if (result?.loggedIn) {
          account.setNeteaseStatus({
            loggedIn: true,
            nickname: result?.nickname || '网易云用户',
            avatar: result?.avatar || '',
            vipType: result?.vipType || 0,
            isVip: result?.isVip || false,
            isSvip: result?.isSvip || false,
            vipLabel: result?.vipLabel || '无VIP',
          })
        }
        setTimeout(() => emit('close'), 800)
      } else if (code === 800) {
        qrStatusText.value = '二维码已过期，请刷新'
        qrStatusClass.value = 'fail'
        stopPolling()
      }
    } catch {
      // ignore polling errors
    }
  }, 2000)
}

function stopPolling() {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
}

async function refreshQR() {
  stopPolling()
  await generateQR()
}

async function openQQLogin() {
  qqLoading.value = true
  try {
    const result = await desktop.openQQLogin()
    if (result?.ok && result?.cookie) {
      account.setQQStatus({
        provider: 'qq',
        loggedIn: true,
        nickname: 'QQ 音乐用户',
        userId: '',
        avatar: '',
        vipType: 0,
      })
      setTimeout(() => emit('close'), 800)
    }
  } catch (e) {
    console.error('[LoginModal] QQ login failed:', e)
  } finally {
    qqLoading.value = false
  }
}

onMounted(() => {
  generateQR()
})

onUnmounted(() => {
  stopPolling()
})
</script>
