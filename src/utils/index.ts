export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatPlayCount(count: number): string {
  if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
  if (count >= 10000) return (count / 10000).toFixed(1) + '万'
  return String(count)
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let last = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn(...args)
    }
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

export function checkSvgBackdropFilter(): boolean {
  if (typeof document === 'undefined' || typeof CSS === 'undefined') return false
  
  try {
    const testEl = document.createElement('div')
    testEl.style.position = 'fixed'
    testEl.style.top = '-9999px'
    testEl.style.left = '-9999px'
    testEl.style.width = '1px'
    testEl.style.height = '1px'
    testEl.style.backdropFilter = 'url(#mineradio-control-glass-filter)'
    testEl.style.webkitBackdropFilter = 'url(#mineradio-control-glass-filter)'
    document.body.appendChild(testEl)
    
    const computedStyle = window.getComputedStyle(testEl)
    const backdropFilter = computedStyle.backdropFilter || computedStyle.webkitBackdropFilter
    
    document.body.removeChild(testEl)
    
    return !!backdropFilter && backdropFilter !== 'none' && backdropFilter.includes('url')
  } catch {
    return false
  }
}

export function initGlassFilter(): void {
  if (typeof document === 'undefined') return
  
  const supported = checkSvgBackdropFilter()
  if (supported) {
    document.documentElement.classList.add('control-glass-svg-ok')
  }
}

/**
 * 将外部音频 URL 通过服务端代理路由，避免 Web Audio CORS 静音。
 * createMediaElementSource 要求音频源为同源或具备 CORS 头，
 * 否则会完全静音（输出零值）。
 * local-audio:// 协议已具备 CORS 特权，无需代理。
 */
export function proxyAudioUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) {
    return `/api/audio?url=${encodeURIComponent(url)}`
  }
  return url
}
