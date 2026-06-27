<template>
  <!-- 老项目原版 controls-hide-btn: stroke, 3 horizontal lines (decreasing width) -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 8h14" />
    <path d="M8 12h8" />
    <path d="M10 16h4" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 19 })
</script>
