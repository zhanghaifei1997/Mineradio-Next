<template>
  <!-- 老项目原版 prev-btn: fill, bar+triangle "M6 6h2v12H6zm3.5 6l8.5 6V6z" -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
}>(), {
  size: 18,
})
</script>
