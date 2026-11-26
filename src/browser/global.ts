import {
  autoScrollLock,
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
  scrollLock,
} from '../vanilla/index.js'
import type { AutoScrollLockOptions } from '../vanilla/index.js'

/**
 * Classic script for pages without a build step. It watches every
 * `[data-scroll-lock]` element as soon as the DOM is ready. Add `data-manual`
 * to the script tag to start it yourself with `ScrollLock.auto()`; calling
 * `ScrollLock.auto()` before the DOM is ready also replaces the automatic start.
 */
const script = typeof document !== 'undefined' ? document.currentScript : null
const manual = script?.hasAttribute('data-manual') ?? false

type Controller = ReturnType<typeof autoScrollLock>

let controller: Controller | null = null
// One lock for inline handlers: onclick="ScrollLock.lock()".
const page = createScrollLock()

const api = {
  lockScroll,
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  resetScrollLock,
  scrollLock,
  autoScrollLock,
  /** Take the page's shared lock. Calling it twice still needs one `unlock()`. */
  lock: () => page.lock(),
  /** Release the page's shared lock. Locks held elsewhere stay. */
  unlock: () => page.unlock(),
  /** Start (or restart) watching `[data-scroll-lock]`. Returns the controller. */
  auto: (options?: AutoScrollLockOptions) => {
    controller?.destroy()
    controller = autoScrollLock(options)
    return controller
  },
  /** The controller of the automatic run, or `null`. */
  get controller() {
    return controller
  },
}

export type ScrollLockGlobal = typeof api

const scope = globalThis as typeof globalThis & { ScrollLock?: ScrollLockGlobal }
scope.ScrollLock = api

if (!manual && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    // A page script may already have started it with its own options.
    document.addEventListener('DOMContentLoaded', () => controller ?? api.auto(), { once: true })
  } else {
    api.auto()
  }
}

export {
  autoScrollLock,
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
  scrollLock,
}
