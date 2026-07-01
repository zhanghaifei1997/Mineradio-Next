<template>
  <div class="modal-mask" @click.self="$emit('close')">
    <div class="modal dual-user-modal">
      <h2>账号信息</h2>

      <!-- 平台标签 -->
      <div class="login-platform-tabs">
        <button
          :class="{ active: activeProvider === 'netease', netease: true }"
          @click="activeProvider = 'netease'"
        >网易云</button>
        <button
          :class="{ active: activeProvider === 'qq', qq: true }"
          @click="activeProvider = 'qq'"
        >QQ 音乐</button>
      </div>

      <!-- 网易云信息 -->
      <template v-if="activeProvider === 'netease'">
        <img
          v-if="account.netease.avatar"
          :src="account.netease.avatar"
          style="width:72px;height:72px;border-radius:50%;margin:0 auto 12px;object-fit:cover;display:block"
        >
        <div style="font-size:15px;margin-bottom:4px">{{ account.netease.nickname ?? '网易云用户' }}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:20px;letter-spacing:.5px">{{ account.netease.vipLabel }}</div>
      </template>

      <!-- QQ 信息 -->
      <template v-else>
        <img
          v-if="account.qq.avatar"
          :src="account.qq.avatar"
          style="width:72px;height:72px;border-radius:50%;margin:0 auto 12px;object-fit:cover;display:block"
        >
        <div style="font-size:15px;margin-bottom:4px">{{ account.qq.nickname }}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:20px">QQ 音乐</div>
      </template>

      <div class="btn-row">
        <button class="modal-btn" @click="$emit('close')">关闭</button>
        <button class="modal-btn primary" @click="logout">退出登录</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAccountStore } from '@/stores/account'
import { netease } from '@/services/netease'
import { qq } from '@/services/qq'

const emit = defineEmits<{ close: [] }>()
const account = useAccountStore()
const activeProvider = ref<'netease' | 'qq'>('netease')

async function logout() {
  if (activeProvider.value === 'netease') {
    await netease.logout()
    account.clearNetease()
  } else {
    await qq.logout()
    account.clearQQ()
  }
  emit('close')
}
</script>
