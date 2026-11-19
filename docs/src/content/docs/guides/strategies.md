---
title: 'How it works'
titleAccent: 'works'
description: How @samline/scroll-lock nests locks, compensates the scrollbar, handles iOS Safari and pins the body, and when to change each default.
locale: en
sidebar:
  group: guides
  order: 2
  label: How it works
---

## Nested locks

Every call to `lockScroll()` returns its own release. The page stays locked while at least one lock is held, and unlocks after the last release, whatever the order:

```js
const drawer = lockScroll()
const dialog = lockScroll()

drawer() // still locked: the dialog holds a lock
dialog() // unlocked
drawer() // a second call does nothing
```

Each page-level effect is shared by the locks that asked for it: the first lock that needs the overflow lock, the iOS workaround or the body pin applies it, and the last one that needs it undoes it. A dialog that pins the body inside a drawer that does not still pins it, and unpins on its own release.

`createScrollLock()` wraps one lock for a component that opens and closes many times: `lock()` twice still holds one lock, and `unlock()` never releases somebody else's.

## The scrollbar gap

On systems with classic scrollbars, hiding the overflow removes the scrollbar and the page gets wider. The lock measures the scrollbar first (`innerWidth - clientWidth` of `<html>`), then adds it to `<body>`'s right padding, on top of the padding the page already has.

Fixed and sticky elements sit outside that padding. Use the custom property the lock sets on `<html>`:

```css
.site-header {
  padding-right: var(--scroll-lock-gap, 0px);
}
```

When `<html>` has `scrollbar-gutter: stable`, the gutter keeps its space anyway, so nothing is added and `--scroll-lock-gap` is `0px`. Turn the compensation off with `reserveGap: false` (or `data-scroll-lock-gap="false"`) when your layout handles it.

## iOS Safari

Mobile Safari scrolls the page even with `overflow: hidden`: while the toolbars collapse, under the software keyboard, when an input is focused and with the keyboard's next and previous buttons. With `mode: 'auto'` (the default), iPhone and iPad (including iPadOS, which reports itself as a Mac, and browser device emulation of either) use a workaround instead:

1. A touch that moves outside a scrollable element is cancelled.
2. Inside a scrollable element, a touch that would scroll past its top or bottom edge is cancelled, so the page does not take over. This disables the bounce at the edges.
3. Tapping an input focuses it directly, moved out of the way for a frame, so Safari does not scroll the page to it; the input is then scrolled into view inside its own container, above the keyboard.
4. The body is offset by the scroll position and the window scrolled to the top, so the real scroll position stays zero, and any stray scroll is undone.

On release the offset goes away and the page returns to its position. Chrome, Firefox and the other iOS browsers run on WebKit too, so the same workaround applies there.

Force a strategy with `mode: 'overflow'` or `mode: 'ios'` (or `data-scroll-lock-mode`), for example to test the iOS path on a desktop browser.

This workaround is adapted from [vaul](https://github.com/emilkowalski/vaul) and React Spectrum's `usePreventScroll`; their notices ship in the package's `LICENSE.md`.

## Pinning the body

`positionFixed` pins `<body>` with `position: fixed`, offset by the scroll position, so the page cannot move at all, and scrolls back on release:

- `'never'` (default): no pin.
- `'safari'`: only in Safari on macOS and iOS, outside installed web apps. It avoids jumps of Safari's toolbars and keyboard in drawers.
- `'always'`: every browser.

A pinned body loses `position: sticky` relative to the page and any styles that depend on `body` being static, so keep it for the cases that need it.

## Scroll position

The overflow lock keeps the scroll position in place. The iOS workaround and the pin move the page and put it back on release with an instant scroll, so `html { scroll-behavior: smooth }` does not animate the return.
