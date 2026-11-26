import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import lockScrollDefault, {
  GAP_PROPERTY,
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
} from '../src/index.js'
import { page, platform, reset } from './helpers.js'

const html = document.documentElement
const body = document.body

beforeEach(() => platform('windows'))

afterEach(() => {
  resetScrollLock()
  reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('lockScroll (overflow)', () => {
  it('is the default export', () => {
    expect(lockScrollDefault).toBe(lockScroll)
  })

  it('hides the overflow on <html> and compensates the scrollbar', () => {
    page({ gap: 15 })
    body.style.paddingRight = '10px'
    const release = lockScroll()

    expect(html.style.overflow).toBe('hidden')
    expect(body.style.paddingRight).toBe('25px')
    expect(html.style.getPropertyValue(GAP_PROPERTY)).toBe('15px')
    expect(html.getAttribute('data-scroll-lock-state')).toBe('locked')
    expect(isScrollLocked()).toBe(true)

    release()
    expect(html.style.overflow).toBe('')
    expect(body.style.paddingRight).toBe('10px')
    expect(html.style.getPropertyValue(GAP_PROPERTY)).toBe('')
    expect(html.hasAttribute('data-scroll-lock-state')).toBe(false)
    expect(isScrollLocked()).toBe(false)
  })

  it('restores inline styles and their priority exactly', () => {
    page()
    html.style.setProperty('overflow', 'auto', 'important')
    html.setAttribute('data-scroll-lock-state', 'custom')
    const release = lockScroll()
    expect(html.style.overflow).toBe('hidden')
    release()
    expect(html.style.getPropertyValue('overflow')).toBe('auto')
    expect(html.style.getPropertyPriority('overflow')).toBe('important')
    expect(html.getAttribute('data-scroll-lock-state')).toBe('custom')
  })

  it('skips the compensation without a scrollbar, with reserveGap: false or a stable gutter', () => {
    page({ gap: 0 })
    let release = lockScroll()
    expect(body.style.paddingRight).toBe('')
    expect(html.style.getPropertyValue(GAP_PROPERTY)).toBe('0px')
    release()

    page({ gap: 15 })
    release = lockScroll({ reserveGap: false })
    expect(body.style.paddingRight).toBe('')
    release()

    html.style.setProperty('scrollbar-gutter', 'stable')
    release = lockScroll()
    expect(body.style.paddingRight).toBe('')
    expect(html.style.getPropertyValue(GAP_PROPERTY)).toBe('0px')
    release()
  })

  it('nests: the page unlocks after the last release, in any order', () => {
    page()
    const first = lockScroll()
    const second = lockScroll()
    const third = lockScroll()

    second()
    first()
    expect(html.style.overflow).toBe('hidden')
    expect(isScrollLocked()).toBe(true)
    third()
    expect(html.style.overflow).toBe('')
    expect(isScrollLocked()).toBe(false)
  })

  it('ignores a release called twice', () => {
    page()
    const first = lockScroll()
    const second = lockScroll()
    first()
    first()
    expect(html.style.overflow).toBe('hidden')
    second()
    expect(html.style.overflow).toBe('')
  })

  it('keeps the scroll position in place', () => {
    const { scrollTo } = page({ y: 400 })
    lockScroll()()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('keeps cleaning up when one cleanup throws', () => {
    page()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const release = lockScroll()
    vi.spyOn(html.style, 'removeProperty').mockImplementationOnce(() => {
      throw new Error('boom')
    })
    release()
    expect(warn).toHaveBeenCalled()
    expect(html.hasAttribute('data-scroll-lock-state')).toBe(false)
  })
})

describe('lock lifetime', () => {
  it('aborts only its own lock and restores the position after the last release', () => {
    const { scrollTo } = page({ y: 450 })
    const lifetime = new AbortController()
    const keep = lockScroll({ positionFixed: 'always' })
    const release = lockScroll({ positionFixed: 'always', signal: lifetime.signal })
    const snapshot = getScrollLockState()

    lifetime.abort()
    release()
    expect(snapshot).toEqual({ locked: true, count: 2 })
    expect(getScrollLockState()).toEqual({ locked: true, count: 1 })
    expect(scrollTo).not.toHaveBeenCalled()

    keep()
    expect(getScrollLockState()).toEqual({ locked: false, count: 0 })
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 0, top: 450, behavior: 'instant' })
  })

  it('never acquires a lock with an already-aborted signal', () => {
    page()
    const lifetime = new AbortController()
    lifetime.abort()
    lockScroll({ signal: lifetime.signal })()
    const lock = createScrollLock({ signal: lifetime.signal })
    lock.lock()
    expect(lock.isLocked()).toBe(false)
    expect(getScrollLockState()).toEqual({ locked: false, count: 0 })
    expect(html.style.overflow).toBe('')
  })

  it('detaches the signal on manual release and reset', () => {
    page()
    const { signal } = new AbortController()
    const remove = vi.spyOn(signal, 'removeEventListener')
    const manual = lockScroll({ signal })
    const reset = lockScroll({ signal })
    manual()
    resetScrollLock()
    expect(remove.mock.calls).toEqual([
      ['abort', manual],
      ['abort', reset],
    ])
  })

  it('destroys the controller on abort, including after a reset', () => {
    page()
    const lifetime = new AbortController()
    const lock = createScrollLock({ signal: lifetime.signal })
    lock.lock()
    resetScrollLock()
    expect(lock.isLocked()).toBe(false)
    lock.lock()
    expect(lock.isLocked()).toBe(true)

    lifetime.abort()
    lock.toggle(true)
    expect(lock.isLocked()).toBe(false)
    expect(getScrollLockState()).toEqual({ locked: false, count: 0 })
  })
})

describe('positionFixed', () => {
  it('pins the body with always and scrolls back on release', () => {
    const { state, scrollTo } = page({ x: 20, y: 600 })
    const release = lockScroll({ positionFixed: 'always' })

    expect(body.style.getPropertyValue('position')).toBe('fixed')
    expect(body.style.getPropertyPriority('position')).toBe('important')
    expect(body.style.top).toBe('-600px')
    expect(body.style.left).toBe('-20px')
    expect(body.style.right).toBe('0px')
    expect(body.style.height).toBe('auto')

    state.y = 0
    release()
    expect(body.style.position).toBe('')
    expect(body.style.top).toBe('')
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 20, top: 600, behavior: 'instant' })
  })

  it('pins only in Safari with safari, and never by default', () => {
    page()
    let release = lockScroll({ positionFixed: 'safari' })
    expect(body.style.position).toBe('')
    release()

    platform('mac-safari')
    release = lockScroll({ positionFixed: 'safari' })
    expect(body.style.position).toBe('fixed')
    release()

    release = lockScroll()
    expect(body.style.position).toBe('')
    release()
  })

  it('does not pin an installed web app in Safari', () => {
    page()
    platform('mac-safari')
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('standalone') }))
    lockScroll({ positionFixed: 'safari' })
    expect(body.style.position).toBe('')
  })

  it('follows a bottom bar that appeared while pinning', () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    page({ y: 2000 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    lockScroll({ positionFixed: 'always' })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 750 })
    vi.advanceTimersByTime(300)
    expect(body.style.top).toBe('-2050px')
  })

  it('cancels the bottom bar check on an early release', () => {
    vi.useFakeTimers()
    page({ y: 2000 })
    const release = lockScroll({ positionFixed: 'always' })
    release()
    vi.advanceTimersByTime(300)
    expect(body.style.top).toBe('')
  })

  it('shares the pin between nested locks', () => {
    const { scrollTo } = page({ y: 300 })
    const first = lockScroll({ positionFixed: 'always' })
    const second = lockScroll({ positionFixed: 'always' })
    first()
    expect(body.style.position).toBe('fixed')
    second()
    expect(body.style.position).toBe('')
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })
})

