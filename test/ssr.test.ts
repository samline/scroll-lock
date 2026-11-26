// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  autoScrollLock,
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
  scrollLock,
} from '../src/index.js'

describe('without a DOM', () => {
  it('does nothing and never throws', () => {
    const { signal } = new AbortController()
    const release = lockScroll({ signal })
    release()
    const lock = createScrollLock({ signal })
    lock.lock()
    expect(lock.isLocked()).toBe(false)
    lock.destroy()
    const controller = scrollLock('.sheet')
    controller.refresh()
    expect(controller.isLocked()).toBe(false)
    controller.destroy()
    autoScrollLock().destroy()
    resetScrollLock()
    expect(isScrollLocked()).toBe(false)
    expect(getScrollLockState()).toEqual({ locked: false, count: 0 })
  })

  it('loads the browser global without side effects on the DOM', async () => {
    await import('../src/browser/global.js')
    expect((globalThis as { ScrollLock?: unknown }).ScrollLock).toBeTypeOf('object')
  })
})
