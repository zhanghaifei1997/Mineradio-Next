<template>
  <!-- 老项目原版 immersive-btn: stroke, focus corners + center circle -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeW"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 9V5a1 1 0 0 1 1-1h4" />
    <path d="M15 4h4a1 1 0 0 1 1 1v4" />
    <path d="M20 15v4a1 1 0 0 1-1 1h-4" />
    <path d="M9 20H5a1 1 0 0 1-1-1v-4" />
    <circle cx="12" cy="12" r="2.2" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
  strokeW?: number | string
}>(), {
  size: 19,
  strokeW: 1.9,
})
</script>
