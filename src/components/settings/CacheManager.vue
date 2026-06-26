<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCacheStore } from '@/stores/cache'
import type { CacheCategory } from '@/stores/cache'

const cache = useCacheStore()

const isClearing = ref(false)
const clearingCategory = ref<CacheCategory | 'all' | null>(null)

const cacheCategories = [
  { id: 'songs' as CacheCategory, name: '歌曲缓存', icon: '🎵' },
  { id: 'lyrics' as CacheCategory, name: '歌词缓存', icon: '📝' },
  { id: 'images' as CacheCategory, name: '图片缓存', icon: '🖼️' },
  { id: 'other' as CacheCategory, name: '其他缓存', icon: '📦' },
]

const maxSizeOptions = [
  { value: 500 * 1024 * 1024, label: '500 MB' },
  { value: 1 * 1024 * 1024 * 1024, label: '1 GB' },
  { value: 2 * 1024 * 1024 * 1024, label: '2 GB' },
  { value: 5 * 1024 * 1024 * 1024, label: '5 GB' },
  { value: 10 * 1024 * 1024 * 1024, label: '10 GB' },
]

async function clearCache(category: CacheCategory | 'all') {
  if (isClearing.value) return

  isClearing.value = true
  clearingCategory.value = category

  try {
    if (category === 'all') {
      await cache.clearCache()
    } else {
      await cache.clearCache(category)
    }
  } finally {
    isClearing.value = false
    clearingCategory.value = null
  }
}

function getCategorySize(category: CacheCategory): number {
  return cache.cacheStats[category] || 0
}

function getUsagePercent(): number {
  if (cache.settings.maxSize === 0) return 0
  return Math.min(100, (cache.totalCacheSize / cache.settings.maxSize) * 100)
}

onMounted(() => {
  cache.getCacheSize()
})
</script>

<template>
  <div class="cache-manager">
    <div class="cache-overview">
      <div class="overview-header">
        <span class="overview-label">缓存使用情况</span>
        <span class="overview-size">{{ cache.formatSize(cache.totalCacheSize) }} / {{ cache.formatSize(cache.settings.maxSize) }}</span>
      </div>
      <div class="usage-bar">
        <div class="usage-bar__fill" :style="{ width: getUsagePercent() + '%' }"></div>
      </div>
    </div>

    <div class="cache-categories">
      <div
        v-for="cat in cacheCategories"
        :key="cat.id"
        class="cache-category"
      >
        <div class="category-info">
          <span class="category-icon">{{ cat.icon }}</span>
          <span class="category-name">{{ cat.name }}</span>
        </div>
        <div class="category-right">
          <span class="category-size">{{ cache.formatSize(getCategorySize(cat.id)) }}</span>
          <button
            class="clear-btn"
            :disabled="isClearing && clearingCategory === cat.id"
            @click="clearCache(cat.id)"
          >
            {{ isClearing && clearingCategory === cat.id ? '清理中...' : '清理' }}
          </button>
        </div>
      </div>
    </div>

    <div class="cache-actions">
      <button
        class="clear-all-btn"
        :disabled="isClearing && clearingCategory === 'all'"
        @click="clearCache('all')"
      >
        {{ isClearing && clearingCategory === 'all' ? '清理中...' : '一键清理全部缓存' }}
      </button>
    </div>

    <div class="settings-section">
      <div class="section-title">缓存设置</div>

      <div class="setting-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="cache.settings.autoCache"
            @change="cache.setAutoCache(($event.target as HTMLInputElement).checked)"
          />
          <span>自动缓存已播放歌曲</span>
        </label>
      </div>

      <div class="setting-row">
        <label class="checkbox-label">
          <input
            type="checkbox"
            :checked="cache.settings.wifiOnly"
            @change="cache.setWifiOnly(($event.target as HTMLInputElement).checked)"
          />
          <span>仅在 WiFi 下缓存</span>
        </label>
      </div>

      <div class="setting-row">
        <label>最大缓存大小</label>
        <div class="segmented">
          <button
            v-for="opt in maxSizeOptions"
            :key="opt.value"
            class="seg-btn"
            :class="{ active: cache.settings.maxSize === opt.value }"
            @click="cache.setMaxSize(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="setting-row">
        <label>缓存策略</label>
        <div class="segmented">
          <button
            class="seg-btn"
            :class="{ active: cache.settings.strategy === 'lru' }"
            @click="cache.setStrategy('lru')"
          >
            最近最少使用
          </button>
          <button
            class="seg-btn"
            :class="{ active: cache.settings.strategy === 'fifo' }"
            @click="cache.setStrategy('fifo')"
          >
            先进先出
          </button>
        </div>
      </div>
    </div>

    <div v-if="!cache.isElectronEnv" class="browser-hint">
      <span class="hint-icon">💡</span>
      <span class="hint-text">浏览器环境下使用 IndexedDB 缓存，部分功能受限</span>
    </div>
  </div>
</template>

<style scoped>
.cache-manager {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cache-overview {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.overview-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.overview-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
}

.usage-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.usage-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #d95b67, #f0a0a0);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.cache-categories {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cache-category {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.category-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-icon {
  font-size: 18px;
}

.category-name {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.category-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-size {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-variant-numeric: tabular-nums;
  min-width: 70px;
  text-align: right;
}

.clear-btn {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover:not(:disabled) {
  border-color: rgba(217, 91, 103, 0.4);
  color: #d95b67;
  background: rgba(217, 91, 103, 0.08);
}

.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cache-actions {
  display: flex;
  justify-content: center;
}

.clear-all-btn {
  padding: 10px 24px;
  border: 1px solid rgba(217, 91, 103, 0.4);
  border-radius: 20px;
  background: rgba(217, 91, 103, 0.1);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-all-btn:hover:not(:disabled) {
  background: rgba(217, 91, 103, 0.2);
  border-color: rgba(217, 91, 103, 0.6);
}

.clear-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-section {
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-row > label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  user-select: none;
}

.checkbox-label input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #d95b67;
  cursor: pointer;
}

.segmented {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 2px;
  flex-wrap: wrap;
  gap: 2px;
}

.seg-btn {
  flex: 1;
  min-width: 60px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.seg-btn:hover {
  color: rgba(255, 255, 255, 0.8);
}

.seg-btn.active {
  background: rgba(217, 91, 103, 0.8);
  color: #fff;
}

.browser-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(250, 200, 80, 0.08);
  border: 1px solid rgba(250, 200, 80, 0.15);
  border-radius: 8px;
}

.hint-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.hint-text {
  font-size: 11px;
  color: rgba(250, 200, 80, 0.7);
  line-height: 1.5;
}
</style>
