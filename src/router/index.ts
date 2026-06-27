import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'main',
      component: () => import('@/views/MainView.vue'),
    },
    {
      path: '/splash',
      name: 'splash',
      component: () => import('@/views/SplashView.vue'),
    },
  ],
})

// 启动时：/ → /splash（除非用户勾选了"不再显示"）
// 已勾选时：/splash → /（防止手动访问欢迎页）
router.beforeEach((to, from) => {
  const dontShow = localStorage.getItem('mineradio_splash_dont_show') === 'true'

  // 首次访问主界面且未勾选"不再显示"时，重定向到欢迎页
  // 但从欢迎页退出 (from.name === 'splash') 时不再重定向
  if (to.path === '/' && !dontShow && from.name !== 'splash') {
    return { name: 'splash' }
  }

  if (to.name === 'splash' && dontShow) {
    return { name: 'main' }
  }
})

export default router
