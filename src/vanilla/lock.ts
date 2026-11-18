import { isBrowser, noop } from '@samline/internal'

import {
  GAP_PROPERTY,
  STATE_ATTRIBUTE,
  resolveMode,
  resolveOptions,
  usesPositionFixed,
} from '../core/scroll-lock.js'
import type { PlatformInfo, ScrollLockOptions } from '../core/scroll-lock.js'
import { chain, pinBody, preventScrollMobileSafari, setStyle } from './ios.js'

type Cleanup = () => void

/**
 * One page-level effect shared by every lock that needs it: applied by the
 * first, undone by the last.
 */
interface Shared {
  count: number
  undo: Cleanup | null
}

const shared = (): Shared => ({ count: 0, undo: null })

const state = shared()
const overflow = shared()
const ios = shared()
const fixed = shared()

const acquire = (effect: Shared, apply: () => Cleanup): Cleanup => {
  if (effect.count++ === 0) effect.undo = apply()
  return () => {
    if (--effect.count > 0) return
    const undo = effect.undo
    effect.undo = null
    undo?.()
  }
}

/** Every held lock, so `resetScrollLock()` can release them all. */
const holders = new Set<Cleanup>()

const platform = (): PlatformInfo => ({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  standalone: typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
})

// Width of the vertical scrollbar the lock is about to remove. Zero when there
// is none, or when `scrollbar-gutter: stable` keeps its space anyway.
const scrollbarGap = (): number => {
  const html = document.documentElement
  if (/stable/.test(getComputedStyle(html).getPropertyValue('scrollbar-gutter'))) return 0
  return Math.max(0, window.innerWidth - html.clientWidth)
}

const markLocked = (): Cleanup => {
  const html = document.documentElement
  const previous = html.getAttribute(STATE_ATTRIBUTE)
  html.setAttribute(STATE_ATTRIBUTE, 'locked')
  return () => {
    if (previous === null) html.removeAttribute(STATE_ATTRIBUTE)
    else html.setAttribute(STATE_ATTRIBUTE, previous)
  }
}

const lockOverflow = (reserveGap: boolean): Cleanup => {
  const html = document.documentElement
  const body = document.body
  const gap = reserveGap ? scrollbarGap() : 0
  const padding = parseFloat(getComputedStyle(body).paddingRight) || 0
  return chain(
    setStyle(html, GAP_PROPERTY, `${gap}px`),
    gap > 0 ? setStyle(body, 'padding-right', `${padding + gap}px`) : null,
    setStyle(html, 'overflow', 'hidden')
  )
}

const lockIOS = (reserveGap: boolean): Cleanup => {
  const gap = reserveGap ? scrollbarGap() : 0
  return chain(
    setStyle(document.documentElement, GAP_PROPERTY, `${gap}px`),
    preventScrollMobileSafari(gap)
  )
}

/**
 * Lock the page scroll. Locks nest: the page stays locked until every lock is
 * released, and the first lock's scroll position comes back after the last.
 * Returns the release, which is safe to call more than once.
 *
 * Without a DOM it does nothing and returns a no-op.
 */
export const lockScroll = (options: ScrollLockOptions = {}): Cleanup => {
  if (!isBrowser()) return noop
  const { mode, reserveGap, positionFixed } = resolveOptions(options)
  const info = platform()

  // Pin first: the iOS workaround scrolls to the top, and the pin has to
  // capture the real position before that.
  const marked = acquire(state, markLocked)
  const pinned = usesPositionFixed(positionFixed, info) ? acquire(fixed, pinBody) : null
  const locked =
    resolveMode(mode, info) === 'ios'
      ? acquire(ios, () => lockIOS(reserveGap))
      : acquire(overflow, () => lockOverflow(reserveGap))

  // Release in reverse: the iOS workaround scrolls back before the unpin.
  const release = (): void => {
    if (!holders.delete(release)) return
    chain(locked, pinned, marked)()
  }
  holders.add(release)
  return release
}

/** True while at least one lock is held. */
export const isScrollLocked = (): boolean => holders.size > 0

/**
 * Release every lock at once, for example after a client-side navigation left
 * one behind. Controllers that held one report themselves unlocked.
 */
export const resetScrollLock = (): void => {
  for (const holder of Array.from(holders).reverse()) holder()
  for (const listener of Array.from(resetListeners)) listener()
}

const resetListeners = new Set<Cleanup>()

/** @internal Called after `resetScrollLock()`, so controllers can update. */
export const onReset = (listener: Cleanup): Cleanup => {
  resetListeners.add(listener)
  return () => resetListeners.delete(listener)
}

export interface ScrollLock {
  /** Take this controller's lock. Does nothing while it already holds it. */
  lock: () => void
  /** Release this controller's lock. Does nothing while it holds none. */
  unlock: () => void
  /** Lock when unlocked and the other way round, or force one with `force`. */
  toggle: (force?: boolean) => void
  /** True while this controller holds its lock. */
  isLocked: () => boolean
  /** Release the lock and stop. Safe to call more than once. */
  destroy: () => void
}

/**
 * A controller that holds at most one lock: call `lock()` and `unlock()` as
 * often as your modal opens and closes, and other controllers' locks are
 * never released by mistake.
 */
export const createScrollLock = (options: ScrollLockOptions = {}): ScrollLock => {
  let release: Cleanup | null = null
  let destroyed = false
  const stopReset = onReset(() => {
    release = null
  })

  const lock = () => {
    if (!destroyed && !release && isBrowser()) release = lockScroll(options)
  }
  const unlock = () => {
    release?.()
    release = null
  }

  return {
    lock,
    unlock,
    toggle: (force?: boolean) => ((force ?? !release) ? lock() : unlock()),
    isLocked: () => release !== null,
    destroy: () => {
      unlock()
      stopReset()
      destroyed = true
    },
  }
}
