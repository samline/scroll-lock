import { autoInit, isBrowser, readBoolean, readEnum, resolveElements } from '@samline/internal'
import type { AutoInitController, ElementTarget } from '@samline/internal'

import { ATTRIBUTE, MODES, POSITION_FIXED, resolveOptions } from '../core/scroll-lock.js'
import type { ScrollLockOptions } from '../core/scroll-lock.js'
import { createScrollLock, onReset } from './lock.js'
import type { ScrollLockScopeOptions } from './lock.js'
import { resolveLockTarget } from './panel.js'
import { refreshScrollRegions, registerScrollRegions } from './regions.js'
import { trackLockState } from './state.js'

export interface ScrollLockWatchOptions extends ScrollLockScopeOptions {
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
const ALLOW = `${ATTRIBUTE}-allow`
const TARGET = `${ATTRIBUTE}-target`
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
  ALLOW,
  TARGET,
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
  const state = trackLockState(element, 'unlocked')
  let current = readOptions(element, options)
  let applied = JSON.stringify(current)
  let target: HTMLElement | null | undefined
  let lock = createScrollLock(current)
  let forgetRegions: (() => void) | undefined

  const clearRegions = () => {
    forgetRegions?.()
    forgetRegions = undefined
  }

  const refresh = () => {
    const root = element.isConnected
      ? (element.getRootNode() as Document | ShadowRoot)
      : element.ownerDocument
    const next = resolveLockTarget(element.getAttribute(TARGET) ?? options.target, root)
    // `data-scroll-lock="false"` turns the element off without removing it.
    const wanted =
      next !== null &&
      next?.isConnected !== false &&
      readBoolean(element, ATTRIBUTE, true) &&
      element.isConnected &&
      isOpen(element)
    current = readOptions(element, options)
    const key = JSON.stringify(current)
    if (key !== applied || next !== target) {
      // Changed options: take the new lock before releasing the old one, so
      // the page never unlocks in between.
      const old = lock
      lock = createScrollLock(next ? { ...current, target: next } : current)
      applied = key
      target = next
      if (wanted) lock.lock()
      old.destroy()
    }
    lock.toggle(wanted)
    if (!lock.isLocked() || target) clearRegions()
    else if (forgetRegions) refreshScrollRegions()
    else
      forgetRegions = registerScrollRegions(
        () => element.getAttribute(ALLOW) ?? options.allowScroll
      )
    state.update(lock.isLocked())
  }

  const observer = new MutationObserver(refresh)
  observer.observe(element, { attributes: true, attributeFilter: WATCHED })
  // Popovers open and close without an attribute change.
  element.addEventListener('toggle', refresh)

  // resetScrollLock() released the lock behind this element's back.
  const stopReset = onReset(() => {
    if (lock.isLocked()) return
    clearRegions()
    state.update(false)
  })

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
      clearRegions()
      lock.destroy()
      state.destroy()
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
  const watchers = new Map<Element, () => void>()
  const controller = autoInit({
    selector: `[${ATTRIBUTE}]`,
    init: element => {
      const watcher = watchOne(element, watch)
      watchers.set(element, watcher.refresh)
      return () => {
        watchers.delete(element)
        watcher.destroy()
      }
    },
    ...(root ? { root } : {}),
    ...(observe === undefined ? {} : { observe }),
  })
  return {
    refresh: () => {
      controller.refresh()
      for (const [element, refresh] of watchers) {
        if (watch.target !== undefined || element.hasAttribute(TARGET)) refresh()
      }
    },
    destroy: controller.destroy,
  }
}
