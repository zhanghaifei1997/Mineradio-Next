<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isDesktop = (window as any).electronAPI?.isDesktop || false

const updateState = ref<any>({
  state: 'idle',
  currentVersion: '',
  latestVersion: null,
  updateAvailable: false,
  downloadProgress: 0,
  extractProgress: 0,
  error: null,
  releaseInfo: null,
})

const isChecking = ref(false)
const isDownloading = ref(false)

let removeStateListener: (() => void) | null = null

async function loadInitialState() {
  if (!isDesktop) return
  try {
    const state = await (window as any).electronAPI.update.getState()
    if (state) {
      updateState.value = state
    }
  } catch (e) {
    console.warn('Failed to get update state:', e)
  }
}

async function checkForUpdates() {
  if (!isDesktop || isChecking.value) return
  isChecking.value = true

  try {
    const result = await (window as any).electronAPI.update.check()
    if (result && result.ok) {
      updateState.value = result
    }
  } catch (e) {
    console.warn('Update check failed:', e)
  } finally {
    isChecking.value = false
  }
}

async function downloadUpdate() {
  if (!isDesktop || isDownloading.value) return
  isDownloading.value = true

  try {
    const result = await (window as any).electronAPI.update.download()
    if (!result?.ok) {
      console.warn('Download failed:', result?.error)
    }
  } catch (e) {
    console.warn('Update download failed:', e)
  } finally {
    isDownloading.value = false
  }
}

async function installUpdate() {
  if (!isDesktop) return
  try {
    await (window as any).electronAPI.update.install()
  } catch (e) {
    console.warn('Update install failed:', e)
  }
}

async function cancelUpdate() {
  if (!isDesktop) return
  try {
    await (window as any).electronAPI.update.cancel()
  } catch (e) {
    console.warn('Cancel update failed:', e)
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function getStateText() {
  const map: Record<string, string> = {
    idle: '未检查更新',
    checking: '正在检查更新...',
    checked: '检查完成',
    downloading: '正在下载更新...',
    extracting: '正在解压更新...',
    verifying: '正在验证文件...',
    ready: '更新已就绪',
    error: '更新出错',
  }
  return map[updateState.value.state] || updateState.value.state
}

onMounted(() => {
  loadInitialState()

  if (isDesktop && (window as any).electronAPI?.update?.onStateChanged) {
    removeStateListener = (window as any).electronAPI.update.onStateChanged((state: any) => {
      updateState.value = state
      isChecking.value = state.state === 'checking'
      isDownloading.value = state.state === 'downloading'
    })
  }
})

onUnmounted(() => {
  if (removeStateListener) {
    removeStateListener()
  }
})
</script>

<template>
  <div class="update-panel">
    <div class="about-row">
      <span class="about-label">当前版本</span>
      <span class="about-value">v{{ updateState.currentVersion || '2.0.0' }}</span>
    </div>
    <div class="about-row" v-if="updateState.latestVersion">
      <span class="about-label">最新版本</span>
      <span class="about-value latest">v{{ updateState.latestVersion }}</span>
    </div>
    <div class="about-row" v-if="updateState.releaseInfo?.publishedAt">
      <span class="about-label">发布时间</span>
      <span class="about-value">{{ formatDate(updateState.releaseInfo.publishedAt) }}</span>
    </div>
    <div class="about-row" v-if="updateState.releaseInfo?.isPrerelease">
      <span class="about-label">版本类型</span>
      <span class="about-value preview-tag">预览版</span>
    </div>

    <div class="state-row" style="margin-top: 12px;">
      <span class="state-dot" :class="updateState.state"></span>
      <span class="state-text">{{ getStateText() }}</span>
    </div>
    <div v-if="updateState.state === 'downloading'" class="progress-wrap">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: updateState.downloadProgress + '%' }"></div>
      </div>
      <span class="progress-text">{{ updateState.downloadProgress }}%</span>
    </div>
    <div v-if="updateState.error" class="error-text">
      {{ updateState.error }}
    </div>

    <div v-if="updateState.releaseInfo?.notes" class="release-notes-wrap">
      <div class="notes-label">更新日志</div>
      <div class="release-notes">
        <pre>{{ updateState.releaseInfo.notes }}</pre>
      </div>
    </div>

    <div class="button-row" style="margin-top: 16px;">
      <button
        v-if="!updateState.updateAvailable && updateState.state !== 'checking'"
        class="action-btn primary"
        @click="checkForUpdates"
        :disabled="isChecking"
      >
        {{ isChecking ? '检查中...' : '检查更新' }}
      </button>

      <button
        v-if="updateState.updateAvailable && updateState.state === 'checked'"
        class="action-btn primary"
        @click="downloadUpdate"
        :disabled="isDownloading"
      >
        立即更新
      </button>

      <button
        v-if="updateState.state === 'downloading'"
        class="action-btn secondary"
        @click="cancelUpdate"
      >
        取消下载
      </button>

      <button
        v-if="updateState.state === 'ready'"
        class="action-btn primary"
        @click="installUpdate"
      >
        重启并安装
      </button>

      <button
        v-if="updateState.state === 'error'"
        class="action-btn secondary"
        @click="checkForUpdates"
      >
        重新检查
      </button>
    </div>
  </div>
</template>

<style scoped>
.update-panel {
  color: #fff;
}

.about-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
}

.about-label {
  color: rgba(255, 255, 255, 0.5);
}

.about-value {
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.about-value.latest {
  color: #d95b67;
}

.preview-tag {
  background: rgba(217, 91, 103, 0.2);
  color: #d95b67;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.state-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
}

.state-dot.checking,
.state-dot.downloading,
.state-dot.extracting,
.state-dot.verifying {
  background: #f0a020;
  animation: pulse 1.5s infinite;
}

.state-dot.ready {
  background: #4caf50;
}

.state-dot.error {
  background: #ff5252;
}

.state-dot.checked {
  background: #2196f3;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.state-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a020);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  min-width: 40px;
  text-align: right;
}

.error-text {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 82, 82, 0.1);
  border: 1px solid rgba(255, 82, 82, 0.2);
  border-radius: 6px;
  font-size: 12px;
  color: #ff6b6b;
  word-break: break-all;
}

.release-notes-wrap {
  margin-top: 12px;
}

.notes-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.release-notes {
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  max-height: 160px;
  overflow-y: auto;
}

.release-notes pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
}

.button-row {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.primary {
  background: #d95b67;
  color: #fff;
}

.action-btn.primary:hover:not(:disabled) {
  background: #e06a75;
  transform: translateY(-1px);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.12);
}
</style>
