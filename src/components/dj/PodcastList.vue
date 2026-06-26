<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDjStore } from '@/stores/dj'
import type { DjRadio, DjProgram } from '@/modules/dj'
import { formatTime } from '@/utils/time'

const emit = defineEmits<{
  (e: 'select-program', program: DjProgram): void
  (e: 'select-radio', radio: DjRadio): void
}>()

const dj = useDjStore()

const activeTab = ref<'recommend' | 'subscribed' | 'toplist'>('recommend')
const toplistType = ref<'hot' | 'new' | 'rising'>('hot')

onMounted(() => {
  dj.loadRecommendRadios()
  dj.loadCategories()
})

function onTabChange(tab: 'recommend' | 'subscribed' | 'toplist') {
  activeTab.value = tab
  if (tab === 'subscribed') {
    dj.loadSubscribedRadios()
  } else if (tab === 'toplist') {
    dj.loadToplist(toplistType.value)
  }
}

function selectRadio(radio: DjRadio) {
  dj.setCurrentRadio(radio)
  emit('select-radio', radio)
}

function selectProgram(program: DjProgram) {
  dj.setCurrentProgram(program)
  emit('select-program', program)
}

const displayItems = computed(() => {
  if (activeTab.value === 'recommend') {
    return dj.recommendRadios.map((r) => ({
      id: r.id,
      name: r.name,
      coverUrl: r.picUrl,
      subtitle: r.desc || '',
      type: 'radio' as const,
      radio: r,
    }))
  }
  if (activeTab.value === 'subscribed') {
    return dj.subscribedRadios.map((r) => ({
      id: r.id,
      name: r.name,
      coverUrl: r.picUrl,
      subtitle: r.lastProgramName || `${r.programCount || 0} 期节目`,
      type: 'radio' as const,
      radio: r,
    }))
  }
  if (activeTab.value === 'toplist' && dj.toplist) {
    return dj.toplist.tracks.slice(0, 50).map((t) => ({
      id: t.program.id,
      name: t.program.name,
      coverUrl: t.program.coverUrl,
      subtitle: t.program.radio?.name || '',
      type: 'program' as const,
      program: t.program,
      rank: t.rank,
    }))
  }
  return []
})
</script>

<template>
  <div class="podcast-list">
    <div class="podcast-list__tabs">
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'recommend' }"
        @click="onTabChange('recommend')"
      >
        推荐
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'subscribed' }"
        @click="onTabChange('subscribed')"
      >
        订阅
      </button>
      <button
        class="tab-btn"
        :class="{ 'tab-btn--active': activeTab === 'toplist' }"
        @click="onTabChange('toplist')"
      >
        榜单
      </button>
    </div>

    <div
      v-if="activeTab === 'toplist'"
      class="podcast-list__toplist-types"
    >
      <button
        class="type-btn"
        :class="{ 'type-btn--active': toplistType === 'hot' }"
        @click="toplistType = 'hot'; dj.loadToplist('hot')"
      >
        热播
      </button>
      <button
        class="type-btn"
        :class="{ 'type-btn--active': toplistType === 'new' }"
        @click="toplistType = 'new'; dj.loadToplist('new')"
      >
        新晋
      </button>
      <button
        class="type-btn"
        :class="{ 'type-btn--active': toplistType === 'rising' }"
        @click="toplistType = 'rising'; dj.loadToplist('rising')"
      >
        上升
      </button>
    </div>

    <div class="podcast-list__content">
      <div
        v-if="(activeTab === 'recommend' && dj.loadingRecommend) ||
               (activeTab === 'subscribed' && dj.loadingSubscribed) ||
               (activeTab === 'toplist' && dj.loadingToplist)"
        class="loading-state"
      >
        加载中...
      </div>

      <div v-else-if="displayItems.length === 0" class="empty-state">
        暂无内容
      </div>

      <div v-else class="podcast-grid">
        <div
          v-for="item in displayItems"
          :key="item.id"
          class="podcast-card"
          @click="item.type === 'radio' ? selectRadio(item.radio) : selectProgram(item.program)"
        >
          <div class="podcast-card__cover">
            <img
              v-if="item.coverUrl"
              :src="item.coverUrl"
              :alt="item.name"
            />
            <div v-else class="podcast-card__cover-placeholder"></div>
            <div v-if="item.type === 'program' && 'rank' in item" class="podcast-card__rank">
              {{ item.rank }}
            </div>
          </div>
          <div class="podcast-card__info">
            <div class="podcast-card__name">{{ item.name }}</div>
            <div class="podcast-card__subtitle">{{ item.subtitle }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="dj.currentRadio" class="podcast-list__programs">
      <div class="programs-header">
        <h3>{{ dj.currentRadio.name }}</h3>
        <span class="programs-count">{{ dj.programListCount }} 期</span>
      </div>

      <div v-if="dj.loadingPrograms" class="loading-state">加载节目中...</div>

      <div v-else class="program-list">
        <div
          v-for="program in dj.programList"
          :key="program.id"
          class="program-item"
          @click="selectProgram(program)"
        >
          <div class="program-item__cover">
            <img
              v-if="program.coverUrl"
              :src="program.coverUrl"
              :alt="program.name"
            />
            <div v-else class="program-item__cover-placeholder"></div>
          </div>
          <div class="program-item__info">
            <div class="program-item__name">{{ program.name }}</div>
            <div class="program-item__meta">
              <span>{{ formatTime(program.duration / 1000) }}</span>
              <span v-if="program.playCount">
                {{ (program.playCount / 10000).toFixed(1) }}万播放
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="dj.programListHasMore && !dj.loadingPrograms"
        class="load-more"
        @click="dj.loadRadioPrograms(dj.currentRadio!.id, 30, dj.programList.length)"
      >
        加载更多
      </div>
    </div>
  </div>
</template>

<style scoped>
.podcast-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(15, 15, 20, 0.95);
  border-radius: 16px;
  overflow: hidden;
}

.podcast-list__tabs {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  padding: 6px 16px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.tab-btn--active {
  color: #fff;
  background: rgba(217, 91, 103, 0.25);
}

.podcast-list__toplist-types {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.type-btn {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.type-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
}

.type-btn--active {
  border-color: rgba(217, 91, 103, 0.5);
  background: rgba(217, 91, 103, 0.15);
  color: #fff;
}

.podcast-list__content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.podcast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.podcast-card {
  cursor: pointer;
  transition: transform 0.2s ease;
}

.podcast-card:hover {
  transform: translateY(-2px);
}

.podcast-card__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
}

.podcast-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.podcast-card__cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(100, 50, 150, 0.3));
}

.podcast-card__rank {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 22px;
  height: 22px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}

.podcast-card__info {
  margin-top: 8px;
  padding: 0 2px;
}

.podcast-card__name {
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.podcast-card__subtitle {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.podcast-list__programs {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  max-height: 40%;
  display: flex;
  flex-direction: column;
}

.programs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}

.programs-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.programs-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.program-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.program-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.program-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.program-item__cover {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.program-item__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.program-item__cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(217, 91, 103, 0.3), rgba(100, 50, 150, 0.3));
}

.program-item__info {
  flex: 1;
  min-width: 0;
}

.program-item__name {
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.program-item__meta {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 3px;
  display: flex;
  gap: 10px;
}

.load-more {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: color 0.2s ease;
}

.load-more:hover {
  color: #d95b67;
}
</style>
