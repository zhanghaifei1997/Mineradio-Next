<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import { formatTime } from '@/utils/time'

const emit = defineEmits<{
  showQueue: []
  showLocal: []
}>()

const player = usePlayerStore()
const queue = playQueueStore()

const progressPercent = computed(() => player.progress)
const currentTimeStr = computed(() => formatTime(player.currentTime))
const durationStr = computed(() => formatTime(player.duration))
const bufferPercent = computed(() => player.bufferProgress?.percent || 0)

function onProgressClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  player.seek(percent * player.duration)
}

function onVolumeClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  player.setVolume(percent)
}

const playModeLabel = computed(() => {
  const map = { sequence: '顺序', loop: '列表循环', single: '单曲循环', shuffle: '随机' }
  return map[player.playMode]
})

const playModeIcon = computed(() => {
  const map = { sequence: '🔁', loop: '🔂', single: '🔄', shuffle: '🔀' }
  return map[player.playMode]
})

function handleQueueClick() {
  emit('showQueue')
}

function handleLocalClick() {
  emit('showLocal')
}
</script>

<template>
  <div class="player-bar">
    <div class="player-bar__left">
      <div class="song-info" v-if="player.currentSong">
        <div class="song-info__cover">
          <img :src="player.currentSong.coverUrl" alt="" v-if="player.currentSong.coverUrl" />
          <div class="song-info__cover-placeholder" v-else></div>
        </div>
        <div class="song-info__text">
          <div class="song-info__name">{{ player.currentSong.name }}</div>
          <div class="song-info__artist">
            {{ player.currentSong.artists.map(a => a.name).join(' / ') }}
          </div>
        </div>
      </div>
      <div class="song-info song-info--placeholder" v-else>
        <div class="song-info__cover-placeholder"></div>
        <div class="song-info__text">
          <div class="song-info__name">未播放</div>
          <div class="song-info__artist">选择一首歌开始</div>
        </div>
      </div>
    </div>

    <div class="player-bar__center">
      <div class="controls">
        <button class="ctrl-btn ctrl-btn--mode" @click="player.cyclePlayMode()" :title="playModeLabel">
          <span class="mode-icon">{{ playModeIcon }}</span>
          <span class="mode-text">{{ playModeLabel }}</span>
        </button>
        <button class="ctrl-btn ctrl-btn--prev" @click="player.prev()" title="上一首">
          ⏮
        </button>
        <button class="ctrl-btn ctrl-btn--play" @click="player.togglePlay()" :title="player.isPlaying ? '暂停' : '播放'">
          {{ player.isPlaying ? '⏸' : '▶' }}
        </button>
        <button class="ctrl-btn ctrl-btn--next" @click="player.next()" title="下一首">
          ⏭
        </button>
        <button class="ctrl-btn ctrl-btn--queue" @click="handleQueueClick" :title="'播放队列 (' + queue.total + ')'">
          📋
          <span class="queue-badge" v-if="queue.total > 0">{{ queue.total }}</span>
        </button>
      </div>

      <div class="progress-wrap" @click="onProgressClick">
        <span class="progress-time">{{ currentTimeStr }}</span>
        <div class="progress-bar">
          <div class="progress-bar__buffer" :style="{ width: bufferPercent + '%' }"></div>
          <div class="progress-bar__fill" :style="{ width: progressPercent + '%' }"></div>
          <div class="progress-bar__thumb" :style="{ left: progressPercent + '%' }"></div>
        </div>
        <span class="progress-time">{{ durationStr }}</span>
      </div>
    </div>

    <div class="player-bar__right">
      <button class="ctrl-btn ctrl-btn--local" @click="handleLocalClick" title="本地音乐">
        💾
      </button>
      <div class="volume-wrap" @click="onVolumeClick">
        <span class="volume-icon" @click.stop="player.toggleMute()">
          {{ player.muted ? '🔇' : '🔊' }}
        </span>
        <div class="volume-bar">
          <div class="volume-bar__fill" :style="{ width: (player.muted ? 0 : player.volume * 100) + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 88px;
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  padding: 0 24px;
  z-index: 100;
}

.player-bar__left {
  flex: 1;
  min-width: 0;
}

.player-bar__center {
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.player-bar__right {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.song-info {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
}

.song-info__cover {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.song-info__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info__cover-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(100, 50, 150, 0.3));
}

.song-info__text {
  min-width: 0;
}

.song-info__name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-info__artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
}

.ctrl-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.ctrl-btn--play {
  font-size: 24px;
  width: 48px;
  height: 48px;
  background: rgba(217, 91, 103, 0.9);
  color: #fff;
}

.ctrl-btn--play:hover {
  background: rgba(217, 91, 103, 1);
  transform: scale(1.05);
}

.ctrl-btn--mode {
  font-size: 11px;
  width: auto;
  padding: 4px 10px;
  border-radius: 12px;
  gap: 4px;
}

.mode-icon {
  font-size: 14px;
}

.ctrl-btn--queue {
  position: relative;
}

.queue-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  background: #d95b67;
  color: #fff;
  font-size: 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-weight: 600;
}

.ctrl-btn--local {
  font-size: 16px;
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 500px;
  cursor: pointer;
}

.progress-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: center;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  position: relative;
  overflow: visible;
}

.progress-bar__buffer {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-bar__fill {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
  border-radius: 2px;
  transition: width 0.1s linear;
  z-index: 1;
}

.progress-bar__thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 2;
}

.progress-wrap:hover .progress-bar__thumb {
  opacity: 1;
}

.volume-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px;
}

.volume-icon {
  font-size: 16px;
}

.volume-bar {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.volume-bar__fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 2px;
}
</style>
