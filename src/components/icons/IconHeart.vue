<template>
  <!-- 老项目原版 heart SVG: fill-only heart path (M12 21.45...)，liked 时 fill=currentColor + drop-shadow，未 liked 时 fill=currentColor 随 ctrl-btn color -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    :class="['heart-svg', { liked: filled }]"
    aria-hidden="true"
  >
    <path d="M12 21.45c-.32 0-.62-.12-.86-.34l-1.23-1.12C5.54 16.03 2.25 13.05 2.25 8.9 2.25 5.48 4.88 2.9 8.28 2.9c1.7 0 3.35.72 4.52 1.96C13.97 3.62 15.62 2.9 17.32 2.9c3.4 0 6.03 2.58 6.03 6 0 4.15-3.29 7.13-7.66 11.09l-1.23 1.12c-.24.22-.54.34-.86.34z" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number | string
  filled?: boolean
}>(), {
  size: 21,
  filled: false,
})
</script>

<style scoped>
.heart-svg {
  display: block;
  fill: currentColor;
  filter: drop-shadow(0 0 0 rgba(255,122,144,0));
}
.heart-svg.liked {
  fill: #ff7a90;
  filter: drop-shadow(0 0 10px rgba(255,122,144,.34));
}
</style>
