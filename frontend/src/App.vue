<template>
  <div id="desktop-window-shell">
    <!-- 标题栏 -->
    <TitleBar />

    <!-- 搜索栏 -->
    <SearchBar @play-song="onPlaySong" />

    <!-- 全屏 DIY 按钮区域 -->
    <div id="fullscreen-diy-zone" aria-hidden="true">
      <button
        id="fullscreen-diy-btn"
        class="desktop-mode-btn"
        :class="{ on: settings.diyMode }"
        type="button"
        @click="settings.setDiyMode(!settings.diyMode)"
        title="DIY"
      >DIY</button>
    </div>

    <!-- 自定义背景 -->
    <div id="custom-bg">
      <video id="custom-bg-video" muted loop playsinline preload="metadata"></video>
    </div>
    <div id="album-bg"></div>

    <!-- 3D 画布容器 -->
    <div id="canvas-container"></div>

    <!-- 舞台歌词 -->
    <LyricsStage />

    <!-- 左下小封面 -->
    <div id="thumb-wrap" :class="{ visible: !!player.currentSong }">
      <img id="thumb-cover" :src="player.currentSong?.cover ?? ''" alt="">
      <div id="thumb-info">
        <div id="thumb-title" title="歌曲详情">{{ player.currentSong?.name ?? '' }}</div>
        <div id="thumb-artist" title="歌手详情">{{ player.currentSong?.artist ?? '' }}</div>
      </div>
    </div>

    <!-- 底部播放控制栏 -->
    <PlayerBar />

    <!-- 左侧歌单/队列面板 -->
    <PlaylistPanel />

    <!-- 视觉控制台 -->
    <FxPanel />

    <!-- 登录弹窗 -->
    <LoginModal v-if="showLogin" @close="showLogin = false" />

    <!-- Toast -->
    <div id="toast"></div>

    <!-- 拖放覆盖层 -->
    <div id="drop-overlay"><div class="drop-text">拖放音乐或封面</div></div>

    <!-- 加载覆盖层 -->
    <div id="loading-overlay"><div class="spinner"></div></div>

    <!-- 隐藏文件输入 -->
    <input type="file" id="file-input" accept=".mp3,.flac,.wav,.ogg,.m4a,.jpg,.jpeg,.png,.webp" multiple style="display:none">
    <input type="file" id="background-image-input" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,video/mp4,video/webm" style="display:none">
  </div>
</template>

<script setup lang="ts">
import { provide, onMounted, ref } from 'vue'
import TitleBar from '@/components/TitleBar.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import SearchBar from '@/components/SearchBar.vue'
import PlaylistPanel from '@/components/PlaylistPanel.vue'
import FxPanel from '@/components/FxPanel.vue'
import LoginModal from '@/components/LoginModal.vue'
import LyricsStage from '@/components/LyricsStage.vue'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'
import { useSearchStore } from '@/stores/search'
import { usePlayer } from '@/composables/usePlayer'
import { desktop } from '@/services/desktop'
import type { Song } from '@/types'

const settings = useSettingsStore()
const player = usePlayerStore()
const showLogin = ref(false)

// 创建全局共享的播放器实例
const playerCtrl = usePlayer()
const search = useSearchStore()
provide('player', playerCtrl)

/** 搜索栏点击播放歌曲 */
function onPlaySong(song: Song) {
  playerCtrl.playSong(song, search.songs)
}

onMounted(async () => {
  // 添加桌面外壳 CSS 类
  document.documentElement.classList.add('desktop-shell-root')
  document.body.classList.add('desktop-shell')

  // 监听窗口状态变化同步 CSS 类
  desktop.onStateChange((state) => {
    const body = document.body
    body.classList.toggle('desktop-maximized', state.isMaximized)
    body.classList.toggle('desktop-fullscreen', state.isFullscreen)
  })
})
</script>
