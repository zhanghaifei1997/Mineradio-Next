<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'skip'): void
}>()

const currentStep = ref(0)

const steps = [
  {
    id: 0,
    title: '欢迎使用 Mineradio',
    description: '沉浸式音乐播放器，为您带来极致的音乐体验',
    icon: '🎵',
    gradient: 'from-pink-500 to-purple-500',
  },
  {
    id: 1,
    title: '3D 视觉效果',
    description: '多种炫酷视觉预设，随音乐节奏律动，打造沉浸式视听体验',
    icon: '✨',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 2,
    title: '丰富的音乐源',
    description: '支持网易云、QQ音乐、酷狗等多个音乐平台，一站式听遍全网',
    icon: '🎧',
    gradient: 'from-green-500 to-teal-500',
  },
  {
    id: 3,
    title: 'DJ 模式',
    description: '专业 DJ 打碟体验，双盘混音、节拍同步，释放你的音乐激情',
    icon: '🎛️',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 4,
    title: '准备好了吗？',
    description: '现在就让我们开始探索音乐的无限可能吧！',
    icon: '🚀',
    gradient: 'from-purple-500 to-pink-500',
  },
]

const totalSteps = computed(() => steps.length)
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const isFirstStep = computed(() => currentStep.value === 0)

function next() {
  if (isLastStep.value) {
    emit('complete')
  } else {
    currentStep.value++
  }
}

function prev() {
  if (!isFirstStep.value) {
    currentStep.value--
  }
}

function skip() {
  emit('skip')
}
</script>

<template>
  <div class="onboarding-overlay">
    <div class="onboarding-container">
      <div class="onboarding-card">
        <button class="skip-btn" @click="skip" v-if="!isLastStep">
          跳过
        </button>

        <Transition name="slide-fade" mode="out-in">
          <div :key="currentStep" class="step-content">
            <div class="step-icon" :class="steps[currentStep].gradient">
              {{ steps[currentStep].icon }}
            </div>
            <h2 class="step-title">{{ steps[currentStep].title }}</h2>
            <p class="step-desc">{{ steps[currentStep].description }}</p>
          </div>
        </Transition>

        <div class="progress-dots">
          <span
            v-for="step in steps"
            :key="step.id"
            class="dot"
            :class="{ active: step.id <= currentStep }"
            @click="currentStep = step.id"
          ></span>
        </div>

        <div class="onboarding-actions">
          <button
            v-if="!isFirstStep"
            class="nav-btn nav-btn--secondary"
            @click="prev"
          >
            上一步
          </button>
          <button
            class="nav-btn nav-btn--primary"
            @click="next"
          >
            {{ isLastStep ? '开始使用' : '下一步' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.onboarding-container {
  width: 100%;
  max-width: 480px;
  padding: 20px;
}

.onboarding-card {
  position: relative;
  background: rgba(20, 20, 25, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  padding: 48px 40px 32px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
}

.skip-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 14px;
  border: none;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}

.skip-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.9);
}

.step-content {
  text-align: center;
}

.step-icon {
  width: 96px;
  height: 96px;
  margin: 0 auto 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  border-radius: 28px;
  background: linear-gradient(135deg, #d95b67, #643296);
  box-shadow: 0 10px 40px rgba(217, 91, 103, 0.3);
}

.step-icon.from-pink-500 { background: linear-gradient(135deg, #ec4899, #a855f7); }
.step-icon.from-blue-500 { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.step-icon.from-green-500 { background: linear-gradient(135deg, #22c55e, #14b8a6); }
.step-icon.from-orange-500 { background: linear-gradient(135deg, #f97316, #ef4444); }
.step-icon.from-purple-500 { background: linear-gradient(135deg, #a855f7, #ec4899); }

.step-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px 0;
}

.step-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
  margin: 0;
  min-height: 48px;
}

.progress-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 32px 0;
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
  width: 24px;
  border-radius: 4px;
}

.dot:hover {
  background: rgba(255, 255, 255, 0.4);
}

.dot.active:hover {
  background: #d95b67;
}

.onboarding-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.nav-btn {
  padding: 12px 32px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.nav-btn--primary {
  background: linear-gradient(135deg, #d95b67, #b84550);
  color: #fff;
  box-shadow: 0 4px 20px rgba(217, 91, 103, 0.3);
}

.nav-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(217, 91, 103, 0.4);
}

.nav-btn--primary:active {
  transform: translateY(0);
}

.nav-btn--secondary {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.nav-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