describe('resetScrollLock', () => {
  it('releases every lock', () => {
    page()
    lockScroll()
    lockScroll({ positionFixed: 'always' })
    const lock = createScrollLock()
    lock.lock()
    resetScrollLock()
    expect(html.style.overflow).toBe('')
    expect(body.style.position).toBe('')
    expect(isScrollLocked()).toBe(false)
    expect(lock.isLocked()).toBe(false)
    lock.lock()
    expect(lock.isLocked()).toBe(true)
  })
})

describe('createScrollLock', () => {
  it('holds at most one lock', () => {
    page()
    const other = lockScroll()
    const lock = createScrollLock()
    lock.lock()
    lock.lock()
    expect(lock.isLocked()).toBe(true)
    lock.unlock()
    lock.unlock()
    expect(lock.isLocked()).toBe(false)
    expect(isScrollLocked()).toBe(true)
    other()
    expect(isScrollLocked()).toBe(false)
  })

  it('toggles, with or without force', () => {
    page()
    const lock = createScrollLock({ reserveGap: false })
    lock.toggle()
    expect(lock.isLocked()).toBe(true)
    lock.toggle(true)
    expect(lock.isLocked()).toBe(true)
    lock.toggle()
    expect(lock.isLocked()).toBe(false)
    lock.toggle(false)
    expect(lock.isLocked()).toBe(false)
  })

  it('stops locking after destroy, which is idempotent', () => {
    page()
    const lock = createScrollLock()
    lock.lock()
    lock.destroy()
    lock.destroy()
    expect(isScrollLocked()).toBe(false)
    lock.lock()
    expect(lock.isLocked()).toBe(false)
  })
})
