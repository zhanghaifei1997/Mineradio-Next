<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import EqKnob from './EqKnob.vue'
import type { DeckState } from '@/stores/djDeck'
import { formatTime } from '@/utils/time'

const props = defineProps<{
  deckId: 'A' | 'B'
  deck: DeckState
  primaryColor: string
  secondaryColor: string
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'togglePlay'): void
  (e: 'cue'): void
  (e: 'gotoCue'): void
  (e: 'sync'): void
  (e: 'seek', time: number): void
  (e: 'pitchChange', value: number): void
  (e: 'volumeChange', value: number): void
  (e: 'eqChange', band: 'low' | 'mid' | 'high', value: number): void
  (e: 'toggleSyncLock'): void
}>()

const progressRef = ref<HTMLDivElement | null>(null)
const isSeeking = ref(false)

const bpmDisplay = computed(() => {
  const bpm = props.deck.beatMap?.bpm || 0
  return bpm > 0 ? bpm.toFixed(1) : '--'
})

const currentTimeStr = computed(() => formatTime(props.deck.currentTime))
const durationStr = computed(() => formatTime(props.deck.duration))
const progressPercent = computed(() =>
  props.deck.duration > 0 ? (props.deck.currentTime / props.deck.duration) * 100 : 0
)

const beatProgress = computed(() => {
  if (!props.deck.beatMap || !props.deck.beatMapReady) return 0
  return props.deck.beatMap.getBeatProgress(props.deck.currentTime)
})

const pitchPercent = computed(() => {
  return ((props.deck.pitch + 8) / 16) * 100
})

const volumePercent = computed(() => props.deck.volume * 100)

function handleProgressClick(e: MouseEvent) {
  if (!progressRef.value || !props.deck.duration) return
  const rect = progressRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const ratio = Math.max(0, Math.min(1, x / rect.width))
  emit('seek', ratio * props.deck.duration)
}

function handleProgressMouseDown(e: MouseEvent) {
  isSeeking.value = true
  handleProgressClick(e)
  window.addEventListener('mousemove', handleProgressMouseMove)
  window.addEventListener('mouseup', handleProgressMouseUp)
}

function handleProgressMouseMove(e: MouseEvent) {
  if (!isSeeking.value) return
  handleProgressClick(e)
}

function handleProgressMouseUp() {
  isSeeking.value = false
  window.removeEventListener('mousemove', handleProgressMouseMove)
  window.removeEventListener('mouseup', handleProgressMouseUp)
}

function handlePitchSlider(e: Event) {
  const target = e.target as HTMLInputElement
  emit('pitchChange', parseFloat(target.value))
}

function handleVolumeSlider(e: Event) {
  const target = e.target as HTMLInputElement
  emit('volumeChange', parseFloat(target.value) / 100)
}

function handleEqLowChange(value: number) {
  emit('eqChange', 'low', value)
}

function handleEqMidChange(value: number) {
  emit('eqChange', 'mid', value)
}

function handleEqHighChange(value: number) {
  emit('eqChange', 'high', value)
}
</script>

