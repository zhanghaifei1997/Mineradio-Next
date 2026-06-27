<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStatsStore } from '@/stores/stats'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const stats = useStatsStore()

const activeTab = ref<'overview' | 'artists' | 'songs' | 'data'>('overview')

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} 秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours} 小时 ${minutes} 分`
}

const maxWeekCount = computed(() => {
  return Math.max(...stats.weeklyTrend.map(d => d.count), 1)
})

function downloadJSON() {
  const json = stats.exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mineradio-stats-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadCSV() {
  const csv = stats.exportCSV()
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mineradio-stats-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function clearAllStats() {
  if (confirm('确定要清除所有播放统计吗？此操作不可撤销。')) {
    stats.clearStats()
  }
}
</script>

<template>
  <div class="stats-panel">
    <div class="stats-header">
      <h3>播放统计</h3>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="stats-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'overview' }"
        @click="activeTab = 'overview'"
      >
        📊 概览
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'artists' }"
        @click="activeTab = 'artists'"
      >
        🎤 歌手
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'songs' }"
        @click="activeTab = 'songs'"
      >
        🎵 歌曲
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'data' }"
        @click="activeTab = 'data'"
      >
        💾 数据
      </button>
    </div>

    <div class="stats-content">
      <div v-show="activeTab === 'overview'" class="tab-content">
        <div class="stats-cards">
          <div class="stat-card">
            <div class="stat-label">今日播放</div>
            <div class="stat-value">{{ stats.todayPlayCount }}</div>
            <div class="stat-sub">{{ formatDuration(stats.todayPlayDuration) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">本周播放</div>
            <div class="stat-value">{{ stats.weekPlayCount }}</div>
            <div class="stat-sub">{{ formatDuration(stats.weekPlayDuration) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">本月播放</div>
            <div class="stat-value">{{ stats.monthPlayCount }}</div>
            <div class="stat-sub">{{ formatDuration(stats.monthPlayDuration) }}</div>
          </div>
          <div class="stat-card stat-card--total">
            <div class="stat-label">总计</div>
            <div class="stat-value">{{ stats.data.totalPlayCount }}</div>
            <div class="stat-sub">{{ formatDuration(stats.data.totalPlayDuration) }}</div>
          </div>
        </div>

        <div class="chart-section">
          <div class="section-title">近 7 天播放趋势</div>
          <div class="bar-chart">
            <div
              v-for="(day, index) in stats.weeklyTrend"
              :key="index"
              class="bar-item"
            >
              <div class="bar-wrapper">
                <div
                  class="bar-fill"
                  :style="{ height: (day.count / maxWeekCount) * 100 + '%' }"
                >
                  <span class="bar-count" v-if="day.count > 0">{{ day.count }}</span>
                </div>
              </div>
              <div class="bar-label">{{ day.date }}</div>
            </div>
          </div>
        </div>

        <div class="top-section">
          <div class="section-title">最常听的歌手 TOP 5</div>
          <div class="top-list">
            <div
              v-for="(artist, index) in stats.topArtists.slice(0, 5)"
              :key="artist.id"
              class="top-item"
            >
              <span class="top-rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
              <span class="top-name">{{ artist.name }}</span>
              <span class="top-count">{{ artist.playCount }} 次</span>
            </div>
            <div v-if="stats.topArtists.length === 0" class="empty-state">
              暂无数据，开始听歌吧！
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'artists'" class="tab-content">
        <div class="list-section">
          <div class="section-title">最常听的歌手</div>
          <div class="artist-list">
            <div
              v-for="(artist, index) in stats.topArtists"
              :key="artist.id"
              class="artist-item"
            >
              <span class="artist-rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
              <div class="artist-avatar">🎤</div>
              <div class="artist-info">
                <div class="artist-name">{{ artist.name }}</div>
                <div class="artist-stats">
                  {{ artist.playCount }} 次播放 · {{ formatDuration(artist.totalDuration) }}
                </div>
              </div>
            </div>
            <div v-if="stats.topArtists.length === 0" class="empty-state">
              暂无数据
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'songs'" class="tab-content">
        <div class="list-section">
          <div class="section-title">最常听的歌曲</div>
          <div class="song-list">
            <div
              v-for="(song, index) in stats.topSongs"
              :key="song.id"
              class="song-item"
            >
              <span class="song-rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
              <div class="song-info">
                <div class="song-name">{{ song.name }}</div>
                <div class="song-artist">{{ song.artistName }}</div>
              </div>
              <div class="song-count">{{ song.playCount }} 次</div>
            </div>
            <div v-if="stats.topSongs.length === 0" class="empty-state">
              暂无数据
            </div>
          </div>
        </div>
      </div>

      <div v-show="activeTab === 'data'" class="tab-content">
        <div class="data-section">
          <div class="section-title">数据导出</div>
          <p class="data-desc">导出您的播放历史和统计数据</p>
          <div class="export-buttons">
            <button class="export-btn" @click="downloadJSON">
              📄 导出 JSON
            </button>
            <button class="export-btn" @click="downloadCSV">
              📊 导出 CSV
            </button>
          </div>
        </div>

        <div class="data-section">
          <div class="section-title">数据管理</div>
          <p class="data-desc">清除所有本地统计数据</p>
          <button class="danger-btn" @click="clearAllStats">
            🗑️ 清除所有统计
          </button>
        </div>

        <div class="data-section">
          <div class="section-title">数据信息</div>
          <div class="info-list">
            <div class="info-item">
              <span class="info-label">总记录数</span>
              <span class="info-value">{{ stats.data.records.length }} 条</span>
            </div>
            <div class="info-item">
              <span class="info-label">总播放次数</span>
              <span class="info-value">{{ stats.data.totalPlayCount }} 次</span>
            </div>
            <div class="info-item">
              <span class="info-label">总播放时长</span>
              <span class="info-value">{{ formatDuration(stats.data.totalPlayDuration) }}</span>
            </div>
            <div class="info-item" v-if="stats.data.firstPlayAt > 0">
              <span class="info-label">首次播放</span>
              <span class="info-value">{{ new Date(stats.data.firstPlayAt).toLocaleDateString('zh-CN') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-panel {
  position: absolute;
  top: 60px;
  right: 20px;
  width: min(420px, calc(100vw - 48px));
  max-height: calc(100vh - 120px);
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 150;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.stats-header h3 {
  margin: 0;
  font-size: 18px;
  color: #fff;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 82, 82, 0.2);
  color: #ff5252;
}

.stats-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.tab-btn.active {
  background: rgba(217, 91, 103, 0.15);
  color: #d95b67;
}

.stats-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px;
}

.stat-card--total {
  grid-column: span 2;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.15), rgba(100, 50, 150, 0.1));
  border-color: rgba(217, 91, 103, 0.3);
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.stat-sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.chart-section,
.top-section,
.list-section,
.data-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 14px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 12px;
}

.bar-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 100px;
  gap: 4px;
}

.bar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bar-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar-fill {
  width: 60%;
  min-height: 2px;
  background: linear-gradient(180deg, #d95b67, #feca57);
  border-radius: 4px 4px 0 0;
  position: relative;
  transition: height 0.3s ease;
}

.bar-count {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
}

.bar-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
}

.top-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
}

.top-rank {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.rank-1 {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #000;
}

.rank-2 {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: #000;
}

.rank-3 {
  background: linear-gradient(135deg, #cd7f32, #b8860b);
  color: #000;
}

.top-name {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.artist-list,
.song-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.artist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.artist-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.artist-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: rgba(217, 91, 103, 0.15);
  border-radius: 50%;
  flex-shrink: 0;
}

.artist-info {
  flex: 1;
  min-width: 0;
}

.artist-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-stats {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.song-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.song-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 30px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.data-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 12px 0;
}

.export-buttons {
  display: flex;
  gap: 10px;
}

.export-btn {
  flex: 1;
  padding: 10px 16px;
  border: 1px solid rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.1);
  color: #4ecdc4;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.export-btn:hover {
  background: rgba(78, 205, 196, 0.2);
}

.danger-btn {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid rgba(255, 82, 82, 0.3);
  background: rgba(255, 82, 82, 0.1);
  color: #ff5252;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.danger-btn:hover {
  background: rgba(255, 82, 82, 0.2);
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.info-value {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}
</style>
