<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'complete'): void
}>()

const STORAGE_KEY = 'mineradio_visual_guide_completed'

const currentStep = ref(0)
const isOpen = ref(false)

interface GuideStep {
  id: number
  title: string
  description: string
  icon: string
  target?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const steps: GuideStep[] = [
  {
    id: 0,
    title: '欢迎使用 Mineradio',
    description: '沉浸式音乐播放器，为您带来极致的音乐视觉体验',
    icon: '🎵',
    position: 'center',
  },
  {
    id: 1,
    title: '搜索歌曲',
    description: '点击顶部搜索栏，搜索您喜欢的歌曲',
    icon: '🔍',
    target: '.top-toolbar',
    position: 'bottom',
  },
  {
    id: 2,
    title: '控制栏',
    description: '右键点击或移动到底部手柄，调出播放控制栏',
    icon: '🎮',
    position: 'center',
  },
  {
    id: 3,
    title: '视觉控制台',
    description: '点击右上角调色板按钮，调整视觉效果预设',
    icon: '🎨',
    target: '.top-toolbar__right',
    position: 'bottom',
  },
  {
    id: 4,
    title: '登录账号',
    description: '点击右上角用户胶囊，登录解锁更多功能',
    icon: '👤',
    target: '.user-capsule-wrapper',
    position: 'bottom',
  },
  {
    id: 5,
    title: '享受音乐！',
    description: '现在，开始您的沉浸式音乐之旅吧！',
    icon: '🎉',
    position: 'center',
  },
]

const totalSteps = computed(() => steps.length)
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const isFirstStep = computed(() => currentStep.value === 0)
const currentStepData = computed(() => steps[currentStep.value])

function hasCompletedGuide(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch {}
}

function open(): void {
  isOpen.value = true
  currentStep.value = 0
}

function close(): void {
  isOpen.value = false
  emit('close')
}

function next(): void {
  if (isLastStep.value) {
    markCompleted()
    close()
    emit('complete')
  } else {
    currentStep.value++
  }
}

function prev(): void {
  if (!isFirstStep.value) {
    currentStep.value--
  }
}

function skip(): void {
  markCompleted()
  close()
}

function restart(): void {
  currentStep.value = 0
  open()
}

watch(() => props.visible, (val) => {
  if (val) {
    open()
  } else {
    close()
  }
})

defineExpose({ open, close, restart, hasCompletedGuide })

onMounted(() => {
  if (!hasCompletedGuide()) {
    setTimeout(() => {
      open()
    }, 1500)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="guide-fade">
      <div v-if="isOpen" class="visual-guide">
        <div class="visual-guide__overlay" @click="skip"></div>

        <div
          class="visual-guide__content"
          :class="`visual-guide__content--${currentStepData.position}`"
        >
          <button class="visual-guide__skip" @click="skip" v-if="!isLastStep">
            跳过
          </button>

          <Transition name="slide-fade" mode="out-in">
            <div :key="currentStep" class="visual-guide__step">
              <div class="visual-guide__icon">{{ currentStepData.icon }}</div>
              <h3 class="visual-guide__title">{{ currentStepData.title }}</h3>
              <p class="visual-guide__desc">{{ currentStepData.description }}</p>
            </div>
          </Transition>

          <div class="visual-guide__progress">
            <span
              v-for="step in steps"
              :key="step.id"
              class="dot"
              :class="{ active: step.id <= currentStep }"
              @click="currentStep = step.id"
            ></span>
          </div>

          <div class="visual-guide__actions">
            <button
              v-if="!isFirstStep"
              class="nav-btn nav-btn--secondary"
              @click="prev"
            >
              上一步
            </button>
            <button class="nav-btn nav-btn--primary" @click="next">
              {{ isLastStep ? '完成' : '下一步' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.visual-guide {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}

.visual-guide__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
}

.visual-guide__content {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  max-width: 420px;
  padding: 20px;
  pointer-events: auto;
}

.visual-guide__content--top {
  top: 100px;
  transform: translateX(-50%);
}

.visual-guide__content--bottom {
  top: auto;
  bottom: 120px;
  transform: translateX(-50%);
}

.visual-guide__content--left {
  left: 40px;
  transform: translateY(-50%);
}

.visual-guide__content--right {
  left: auto;
  right: 40px;
  transform: translateY(-50%);
}

.visual-guide__step {
  position: relative;
  background: rgba(25, 25, 35, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 36px 28px 24px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.visual-guide__skip {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 10;
}

.visual-guide__skip:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.visual-guide__icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.visual-guide__title {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 10px 0;
}

.visual-guide__desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  margin: 0;
  min-height: 44px;
}

.visual-guide__progress {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin: 20px 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: all 0.2s;
}

.dot.active {
  background: #d95b67;
  width: 20px;
  border-radius: 4px;
}

.dot:hover {
  background: rgba(255, 255, 255, 0.4);
}

.dot.active:hover {
  background: #d95b67;
}

.visual-guide__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.nav-btn {
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.nav-btn--primary {
  background: linear-gradient(135deg, #d95b67, #b84550);
  color: #fff;
  box-shadow: 0 4px 16px rgba(217, 91, 103, 0.3);
}

.nav-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(217, 91, 103, 0.4);
}

.nav-btn--secondary {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: opacity 0.3s ease;
}

.guide-fade-enter-from,
.guide-fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@media (max-width: 768px) {
  .visual-guide__content {
    max-width: 340px;
    padding: 16px;
  }

  .visual-guide__step {
    padding: 28px 20px 20px;
  }

  .visual-guide__icon {
    font-size: 40px;
  }

  .visual-guide__title {
    font-size: 18px;
  }

  .visual-guide__desc {
    font-size: 13px;
  }
}
</style>
