<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useLyricsStore } from '@/stores/lyrics'
import { usePlayerStore } from '@/stores/player'
import { parseCustomLyricText } from '@/modules/lyrics'
import type { LyricLine } from '@/modules/lyrics'
import type { Song } from '@/types'

const props = defineProps<{
  visible: boolean
  song?: Song | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const lyricsStore = useLyricsStore()
const player = usePlayerStore()

const lyricText = ref('')
const parseError = ref('')
const successMessage = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const previewTime = ref(0)
let previewTimer: number | null = null

const parsedLines = computed<LyricLine[]>(() => {
  if (!lyricText.value.trim()) return []
  try {
    const lines = parseCustomLyricText(lyricText.value, player.duration || 0)
    parseError.value = ''
    return lines
  } catch (e) {
    parseError.value = '歌词格式解析失败'
    return []
  }
})

const hasCustomLyric = computed(() => {
  if (!props.song) return false
  const existing = lyricsStore.getCustomLyric(props.song.id)
  return !!(existing && existing.text.trim())
})

const canSave = computed(() => {
  return lyricText.value.trim().length > 0 && parsedLines.value.length > 0 && !parseError.value
})

const currentPreviewIndex = computed(() => {
  if (parsedLines.value.length === 0) return -1
  let idx = -1
  for (let i = 0; i < parsedLines.value.length; i++) {
    if (parsedLines.value[i].time <= previewTime.value) {
      idx = i
    } else {
      break
    }
  }
  return idx
})

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function loadExistingLyric() {
  if (!props.song) return
  const existing = lyricsStore.getCustomLyric(props.song.id)
  if (existing) {
    lyricText.value = existing.text
  } else {
    lyricText.value = ''
  }
  parseError.value = ''
  successMessage.value = ''
  previewTime.value = 0
}

function handleImportFile() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const text = ev.target?.result as string
    lyricText.value = text
  }
  reader.readAsText(file)
  target.value = ''
}

function handleClear() {
  if (confirm('确定要清空歌词吗？')) {
    lyricText.value = ''
    parseError.value = ''
  }
}

function handleSave() {
  if (!props.song || !canSave.value) return

  try {
    lyricsStore.setCustomLyric(props.song.id, lyricText.value)
    
    const customLyricsData = loadAllCustomLyrics()
    customLyricsData[props.song.id] = { text: lyricText.value }
    saveAllCustomLyrics(customLyricsData)

    successMessage.value = '保存成功'
    setTimeout(() => {
      successMessage.value = ''
    }, 2000)

    emit('saved')
  } catch (e) {
    parseError.value = '保存失败'
  }
}

function handleRestoreDefault() {
  if (!props.song) return
  if (!confirm('确定要删除自定义歌词并恢复在线歌词吗？')) return

  try {
    const customLyricsData = loadAllCustomLyrics()
    delete customLyricsData[props.song.id]
    saveAllCustomLyrics(customLyricsData)

    lyricText.value = ''
    parseError.value = ''
    successMessage.value = '已恢复默认歌词'
    
    if (player.currentSong?.id === props.song.id) {
      lyricsStore.applyOriginalLyrics()
    }

    setTimeout(() => {
      successMessage.value = ''
    }, 2000)
  } catch (e) {
    parseError.value = '恢复失败'
  }
}

function loadAllCustomLyrics(): Record<string, { text: string }> {
  try {
    const raw = localStorage.getItem('mineradio-custom-lyrics')
    if (raw) return JSON.parse(raw)
  } catch (_) {}
  return {}
}

function saveAllCustomLyrics(data: Record<string, { text: string }>) {
  try {
    localStorage.setItem('mineradio-custom-lyrics', JSON.stringify(data))
  } catch (_) {}
}

function startPreview() {
  if (previewTimer) return
  const startTime = performance.now()
  const startPreviewTime = previewTime.value
  const duration = parsedLines.value.length > 0 
    ? Math.max(...parsedLines.value.map(l => l.time)) + 5 
    : 30

  function tick() {
    const elapsed = (performance.now() - startTime) / 1000
    previewTime.value = startPreviewTime + elapsed
    if (previewTime.value < duration) {
      previewTimer = requestAnimationFrame(tick)
    } else {
      previewTime.value = 0
      previewTimer = null
    }
  }
  previewTimer = requestAnimationFrame(tick)
}

function stopPreview() {
  if (previewTimer) {
    cancelAnimationFrame(previewTimer)
    previewTimer = null
  }
}

