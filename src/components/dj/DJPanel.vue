<script setup lang="ts">
import { computed } from 'vue'
import { useDjDeckStore, type DeckId } from '@/stores/djDeck'
import { usePlayerStore } from '@/stores/player'
import { playQueueStore } from '@/stores/playQueue'
import DeckPlayer from './DeckPlayer.vue'
import Crossfader from './Crossfader.vue'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const djDeck = useDjDeckStore()
const player = usePlayerStore()
const queue = playQueueStore()

const masterVolumePercent = computed(() => Math.round(djDeck.masterVolume * 100))

const deckABpm = computed(() => djDeck.deckA.beatMap?.bpm || 0)
const deckBBpm = computed(() => djDeck.deckB.beatMap?.bpm || 0)

const bpmDiff = computed(() => {
  if (!deckABpm.value || !deckBBpm.value) return 0
  return Math.abs(deckABpm.value - deckBBpm.value)
})

const phaseAligned = computed(() => {
  return bpmDiff.value < 0.5
})

async function loadCurrentSongToDeck(deck: DeckId) {
  if (!player.currentSong) return
  try {
    const url = await player.getSongUrl(player.currentSong)
    if (url) {
      await djDeck.loadToDeck(deck, player.currentSong, url)
    }
  } catch (e) {
    console.error('Failed to load current song to deck:', e)
  }
}

async function loadNextSongToDeck(deck: DeckId) {
  const nextIndex = queue.currentIndex + 1
  if (nextIndex >= queue.queue.length) return
  const song = queue.queue[nextIndex]
  if (!song) return

  try {
    const url = await player.getSongUrl(song)
    if (url) {
      await djDeck.loadToDeck(deck, song, url)
    }
  } catch (e) {
    console.error('Failed to load song to deck:', e)
  }
}

function handleDeckPlay(deck: DeckId) {
  djDeck.playDeck(deck)
}

function handleDeckPause(deck: DeckId) {
  djDeck.pauseDeck(deck)
}

function handleDeckTogglePlay(deck: DeckId) {
  djDeck.togglePlay(deck)
}

function handleDeckCue(deck: DeckId) {
  djDeck.setCue(deck)
}

function handleDeckGotoCue(deck: DeckId) {
  djDeck.gotoCue(deck)
}

function handleDeckSync(deck: DeckId) {
  djDeck.syncBeat(deck)
}

function handleDeckSeek(deck: DeckId, time: number) {
  djDeck.seekDeck(deck, time)
}

function handleDeckPitchChange(deck: DeckId, value: number) {
  djDeck.setPitch(deck, value)
}

function handleDeckVolumeChange(deck: DeckId, value: number) {
  djDeck.setVolume(deck, value)
}

function handleDeckEqChange(deck: DeckId, band: 'low' | 'mid' | 'high', value: number) {
  djDeck.setEq(deck, band, value)
}

function handleDeckToggleSyncLock(deck: DeckId) {
  djDeck.toggleSyncLock(deck)
}

function handleMasterVolumeChange(e: Event) {
  const target = e.target as HTMLInputElement
  djDeck.setMasterVolume(parseFloat(target.value) / 100)
}

function beatMatchBoth() {
  djDeck.syncBeat('B')
}
</script>

