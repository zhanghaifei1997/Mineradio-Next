<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Comment, CommentList } from '@/types'
import { useUserStore } from '@/stores/user'
import { providerManager } from '@/modules/providers'

const props = defineProps<{
  songId: string | null
  source: string
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const userStore = useUserStore()

const loading = ref(false)
const loadingMore = ref(false)
const commentData = ref<CommentList | null>(null)
const activeTab = ref<'hot' | 'new'>('hot')
const newComment = ref('')
const sendLoading = ref(false)
const currentPage = ref(1)
const commentsContainer = ref<HTMLElement | null>(null)

const likedMap = ref<Map<string, boolean>>(new Map())
const likeLoadingMap = ref<Map<string, boolean>>(new Map())

function getProvider() {
  return providerManager.get(props.source) || providerManager.default
}

async function loadComments() {
  if (!props.songId) return
  loading.value = true
  currentPage.value = 1
  try {
    const provider = getProvider()
    const data = await provider.getSongComments(props.songId, 1, 20, activeTab.value)
    commentData.value = data
    if (data?.comments) {
      const newMap = new Map<string, boolean>()
      data.comments.forEach((c) => {
        if (c.liked) newMap.set(c.id, true)
      })
      if (data.hotComments) {
        data.hotComments.forEach((c) => {
          if (c.liked) newMap.set(c.id, true)
        })
      }
      likedMap.value = newMap
    }
  } catch (e) {
    console.error('Load comments error:', e)
  } finally {
    loading.value = false
  }
}

async function loadMoreComments() {
  if (!props.songId || loadingMore.value || !commentData.value?.hasMore) return
  loadingMore.value = true
  try {
    const provider = getProvider()
    const nextPage = currentPage.value + 1
    const data = await provider.getSongComments(props.songId, nextPage, 20, activeTab.value)
    if (data && commentData.value) {
      commentData.value = {
        ...commentData.value,
        comments: [...commentData.value.comments, ...data.comments],
        hasMore: data.hasMore,
        total: data.total,
      }
      currentPage.value = nextPage
    }
  } catch (e) {
    console.error('Load more comments error:', e)
  } finally {
    loadingMore.value = false
  }
}

function handleScroll() {
  if (!commentsContainer.value || loadingMore.value) return
  const { scrollTop, scrollHeight, clientHeight } = commentsContainer.value
  if (scrollTop + clientHeight >= scrollHeight - 100) {
    loadMoreComments()
  }
}

async function handleToggleLike(comment: Comment) {
  if (!props.songId || !userStore.isLoggedIn) return
  const isLiked = likedMap.value.get(comment.id) || false
  const currentLikedCount = comment.likedCount || 0

  likedMap.value.set(comment.id, !isLiked)
  comment.likedCount = isLiked ? currentLikedCount - 1 : currentLikedCount + 1
  likeLoadingMap.value.set(comment.id, true)

  try {
    const provider = getProvider()
    const result = await provider.likeComment(props.songId, comment.id, !isLiked)
    if (!result) {
      likedMap.value.set(comment.id, isLiked)
      comment.likedCount = currentLikedCount
    }
  } catch (e) {
    console.error('Like comment error:', e)
    likedMap.value.set(comment.id, isLiked)
    comment.likedCount = currentLikedCount
  } finally {
    likeLoadingMap.value.delete(comment.id)
  }
}

async function handleSendComment() {
  if (!props.songId || !newComment.value.trim() || sendLoading.value || !userStore.isLoggedIn) return
  sendLoading.value = true
  try {
    const provider = getProvider()
    const result = await provider.sendComment(props.songId, newComment.value.trim())
    if (result) {
      newComment.value = ''
      loadComments()
    }
  } catch (e) {
    console.error('Send comment error:', e)
  } finally {
    sendLoading.value = false
  }
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days < 1) {
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60))
      return minutes <= 0 ? '刚刚' : `${minutes} 分钟前`
    }
    return `${hours} 小时前`
  }
  if (days < 7) {
    return `${days} 天前`
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatCount(count?: number): string {
  if (!count) return '0'
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + ' 万'
  }
  return String(count)
}

const displayComments = ref<Comment[]>([])

watch(
  () => [activeTab.value, commentData.value],
  () => {
    if (activeTab.value === 'hot' && commentData.value?.hotComments) {
      displayComments.value = commentData.value.hotComments
    } else if (commentData.value) {
      displayComments.value = commentData.value.comments
    } else {
      displayComments.value = []
    }
  },
  { immediate: true }
)

watch(
  () => props.songId,
  (id) => {
    if (id && props.visible) {
      loadComments()
    }
  }
)

watch(
  () => props.visible,
  (v) => {
    if (v && props.songId && !commentData.value) {
      loadComments()
    }
  }
)

watch(
  () => activeTab.value,
  () => {
    if (props.visible && props.songId) {
      loadComments()
    }
  }
)
</script>

