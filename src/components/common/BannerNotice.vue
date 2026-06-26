<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  id?: string
  visible?: boolean
  title?: string
  message?: string
  linkText?: string
  linkUrl?: string
  icon?: string
  type?: 'info' | 'success' | 'warning' | 'trial'
  dismissible?: boolean
  storageKey?: string
}>(), {
  id: 'default-banner',
  visible: true,
  title: '',
  message: '',
  linkText: '',
  linkUrl: '',
  icon: '📢',
  type: 'info',
  dismissible: true,
  storageKey: ''
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'click-link'): void
}>()

const isVisible = ref(false)

const storageKey = computed(() => {
  return props.storageKey || `mineradio_banner_${props.id}_dismissed`
})

function isDismissed(): boolean {
  try {
    return localStorage.getItem(storageKey.value) === 'true'
  } catch {
    return false
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(storageKey.value, 'true')
  } catch {
    // ignore
  }
  isVisible.value = false
  emit('close')
}

function handleLinkClick(): void {
  emit('click-link')
  if (props.linkUrl) {
    window.open(props.linkUrl, '_blank')
  }
}

function resetDismiss(): void {
  try {
    localStorage.removeItem(storageKey.value)
  } catch {
    // ignore
  }
  isVisible.value = props.visible
}

onMounted(() => {
  if (props.visible && !isDismissed()) {
    isVisible.value = true
  }
})

defineExpose({
  show: () => { isVisible.value = true },
  hide: () => { isVisible.value = false },
  resetDismiss
})
</script>

<template>
  <Transition name="banner-slide">
    <div v-if="isVisible" class="banner-notice trial-banner" :class="`banner--${type}`">
      <div class="banner-content">
        <span class="banner-icon">{{ icon }}</span>
        
        <div class="banner-text">
          <span v-if="title" class="banner-title">{{ title }}</span>
          <span v-if="message" class="banner-message">{{ message }}</span>
        </div>

        <a
          v-if="linkText"
          class="banner-link"
          @click.prevent="handleLinkClick"
        >
          {{ linkText }}
          <span class="link-arrow">→</span>
        </a>
      </div>

      <button
        v-if="dismissible"
        class="banner-close"
        @click="dismiss"
        title="关闭"
      >
        ✕
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.banner-notice {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.banner--info {
  background: linear-gradient(90deg, rgba(100, 150, 255, 0.15), rgba(100, 200, 255, 0.1));
  border-color: rgba(100, 180, 255, 0.2);
}

.banner--success {
  background: linear-gradient(90deg, rgba(100, 255, 150, 0.15), rgba(100, 255, 200, 0.1));
  border-color: rgba(100, 255, 150, 0.2);
}

.banner--warning {
  background: linear-gradient(90deg, rgba(255, 180, 100, 0.15), rgba(255, 200, 100, 0.1));
  border-color: rgba(255, 180, 100, 0.2);
}

.banner--trial {
  background: linear-gradient(90deg, 
    rgba(217, 91, 103, 0.2), 
    rgba(244, 210, 138, 0.15),
    rgba(217, 91, 103, 0.2)
  );
  border-color: rgba(244, 210, 138, 0.3);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 1200px;
  width: 100%;
}

.banner-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.banner-text {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
}

.banner-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.banner-message {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.banner-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.banner-link:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.link-arrow {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.banner-link:hover .link-arrow {
  transform: translateX(2px);
}

.banner-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.banner-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

@media (max-width: 640px) {
  .banner-notice {
    padding: 10px 16px;
  }

  .banner-text {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .banner-link {
    margin-top: 4px;
  }
}
</style>
