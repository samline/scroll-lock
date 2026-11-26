import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  autoScrollLock,
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
  scrollLock,
} from '../src/index.js'
import { page, platform, reset } from './helpers.js'

const panel = (id: string) => {
  const element = document.createElement('div')
  element.id = id
  element.style.overflowX = 'scroll'
  element.style.setProperty('overflow-y', 'auto', 'important')
  document.body.append(element)
  return element
}

const measure = (element: HTMLElement, gap: number) => {
  element.style.border = '2px solid'
  Object.defineProperties(element, {
    clientWidth: { value: 200 },
    offsetWidth: { value: 204 + gap },
  })
}

beforeEach(() => {
  platform('windows')
  page()
})

afterEach(() => {
  resetScrollLock()
  reset()
  vi.restoreAllMocks()
})

describe('container locks', () => {
  it('counts and restores each panel independently of the page', () => {
    const inbox = panel('inbox')
    const reader = panel('reader')
    inbox.scrollLeft = 40
    inbox.scrollTop = 180
    const scrollTo = vi.fn(({ left, top }) => {
      inbox.scrollLeft = left
      inbox.scrollTop = top
    })
    Object.assign(inbox, { scrollTo })
    const first = lockScroll({ target: inbox })
    const second = lockScroll({ target: '#inbox' })
    const other = lockScroll({ target: reader })
    expect(getScrollLockState(inbox)).toEqual({ locked: true, count: 2 })
    expect(getScrollLockState('#reader')).toEqual({ locked: true, count: 1 })
    expect(getScrollLockState()).toEqual({ locked: false, count: 0 })
    const releasePage = lockScroll()

    inbox.scrollLeft = 80
    inbox.scrollTop = 300
    first()
    other()
    expect(isScrollLocked(reader)).toBe(false)
    expect(isScrollLocked(inbox)).toBe(true)
    expect(isScrollLocked()).toBe(true)
    expect(inbox.style.overflowY).toBe('hidden')
    expect(scrollTo).not.toHaveBeenCalled()

    second()
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ left: 40, top: 180, behavior: 'instant' })
    expect(inbox.style.overflowX).toBe('scroll')
    expect(inbox.style.overflowY).toBe('auto')
    expect(inbox.style.getPropertyPriority('overflow-y')).toBe('important')
    expect(isScrollLocked()).toBe(true)
    releasePage()
  })

  it('reserves only the measured gutter and restores existing CSS', () => {
    const element = panel('editor')
    measure(element, 16)
    element.style.setProperty('--scroll-lock-gap', '3px')
    element.style.setProperty('scrollbar-gutter', 'auto')
    const release = lockScroll({ target: element })
    expect(element.style.getPropertyValue('--scroll-lock-gap')).toBe('16px')
    expect(element.style.getPropertyValue('scrollbar-gutter')).toBe('stable')
    release()
    expect(element.style.getPropertyValue('scrollbar-gutter')).toBe('auto')
    expect(element.style.getPropertyValue('--scroll-lock-gap')).toBe('3px')

    const noGap = lockScroll({ target: element, reserveGap: false })
    expect(element.style.getPropertyValue('--scroll-lock-gap')).toBe('0px')
    expect(element.style.getPropertyValue('scrollbar-gutter')).toBe('auto')
    noGap()

    element.style.setProperty('scrollbar-gutter', 'stable both-edges', 'important')
    const stable = lockScroll({ target: element })
    expect(element.style.getPropertyValue('--scroll-lock-gap')).toBe('0px')
    stable()
    expect(element.style.getPropertyPriority('scrollbar-gutter')).toBe('important')
  })

  it('measures the inline gutter for a vertical writing mode', () => {
    const element = panel('vertical')
    element.style.writingMode = 'vertical-rl'
    element.style.border = '2px solid'
    Object.defineProperties(element, {
      clientHeight: { value: 100 },
      offsetHeight: { value: 119 },
    })
    lockScroll({ target: element })
    expect(element.style.getPropertyValue('--scroll-lock-gap')).toBe('15px')
  })

  it('supports scoped reset, abort and teardown after a panel is detached', () => {
    const first = panel('first')
    const second = panel('second')
    const lifetime = new AbortController()
    const lock = createScrollLock({ target: first, signal: lifetime.signal })
    lock.lock()
    const direct = lockScroll({ target: first })
    lockScroll({ target: second })
    lockScroll()

    resetScrollLock('#first')
    expect(lock.isLocked()).toBe(false)
    expect(isScrollLocked(first)).toBe(false)
    expect(isScrollLocked(second)).toBe(true)
    expect(isScrollLocked()).toBe(true)
    direct()
    lock.lock()
    lifetime.abort()
    expect(lock.isLocked()).toBe(false)
    lock.lock()
    expect(lock.isLocked()).toBe(false)

    second.remove()
    second.scrollTop = 50
    expect(isScrollLocked(second)).toBe(true)
    resetScrollLock(second)
    expect(isScrollLocked(second)).toBe(false)
    expect(second.scrollTop).toBe(0)
    resetScrollLock()
    expect(isScrollLocked()).toBe(false)
  })

  it('ignores an invalid or detached acquisition without locking the page', () => {
    const detached = document.createElement('div')
    for (const target of ['#missing', '', '[', document.body, document.documentElement, detached]) {
      lockScroll({ target })()
      const controller = createScrollLock({ target })
      controller.lock()
      expect(controller.isLocked()).toBe(false)
      controller.destroy()
      expect(isScrollLocked()).toBe(false)
    }
  })

  it('rebinds watched targets and keeps the shared state attribute accurate', () => {
    const first = panel('first')
    first.setAttribute('data-scroll-lock-state', 'authored')
    const second = panel('second')
    const trigger = document.createElement('details')
    trigger.open = true
    trigger.setAttribute('data-scroll-lock-target', '#first')
    document.body.append(trigger)
    const watchedPanel = scrollLock(first, { isOpen: () => false })
    const watcher = scrollLock(trigger, { target: second })
    expect(isScrollLocked(first)).toBe(true)
    expect(first.getAttribute('data-scroll-lock-state')).toBe('locked')
    watchedPanel.refresh()
    expect(first.getAttribute('data-scroll-lock-state')).toBe('locked')

    trigger.removeAttribute('data-scroll-lock-target')
    watcher.refresh()
    expect(first.getAttribute('data-scroll-lock-state')).toBe('unlocked')
    expect(isScrollLocked(second)).toBe(true)
    resetScrollLock(first)
    expect(watcher.isLocked()).toBe(true)
    resetScrollLock(second)
    expect(trigger.getAttribute('data-scroll-lock-state')).toBe('unlocked')
    watcher.destroy()
    watchedPanel.destroy()
    expect(first.getAttribute('data-scroll-lock-state')).toBe('authored')
  })

  it('picks up a mounted panel when refreshing declarative locks in a shadow root', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = host.attachShadow({ mode: 'open' })
    root.innerHTML = '<details open data-scroll-lock data-scroll-lock-target="#local"></details>'
    const auto = autoScrollLock({ root, observe: false })
    const local = panel('local')
    root.append(local)
    expect(isScrollLocked(local)).toBe(false)
    auto.refresh()
    expect(isScrollLocked(local)).toBe(true)
    expect(isScrollLocked()).toBe(false)
    auto.destroy()
    expect(isScrollLocked(local)).toBe(false)
  })
})
