<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { Song } from '@/types'
import { formatTime } from '@/utils/time'
import { buildBeatMapFromLowEnergy } from '@/modules/audio/BeatDetector'
import type { BeatMap } from '@/modules/audio'

const props = defineProps<{
  visible: boolean
  song?: Song | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'analyzed'): void
}>()

type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'failed'
type AnalysisMode = 'quick' | 'full'

const status = ref<AnalysisStatus>('idle')
const mode = ref<AnalysisMode>('quick')
const progress = ref(0)
const errorMessage = ref('')
const bpm = ref(0)
const beatCount = ref(0)
const cancelRequested = ref(false)
let audioContext: AudioContext | OfflineAudioContext | null = null

const BEATMAP_STORAGE_PREFIX = 'mineradio-local-beatmaps-v1:'
const BEATMAP_STORAGE_PREFIX_LEGACY = 'mineradio-beatmap-'

function readBeatmap(songId: string): string | null {
  try {
    let raw = localStorage.getItem(BEATMAP_STORAGE_PREFIX + songId)
    if (raw === null) {
      const legacy = localStorage.getItem(BEATMAP_STORAGE_PREFIX_LEGACY + songId)
      if (legacy !== null) {
        // 迁移旧数据到新键名
        localStorage.setItem(BEATMAP_STORAGE_PREFIX + songId, legacy)
        try {
          localStorage.removeItem(BEATMAP_STORAGE_PREFIX_LEGACY + songId)
        } catch (_) {}
        raw = legacy
      }
    }
    return raw
  } catch (_) {
    return null
  }
}

function writeBeatmap(songId: string, value: string): void {
  localStorage.setItem(BEATMAP_STORAGE_PREFIX + songId, value)
}

function removeBeatmap(songId: string): void {
  localStorage.removeItem(BEATMAP_STORAGE_PREFIX + songId)
}

const hasAnalysis = computed(() => {
  if (!props.song) return false
  return !!readBeatmap(props.song.id)
})

const analysisInfo = computed(() => {
  if (!props.song) return null
  try {
    const raw = readBeatmap(props.song.id)
    if (raw) {
      const data = JSON.parse(raw)
      return {
        bpm: data.bpm || 0,
        beatCount: data.visualBeatCount || 0,
        analyzedAt: data.analyzedAt ? new Date(data.analyzedAt).toLocaleString() : '',
        mode: data.mode || 'unknown',
      }
    }
  } catch (_) {}
  return null
})

const canStart = computed(() => {
  return props.song && status.value !== 'analyzing' && props.song.source === 'local'
})

async function getAudioBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  
  if (window.OfflineAudioContext) {
    const offlineCtx = new OfflineAudioContext(1, 1, 44100)
    audioContext = offlineCtx
    return await offlineCtx.decodeAudioData(arrayBuffer)
  } else {
    const ctx = new AudioContext()
    audioContext = ctx
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    return buffer
  }
}

function analyzeBuffer(buffer: AudioBuffer, quickMode: boolean): { beatMap: BeatMap; bpm: number } {
  const sampleRate = buffer.sampleRate
  const channelData = buffer.getChannelData(0)
  const duration = buffer.duration

  const hopSec = quickMode ? 0.02 : 0.01
  const hopSize = Math.floor(sampleRate * hopSec)
  const nFrames = Math.floor(channelData.length / hopSize)

  const lowEnergy: number[] = []
  const hitEnergy: number[] = []

  const lowCutoff = 200
  const highCutoff = 2000
  const lowBin = Math.floor(lowCutoff * hopSize / sampleRate)
  const highBin = Math.floor(highCutoff * hopSize / sampleRate)

  let lowSum = 0
  let hitSum = 0
  let frameCount = 0

  for (let i = 0; i < nFrames; i++) {
    const startIdx = i * hopSize
    let lowEnergyFrame = 0
    let hitEnergyFrame = 0

    for (let j = 0; j < hopSize && startIdx + j < channelData.length; j++) {
      const sample = channelData[startIdx + j]
      const absSample = Math.abs(sample)
      lowEnergyFrame += absSample
      hitEnergyFrame += sample * sample
    }

    lowEnergy.push(lowEnergyFrame / hopSize)
    hitEnergy.push(Math.sqrt(hitEnergyFrame / hopSize))
    frameCount++

    if (i % 500 === 0) {
      progress.value = (i / nFrames) * 0.8
    }

    if (cancelRequested.value) {
      throw new Error('Analysis cancelled')
    }
  }

  progress.value = 0.85

  const beatMap = buildBeatMapFromLowEnergy(
    new Float32Array(lowEnergy),
    new Float32Array(hitEnergy),
    hopSec,
    duration
  )

  progress.value = 0.95

  let calculatedBpm = 0
  if (beatMap.beats && beatMap.beats.length > 10) {
    const firstBeat = beatMap.beats[0].time
    const lastBeat = beatMap.beats[beatMap.beats.length - 1].time
    const beatDuration = lastBeat - firstBeat
    const beatInterval = beatDuration / (beatMap.beats.length - 1)
    calculatedBpm = beatInterval > 0 ? Math.round(60 / beatInterval) : 0
  }

  beatMap.bpm = calculatedBpm

  progress.value = 1

  return { beatMap, bpm: calculatedBpm }
}

