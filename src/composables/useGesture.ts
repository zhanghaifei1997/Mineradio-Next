import { ref, onMounted, onUnmounted } from 'vue'

export interface GestureState {
  isDragging: boolean
  dragStartX: number
  dragStartY: number
  dragDeltaX: number
  dragDeltaY: number
  isRightDragging: boolean
  lastTapTime: number
  zoomLevel: number
}

export interface GestureHandlers {
  onDoubleClick?: () => void
  onRightDragStart?: (e: MouseEvent) => void
  onRightDragMove?: (deltaX: number, deltaY: number, e: MouseEvent) => void
  onRightDragEnd?: (e: MouseEvent) => void
  onWheel?: (deltaY: number, e: WheelEvent) => void
  onPinch?: (scale: number) => void
}

export function useGesture(target: HTMLElement | null = null, handlers: GestureHandlers = {}) {
  const state = ref<GestureState>({
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    isRightDragging: false,
    lastTapTime: 0,
    zoomLevel: 1
  })

  const DOUBLE_CLICK_DELAY = 300

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 2) {
      e.preventDefault()
      state.value.isRightDragging = true
      state.value.dragStartX = e.clientX
      state.value.dragStartY = e.clientY
      state.value.dragDeltaX = 0
      state.value.dragDeltaY = 0
      handlers.onRightDragStart?.(e)
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (state.value.isRightDragging) {
      const deltaX = e.clientX - state.value.dragStartX
      const deltaY = e.clientY - state.value.dragStartY
      state.value.dragDeltaX = deltaX
      state.value.dragDeltaY = deltaY
      handlers.onRightDragMove?.(deltaX, deltaY, e)
    }
  }

  function handleMouseUp(e: MouseEvent) {
    if (e.button === 2 && state.value.isRightDragging) {
      state.value.isRightDragging = false
      handlers.onRightDragEnd?.(e)
    }
  }

  function handleClick(e: MouseEvent) {
    const now = Date.now()
    if (now - state.value.lastTapTime < DOUBLE_CLICK_DELAY) {
      handlers.onDoubleClick?.()
    }
    state.value.lastTapTime = now
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    handlers.onWheel?.(e.deltaY, e)
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault()
  }

  let touchStartDistance = 0
  let initialPinchZoom = 1

  function getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      touchStartDistance = getTouchDistance(e.touches)
      initialPinchZoom = state.value.zoomLevel
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && touchStartDistance > 0) {
      const currentDistance = getTouchDistance(e.touches)
      const scale = currentDistance / touchStartDistance
      state.value.zoomLevel = Math.max(0.5, Math.min(2, initialPinchZoom * scale))
      handlers.onPinch?.(scale)
    }
  }

  function handleTouchEnd() {
    touchStartDistance = 0
  }

  function setupListeners(el: HTMLElement) {
    el.addEventListener('mousedown', handleMouseDown)
    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseup', handleMouseUp)
    el.addEventListener('mouseleave', handleMouseUp)
    el.addEventListener('click', handleClick)
    el.addEventListener('wheel', handleWheel, { passive: false })
    el.addEventListener('contextmenu', handleContextMenu)
    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd)
  }

  function cleanupListeners(el: HTMLElement) {
    el.removeEventListener('mousedown', handleMouseDown)
    el.removeEventListener('mousemove', handleMouseMove)
    el.removeEventListener('mouseup', handleMouseUp)
    el.removeEventListener('mouseleave', handleMouseUp)
    el.removeEventListener('click', handleClick)
    el.removeEventListener('wheel', handleWheel)
    el.removeEventListener('contextmenu', handleContextMenu)
    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
  }

  onMounted(() => {
    if (target) {
      setupListeners(target)
    }
  })

  onUnmounted(() => {
    if (target) {
      cleanupListeners(target)
    }
  })

  function setTarget(el: HTMLElement | null) {
    if (target) {
      cleanupListeners(target)
    }
    if (el) {
      setupListeners(el)
    }
  }

  return {
    state,
    setTarget
  }
}
