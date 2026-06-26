<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useFxStore } from '@/stores/fx'
import { usePlayerStore } from '@/stores/player'
import { useImmersiveStore } from '@/stores/immersive'
import { useLyricsStore } from '@/stores/lyrics'
import { useThemeStore } from '@/stores/theme'

const emit = defineEmits<{
  (e: 'open-settings'): void
  (e: 'open-about'): void
}>()

const fx = useFxStore()
const player = usePlayerStore()
const immersive = useImmersiveStore()
const lyrics = useLyricsStore()
const theme = useThemeStore()

const showMenu = ref(false)
const menuPosition = ref({ x: 0, y: 0 })

const shelfVisible = computed(() => fx.settings.shelfMode !== 'off')

function handleContextMenu(e: MouseEvent) {
  e.preventDefault()
  if (immersive.isImmersive) return
  
  menuPosition.value = {
    x: e.clientX,
    y: e.clientY,
  }
  showMenu.value = true
  
  requestAnimationFrame(() => {
    adjustMenuPosition()
  })
}

function adjustMenuPosition() {
  const menu = document.querySelector('.context-menu') as HTMLElement
  if (!menu) return
  
  const rect = menu.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  if (menuPosition.value.x + rect.width > viewportWidth) {
    menuPosition.value.x = viewportWidth - rect.width - 10
  }
  
  if (menuPosition.value.y + rect.height > viewportHeight) {
    menuPosition.value.y = viewportHeight - rect.height - 10
  }
}

function closeMenu() {
  showMenu.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (showMenu.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.context-menu')) {
      closeMenu()
    }
  }
}

function toggleShelf() {
  const newMode = fx.settings.shelfMode === 'off' ? 'sidebar' : 'off'
  fx.update('shelfMode', newMode)
  closeMenu()
}

function toggleImmersive() {
  immersive.toggle()
  closeMenu()
}

function toggleDesktopLyrics() {
  lyrics.toggleStageLyrics()
  closeMenu()
}

function toggleMiniMode() {
  const electronAPI = (window as any).electronAPI
  if (electronAPI?.window?.setMiniMode) {
    electronAPI.window.setMiniMode(true)
  }
  closeMenu()
}

function togglePlay() {
  player.togglePlay()
  closeMenu()
}

function playPrev() {
  player.prev()
  closeMenu()
}

function playNext() {
  player.next()
  closeMenu()
}

function openSettings() {
  emit('open-settings')
  closeMenu()
}

function openAbout() {
  emit('open-about')
  closeMenu()
}

function toggleTheme() {
  theme.toggleTheme()
  closeMenu()
}

onMounted(() => {
  window.addEventListener('contextmenu', handleContextMenu)
  window.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', closeMenu, true)
})

onUnmounted(() => {
  window.removeEventListener('contextmenu', handleContextMenu)
  window.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', closeMenu, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="context-fade">
      <div
        v-if="showMenu"
        class="context-menu"
        :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
      >
        <div class="context-menu__item" @click="toggleShelf">
          <span class="context-menu__icon">📚</span>
          <span class="context-menu__label">{{ shelfVisible ? '隐藏歌单架' : '3D 歌单架' }}</span>
          <span class="context-menu__shortcut"></span>
        </div>
        
        <div class="context-menu__item" @click="toggleImmersive">
          <span class="context-menu__icon">🖥️</span>
          <span class="context-menu__label">沉浸模式</span>
          <span class="context-menu__shortcut">F11</span>
        </div>
        
        <div class="context-menu__item" @click="toggleDesktopLyrics">
          <span class="context-menu__icon">🎤</span>
          <span class="context-menu__label">{{ lyrics.stageEnabled ? '隐藏歌词' : '桌面歌词' }}</span>
          <span class="context-menu__shortcut"></span>
        </div>
        
        <div class="context-menu__divider"></div>
        
        <div class="context-menu__item" @click="togglePlay">
          <span class="context-menu__icon">{{ player.isPlaying ? '⏸️' : '▶️' }}</span>
          <span class="context-menu__label">{{ player.isPlaying ? '暂停' : '播放' }}</span>
          <span class="context-menu__shortcut">Space</span>
        </div>
        
        <div class="context-menu__item" @click="playPrev">
          <span class="context-menu__icon">⏮️</span>
          <span class="context-menu__label">上一首</span>
          <span class="context-menu__shortcut">←</span>
        </div>
        
        <div class="context-menu__item" @click="playNext">
          <span class="context-menu__icon">⏭️</span>
          <span class="context-menu__label">下一首</span>
          <span class="context-menu__shortcut">→</span>
        </div>
        
        <div class="context-menu__divider"></div>
        
        <div class="context-menu__item" @click="toggleMiniMode">
          <span class="context-menu__icon">📱</span>
          <span class="context-menu__label">迷你播放器</span>
          <span class="context-menu__shortcut"></span>
        </div>
        
        <div class="context-menu__item" @click="toggleTheme">
          <span class="context-menu__icon">{{ theme.isDark ? '🌙' : '☀️' }}</span>
          <span class="context-menu__label">{{ theme.isDark ? '暗色模式' : '亮色模式' }}</span>
          <span class="context-menu__shortcut"></span>
        </div>
        
        <div class="context-menu__divider"></div>
        
        <div class="context-menu__item" @click="openSettings">
          <span class="context-menu__icon">⚙️</span>
          <span class="context-menu__label">设置</span>
          <span class="context-menu__shortcut"></span>
        </div>
        
        <div class="context-menu__item" @click="openAbout">
          <span class="context-menu__icon">ℹ️</span>
          <span class="context-menu__label">关于</span>
          <span class="context-menu__shortcut"></span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 99999;
  min-width: 220px;
  padding: 8px;
  background: var(--color-surface);
  backdrop-filter: var(--blur-surface);
  -webkit-backdrop-filter: var(--blur-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  user-select: none;
}

.context-menu__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
}

.context-menu__item:hover {
  background: var(--color-hover);
}

.context-menu__icon {
  width: 20px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.context-menu__label {
  flex: 1;
  font-size: 14px;
  color: var(--color-text);
}

.context-menu__shortcut {
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.context-menu__divider {
  height: 1px;
  margin: 6px 8px;
  background: var(--color-border);
}

.context-fade-enter-active,
.context-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.context-fade-enter-from,
.context-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
