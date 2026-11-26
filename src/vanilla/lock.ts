import { isBrowser, noop } from '@samline/internal'

import {
  GAP_PROPERTY,
  resolveMode,
  resolveOptions,
  usesPositionFixed,
} from '../core/scroll-lock.js'
import type { PlatformInfo } from '../core/scroll-lock.js'
import { chain, pinBody, preventScrollMobileSafari, setStyle } from './ios.js'
import { lockPanel, resolveLockTarget } from './panel.js'
import type { ScrollLockTarget } from './panel.js'
import { registerScrollRegions } from './regions.js'
import type { ScrollLockRegionOptions } from './regions.js'
import { markLocked } from './state.js'

type Cleanup = () => void

export interface ScrollLockScopeOptions extends ScrollLockRegionOptions {
  /** An independent scroll container. Omit to lock the page. */
  target?: ScrollLockTarget
}

export interface ScrollLockLifecycleOptions extends ScrollLockScopeOptions {
  /** Abort to release an individual lock or destroy its controller. */
  signal?: AbortSignal
}

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

const panels = new WeakMap<HTMLElement, Shared>()
/** Every held lock and its scope, in acquisition order. */
const holders = new Map<Cleanup, HTMLElement | undefined>()

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

const acquirePage = (options: ScrollLockRegionOptions): Cleanup => {
  const { mode, reserveGap, positionFixed } = resolveOptions(options)
  const info = platform()

  // Pin first: the iOS workaround scrolls to the top, and the pin has to
  // capture the real position before that.
  const marked = acquire(state, () => markLocked(document.documentElement))
  const pinned = usesPositionFixed(positionFixed, info) ? acquire(fixed, pinBody) : null
  const locked =
    resolveMode(mode, info) === 'ios'
      ? acquire(ios, () => lockIOS(reserveGap))
      : acquire(overflow, () => lockOverflow(reserveGap))
  const regions = options.allowScroll
  const forgetRegions = regions === undefined ? null : registerScrollRegions(() => regions)

  // Release in reverse: the iOS workaround scrolls back before the unpin.
  return chain(forgetRegions, locked, pinned, marked)
}

const acquirePanel = (target: HTMLElement, options: ScrollLockScopeOptions): Cleanup => {
  let effect = panels.get(target)
  if (!effect) {
    effect = shared()
    panels.set(target, effect)
  }
  return acquire(effect, () => lockPanel(target, options.reserveGap ?? true))
}

const acquireScrollLock = (
  options: ScrollLockScopeOptions,
  target: HTMLElement | undefined,
  signal?: AbortSignal,
  onRelease?: Cleanup
): Cleanup => {
  const undo = target ? acquirePanel(target, options) : acquirePage(options)
  const release = (): void => {
    if (!holders.delete(release)) return
    signal?.removeEventListener('abort', release)
    chain(undo, onRelease)()
  }
  holders.set(release, target)
  if (signal?.aborted) release()
  else signal?.addEventListener('abort', release)
  return release
}

/** Lock the page or a panel until released or aborted. */
export const lockScroll = (options: ScrollLockLifecycleOptions = {}): Cleanup => {
  if (!isBrowser() || options.signal?.aborted) return noop
  const target = resolveLockTarget(options.target)
  return target === null || target?.isConnected === false
    ? noop
    : acquireScrollLock(options, target, options.signal)
}

const lockCount = (target?: ScrollLockTarget): number => {
  if (target === undefined) return state.count
  if (!isBrowser()) return 0
  const element = resolveLockTarget(target)
  return element ? (panels.get(element)?.count ?? 0) : 0
}

/** True while at least one lock is held for this scope. */
export const isScrollLocked = (target?: ScrollLockTarget): boolean => lockCount(target) > 0

export interface ScrollLockState {
  readonly locked: boolean
  readonly count: number
}

/** Snapshot of currently held locks for the page or the requested panel. */
export const getScrollLockState = (target?: ScrollLockTarget): ScrollLockState => {
  const count = lockCount(target)
  return { locked: count > 0, count }
}

/**
 * Release every lock at once, for example after a client-side navigation left
 * one behind. Controllers that held one report themselves unlocked.
 */
export const resetScrollLock = (target?: ScrollLockTarget): void => {
  if (target !== undefined && !isBrowser()) return
  const scope = target === undefined ? undefined : resolveLockTarget(target, document)
  if (scope === null) return
  for (const [release, lockedTarget] of Array.from(holders).reverse()) {
    if (scope === undefined || scope === lockedTarget) release()
  }
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
export const createScrollLock = (options: ScrollLockLifecycleOptions = {}): ScrollLock => {
  const { signal } = options
  let release: Cleanup | null = null
  let destroyed = signal?.aborted ?? false
  const active = !destroyed && isBrowser()
  const lock = () => {
    if (destroyed || release || !isBrowser()) return
    const target = resolveLockTarget(options.target)
    if (target === null || target?.isConnected === false) return
    release = acquireScrollLock(options, target, undefined, () => {
      release = null
    })
    if (destroyed) unlock()
  }
  const unlock = () => {
    release?.()
    release = null
  }
  const destroy = () => {
    if (destroyed) return
    destroyed = true
    signal?.removeEventListener('abort', destroy)
    unlock()
  }
  if (active) signal?.addEventListener('abort', destroy)

  return {
    lock,
    unlock,
    toggle: (force?: boolean) => ((force ?? !release) ? lock() : unlock()),
    isLocked: () => release !== null,
    destroy,
  }
}