<template>
  <div class="deck-player" :class="{ playing: deck.isPlaying }">
    <div class="deck-header">
      <span class="deck-label" :style="{ color: primaryColor }">Deck {{ deckId }}</span>
      <div class="deck-bpm">
        <span class="bpm-label">BPM</span>
        <span class="bpm-value" :style="{ color: primaryColor }">{{ bpmDisplay }}</span>
      </div>
    </div>

    <div class="deck-vinyl-section">
      <div class="deck-vinyl" :class="{ spinning: deck.isPlaying }">
        <div class="vinyl-cover" v-if="deck.song?.coverUrl">
          <img :src="deck.song.coverUrl" alt="" />
        </div>
        <div class="vinyl-cover vinyl-placeholder" v-else>
          <div class="placeholder-logo">{{ deckId }}</div>
        </div>
        <div class="vinyl-ring"></div>
        <div class="vinyl-label" :style="{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }">
          <div class="label-center"></div>
        </div>
      </div>
    </div>

    <div class="deck-song-info">
      <div class="song-title" :title="deck.song?.name">{{ deck.song?.name || '未加载' }}</div>
      <div class="song-artist">
        {{ deck.song?.artists?.map((a) => a.name).join(' / ') || '--' }}
      </div>
    </div>

    <div class="deck-progress-section">
      <div
        ref="progressRef"
        class="progress-bar"
        @mousedown="handleProgressMouseDown"
        :class="{ seeking: isSeeking }"
      >
        <div class="progress-track">
          <div
            class="progress-fill"
            :style="{ width: progressPercent + '%', background: primaryColor }"
          ></div>
          <div
            class="progress-cue"
            v-if="deck.cuePoint > 0 && deck.duration > 0"
            :style="{ left: (deck.cuePoint / deck.duration) * 100 + '%' }"
          ></div>
        </div>
        <div class="progress-thumb" :style="{ left: `calc(${progressPercent}% - 6px)` }"></div>
      </div>
      <div class="time-display">
        <span class="current-time">{{ currentTimeStr }}</span>
        <span class="beat-indicator" :style="{ opacity: beatProgress > 0.8 ? 1 : 0.3 }">●</span>
        <span class="duration">{{ durationStr }}</span>
      </div>
    </div>

    <div class="deck-eq-section">
      <EqKnob
        label="LOW"
        :model-value="deck.eqLow"
        :color="primaryColor"
        @update:model-value="handleEqLowChange"
      />
      <EqKnob
        label="MID"
        :model-value="deck.eqMid"
        :color="secondaryColor"
        @update:model-value="handleEqMidChange"
      />
      <EqKnob
        label="HIGH"
        :model-value="deck.eqHigh"
        :color="'#feca57'"
        @update:model-value="handleEqHighChange"
      />
    </div>

    <div class="deck-controls">
      <button class="control-btn cue-btn" @click="emit('cue')" title="设置 Cue 点">
        CUE
      </button>
      <button
        class="control-btn play-btn"
        :class="{ playing: deck.isPlaying }"
        :style="{ borderColor: primaryColor, color: deck.isPlaying ? '#fff' : primaryColor }"
        @click="emit('togglePlay')"
      >
        {{ deck.isPlaying ? '⏸' : '▶' }}
      </button>
      <button class="control-btn cue-btn" @click="emit('gotoCue')" title="跳转 Cue 点">
        ▶CUE
      </button>
    </div>

    <div class="deck-pitch-section">
      <div class="pitch-header">
        <span class="pitch-label">PITCH</span>
        <span class="pitch-value" :class="{ positive: deck.pitch > 0, negative: deck.pitch < 0 }">
          {{ deck.pitch > 0 ? '+' : '' }}{{ deck.pitch.toFixed(1) }}%
        </span>
      </div>
      <input
        type="range"
        min="-8"
        max="8"
        step="0.1"
        :value="deck.pitch"
        class="pitch-slider"
        @input="handlePitchSlider"
      />
    </div>

    <div class="deck-bottom">
      <div class="volume-section">
        <span class="volume-label">VOL</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="volumePercent"
          class="volume-slider"
          @input="handleVolumeSlider"
        />
        <span class="volume-value">{{ Math.round(volumePercent) }}%</span>
      </div>
      <button
        class="sync-btn"
        :class="{ locked: deck.syncLocked }"
        :style="{ borderColor: deck.syncLocked ? '#4ecdc4' : primaryColor, color: deck.syncLocked ? '#4ecdc4' : primaryColor }"
        @click="emit('sync')"
        @contextmenu.prevent="emit('toggleSyncLock')"
        title="点击同步节拍 / 右键切换锁定"
      >
        {{ deck.syncLocked ? '🔒 SYNC' : 'SYNC' }}
      </button>
    </div>

    <div class="deck-analyzing" v-if="deck.isAnalyzing">
      <div class="analyzing-spinner"></div>
      <span>分析节拍中...</span>
    </div>
  </div>
