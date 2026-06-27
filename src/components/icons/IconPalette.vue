<template>
  <!-- 老项目原版 fx-fab: stroke, 2 slider rows -->
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
    <path d="M4 7h8" />
    <path d="M16 7h4" />
    <circle cx="14" cy="7" r="2" />
    <path d="M4 17h4" />
    <path d="M12 17h8" />
    <circle cx="10" cy="17" r="2" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
  strokeW?: number | string
}>(), {
  size: 21,
  strokeW: 1.9,
})
</script>
