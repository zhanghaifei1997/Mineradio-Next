<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'
import { usePlayerStore } from '@/stores/player'
import { useImmersiveStore } from '@/stores/immersive'

const props = withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: false,
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'complete'): void
  (e: 'peek-search'): void
  (e: 'peek-fx'): void
  (e: 'peek-playlist'): void
  (e: 'reveal-bottom'): void
}>()

const userStore = useUserStore()
const playerStore = usePlayerStore()
const immersiveStore = useImmersiveStore()

const STORAGE_KEY = 'mineradio-visual-guide-seen-v2'

const currentStep = ref(0)
const isOpen = ref(false)
const ringStyle = ref<Record<string, string>>({})
const cardStyle = ref<Record<string, string>>({})
const scrimGx = ref('50%')
const scrimGy = ref('50%')
const ringClass = ref('')
const guideRef = ref<HTMLElement | null>(null)

interface GuideStep {
  target?: string // CSS selector or 'stage' or 'shelf'
  kicker: string
  title: string
  body: string
  borderRadius?: string
  pad?: number
  peekSearch?: boolean
  peekFx?: boolean
  peekPlaylist?: boolean
  revealBottom?: boolean
}

// Default mode steps (matching old project visualGuideSteps)
const defaultSteps: GuideStep[] = [
  {
    target: 'stage',
    kicker: '01 / Welcome',
    title: 'Mineradio 是用来听歌的视觉播放器',
    body: '它不是单纯歌单页：搜索或导入一首歌后，封面、歌词、粒子和镜头会跟着音乐一起动。',
    pad: 8,
  },
  {
    target: '.top-toolbar__left .search-trigger, .search-trigger, [data-guide-target="search"]',
    kicker: '02 / Play',
    title: '从搜索或导入开始',
    body: '输入歌名、歌手或关键词即可播放；如果有本地音乐，也可以用导入入口直接放进舞台。',
    peekSearch: true,
  },
  {
    target: '.player-bar, #player-bar',
    kicker: '03 / Control',
    title: '播放以后看底部控制台',
    body: '播放、切歌、进度、队列和歌词都集中在底部，先把它当作一个正常播放器使用就可以。',
    revealBottom: true,
    borderRadius: '20px',
    pad: 10,
  },
  {
    target: '.user-capsule-wrapper, .user-capsule',
    kicker: '04 / Account',
    title: '登录只是为了同步你的音乐库',
    body: '登录后会同步歌单、红心和播客；不登录也可以搜索和播放，不会强制卡住你。',
  },
  {
    target: 'shelf',
    kicker: '05 / Visual',
    title: '进阶视觉都放在舞台周围',
    body: '右侧 3D 歌单架和 DIY 玩家模式是进阶入口；先播放一首歌，再慢慢调视觉效果。',
    borderRadius: '28px',
  },
  {
    target: '.icon-btn.help-btn',
    kicker: '06 / Guide',
    title: '高级功能可以随时重新查看',
    body: 'DIY 玩家模式、视觉控制台、上传/封面、自定义歌词等高级功能都可以从引导再次了解。',
  },
]

const steps = computed(() => defaultSteps)
const totalSteps = computed(() => steps.value.length)
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1)
const currentStepData = computed(() => steps.value[currentStep.value])

// Hint text
const hintText = computed(() =>
  isLastStep.value ? '点击空白处完成引导' : '点击空白处也可以继续'
)

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
  document.body.classList.add('visual-guide-active')
  nextTick(() => positionStep())
}

function closeGuide(markSeen = true): void {
  isOpen.value = false
  document.body.classList.remove('visual-guide-active')
  if (markSeen) markCompleted()
  emit('close')
}

function nextStep(): void {
  if (isLastStep.value) {
    markCompleted()
    closeGuide(false)
    emit('complete')
  } else {
    currentStep.value++
  }
}

function skip(): void {
  markCompleted()
  closeGuide(false)
}

function restart(): void {
  currentStep.value = 0
  open()
}

// --- Target rect calculation (matching old project guideTargetRect) ---
function getTargetRect(step: GuideStep): DOMRect | { left: number; top: number; width: number; height: number; right: number; bottom: number } {
  if (step.target === 'stage') {
    const stageW = Math.min(620, Math.max(260, window.innerWidth - 72))
    const stageH = Math.min(310, Math.max(178, window.innerHeight * 0.34))
    const stageLeft = window.innerWidth * 0.5 - stageW * 0.5
    const stageTop = Math.max(116, window.innerHeight * 0.32 - stageH * 0.5)
    return { left: stageLeft, top: stageTop, width: stageW, height: stageH, right: stageLeft + stageW, bottom: stageTop + stageH }
  }

  if (step.target === 'shelf') {
    // Approximate shelf area on right side
    const shelfLeft = window.innerWidth - 200
    const shelfTop = window.innerHeight * 0.15
    const shelfWidth = 170
    const shelfHeight = window.innerHeight * 0.55
    return { left: shelfLeft, top: shelfTop - 26, width: shelfWidth + 18, height: shelfHeight + 52, right: shelfLeft + shelfWidth + 18, bottom: shelfTop + shelfHeight + 26 }
  }

  // Try to find the target element
  const selectors = step.target?.split(',').map(s => s.trim()) || []
  let targetEl: Element | null = null
  for (const sel of selectors) {
    try {
      targetEl = document.querySelector(sel)
      if (targetEl) break
    } catch { /* ignore invalid selector */ }
  }

  if (targetEl) {
    const style = window.getComputedStyle(targetEl)
    const rect = targetEl.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden') {
      return rect
    }
  }

  // Fallback: center of viewport
  return {
    left: window.innerWidth * 0.5 - 120,
    top: window.innerHeight * 0.5 - 40,
    width: 240,
    height: 80,
    right: window.innerWidth * 0.5 + 120,
    bottom: window.innerHeight * 0.5 + 40
  }
}

