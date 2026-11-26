# Changelog

All notable changes to this package. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [semver](https://semver.org/).

## [1.1.0] - 2026-11-25

### Added

- `lockScroll({ signal })` releases its lock on abort. `createScrollLock({ signal })` destroys its controller on abort.
- `getScrollLockState()` returns a snapshot with `locked` and the active lock `count`, in JavaScript modules and on `window.ScrollLock`.
- Live and copyable vanilla examples for view cleanup and animated overlay dismissal.

## [1.0.0] - 2026-11-18

### Added

- First release, the successor of the archived `disable-scroll.js`. The engine comes from `@samline/drawer` 6.0.1.
- `lockScroll(options)` locks the page and returns an idempotent release. Locks nest: the page unlocks after the last release, in any order.
- `createScrollLock(options)` returns `{ lock, unlock, toggle, isLocked, destroy }`, one lock per component.
- `scrollLock(target, options)` locks while an element is open (`open` on `<dialog>` and `<details>`, `:popover-open` on popovers, no `hidden` or `aria-hidden="true"` otherwise, or a custom `isOpen`), and returns `{ refresh, isLocked, destroy }`. `autoScrollLock(options)` watches every `[data-scroll-lock]`, including elements added later.
- `isScrollLocked()` and `resetScrollLock()`.
- Options `mode` (`auto`, `overflow`, `ios`), `reserveGap` and `positionFixed` (`never`, `safari`, `always`), and the attributes `data-scroll-lock-mode`, `data-scroll-lock-gap` and `data-scroll-lock-position-fixed`. `data-scroll-lock="false"` turns an element off.
- `data-scroll-lock-state` on `<html>` (`locked`) and on watched elements (`locked` or `unlocked`), and the `--scroll-lock-gap` custom property.
- The Mobile Safari workaround and the `position: fixed` body pin, adapted from vaul (MIT) and React Spectrum (Apache-2.0); their notices are in `LICENSE.md`.
- `window.ScrollLock` browser global with `lock()`, `unlock()`, `auto()` and `data-manual`.
