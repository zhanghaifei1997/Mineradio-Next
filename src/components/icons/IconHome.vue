<template>
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
    <path d="M3 10.8 12 3l9 7.8" />
    <path d="M5 10v10h14V10" />
    <path d="M9.5 20v-5h5v5" />
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
