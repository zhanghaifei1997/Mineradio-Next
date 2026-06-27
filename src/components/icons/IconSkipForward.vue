<template>
  <!-- 老项目原版 next-btn: fill, triangle+bar "M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
}>(), {
  size: 18,
})
</script>
