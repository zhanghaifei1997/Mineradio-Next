<template>
  <!-- 老项目原版: fill triangle "M8 5v14l11-7z" -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
}>(), {
  size: 20,
})
</script>
