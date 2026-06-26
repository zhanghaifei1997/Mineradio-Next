<script setup lang="ts">
import { ref, computed, watch } from 'vue'

export interface FallbackNotice {
  id: string
  fromSource: string
  toSource: string
  songName: string
  timestamp: number
}

const props = withDefaults(defineProps<{
  notice: FallbackNotice | null
  duration?: number
}>(), {
  duration: 5000
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'view-detail'): void
}>()

const visible = ref(false)
let hideTimer: number | null = null

const sourceNames: Record<string, string> = {
  netease: '网易云音乐',
  qqmusic: 'QQ 音乐',
  kugou: '酷狗音乐',
  local: '本地音乐'
}

const sourceIcons: Record<string, string> = {
  netease: '🎵',
  qqmusic: '🎶',
  kugou: '🎤',
  local: '💾'
}

const fromSourceName = computed(() => 
  sourceNames[props.notice?.fromSource || ''] || props.notice?.fromSource || '未知'
)

const toSourceName = computed(() => 
  sourceNames[props.notice?.toSource || ''] || props.notice?.toSource || '未知'
)

const fromSourceIcon = computed(() => 
  sourceIcons[props.notice?.fromSource || ''] || '🎵'
)

const toSourceIcon = computed(() => 
  sourceIcons[props.notice?.toSource || ''] || '🎵'
)

function close() {
  visible.value = false
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  setTimeout(() => {
    emit('close')
  }, 300)
}

function viewDetail() {
  emit('view-detail')
  close()
}

watch(() => props.notice, (val) => {
  if (val) {
    visible.value = true
    if (hideTimer) {
      clearTimeout(hideTimer)
    }
    hideTimer = window.setTimeout(() => {
      close()
    }, props.duration)
  }
}, { immediate: true })
</script>

<template>
  <Transition name="notice-slide">
    <div v-if="notice && visible" class="source-fallback-notice" @click="viewDetail">
      <div class="notice-icon">
        <span class="icon-switch">🔄</span>
      </div>
      
      <div class="notice-content">
        <div class="notice-title">播放失败，已切换音乐源</div>
        <div class="notice-detail">
          <span class="source-tag from-source">
            <span class="source-icon">{{ fromSourceIcon }}</span>
            {{ fromSourceName }}
          </span>
          <span class="arrow">→</span>
          <span class="source-tag to-source">
            <span class="source-icon">{{ toSourceIcon }}</span>
            {{ toSourceName }}
          </span>
        </div>
        <div class="notice-song" v-if="notice.songName">
          歌曲：{{ notice.songName }}
        </div>
      </div>

      <button class="notice-close" @click.stop="close" title="关闭">
        ✕
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.source-fallback-notice {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: rgba(30, 30, 45, 0.95);
  border: 1px solid rgba(255, 180, 100, 0.3);
  border-radius: 14px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 320px;
  max-width: 420px;
}

.source-fallback-notice:hover {
  background: rgba(40, 40, 60, 0.95);
  border-color: rgba(255, 180, 100, 0.5);
  transform: translateY(-2px);
}

.notice-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 180, 100, 0.15);
  border-radius: 12px;
  flex-shrink: 0;
}

.icon-switch {
  font-size: 22px;
  animation: iconSpin 2s linear infinite;
}

@keyframes iconSpin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.notice-content {
  flex: 1;
  min-width: 0;
}

.notice-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 6px;
}

.notice-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.source-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.from-source {
  background: rgba(255, 100, 100, 0.15);
  color: #ff8888;
}

.to-source {
  background: rgba(100, 255, 150, 0.15);
  color: #88ffaa;
}

.source-icon {
  font-size: 14px;
}

.arrow {
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
}

.notice-song {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.notice-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.notice-slide-enter-active,
.notice-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.notice-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.notice-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
