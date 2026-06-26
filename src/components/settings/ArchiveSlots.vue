<script setup lang="ts">
import { ref } from 'vue'
import { useArchiveStore } from '@/stores/archive'
import type { ArchiveSlot } from '@/stores/archive'

const archive = useArchiveStore()

const renamingSlot = ref<number | null>(null)
const renameInput = ref('')

function handleSlotClick(index: number) {
  const slot = archive.slots[index]
  if (slot) {
    archive.loadFromSlot(index + 1)
  }
}

function handleSave(e: Event, index: number) {
  e.stopPropagation()
  archive.saveToSlot(index + 1)
}

function handleRename(e: Event, index: number) {
  e.stopPropagation()
  const slot = archive.slots[index]
  if (!slot) return
  renamingSlot.value = index
  renameInput.value = slot.name
}

function confirmRename(index: number) {
  if (renameInput.value.trim()) {
    archive.renameSlot(index + 1, renameInput.value.trim())
  }
  renamingSlot.value = null
  renameInput.value = ''
}

function handleDelete(e: Event, index: number) {
  e.stopPropagation()
  if (confirm('确定要删除这个存档吗？')) {
    archive.clearSlot(index + 1)
  }
}

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="archive-slots">
    <div class="section-title">视觉存档</div>
    <div class="archive-grid">
      <div
        v-for="(slot, index) in archive.slots"
        :key="index"
        class="archive-slot"
        :class="{ filled: slot !== null }"
        @click="handleSlotClick(index)"
      >
        <div
          v-if="slot"
          class="slot-thumbnail"
          :style="{ background: `linear-gradient(135deg, ${slot.highlightColor}, ${slot.glowColor})` }"
        >
          <div class="slot-preset-icon">🎨</div>
        </div>
        <div v-else class="slot-empty">
          <div class="slot-plus">+</div>
        </div>

        <div class="slot-info">
          <div v-if="renamingSlot === index" class="rename-form" @click.stop>
            <input
              v-model="renameInput"
              type="text"
              class="rename-input"
              @keyup.enter="confirmRename(index)"
              @blur="confirmRename(index)"
              autofocus
            />
          </div>
          <template v-else>
            <div class="slot-name">{{ slot?.name || '空槽位' }}</div>
            <div v-if="slot" class="slot-meta">
              {{ formatDate(slot.updatedAt) }}
            </div>
          </template>
        </div>

        <div class="slot-actions" @click.stop>
          <button
            class="slot-action-btn save-btn"
            :title="slot ? '覆盖保存' : '保存到槽位'"
            @click="handleSave($event, index)"
          >
            💾
          </button>
          <template v-if="slot">
            <button
              class="slot-action-btn rename-btn"
              title="重命名"
              @click="handleRename($event, index)"
            >
              ✏️
            </button>
            <button
              class="slot-action-btn delete-btn"
              title="删除"
              @click="handleDelete($event, index)"
            >
              🗑️
            </button>
          </template>
        </div>
      </div>
    </div>
    <div class="archive-hint">点击存档直接应用，悬停显示操作按钮</div>
  </div>
</template>

<style scoped>
.archive-slots {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.archive-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.archive-slot {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-input-bg);
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}

.archive-slot:hover {
  border-color: var(--color-text-muted);
  transform: translateY(-1px);
}

.archive-slot.filled:hover {
  border-color: rgba(217, 91, 103, 0.5);
}

.slot-thumbnail {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.slot-preset-icon {
  font-size: 24px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.slot-empty {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
}

.slot-plus {
  font-size: 28px;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.archive-slot:hover .slot-plus {
  opacity: 0.8;
}

.slot-info {
  padding: 8px 10px;
}

.slot-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-meta {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.rename-form {
  width: 100%;
}

.rename-input {
  width: 100%;
  padding: 3px 6px;
  font-size: 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-text);
  outline: none;
  box-sizing: border-box;
}

.slot-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.archive-slot:hover .slot-actions {
  opacity: 1;
}

.slot-action-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  backdrop-filter: blur(8px);
}

.slot-action-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.delete-btn:hover {
  background: rgba(220, 53, 69, 0.8);
}

.archive-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 8px;
  text-align: center;
}
</style>
