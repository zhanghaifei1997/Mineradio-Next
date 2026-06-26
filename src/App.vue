<script setup lang="ts">
import { onMounted } from 'vue'
import VisualCanvas from '@/components/visual/VisualCanvas.vue'
import PlayerBar from '@/components/player/PlayerBar.vue'
import SearchPanel from '@/components/search/SearchPanel.vue'
import PlaylistShelf from '@/components/playlist/PlaylistShelf.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import { usePlayerStore } from '@/stores/player'
import { useFxStore } from '@/stores/fx'

const player = usePlayerStore()
const fx = useFxStore()

onMounted(() => {
  player.initAudio()
})
</script>

<template>
  <div class="app-container" :class="{ 'fx-eco': fx.settings.performanceQuality === 'eco' }">
    <VisualCanvas />

    <div class="app-content">
      <PlaylistShelf />
      <SearchPanel />
      <SettingsPanel />
    </div>

    <PlayerBar />
  </div>
</template>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: #0a0a0a;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-content {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.app-content > * {
  pointer-events: auto;
}
</style>
