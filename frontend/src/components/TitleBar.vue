<template>
  <div id="desktop-titlebar" aria-label="window controls">
    <div class="desktop-drag-region">
      <div class="desktop-app-mark" aria-hidden="true"></div>
      <div class="desktop-app-title" aria-hidden="true"></div>
    </div>
    <div class="desktop-window-controls">
      <button
        id="diy-mode-btn"
        class="desktop-mode-btn"
        :class="{ on: settings.diyMode }"
        type="button"
        @click="settings.setDiyMode(!settings.diyMode)"
        title="DIY 玩家模式"
        aria-label="DIY 玩家模式"
        :aria-pressed="settings.diyMode"
      >DIY</button>
      <button
        class="desktop-window-btn"
        data-window-action="minimize"
        title="最小化"
        aria-label="最小化"
        @click="desktop.minimize()"
      >
        <svg viewBox="0 0 16 16"><path d="M3 8h10"/></svg>
      </button>
      <button
        class="desktop-window-btn"
        data-window-action="maximize"
        title="全屏"
        aria-label="全屏"
        @click="desktop.toggleMaximize()"
      >
        <svg class="icon-maximize" viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" rx="1.5"/></svg>
        <svg v-if="isMaximized" class="icon-restore" viewBox="0 0 16 16"><path d="M5 3.5h7.5v7.5"/><rect x="3.5" y="5.5" width="7" height="7" rx="1.3"/></svg>
      </button>
      <button
        class="desktop-window-btn close"
        data-window-action="close"
        title="关闭"
        aria-label="关闭"
        @click="desktop.close()"
      >
        <svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { desktop } from '@/services/desktop'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const isMaximized = ref(false)

let unlistenState: (() => void) | null = null

onMounted(async () => {
  // 监听窗口状态变化
  unlistenState = desktop.onStateChange((state) => {
    isMaximized.value = state.isMaximized
  })
  // 初始化窗口状态
  try {
    const state = await desktop.getState()
    if (state) isMaximized.value = state.isMaximized
  } catch {
    // ignore
  }
})

onUnmounted(() => {
  unlistenState?.()
})
</script>
