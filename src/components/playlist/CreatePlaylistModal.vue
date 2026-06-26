<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import type { MusicSource } from '@/types'

const props = defineProps<{
  visible: boolean
  defaultSource?: MusicSource
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created', playlist: any): void
}>()

const userStore = useUserStore()
const playlistName = ref('')
const privacy = ref<'public' | 'private'>('private')
const loading = ref(false)
const errorMessage = ref('')

const selectedSource = ref<MusicSource>(props.defaultSource || 'netease')

const availableSources = computed(() => {
  const sources: MusicSource[] = []
  if (userStore.neteaseAccount.loggedIn) sources.push('netease')
  if (userStore.qqmusicAccount.loggedIn) sources.push('qqmusic')
  if (userStore.kugouAccount.loggedIn) sources.push('kugou')
  return sources
})

const canCreate = computed(() => playlistName.value.trim().length > 0 && !loading.value)

function handleClose() {
  playlistName.value = ''
  privacy.value = 'private'
  errorMessage.value = ''
  emit('close')
}

async function handleCreate() {
  if (!canCreate.value) return
  errorMessage.value = ''
  loading.value = true
  try {
    const result = await userStore.createPlaylist(selectedSource.value, playlistName.value.trim(), privacy.value)
    if (result) {
      emit('created', result)
      handleClose()
    } else {
      errorMessage.value = '创建歌单失败，请重试'
    }
  } catch (e) {
    errorMessage.value = '创建歌单失败，请重试'
  } finally {
    loading.value = false
  }
}

const sourceLabels: Record<MusicSource, string> = {
  netease: '网易云音乐',
  qqmusic: 'QQ 音乐',
  kugou: '酷狗音乐',
  local: '本地音乐',
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="create-playlist-modal">
      <div class="modal-backdrop" @click="handleClose"></div>
      <div class="modal-panel" @click.stop>
        <div class="modal-header">
          <h3>创建歌单</h3>
          <button class="modal-close" @click="handleClose">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>歌单名称</label>
            <input
              v-model="playlistName"
              type="text"
              class="form-input"
              placeholder="请输入歌单名称"
              maxlength="40"
              @keyup.enter="handleCreate"
            />
            <span class="char-count">{{ playlistName.length }}/40</span>
          </div>

          <div v-if="availableSources.length > 1" class="form-group">
            <label>选择平台</label>
            <div class="source-options">
              <button
                v-for="source in availableSources"
                :key="source"
                class="source-option"
                :class="{ active: selectedSource === source }"
                @click="selectedSource = source"
              >
                {{ sourceLabels[source] }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>歌单类型</label>
            <div class="privacy-options">
              <button
                class="privacy-option"
                :class="{ active: privacy === 'private' }"
                @click="privacy = 'private'"
              >
                <span class="privacy-icon">🔒</span>
                <span class="privacy-text">
                  <strong>私密歌单</strong>
                  <small>只有自己可见</small>
                </span>
              </button>
              <button
                class="privacy-option"
                :class="{ active: privacy === 'public' }"
                @click="privacy = 'public'"
              >
                <span class="privacy-icon">🌐</span>
                <span class="privacy-text">
                  <strong>公开歌单</strong>
                  <small>所有人可见</small>
                </span>
              </button>
            </div>
          </div>

          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn--secondary" @click="handleClose">取消</button>
          <button class="btn btn--primary" :disabled="!canCreate" @click="handleCreate">
            {{ loading ? '创建中...' : '创建歌单' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.create-playlist-modal {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: var(--blur-modal);
  -webkit-backdrop-filter: var(--blur-modal);
}

.modal-panel {
  position: relative;
  width: min(420px, 92vw);
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.modal-close {
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

.modal-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 10px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: rgba(217, 91, 103, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.char-count {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.source-options {
  display: flex;
  gap: 8px;
}

.source-option {
  flex: 1;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.source-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.source-option.active {
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.5);
  color: #fff;
}

.privacy-options {
  display: flex;
  gap: 10px;
}

.privacy-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  text-align: left;
}

.privacy-option:hover {
  background: rgba(255, 255, 255, 0.08);
}

.privacy-option.active {
  background: rgba(217, 91, 103, 0.15);
  border-color: rgba(217, 91, 103, 0.5);
}

.privacy-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.privacy-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.privacy-text strong {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
}

.privacy-text small {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.error-message {
  margin: 12px 0 0;
  font-size: 13px;
  color: #ff6b6b;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.btn {
  flex: 1;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  border: none;
}

.btn--secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.btn--secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.btn--primary {
  background: linear-gradient(135deg, #d95b67, #e87882);
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-active .modal-panel,
.fade-leave-active .modal-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .modal-panel,
.fade-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
