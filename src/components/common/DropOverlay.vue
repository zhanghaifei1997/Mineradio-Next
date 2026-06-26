<script setup lang="ts">
import { computed } from 'vue'

defineProps<{
  visible: boolean
}>()
</script>

<template>
  <Transition name="drop-overlay">
    <div v-if="visible" class="drop-overlay">
      <div class="drop-overlay__border"></div>
      <div class="drop-overlay__content">
        <div class="drop-overlay__icon">📁</div>
        <div class="drop-overlay__title">释放以添加到播放列表</div>
        <div class="drop-overlay__subtitle">支持 MP3, FLAC, WAV, M4A, OGG 等格式</div>
        <div class="drop-overlay__music-notes">
          <span class="music-note n1">🎵</span>
          <span class="music-note n2">🎶</span>
          <span class="music-note n3">🎵</span>
          <span class="music-note n4">🎶</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(20px) saturate(1.5);
  -webkit-backdrop-filter: blur(20px) saturate(1.5);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

[data-theme='light'] .drop-overlay {
  background: rgba(245, 245, 247, 0.85);
}

.drop-overlay__border {
  position: absolute;
  inset: 20px;
  border: 3px dashed rgba(217, 91, 103, 0.6);
  border-radius: 24px;
  animation: drop-border-pulse 1.5s ease-in-out infinite;
}

@keyframes drop-border-pulse {
  0%, 100% {
    border-color: rgba(217, 91, 103, 0.4);
    box-shadow:
      inset 0 0 0 0 rgba(217, 91, 103, 0),
      0 0 40px rgba(217, 91, 103, 0.1);
  }
  50% {
    border-color: rgba(217, 91, 103, 0.8);
    box-shadow:
      inset 0 0 30px rgba(217, 91, 103, 0.1),
      0 0 60px rgba(217, 91, 103, 0.2);
  }
}

.drop-overlay__content {
  position: relative;
  text-align: center;
  padding: 48px 64px;
  z-index: 1;
}

.drop-overlay__icon {
  font-size: 72px;
  margin-bottom: 20px;
  animation: drop-icon-bounce 1s ease-in-out infinite;
}

@keyframes drop-icon-bounce {
  0%, 100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-12px) scale(1.05);
  }
}

.drop-overlay__title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.drop-overlay__subtitle {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.drop-overlay__music-notes {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.music-note {
  position: absolute;
  font-size: 24px;
  opacity: 0.6;
  animation: note-float 3s ease-in-out infinite;
}

.music-note.n1 {
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.music-note.n2 {
  top: 20%;
  right: 15%;
  animation-delay: 0.5s;
}

.music-note.n3 {
  bottom: 25%;
  left: 20%;
  animation-delay: 1s;
}

.music-note.n4 {
  bottom: 15%;
  right: 10%;
  animation-delay: 1.5s;
}

@keyframes note-float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-20px) rotate(10deg);
    opacity: 0.8;
  }
}

.drop-overlay-enter-active {
  transition: opacity 0.25s ease;
}

.drop-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.drop-overlay-enter-from,
.drop-overlay-leave-to {
  opacity: 0;
}

.drop-overlay-enter-from .drop-overlay__content,
.drop-overlay-leave-to .drop-overlay__content {
  transform: scale(0.95);
}

.drop-overlay-enter-from .drop-overlay__border,
.drop-overlay-leave-to .drop-overlay__border {
  opacity: 0;
  transform: scale(1.02);
}
</style>
