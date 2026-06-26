<script setup lang="ts">
import { ref, watch, onUnmounted, computed } from 'vue'
import { useImmersiveStore } from '@/stores/immersive'
import { useFxStore } from '@/stores/fx'

const props = withDefaults(defineProps<{
  visible?: boolean
  message?: string
  duration?: number
}>(), {
  visible: false,
  message: '',
  duration: 2000,
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const immersive = useImmersiveStore()
const fx = useFxStore()

const isShowing = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

const toastTop = computed(() => {
  if (immersive.isImmersive) return '60px'
  return '84px'
})

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

watch(
  () => props.visible,
  (val) => {
    if (val) {
      show()
    } else {
      hide()
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
  }
})

defineExpose({ show, hide })
</script>

<template>
  <Transition name="toast">
    <div
      v-if="isShowing"
      id="toast"
      :class="{ show: isShowing }"
      :style="{ top: toastTop }"
      @click="hide"
    >
      <span class="toast__message">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
#toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  z-index: 300;
  padding: 10px 20px;
  background: rgba(20, 20, 28, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  backdrop-filter: var(--blur-toast);
  -webkit-backdrop-filter: var(--blur-toast);
  color: #ffffff;
  font-size: 12.5px;
  letter-spacing: 0.5px;
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

#toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

#toast:hover {
  background: rgba(30, 30, 40, 0.95);
}

.toast__message {
  display: block;
  line-height: 1.4;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
