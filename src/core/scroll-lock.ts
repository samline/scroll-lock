/**
 * DOM-free part of @samline/scroll-lock: names, option types, defaults and
 * the pure platform checks the DOM layer feeds with `navigator` values.
 */

/** Marks an element that locks the page while it is open. */
export const ATTRIBUTE = 'data-scroll-lock'

/**
 * State attribute: `"locked"` on `<html>` while any lock is held, and
 * `"locked"` or `"unlocked"` on each element watched by `scrollLock()`.
 */
export const STATE_ATTRIBUTE = 'data-scroll-lock-state'

/**
 * Custom property set on `<html>` while locked: the width, in pixels, of the
 * scrollbar the lock removed (`0px` when nothing was compensated). Use it to
 * keep fixed elements in place: `padding-right: var(--scroll-lock-gap, 0px)`.
 */
export const GAP_PROPERTY = '--scroll-lock-gap'

/**
 * - `auto`: `ios` on iPhone and iPad (Safari and every other iOS browser,
 *   which all run WebKit), `overflow` everywhere else.
 * - `overflow`: `overflow: hidden` on `<html>`.
 * - `ios`: the Mobile Safari workaround (touch and focus handling) that keeps
 *   the page still where `overflow: hidden` does not.
 */
export type ScrollLockMode = 'auto' | 'overflow' | 'ios'

/**
 * Pin `<body>` with `position: fixed` while locked, offset by the scroll
 * position so nothing moves, and scroll back on release.
 *
 * - `never` (default)
 * - `safari`: only in Safari (macOS and iOS) outside installed web apps,
 *   where it avoids toolbar and keyboard jumps.
 * - `always`: in every browser.
 */
export type PositionFixed = 'never' | 'safari' | 'always'

export interface ScrollLockOptions {
  /** Locking strategy. Defaults to `'auto'`. */
  mode?: ScrollLockMode
  /**
   * Add the removed scrollbar's width to `<body>`'s right padding so the page
   * does not shift. Skipped when `<html>` already reserves the gutter with
   * `scrollbar-gutter: stable`. Defaults to `true`.
   */
  reserveGap?: boolean
  /** Pin `<body>` with `position: fixed`. Defaults to `'never'`. */
  positionFixed?: PositionFixed
}

export const DEFAULTS: Required<ScrollLockOptions> = {
  mode: 'auto',
  reserveGap: true,
  positionFixed: 'never',
}

export const MODES: readonly ScrollLockMode[] = ['auto', 'overflow', 'ios']
export const POSITION_FIXED: readonly PositionFixed[] = ['never', 'safari', 'always']

/** Merge options over the defaults, ignoring `undefined` values. */
export const resolveOptions = (options: ScrollLockOptions = {}): Required<ScrollLockOptions> => ({
  mode: options.mode ?? DEFAULTS.mode,
  reserveGap: options.reserveGap ?? DEFAULTS.reserveGap,
  positionFixed: options.positionFixed ?? DEFAULTS.positionFixed,
})

/** The `navigator` values the platform checks need. */
export interface PlatformInfo {
  userAgent: string
  platform: string
  maxTouchPoints: number
  /** True in an installed web app (`display-mode: standalone`). */
  standalone?: boolean
}

/** iPhone or iPad, including iPadOS reporting itself as a Mac. */
export const isIOS = ({ platform, maxTouchPoints }: PlatformInfo): boolean =>
  /^iP(hone|ad|od)/.test(platform) || (/^Mac/.test(platform) && maxTouchPoints > 1)

/** Safari on macOS or iOS (not Chrome, not Android browsers). */
export const isSafari = ({ userAgent }: PlatformInfo): boolean =>
  /^((?!chrome|android).)*safari/i.test(userAgent)

/** The strategy `mode` stands for on this platform. */
export const resolveMode = (mode: ScrollLockMode, info: PlatformInfo): 'overflow' | 'ios' =>
  mode === 'auto' ? (isIOS(info) ? 'ios' : 'overflow') : mode

/** Whether `positionFixed` applies on this platform. */
export const usesPositionFixed = (value: PositionFixed, info: PlatformInfo): boolean =>
  value === 'always' || (value === 'safari' && isSafari(info) && info.standalone !== true)
