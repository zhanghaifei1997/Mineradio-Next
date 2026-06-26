<script setup lang="ts">
import { computed } from 'vue'
import { useHintStore } from '@/stores/hint'

const hint = useHintStore()

const hintClass = computed(() => {
  if (!hint.current) return ''
  return `hint hint--${hint.current.type} ${hint.isVisible ? 'hint-visible' : 'hint-hidden'}`
})
</script>

<template>
  <Transition name="central-hint">
    <div
      v-if="hint.current && hint.isVisible"
      :class="hintClass"
      :key="hint.current.id"
    >
      <div class="hint__content" :class="{ 'hint__content--glass': hint.current.glass }">
        <div class="hint__title">{{ hint.current.title }}</div>
        <div v-if="hint.current.subtitle" class="hint__subtitle">
          {{ hint.current.subtitle }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.hint {
  position: fixed;
  top: 28%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  pointer-events: none;
  text-align: center;
}

.hint__content {
  padding: 20px 40px;
  border-radius: var(--radius-xl);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hint__content--glass {
  background: rgba(20, 20, 30, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.hint__title {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  line-height: 1.2;
  letter-spacing: 0.5px;
}

.hint__subtitle {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.hint--volume-hint .hint__title {
  font-size: 48px;
  font-weight: 800;
}

.hint--song-hint .hint__title {
  font-size: 36px;
  background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hint--preset-hint .hint__title {
  font-size: 28px;
}

.hint--mode-hint .hint__title {
  font-size: 28px;
}

.central-hint-enter-active {
  animation: hintIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.central-hint-leave-active {
  animation: hintOut 0.3s ease forwards;
}

@keyframes hintIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes hintOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(0.95);
  }
}

@media (max-width: 768px) {
  .hint {
    top: 25%;
  }

  .hint__content {
    padding: 16px 28px;
  }

  .hint__title {
    font-size: 24px !important;
  }

  .hint__subtitle {
    font-size: 14px;
  }

  .hint--volume-hint .hint__title {
    font-size: 36px !important;
  }
}
</style>
