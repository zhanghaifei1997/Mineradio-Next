<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useHotkeysStore } from '@/stores/hotkeys'
import type { HotkeyAction, HotkeyConflict } from '@/stores/hotkeys'

const hotkeys = useHotkeysStore()

const conflictMessage = ref<string | null>(null)

function handleKeyDown(e: KeyboardEvent) {
  if (!hotkeys.recordingAction) return

  e.preventDefault()
  e.stopPropagation()

  if (e.key === 'Escape') {
    hotkeys.stopRecording()
    conflictMessage.value = null
    return
  }

  const result = hotkeys.handleRecordedKey(e)
  if (result.success) {
    conflictMessage.value = null
  } else if (result.conflict) {
    conflictMessage.value = `该快捷键已被「${hotkeys.getActionName(result.conflict.conflictAction)}」占用`
    setTimeout(() => {
      conflictMessage.value = null
    }, 2000)
  }
}

function startRecord(action: HotkeyAction) {
  hotkeys.startRecording(action)
  conflictMessage.value = null
}

function stopRecord() {
  hotkeys.stopRecording()
  conflictMessage.value = null
}

function resetHotkeys() {
  hotkeys.resetToDefaults()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true)
})
</script>

<template>
  <div class="hotkey-settings">
    <div class="settings-section">
      <div class="setting-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="hotkeys.globalEnabled"
            @change="hotkeys.setGlobalEnabled(($event.target as HTMLInputElement).checked)"
          />
          <span>启用全局快捷键</span>
        </label>
      </div>
    </div>

    <div class="conflict-tip" v-if="conflictMessage">
      ⚠️ {{ conflictMessage }}
    </div>

    <div class="hotkey-list">
      <div
        v-for="hotkey in hotkeys.hotkeys"
        :key="hotkey.action"
        class="hotkey-item"
        :class="{ recording: hotkeys.recordingAction === hotkey.action }"
      >
        <div class="hotkey-info">
          <span class="hotkey-name">{{ hotkeys.getActionName(hotkey.action) }}</span>
        </div>
        <div class="hotkey-actions">
          <button
            class="hotkey-key"
            :class="{ 
              disabled: !hotkeys.globalEnabled,
              recording: hotkeys.recordingAction === hotkey.action 
            }"
            :disabled="!hotkeys.globalEnabled"
            @click="startRecord(hotkey.action)"
          >
            <template v-if="hotkeys.recordingAction === hotkey.action">
              <span class="recording-text">按下快捷键...</span>
            </template>
            <template v-else>
              {{ hotkey.accelerator }}
            </template>
          </button>
          <button
            v-if="hotkeys.recordingAction === hotkey.action"
            class="cancel-btn"
            @click="stopRecord"
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <div class="settings-footer">
      <button class="reset-btn" @click="resetHotkeys">
        恢复默认
      </button>
    </div>
  </div>
</template>

<style scoped>
.hotkey-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conflict-tip {
  padding: 8px 12px;
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 8px;
  font-size: 12px;
  color: #ff9800;
}

.hotkey-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hotkey-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background 0.15s;
}

.hotkey-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.hotkey-item.recording {
  background: rgba(217, 91, 103, 0.1);
}

.hotkey-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.hotkey-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hotkey-key {
  min-width: 140px;
  padding: 6px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.hotkey-key:hover:not(.disabled) {
  border-color: rgba(217, 91, 103, 0.4);
  background: rgba(217, 91, 103, 0.1);
  color: #fff;
}

.hotkey-key.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hotkey-key.recording {
  border-color: rgba(217, 91, 103, 0.6);
  background: rgba(217, 91, 103, 0.15);
  color: #fff;
}

.recording-text {
  font-style: italic;
  font-family: inherit;
  font-size: 11px;
}

.cancel-btn {
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
}

.settings-footer {
  display: flex;
  justify-content: center;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.reset-btn {
  padding: 6px 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
}
</style>
