<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal collect-modal">
      <h2>收藏到歌单</h2>

      <!-- 当前歌曲 -->
      <div class="collect-current">
        <img v-if="song?.cover" :src="song.cover" :alt="song.name">
        <div>
          <div class="collect-title">{{ song?.name ?? '未知歌曲' }}</div>
          <div class="collect-sub">{{ song?.artist ?? '' }}</div>
        </div>
      </div>

      <!-- 创建歌单 -->
      <div class="collect-create">
        <input v-model="newPlaylistName" placeholder="新建歌单名称..." @keydown.enter="createPlaylist">
        <button class="modal-btn primary" @click="createPlaylist">创建</button>
      </div>

      <!-- 歌单列表 -->
      <div class="collect-list">
        <div
          v-for="pl in playlists"
          :key="pl.id"
          class="collect-item"
          @click="addToPlaylist(pl.id)"
        >
          <img v-if="pl.cover" :src="pl.cover" :alt="pl.name">
          <div>
            <div class="collect-title">{{ pl.name }}</div>
            <div class="collect-sub">{{ pl.trackCount }} 首</div>
          </div>
        </div>
        <div v-if="playlists.length === 0" class="search-empty">暂无歌单，请先创建</div>
      </div>

      <div class="btn-row">
        <button class="modal-btn" @click="$emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { netease } from '@/services/netease'
import type { Song, Playlist } from '@/types'

const props = defineProps<{ song?: Song | null }>()
const emit = defineEmits<{ close: [] }>()

const newPlaylistName = ref('')
const playlists = ref<Playlist[]>([])

onMounted(async () => {
  try {
    const result = await netease.getUserPlaylists()
    if (result) {
      playlists.value = (result as unknown as Record<string, unknown>).playlists as Playlist[] ?? []
    }
  } catch (e) {
    console.error('[CollectModal] load playlists failed:', e)
  }
})

async function createPlaylist() {
  if (!newPlaylistName.value.trim()) return
  try {
    await netease.createPlaylist({ name: newPlaylistName.value.trim() })
    // 刷新列表
    const result = await netease.getUserPlaylists()
    if (result) {
      playlists.value = (result as unknown as Record<string, unknown>).playlists as Playlist[] ?? []
    }
    newPlaylistName.value = ''
  } catch (e) {
    console.error('[CollectModal] create failed:', e)
  }
}

async function addToPlaylist(playlistId: string) {
  if (!props.song) return
  try {
    await netease.addSongToPlaylist({ playlistId, songIds: [props.song.id] })
    emit('close')
  } catch (e) {
    console.error('[CollectModal] add failed:', e)
  }
}
</script>
