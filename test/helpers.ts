import { vi } from 'vitest'

export interface Page {
  state: { x: number; y: number }
  scrollTo: ReturnType<typeof vi.fn>
}

/**
 * jsdom has no layout and no `scrollTo`: give the window a scroll position,
 * a viewport and a scrollbar of `gap` pixels.
 */
export const page = ({ y = 0, x = 0, gap = 15, width = 1024 } = {}): Page => {
  const state = { x, y }
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    state.x = options.left ?? state.x
    state.y = options.top ?? state.y
  })
  vi.stubGlobal('scrollTo', scrollTo)
  Object.defineProperty(window, 'scrollX', { configurable: true, get: () => state.x })
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => state.y })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => (document.documentElement.style.overflow === 'hidden' ? width : width - gap),
  })
  return { state, scrollTo }
}

/** Pretend to be a browser on another platform. */
export const platform = (
  name: 'ios' | 'ipados' | 'mac-safari' | 'mac-chrome' | 'windows' | 'android'
): void => {
  const values = {
    ios: [
      'iPhone',
      'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
      5,
    ],
    ipados: [
      'MacIntel',
      'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      5,
    ],
    'mac-safari': [
      'MacIntel',
      'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      0,
    ],
    'mac-chrome': [
      'MacIntel',
      'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
      0,
    ],
    windows: [
      'Win32',
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
      0,
    ],
    android: [
      'Linux armv8l',
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36',
      5,
    ],
  } as const
  const [os, userAgent, maxTouchPoints] = values[name]
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(os)
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: maxTouchPoints })
}

/** Run `requestAnimationFrame` callbacks right away. */
export const syncFrames = (): void => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
}

export const touch = (type: string, target: EventTarget, pageY = 0): TouchEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent
  Object.defineProperty(event, 'changedTouches', { value: [{ pageY }] })
  target.dispatchEvent(event)
  return event
}

export const reset = (): void => {
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-scroll-lock-state')
  document.body.removeAttribute('style')
  document.body.innerHTML = ''
}