<template>
  <div class="dj-panel">
    <div class="dj-panel-header">
      <div class="header-left">
        <h2 class="panel-title">DJ 混音台</h2>
        <div class="panel-status" :class="{ aligned: phaseAligned }">
          <span class="status-dot"></span>
          <span>{{ phaseAligned ? '节拍同步' : '未同步' }}</span>
        </div>
      </div>
      <div class="header-right">
        <div class="bpm-display">
          <div class="bpm-item">
            <span class="bpm-label">A</span>
            <span class="bpm-num">{{ deckABpm ? deckABpm.toFixed(1) : '--' }}</span>
          </div>
          <div class="bpm-divider">⇄</div>
          <div class="bpm-item">
            <span class="bpm-label">B</span>
            <span class="bpm-num">{{ deckBBpm ? deckBBpm.toFixed(1) : '--' }}</span>
          </div>
          <div class="bpm-diff" v-if="bpmDiff > 0">
            Δ {{ bpmDiff.toFixed(1) }}
          </div>
        </div>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
    </div>

    <div class="dj-panel-body">
      <div class="deck-section deck-a-section">
        <div class="deck-loaders">
          <button class="load-btn" @click="loadCurrentSongToDeck('A')">
            加载当前歌曲
          </button>
          <button class="load-btn" @click="loadNextSongToDeck('A')">
            加载下一曲
          </button>
        </div>
        <DeckPlayer
          deck-id="A"
          :deck="djDeck.deckA"
          primary-color="#d95b67"
          secondary-color="#ff8a80"
          @play="handleDeckPlay('A')"
          @pause="handleDeckPause('A')"
          @toggle-play="handleDeckTogglePlay('A')"
          @cue="handleDeckCue('A')"
          @goto-cue="handleDeckGotoCue('A')"
          @sync="handleDeckSync('A')"
          @seek="(t) => handleDeckSeek('A', t)"
          @pitch-change="(v) => handleDeckPitchChange('A', v)"
          @volume-change="(v) => handleDeckVolumeChange('A', v)"
          @eq-change="(b, v) => handleDeckEqChange('A', b, v)"
          @toggle-sync-lock="handleDeckToggleSyncLock('A')"
        />
      </div>

      <div class="mixer-section">
        <div class="mixer-panel">
          <div class="mixer-title">MIXER</div>

          <div class="crossfader-section">
            <div class="section-label">交叉推子</div>
            <Crossfader
              v-model="djDeck.crossfader"
              label-a="A"
              label-b="B"
              color-a="#d95b67"
              color-b="#4ecdc4"
            />
          </div>

          <div class="master-section">
            <div class="section-label">主音量</div>
            <div class="master-volume">
              <input
                type="range"
                min="0"
                max="100"
                :value="masterVolumePercent"
                class="master-slider"
                @input="handleMasterVolumeChange"
              />
              <span class="master-value">{{ masterVolumePercent }}%</span>
            </div>
          </div>

          <div class="sync-section">
            <button class="beatmatch-btn" @click="beatMatchBoth">
              <span class="btn-icon">🎯</span>
              <span class="btn-text">节拍匹配 B → A</span>
            </button>
          </div>

          <div class="mixer-stats">
            <div class="stat-item">
              <span class="stat-label">缓存曲目</span>
              <span class="stat-value">{{ djDeck.beatMapCache.size }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">A 状态</span>
              <span class="stat-value" :class="{ playing: djDeck.deckA.isPlaying }">
                {{ djDeck.deckA.isPlaying ? '播放中' : '已暂停' }}
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">B 状态</span>
              <span class="stat-value" :class="{ playing: djDeck.deckB.isPlaying }">
                {{ djDeck.deckB.isPlaying ? '播放中' : '已暂停' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="deck-section deck-b-section">
        <div class="deck-loaders">
          <button class="load-btn" @click="loadCurrentSongToDeck('B')">
            加载当前歌曲
          </button>
          <button class="load-btn" @click="loadNextSongToDeck('B')">
            加载下一曲
          </button>
        </div>
        <DeckPlayer
          deck-id="B"
          :deck="djDeck.deckB"
          primary-color="#4ecdc4"
          secondary-color="#7fdfd8"
          @play="handleDeckPlay('B')"
          @pause="handleDeckPause('B')"
          @toggle-play="handleDeckTogglePlay('B')"
          @cue="handleDeckCue('B')"
          @goto-cue="handleDeckGotoCue('B')"
          @sync="handleDeckSync('B')"
          @seek="(t) => handleDeckSeek('B', t)"
          @pitch-change="(v) => handleDeckPitchChange('B', v)"
          @volume-change="(v) => handleDeckVolumeChange('B', v)"
          @eq-change="(b, v) => handleDeckEqChange('B', b, v)"
          @toggle-sync-lock="handleDeckToggleSyncLock('B')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dj-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 1000px;
  max-width: 95vw;
  max-height: 90vh;
  background: rgba(12, 12, 16, 0.98);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  z-index: 300;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.dj-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}

.panel-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.panel-status.aligned {
  background: rgba(78, 205, 196, 0.15);
  color: #4ecdc4;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.panel-status:not(.aligned) .status-dot {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.bpm-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}

.bpm-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.bpm-label {
  font-size: 10px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.bpm-num {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  font-variant-numeric: tabular-nums;
  font-family: 'Courier New', monospace;
}

.bpm-divider {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.3);
}

.bpm-diff {
  font-size: 11px;
  font-weight: 600;
  color: #feca57;
  padding: 2px 8px;
  background: rgba(254, 202, 87, 0.1);
  border-radius: 4px;
}

.close-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
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

.dj-panel-body {
  flex: 1;
  display: flex;
  padding: 20px;
  gap: 20px;
  overflow-y: auto;
}

.deck-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.deck-loaders {
  display: flex;
  gap: 8px;
}

.load-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.load-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.mixer-section {
  width: 220px;
  flex-shrink: 0;
}

.mixer-panel {
  background: rgba(20, 20, 25, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.mixer-title {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 3px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.section-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
  text-align: center;
}

.crossfader-section,
.master-section,
.sync-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.master-volume {
  display: flex;
  align-items: center;
  gap: 10px;
}

.master-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: linear-gradient(90deg, rgba(254, 202, 87, 0.3), rgba(254, 202, 87, 0.3));
  border-radius: 3px;
  cursor: pointer;
}

.master-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: #feca57;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.master-value {
  font-size: 11px;
  color: #feca57;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  min-width: 36px;
  text-align: right;
}

.beatmatch-btn {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(254, 202, 87, 0.3);
  background: rgba(254, 202, 87, 0.1);
  color: #feca57;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.15s;
}

.beatmatch-btn:hover {
  background: rgba(254, 202, 87, 0.2);
  transform: translateY(-1px);
}

.btn-icon {
  font-size: 14px;
}

.mixer-stats {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}

.stat-label {
  color: rgba(255, 255, 255, 0.4);
}

.stat-value {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.stat-value.playing {
  color: #4ecdc4;
}
</style>
