<template>
  <div id="stage-lyrics" :class="{ active: isActive }">
    <!-- 当前歌词行 -->
    <div
      v-for="line in visibleLines"
      :key="line.key"
      class="stage-lyric-line"
      :class="line.state"
      :style="line.style"
    >{{ line.text }}</div>

    <!-- 翻译行 -->
    <div
      v-if="currentTranslation"
      class="stage-lyric-translation"
      :class="{ visible: !!currentText }"
      :style="{ bottom: translationY + 'px' }"
    >{{ currentTranslation }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { useLyrics } from '@/composables/useLyrics'
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
const playerCtrl = inject('player') as ReturnType<typeof import('@/composables/usePlayer').usePlayer> | undefined

const isActive = ref(false)
const prevLineIdx = ref(-1)
let animFrameId = 0

// 歌词位置参数
const lyricY = ref(0.35) // 垂直位置 (0=底部, 1=顶部)
const lyricScale = ref(1.0) // 缩放

// 使用 useLyrics composable
const lyrics = useLyrics(() => player.currentTime)

const currentText = lyrics.currentText
const currentTranslation = lyrics.currentTranslation

// 可见的歌词行动画队列
interface VisibleLine {
  key: number
  text: string
  state: 'in' | 'active' | 'out'
  style: Record<string, string>
}

const visibleLines = ref<VisibleLine[]>([])

function randomEntrance() {
  return {
    inx: (Math.random() - 0.5) * 120,
    iny: 20 + Math.random() * 40,
    inrx: (Math.random() - 0.5) * 56,
    inry: (Math.random() - 0.5) * 44,
  }
}

function randomExit() {
  return {
    outx: (Math.random() - 0.5) * 120,
    outy: -(20 + Math.random() * 40),
    outrx: (Math.random() - 0.5) * 44,
    outry: (Math.random() - 0.5) * 36,
  }
}

function randomBob() {
  return {
    bx: (Math.random() - 0.5) * 16,
  }
}

function getLineY(): string {
  // 基于视口高度的歌词垂直位置
  const vh = window.innerHeight
  return `${vh * lyricY.value}px`
}

const translationY = computed(() => {
  const vh = window.innerHeight
  return vh * lyricY.value - 80 // 翻译在歌词上方
})

// 监听歌词行变化
watch(lyrics.currentLineIdx, (newIdx, oldIdx) => {
  if (newIdx < 0) {
    // 无歌词
    visibleLines.value = []
    return
  }

  const line = lyrics.lines.value[newIdx]
  if (!line) return

  const ent = randomEntrance()
  const ext = randomExit()
  const bob = randomBob()
  const y = getLineY()

  // 移除旧行并标记为 out
  const newLines: VisibleLine[] = []

  // 上一行标记为退出
  for (const vl of visibleLines.value) {
    if (vl.state !== 'out') {
      newLines.push({ ...vl, state: 'out' })
    }
  }

  // 添加新行
  newLines.push({
    key: newIdx,
    text: line.text,
    state: 'in',
    style: {
      top: y,
      left: '50%',
      transform: `translateX(-50%)`,
      '--inx': `${ent.inx}px`,
      '--iny': `${ent.iny}px`,
      '--inrx': `${ent.inrx}deg`,
      '--inry': `${ent.inry}deg`,
      '--outx': `${ext.outx}px`,
      '--outy': `${ext.outy}px`,
      '--outrx': `${ext.outrx}deg`,
      '--outry': `${ext.outry}deg`,
      '--bx': `${bob.bx}px`,
    },
  })

  visibleLines.value = newLines

  // 2秒后移除已退出的行
  setTimeout(() => {
    visibleLines.value = visibleLines.value.filter(vl => vl.state !== 'out' || vl.key === newIdx)
  }, 2000)
})

// 监听歌曲变化加载歌词
watch(() => player.currentSong, async (song) => {
  if (song) {
    isActive.value = true
    await lyrics.loadLyrics(song.id, song.source)
  } else {
    isActive.value = false
    lyrics.clearLyrics()
    visibleLines.value = []
  }
})

// 动画循环更新歌词同步
function tick() {
  lyrics.updateCurrentLine()
  animFrameId = requestAnimationFrame(tick)
}

onMounted(() => {
  tick()
})

onUnmounted(() => {
  cancelAnimationFrame(animFrameId)
})
</script>
