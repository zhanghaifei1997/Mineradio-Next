<script setup lang="ts">
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFxStore } from '@/stores/fx'
import UserMenu from './UserMenu.vue'
import LoginParticles from './LoginParticles.vue'

const user = useUserStore()
const fx = useFxStore()
const showMenu = ref(false)
const showParticles = ref(false)
const particlesRef = ref<InstanceType<typeof LoginParticles> | null>(null)

const hasVip = computed(() => {
  const profile = user.primaryProfile
  if (!profile) return false
  return !!profile.vipType && profile.vipType > 0
})

const isSvip = computed(() => {
  const profile = user.primaryProfile
  if (!profile) return false
  return profile.isSvip || (profile.vipType !== undefined && profile.vipType >= 10)
})

const vipLabel = computed(() => {
  if (isSvip.value) return 'SVIP'
  if (hasVip.value) return 'VIP'
  return ''
})

function handleClick() {
  if (user.isLoggedIn) {
    showMenu.value = !showMenu.value
  } else {
    runLoginGuideParticles()
  }
}

function closeMenu() {
  showMenu.value = false
}

function toggleAutoHide(e: MouseEvent) {
  e.stopPropagation()
  fx.userCapsuleAutoHide = !fx.userCapsuleAutoHide
}

function runLoginGuideParticles() {
  showParticles.value = true
  if (particlesRef.value) {
    particlesRef.value.startAnimation()
  }
}

function handleParticlesComplete() {
  showParticles.value = false
  emit('openLogin')
}

const emit = defineEmits<{
  (e: 'openLogin'): void
  (e: 'openRecent'): void
}>()

defineExpose({
  runLoginGuideParticles,
})
</script>

<template>
  <div class="user-capsule-wrapper">
    <button
      class="user-capsule__hide-btn"
      @click="toggleAutoHide"
      :title="fx.userCapsuleAutoHide ? '取消自动隐藏' : '自动隐藏'"
    >
      {{ fx.userCapsuleAutoHide ? '›' : '‹' }}
    </button>
    <button
      class="user-capsule"
      :class="{
        'user-capsule--logged-out': !user.isLoggedIn,
        'user-capsule--logged-in': user.isLoggedIn,
        'user-capsule--multi': user.hasMultipleAccounts,
      }"
      @click="handleClick"
    >
      <LoginParticles
        ref="particlesRef"
        :active="showParticles"
        @complete="handleParticlesComplete"
      />
      <template v-if="!user.isLoggedIn">
        <span class="user-capsule__login-text">登录</span>
      </template>

      <template v-else>
        <img
          v-if="user.primaryProfile?.avatarUrl"
          :src="user.primaryProfile.avatarUrl"
          class="user-capsule__avatar"
          alt="avatar"
        />
        <div v-else class="user-capsule__avatar-placeholder">
          {{ user.primaryProfile?.nickname?.[0] || 'U' }}
        </div>

        <div class="user-capsule__info" v-if="!user.hasMultipleAccounts">
          <div class="user-capsule__nickname">
            {{ user.primaryProfile?.nickname }}
            <span v-if="hasVip" class="vip-tag" :class="{ 'vip-tag--svip': isSvip }">
              {{ vipLabel }}
            </span>
          </div>
        </div>

        <div v-if="user.hasMultipleAccounts" class="user-capsule__multi">
          <img
            v-if="user.neteaseAccount.profile?.avatarUrl"
            :src="user.neteaseAccount.profile.avatarUrl"
            class="user-capsule__mini-avatar"
            alt="netease"
          />
          <img
            v-if="user.qqmusicAccount.profile?.avatarUrl"
            :src="user.qqmusicAccount.profile.avatarUrl"
            class="user-capsule__mini-avatar user-capsule__mini-avatar--second"
            alt="qqmusic"
          />
        </div>
      </template>
    </button>

    <UserMenu v-if="showMenu && user.isLoggedIn" @close="closeMenu" @openLogin="emit('openLogin')" @openRecent="emit('openRecent')" />
  </div>
</template>

<style scoped>
.user-capsule-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  transition: transform 0.3s ease;
}

.user-capsule__hide-btn {
  position: absolute;
  left: -24px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0);
  font-size: 18px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
  padding: 0;
  z-index: 1;
}

.user-capsule-wrapper:hover .user-capsule__hide-btn {
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
}

.user-capsule__hide-btn:hover {
  color: #fff !important;
  background: rgba(255, 255, 255, 0.15) !important;
}

:global(body.user-capsule-auto-hide:not(.user-capsule-peek)) .user-capsule-wrapper {
  transform: translateX(calc(100% + 40px));
}

.user-capsule {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 16px;
  border-radius: 22px;
  border: 1px solid rgba(244, 210, 138, 0.28);
  background: rgba(255, 255, 255, 0.045);
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.4px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  overflow: visible;
}

.user-capsule:hover {
  border-color: rgba(244, 210, 138, 0.56);
  background: rgba(244, 210, 138, 0.11);
  color: #fff2bd;
  box-shadow: 0 14px 42px rgba(244, 210, 138, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.user-capsule--logged-in {
  padding: 0 16px 0 4px;
  color: #fff;
  border-color: rgba(244, 210, 138, 0.52);
  background: rgba(244, 210, 138, 0.07);
  box-shadow: 0 0 0 1px rgba(244, 210, 138, 0.08),
    0 14px 42px rgba(0, 0, 0, 0.28);
}

.user-capsule--logged-in:hover {
  background: rgba(244, 210, 138, 0.12);
  transform: translateY(-1px);
}

.user-capsule--multi {
  padding: 0;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  border: none;
  background: transparent;
  box-shadow: none;
}

.user-capsule--multi:hover {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  transform: none;
}

.user-capsule__login-text {
  display: block;
  line-height: 1;
  transform: translateY(0.5px);
}

.user-capsule__avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.1);
}

.user-capsule__avatar-placeholder {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f4d28a, #d95b67);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #201303;
}

.user-capsule__info {
  min-width: 0;
}

.user-capsule__nickname {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.vip-tag {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  background: linear-gradient(135deg, #fff3c2, #f4d28a, #c9963d);
  color: #201303;
  font-weight: 800;
  letter-spacing: 0.5px;
  box-shadow: 0 0 12px rgba(244, 210, 138, 0.24);
  flex-shrink: 0;
}

.vip-tag--svip {
  background: linear-gradient(135deg, #e7fff9, #00f5d4, #61a8ff);
  color: #03100f;
  box-shadow: 0 0 12px rgba(0, 245, 212, 0.22);
}

.user-capsule__multi {
  position: relative;
  width: 44px;
  height: 44px;
}

.user-capsule__mini-avatar {
  position: absolute;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid rgba(15, 15, 20, 0.85);
  object-fit: cover;
}

.user-capsule__mini-avatar--second {
  right: 0;
  bottom: 0;
  z-index: 2;
}
</style>
