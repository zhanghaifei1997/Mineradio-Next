<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = withDefaults(defineProps<{
  autoEnter?: boolean
  autoEnterDelay?: number
  showDontShowAgain?: boolean
}>(), {
  autoEnter: false,
  autoEnterDelay: 6000,
  showDontShowAgain: false
})

const emit = defineEmits<{
  (e: 'enter'): void
}>()

const isReady = ref(false)
const isExiting = ref(false)
const dontShowAgain = ref(false)
const animationPhase = ref(0)

let readyTimer: ReturnType<typeof setTimeout> | null = null
let autoEnterTimer: ReturnType<typeof setTimeout> | null = null
let phaseTimer: ReturnType<typeof setTimeout> | null = null

function handleEnter() {
  if (!isReady.value || isExiting.value) return
  
  if (dontShowAgain.value) {
    try {
      localStorage.setItem('mineradio_splash_dont_show', 'true')
    } catch {
      // ignore
    }
  }
  
  isExiting.value = true
  setTimeout(() => {
    emit('enter')
  }, 1180)
}

function checkDontShow(): boolean {
  try {
    return localStorage.getItem('mineradio_splash_dont_show') === 'true'
  } catch {
    return false
  }
}

onMounted(() => {
  if (checkDontShow()) {
    emit('enter')
    return
  }
  
  phaseTimer = setTimeout(() => {
    animationPhase.value = 1
  }, 100)
  
  readyTimer = setTimeout(() => {
    isReady.value = true
    
    if (props.autoEnter) {
      autoEnterTimer = setTimeout(() => {
        handleEnter()
      }, props.autoEnterDelay)
    }
  }, 4000)
})

onUnmounted(() => {
  if (readyTimer) clearTimeout(readyTimer)
  if (autoEnterTimer) clearTimeout(autoEnterTimer)
  if (phaseTimer) clearTimeout(phaseTimer)
})
</script>

<template>
  <div 
    class="splash-screen"
    :class="{ 
      'splash--exiting': isExiting,
      'splash--ready': isReady,
      'splash--phase-1': animationPhase >= 1
    }"
    @click="handleEnter"
  >
    <div class="splash-bg">
      <div class="splash-bg__gradient"></div>
      <div class="splash-bg__grid"></div>
      <div class="splash-bg__scanline"></div>
      <div class="splash-bg__noise"></div>
      <div class="splash-bg__vignette-top"></div>
      <div class="splash-bg__vignette-bottom"></div>
      <div class="splash-bg__vignette-left"></div>
      <div class="splash-bg__vignette-right"></div>
    </div>

    <div class="splash-content">
      <div class="splash-title">
        <span class="splash-title__mine">
          <span class="char char-m">M</span>
          <span class="char char-i">
            i
            <span class="char-i__dot"></span>
          </span>
          <span class="char char-n">n</span>
          <span class="char char-e">e</span>
        </span>
        <span class="splash-title__radio">
          <span class="char char-r">R</span>
          <span class="char char-a">a</span>
          <span class="char char-d">d</span>
          <span class="char char-o">o</span>
        </span>
      </div>

      <div class="splash-signal">
        <div class="splash-signal__line">
          <div class="splash-signal__glow"></div>
        </div>
        <div class="splash-signal__dot"></div>
      </div>

      <div class="splash-subtitle">
        IMMERSIVE MUSIC PLAYER
      </div>

      <div class="splash-enter" v-if="isReady">
        <span class="splash-enter__text">Click to Enter</span>
        <span class="splash-enter__hint">点击进入</span>
      </div>

      <div class="splash-dont-show" v-if="showDontShowAgain && isReady" @click.stop>
        <label class="checkbox-label">
          <input type="checkbox" v-model="dontShowAgain" />
          <span>下次不再显示</span>
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 300;
  overflow: hidden;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.5s ease, transform 1.18s cubic-bezier(0.4, 0, 0.2, 1);
  background: #010304;
}

.splash--phase-1 {
  opacity: 1;
}

.splash--exiting {
  opacity: 0;
  transform: scale(1.05);
}

.splash-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  animation: splash-field-breathe 7s ease-in-out infinite alternate;
}

