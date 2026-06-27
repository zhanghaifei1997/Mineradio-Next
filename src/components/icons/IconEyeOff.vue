<template>
  <!-- 老项目 controls-hide-btn 只有一个图标（三层横线），不存在"eye-off"版。active 状态靠 CSS class 区分。这里保留 eye-off 给非 active 状态用，但用老项目的线条样式。 -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 8h14" />
    <path d="M8 12h8" />
    <path d="M10 16h4" />
    <!-- small dot to indicate "auto" -->
    <circle cx="19" cy="17" r="1.3" fill="currentColor" stroke="none" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 19 })
</script>
