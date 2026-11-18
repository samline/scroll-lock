import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ScrollLockGlobal } from '../src/browser/global.js'
import { page, platform, reset } from './helpers.js'

type Scope = typeof globalThis & { ScrollLock?: ScrollLockGlobal }

const load = async (readyState: DocumentReadyState) => {
  vi.resetModules()
  vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState)
  await import('../src/browser/global.js')
  return (globalThis as Scope).ScrollLock!
}

afterEach(() => {
  const ScrollLock = (globalThis as Scope).ScrollLock
  ScrollLock?.controller?.destroy()
  ScrollLock?.resetScrollLock()
  reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('browser global', () => {
  it('starts on its own once the DOM is ready', async () => {
    platform('windows')
    page()
    document.body.innerHTML = '<div data-scroll-lock></div>'
    const ScrollLock = await load('loading')
    expect(ScrollLock.controller).toBeNull()

    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(ScrollLock.controller).not.toBeNull()
    expect(ScrollLock.isScrollLocked()).toBe(true)
  })

  it('starts right away when the DOM is already ready', async () => {
    const ScrollLock = await load('complete')
    expect(ScrollLock.controller).not.toBeNull()
    expect(ScrollLock.lockScroll).toBeTypeOf('function')
    expect(ScrollLock.createScrollLock().lock).toBeTypeOf('function')
    expect(ScrollLock.scrollLock).toBeTypeOf('function')
    expect(ScrollLock.autoScrollLock).toBeTypeOf('function')
  })

  it('keeps a start made by the page before the DOM is ready', async () => {
    const ScrollLock = await load('loading')
    const controller = ScrollLock.auto({ reserveGap: false })
    document.dispatchEvent(new Event('DOMContentLoaded'))
    expect(ScrollLock.controller).toBe(controller)
    expect(ScrollLock.auto()).not.toBe(controller)
  })

  it('waits for ScrollLock.auto() with data-manual', async () => {
    const script = document.createElement('script')
    script.setAttribute('data-manual', '')
    vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script)
    const ScrollLock = await load('complete')
    expect(ScrollLock.controller).toBeNull()
  })

  it('holds one shared lock for inline handlers', async () => {
    platform('windows')
    page()
    const ScrollLock = await load('complete')
    ScrollLock.lock()
    ScrollLock.lock()
    expect(ScrollLock.isScrollLocked()).toBe(true)
    ScrollLock.unlock()
    expect(ScrollLock.isScrollLocked()).toBe(false)
  })
})
