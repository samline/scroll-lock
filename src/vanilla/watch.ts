import { autoInit, isBrowser, readBoolean, readEnum, resolveElements } from '@samline/internal'
import type { AutoInitController, ElementTarget } from '@samline/internal'

import {
  ATTRIBUTE,
  MODES,
  POSITION_FIXED,
  STATE_ATTRIBUTE,
  resolveOptions,
} from '../core/scroll-lock.js'
import type { ScrollLockOptions } from '../core/scroll-lock.js'
import { createScrollLock, onReset } from './lock.js'

export interface ScrollLockWatchOptions extends ScrollLockOptions {
  /**
   * Whether the element counts as open. By default: the `open` attribute on
   * `<dialog>` and `<details>`, `:popover-open` on popovers, and for any other
   * element, no `hidden` attribute and no `aria-hidden="true"`.
   */
  isOpen?: (element: Element) => boolean
}

export interface AutoScrollLockOptions extends ScrollLockWatchOptions {
  /** Where to look for `[data-scroll-lock]`. Defaults to `document`. */
  root?: ParentNode
  /** Also handle elements added later. Defaults to `true`. */
  observe?: boolean
}

export interface ScrollLockController {
  /** Check every element again (call it after changing what `isOpen` reads). */
  refresh: () => void
  /** True while any watched element holds a lock. */
  isLocked: () => boolean
  /** Release the locks, stop watching and remove the state attributes. */
  destroy: () => void
}

/** Attributes whose changes can open or close an element. */
const WATCHED = [
  'open',
  'hidden',
  'aria-hidden',
  'class',
  'style',
  ATTRIBUTE,
  `${ATTRIBUTE}-mode`,
  `${ATTRIBUTE}-gap`,
  `${ATTRIBUTE}-position-fixed`,
]

const isPopoverOpen = (element: Element): boolean => {
  try {
    return element.matches(':popover-open')
  } catch {
    return false
  }
}

/** The default `isOpen`. */
export const isOpenElement = (element: Element): boolean => {
  if (element instanceof HTMLDialogElement || element instanceof HTMLDetailsElement) {
    return element.open
  }
  if (element.hasAttribute('popover')) return isPopoverOpen(element)
  return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true'
}

/** Options from `data-scroll-lock-*` attributes; attributes win over `options`. */
const readOptions = (element: Element, options: ScrollLockOptions): ScrollLockOptions => {
  const base = resolveOptions(options)
  return {
    mode: readEnum(element, `${ATTRIBUTE}-mode`, MODES, base.mode),
    reserveGap: readBoolean(element, `${ATTRIBUTE}-gap`, base.reserveGap),
    positionFixed: readEnum(
      element,
      `${ATTRIBUTE}-position-fixed`,
      POSITION_FIXED,
      base.positionFixed
    ),
  }
}

const watchOne = (
  element: Element,
  options: ScrollLockWatchOptions
): { refresh: () => void; isLocked: () => boolean; destroy: () => void } => {
  const isOpen = options.isOpen ?? isOpenElement
  const previous = element.getAttribute(STATE_ATTRIBUTE)
  let current = readOptions(element, options)
  let applied = JSON.stringify(current)
  let lock = createScrollLock(current)

  const refresh = () => {
    // `data-scroll-lock="false"` turns the element off without removing it.
    const wanted = readBoolean(element, ATTRIBUTE, true) && element.isConnected && isOpen(element)
    current = readOptions(element, options)
    const key = JSON.stringify(current)
    if (key !== applied) {
      // Changed options: take the new lock before releasing the old one, so
      // the page never unlocks in between.
      const old = lock
      lock = createScrollLock(current)
      applied = key
      if (wanted) lock.lock()
      old.destroy()
    }
    lock.toggle(wanted)
    element.setAttribute(STATE_ATTRIBUTE, lock.isLocked() ? 'locked' : 'unlocked')
  }

  const observer = new MutationObserver(refresh)
  observer.observe(element, { attributes: true, attributeFilter: WATCHED })
  // Popovers open and close without an attribute change.
  element.addEventListener('toggle', refresh)

  // resetScrollLock() released the lock behind this element's back.
  const stopReset = onReset(() => element.setAttribute(STATE_ATTRIBUTE, 'unlocked'))

  refresh()

  let destroyed = false
  return {
    refresh: () => {
      if (!destroyed) refresh()
    },
    isLocked: () => lock.isLocked(),
    destroy: () => {
      if (destroyed) return
      destroyed = true
      observer.disconnect()
      element.removeEventListener('toggle', refresh)
      stopReset()
      lock.destroy()
      if (previous === null) element.removeAttribute(STATE_ATTRIBUTE)
      else element.setAttribute(STATE_ATTRIBUTE, previous)
    },
  }
}

const inert: ScrollLockController = {
  refresh: () => {},
  isLocked: () => false,
  destroy: () => {},
}

/**
 * Lock the page while an element (a dialog, a drawer, a menu) is open, and
 * unlock it when the element closes or the controller is destroyed. Call
 * `destroy()` before removing a watched element; `autoScrollLock()` does that
 * on its own. Each element holds its own lock, so nested ones unlock in any order.
 */
export const scrollLock = (
  target: ElementTarget,
  options: ScrollLockWatchOptions = {}
): ScrollLockController => {
  if (!isBrowser()) return inert
  const watchers = resolveElements(target).map(element => watchOne(element, options))
  return {
    refresh: () => watchers.forEach(watcher => watcher.refresh()),
    isLocked: () => watchers.some(watcher => watcher.isLocked()),
    destroy: () => watchers.forEach(watcher => watcher.destroy()),
  }
}

/**
 * Watch every `[data-scroll-lock]` element, including elements added later,
 * and release the lock of elements that leave the DOM.
 */
export const autoScrollLock = (options: AutoScrollLockOptions = {}): AutoInitController => {
  const { root, observe, ...watch } = options
  return autoInit({
    selector: `[${ATTRIBUTE}]`,
    init: element => watchOne(element, watch).destroy,
    ...(root ? { root } : {}),
    ...(observe === undefined ? {} : { observe }),
  })
}
