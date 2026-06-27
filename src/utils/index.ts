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
    const ua = navigator.userAgent || ''
    // Safari and Firefox don't support SVG backdrop-filter
    if ((/Safari/.test(ua) && !/Chrome/.test(ua)) || /Firefox/.test(ua)) return false
    
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

/**
 * Generate a displacement map SVG data URI for the glass chromatic aberration filter.
 * This creates a gradient-based displacement map that drives the RGB channel splitting
 * in the feDisplacementMap filters.
 */
export function generateControlGlassDisplacementMap(
  width: number = 400,
  height: number = 92,
  radius: number = 50
): string {
  width = Math.max(240, Math.round(width))
  height = Math.max(48, Math.round(height))
  radius = Math.max(12, Math.round(radius))
  
  const borderWidth = 0.07
  const edge = Math.min(width, height) * (borderWidth * 0.5)
  const innerW = Math.max(1, width - edge * 2)
  const innerH = Math.max(1, height - edge * 2)
  
  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<linearGradient id="glass-red" x1="100%" y1="0%" x2="0%" y2="0%">` +
      `<stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient>` +
    `<linearGradient id="glass-blue" x1="0%" y1="0%" x2="0%" y2="100%">` +
      `<stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient>` +
    `</defs>` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="black"/>` +
    `<rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#glass-red)"/>` +
    `<rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#glass-blue)" style="mix-blend-mode:difference"/>` +
    `<rect x="${edge.toFixed(2)}" y="${edge.toFixed(2)}" width="${innerW.toFixed(2)}" height="${innerH.toFixed(2)}" rx="${radius}" fill="hsl(0 0% 50% / 1)" style="filter:blur(11px)"/>` +
    `</svg>`
  
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/**
 * Update chromatic aberration offset in the SVG glass filter.
 * Adjusts the feOffset dx attribute to control the intensity of RGB channel splitting.
 */
export function updateGlassChromaticOffset(offset: number): void {
  if (typeof document === 'undefined') return
  const filter = document.getElementById('mineradio-control-glass-filter')
  if (!filter) return
  const dx = String(-Math.round(offset))
  filter.querySelectorAll('feOffset').forEach(node => {
    node.setAttribute('dx', dx)
    node.setAttribute('dy', '0')
  })
}

export function initGlassFilter(): void {
  if (typeof document === 'undefined') return
  
  const supported = checkSvgBackdropFilter()
  if (!supported) return
  
  document.documentElement.classList.add('control-glass-svg-ok')
  
  // Generate and inject displacement maps for all glass filters
  const controlGlassMap = document.getElementById('control-glass-map')
  if (controlGlassMap) {
    // Use the PlayerBar's typical dimensions for the displacement map
    const mapUri = generateControlGlassDisplacementMap(1120, 82, 40)
    controlGlassMap.setAttribute('href', mapUri)
  }
  
  const searchBoxMap = document.getElementById('search-box-glass-map')
  if (searchBoxMap) {
    const mapUri = generateControlGlassDisplacementMap(520, 58, 22)
    searchBoxMap.setAttribute('href', mapUri)
  }
  
  const searchPillMap = document.getElementById('search-pill-glass-map')
  if (searchPillMap) {
    const mapUri = generateControlGlassDisplacementMap(200, 24, 12)
    searchPillMap.setAttribute('href', mapUri)
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
