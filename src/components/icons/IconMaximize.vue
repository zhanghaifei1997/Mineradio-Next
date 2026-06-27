<template>
  <!-- 老项目原版 fullscreen: stroke, 4 corner brackets -->
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
    <path d="M3 7V3h4" />
    <path d="M21 7V3h-4" />
    <path d="M3 17v4h4" />
    <path d="M21 17v4h-4" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 18 })
</script>
