// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  autoScrollLock,
  createScrollLock,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
  scrollLock,
} from '../src/index.js'

describe('without a DOM', () => {
  it('does nothing and never throws', () => {
    const release = lockScroll()
    release()
    const lock = createScrollLock()
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
  })

  it('loads the browser global without side effects on the DOM', async () => {
    await import('../src/browser/global.js')
    expect((globalThis as { ScrollLock?: unknown }).ScrollLock).toBeTypeOf('object')
  })
})