async function startAnalysis() {
  if (!props.song || !props.song.url || status.value === 'analyzing') return

  status.value = 'analyzing'
  progress.value = 0
  errorMessage.value = ''
  bpm.value = 0
  beatCount.value = 0
  cancelRequested.value = false

  try {
    const url = props.song.url
    const quickMode = mode.value === 'quick'

    progress.value = 0.05
    const buffer = await getAudioBuffer(url)
    
    progress.value = 0.15

    const { beatMap, bpm: detectedBpm } = analyzeBuffer(buffer, quickMode)
    
    bpm.value = detectedBpm
    beatCount.value = beatMap.visualBeatCount || beatMap.beats?.length || 0

    const toSave = {
      ...beatMap,
      mode: quickMode ? 'quick' : 'full',
      analyzedAt: Date.now(),
    }

    try {
      writeBeatmap(props.song.id, JSON.stringify(toSave))
    } catch (e) {
      console.warn('Failed to save beatmap to localStorage:', e)
    }

    status.value = 'completed'
    emit('analyzed')
  } catch (e: any) {
    if (e.message === 'Analysis cancelled') {
      status.value = 'idle'
    } else {
      status.value = 'failed'
      errorMessage.value = e.message || '分析失败，请重试'
    }
  } finally {
    if (audioContext && 'close' in audioContext) {
      try {
        (audioContext as AudioContext).close()
      } catch (_) {}
    }
    audioContext = null
  }
}

function cancelAnalysis() {
  cancelRequested.value = true
}

function handleClose() {
  cancelRequested.value = true
  status.value = 'idle'
  progress.value = 0
  errorMessage.value = ''
  emit('close')
}

function deleteAnalysis() {
  if (!props.song) return
  if (!confirm('确定要删除节拍分析数据吗？')) return

  try {
    removeBeatmap(props.song.id)
    status.value = 'idle'
    bpm.value = 0
    beatCount.value = 0
  } catch (_) {}
}

watch(() => props.visible, (val) => {
  if (val) {
    status.value = 'idle'
    progress.value = 0
    errorMessage.value = ''
    bpm.value = 0
    beatCount.value = 0
    cancelRequested.value = false
    
    if (hasAnalysis.value && analysisInfo.value) {
      status.value = 'completed'
      bpm.value = analysisInfo.value.bpm
      beatCount.value = analysisInfo.value.beatCount
    }
  }
})

