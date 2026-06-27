<template>
  <component :is="iconComponent" :size="size" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconPlay from './IconPlay.vue'
import IconPause from './IconPause.vue'
import IconSkipBack from './IconSkipBack.vue'
import IconSkipForward from './IconSkipForward.vue'
import IconVolume from './IconVolume.vue'
import IconVolumeX from './IconVolumeX.vue'
import IconShuffle from './IconShuffle.vue'
import IconRepeat from './IconRepeat.vue'
import IconRepeat1 from './IconRepeat1.vue'
import IconListOrdered from './IconListOrdered.vue'
import IconList from './IconList.vue'
import IconSettings from './IconSettings.vue'
import IconSearch from './IconSearch.vue'
import IconX from './IconX.vue'
import IconMinimize from './IconMinimize.vue'
import IconMaximize from './IconMaximize.vue'
import IconChevronDown from './IconChevronDown.vue'
import IconChevronUp from './IconChevronUp.vue'
import IconChevronLeft from './IconChevronLeft.vue'
import IconChevronRight from './IconChevronRight.vue'
import IconMusic from './IconMusic.vue'
import IconMic from './IconMic.vue'
import IconUser from './IconUser.vue'
import IconClock from './IconClock.vue'
import IconFolder from './IconFolder.vue'
import IconEqualizer from './IconEqualizer.vue'
import IconKeyboard from './IconKeyboard.vue'
import IconInfo from './IconInfo.vue'
import IconTrash from './IconTrash.vue'
import IconPlus from './IconPlus.vue'
import IconGripHorizontal from './IconGripHorizontal.vue'
import IconGripVertical from './IconGripVertical.vue'
import IconDownload from './IconDownload.vue'
import IconCompact from './IconCompact.vue'
import IconArrowDown from './IconArrowDown.vue'
import IconLayers from './IconLayers.vue'
import IconBox from './IconBox.vue'
import IconEdit from './IconEdit.vue'
import IconHome from './IconHome.vue'
import IconHeart from './IconHeart.vue'
import IconSun from './IconSun.vue'
import IconMoon from './IconMoon.vue'
import IconCloudSun from './IconCloudSun.vue'
import IconCalendar from './IconCalendar.vue'
import IconTrophy from './IconTrophy.vue'
import IconPalette from './IconPalette.vue'
import IconMonitor from './IconMonitor.vue'
import IconEye from './IconEye.vue'
import IconEyeOff from './IconEyeOff.vue'
import IconUpload from './IconUpload.vue'

const iconMap: Record<string, any> = {
  play: IconPlay,
  pause: IconPause,
  'skip-back': IconSkipBack,
  'skip-forward': IconSkipForward,
  volume: IconVolume,
  'volume-x': IconVolumeX,
  shuffle: IconShuffle,
  repeat: IconRepeat,
  'repeat-1': IconRepeat1,
  'list-ordered': IconListOrdered,
  list: IconList,
  settings: IconSettings,
  search: IconSearch,
  x: IconX,
  minimize: IconMinimize,
  maximize: IconMaximize,
  'chevron-down': IconChevronDown,
  'chevron-up': IconChevronUp,
  'chevron-left': IconChevronLeft,
  'chevron-right': IconChevronRight,
  music: IconMusic,
  mic: IconMic,
  user: IconUser,
  clock: IconClock,
  folder: IconFolder,
  equalizer: IconEqualizer,
  keyboard: IconKeyboard,
  info: IconInfo,
  trash: IconTrash,
  plus: IconPlus,
  'grip-horizontal': IconGripHorizontal,
  'grip-vertical': IconGripVertical,
  download: IconDownload,
  compact: IconCompact,
  'arrow-down': IconArrowDown,
  layers: IconLayers,
  box: IconBox,
  edit: IconEdit,
  home: IconHome,
  heart: IconHeart,
  sun: IconSun,
  moon: IconMoon,
  'cloud-sun': IconCloudSun,
  calendar: IconCalendar,
  trophy: IconTrophy,
  palette: IconPalette,
  monitor: IconMonitor,
  eye: IconEye,
  'eye-off': IconEyeOff,
  upload: IconUpload,
}

const props = withDefaults(defineProps<{
  name: string
  size?: number | string
}>(), {
  size: 20,
})

const iconComponent = computed(() => {
  const comp = iconMap[props.name]
  if (!comp) {
    console.warn(`[Icon] Unknown icon name: "${props.name}"`)
    return IconInfo
  }
  return comp
})
</script>