<template>
  <Transition name="slide-up">
    <div v-if="visible && songId" class="song-comments">
      <div class="comments-backdrop" @click="emit('close')"></div>
      <div class="comments-panel" @click.stop>
        <div class="comments-header">
          <h3 class="comments-title">
            评论
            <span v-if="commentData?.total" class="comments-count">
              ({{ formatCount(commentData.total) }})
            </span>
          </h3>
          <button class="comments-close" @click="emit('close')" title="关闭">
            ✕
          </button>
        </div>

        <div class="comments-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'hot' }"
            @click="activeTab = 'hot'"
          >
            精彩评论
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'new' }"
            @click="activeTab = 'new'"
          >
            最新评论
          </button>
        </div>

        <div
          ref="commentsContainer"
          class="comments-list"
          @scroll="handleScroll"
        >
          <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </div>

          <template v-else>
            <div
              v-for="comment in displayComments"
              :key="comment.id"
              class="comment-item"
            >
              <div class="comment-avatar">
                <img v-if="comment.user.avatarUrl" :src="comment.user.avatarUrl" alt="" />
              </div>
              <div class="comment-content">
                <div class="comment-header">
                  <span class="comment-nickname">
                    {{ comment.user.nickname }}
                    <span v-if="comment.user.isSvip" class="vip-badge svip">SVIP</span>
                    <span v-else-if="comment.user.vipType && comment.user.vipType > 0" class="vip-badge">VIP</span>
                  </span>
                  <span class="comment-time">{{ formatTime(comment.time) }}</span>
                </div>
                <p class="comment-text">{{ comment.content }}</p>
                <div class="comment-actions">
                  <button
                    class="like-btn"
                    :class="{ 'like-btn--liked': likedMap.get(comment.id) }"
                    @click="handleToggleLike(comment)"
                    :disabled="likeLoadingMap.get(comment.id)"
                  >
                    <span class="like-icon">{{ likedMap.get(comment.id) ? '❤️' : '🤍' }}</span>
                    <span class="like-count">{{ comment.likedCount || 0 }}</span>
                  </button>
                  <button v-if="comment.replyCount && comment.replyCount > 0" class="reply-btn">
                    💬 {{ comment.replyCount }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="loadingMore" class="loading-more">
              <div class="loading-spinner-small"></div>
              <span>加载更多...</span>
            </div>

            <div v-else-if="displayComments.length === 0" class="empty-state">
              暂无评论，快来抢沙发吧~
            </div>

            <div
              v-else-if="activeTab === 'new' && !commentData?.hasMore"
              class="no-more"
            >
              没有更多评论了
            </div>
          </template>
        </div>

        <div class="comments-input-area">
          <template v-if="userStore.isLoggedIn">
            <textarea
              v-model="newComment"
              class="comment-input"
              placeholder="说点什么..."
              maxlength="140"
              rows="2"
            ></textarea>
            <div class="input-actions">
              <span class="char-count">{{ newComment.length }}/140</span>
              <button
                class="send-btn"
                @click="handleSendComment"
                :disabled="!newComment.trim() || sendLoading"
              >
                {{ sendLoading ? '发送中...' : '发送' }}
              </button>
            </div>
          </template>
          <div v-else class="login-tip">
            登录后即可发表评论
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.song-comments {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.comments-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.comments-panel {
  position: relative;
  width: min(500px, 92vw);
  height: min(70vh, 600px);
  background: linear-gradient(
    135deg,
    rgba(20, 20, 28, 0.98),
    rgba(15, 15, 22, 0.99)
  );
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
}

.comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.comments-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}

.comments-count {
  font-size: 13px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 4px;
}

.comments-close {
  width: 28px;
  height: 28px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.comments-close:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.comments-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.tab-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  font-family: inherit;
}

.tab-btn:hover {
  color: rgba(255, 255, 255, 0.8);
  background: rgba(255, 255, 255, 0.05);
}

.tab-btn.active {
  color: #fff;
  background: rgba(217, 91, 103, 0.15);
}

.comments-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #f4d28a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.comment-content {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.comment-nickname {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  gap: 6px;
}

.vip-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: linear-gradient(135deg, #ff9500, #ff5e3a);
  color: #fff;
  font-weight: 600;
}

.vip-badge.svip {
  background: linear-gradient(135deg, #c77c0a, #f2b03e);
}

.comment-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
}

.comment-text {
  margin: 0 0 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.5;
  word-break: break-word;
}

.comment-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.like-btn,
.reply-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  font-family: inherit;
}

.like-btn:hover,
.reply-btn:hover {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.06);
}

.like-btn--liked {
  color: #ff6b6b;
}

.like-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.like-icon {
  font-size: 14px;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.empty-state,
.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}

.comments-input-area {
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.comment-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  resize: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.comment-input:focus {
  border-color: rgba(217, 91, 103, 0.5);
  background: rgba(255, 255, 255, 0.08);
}

.comment-input::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.char-count {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.3);
}

.send-btn {
  padding: 6px 18px;
  border: none;
  background: linear-gradient(135deg, #d95b67, #e87882);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(217, 91, 103, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.login-tip {
  text-align: center;
  padding: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.25s ease;
}

.slide-up-enter-active .comments-panel,
.slide-up-leave-active .comments-panel {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
}

.slide-up-enter-from .comments-panel,
.slide-up-leave-to .comments-panel {
  opacity: 0;
  transform: translateY(100%);
}
</style>
