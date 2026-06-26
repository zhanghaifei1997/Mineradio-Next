<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  visible?: boolean
  position?: 'top' | 'bottom' | 'left' | 'right'
  storageKey?: string
}>(), {
  visible: false,
  position: 'bottom',
  storageKey: 'mineradio_upload_tip_shown'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isVisible = ref(false)

function hasBeenDismissed(): boolean {
  try {
    return localStorage.getItem(props.storageKey) === 'true'
  } catch {
    return false
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(props.storageKey, 'true')
  } catch {
    // ignore
  }
  isVisible.value = false
  emit('close')
}

function resetDismiss(): void {
  try {
    localStorage.removeItem(props.storageKey)
  } catch {
    // ignore
  }
}

watch(() => props.visible, (val) => {
  if (val && !hasBeenDismissed()) {
    isVisible.value = true
  } else {
    isVisible.value = false
  }
}, { immediate: true })

onMounted(() => {
  if (props.visible && !hasBeenDismissed()) {
    isVisible.value = true
  }
})

defineExpose({
  resetDismiss,
  show: () => { isVisible.value = true },
  hide: () => { isVisible.value = false }
})
</script>

<template>
  <Transition name="tip-pop">
    <div v-if="isVisible" class="upload-tip" :class="`tip--${position}`">
      <div class="tip-arrow"></div>
      <div class="tip-content">
        <div class="tip-header">
          <span class="tip-icon">💡</span>
          <span class="tip-title">上传提示</span>
          <button class="tip-close" @click="dismiss" title="关闭">
            ✕
          </button>
        </div>
        <div class="tip-body">
          <ul class="tip-list">
            <li>支持格式：JPG, PNG, WebP, GIF</li>
            <li>建议尺寸：512x512 或更大</li>
            <li>文件大小：不超过 10MB</li>
            <li>支持拖拽上传</li>
          </ul>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.upload-tip {
  position: absolute;
  z-index: 100;
  width: 240px;
}

.tip--bottom {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 10px;
}

.tip--top {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 10px;
}

.tip--left {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-right: 10px;
}

.tip--right {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 10px;
}

.tip-arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transform: rotate(45deg);
}

.tip--bottom .tip-arrow {
  top: -6px;
  left: 50%;
  margin-left: -6px;
  border-right: none;
  border-bottom: none;
}

.tip--top .tip-arrow {
  bottom: -6px;
  left: 50%;
  margin-left: -6px;
  border-left: none;
  border-top: none;
}

.tip--left .tip-arrow {
  right: -6px;
  top: 50%;
  margin-top: -6px;
  border-left: none;
  border-bottom: none;
}

.tip--right .tip-arrow {
  left: -6px;
  top: 50%;
  margin-top: -6px;
  border-right: none;
  border-top: none;
}

.tip-content {
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.tip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tip-icon {
  font-size: 16px;
}

.tip-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.tip-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.tip-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.tip-body {
  padding: 12px 14px;
}

.tip-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tip-list li {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
  padding-left: 16px;
  position: relative;
}

.tip-list li::before {
  content: '•';
  position: absolute;
  left: 4px;
  color: #d95b67;
}

.tip-pop-enter-active,
.tip-pop-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tip-pop-enter-from,
.tip-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.9);
}

.tip--left.tip-pop-enter-from,
.tip--left.tip-pop-leave-to,
.tip--right.tip-pop-enter-from,
.tip--right.tip-pop-leave-to {
  transform: translateY(-50%) scale(0.9);
}
</style>
