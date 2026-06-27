<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import { useUserStore } from '@/stores/user'
import { useFxStore } from '@/stores/fx'
import { useImmersiveStore } from '@/stores/immersive'
import { useLyricsStore } from '@/stores/lyrics'
import { formatTime } from '@/utils/time'
import QualitySelector from './QualitySelector.vue'
import VolumePopover from './VolumePopover.vue'
import SleepTimer from './SleepTimer.vue'
import CollectModal from '../playlist/CollectModal.vue'

const emit = defineEmits<{
  showQueue: []
  showLocal: []
  openSongDetail: [songId: string, source: string]
  openArtistDetail: [artistId: string, source: string]
}>()

const showCollectModal = ref(false)
const isDragging = ref(false)
const showMiniQueue = ref(false)

const player = usePlayerStore()
const queue = playQueueStore()
const userStore = useUserStore()
const fx = useFxStore()
const immersive = useImmersiveStore()
const lyricsStore = useLyricsStore()

const isLiked = ref(false)
const likeLoading = ref(false)

watch(() => player.currentSong, async (song) => {
  if (song) {
    isLiked.value = userStore.isSongLikedSync(song.source, song.id)
    if (!isLiked.value && userStore.isLoggedIn) {
      try {
        const liked = await userStore.isSongLiked(song.source as any, song.id)
        isLiked.value = liked
      } catch (_) {}
    }
  } else {
    isLiked.value = false
  }
}, { immediate: true })

async function handleToggleLike() {
  if (!player.currentSong || likeLoading.value || !userStore.isLoggedIn) return
  likeLoading.value = true
  try {
    const result = await userStore.likeSong(
      player.currentSong.source as any,
      player.currentSong.id,
      !isLiked.value,
      player.currentSong
    )
    if (result) {
      isLiked.value = !isLiked.value
    }
  } catch (e) {
    console.error('Toggle like error:', e)
  } finally {
    likeLoading.value = false
  }
}

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

