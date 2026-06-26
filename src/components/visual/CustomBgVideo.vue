<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useCustomBgStore } from '@/stores/customBg'

const customBg = useCustomBgStore()
const videoRef = ref<HTMLVideoElement | null>(null)

onMounted(() => {
  if (videoRef.value) {
    customBg.setVideoElement(videoRef.value)
  }
})

onUnmounted(() => {
  customBg.setVideoElement(null)
})

watch(
  () => customBg.settings.videoSrc,
  (src) => {
    if (videoRef.value && src) {
      videoRef.value.src = src
      videoRef.value.load()
      if (customBg.settings.autoPlay && customBg.settings.mode !== 'off') {
        videoRef.value.play().catch(() => {})
      }
    }
  }
)
</script>

<template>
  <div
    v-if="customBg.isVideoActive"
    class="custom-bg-video"
    :class="`custom-bg-video--${customBg.settings.mode}`"
  >
    <video
      ref="videoRef"
      class="custom-bg-video__element"
      :muted="customBg.settings.muted"
      :loop="customBg.settings.loop"
      :style="{ opacity: customBg.settings.opacity }"
      playsinline
      @timeupdate="customBg.onTimeUpdate"
      @loadedmetadata="customBg.onLoadedMetadata"
      @play="customBg.onPlay"
      @pause="customBg.onPause"
    />
  </div>
</template>

<style scoped>
.custom-bg-video {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.custom-bg-video__element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.5s ease;
}

.custom-bg-video--video-only + .app-content {
  background: transparent;
}

@media (max-aspect-ratio: 16/9) {
  .custom-bg-video__element {
    width: auto;
    height: 100%;
  }
}
</style>
