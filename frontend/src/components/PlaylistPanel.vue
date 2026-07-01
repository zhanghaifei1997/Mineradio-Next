<template>
  <div id="playlist-panel" :class="{ peek: isOpen, pinned: isPinned }">
    <!-- 标题栏 -->
    <div class="queue-head">
      <div>
        <div class="fx-title">歌单 / 队列</div>
        <div class="fx-sub">QUEUE</div>
      </div>
      <div class="queue-head-act">
        <button
          class="fx-mini-btn ghost playlist-pin-btn"
          :class="{ active: isPinned }"
          @click="isPinned = !isPinned"
          title="常开歌单"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 4l6 6"/><path d="M5 15l4 4"/><path d="M14 4l-2 5-4 4-3 2 4 4 2-3 4-4 5-2z"/><path d="M9 19l-4 4"/>
          </svg>
        </button>
        <button class="fx-mini-btn ghost" @click="shuffleQueue">随机</button>
      </div>
    </div>

    <!-- 标签切换 -->
    <div class="panel-tabs">
      <button class="panel-tab" :class="{ active: activeTab === 'queue' }" @click="activeTab = 'queue'">当前队列</button>
      <button class="panel-tab" :class="{ active: activeTab === 'playlists' }" @click="activeTab = 'playlists'">我的歌单</button>
      <button class="panel-tab" :class="{ active: activeTab === 'podcasts' }" @click="activeTab = 'podcasts'">我的播客</button>
    </div>

    <!-- 当前队列 -->
    <div v-show="activeTab === 'queue'" id="queue-pane">
      <div class="queue-toolbar">
        <div class="queue-chip">{{ playModeLabel }}</div>
        <div style="display:flex;gap:6px">
          <button class="fx-mini-btn ghost" style="height:26px;padding:0 10px;font-size:11px" @click="cycleMode">切换模式</button>
          <button class="fx-mini-btn ghost" style="height:26px;padding:0 10px;font-size:11px" @click="clearQueue">清空</button>
        </div>
      </div>
      <div class="queue-list">
        <div
          v-for="(song, idx) in player.playlist"
          :key="`${song.source}-${song.id}-${idx}`"
          class="queue-item"
          :class="{ now: idx === player.currentIdx }"
          @click="playIdx(idx)"
        >
          <img :src="song.cover || ''" :alt="song.name" loading="lazy">
          <div class="qi-info">
            <div class="qi-name">{{ song.name }}</div>
            <div class="qi-sub">{{ song.artist }}</div>
          </div>
          <div class="qi-act">
            <button title="下一首播放" class="queue-next" @click.stop="playNext(idx)">▶</button>
            <button title="移除" @click.stop="removeFromQueue(idx)">×</button>
          </div>
        </div>
        <div v-if="player.playlist.length === 0" class="search-empty">队列为空</div>
      </div>
    </div>

    <!-- 我的歌单 -->
    <div v-show="activeTab === 'playlists'" id="pl-pane">
      <div class="queue-toolbar">
        <div class="queue-chip">登录后显示网易云 / QQ 歌单</div>
        <button class="fx-mini-btn ghost" style="height:26px;padding:0 10px;font-size:11px" @click="refreshPlaylists">刷新</button>
      </div>
      <div v-if="userPlaylists.length > 0" style="margin-top:6px">
        <div
          v-for="pl in userPlaylists"
          :key="pl.id"
          class="pl-card"
          @click="selectPlaylist(pl)"
        >
          <img :src="pl.cover || ''" :alt="pl.name" loading="lazy">
          <div>
            <div class="pl-name">{{ pl.name }}</div>
            <div class="pl-sub">{{ pl.trackCount }} 首 · {{ pl.creator }}</div>
          </div>
        </div>
      </div>
      <div v-else class="search-empty" style="margin-top:20px">暂无歌单，请先登录</div>
    </div>

    <!-- 我的播客 -->
    <div v-show="activeTab === 'podcasts'" id="podcast-pane">
      <div class="queue-toolbar">
        <div class="queue-chip">收藏 / 创建 / 喜欢</div>
        <button class="fx-mini-btn ghost" style="height:26px;padding:0 10px;font-size:11px" @click="refreshPlaylists">刷新</button>
      </div>
      <div class="search-empty" style="margin-top:20px">暂无播客</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useSettingsStore } from '@/stores/settings'
import { netease } from '@/services/netease'
import type { Playlist, PlayMode } from '@/types'

const player = usePlayerStore()
const settings = useSettingsStore()

const isOpen = ref(false)
const isPinned = ref(false)
const activeTab = ref<'queue' | 'playlists' | 'podcasts'>('queue')
const userPlaylists = ref<Playlist[]>([])

const playModeLabels: Record<PlayMode, string> = {
  loop: '顺序循环',
  shuffle: '随机播放',
  single: '单曲循环',
}

const playModeLabel = computed(() => playModeLabels[player.playMode])

function cycleMode() {
  player.cyclePlayMode()
}

function clearQueue() {
  player.setPlaylist([])
  player.setCurrentIdx(-1)
}

function playIdx(idx: number) {
  player.setCurrentIdx(idx)
  // TODO: 通过 usePlayer 触发实际播放
}

function playNext(idx: number) {
  const song = player.playlist[idx]
  if (song) player.addToQueue(song)
}

function removeFromQueue(idx: number) {
  const newPlaylist = [...player.playlist]
  newPlaylist.splice(idx, 1)
  player.setPlaylist(newPlaylist)
  // 调整 currentIdx
  if (player.currentIdx > idx) {
    player.setCurrentIdx(player.currentIdx - 1)
  } else if (player.currentIdx === idx) {
    player.setCurrentIdx(Math.min(idx, newPlaylist.length - 1))
  }
}

function shuffleQueue() {
  const arr = [...player.playlist]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i]!, arr[j]!] = [arr[j]!, arr[i]!]
  }
  player.setPlaylist(arr)
}

async function refreshPlaylists() {
  try {
    const result = await netease.getUserPlaylists()
    if (result) {
      userPlaylists.value = (result as unknown as Record<string, unknown>).playlists as Playlist[] ?? []
    }
  } catch (e) {
    console.error('[PlaylistPanel] refresh failed:', e)
  }
}

function selectPlaylist(pl: Playlist) {
  console.log('[PlaylistPanel] selected playlist:', pl.name)
  // TODO: 加载歌单内歌曲并播放
}

// 鼠标移到左侧时显示面板
function onMouseMove(e: MouseEvent) {
  if (e.clientX < 50) {
    isOpen.value = true
  } else if (!isPinned.value && e.clientX > 400) {
    isOpen.value = false
  }
}

// 暴露给父组件
defineExpose({ isOpen, isPinned })
</script>
