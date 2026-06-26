<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'

const player = usePlayerStore()
const fx = useFxStore()

const emit = defineEmits<{
  (e: 'click'): void
}>()

const isPlaying = computed(() => player.isPlaying && player.currentSong)

function handleClick() {
  emit('click')
}
</script>

<template>
  <div
    class="bottom-handle"
    :class="{ 'bottom-handle--playing': isPlaying }"
    @click="handleClick"
  >
    <div class="bottom-handle__bar"></div>
  </div>
</template>

<style scoped>
.bottom-handle {
  position: fixed;
  bottom: 13px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99;
  cursor: pointer;
  padding: 8px 16px;
  opacity: 0.14;
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: auto;
}

.bottom-handle:hover {
  opacity: 0.82;
  transform: translateX(-50%) translateY(-4px);
}

.bottom-handle__bar {
  width: 164px;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  transition: all 0.3s ease;
}

.bottom-handle--playing .bottom-handle__bar {
  box-shadow: 0 0 12px rgba(217, 91, 103, 0.6),
              0 0 24px rgba(217, 91, 103, 0.3);
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
}
</style>
