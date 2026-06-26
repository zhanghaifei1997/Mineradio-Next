<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useDjStore } from '@/stores/dj'
import { playQueueStore } from '@/stores/playQueue'
import { formatTime } from '@/utils/time'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const player = usePlayerStore()
const dj = useDjStore()
const queue = playQueueStore()

const activeDeck = ref<'A' | 'B'>('A')
const crossfader = ref(50)
const masterVolume = ref(80)

interface DeckState {
  volume: number
  pitch: number
  eqLow: number
  eqMid: number
  eqHigh: number
  playing: boolean
  cuePoint: number
}

const deckA = ref<DeckState>({
  volume: 80,
  pitch: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  playing: false,
  cuePoint: 0,
})

const deckB = ref<DeckState>({
  volume: 80,
  pitch: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  playing: false,
  cuePoint: 0,
})

const currentSongA = computed(() => player.currentSong)
const currentSongB = computed(() => {
  const nextIndex = queue.currentIndex + 1
  if (nextIndex < queue.queue.length) {
    return queue.queue[nextIndex]
  }
  return null
})

function toggleDeckPlay(deck: 'A' | 'B') {
  if (deck === 'A') {
    deckA.value.playing = !deckA.value.playing
    if (deckA.value.playing) {
      player.play()
    } else {
      player.pause()
    }
  } else {
    deckB.value.playing = !deckB.value.playing
  }
}

function setCue(deck: 'A' | 'B') {
  if (deck === 'A') {
    deckA.value.cuePoint = player.currentTime
  } else {
    deckB.value.cuePoint = 0
  }
}

function goToCue(deck: 'A' | 'B') {
  if (deck === 'A') {
    player.seek(deckA.value.cuePoint)
  }
}

function syncPitch() {
  deckB.value.pitch = deckA.value.pitch
}

function crossfadeToDeck(deck: 'A' | 'B') {
  crossfader.value = deck === 'A' ? 0 : 100
}

function beatMatch() {
  deckB.value.pitch = deckA.value.pitch
}

const progressA = computed(() => player.progress)
const currentTimeA = computed(() => formatTime(player.currentTime))
const durationA = computed(() => formatTime(player.duration))

function onDeckAClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  player.seek(percent * player.duration)
}
</script>

