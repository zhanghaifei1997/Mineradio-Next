<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  title?: string
  message?: string
  icon?: string
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  duration?: number
  keybinding?: string
}>(), {
  visible: false,
  title: '',
  message: '',
  icon: '⌨️',
  position: 'bottom-left',
  duration: 4000,
  keybinding: ''
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isShowing = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

function show() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  isShowing.value = true
  
  if (props.duration > 0) {
    hideTimer = setTimeout(() => {
      hide()
    }, props.duration)
  }
}

function hide() {
  isShowing.value = false
  emit('close')
}

watch(() => props.visible, (val) => {
  if (val) {
    show()
  } else {
    hide()
  }
}, { immediate: true })

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
})

defineExpose({ show, hide })
</script>

<template>
  <Transition name="hint-toast">
    <div 
      v-if="isShowing" 
      class="hint-toast"
      :class="`hint-toast--${position}`"
    >
      <div class="hint-toast__icon">{{ icon }}</div>
      <div class="hint-toast__content">
        <div v-if="title" class="hint-toast__title">{{ title }}</div>
        <div v-if="message" class="hint-toast__message">{{ message }}</div>
        <div v-if="keybinding" class="hint-toast__keybinding">
          <kbd>{{ keybinding }}</kbd>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.hint-toast {
  position: fixed;
  z-index: 200;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 18px;
  max-width: 320px;
  background: var(--color-surface);
  backdrop-filter: var(--glass-filter);
  -webkit-backdrop-filter: var(--glass-filter);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
}

.hint-toast--bottom-left {
  bottom: 100px;
  left: 24px;
}

.hint-toast--bottom-right {
  bottom: 100px;
  right: 24px;
}

.hint-toast--top-left {
  top: 80px;
  left: 24px;
}

.hint-toast--top-right {
  top: 80px;
  right: 24px;
}

.hint-toast__icon {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1.2;
}

.hint-toast__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hint-toast__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.hint-toast__message {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.hint-toast__keybinding {
  margin-top: 4px;
}

.hint-toast__keybinding kbd {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  background: var(--color-input-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.hint-toast-enter-active,
.hint-toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.hint-toast-enter-from,
.hint-toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.hint-toast--top-left.hint-toast-enter-from,
.hint-toast--top-left.hint-toast-leave-to,
.hint-toast--top-right.hint-toast-enter-from,
.hint-toast--top-right.hint-toast-leave-to {
  transform: translateY(-20px);
}

.hint-toast--bottom-right.hint-toast-enter-from,
.hint-toast--bottom-right.hint-toast-leave-to {
  transform: translateX(20px);
}

.hint-toast--bottom-left.hint-toast-enter-from,
.hint-toast--bottom-left.hint-toast-leave-to {
  transform: translateX(-20px);
}
</style>
