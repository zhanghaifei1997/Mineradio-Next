<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useImmersiveStore } from '@/stores/immersive'
import { useFxStore } from '@/stores/fx'
import IconUpload from '@/components/icons/IconUpload.vue'

const player = usePlayerStore()
const immersive = useImmersiveStore()
const fx = useFxStore()

const UPLOAD_TIP_KEY = 'mineradio-upload-tip-seen'
const tipVisible = ref(false)
const hasCustomCover = ref(false) // TODO: connect to custom cover system
let tipTimer: ReturnType<typeof setTimeout> | null = null

function uploadTipWasSeen(): boolean {
  try { return localStorage.getItem(UPLOAD_TIP_KEY) === '1' } catch { return true }
}

function markUploadTipSeen(): void {
  try { localStorage.setItem(UPLOAD_TIP_KEY, '1') } catch {}
}

function closeUploadTip(manual: boolean) {
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = null }
  if (manual) markUploadTipSeen()
  tipVisible.value = false
}

function maybeShowUploadTipOnce() {
  if (!fx.layoutMode === 'diy') return
  if (uploadTipWasSeen()) return
  if (immersive.isImmersive) {
    setTimeout(maybeShowUploadTipOnce, 1800)
    return
  }
  markUploadTipSeen()
  tipVisible.value = true
  tipTimer = setTimeout(() => {
    tipTimer = null
    closeUploadTip(false)
  }, 6800)
}

function triggerFileInput() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.mp3,.flac,.wav,.ogg,.m4a,.jpg,.jpeg,.png,.webp'
  input.multiple = true
  input.style.display = 'none'
  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files || files.length === 0) return
    // TODO: connect to local music / custom cover handler
    console.log('Upload files:', files)
  }
  document.body.appendChild(input)
  input.click()
  document.body.removeChild(input)
}

function clearCustomCover() {
  // TODO: connect to custom cover system
  hasCustomCover.value = false
}

onMounted(() => {
  setTimeout(maybeShowUploadTipOnce, 3000)
})

onUnmounted(() => {
  if (tipTimer) { clearTimeout(tipTimer); tipTimer = null }
})
</script>

<template>
  <div class="upload-actions" v-if="!immersive.isImmersive">
    <button
      id="upload-btn"
      class="icon-btn upload-btn"
      @click="triggerFileInput"
      title="导入音乐或封面"
    >
      <IconUpload :size="18" />
    </button>
    <button
      v-if="hasCustomCover"
      id="clear-cover-btn"
      class="clear-cover-btn has-cover"
      @click="clearCustomCover"
      title="取消自定义封面"
    >
      x
    </button>
    <Transition name="tip-pop">
      <div v-if="tipVisible" class="upload-tip">
        <button class="upload-tip-close" @click="closeUploadTip(true)">x</button>
        <span class="upload-tip-title">导入入口</span>
        这里支持上传歌曲，也可以给当前曲目换自定义封面。
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.upload-actions {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 58px;
}

.upload-btn {
  border-color: rgba(0, 245, 212, 0.24) !important;
  background: rgba(255, 255, 255, 0.045) !important;
  color: rgba(232, 236, 239, 0.78) !important;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
}

.upload-btn:hover {
  border-color: rgba(0, 245, 212, 0.50) !important;
  background: rgba(0, 245, 212, 0.075) !important;
  color: #fff !important;
  box-shadow: 0 16px 46px rgba(0, 245, 212, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.10) !important;
}

.clear-cover-btn {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.34);
  font-size: 18px;
  line-height: 1;
  transform: scale(0.92);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.20);
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  transition: all 0.2s;
}

.clear-cover-btn.has-cover {
  border-color: rgba(244, 210, 138, 0.30);
  background: rgba(244, 210, 138, 0.08);
  color: rgba(244, 210, 138, 0.84);
}

.clear-cover-btn:hover {
  color: #fff0bf;
  border-color: rgba(244, 210, 138, 0.55);
  background: rgba(244, 210, 138, 0.14);
  transform: scale(1.02);
}

.upload-tip {
  position: absolute;
  z-index: 3;
  left: 46px;
  top: 56px;
  width: 214px;
  padding: 13px 34px 13px 14px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(24, 23, 26, 0.96), rgba(10, 10, 14, 0.93));
  border: 1px solid rgba(244, 210, 138, 0.24);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.44),
    0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.70);
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.25px;
}

.upload-tip::before {
  content: "";
  position: absolute;
  left: 18px;
  top: -6px;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  background: rgba(24, 23, 26, 0.96);
  border-left: 1px solid rgba(244, 210, 138, 0.22);
  border-top: 1px solid rgba(244, 210, 138, 0.22);
}

.upload-tip-title {
  display: block;
  color: #fff0bf;
  font-weight: 700;
  margin-bottom: 2px;
}

.upload-tip-close {
  position: absolute;
  right: 9px;
  top: 8px;
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.38);
  cursor: pointer;
  font-size: 15px;
  line-height: 18px;
  padding: 0;
  font-family: inherit;
}

.upload-tip-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.tip-pop-enter-active {
  transition: all 0.62s cubic-bezier(0.16, 1, 0.3, 1);
}

.tip-pop-leave-active {
  transition: all 0.24s cubic-bezier(0.5, 0, 0.7, 1);
}

.tip-pop-enter-from {
  opacity: 0;
  transform: translateY(-10px) scale(0.975);
}

.tip-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}
</style>
