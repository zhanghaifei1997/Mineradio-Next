<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { providerManager } from '@/modules/providers'
import type { MusicSource } from '@/types'

const user = useUserStore()
const menuRef = ref<HTMLElement | null>(null)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openLogin'): void
  (e: 'openRecent'): void
}>()

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function handleMenuItem(action: string) {
  switch (action) {
    case 'recent':
      emit('openRecent')
      break
    case 'playlists':
      user.fetchAllUserPlaylists()
      break
    case 'liked':
      if (user.neteaseAccount.loggedIn) {
        user.fetchLikedSongs('netease')
      }
      break
    case 'addAccount':
      emit('openLogin')
      emit('close')
      break
    case 'logout':
      user.logoutAll()
      emit('close')
      break
  }
  emit('close')
}

async function handleLogoutSource(source: MusicSource) {
  try {
    const provider = providerManager.get(source)
    if (provider) {
      await provider.logout()
    }
  } catch (_) {}
  user.logout(source)
  emit('close')
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<template>
  <div class="user-menu" ref="menuRef" @click.stop>
    <div class="user-menu__header" v-if="user.primaryProfile">
      <div class="user-menu__profile">
        <img
          v-if="user.primaryProfile.avatarUrl"
          :src="user.primaryProfile.avatarUrl"
          class="user-menu__avatar"
          alt="avatar"
        />
        <div v-else class="user-menu__avatar-placeholder">
          {{ user.primaryProfile.nickname?.[0] || 'U' }}
        </div>
        <div class="user-menu__info">
          <div class="user-menu__nickname">{{ user.primaryProfile.nickname }}</div>
          <div class="user-menu__accounts">
            <span
              class="source-dot"
              :class="{ 'source-dot--active': user.neteaseAccount.loggedIn }"
              title="网易云音乐"
            ></span>
            <span
              class="source-dot source-dot--qq"
              :class="{ 'source-dot--active': user.qqmusicAccount.loggedIn }"
              title="QQ 音乐"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <div class="user-menu__divider"></div>

    <div class="user-menu__section" v-if="user.neteaseAccount.loggedIn">
      <div class="user-menu__section-title">网易云音乐</div>
      <button class="user-menu__item" @click="handleMenuItem('playlists')">
        <span class="user-menu__item-icon">📋</span>
        <span class="user-menu__item-text">我的歌单</span>
      </button>
      <button class="user-menu__item" @click="handleMenuItem('liked')">
        <span class="user-menu__item-icon">❤️</span>
        <span class="user-menu__item-text">我喜欢的音乐</span>
      </button>
      <button class="user-menu__item" @click="handleMenuItem('daily')">
        <span class="user-menu__item-icon">📅</span>
        <span class="user-menu__item-text">每日推荐</span>
      </button>
      <button class="user-menu__item" @click="handleMenuItem('fm')">
        <span class="user-menu__item-icon">📻</span>
        <span class="user-menu__item-text">私人 FM</span>
      </button>
    </div>

    <div class="user-menu__divider" v-if="user.neteaseAccount.loggedIn && user.qqmusicAccount.loggedIn"></div>

    <div class="user-menu__section" v-if="user.qqmusicAccount.loggedIn">
      <div class="user-menu__section-title">QQ 音乐</div>
      <button class="user-menu__item" @click="handleMenuItem('qq-playlists')">
        <span class="user-menu__item-icon">📋</span>
        <span class="user-menu__item-text">我的歌单</span>
      </button>
      <button class="user-menu__item" @click="handleMenuItem('qq-liked')">
        <span class="user-menu__item-icon">❤️</span>
        <span class="user-menu__item-text">我喜欢</span>
      </button>
    </div>

    <div class="user-menu__divider"></div>

    <div class="user-menu__section">
      <button class="user-menu__item" @click="handleMenuItem('recent')">
        <span class="user-menu__item-icon">⏰</span>
        <span class="user-menu__item-text">最近播放</span>
      </button>

      <button
        class="user-menu__item user-menu__item--secondary"
        @click="handleMenuItem('addAccount')"
      >
        <span class="user-menu__item-icon">➕</span>
        <span class="user-menu__item-text">添加账号</span>
      </button>

      <div v-if="user.hasMultipleAccounts" class="user-menu__logout-group">
        <button
          class="user-menu__item user-menu__item--danger"
          @click="handleLogoutSource('netease')"
        >
          <span class="user-menu__item-icon">🚪</span>
          <span class="user-menu__item-text">退出网易云</span>
        </button>
        <button
          class="user-menu__item user-menu__item--danger"
          @click="handleLogoutSource('qqmusic')"
        >
          <span class="user-menu__item-icon">🚪</span>
          <span class="user-menu__item-text">退出 QQ 音乐</span>
        </button>
      </div>

      <button
        class="user-menu__item user-menu__item--danger"
        v-else
        @click="handleMenuItem('logout')"
      >
        <span class="user-menu__item-icon">🚪</span>
        <span class="user-menu__item-text">退出登录</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: rgba(15, 15, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.04);
  z-index: 200;
  animation: menuFadeIn 0.2s ease;
}

@keyframes menuFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.user-menu__header {
  padding: 12px;
}

.user-menu__profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-menu__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.1);
}

.user-menu__avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f4d28a, #d95b67);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #201303;
}

.user-menu__info {
  flex: 1;
  min-width: 0;
}

.user-menu__nickname {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-menu__accounts {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.source-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: all 0.2s;
}

.source-dot--active {
  background: #d95b67;
  box-shadow: 0 0 8px rgba(217, 91, 103, 0.5);
}

.source-dot--qq.source-dot--active {
  background: #00f5d4;
  box-shadow: 0 0 8px rgba(0, 245, 212, 0.5);
}

.user-menu__divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 4px 8px;
}

.user-menu__section {
  padding: 4px;
}

.user-menu__section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.4);
  padding: 8px 12px 4px;
}

.user-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.15s ease;
  text-align: left;
}

.user-menu__item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.user-menu__item--secondary:hover {
  background: rgba(244, 210, 138, 0.1);
}

.user-menu__item--danger {
  color: rgba(255, 100, 100, 0.8);
}

.user-menu__item--danger:hover {
  background: rgba(255, 80, 80, 0.12);
  color: #ff6b6b;
}

.user-menu__item-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.user-menu__item-text {
  flex: 1;
}

.user-menu__logout-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