</template>

<style scoped>
.deck-player {
  background: rgba(20, 20, 25, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  overflow: hidden;
}

.deck-player::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--deck-color), transparent);
  opacity: 0.5;
}

.deck-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.deck-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.deck-bpm {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.bpm-label {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.bpm-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}

.deck-vinyl-section {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.deck-vinyl {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  position: relative;
  background: conic-gradient(
    from 0deg,
    #1a1a1a 0deg,
    #252525 15deg,
    #1a1a1a 30deg,
    #252525 45deg,
    #1a1a1a 60deg,
    #252525 75deg,
    #1a1a1a 90deg,
    #252525 105deg,
    #1a1a1a 120deg,
    #252525 135deg,
    #1a1a1a 150deg,
    #252525 165deg,
    #1a1a1a 180deg,
    #252525 195deg,
    #1a1a1a 210deg,
    #252525 225deg,
    #1a1a1a 240deg,
    #252525 255deg,
    #1a1a1a 270deg,
    #252525 285deg,
    #1a1a1a 300deg,
    #252525 315deg,
    #1a1a1a 330deg,
    #252525 345deg,
    #1a1a1a 360deg
  );
  animation: spin 1.8s linear infinite;
  animation-play-state: paused;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.deck-vinyl.spinning {
  animation-play-state: running;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.vinyl-cover {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 60px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  overflow: hidden;
}

.vinyl-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vinyl-placeholder {
  background: linear-gradient(135deg, #2a2a30, #1a1a20);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-logo {
  font-size: 24px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.2);
}

.vinyl-ring {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.vinyl-label {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 28px;
  height: 28px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.label-center {
  width: 6px;
  height: 6px;
  background: #1a1a1a;
  border-radius: 50%;
}

.deck-song-info {
  text-align: center;
  min-height: 40px;
}

.song-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.song-artist {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deck-progress-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar {
  position: relative;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  position: relative;
  overflow: visible;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.05s linear;
}

.progress-cue {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 8px;
  background: #feca57;
  border-radius: 1px;
  z-index: 1;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 0.15s;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.progress-bar:hover .progress-thumb,
.progress-bar.seeking .progress-thumb {
  opacity: 1;
}

.time-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-variant-numeric: tabular-nums;
}

.beat-indicator {
  font-size: 8px;
  transition: opacity 0.1s;
}

.deck-eq-section {
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.deck-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.control-btn {
  min-width: 52px;
  height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.control-btn:active {
  transform: scale(0.96);
}

.control-btn.play-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  font-size: 18px;
  background: rgba(217, 91, 103, 0.1);
}

.control-btn.play-btn.playing {
  background: var(--deck-color);
  box-shadow: 0 0 20px rgba(217, 91, 103, 0.3);
}

.deck-pitch-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pitch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pitch-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pitch-value {
  font-size: 12px;
  font-weight: 700;
  color: #4ecdc4;
  font-variant-numeric: tabular-nums;
}

.pitch-value.positive {
  color: #ff6b6b;
}

.pitch-value.negative {
  color: #4ecdc4;
}

.pitch-slider {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(90deg, #4ecdc4, rgba(255, 255, 255, 0.1) 50%, #ff6b6b);
  border-radius: 3px;
  cursor: pointer;
}

.pitch-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.deck-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.volume-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.volume-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #feca57;
  border-radius: 50%;
  cursor: pointer;
}

.volume-value {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
  min-width: 30px;
  text-align: right;
}

.sync-btn {
  padding: 8px 16px;
  border: 1px solid;
  border-radius: 8px;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sync-btn:hover {
  background: rgba(78, 205, 196, 0.1);
}

.sync-btn.locked {
  background: rgba(78, 205, 196, 0.1);
}

.deck-analyzing {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 16px 24px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  z-index: 10;
}

.analyzing-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #4ecdc4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
