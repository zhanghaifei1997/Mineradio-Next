<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import type { QualityLevel } from '@/types'

const props = defineProps<{
  showLabel?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', quality: QualityLevel): void
}>()

const player = usePlayerStore()
const userStore = useUserStore()
const showPopup = ref(false)
const popupRef = ref<HTMLElement | null>(null)

const qualityOptions = [
  { id: 'standard' as QualityLevel, name: '标准', desc: '128kbps', svip: false },
  { id: 'exhigh' as QualityLevel, name: '极高 HQ', desc: '320kbps', svip: false },
  { id: 'lossless' as QualityLevel, name: '无损 SQ', desc: 'FLAC 优先', svip: false },
  { id: 'hires' as QualityLevel, name: '高清臻音', desc: '默认 / 细节优先', svip: false },
  { id: 'jymaster' as QualityLevel, name: '超清母带', desc: 'SVIP / 最高规格', svip: true },
]

const shortLabels: Record<string, string> = {
  standard: '标',
  exhigh: 'HQ',
  lossless: 'SQ',
  hires: '臻',
  jymaster: '母',
}

const canUseSvip = computed(() => userStore.isLoggedIn)

const currentQualityInfo = computed(() => {
  return qualityOptions.find(q => q.id === player.currentQuality) || qualityOptions[2]
})

const displayLabel = computed(() => shortLabels[player.currentQuality] || 'HQ')

function togglePopup(e: MouseEvent) {
  e.stopPropagation()
  showPopup.value = !showPopup.value
}

async function selectQuality(quality: QualityLevel) {
  const opt = qualityOptions.find(q => q.id === quality)
  if (opt?.svip && !canUseSvip.value) {
    showPopup.value = false
    return
  }
  if (player.currentSong) {
    await player.switchQuality(quality)
  } else {
    player.setQuality(quality)
  }
  emit('change', quality)
  showPopup.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (popupRef.value && !popupRef.value.contains(e.target as Node)) {
    showPopup.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="quality-control" :class="{ open: showPopup }" ref="popupRef">
    <button
      class="ctrl-btn quality-pill"
      @click="togglePopup"
      :title="'音质: ' + currentQualityInfo.name"
    >
      <span class="quality-pill-label">{{ displayLabel }}</span>
    </button>

    <div class="quality-popover" @click.stop>
      <button
        v-for="q in qualityOptions"
        :key="q.id"
        class="quality-option"
        :class="{
          active: player.currentQuality === q.id,
          locked: q.svip && !canUseSvip,
          'svip-only': q.svip
        }"
        :disabled="q.svip && !canUseSvip"
        @click="selectQuality(q.id)"
      >
        <span>{{ q.name }}</span>
        <small>{{ q.desc }}</small>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* --- Pill trigger button --- */
.quality-pill {
  width: auto;
  min-width: 56px;
  padding: 0 11px;
  border-radius: 13px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .2px;
  color: rgba(237,245,255,.82);
  background: rgba(255,255,255,.038);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}

.quality-pill:hover {
  color: #fff;
  background: rgba(255,255,255,.09);
  border-color: rgba(255,255,255,.18);
  transform: translateY(-1px) scale(1.02);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.10),
    0 8px 24px rgba(0,0,0,.12);
}

.quality-pill-label {
  display: block;
  min-width: 30px;
  text-align: center;
  white-space: nowrap;
}

/* --- Popover panel --- */
.quality-popover {
  position: absolute;
  left: 50%;
  bottom: 46px;
  transform: translateX(-50%) translateY(8px);
  width: 228px;
  padding: 8px;
  border-radius: 14px;
  border: 1px solid rgba(157,184,207,.24);
  background: rgba(10,11,14,.82);
  backdrop-filter: blur(24px) saturate(1.25);
  -webkit-backdrop-filter: blur(24px) saturate(1.25);
  box-shadow: 0 18px 48px rgba(0,0,0,.38),
    inset 0 1px 0 rgba(255,255,255,.08);
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s, transform .2s;
  z-index: 8;
}

.quality-control.open .quality-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

/* --- Quality options --- */
.quality-option {
  min-height: 40px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.045);
  color: rgba(255,255,255,.70);
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .1px;
  cursor: pointer;
  transition: background .2s, border-color .2s, color .2s, transform .2s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px;
  text-align: left;
}

.quality-option span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quality-option small {
  font-size: 9.5px;
  font-weight: 700;
  color: rgba(255,255,255,.42);
  letter-spacing: 0;
  white-space: nowrap;
}

.quality-option:hover {
  transform: translateY(-1px);
  color: #fff;
  background: rgba(255,255,255,.09);
}

.quality-option.active {
  color: #eaf2ff;
  border-color: rgba(157,184,207,.46);
  background: rgba(157,184,207,.16);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}

.quality-option.locked {
  opacity: .42;
  cursor: not-allowed;
  transform: none !important;
}

.quality-option.locked small::after {
  content: ' · 需网易云SVIP';
  color: rgba(244,210,138,.88);
}

.quality-option.svip-only {
  border-color: rgba(244,210,138,.18);
}
</style>
