<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import type { MusicSource, QrLoginStatus, LoginQrCode } from '@/types'

const user = useUserStore()

const visible = defineModel<boolean>('visible', { default: false })

const activeTab = ref<MusicSource>('netease')
const qrCode = ref<LoginQrCode | null>(null)
const qrStatus = ref<QrLoginStatus>('waiting')
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const isDesktop = ref(typeof window !== 'undefined' && !!(window as any).electronAPI)

let qrPollTimer: number | null = null

const canUseDesktopLogin = computed(() => isDesktop.value)

function switchTab(tab: MusicSource) {
  activeTab.value = tab
  qrCode.value = null
  qrStatus.value = 'waiting'
  errorMessage.value = null
  stopQrPolling()
}

async function generateQrCode() {
  if (activeTab.value !== 'netease') return

  loading.value = true
  errorMessage.value = null
  qrStatus.value = 'waiting'

  try {
    const keyRes = await fetch('/api/netease/login/qr/key')
    const keyData = await keyRes.json()
    const qrKey = keyData?.data?.unikey

    if (!qrKey) throw new Error('获取二维码 Key 失败')

    const createRes = await fetch(`/api/netease/login/qr/create?key=${qrKey}&qrimg=true`)
    const createData = await createRes.json()

    if (createData?.code !== 200) throw new Error('生成二维码失败')

    qrCode.value = {
      qrKey,
      qrUrl: createData.data.qrurl,
      qrImg: createData.data.qrimg,
    }

    startQrPolling(qrKey)
  } catch (e: any) {
    errorMessage.value = e.message || '生成二维码失败'
    qrStatus.value = 'error'
  } finally {
    loading.value = false
  }
}