function onProgressMouseDown(e: MouseEvent) {
  isDragging.value = true
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  player.seek(percent * player.duration)

  function onMouseMove(e: MouseEvent) {
    const rect = target.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    player.seek(percent * player.duration)
  }

  function onMouseUp() {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
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

const modeSwitching = ref(false)
let modeSwitchTimer: ReturnType<typeof setTimeout> | null = null

function handleCyclePlayMode() {
  player.cyclePlayMode()
  modeSwitching.value = false
  // 强制重新触发动画
  requestAnimationFrame(() => {
    modeSwitching.value = true
  })
  if (modeSwitchTimer) clearTimeout(modeSwitchTimer)
  modeSwitchTimer = setTimeout(() => {
    modeSwitching.value = false
  }, 400)
}

function handleQueueClick() {
  emit('showQueue')
}

function handleLocalClick() {
  emit('showLocal')
}

function handleOpenCollect() {
  if (player.currentSong) {
    showCollectModal.value = true
  }
}

function handleTitleClick() {
  if (player.currentSong) {
    emit('openSongDetail', player.currentSong.id, player.currentSong.source)
  }
}

function handleArtistClick() {
  if (player.currentSong?.artists?.length) {
    const artist = player.currentSong.artists[0]
    emit('openArtistDetail', artist.id, player.currentSong.source)
  }
}

function toggleMiniQueue() {
  showMiniQueue.value = !showMiniQueue.value
}

function closeMiniQueue() {
  showMiniQueue.value = false
}

function toggleControlsAutoHide() {
  fx.update('controlsAutoHide', !fx.settings.controlsAutoHide)
}

function toggleImmersive() {
  immersive.toggle()
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  } else {
    document.documentElement.requestFullscreen().catch(() => {})
  }
}

function toggleLyricsPanel() {
  lyricsStore.toggleStageLyrics()
}
</script>

<template>
  <div class="player-bar" :class="{ visible: player.currentSong || true }">
    <div class="progress-wrap" :class="{ 'is-dragging': isDragging }" @mousedown="onProgressMouseDown">
      <div class="progress-bar">
        <div class="progress-bar__buffer" :style="{ width: bufferPercent + '%' }"></div>
        <div class="progress-bar__fill" :style="{ width: progressPercent + '%' }"></div>
        <div id="progress-thumb" class="progress-bar__thumb" :style="{ left: progressPercent + '%' }"></div>
      </div>
    </div>

    <div class="controls">
      <!-- Left: track info + actions -->
      <div class="control-cluster actions">
        <div class="control-track">
          <div class="control-cover" :class="{ 'cover-empty': !player.currentSong?.coverUrl }">
            <img :src="player.currentSong?.coverUrl" alt="" v-if="player.currentSong?.coverUrl" />
          </div>
          <div class="control-meta">
            <div class="control-title" @click="handleTitleClick" title="歌曲详情">{{ player.currentSong?.name || '未播放' }}</div>
            <div class="control-artist" @click="handleArtistClick" title="歌手详情">{{ player.currentSong?.artists.map(a => a.name).join(' / ') || '选择一首歌开始' }}</div>
          </div>
        </div>
        <button
          v-if="userStore.isLoggedIn"
          class="ctrl-btn song-action-btn"
          :class="{ liked: isLiked }"
          @click="handleToggleLike"
          :disabled="likeLoading"
          :title="isLiked ? '取消喜欢' : '喜欢'"
        >
          {{ isLiked ? '❤️' : '🤍' }}
        </button>
        <button
          class="ctrl-btn song-action-btn"
          @click="handleOpenCollect"
          title="收藏到歌单"
        >
          📁
        </button>
      </div>

      <!-- Center: transport -->
      <div class="control-cluster transport">
        <button
          class="ctrl-btn play-mode-btn"
          :class="{ switching: modeSwitching }"
          @click="handleCyclePlayMode"
          :title="playModeLabel"
        >
          <span class="mode-icon">{{ playModeIcon }}</span>
        </button>
        <button class="ctrl-btn" @click="player.prev()" title="上一首">⏮</button>
        <button class="ctrl-btn play-btn" @click="player.togglePlay()" :title="player.isPlaying ? '暂停' : '播放'">
          {{ player.isPlaying ? '⏸' : '▶' }}
        </button>
        <button class="ctrl-btn" @click="player.next()" title="下一首">⏭</button>
        <div class="mini-queue-wrap">
          <button class="ctrl-btn" @click="toggleMiniQueue" :title="'当前队列 (' + queue.total + ')'">
            📋
            <span class="queue-badge" v-if="queue.total > 0">{{ queue.total }}</span>
          </button>
          <Transition name="mini-queue-fade">
            <div v-if="showMiniQueue" class="mini-queue-popover" @click.stop>
              <div class="mini-queue-head">
                <div>
                  <div class="mini-queue-title">当前队列</div>
                  <div class="mini-queue-count">{{ queue.total }} 首</div>
                </div>
                <button class="mini-queue-close" @click="closeMiniQueue">×</button>
              </div>
              <div class="mini-queue-list">
                <div
                  v-for="(track, idx) in queue.queue"
                  :key="track.id + '-' + idx"
                  class="mini-queue-item"
                  :class="{ active: idx === queue.currentIndex }"
                  @click="queue.playAt(idx); closeMiniQueue()"
                >
                  <span class="mini-queue-item__name">{{ track.name }}</span>
                  <span class="mini-queue-item__artist">{{ track.artists?.map((a: any) => a.name).join(' / ') }}</span>
                </div>
                <div v-if="queue.total === 0" class="mini-queue-empty">队列为空</div>
              </div>
            </div>
          </Transition>
        </div>
        <div class="time-display">{{ currentTimeStr }} / {{ durationStr }}</div>
      </div>

      <!-- Right: modes -->
      <div class="control-cluster modes">
        <button class="ctrl-btn lyrics-toggle-btn" @click="toggleLyricsPanel" title="歌词">
          <span class="lyrics-word-icon">词</span>
        </button>
        <SleepTimer />
        <QualitySelector />
        <VolumePopover />
        <button
          class="ctrl-btn"
          :class="{ active: fx.settings.controlsAutoHide }"
          @click="toggleControlsAutoHide"
          title="控制条自动隐藏"
        >
          {{ fx.settings.controlsAutoHide ? '👁️' : '👁️‍🗨️' }}
        </button>
        <button class="ctrl-btn" @click="toggleImmersive" title="沉浸式模式">
          🖥️
        </button>
        <button class="ctrl-btn" @click="toggleFullscreen" title="全屏">
          ⛶
        </button>
      </div>
    </div>
  </div>

  <CollectModal
    :visible="showCollectModal"
    :song="player.currentSong"
    @close="showCollectModal = false"
  />
</template>

<style scoped>
.player-bar {
  position: fixed;
  z-index: 100;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(36px) scale(.972);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .34s cubic-bezier(.16,1,.3,1), bottom .34s cubic-bezier(.16,1,.3,1),
    width .34s, transform .46s cubic-bezier(.16,1,.3,1), filter .38s cubic-bezier(.16,1,.3,1);
  width: min(1120px, calc(100vw - clamp(20px, 5vw, 72px)));
  padding: clamp(8px, 1.2vw, 11px) clamp(12px, 2.2vw, 24px) clamp(10px, 1.35vw, 14px);
  border-radius: 50px;
  background: transparent;
  border: 0;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  box-sizing: border-box;
}

.player-bar.visible {
  opacity: .91;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0) scale(1);
  background: rgba(0,0,0,.10);
  backdrop-filter: blur(12px) saturate(1.8) brightness(1.16);
  -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.16);
  box-shadow: inset 0 0 2px 1px rgba(255,255,255,.35),
    inset 0 0 10px 4px rgba(255,255,255,.15),
    0 4px 16px rgba(17,17,26,.05),
    0 8px 24px rgba(17,17,26,.05),
    0 16px 56px rgba(17,17,26,.05),
    inset 0 4px 16px rgba(17,17,26,.05),
    inset 0 8px 24px rgba(17,17,26,.05),
    inset 0 16px 56px rgba(17,17,26,.05);
}

