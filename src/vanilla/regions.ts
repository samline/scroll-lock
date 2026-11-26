import type { ScrollLockOptions } from '../core/scroll-lock.js'

export type ScrollLockRegions = string | Element | readonly (string | Element)[]

export interface ScrollLockRegionOptions extends ScrollLockOptions {
  /** Scroll containers whose content can still scroll. An empty list allows none. */
  allowScroll?: ScrollLockRegions
}

type ReadRegions = () => ScrollLockRegions | undefined
type Axis = 'x' | 'y'

const policies = new Set<ReadRegions>()
let active: readonly (Element | string)[] | undefined
let stop: (() => void) | undefined

export const hasScrollRegions = (): boolean => active !== undefined

const matchesRegion = (element: Element, region: Element | string): boolean => {
  if (typeof region !== 'string') return element === region
  if (!region) return false
  try {
    return element.matches(region)
  } catch {
    return false
  }
}

const isPage = (element: Element) =>
  element === document.documentElement || element === document.body

// Include nested scrollers up to the outermost allowed container. Composed
// paths also let a shadow host serve as the region for its slotted content.
const allowedPath = (path: readonly EventTarget[]): Element[] => {
  const regions = active
  if (!regions?.length) return []
  const elements = path.filter((node): node is Element => node instanceof Element && !isPage(node))
  for (let index = elements.length - 1; index >= 0; index--) {
    if (regions.some(region => matchesRegion(elements[index]!, region))) {
      return elements.slice(0, index + 1)
    }
  }
  return []
}

export const isAllowedScrollContainer = (element: Element): boolean => {
  if (active === undefined) return true
  const path: Element[] = []
  for (let node: Element | null = element; node; node = node.parentElement) path.push(node)
  return allowedPath(path).includes(element)
}

const canScroll = (element: Element, axis: Axis, delta: number): boolean => {
  const horizontal = axis === 'x'
  const range = horizontal
    ? element.scrollWidth - element.clientWidth
    : element.scrollHeight - element.clientHeight
  if (range <= 0) return false

  const style = getComputedStyle(element)
  if (!/^(auto|scroll|overlay)$/.test(horizontal ? style.overflowX : style.overflowY)) return false
  const reversed = horizontal ? style.direction === 'rtl' : style.flexDirection === 'column-reverse'
  const position = horizontal ? element.scrollLeft : element.scrollTop
  const min = reversed ? -range : 0
  const max = reversed ? 0 : range
  // Layout sizes are rounded, but scroll offsets can be fractional.
  return delta < 0 ? position - min > 0.5 : max - position > 0.5
}

const guard = (event: Event, x: number, y: number) => {
  if (!event.cancelable || event.defaultPrevented || (!x && !y)) return
  const horizontal = Math.abs(x) > Math.abs(y)
  if (
    !allowedPath(event.composedPath()).some(el =>
      canScroll(el, horizontal ? 'x' : 'y', horizontal ? x : y)
    )
  ) {
    event.preventDefault()
  }
}

const scrollKeys = new Map<string, readonly [number, number]>([
  ['ArrowLeft', [-1, 0]],
  ['ArrowRight', [1, 0]],
  ['ArrowUp', [0, -1]],
  ['ArrowDown', [0, 1]],
  ['PageUp', [0, -1]],
  ['PageDown', [0, 1]],
  ['Home', [0, -1]],
  ['End', [0, 1]],
])

const listen = (): (() => void) => {
  const listeners = new AbortController()
  const capture = { passive: false, capture: true, signal: listeners.signal }
  let previous: Touch | undefined

  document.addEventListener(
    'wheel',
    event => {
      if (event.ctrlKey) return
      if (event.shiftKey && !event.deltaX) guard(event, event.deltaY, 0)
      else guard(event, event.deltaX, event.deltaY)
    },
    capture
  )

  document.addEventListener(
    'touchstart',
    event => {
      previous = event.touches.length === 1 ? event.touches[0] : undefined
    },
    { ...capture, passive: true }
  )

  document.addEventListener(
    'touchmove',
    event => {
      const touch = event.touches.length === 1 ? event.touches[0] : undefined
      if (touch && previous?.identifier === touch.identifier) {
        guard(event, previous.clientX - touch.clientX, previous.clientY - touch.clientY)
      }
      previous = touch
    },
    capture
  )

  document.addEventListener(
    'keydown',
    event => {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      const space = event.key === ' '
      const delta = space ? ([0, event.shiftKey ? -1 : 1] as const) : scrollKeys.get(event.key)
      if (!delta) return
      const target = event.composedPath()[0]
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, audio, video'))
      )
        return
      if (space && target instanceof Element && target.closest('button, summary, [role="button"]'))
        return
      guard(event, ...delta)
    },
    { signal: listeners.signal }
  )

  return () => listeners.abort()
}

/** A later explicit lock overrides an earlier one, regardless of release order. */
export const refreshScrollRegions = (): void => {
  let regions: ScrollLockRegions | undefined
  for (const read of policies) regions = read() ?? regions
  active = typeof regions === 'string' || regions instanceof Element ? [regions] : regions
  if (hasScrollRegions()) {
    stop ??= listen()
  } else {
    stop?.()
    stop = undefined
  }
}

export const registerScrollRegions = (read: ReadRegions): (() => void) => {
  policies.add(read)
  refreshScrollRegions()
  return () => {
    policies.delete(read)
    refreshScrollRegions()
  }
}