// --- Positioning (matching old project positionVisualGuideStep) ---
function positionStep() {
  if (!isOpen.value) return

  const step = currentStepData.value
  const rect = getTargetRect(step)

  // Determine padding and border-radius
  const pad = step.target === 'shelf' ? 14 : (step.revealBottom ? 10 : (step.pad || 8))
  const borderRadius = step.borderRadius ||
    (step.target === 'shelf' ? '28px' :
      step.revealBottom ? '20px' : '16px')

  // Calculate ring position
  const left = Math.max(12, rect.left - pad)
  const top = Math.max(12, rect.top - pad)
  const width = Math.min(window.innerWidth - left - 12, rect.width + pad * 2)
  const height = Math.min(window.innerHeight - top - 12, rect.height + pad * 2)

  ringStyle.value = {
    left: left + 'px',
    top: top + 'px',
    width: Math.max(44, width) + 'px',
    height: Math.max(38, height) + 'px',
    borderRadius,
  }

  // Ring class for shelf target
  ringClass.value = step.target === 'shelf' ? 'shelf-target' : ''

  // Scrim custom properties
  scrimGx.value = ((rect.left + rect.width / 2) / Math.max(1, window.innerWidth) * 100).toFixed(2) + '%'
  scrimGy.value = ((rect.top + rect.height / 2) / Math.max(1, window.innerHeight) * 100).toFixed(2) + '%'

  // Card position
  const cardW = Math.min(326, window.innerWidth - 32)
  const cardEl = guideRef.value?.querySelector('.visual-guide-card')
  const cardH = cardEl ? cardEl.offsetHeight : 170

  let cardLeft = rect.left + rect.width / 2 - cardW / 2
  cardLeft = Math.max(16, Math.min(window.innerWidth - cardW - 16, cardLeft))

  const below = rect.bottom + 18
  const above = rect.top - cardH - 18
  const cardTop = below + cardH < window.innerHeight - 16 ? below : Math.max(16, above)

  cardStyle.value = {
    left: cardLeft + 'px',
    top: cardTop + 'px',
    width: cardW + 'px',
  }
}

// --- Prepare step (peek/reveal panels) ---
function prepareStep(step: GuideStep) {
  if (step.peekSearch) emit('peek-search')
  if (step.peekFx) emit('peek-fx')
  if (step.peekPlaylist) emit('peek-playlist')
  if (step.revealBottom) emit('reveal-bottom')
}

// --- Handle scrim click (advance to next step) ---
function handleScrimClick(e: MouseEvent) {
  if (e.target instanceof HTMLElement && e.target.closest('button')) return
  e.preventDefault()
  nextStep()
}

// --- Watch step changes ---
watch(currentStep, () => {
  const step = currentStepData.value
  prepareStep(step)
  nextTick(() => {
    positionStep()
    // Schedule extra position updates (matching old project scheduleVisualGuidePositioning)
    requestAnimationFrame(positionStep)
    setTimeout(positionStep, 180)
    setTimeout(positionStep, 620)
  })
})

// --- Watch visibility ---
watch(() => props.visible, (val) => {
  if (val) {
    open()
  } else {
    isOpen.value = false
    document.body.classList.remove('visual-guide-active')
  }
})

// --- Resize/scroll handlers ---
function onResize() {
  if (isOpen.value) positionStep()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onResize, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onResize, true)
  document.body.classList.remove('visual-guide-active')
})

defineExpose({ open, close: closeGuide, restart, hasCompletedGuide })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="guideRef"
      class="visual-guide"
      @click="handleScrimClick"
    >
      <div
        class="visual-guide-scrim"
        :style="{ '--gx': scrimGx, '--gy': scrimGy }"
      ></div>

      <div
        class="visual-guide-ring"
        :class="ringClass"
        :style="ringStyle"
      ></div>

      <div
        class="visual-guide-card"
        :style="cardStyle"
      >
        <div class="visual-guide-kicker">{{ currentStepData.kicker }}</div>
        <div class="visual-guide-title">{{ currentStepData.title }}</div>
        <div class="visual-guide-body">{{ currentStepData.body }}</div>
        <div class="visual-guide-hint">{{ hintText }}</div>
        <div class="visual-guide-actions">
          <button type="button" @click="skip">跳过</button>
          <div class="visual-guide-progress">{{ currentStep + 1 }} / {{ totalSteps }}</div>
          <button type="button" class="primary" @click="nextStep">{{ isLastStep ? '完成' : '下一步' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* --- Guide overlay (matching old project) --- */
.visual-guide {
  position: fixed;
  inset: 0;
  z-index: 620;
  pointer-events: auto;
  cursor: pointer;
}

.visual-guide-scrim {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(120deg, rgba(244,210,138,.05), rgba(255,83,103,.035) 34%, rgba(9,10,14,.38) 58%, rgba(0,0,0,.66)),
    radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255,255,255,.045), rgba(0,0,0,.36) 34%, rgba(0,0,0,.68));
}