function startQrPolling(key: string) {
  stopQrPolling()

  const poll = async () => {
    try {
      const res = await fetch(`/api/netease/login/qr/check?key=${key}`)
      const data = await res.json()
      const code = data?.code

      if (code === 803) {
        qrStatus.value = 'success'
        stopQrPolling()
        await handleLoginSuccess()
      } else if (code === 800) {
        qrStatus.value = 'expired'
        errorMessage.value = '二维码已过期'
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

async function handleLoginSuccess() {
  if (activeTab.value === 'netease') {
    await user.fetchUserProfile('netease')
    if (user.neteaseAccount.loggedIn) {
      user.fetchUserPlaylists('netease').catch(() => {})
    }
  }
  setTimeout(() => {
    visible.value = false
  }, 800)
}

async function openDesktopLogin(source: MusicSource) {
  if (!isDesktop.value) return

  loading.value = true
  errorMessage.value = null

  try {
    const electronAPI = (window as any).electronAPI
    let result: any

    if (source === 'netease') {
      result = await electronAPI?.login?.openNetease()
    } else {
      result = await electronAPI?.login?.openQQ()
    }

    if (result?.ok) {
      await handleLoginSuccess()
    } else if (result?.cancelled) {
      errorMessage.value = result.message || '登录已取消'
    } else {
      errorMessage.value = result?.error || result?.message || '登录失败'
    }
  } catch (e: any) {
    errorMessage.value = e.message || '登录失败'
  } finally {
    loading.value = false
  }
}

function handleClose() {
  visible.value = false
}

watch(visible, (val) => {
  if (val && activeTab.value === 'netease' && !canUseDesktopLogin.value) {
    generateQrCode()
  }
  if (!val) {
    stopQrPolling()
  }
})

onUnmounted(() => {
  stopQrPolling()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="login-modal-overlay" @click.self="handleClose">
        <div class="login-modal">
          <button class="login-modal__close" @click="handleClose" aria-label="关闭">
            ✕
          </button>

          <div class="login-modal__header">
            <div class="login-modal__kicker">登录</div>
            <div class="login-modal__title">登录你的音乐账号</div>
            <div class="login-modal__subtitle">
              登录后可同步收藏、歌单、每日推荐等个人数据
            </div>
          </div>

          <div class="login-platform-tabs">
            <button
              class="login-platform-tab"
              :class="{ active: activeTab === 'netease', netease: true }"
              @click="switchTab('netease')"
            >
              网易云音乐
            </button>
            <button
              class="login-platform-tab"
              :class="{ active: activeTab === 'qqmusic', qq: true }"
              @click="switchTab('qqmusic')"
            >
              QQ 音乐
            </button>
          </div>

          <div class="login-modal__content">
            <div v-if="activeTab === 'netease'" class="login-netease">
              <template v-if="canUseDesktopLogin">
                <div class="login-desktop-hint">
                  <div class="login-desktop-icon">🪟</div>
                  <div class="login-desktop-text">
                    <div class="login-desktop-title">桌面端登录</div>
                    <div class="login-desktop-desc">
                      通过官方网易云音乐窗口登录，更安全稳定
                    </div>
                  </div>
                </div>
                <button
                  class="login-btn login-btn--primary login-btn--netease"
                  :disabled="loading"
                  @click="openDesktopLogin('netease')"
                >
                  <span v-if="loading">登录中...</span>
                  <span v-else>打开网易云音乐登录</span>
                </button>
              </template>

              <template v-else>
                <div class="qr-shell" :class="{ 'qr-shell--loading': loading }">
                  <div v-if="loading && !qrCode" class="qr-loading">
                    <div class="qr-loading-spinner"></div>
                    <span>生成二维码中...</span>
                  </div>

                  <div v-else-if="qrCode" class="qr-container">
                    <img
                      v-if="qrCode.qrImg"
                      :src="'data:image/png;base64,' + qrCode.qrImg"
                      class="qr-img"
                      alt="登录二维码"
                    />
                    <img
                      v-else
                      :src="qrCode.qrUrl"
                      class="qr-img"
                      alt="登录二维码"
                    />

                    <div class="qr-status">
                      <span
                        class="qr-status-dot"
                        :class="{
                          'qr-status-dot--waiting': qrStatus === 'waiting',
                          'qr-status-dot--scanned': qrStatus === 'scanned',
                          'qr-status-dot--success': qrStatus === 'success',
                          'qr-status-dot--expired': qrStatus === 'expired',
                          'qr-status-dot--error': qrStatus === 'error',
                        }"
                      ></span>
                      <span class="qr-status-text">
                        <template v-if="qrStatus === 'waiting'">
                          使用网易云音乐 App 扫码登录
                        </template>
                        <template v-else-if="qrStatus === 'scanned'">
                          已扫码，请在手机上确认
                        </template>
                        <template v-else-if="qrStatus === 'success'">
                          登录成功！
                        </template>
                        <template v-else-if="qrStatus === 'expired'">
                          二维码已过期
                        </template>
                        <template v-else>
                          获取二维码失败
                        </template>
                      </span>
                    </div>

                    <button
                      v-if="qrStatus === 'expired' || qrStatus === 'error'"
                      class="qr-refresh-btn"
                      @click="generateQrCode"
                    >
                      刷新二维码
                    </button>
                  </div>

                  <div v-else-if="errorMessage" class="qr-error">
                    {{ errorMessage }}
                  </div>
                </div>
              </template>
            </div>

            <div v-else-if="activeTab === 'qqmusic'" class="login-qq">
              <template v-if="canUseDesktopLogin">
                <div class="login-desktop-hint">
                  <div class="login-desktop-icon">🪟</div>
                  <div class="login-desktop-text">
                    <div class="login-desktop-title">桌面端登录</div>
                    <div class="login-desktop-desc">
                      通过官方 QQ 音乐窗口登录，更安全稳定
                    </div>
                  </div>
                </div>
                <button
                  class="login-btn login-btn--primary login-btn--qq"
                  :disabled="loading"
                  @click="openDesktopLogin('qqmusic')"
                >
                  <span v-if="loading">登录中...</span>
                  <span v-else>打开 QQ 音乐登录</span>
                </button>
              </template>

              <template v-else>
                <div class="login-web-hint">
                  <div class="login-web-icon">🌐</div>
                  <div class="login-web-text">
                    <div class="login-web-title">网页版暂不支持</div>
                    <div class="login-web-desc">
                      QQ 音乐登录需要桌面端支持，请下载桌面版使用
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <div v-if="errorMessage" class="login-error">
              {{ errorMessage }}
            </div>
          </div>

          <div class="login-modal__footer">
            <div class="login-privacy-note">
              🔒 我们仅在本地保存登录凭证，不会上传任何个人数据
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.login-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.login-modal {
  position: relative;
  width: min(470px, 92vw);
  max-height: 90vh;
  overflow-y: auto;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.95),
    rgba(15, 15, 22, 0.98)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 28px 24px 20px;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.login-modal__close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.login-modal__close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

.login-modal__header {
  text-align: center;
  margin-bottom: 20px;
}

.login-modal__kicker {
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(244, 210, 138, 0.72);
  margin-bottom: 8px;
}

.login-modal__title {
  font-size: 20px;
  font-weight: 760;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 6px;
}

.login-modal__subtitle {
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.56);
}

.login-platform-tabs {
  display: flex;
  gap: 8px;
  margin: 0 auto 20px;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.075);
  background: rgba(255, 255, 255, 0.035);
  width: fit-content;
}

.login-platform-tab {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 20px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.48);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.45px;
  cursor: pointer;
  transition: all 0.22s;
  white-space: nowrap;
}

.login-platform-tab:hover {
  color: rgba(255, 255, 255, 0.82);
}

.login-platform-tab.active {
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 10px 26px rgba(0, 0, 0, 0.2);
}

.login-platform-tab.netease.active {
  background: rgba(217, 91, 103, 0.16);
  color: #ffd7dc;
}

.login-platform-tab.qq.active {
  background: rgba(0, 245, 212, 0.16);
  color: #f0ffc8;
}

.login-modal__content {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.qr-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.qr-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}

.qr-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.qr-img {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: #fff;
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.qr-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.qr-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f4d28a;
  animation: pulse 1.5s ease-in-out infinite;
}

.qr-status-dot--scanned {
  background: #00f5d4;
  animation: none;
}

.qr-status-dot--success {
  background: #4ade80;
  animation: none;
}

.qr-status-dot--expired,
.qr-status-dot--error {
  background: #f87171;
  animation: none;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.qr-refresh-btn {
  padding: 8px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.qr-refresh-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.login-desktop-hint {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.075);
  background: linear-gradient(
    135deg,
    rgba(217, 91, 103, 0.09),
    rgba(244, 210, 138, 0.055),
    rgba(255, 255, 255, 0.025)
  );
  margin-bottom: 16px;
  width: 100%;
  max-width: 360px;
}

.login-desktop-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.login-desktop-text {
  flex: 1;
  min-width: 0;
}

.login-desktop-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.login-desktop-desc {
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
}

.login-web-hint {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.075);
  background: rgba(255, 255, 255, 0.03);
  margin-bottom: 16px;
  width: 100%;
  max-width: 360px;
}

.login-web-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.login-web-text {
  flex: 1;
  min-width: 0;
}

.login-web-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 4px;
}

.login-web-desc {
  font-size: 11px;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.5);
}

.login-btn {
  width: 100%;
  max-width: 360px;
  height: 46px;
  border: none;
  border-radius: 12px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.22s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn--primary {
  color: #fff;
}

.login-btn--netease {
  background: linear-gradient(135deg, #d95b67, #e87882);
  box-shadow: 0 8px 24px rgba(217, 91, 103, 0.3);
}

.login-btn--netease:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(217, 91, 103, 0.4);
}

.login-btn--qq {
  background: linear-gradient(135deg, #00c9a7, #00f5d4);
  color: #03100f;
  box-shadow: 0 8px 24px rgba(0, 245, 212, 0.3);
}

.login-btn--qq:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(0, 245, 212, 0.4);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.login-error {
  margin-top: 12px;
  padding: 10px 14px;
  border-radius: 10px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  color: #fca5a5;
  font-size: 12px;
  text-align: center;
  max-width: 360px;
  width: 100%;
}

.login-modal__footer {
  margin-top: 20px;
  text-align: center;
}

.login-privacy-note {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.3px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .login-modal,
.modal-fade-leave-active .login-modal {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .login-modal,
.modal-fade-leave-to .login-modal {
  opacity: 0;
  transform: scale(0.96) translateY(10px);
}
</style>