<template>
  <div class="dj-mode-panel">
    <div class="dj-header">
      <h3>DJ 模式</h3>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>

    <div class="dj-decks">
      <div class="dj-deck" :class="{ active: activeDeck === 'A', playing: deckA.playing }">
        <div class="deck-label">Deck A</div>
        
        <div class="deck-song" v-if="currentSongA">
          <div class="deck-cover">
            <img :src="currentSongA.coverUrl" alt="" v-if="currentSongA.coverUrl" />
            <div class="deck-cover-placeholder" v-else></div>
          </div>
          <div class="deck-info">
            <div class="deck-song-name">{{ currentSongA.name }}</div>
            <div class="deck-song-artist">
              {{ currentSongA.artists.map(a => a.name).join(' / ') }}
            </div>
          </div>
        </div>
        <div class="deck-song deck-song--placeholder" v-else>
          <div class="deck-cover-placeholder"></div>
          <div class="deck-info">
            <div class="deck-song-name">无曲目</div>
            <div class="deck-song-artist">加载中...</div>
          </div>
        </div>

        <div class="deck-progress" @click="onDeckAClick">
          <div class="progress-fill" :style="{ width: progressA + '%' }"></div>
        </div>
        <div class="deck-time">
          <span>{{ currentTimeA }}</span>
          <span>{{ durationA }}</span>
        </div>

        <div class="deck-vinyl" :class="{ spinning: deckA.playing }">
          <div class="vinyl-inner"></div>
        </div>

        <div class="deck-eq">
          <div class="eq-knob">
            <span class="eq-label">LOW</span>
            <input
              type="range"
              min="-12"
              max="12"
              v-model.number="deckA.eqLow"
              class="eq-slider"
              :style="{ '--eq-value': ((deckA.eqLow + 12) / 24) * 100 + '%' }"
            />
            <span class="eq-value">{{ deckA.eqLow > 0 ? '+' : '' }}{{ deckA.eqLow }}dB</span>
          </div>
          <div class="eq-knob">
            <span class="eq-label">MID</span>
            <input
              type="range"
              min="-12"
              max="12"
              v-model.number="deckA.eqMid"
              class="eq-slider"
              :style="{ '--eq-value': ((deckA.eqMid + 12) / 24) * 100 + '%' }"
            />
            <span class="eq-value">{{ deckA.eqMid > 0 ? '+' : '' }}{{ deckA.eqMid }}dB</span>
          </div>
          <div class="eq-knob">
            <span class="eq-label">HIGH</span>
            <input
              type="range"
              min="-12"
              max="12"
              v-model.number="deckA.eqHigh"
              class="eq-slider"
              :style="{ '--eq-value': ((deckA.eqHigh + 12) / 24) * 100 + '%' }"
            />
            <span class="eq-value">{{ deckA.eqHigh > 0 ? '+' : '' }}{{ deckA.eqHigh }}dB</span>
          </div>
        </div>

        <div class="deck-controls">
          <button class="deck-btn cue-btn" @click="setCue('A')" title="设置 Cue 点">CUE</button>
          <button class="deck-btn play-btn" :class="{ playing: deckA.playing }" @click="toggleDeckPlay('A')">
            {{ deckA.playing ? '⏸' : '▶' }}
          </button>
          <button class="deck-btn cue-btn" @click="goToCue('A')" title="跳到 Cue 点">▶CUE</button>
        </div>

        <div class="deck-pitch">
          <span class="pitch-label">PITCH</span>
          <input
            type="range"
            min="-10"
            max="10"
            step="0.1"
            v-model.number="deckA.pitch"
            class="pitch-slider"
          />
          <span class="pitch-value">{{ deckA.pitch > 0 ? '+' : '' }}{{ deckA.pitch.toFixed(1) }}%</span>
        </div>
      </div>

      <div class="dj-mixer">
        <div class="mixer-section">
          <div class="mixer-title">交叉推子</div>
          <div class="crossfader-wrap">
            <span class="crossfader-label">A</span>
            <input
              type="range"
              min="0"
              max="100"
              v-model.number="crossfader"
              class="crossfader"
            />
            <span class="crossfader-label">B</span>
          </div>
          <div class="crossfader-buttons">
            <button class="xfade-btn" @click="crossfadeToDeck('A')">A</button>
            <button class="xfade-btn xfade-btn--center" @click="crossfader = 50">●</button>
            <button class="xfade-btn" @click="crossfadeToDeck('B')">B</button>
          </div>
        </div>

        <div class="mixer-section">
          <div class="mixer-title">主音量</div>
          <input
            type="range"
            min="0"
            max="100"
            v-model.number="masterVolume"
            class="volume-slider"
          />
          <span class="volume-value">{{ masterVolume }}%</span>
        </div>

        <div class="mixer-section">
          <button class="sync-btn" @click="syncPitch">
            🔗 速度同步
          </button>
          <button class="sync-btn beatmatch-btn" @click="beatMatch">
            🎯 节拍对齐
          </button>
        </div>

        <div class="mixer-section dj-status">
          <div class="status-item">
            <span class="status-label">BPM (A)</span>
            <span class="status-value">--</span>
          </div>
          <div class="status-item">
            <span class="status-label">BPM (B)</span>
            <span class="status-value">--</span>
          </div>
          <div class="status-item">
            <span class="status-label">DJ 模式</span>
            <span class="status-value" :class="{ active: dj.isDjModeActive }">
              {{ dj.isDjModeActive ? '开启' : '关闭' }}
            </span>
          </div>
        </div>
      </div>

      <div class="dj-deck deck-b" :class="{ active: activeDeck === 'B', playing: deckB.playing }">
        <div class="deck-label">Deck B</div>
        
        <div class="deck-song" v-if="currentSongB">
          <div class="deck-cover">
            <img :src="currentSongB.coverUrl" alt="" v-if="currentSongB.coverUrl" />
            <div class="deck-cover-placeholder" v-else></div>
          </div>
          <div class="deck-info">
            <div class="deck-song-name">{{ currentSongB.name }}</div>
            <div class="deck-song-artist">
              {{ currentSongB.artists.map(a => a.name).join(' / ') }}
            </div>
          </div>
        </div>
        <div class="deck-song deck-song--placeholder" v-else>
          <div class="deck-cover-placeholder"></div>
          <div class="deck-info">
            <div class="deck-song-name">下一曲</div>
            <div class="deck-song-artist">队列中无更多</div>
          </div>
        </div>

        <div class="deck-progress deck-progress--disabled">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="deck-time">
          <span>0:00</span>
          <span>--:--</span>
        </div>

        <div class="deck-vinyl" :class="{ spinning: deckB.playing }">
          <div class="vinyl-inner"></div>
        </div>

        <div class="deck-eq">
          <div class="eq-knob">
            <span class="eq-label">LOW</span>
            <input
              type="range"
              min="-12"
              max="12"
              v-model.number="deckB.eqLow"
              class="eq-slider"
              :style="{ '--eq-value': ((deckB.eqLow + 12) / 24) * 100 + '%' }"
            />
            <span class="eq-value">{{ deckB.eqLow > 0 ? '+' : '' }}{{ deckB.eqLow }}dB</span>
          </div>
          <div class="eq-knob">
            <span class="eq-label">MID</span>
            <input
              type="range"
              min="-12"
              max="12"
              v-model.number="deckB.eqMid"
              class="eq-slider"
              :style="{ '--eq-value': ((deckB.eqMid + 12) / 24) * 100 + '%' }"
            />
            <span class="eq-value">{{ deckB.eqMid > 0 ? '+' : '' }}{{ deckB.eqMid }}dB</span>
          </div>
          <div class="eq-knob">
            <span class="eq-label">HIGH</span>
            <input
              type="range"
              min="-12"
              max="12"
              v-model.number="deckB.eqHigh"
              class="eq-slider"
              :style="{ '--eq-value': ((deckB.eqHigh + 12) / 24) * 100 + '%' }"
            />
            <span class="eq-value">{{ deckB.eqHigh > 0 ? '+' : '' }}{{ deckB.eqHigh }}dB</span>
          </div>
        </div>

        <div class="deck-controls">
          <button class="deck-btn cue-btn" @click="setCue('B')" title="设置 Cue 点">CUE</button>
          <button class="deck-btn play-btn" :class="{ playing: deckB.playing }" @click="toggleDeckPlay('B')">
            {{ deckB.playing ? '⏸' : '▶' }}
          </button>
          <button class="deck-btn cue-btn" @click="goToCue('B')" title="跳到 Cue 点">▶CUE</button>
        </div>

        <div class="deck-pitch">
          <span class="pitch-label">PITCH</span>
          <input
            type="range"
            min="-10"
            max="10"
            step="0.1"
            v-model.number="deckB.pitch"
            class="pitch-slider"
          />
          <span class="pitch-value">{{ deckB.pitch > 0 ? '+' : '' }}{{ deckB.pitch.toFixed(1) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dj-mode-panel {
  position: absolute;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  max-width: 95vw;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 20px;
  z-index: 200;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.dj-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.dj-header h3 {
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

.dj-decks {
  display: flex;
  gap: 20px;
}

.dj-deck {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s;
}

.dj-deck.active {
  border-color: rgba(217, 91, 103, 0.4);
  box-shadow: 0 0 20px rgba(217, 91, 103, 0.1);
}

.dj-deck.playing .deck-vinyl {
  animation-play-state: running;
}

.deck-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.deck-song {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.deck-cover {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.deck-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.deck-cover-placeholder {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(100, 50, 150, 0.3));
}

.deck-info {
  min-width: 0;
  flex: 1;
}

.deck-song-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deck-song-artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deck-progress {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  margin-bottom: 6px;
  overflow: hidden;
}

.deck-progress--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #feca57);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.deck-time {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
}

.deck-vinyl {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    #1a1a1a 0deg,
    #2a2a2a 10deg,
    #1a1a1a 20deg,
    #2a2a2a 30deg,
    #1a1a1a 40deg,
    #2a2a2a 50deg,
    #1a1a1a 60deg,
    #2a2a2a 70deg,
    #1a1a1a 80deg,
    #2a2a2a 90deg,
    #1a1a1a 100deg,
    #2a2a2a 110deg,
    #1a1a1a 120deg,
    #2a2a2a 130deg,
    #1a1a1a 140deg,
    #2a2a2a 150deg,
    #1a1a1a 160deg,
    #2a2a2a 170deg,
    #1a1a1a 180deg,
    #2a2a2a 190deg,
    #1a1a1a 200deg,
    #2a2a2a 210deg,
    #1a1a1a 220deg,
    #2a2a2a 230deg,
    #1a1a1a 240deg,
    #2a2a2a 250deg,
    #1a1a1a 260deg,
    #2a2a2a 270deg,
    #1a1a1a 280deg,
    #2a2a2a 290deg,
    #1a1a1a 300deg,
    #2a2a2a 310deg,
    #1a1a1a 320deg,
    #2a2a2a 330deg,
    #1a1a1a 340deg,
    #2a2a2a 350deg,
    #1a1a1a 360deg
  );
  display: flex;
  align-items: center;
  justify-content: center;
  animation: spin 2s linear infinite;
  animation-play-state: paused;
}

.vinyl-inner {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #d95b67;
  box-shadow: 0 0 10px rgba(217, 91, 103, 0.5);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.deck-eq {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16px;
}

.eq-knob {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.eq-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}

.eq-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 24px;
  height: 60px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  writing-mode: vertical-lr;
  direction: rtl;
  cursor: pointer;
}

.eq-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 8px;
  background: #d95b67;
  border-radius: 2px;
  cursor: pointer;
}

.eq-value {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.deck-controls {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
}

.deck-btn {
  min-width: 48px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.deck-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
}

.deck-btn.play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  font-size: 16px;
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.4);
  color: #d95b67;
}

.deck-btn.play-btn:hover {
  background: rgba(217, 91, 103, 0.3);
}

.deck-btn.play-btn.playing {
  background: #d95b67;
  color: #fff;
}

.deck-btn.cue-btn {
  font-size: 10px;
}

.deck-pitch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.pitch-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}

