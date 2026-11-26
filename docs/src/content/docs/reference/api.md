---
title: 'API reference'
titleAccent: 'reference'
description: Every @samline/scroll-lock export, lockScroll, createScrollLock, scrollLock, autoScrollLock, their types and the window.ScrollLock global.
locale: en
sidebar:
  group: reference
  order: 1
---

## lockScroll(options?)

```ts
lockScroll(options?: ScrollLockLifecycleOptions): () => void

interface ScrollLockLifecycleOptions extends ScrollLockRegionOptions {
  signal?: AbortSignal
}
```

Locks the page and returns the release. See [Options](../configuration/).

```js
import { lockScroll } from '@samline/scroll-lock'

const unlock = lockScroll()
drawer.addEventListener('close', unlock, { once: true })
```

Locks nest: the page unlocks after the last release, in any order. Calling a release twice does nothing. Without a DOM it returns a no-op. It is also the default export of `@samline/scroll-lock/vanilla`.

Pass `signal` to release this lock on abort. An already-aborted signal returns a no-op release. You can still release manually before the signal aborts.

## createScrollLock(options?)

```ts
createScrollLock(options?: ScrollLockLifecycleOptions): ScrollLock

interface ScrollLock {
  lock(): void
  unlock(): void
  toggle(force?: boolean): void
  isLocked(): boolean
  destroy(): void
}
```

A controller that holds at most one lock. `lock()` while locked and `unlock()` while unlocked do nothing, so a component can call them on every open and close without counting. `toggle(true)` locks, `toggle(false)` unlocks. `destroy()` releases the lock and ignores later `lock()` calls; it is idempotent.

Pass `signal` to destroy the controller when the signal aborts, even if it is currently unlocked. An already-aborted signal creates an inert controller.

## scrollLock(target, options?)

```ts
scrollLock(target: Element | string | Iterable<Element> | ArrayLike<Element>, options?: ScrollLockWatchOptions): ScrollLockController

interface ScrollLockWatchOptions extends ScrollLockRegionOptions {
  isOpen?: (element: Element) => boolean
}

interface ScrollLockController {
  refresh(): void
  isLocked(): boolean
  destroy(): void
}
```

Locks the page while an element is open. Each element holds its own lock, so several watched elements unlock in any order. An element counts as open when:

- `<dialog>` and `<details>`: it has the `open` attribute.
- `[popover]`: it matches `:popover-open`.
- Any other element: it has no `hidden` attribute and no `aria-hidden="true"`.
- With `isOpen`, whatever your function returns.

Changes to `open`, `hidden`, `aria-hidden`, `class`, `style`, the `data-scroll-lock-*` attributes and the `toggle` event are picked up on their own. Call `refresh()` after changing anything else your `isOpen` reads. Each element gets `data-scroll-lock-state="locked"` or `"unlocked"`. `destroy()` releases the locks, stops watching and restores the state attribute; it is idempotent. Call it before removing a watched element from the page; `autoScrollLock` does that for you.

## autoScrollLock(options?)

```ts
autoScrollLock(options?: AutoScrollLockOptions): { refresh(): void; destroy(): void }

interface AutoScrollLockOptions extends ScrollLockWatchOptions {
  root?: ParentNode
  observe?: boolean
}
```

Watches every `[data-scroll-lock]` element inside `root` (the document by default), as `scrollLock` does. With `observe` (the default), elements added later are watched too, and the lock of an element removed from the page is released. `refresh()` picks up elements added while `observe` is `false`.

## isScrollLocked()

```ts
isScrollLocked(): boolean
```

`true` while any lock is held, by any function of the package.

## getScrollLockState()

```ts
getScrollLockState(): ScrollLockState

interface ScrollLockState {
  readonly locked: boolean
  readonly count: number
}
```

Returns a fresh snapshot of all active page locks held by this package, including declarative watchers. Call again to read the new count after an acquisition or release. Without a DOM the snapshot is `{ locked: false, count: 0 }`.

## resetScrollLock()

```ts
resetScrollLock(): void
```

Releases every lock at once, for example after a client-side navigation unmounted an overlay without its cleanup. Controllers that held a lock report `isLocked() === false` and can lock again; watched elements get `data-scroll-lock-state="unlocked"` and lock again on their next change.

## isOpenElement(element)

```ts
isOpenElement(element: Element): boolean
```

The default `isOpen` of `scrollLock`, exported to build on: `isOpen: el => isOpenElement(el) && !el.classList.contains('closing')`.

## Platform helpers and constants

| Export                           | Value                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| `ATTRIBUTE`                      | `'data-scroll-lock'`                                                  |
| `STATE_ATTRIBUTE`                | `'data-scroll-lock-state'`                                            |
| `GAP_PROPERTY`                   | `'--scroll-lock-gap'`                                                 |
| `DEFAULTS`                       | `{ mode: 'auto', reserveGap: true, positionFixed: 'never' }`          |
| `MODES`, `POSITION_FIXED`        | The accepted values of `mode` and `positionFixed`.                    |
| `resolveOptions(options)`        | Options merged over `DEFAULTS`.                                       |
| `isIOS(info)`, `isSafari(info)`  | Pure checks on `{ userAgent, platform, maxTouchPoints, standalone }`. |
| `resolveMode(mode, info)`        | `'overflow'` or `'ios'`: what `mode` stands for on that platform.     |
| `usesPositionFixed(value, info)` | Whether `positionFixed` pins the body on that platform.               |

## Types

`ScrollLockOptions`, `ScrollLockRegionOptions`, `ScrollLockRegions`, `ScrollLockLifecycleOptions`, `ScrollLockState`, `ScrollLockMode`, `PositionFixed`, `PlatformInfo`, `ScrollLock`, `ScrollLockWatchOptions`, `AutoScrollLockOptions` and `ScrollLockController`.

## window.ScrollLock

The browser bundle (`dist/browser/scroll-lock.global.js`) defines `window.ScrollLock` and runs `autoScrollLock()` once the DOM is ready, unless the script tag has `data-manual`.

| Member                                                                                                | Purpose                                                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `lockScroll`, `createScrollLock`, `scrollLock`, `autoScrollLock`, `isScrollLocked`, `resetScrollLock` | The functions above.                                                            |
| `getScrollLockState()`                                                                                | Snapshot of the active page locks.                                              |
| `lock()`, `unlock()`                                                                                  | One shared lock for inline handlers. `lock()` twice still needs one `unlock()`. |
| `auto(options?)`                                                                                      | Start (or restart) watching `[data-scroll-lock]`. Returns the controller.       |
| `controller`                                                                                          | The controller of the automatic run, or `null`.                                 |
