<script setup lang="ts">
import { useRouter } from 'vue-router'
import SplashScreen from '@/components/common/SplashScreen.vue'
import { useAppStartup } from '@/composables/useAppStartup'

const router = useRouter()
const appStartup = useAppStartup()

function handleSplashEnter() {
  appStartup.handleSplashEnter()
  router.replace('/')
}
</script>

<template>
  <SplashScreen
    :show-dont-show-again="true"
    @enter="handleSplashEnter"
  />
</template>