:global(html.control-glass-svg-ok) .player-bar.visible {
  backdrop-filter: url(#mineradio-control-glass-filter) saturate(1);
  -webkit-backdrop-filter: url(#mineradio-control-glass-filter) saturate(1);
}

:global(body.controls-auto-hide:not(.controls-visible)) .player-bar {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(88px) scale(.972);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

:global(body.diy-mode) .player-bar {
  width: min(1120px, calc(100vw - clamp(28px, 8vw, 148px)));
}

/* 桌面端 + DIY 模式：更窄的播放器栏 (对齐老项目 desktop-shell.diy-mode) */
:global(body.desktop-titlebar-active.diy-mode) .player-bar {
  width: min(1080px, calc(100vw - 72px));
  left: 50%;
}

/* --- Progress bar --- */
.progress-wrap {
  align-self: center;
  width: calc(100% - clamp(86px, 10vw, 156px));
  cursor: pointer;
  padding: 4px 0;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.095);
  border-radius: 999px;
  overflow: visible;
  transition: height .2s, background .2s, box-shadow .2s;
  box-shadow: inset 0 1px 1px rgba(255,255,255,.12),
    inset 0 -1px 1px rgba(0,0,0,.20);
}

.progress-wrap:hover .progress-bar,
.progress-wrap.is-dragging .progress-bar {
  height: 5px;
  background: rgba(255,255,255,.14);
  box-shadow: 0 0 18px rgba(var(--fc-accent-rgb, 0,245,212),.10),
    inset 0 1px 1px rgba(255,255,255,.18);
}

.progress-bar__buffer {
  position: absolute;
  top: 0; left: 0;
  height: 100%;
  background: rgba(255,255,255,.12);
  border-radius: 999px;
  transition: width .3s ease;
}

.progress-bar__fill {
  position: relative;
  height: 100%;
  background: linear-gradient(90deg, rgba(255,255,255,.92), rgba(var(--fc-accent-rgb, 0,245,212),.74));
  border-radius: 999px;
  transition: width .12s linear;
  box-shadow: 0 0 16px rgba(var(--fc-accent-rgb, 0,245,212),.18);
  z-index: 1;
}

.progress-bar__thumb {
  position: absolute;
  left: 0; top: 50%;
  width: 13px; height: 13px;
  border-radius: 50%;
  background: radial-gradient(circle at 34% 28%, #fff 0, #fff 28%, rgba(194,235,255,.86) 74%);
  box-shadow: 0 0 0 1px rgba(255,255,255,.34), 0 0 18px rgba(178,229,255,.28);
  transform: translate(-50%, -50%) scale(.72);
  opacity: 0;
  pointer-events: none;
  transition: opacity .16s, transform .16s;
  z-index: 2;
}

.progress-wrap:hover .progress-bar__thumb,
.progress-wrap.is-dragging .progress-bar__thumb {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.progress-wrap.is-dragging {
  cursor: grabbing;
}

.progress-wrap.is-dragging .progress-bar__thumb::before {
  content: '';
  position: absolute; left: 50%; top: 50%;
  width: 3px; height: 3px; border-radius: 50%;
  background: rgba(255,255,255,.9);
  box-shadow: 0 0 10px rgba(255,68,88,.42);
  animation: thumb-particle-a .62s ease-out infinite;
}

.progress-wrap.is-dragging .progress-bar__thumb::after {
  content: '';
  position: absolute; left: 50%; top: 50%;
  width: 3px; height: 3px; border-radius: 50%;
  background: rgba(255,255,255,.9);
  box-shadow: 0 0 10px rgba(255,68,88,.42);
  animation: thumb-particle-b .72s ease-out infinite;
}

@keyframes thumb-particle-a {
  0% { opacity: .8; transform: translate(-50%,-50%) scale(1); }
  100% { opacity: 0; transform: translate(-18px,-17px) scale(.2); }
}
@keyframes thumb-particle-b {
  0% { opacity: .7; transform: translate(-50%,-50%) scale(1); }
  100% { opacity: 0; transform: translate(16px,13px) scale(.22); }
}

/* --- Controls grid --- */
.controls {
  position: relative;
  z-index: 1;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
  align-items: center;
  gap: clamp(8px, 1.7vw, 18px);
}

.control-cluster {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1.1vw, 13px);
  min-width: 0;
  height: 62px;
}

.control-cluster.actions {
  justify-content: flex-start;
  overflow: visible;
}

.control-cluster.transport {
  justify-self: center;
  justify-content: center;
  width: max-content;
}

.control-cluster.modes {
  justify-content: flex-end;
  overflow: visible;
}

/* --- Track info --- */
.control-track {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1 1 auto;
}

.control-cover {
  width: 52px; height: 52px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  background-color: rgba(255,255,255,.07);
  border: 0;
  box-shadow: 0 10px 28px rgba(0,0,0,.24),
    inset 0 1px 0 rgba(255,255,255,.20),
    inset 0 0 0 1px rgba(255,255,255,.08);
  transition: transform .18s ease, opacity .2s ease;
  flex: 0 0 auto;
  overflow: hidden;
}

.control-cover img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}

.control-cover.cover-empty {
  background-image: radial-gradient(circle at 35% 28%, rgba(255,255,255,.18), transparent 24%),
    linear-gradient(135deg, rgba(255,255,255,.10), rgba(255,255,255,.025));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.055), 0 8px 22px rgba(0,0,0,.22);
}

.control-meta {
  min-width: 0;
  max-width: min(320px, 100%);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.control-title {
  font-size: 13.5px;
  font-weight: 700;
  color: rgba(255,255,255,.92);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.control-artist {
  font-size: 11.5px;
  color: rgba(255,255,255,.48);
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.control-title:hover, .control-artist:hover {
  color: #fff;
  text-shadow: 0 0 16px rgba(0,245,212,.20);
}

/* --- Control buttons --- */
.ctrl-btn {
  flex: 0 0 auto;
  width: 36px; height: 36px;
  background: transparent;
  border: 0;
  border-radius: 11px;
  color: rgba(255,255,255,0.70);
  cursor: pointer;
  transition: color .18s, transform .18s, text-shadow .18s, background .18s, box-shadow .18s;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 16px;
  position: relative;
}

.ctrl-btn:hover {
  color: #fff;
  background: rgba(255,255,255,.045);
  transform: translateY(-1px);
  text-shadow: 0 0 10px rgba(0,245,212,.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.045);
}

.ctrl-btn:active {
  transform: translateY(0) scale(.96);
}

.ctrl-btn.liked {
  color: #ff7a90;
  text-shadow: 0 0 18px rgba(255,122,144,.36);
}

/* --- Play button (glass) --- */
.play-btn {
  width: 58px; height: 58px;
  border-radius: 50%;
  color: rgba(255,255,255,.96);
  background: rgba(0,0,0,.10);
  font-size: 22px;
  box-shadow: inset 0 0 2px 1px rgba(255,255,255,.34),
    inset 0 0 10px 4px rgba(255,255,255,.13),
    0 10px 30px rgba(0,0,0,.18);
  backdrop-filter: blur(12px) saturate(1.8) brightness(1.16);
  -webkit-backdrop-filter: blur(12px) saturate(1.8) brightness(1.16);
  transition: transform .20s cubic-bezier(.16,1,.3,1), background .20s, box-shadow .20s;
}

.play-btn:hover {
  background: rgba(255,255,255,.055);
  transform: translateY(-1px) scale(1.012);
  box-shadow: inset 0 0 2px 1px rgba(255,255,255,.42),
    inset 0 0 12px 5px rgba(255,255,255,.17),
    0 12px 34px rgba(0,0,0,.22),
    0 0 18px rgba(var(--fc-accent-rgb, 0,245,212),.10);
}

.play-btn:active {
  transform: translateY(0) scale(.965);
  box-shadow: inset 0 0 2px 1px rgba(255,255,255,.28),
    inset 0 0 10px 4px rgba(255,255,255,.10),
    0 8px 22px rgba(0,0,0,.20);
}

/* --- Play mode button --- */
.play-mode-btn.switching .mode-icon {
  animation: play-mode-pop .42s cubic-bezier(.16,1,.3,1);
}

.mode-icon {
  font-size: 18px;
}

@keyframes play-mode-pop {
  0% { opacity: .4; transform: translateY(3px) scale(.84) rotate(-18deg); }
  65% { opacity: 1; transform: translateY(-1px) scale(1.10) rotate(4deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
}

/* --- Time display --- */
.time-display {
  flex: 0 0 auto;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  font-size: 12px;
  color: rgba(255,255,255,0.50);
  letter-spacing: .35px;
  min-width: 86px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* --- Queue badge --- */
.queue-badge {
  position: absolute;
  top: 2px; right: 2px;
  min-width: 14px; height: 14px;
  background: var(--source-netease, #d95b67);
  color: #fff;
  font-size: 9px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  font-weight: 700;
}

/* --- Responsive --- */
@media (max-width: 1180px) {
  .control-meta { max-width: min(220px, 100%); }
  :global(body.diy-mode) .player-bar { width: calc(100vw - clamp(28px, 8vw, 142px)); }
}

@media (max-width: 920px) {
  .player-bar { width: calc(100vw - 28px) !important; padding: 9px 14px 12px; }
  .control-cluster { gap: 8px; height: 56px; }
  .control-cover { width: 44px; height: 44px; }
  .control-meta { max-width: min(170px, 100%); }
  .control-title { font-size: 12.5px; }
  .control-artist { font-size: 11px; }
  .ctrl-btn { width: 32px; height: 32px; }
  .play-btn { width: 54px; height: 54px; }
  .time-display { display: none; }
}

@media (max-width: 720px) {
  .control-cover { display: none; }
  .control-meta { max-width: min(132px, 100%); }
  .control-cluster.modes { gap: 6px; }
}

@media (max-width: 620px) {
  .player-bar { width: calc(100vw - 20px) !important; }
  .controls { grid-template-columns: 1fr; }
  .control-cluster { justify-content: center !important; }
  .control-cluster.transport { order: 1; }
  .control-cluster.actions { order: 2; }
  .control-cluster.modes { order: 3; }
  .control-track { display: none; }
}

/* --- Mini queue popover --- */
.mini-queue-wrap {
  position: relative;
}

.mini-queue-popover {
  position: absolute;
  bottom: 48px;
  right: -10px;
  width: 320px;
  max-height: 360px;
  background: rgba(18,18,24,.92);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,.42), inset 0 0 1px 1px rgba(255,255,255,.12);
  border: 0;
  overflow: hidden;
  z-index: 200;
  display: flex;
  flex-direction: column;
}

.mini-queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid rgba(255,255,255,.06);
}

.mini-queue-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255,255,255,.88);
}

.mini-queue-count {
  font-size: 11px;
  color: rgba(255,255,255,.42);
  margin-top: 2px;
}

.mini-queue-close {
  background: rgba(255,255,255,.06);
  border: 0;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  color: rgba(255,255,255,.55);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .2s;
}

.mini-queue-close:hover {
  background: rgba(255,82,82,.18);
  color: #ff5252;
}

.mini-queue-list {
  overflow-y: auto;
  flex: 1;
  padding: 6px 0;
}

.mini-queue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background .15s;
}

.mini-queue-item:hover {
  background: rgba(255,255,255,.06);
}

.mini-queue-item.active {
  background: rgba(244,210,138,.08);
}

.mini-queue-item.active .mini-queue-item__name {
  color: var(--champagne, #f4d28a);
}

.mini-queue-item__name {
  font-size: 12.5px;
  color: rgba(255,255,255,.82);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.mini-queue-item__artist {
  font-size: 11px;
  color: rgba(255,255,255,.38);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  flex: 0 0 auto;
}

.mini-queue-empty {
  padding: 24px;
  text-align: center;
  color: rgba(255,255,255,.32);
  font-size: 12px;
}

.mini-queue-fade-enter-active {
  transition: opacity .22s, transform .22s cubic-bezier(.16,1,.3,1);
}
.mini-queue-fade-leave-active {
  transition: opacity .16s, transform .16s;
}
.mini-queue-fade-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(.96);
}
.mini-queue-fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(.98);
}

/* --- Lyrics toggle button --- */
.lyrics-word-icon {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
</style>
