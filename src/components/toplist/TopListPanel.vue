<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { providerManager } from '@/modules/providers'
import type { TopListItem } from '@/types'
import TopListDetail from './TopListDetail.vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const topLists = ref<TopListItem[]>([])
const loading = ref(false)
const activeProvider = ref('netease')
const selectedTopList = ref<TopListItem | null>(null)
const showDetail = ref(false)

const officialTopLists = computed(() => {
  return topLists.value.filter((_, i) => i < 4)
})

const globalTopLists = computed(() => {
  return topLists.value.filter((_, i) => i >= 4 && i < 12)
})

const featureTopLists = computed(() => {
  return topLists.value.slice(12)
})

async function loadTopLists() {
  loading.value = true
  try {
    const provider = providerManager.get(activeProvider.value) || providerManager.default
    const lists = await provider.getTopList()
    topLists.value = lists
  } catch (e) {
    console.error('Load top list error:', e)
    topLists.value = []
  } finally {
    loading.value = false
  }
}

function openDetail(item: TopListItem) {
  selectedTopList.value = item
  showDetail.value = true
}

function closeDetail() {
  showDetail.value = false
  selectedTopList.value = null
}

function formatPlayCount(count?: number): string {
  if (!count) return ''
  if (count >= 100000000) {
    return (count / 100000000).toFixed(1) + ' 亿'
  }
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + ' 万'
  }
  return String(count)
}

const providers = providerManager.getAll()

onMounted(() => {
  if (props.visible) {
    loadTopLists()
  }
})
</script>

<template>
  <Transition name="slide">
    <div v-if="visible" class="toplist-panel">
      <div class="toplist-backdrop" @click="emit('close')"></div>
      <div class="toplist-container" @click.stop>
        <button class="toplist-close" @click="emit('close')" title="关闭">
          ✕
        </button>

        <div class="toplist-header">
          <h2 class="toplist-title">排行榜</h2>
          <div class="provider-tabs">
            <button
              v-for="p in providers"
              :key="p.id"
              class="provider-tab"
              :class="{ active: activeProvider === p.id }"
              :style="{ '--provider-color': p.color }"
              @click="activeProvider = p.id; loadTopLists()"
            >
              {{ p.name }}
            </button>
          </div>
        </div>

        <div class="toplist-content">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>

          <template v-else>
            <div v-if="officialTopLists.length > 0" class="toplist-section">
              <h3 class="section-title">官方榜</h3>
              <div class="toplist-grid">
                <div
                  v-for="item in officialTopLists"
                  :key="item.id"
                  class="toplist-card"
                  @click="openDetail(item)"
                >
                  <div class="toplist-cover">
                    <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.name" />
                    <div class="cover-gradient" v-else></div>
                    <div class="toplist-playcount" v-if="item.playCount">
                      ▶ {{ formatPlayCount(item.playCount) }}
                    </div>
                  </div>
                  <div class="toplist-info">
                    <div class="toplist-name">{{ item.name }}</div>
                    <div class="toplist-songs">
                      <div
                        v-for="(song, idx) in (item.tracks || []).slice(0, 3)"
                        :key="song.id"
                        class="toplist-song"
                      >
                        <span class="song-rank">{{ idx + 1 }}</span>
                        <span class="song-name">{{ song.name }}</span>
                        <span class="song-artist">{{ song.artists?.[0]?.name || '' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="globalTopLists.length > 0" class="toplist-section">
              <h3 class="section-title">全球榜</h3>
              <div class="toplist-grid">
                <div
                  v-for="item in globalTopLists"
                  :key="item.id"
                  class="toplist-card"
                  @click="openDetail(item)"
                >
                  <div class="toplist-cover">
                    <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.name" />
                    <div class="cover-gradient" v-else></div>
                    <div class="toplist-playcount" v-if="item.playCount">
                      ▶ {{ formatPlayCount(item.playCount) }}
                    </div>
                  </div>
                  <div class="toplist-info">
                    <div class="toplist-name">{{ item.name }}</div>
                    <div class="toplist-songs">
                      <div
                        v-for="(song, idx) in (item.tracks || []).slice(0, 3)"
                        :key="song.id"
                        class="toplist-song"
                      >
                        <span class="song-rank">{{ idx + 1 }}</span>
                        <span class="song-name">{{ song.name }}</span>
                        <span class="song-artist">{{ song.artists?.[0]?.name || '' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="featureTopLists.length > 0" class="toplist-section">
              <h3 class="section-title">特色榜</h3>
              <div class="toplist-grid">
                <div
                  v-for="item in featureTopLists"
                  :key="item.id"
                  class="toplist-card"
                  @click="openDetail(item)"
                >
                  <div class="toplist-cover">
                    <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.name" />
                    <div class="cover-gradient" v-else></div>
                    <div class="toplist-playcount" v-if="item.playCount">
                      ▶ {{ formatPlayCount(item.playCount) }}
                    </div>
                  </div>
                  <div class="toplist-info">
                    <div class="toplist-name">{{ item.name }}</div>
                    <div class="toplist-songs">
                      <div
                        v-for="(song, idx) in (item.tracks || []).slice(0, 3)"
                        :key="song.id"
                        class="toplist-song"
                      >
                        <span class="song-rank">{{ idx + 1 }}</span>
                        <span class="song-name">{{ song.name }}</span>
                        <span class="song-artist">{{ song.artists?.[0]?.name || '' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <TopListDetail
        v-if="selectedTopList"
        :top-list-id="selectedTopList.id"
        :source="selectedTopList.source"
        :visible="showDetail"
        @close="closeDetail"
      />
    </div>
  </Transition>
</template>

<style scoped>
.toplist-panel {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toplist-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.toplist-container {
  position: relative;
  width: min(900px, 94vw);
  max-height: 85vh;
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.95),
    rgba(15, 15, 22, 0.98)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}

.toplist-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  z-index: 10;
}

.toplist-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  transform: scale(1.05);
}

.toplist-header {
  padding: 28px 28px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.toplist-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: #fff;
}

.provider-tabs {
  display: flex;
  gap: 8px;
}

.provider-tab {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.provider-tab:hover {
  color: rgba(255, 255, 255, 0.8);
  border-color: rgba(255, 255, 255, 0.2);
}

.provider-tab.active {
  color: var(--provider-color, #d95b67);
  border-color: var(--provider-color, #d95b67);
  background: rgba(217, 91, 103, 0.1);
}

.toplist-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px 28px;
}

.toplist-section {
  margin-bottom: 28px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.toplist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.toplist-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toplist-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(217, 91, 103, 0.3);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.toplist-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.toplist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-gradient {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.4), rgba(100, 50, 150, 0.4));
}

.toplist-playcount {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
}

.toplist-info {
  padding: 12px;
}

.toplist-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toplist-songs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toplist-song {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-rank {
  width: 14px;
  text-align: center;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.song-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  max-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #d95b67;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.25s ease;
}

.slide-enter-active .toplist-container,
.slide-leave-active .toplist-container {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

.slide-enter-from .toplist-container,
.slide-leave-to .toplist-container {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}
</style>
