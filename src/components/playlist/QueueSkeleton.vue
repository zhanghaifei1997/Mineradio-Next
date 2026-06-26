<script setup lang="ts">
defineProps<{
  count?: number
}>()
</script>

<template>
  <div class="queue-skeleton">
    <div
      v-for="i in (count || 6)"
      :key="i"
      class="queue-skeleton__item"
      :style="{ '--skeleton-delay': (i - 1) * 0.08 + 's' }"
    >
      <div class="skeleton-index"></div>
      <div class="skeleton-cover"></div>
      <div class="skeleton-info">
        <div class="skeleton-title"></div>
        <div class="skeleton-artist"></div>
      </div>
      <div class="skeleton-duration"></div>
    </div>
  </div>
</template>

<style scoped>
.queue-skeleton {
  width: 100%;
  padding: 8px 0;
}

.queue-skeleton__item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 16px;
  border-radius: 12px;
  margin: 4px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  position: relative;
  overflow: hidden;
  animation: queue-shimmer 1.05s linear infinite;
  animation-delay: var(--skeleton-delay, 0s);
}

.queue-skeleton__item::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.06),
    transparent
  );
  animation: queue-shimmer-slide 1.05s linear infinite;
  animation-delay: var(--skeleton-delay, 0s);
}

@keyframes queue-shimmer {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes queue-shimmer-slide {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

.skeleton-index {
  width: 20px;
  height: 16px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.skeleton-cover {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-title {
  width: 60%;
  height: 14px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.skeleton-artist {
  width: 40%;
  height: 12px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
}

.skeleton-duration {
  width: 40px;
  height: 12px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}
</style>