/* --- Highlight ring (matching old project) --- */
.visual-guide-ring {
  position: absolute;
  left: 0;
  top: 0;
  width: 80px;
  height: 48px;
  border-radius: 16px;
  border: 1.5px solid rgba(255,255,255,.74);
  box-shadow:
    0 0 0 7px rgba(255,83,103,.13),
    0 0 42px rgba(255,83,103,.24),
    inset 0 0 20px rgba(255,255,255,.08);
  pointer-events: none;
  overflow: hidden;
  transition:
    left .38s cubic-bezier(.16,1,.3,1),
    top .38s cubic-bezier(.16,1,.3,1),
    width .38s cubic-bezier(.16,1,.3,1),
    height .38s cubic-bezier(.16,1,.3,1),
    border-radius .38s cubic-bezier(.16,1,.3,1),
    opacity .24s,
    transform .38s cubic-bezier(.16,1,.3,1),
    background .38s;
}

.visual-guide-ring::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(244,210,138,.34);
  border-radius: inherit;
  opacity: .62;
}

.visual-guide-ring::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.86), transparent);
  animation: visual-guide-scan 1.8s cubic-bezier(.16,1,.3,1) infinite;
}

.visual-guide-ring.shelf-target {
  border-color: rgba(255,255,255,.16);
  box-shadow: inset -34px 0 56px rgba(255,255,255,.045), 0 0 54px rgba(255,255,255,.06);
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.035));
}

/* --- Card (matching old project) --- */
.visual-guide-card {
  position: absolute;
  width: min(326px, calc(100vw - 32px));
  padding: 17px 18px 15px;
  border-radius: 14px;
  border: 1px solid rgba(244,210,138,.18);
  background: linear-gradient(145deg, rgba(28,27,32,.94), rgba(9,10,14,.95));
  box-shadow:
    0 28px 86px rgba(0,0,0,.62),
    0 0 0 1px rgba(255,83,103,.10),
    inset 0 1px 0 rgba(255,255,255,.10);
  backdrop-filter: blur(28px) saturate(1.16);
  -webkit-backdrop-filter: blur(28px) saturate(1.16);
  pointer-events: auto;
  cursor: default;
  overflow: hidden;
  transition:
    left .38s cubic-bezier(.16,1,.3,1),
    top .38s cubic-bezier(.16,1,.3,1),
    opacity .26s,
    transform .38s cubic-bezier(.16,1,.3,1),
    filter .38s;
}

.visual-guide-card::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, rgba(255,83,103,.70), rgba(244,210,138,.56), transparent);
}

.visual-guide-kicker {
  font-size: 10px;
  font-weight: 760;
  letter-spacing: .16em;
  color: rgba(255,83,103,.78);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.visual-guide-title {
  font-size: 16px;
  font-weight: 760;
  color: rgba(255,255,255,.96);
  letter-spacing: .2px;
  margin-bottom: 7px;
}

.visual-guide-body {
  font-size: 12.5px;
  line-height: 1.62;
  color: rgba(255,255,255,.64);
  letter-spacing: .1px;
}

.visual-guide-hint {
  margin-top: 11px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,.075);
  background: rgba(255,255,255,.038);
  font-size: 11px;
  color: rgba(244,210,138,.72);
}

.visual-guide-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 14px;
}

.visual-guide-progress {
  font-size: 10.5px;
  color: rgba(255,255,255,.38);
  font-variant-numeric: tabular-nums;
}

.visual-guide-actions button {
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.045);
  color: rgba(255,255,255,.70);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  padding: 0 12px;
  transition: background .18s, border-color .18s, color .18s, transform .18s;
}

.visual-guide-actions button:hover {
  background: rgba(255,255,255,.085);
  border-color: rgba(255,255,255,.20);
  color: #fff;
  transform: translateY(-1px);
}

.visual-guide-actions .primary {
  border-color: rgba(255,83,103,.42);
  background: rgba(255,83,103,.14);
  color: #fff;
}

.visual-guide-actions .primary:hover {
  border-color: rgba(255,83,103,.62);
  background: rgba(255,83,103,.20);
}

@keyframes visual-guide-scan {
  0%, 100% { transform: translateY(0); opacity: .26; }
  42% { opacity: .72; }
  70% { transform: translateY(82px); opacity: .18; }
}
</style>
