<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal track-detail-modal">
      <h2>{{ mode === 'artist' ? '歌手详情' : '歌曲详情' }}</h2>

      <!-- 歌曲信息 -->
      <template v-if="mode === 'song' && song">
        <div class="detail-hero">
          <img v-if="song.cover" class="detail-cover" :src="song.cover" :alt="song.name">
          <div>
            <div class="detail-title">{{ song.name }}</div>
            <div class="detail-sub">{{ song.artist }} · {{ song.album || '未知专辑' }}</div>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-k">来源</div>
          <div class="detail-v">{{ song.source === 'qq' ? 'QQ 音乐' : '网易云' }}</div>
          <div class="detail-k">时长</div>
          <div class="detail-v">{{ formatDuration(song.duration) }}</div>
          <div class="detail-k">ID</div>
          <div class="detail-v">{{ song.id }}</div>
        </div>
      </template>

      <!-- 歌手信息 -->
      <template v-if="mode === 'artist'">
        <div v-if="artistLoading" style="text-align:center;padding:20px;color:rgba(255,255,255,.4)">加载中...</div>
        <template v-else-if="artistInfo">
          <div class="detail-hero">
            <img v-if="artistInfo.cover" class="detail-cover detail-artist-avatar" :src="artistInfo.cover" :alt="artistInfo.name">
            <div>
              <div class="detail-title">{{ artistInfo.name }}</div>
              <div class="detail-sub">
                {{ artistInfo.songCount ?? 0 }} 首歌曲 · {{ artistInfo.albumCount ?? 0 }} 张专辑
              </div>
            </div>
          </div>
          <div v-if="artistInfo.description" style="font-size:12px;color:rgba(255,255,255,.5);line-height:1.6;margin:12px 0;max-height:100px;overflow:auto">
            {{ artistInfo.description }}
          </div>
        </template>
      </template>

      <div class="btn-row">
        <button class="modal-btn" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { netease } from '@/services/netease'
import { qq } from '@/services/qq'
import type { Song, ArtistInfo } from '@/types'

const props = defineProps<{
  song?: Song | null
  artistId?: string
  mode: 'song' | 'artist'
}>()

defineEmits<{ close: [] }>()

const artistLoading = ref(false)
const artistInfo = ref<ArtistInfo | null>(null)

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

onMounted(async () => {
  if (props.mode === 'artist' && props.artistId) {
    artistLoading.value = true
    try {
      const service = props.song?.source === 'qq' ? qq : netease
      const result = await service.getArtistDetail({
        id: props.artistId,
        ...(props.song?.source === 'qq' ? { mid: props.artistId } : {})
      })
      if (result) {
        artistInfo.value = result as unknown as ArtistInfo
      }
    } catch (e) {
      console.error('[TrackDetailModal] load artist failed:', e)
    } finally {
      artistLoading.value = false
    }
  }
})
</script>
