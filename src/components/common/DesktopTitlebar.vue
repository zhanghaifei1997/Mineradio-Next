<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useFxStore } from '@/stores/fx'
import UpdateEntryButton from '@/components/settings/UpdateEntryButton.vue'

const emit = defineEmits<{
  (e: 'open-settings'): void
  (e: 'toggle-guide'): void
}>()

const fx = useFxStore()
const isDesktop = (window as any).electronAPI?.isDesktop || false

const isMaximized = ref(false)
let removeWindowStateListener: (() => void) | null = null

const appVersion = computed(() => {
  return (window as any).electronAPI?.app?.getVersion ? '' : 'v2.0.0'
})

async function loadWindowState() {
  if (!isDesktop) return
  try {
    const maximized = await (window as any).electronAPI.window.isMaximized()
    isMaximized.value = maximized
  } catch (e) {
    console.warn('Failed to get window state:', e)
  }
}

function minimize() {
  if (!isDesktop) return
  (window as any).electronAPI.window.minimize()
}

function toggleMaximize() {
  if (!isDesktop) return
  (window as any).electronAPI.window.maximize()
}

function close() {
  if (!isDesktop) return
  (window as any).electronAPI.window.close()
}

function handleDoubleClick() {
  toggleMaximize()
}

function toggleLayoutMode() {
  fx.toggleLayoutMode()
}

onMounted(() => {
  loadWindowState()

  if (isDesktop) {
    document.body.classList.add('desktop-titlebar-active')
  }

  if (isDesktop && (window as any).electronAPI?.onWindowStateChange) {
    removeWindowStateListener = (window as any).electronAPI.onWindowStateChange((state: any) => {
      isMaximized.value = state.isMaximized || false
    })
  }
})

onUnmounted(() => {
  document.body.classList.remove('desktop-titlebar-active')
  
  if (removeWindowStateListener) {
    removeWindowStateListener()
  }
})
</script>

<template>
  <div v-if="isDesktop" class="desktop-titlebar">
    <div class="titlebar-left" @dblclick="handleDoubleClick">
      <div class="app-icon">🎵</div>
      <div class="app-title">Mineradio</div>
    </div>

    <div class="titlebar-drag-region" @dblclick="handleDoubleClick"></div>

    <div class="titlebar-right">
      <UpdateEntryButton @click="emit('open-settings')" />

      <button class="titlebar-btn guide-btn" @click="emit('toggle-guide')" title="视觉引导">
        <span>?</span>
      </button>

      <button 
        class="titlebar-btn mode-btn" 
        @click="toggleLayoutMode" 
        :title="fx.layoutMode === 'diy' ? '切换到简约模式' : '切换到 DIY 模式'"
      >
        <span>{{ fx.layoutMode === 'diy' ? '✨' : '🎵' }}</span>
      </button>

      <div class="window-controls">
        <button class="window-btn minimize-btn" @click="minimize" title="最小化">
          <svg viewBox="0 0 12 12" width="12" height="12">
            <rect x="2" y="5" width="8" height="2" fill="currentColor" />
          </svg>
        </button>
        <button class="window-btn maximize-btn" @click="toggleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <svg v-if="!isMaximized" viewBox="0 0 12 12" width="12" height="12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
          <svg v-else viewBox="0 0 12 12" width="12" height="12">
            <path d="M3 2h5v1H3v6H2V3a1 1 0 0 1 1-1zM7 4h2v5H7V4zm1-1h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" />
          </svg>
        </button>
        <button class="window-btn close-btn" @click="close" title="关闭">
          <svg viewBox="0 0 12 12" width="12" height="12">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.desktop-titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 9999;
  -webkit-app-region: drag;
  user-select: none;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: drag;
}

.app-icon {
  font-size: 18px;
  line-height: 1;
}

.app-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  letter-spacing: 0.3px;
}

.titlebar-drag-region {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.titlebar-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.titlebar-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text);
}

.guide-btn {
  font-weight: 600;
  font-family: serif;
}

.mode-btn {
  font-size: 16px;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.window-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.window-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.window-btn.close-btn:hover {
  background: rgba(255, 82, 82, 0.8);
  color: #fff;
}

[data-theme='light'] .desktop-titlebar {
  background: rgba(255, 255, 255, 0.85);
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

[data-theme='light'] .window-btn.close-btn:hover {
  background: #ff5252;
}
</style>