.splash-bg__gradient {
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse at 30% 20%, rgba(217, 91, 103, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(100, 200, 220, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(244, 210, 138, 0.08) 0%, transparent 60%),
    linear-gradient(180deg, #010304 0%, #0a0a10 50%, #010304 100%);
  animation: splashBreath 7s ease-in-out infinite;
}

@keyframes splashBreath {
  0%, 100% {
    opacity: 0.8;
    filter: brightness(0.9);
  }
  50% {
    opacity: 1;
    filter: brightness(1.15);
  }
}

.splash-bg__grid {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
}

.splash-bg__scanline {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
  opacity: 0.4;
  pointer-events: none;
}

.splash-bg__noise {
  position: absolute;
  inset: 0;
  opacity: 0.06;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  pointer-events: none;
}

.splash-bg__vignette-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(180deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-bg__vignette-bottom {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(0deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-bg__vignette-left {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 20%;
  background: linear-gradient(90deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-bg__vignette-right {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  width: 20%;
  background: linear-gradient(-90deg, #010304 0%, transparent 100%);
  pointer-events: none;
}

.splash-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
}

.splash-title {
  display: flex;
  align-items: baseline;
  font-size: clamp(48px, 12vw, 120px);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}

.splash-title__mine {
  display: flex;
  align-items: baseline;
  opacity: 0;
  transform: translateX(-80px);
  animation: slideInLeft 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
}

.splash-title__radio {
  display: flex;
  align-items: baseline;
  opacity: 0;
  transform: translateX(80px);
  animation: slideInRight 1.5s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards;
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-80px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(80px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.char {
  display: inline-block;
  background: linear-gradient(
    135deg,
    #f4d28a 0%,
    #64c8dc 35%,
    #ffffff 50%,
    #f4d28a 65%,
    #d95b67 100%
  );
  background-size: 200% 200%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 30px rgba(244, 210, 138, 0.3))
          drop-shadow(0 0 60px rgba(100, 200, 220, 0.2));
  animation: gradientShift 4s ease-in-out infinite;
}

@keyframes gradientShift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.char-i {
  position: relative;
}

.char-i__dot {
  position: absolute;
  top: -0.15em;
  left: 50%;
  transform: translateX(-50%) scale(0);
  width: 0.18em;
  height: 0.18em;
  border-radius: 50%;
  background: linear-gradient(135deg, #f4d28a, #d95b67);
  box-shadow: 
    0 0 20px rgba(244, 210, 138, 0.8),
    0 0 40px rgba(217, 91, 103, 0.5);
  animation: dotPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 2s forwards;
}

@keyframes dotPop {
  0% {
    transform: translateX(-50%) scale(0);
  }
  60% {
    transform: translateX(-50%) scale(1.3);
  }
  100% {
    transform: translateX(-50%) scale(1);
  }
}

.char-o {
  background: linear-gradient(135deg, #f4d28a 0%, #e8c06a 50%, #f4d28a 100%) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  filter: drop-shadow(0 0 25px rgba(244, 210, 138, 0.5)) !important;
  animation: goldGlow 3s ease-in-out infinite !important;
}

@keyframes goldGlow {
  0%, 100% {
    filter: drop-shadow(0 0 25px rgba(244, 210, 138, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 40px rgba(244, 210, 138, 0.8));
  }
}

.splash-signal {
  position: relative;
  width: 280px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  animation: fadeIn 1s ease 1.5s forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.splash-signal__line {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) scaleX(0);
  width: 100%;
  height: 2px;
  animation: signalExpand 1.5s cubic-bezier(0.16, 1, 0.3, 1) 1.5s forwards;
}

@keyframes signalExpand {
  from {
    transform: translate(-50%, -50%) scaleX(0);
  }
  to {
    transform: translate(-50%, -50%) scaleX(1);
  }
}

.splash-signal__glow {
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #64c8dc 20%,
    #ffffff 45%,
    #f4d28a 55%,
    #d95b67 80%,
    transparent 100%
  );
  box-shadow: 
    0 0 10px rgba(100, 200, 220, 0.5),
    0 0 20px rgba(244, 210, 138, 0.3),
    0 0 30px rgba(217, 91, 103, 0.3);
  border-radius: 2px;
}

.splash-signal__dot {
  position: relative;
  z-index: 1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 
    0 0 10px #ffffff,
    0 0 20px rgba(244, 210, 138, 0.8),
    0 0 30px rgba(244, 210, 138, 0.5);
  opacity: 0;
  animation: dotFadeIn 0.5s ease 2.8s forwards, dotPulse 2s ease-in-out 3.3s infinite;
}

@keyframes dotFadeIn {
  from {
    opacity: 0;
    transform: scale(0);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes dotPulse {
  0%, 100% {
    box-shadow: 
      0 0 10px #ffffff,
      0 0 20px rgba(244, 210, 138, 0.8),
      0 0 30px rgba(244, 210, 138, 0.5);
  }
  50% {
    box-shadow: 
      0 0 15px #ffffff,
      0 0 30px rgba(244, 210, 138, 1),
      0 0 50px rgba(244, 210, 138, 0.7);
  }
}

.splash-subtitle {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.4em;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  opacity: 0;
  transform: translateY(10px);
  animation: subtitleFadeIn 1.5s ease 2s forwards;
}

@keyframes subtitleFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.splash-enter {
  position: absolute;
  bottom: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  opacity: 0;
  animation: enterFadeIn 1s ease 0.2s forwards, enterBreathe 2.5s ease-in-out 1.2s infinite;
}

@keyframes enterFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes enterBreathe {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

.splash-enter__text {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.2em;
  color: rgba(255, 255, 255, 0.9);
  text-transform: uppercase;
}

.splash-enter__hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.15em;
}

.splash-dont-show {
  position: absolute;
  bottom: 32px;
  opacity: 0;
  animation: enterFadeIn 1s ease 0.5s forwards;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #f4d28a;
}
</style>
