<template>
  <div id="desktop-window-shell">
    <!-- TitleBar will go here -->
    <div class="app-content">
      <h1>Mineradio-Next</h1>
      <p>Vue3 + TypeScript + Vite + Tauri v2</p>
      <p class="hint">前端迁移脚手架已就绪，后续模块逐步迁入。</p>
    </div>
    <!-- PlayerBar will go here -->
  </div>
</template>

<script setup lang="ts">
// Components will be imported here as they are migrated
</script>

<style scoped>
.app-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 12px;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--fc-accent);
}

p {
  font-size: 14px;
  color: var(--fc-muted);
}

.hint {
  font-size: 12px;
  color: var(--fc-hair-2);
}
</style>