function handleClose() {
  stopPreview()
  emit('close')
}

watch(() => props.visible, (val) => {
  if (val) {
    loadExistingLyric()
    nextTick(() => {
      startPreview()
    })
  } else {
    stopPreview()
  }
})

import { nextTick } from 'vue'

onUnmounted(() => {
  stopPreview()
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="custom-lyric-modal">
      <div class="modal-backdrop" @click="handleClose"></div>
      <div class="modal-panel" @click.stop>
        <div class="modal-header">
          <h3>自定义歌词</h3>
          <button class="modal-close" @click="handleClose">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="song" class="song-info-bar">
            <div class="song-cover">
              <img v-if="song.coverUrl" :src="song.coverUrl" alt="" />
              <div class="cover-placeholder" v-else></div>
            </div>
            <div class="song-meta">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-artist">{{ song.artists.map(a => a.name).join(' / ') }}</div>
            </div>
            <div v-if="hasCustomLyric" class="custom-badge">
              已有自定义歌词
            </div>
          </div>

          <div class="editor-container">
            <div class="editor-panel">
              <div class="panel-header">
                <span class="panel-title">歌词编辑</span>
                <span class="line-count">{{ parsedLines.length }} 行</span>
              </div>
              <textarea
                v-model="lyricText"
                class="lyric-textarea"
                placeholder="粘贴 LRC 格式歌词，或直接输入文本歌词（每行一句）...&#10;&#10;LRC 格式示例：&#10;[00:00.00]第一句歌词&#10;[00:05.00]第二句歌词"
                spellcheck="false"
              ></textarea>
              <p v-if="parseError" class="error-text">{{ parseError }}</p>
            </div>

            <div class="preview-panel">
              <div class="panel-header">
                <span class="panel-title">实时预览</span>
                <span class="preview-time">{{ formatTime(previewTime) }}</span>
              </div>
              <div class="lyric-preview">
                <div v-if="parsedLines.length === 0" class="empty-preview">
                  输入歌词后在此预览效果
                </div>
                <div v-else class="preview-lines">
                  <div
                    v-for="(line, idx) in parsedLines"
                    :key="idx"
                    class="preview-line"
                    :class="{ 'preview-line--current': idx === currentPreviewIndex }"
                  >
                    <span class="line-time">{{ formatTime(line.time) }}</span>
                    <span class="line-text">{{ line.text }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn--secondary" @click="handleImportFile">
            导入LRC文件
          </button>
          <button class="btn btn--secondary" @click="handleClear">
            清空
          </button>
          <button class="btn btn--secondary" @click="handleRestoreDefault" :disabled="!hasCustomLyric">
            恢复默认
          </button>
          <button class="btn btn--primary" :disabled="!canSave" @click="handleSave">
            保存
          </button>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept=".lrc,.txt"
          style="display: none"
          @change="handleFileChange"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.custom-lyric-modal {
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
  backdrop-filter: blur(4px);
}

.modal-panel {
  position: relative;
  width: min(720px, 94vw);
  max-height: 85vh;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.modal-close {
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 13px;
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
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.song-info-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  margin-bottom: 14px;
}

.song-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4));
}

.song-meta {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-badge {
  padding: 4px 10px;
  background: rgba(100, 200, 100, 0.15);
  color: #6ee76e;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.editor-container {
  display: flex;
  gap: 14px;
  height: 380px;
}

.editor-panel,
.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.panel-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.line-count,
.preview-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.lyric-textarea {
  flex: 1;
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.6;
  resize: none;
  outline: none;
  box-sizing: border-box;
}

.lyric-textarea::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.error-text {
  margin: 8px 12px;
  font-size: 12px;
  color: #ff6b6b;
}

.lyric-preview {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-size: 13px;
}

.preview-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-line {
  display: flex;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  transition: all 0.2s;
}

.preview-line--current {
  background: rgba(217, 91, 103, 0.15);
}

.preview-line--current .line-text {
  color: #fff;
  font-weight: 600;
}

.line-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'Consolas', monospace;
  flex-shrink: 0;
  padding-top: 1px;
}

.line-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.success-message {
  margin: 12px 0 0;
  font-size: 13px;
  color: #4ade80;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.btn {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  border: none;
  white-space: nowrap;
}

.btn--secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}

.btn--secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.btn--secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn--primary {
  background: linear-gradient(135deg, #d95b67, #e87882);
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
  margin-left: auto;
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