.pitch-slider {
  width: 80%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
}

.pitch-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #4ecdc4;
  border-radius: 50%;
  cursor: pointer;
}

.pitch-value {
  font-size: 11px;
  color: #4ecdc4;
  font-weight: 600;
}

.dj-mixer {
  width: 160px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.mixer-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.mixer-title {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.crossfader-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.crossfader-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
}

.crossfader {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(90deg, rgba(217, 91, 103, 0.3), rgba(78, 205, 196, 0.3));
  border-radius: 3px;
  cursor: pointer;
}

.crossfader::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.crossfader-buttons {
  display: flex;
  gap: 4px;
}

.xfade-btn {
  width: 28px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.xfade-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.xfade-btn--center {
  font-size: 8px;
}

.volume-slider {
  width: 100%;
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
  width: 14px;
  height: 14px;
  background: #feca57;
  border-radius: 50%;
  cursor: pointer;
}

.volume-value {
  font-size: 11px;
  color: #feca57;
  font-weight: 600;
}

.sync-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid rgba(78, 205, 196, 0.3);
  background: rgba(78, 205, 196, 0.1);
  color: #4ecdc4;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.sync-btn:hover {
  background: rgba(78, 205, 196, 0.2);
}

.beatmatch-btn {
  border-color: rgba(254, 202, 87, 0.3);
  background: rgba(254, 202, 87, 0.1);
  color: #feca57;
}

.beatmatch-btn:hover {
  background: rgba(254, 202, 87, 0.2);
}

.dj-status {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.status-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 11px;
}

.status-label {
  color: rgba(255, 255, 255, 0.5);
}

.status-value {
  color: rgba(255, 255, 255, 0.8);
  font-weight: 600;
}

.status-value.active {
  color: #4ecdc4;
}
</style>
