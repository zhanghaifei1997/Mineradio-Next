<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CoverCropper from './CoverCropper.vue'
import { useCustomCoverStore } from '@/stores/customCover'

const props = defineProps<{
  coverId: string
  defaultCoverUrl?: string
}>()

const emit = defineEmits<{
  (e: 'change', dataUrl: string): void
}>()

const customCoverStore = useCustomCoverStore()

const showUploader = ref(false)
const showCropper = ref(false)
const selectedImage = ref('')
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const showUploadTip = ref(false)

const TIP_STORAGE_KEY = 'mineradio-upload-tip-seen'
const TIP_STORAGE_KEY_LEGACY = 'mineradio_cover_upload_tip_shown'

function checkShouldShowTip() {
  try {
    let shown = localStorage.getItem(TIP_STORAGE_KEY)
    if (shown === null) {
      const legacy = localStorage.getItem(TIP_STORAGE_KEY_LEGACY)
      if (legacy !== null) {
        // 迁移旧数据到新键名
        localStorage.setItem(TIP_STORAGE_KEY, legacy)
        try {
          localStorage.removeItem(TIP_STORAGE_KEY_LEGACY)
        } catch (_) {}
        shown = legacy
      }
    }
    if (!shown) {
      showUploadTip.value = true
    }
  } catch (_) {}
}

function closeUploadTip() {
  showUploadTip.value = false
  try {
    localStorage.setItem(TIP_STORAGE_KEY, 'true')
  } catch (_) {}
}

onMounted(() => {
  checkShouldShowTip()
})

const currentCover = computed(() => {
  const custom = customCoverStore.getCustomCover(props.coverId)
  return custom || props.defaultCoverUrl || ''
})

const hasCustomCover = computed(() => {
  return customCoverStore.hasCustomCover(props.coverId)
})

function openUploader() {
  showUploader.value = true
}

function closeUploader() {
  showUploader.value = false
  selectedImage.value = ''
  showCropper.value = false
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    processFile(file)
  }
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    processFile(file)
  }
}

function processFile(file: File) {
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    selectedImage.value = e.target?.result as string
    showCropper.value = true
  }
  reader.readAsDataURL(file)
}

function handleCropConfirm(dataUrl: string) {
  customCoverStore.setCustomCover(props.coverId, dataUrl)
  emit('change', dataUrl)
  closeUploader()
}

function handleCropCancel() {
  showCropper.value = false
  selectedImage.value = ''
}

function removeCustomCover() {
  customCoverStore.removeCustomCover(props.coverId)
  emit('change', '')
}
</script>

<template>
  <div class="cover-uploader">
    <div class="cover-uploader__trigger" @click="openUploader">
      <slot :cover="currentCover" :has-custom="hasCustomCover">
        <div class="cover-uploader__default-cover">
          <img v-if="currentCover" :src="currentCover" alt="cover" />
          <div v-else class="cover-uploader__placeholder">
            <span>🎵</span>
          </div>
          <div class="cover-uploader__overlay">
            <span>更换封面</span>
          </div>
        </div>
      </slot>
    </div>

    <Transition name="tip-fade">
      <div v-if="showUploadTip" class="upload-tip-bubble">
        <div class="upload-tip-bubble__arrow"></div>
        <button class="upload-tip-bubble__close" @click="closeUploadTip" title="关闭">✕</button>
        <div class="upload-tip-bubble__title">上传封面提示</div>
        <div class="upload-tip-bubble__content">
          <p>支持 JPG, PNG, WebP, GIF 格式</p>
          <p>建议使用正方形图片，效果更佳</p>
          <p>图片大小不超过 5MB</p>
        </div>
      </div>
    </Transition>
    
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showUploader" class="cover-uploader__modal" @click.self="closeUploader">
          <div class="cover-uploader__modal-content">
            <div class="cover-uploader__header">
              <h3>更换封面</h3>
              <button class="cover-uploader__close" @click="closeUploader">✕</button>
            </div>
            
            <template v-if="!showCropper">
              <div
                class="cover-uploader__drop-zone"
                :class="{ 'is-dragging': isDragging }"
                @click="triggerFileInput"
                @dragover="handleDragOver"
                @dragleave="handleDragLeave"
                @drop="handleDrop"
              >
                <div class="cover-uploader__drop-icon">📤</div>
                <div class="cover-uploader__drop-text">点击或拖拽图片到这里</div>
                <div class="cover-uploader__drop-hint">支持 JPG, PNG, WebP, GIF</div>
              </div>
              
              <input
                ref="fileInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style="display: none"
                @change="handleFileSelect"
              />
              
              <div v-if="hasCustomCover" class="cover-uploader__actions">
                <button class="cover-uploader__remove-btn" @click="removeCustomCover">
                  恢复默认封面
                </button>
              </div>
            </template>
            
            <template v-else>
              <CoverCropper
                :image-url="selectedImage"
                :aspect-ratio="1"
                :output-size="512"
                @confirm="handleCropConfirm"
                @cancel="handleCropCancel"
              />
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.cover-uploader {
  position: relative;
  display: inline-block;
}

.cover-uploader__trigger {
  cursor: pointer;
}

.upload-tip-bubble {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 12px;
  width: 240px;
  padding: 16px;
  background: rgba(20, 20, 28, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.upload-tip-bubble__arrow {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 14px;
  height: 14px;
  background: rgba(20, 20, 28, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.upload-tip-bubble__close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.upload-tip-bubble__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.upload-tip-bubble__title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 10px;
  padding-right: 24px;
}

.upload-tip-bubble__content {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.6;
}

.upload-tip-bubble__content p {
  margin: 0 0 4px;
}

.upload-tip-bubble__content p:last-child {
  margin-bottom: 0;
}

.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}

.cover-uploader__default-cover {
  position: relative;
  width: 100%;
  height: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.cover-uploader__default-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-uploader__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  font-size: 48px;
}

.cover-uploader__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.cover-uploader__default-cover:hover .cover-uploader__overlay {
  opacity: 1;
}

.cover-uploader__modal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.cover-uploader__modal-content {
  width: 90%;
  max-width: 480px;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.cover-uploader__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border);
}

.cover-uploader__header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.cover-uploader__close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 18px;
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.cover-uploader__close:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.cover-uploader__drop-zone {
  margin: 24px;
  padding: 48px 24px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cover-uploader__drop-zone:hover,
.cover-uploader__drop-zone.is-dragging {
  border-color: var(--color-accent);
  background: rgba(217, 91, 103, 0.05);
}

.cover-uploader__drop-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.cover-uploader__drop-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.cover-uploader__drop-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.cover-uploader__actions {
  padding: 0 24px 24px;
  text-align: center;
}

.cover-uploader__remove-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.cover-uploader__remove-btn:hover {
  color: #ff5252;
  background: rgba(255, 82, 82, 0.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
