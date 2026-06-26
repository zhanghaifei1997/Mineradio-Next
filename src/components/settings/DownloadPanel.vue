<script setup lang="ts">
import { computed } from 'vue'
import { useCacheStore } from '@/stores/cache'
import type { QualityLevel } from '@/types'

const cache = useCacheStore()

const qualityOptions = [
  { id: 'standard' as QualityLevel, name: '标准 (128kbps)' },
  { id: 'higher' as QualityLevel, name: '较高 (192kbps)' },
  { id: 'exhigh' as QualityLevel, name: '极高 (320kbps)' },
  { id: 'lossless' as QualityLevel, name: '无损 (FLAC)' },
  { id: 'hires' as QualityLevel, name: 'Hi-Res' },
]

const downloadingTasks = computed(() => cache.downloadTasks.filter(t => t.status === 'downloading' || t.status === 'pending'))
const completedTasks = computed(() => cache.downloadTasks.filter(t => t.status === 'completed'))
const failedTasks = computed(() => cache.downloadTasks.filter(t => t.status === 'failed'))

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: '等待中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

function getStatusClass(status: string): string {
  return `status--${status}`
}

function formatSpeed(speed: number): string {
  if (speed === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(speed) / Math.log(k))
  return parseFloat((speed / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function retryDownload(taskId: string) {
  const task = cache.downloadTasks.find(t => t.id === taskId)
  if (task) {
    task.status = 'pending'
    task.progress = 0
    task.error = undefined
    cache.startDownload(taskId)
  }
}
</script>

<template>
  <div class="download-panel">
    <div v-if="downloadingTasks.length > 0" class="download-section">
      <div class="section-header">
        <span class="section-title">正在下载</span>
        <span class="section-count">{{ downloadingTasks.length }}</span>
      </div>
      <div class="task-list">
        <div
          v-for="task in downloadingTasks"
          :key="task.id"
          class="download-task"
        >
          <div class="task-cover">
            <img :src="task.song.coverUrl" alt="" v-if="task.song.coverUrl" />
            <div class="cover-placeholder" v-else></div>
          </div>
          <div class="task-info">
            <div class="task-name">{{ task.song.name }}</div>
            <div class="task-artist">
              {{ task.song.artists.map(a => a.name).join(' / ') }}
            </div>
            <div class="task-progress-bar">
              <div class="progress-fill" :style="{ width: task.progress + '%' }"></div>
            </div>
            <div class="task-meta">
              <span class="task-status" :class="getStatusClass(task.status)">
                {{ getStatusText(task.status) }}
              </span>
              <span class="task-size">
                {{ cache.formatSize(task.downloadedSize) }} / {{ task.totalSize > 0 ? cache.formatSize(task.totalSize) : '...' }}
              </span>
              <span v-if="task.status === 'downloading'" class="task-speed">
                {{ formatSpeed(task.speed) }}
              </span>
            </div>
          </div>
          <button class="cancel-btn" @click="cache.cancelDownload(task.id)" title="取消下载">
            ✕
          </button>
        </div>
      </div>
    </div>

    <div v-if="completedTasks.length > 0" class="download-section">
      <div class="section-header">
        <span class="section-title">已完成</span>
        <span class="section-count">{{ completedTasks.length }}</span>
        <button class="clear-btn" @click="cache.removeCompletedDownloads()">
          清除记录
        </button>
      </div>
      <div class="task-list">
        <div
          v-for="task in completedTasks"
          :key="task.id"
          class="download-task download-task--completed"
        >
          <div class="task-cover">
            <img :src="task.song.coverUrl" alt="" v-if="task.song.coverUrl" />
            <div class="cover-placeholder" v-else></div>
          </div>
          <div class="task-info">
            <div class="task-name">{{ task.song.name }}</div>
            <div class="task-artist">
              {{ task.song.artists.map(a => a.name).join(' / ') }}
            </div>
            <div class="task-meta">
              <span class="task-status status--completed">✓ 已完成</span>
              <span class="task-size">{{ cache.formatSize(task.totalSize) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="failedTasks.length > 0" class="download-section">
      <div class="section-header">
        <span class="section-title">下载失败</span>
        <span class="section-count">{{ failedTasks.length }}</span>
      </div>
      <div class="task-list">
        <div
          v-for="task in failedTasks"
          :key="task.id"
          class="download-task download-task--failed"
        >
          <div class="task-cover">
            <img :src="task.song.coverUrl" alt="" v-if="task.song.coverUrl" />
            <div class="cover-placeholder" v-else></div>
          </div>
          <div class="task-info">
            <div class="task-name">{{ task.song.name }}</div>
            <div class="task-artist">
              {{ task.song.artists.map(a => a.name).join(' / ') }}
            </div>
            <div class="task-meta">
              <span class="task-status status--failed">✕ 失败</span>
              <span class="task-error" v-if="task.error">{{ task.error }}</span>
            </div>
          </div>
          <button class="retry-btn" @click="retryDownload(task.id)" title="重试">
            ↻
          </button>
        </div>
      </div>
    </div>

    <div v-if="cache.downloadTasks.length === 0" class="empty-state">
      <div class="empty-icon">📥</div>
      <div class="empty-text">暂无下载任务</div>
      <div class="empty-hint">在歌曲详情页点击下载按钮开始下载</div>
    </div>

    <div class="download-settings">
      <div class="section-title">下载设置</div>
      <div class="setting-row">
        <label>默认下载音质</label>
        <div class="segmented">
          <button
            v-for="q in qualityOptions"
            :key="q.id"
            class="seg-btn"
            :class="{ active: false }"
          >
            {{ q.name }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <label class="checkbox-label">
          <input type="checkbox" :checked="true" />
          <span>下载完成通知</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.download-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.download-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.section-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 10px;
}

.clear-btn {
  margin-left: auto;
  padding: 2px 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  border-color: rgba(217, 91, 103, 0.4);
  color: #d95b67;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.download-task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.download-task--completed {
  opacity: 0.8;
}

.download-task--failed {
  border-color: rgba(255, 100, 100, 0.15);
}

.task-cover {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.task-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(100, 50, 150, 0.3));
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-name {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-progress-bar {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 11px;
}

.task-status {
  font-weight: 500;
}

.status--pending {
  color: rgba(255, 200, 100, 0.8);
}

.status--downloading {
  color: #d95b67;
}

.status--completed {
  color: rgba(100, 200, 150, 0.9);
}

.status--failed {
  color: rgba(255, 100, 100, 0.8);
}

.task-size {
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.task-speed {
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.task-error {
  color: rgba(255, 100, 100, 0.6);
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cancel-btn,
.retry-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.cancel-btn:hover {
  border-color: rgba(255, 100, 100, 0.4);
  color: #ff6464;
}

.retry-btn:hover {
  border-color: rgba(217, 91, 103, 0.4);
  color: #d95b67;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.empty-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.download-settings {
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.download-settings .section-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding: 0;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row > label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #d95b67;
  cursor: pointer;
}

.segmented {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 2px;
  flex-wrap: wrap;
  gap: 2px;
}

.seg-btn {
  flex: 1;
  min-width: 80px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.seg-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

.seg-btn.active {
  background: rgba(217, 91, 103, 0.8);
  color: #fff;
}
</style>
