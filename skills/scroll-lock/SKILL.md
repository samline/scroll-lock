---
name: scroll-lock
description: Use @samline/scroll-lock to lock the page scroll while modals, drawers and menus are open, with nested locks, scrollbar gap compensation, scroll restoration and the iOS Safari workaround, in vanilla JavaScript or plain HTML.
package-version: '1.2.0'
---

# @samline/scroll-lock

Build against the installed version; this skill describes 1.2.0.

- **Install:** `npm install @samline/scroll-lock`. Plain HTML: load `https://cdn.jsdelivr.net/npm/@samline/scroll-lock@1.2.0/dist/browser/scroll-lock.global.js`; it watches `[data-scroll-lock]` on its own (`data-manual` on the script tag, then `ScrollLock.auto(options)`, to pass options). `ScrollLock.lock()` / `ScrollLock.unlock()` hold one shared lock for inline handlers. No stylesheet.
- **Markup:** `data-scroll-lock` on a `<dialog>`, `<details>`, `[popover]` or any element locks the page while it is open: the `open` attribute, `:popover-open`, or otherwise no `hidden` and no `aria-hidden="true"`. `data-scroll-lock="false"` turns it off. Per-element attributes win over options: `data-scroll-lock-mode`, `-gap`, `-position-fixed`.
- **Script:** `const release = lockScroll(options)` (release is idempotent); `createScrollLock(options)` returns `{ lock, unlock, toggle(force?), isLocked, destroy }` holding at most one lock; `scrollLock(target, { isOpen, ...options })` returns `{ refresh, isLocked, destroy }` (call `refresh()` after changing what a custom `isOpen` reads); `autoScrollLock({ root, observe, ...options })` returns `{ refresh, destroy }`; `isScrollLocked()`; `resetScrollLock()` releases every lock.
- **Lifetime:** pass `signal` to `lockScroll()` to release its own lock on abort, or to `createScrollLock()` to destroy the controller. Create a fresh abort controller when a view reopens. `getScrollLockState()` returns a fresh `{ locked, count }` snapshot, also available on `window.ScrollLock`.
- **Regions:** pass `allowScroll` as an element, selector or array of both, or put `data-scroll-lock-allow="#list, #picker"` on a watched element. The latest explicit lock controls regions, and releasing it restores the previous policy. An empty list allows no region. Give each region a bounded size, `overflow: auto`, `overscroll-behavior: contain` and keyboard access.
- **Options:** `mode: 'auto' | 'overflow' | 'ios'` (auto = the iOS workaround on iPhone/iPad, `overflow: hidden` on `<html>` elsewhere); `reserveGap: true` adds the scrollbar width to `<body>` padding-right (skipped with `scrollbar-gutter: stable`); `positionFixed: 'never' | 'safari' | 'always'` pins `<body>` and restores the position on release (`safari` skips installed web apps).
- **Nesting:** every lock counts; the page unlocks after the last release, in any order. Each effect (overflow, iOS workaround, pin) is shared by the locks that asked for it, and the first lock that needs it captures the scroll position.
- **State:** `data-scroll-lock-state="locked"` on `<html>` while any lock is held; `locked` / `unlocked` on watched elements. `--scroll-lock-gap` on `<html>` is the removed scrollbar width: use `padding-right: var(--scroll-lock-gap, 0px)` on fixed headers.
- **Scope:** it only stops page scroll. Focus trapping, `inert` background, Escape and focus return belong to the dialog (`<dialog>.showModal()` does them).
- **Do not** toggle `overflow` on `<body>` yourself next to it, call `lockScroll()` on every render without releasing, or release another component's lock with `resetScrollLock()` in normal flows (keep it for route changes). **Do not** use `scrollTo` to restore the position yourself; the release does it.
