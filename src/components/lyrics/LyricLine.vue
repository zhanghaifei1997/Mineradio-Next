<template>
  <div
    class="lyric-line"
    :class="{ in: show, highlight: highlightFollow }"
    :style="lineStyle"
  >
    <span class="lyric-text" :data-text="text">{{ text }}</span>
    <span v-if="translation" class="lyric-translation">{{ translation }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
  text: string
  translation?: string
  progress?: number
  show?: boolean
  highlightFollow?: boolean
  primaryColor?: string
  highlightColor?: string
  glowColor?: string
  feather?: number
  fontSize?: number
  fontWeight?: number
  fontFamily?: string
  letterSpacing?: number
  lineHeight?: number
  beatGlow?: number
  strokeEnabled?: boolean
  strokeColor?: string
  strokeWidth?: number
  shadowEnabled?: boolean
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
}

const props = withDefaults(defineProps<Props>(), {
  text: '',
  translation: '',
  progress: 0,
  show: true,
  highlightFollow: false,
  primaryColor: '#f6fdff',
  highlightColor: '#fff0b8',
  glowColor: '#9cffdf',
  feather: 0.055,
  fontSize: 58,
  fontWeight: 900,
  fontFamily: 'Inter, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Arial, sans-serif',
  letterSpacing: 0,
  lineHeight: 1,
  beatGlow: 0,
  strokeEnabled: false,
  strokeColor: 'rgba(4, 6, 12, 0.8)',
  strokeWidth: 2,
  shadowEnabled: true,
  shadowColor: 'rgba(4, 6, 12, 0.5)',
  shadowBlur: 8,
  shadowOffsetX: 0,
  shadowOffsetY: 2,
})

const lineRef = ref<HTMLDivElement | null>(null)

const lineStyle = computed(() => {
  const progress = Math.max(0, Math.min(1, props.progress))
  const feather = Math.max(0.03, Math.min(0.075, props.feather))

  const textShadowParts: string[] = []
  if (props.shadowEnabled) {
    textShadowParts.push(`${props.shadowOffsetX}px ${props.shadowOffsetY}px ${props.shadowBlur}px ${props.shadowColor}`)
  }
  textShadowParts.push(`0 0 calc(6px + ${Math.max(0, Math.min(12, props.beatGlow * 8))}px) rgba(156, 255, 223, 0.34)`)
  textShadowParts.push(`0 0 calc(14px + ${Math.max(0, Math.min(12, props.beatGlow * 8))}px) rgba(156, 255, 223, 0.26)`)

  const strokeStyle = props.strokeEnabled
    ? `${props.strokeWidth}px ${props.strokeColor}`
    : '0.18px rgba(255, 255, 255, 0.72)'

  return {
    '--lyric-primary': props.primaryColor,
    '--lyric-highlight': props.highlightColor,
    '--lyric-glow': props.glowColor,
    '--lyric-progress': `${progress * 100}%`,
    '--lyric-feather': `${feather * 100}%`,
    '--lyric-size': `${props.fontSize}px`,
    '--lyric-weight': props.fontWeight,
    '--lyric-font': props.fontFamily,
    '--lyric-letter-spacing': `${props.fontSize * props.letterSpacing}px`,
    '--lyric-line-height': props.lineHeight,
    '--lyric-stroke': strokeStyle,
    '--lyric-shadow': textShadowParts.join(', '),
  }
})
</script>

<style scoped>
.lyric-line {
  position: relative;
  display: inline-block;
  max-width: none;
  color: #fff;
  font-family: var(--lyric-font);
  font-size: var(--lyric-size);
  font-weight: var(--lyric-weight);
  line-height: var(--lyric-line-height);
  letter-spacing: var(--lyric-letter-spacing);
  text-align: center;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  padding: 0.2em 0.12em 0.34em;
  margin: -0.2em -0.12em -0.34em;
  background: linear-gradient(90deg, var(--lyric-primary), var(--lyric-primary));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  -webkit-text-stroke: var(--lyric-stroke);
  paint-order: stroke fill;
  text-shadow: var(--lyric-shadow);
  filter: none;
  opacity: 0;
  transform: translate3d(0, 0, 0);
  transform-origin: center;
  backface-visibility: hidden;
  will-change: opacity, filter, transform, background;
}

.lyric-line.highlight {
  background: linear-gradient(
    90deg,
    var(--lyric-highlight) 0%,
    var(--lyric-highlight) max(0%, calc(var(--lyric-progress) - var(--lyric-feather))),
    var(--lyric-glow) calc(var(--lyric-progress) + 1.2%),
    var(--lyric-primary) calc(var(--lyric-progress) + var(--lyric-feather)),
    var(--lyric-primary) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
}

.lyric-line.in {
  animation: lyr-in 820ms cubic-bezier(0.16, 0.84, 0.32, 1.02) forwards;
}

.lyric-translation {
  display: block;
  font-size: 0.42em;
  font-weight: 500;
  margin-top: 0.3em;
  opacity: 0.7;
  letter-spacing: 0.05em;
  -webkit-text-fill-color: currentColor;
  background: none;
}

@keyframes lyr-in {
  0% {
    opacity: 0;
    transform: translate3d(0, 32px, -120px) rotateX(24deg) rotateY(-18deg) scale(0.78);
    filter: blur(12px);
  }
  58% {
    opacity: 1;
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1);
    filter: blur(0);
  }
}
</style>