onUnmounted(() => {
  cancelRequested.value = true
  if (audioContext && 'close' in audioContext) {
    try {
      (audioContext as AudioContext).close()
    } catch (_) {}
  }
})
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="local-beat-modal">
      <div class="modal-backdrop" @click="handleClose"></div>
      <div class="modal-panel" @click.stop>
        <div class="modal-header">
          <h3>节拍分析</h3>
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
              <div class="song-duration">时长：{{ formatTime(song.duration) }}</div>
            </div>
          </div>

          <div v-if="song && song.source !== 'local'" class="not-supported">
            <div class="not-supported-icon">⚠️</div>
            <div class="not-supported-text">
              节拍分析仅支持本地音乐
            </div>
          </div>

          <template v-else-if="song">
            <div class="mode-tabs">
              <button
                class="mode-tab"
                :class="{ active: mode === 'quick' }"
                :disabled="status === 'analyzing'"
                @click="mode = 'quick'"
              >
                <span class="tab-title">快速分析</span>
                <span class="tab-desc">生成粗略节拍图谱（快）</span>
              </button>
              <button
                class="mode-tab"
                :class="{ active: mode === 'full' }"
                :disabled="status === 'analyzing'"
                @click="mode = 'full'"
              >
                <span class="tab-title">完整分析</span>
                <span class="tab-desc">精确分析整首歌（慢，更准）</span>
              </button>
            </div>

            <div class="analysis-section">
              <div class="status-bar">
                <div class="status-label">
                  <span v-if="status === 'idle'" class="status-text status--idle">
                    {{ hasAnalysis ? '已分析' : '等待分析' }}
                  </span>
                  <span v-else-if="status === 'analyzing'" class="status-text status--analyzing">
                    <span class="pulse-dot"></span>
                    分析中...
                  </span>
                  <span v-else-if="status === 'completed'" class="status-text status--completed">
                    ✓ 分析完成
                  </span>
                  <span v-else-if="status === 'failed'" class="status-text status--failed">
                    ✗ 分析失败
                  </span>
                </div>
                <div v-if="status === 'analyzing'" class="progress-percent">
                  {{ Math.round(progress * 100) }}%
                </div>
              </div>

              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: `${progress * 100}%` }"
                  :class="{ 'progress-fill--active': status === 'analyzing' }"
                ></div>
              </div>

              <div v-if="status === 'completed'" class="result-grid">
                <div class="result-item">
                  <div class="result-value">{{ bpm }}</div>
                  <div class="result-label">BPM</div>
                </div>
                <div class="result-item">
                  <div class="result-value">{{ beatCount }}</div>
                  <div class="result-label">节拍数</div>
                </div>
                <div class="result-item">
                  <div class="result-value">{{ mode === 'quick' ? '快速' : '完整' }}</div>
                  <div class="result-label">分析模式</div>
                </div>
              </div>

              <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            </div>
          </template>
        </div>

        <div class="modal-footer">
          <button 
            v-if="status === 'completed'"
            class="btn btn--secondary" 
            @click="deleteAnalysis"
          >
            删除分析
          </button>
          <button 
            v-else-if="status === 'analyzing'"
            class="btn btn--secondary" 
            @click="cancelAnalysis"
          >
            取消
          </button>
          <button 
            v-else
            class="btn btn--secondary" 
            @click="handleClose"
          >
            暂不分析
          </button>
          <button 
            class="btn btn--primary" 
            :disabled="!canStart"
            @click="startAnalysis"
          >
            {{ status === 'analyzing' ? '分析中...' : hasAnalysis ? '重新分析' : '开始分析' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.local-beat-modal {
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
  width: min(460px, 92vw);
  max-height: 80vh;
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
  margin-bottom: 16px;
}

.song-cover {
  width: 52px;
  height: 52px;
  border-radius: 10px;
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
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.song-duration {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.not-supported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
}

.not-supported-icon {
  font-size: 40px;
}

.not-supported-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.mode-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  text-align: left;
}

.mode-tab:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}

.mode-tab.active {
  background: rgba(217, 91, 103, 0.12);
  border-color: rgba(217, 91, 103, 0.4);
}

.mode-tab:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tab-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.tab-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.analysis-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 16px;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.status-text {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status--idle {
  color: rgba(255, 255, 255, 0.6);
}

.status--analyzing {
  color: #f4d28a;
}

.status--completed {
  color: #4ade80;
}

.status--failed {
  color: #ff6b6b;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f4d28a;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.progress-percent {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Consolas', monospace;
}

.progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 16px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #e87882);
  border-radius: 3px;
  transition: width 0.15s ease;
}

.progress-fill--active {
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.result-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.result-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.error-message {
  margin: 12px 0 0;
  font-size: 12px;
  color: #ff6b6b;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.btn {
  flex: 1;
  padding: 11px 20px;
  border-radius: 10px;
  font-size: 13px;
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
