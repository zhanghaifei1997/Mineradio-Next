<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useImmersiveStore } from '@/stores/immersive'

const player = usePlayerStore()
const immersive = useImmersiveStore()

const visible = ref(false)
const thumbScale = ref(1)

const thumbTitle = computed(() => player.currentSong?.name || '')
const thumbArtist = computed(() => {
  if (!player.currentSong) return ''
  return player.currentSong.artists?.map((a: any) => a.name).join(' / ') || ''
})
const thumbCoverSrc = computed(() => player.currentSong?.coverUrl || '')

// Show when playing and has a song
watch(() => player.currentSong, (song) => {
  if (song) {
    visible.value = true
  }
}, { immediate: true })

watch(() => player.isPlaying, (playing) => {
  // Hide when stopped and no song
  if (!playing && !player.currentSong) {
    visible.value = false
  }
})

// Pulse animation synced to bass (matching old project thumb-cover scale with bass)
// The VisualCanvas/ThreeJS renderer calls this from its animate loop
// For now we do a simplified CSS-based breathing animation
let pulseRaf: number | null = null
let pulsePhase = 0

function animatePulse() {
  if (player.isPlaying) {
    pulsePhase += 0.04
    thumbScale.value = 1 + Math.sin(pulsePhase) * 0.04 // subtle breathing
  } else {
    thumbScale.value += (1 - thumbScale.value) * 0.1 // return to 1
  }
  pulseRaf = requestAnimationFrame(animatePulse)
}

onMounted(() => {
  pulseRaf = requestAnimationFrame(animatePulse)
})

onUnmounted(() => {
  if (pulseRaf) cancelAnimationFrame(pulseRaf)
})

function openSongDetail() {
  // Emit to parent to open song detail modal
  // TODO: connect to MainView's openSongDetail
}

function openArtistDetail() {
  // Emit to parent to open artist detail modal
  // TODO: connect to MainView's openArtistDetail
}
</script>

<template>
  <Transition name="thumb-fade">
    <div
      v-if="visible && !immersive.isImmersive"
      class="thumb-wrap"
      :class="{ visible: visible }"
    >
      <img
        class="thumb-cover"
        :src="thumbCoverSrc"
        :style="{ transform: `scale(${thumbScale})` }"
        alt=""
        @error="(e: Event) => ((e.target as HTMLImageElement).src = '')"
      />
      <div class="thumb-info">
        <div class="thumb-title" @click="openSongDetail" title="歌曲详情">{{ thumbTitle }}</div>
        <div class="thumb-artist" @click="openArtistDetail" title="歌手详情">{{ thumbArtist }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.thumb-wrap {
  position: fixed;
  z-index: 6;
  left: 24px;
  bottom: 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.8s ease;
}

.thumb-wrap.visible {
  opacity: 1;
  pointer-events: auto;
}

.thumb-cover {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  transition: transform 0.15s ease;
}

.thumb-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 250px;
  min-width: 0;
}

.thumb-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: color 0.2s, text-shadow 0.2s;
}

.thumb-artist {
  font-size: 11px;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: color 0.2s, text-shadow 0.2s;
}

.thumb-title:hover,
.thumb-artist:hover {
  color: #fff0bf;
  text-shadow: 0 0 16px rgba(244, 210, 138, 0.22);
}

.thumb-fade-enter-active,
.thumb-fade-leave-active {
  transition: opacity 0.8s ease;
}

.thumb-fade-enter-from,
.thumb-fade-leave-to {
  opacity: 0;
}
</style>
