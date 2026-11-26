---
title: 'Configuration'
description: Every @samline/scroll-lock option and data attribute, the state attribute on html and elements, and the --scroll-lock-gap custom property.
locale: en
sidebar:
  group: reference
  order: 2
  label: Options
---

## Options

Every function that locks takes the same options.

| Option          | Type                              | Default   | Effect                                                                                                                |
| --------------- | --------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| `mode`          | `'auto' \| 'overflow' \| 'ios'`   | `'auto'`  | `auto` uses the iOS workaround on iPhone and iPad and `overflow: hidden` on `<html>` elsewhere.                       |
| `reserveGap`    | `boolean`                         | `true`    | Add the removed scrollbar's width to `<body>`'s right padding. Skipped with `scrollbar-gutter: stable`.               |
| `positionFixed` | `'never' \| 'safari' \| 'always'` | `'never'` | Pin `<body>` with `position: fixed` and scroll back on release. `safari` skips other browsers and installed web apps. |

`lockScroll` and `createScrollLock` also take a JavaScript `signal`. Abort it to release the individual lock or destroy the controller, respectively.

`scrollLock` and `autoScrollLock` also take `isOpen(element)`. `autoScrollLock` takes `root` and `observe`. See the [API reference](../api/).

## Allowed scroll regions

`lockScroll`, `createScrollLock`, `scrollLock` and `autoScrollLock` accept `allowScroll`:

```ts
type ScrollLockRegions = string | Element | readonly (string | Element)[]

interface ScrollLockRegionOptions extends ScrollLockOptions {
  allowScroll?: ScrollLockRegions
}
```

```js
const release = lockScroll({ allowScroll: [orderList, '#country-picker-list'] })
```

Selectors match the elements on the gesture's path, including elements mounted after the lock. A region can be elsewhere in the document, such as a picker rendered next to a panel. Use a selector or an element for each scroll container you want to allow. An empty array or an empty `data-scroll-lock-allow` blocks scroll gestures in every region. A selector with no matches also blocks them until a matching region appears.

The most recent active lock with an explicit policy wins. A lock with `allowScroll` omitted leaves the current policy in place. On release, the previous explicit policy resumes. When all explicit policies are gone, the original platform behavior resumes. Editing `data-scroll-lock-allow` updates the same layer in place. A watched element's attribute takes precedence over its JavaScript option.

The policy covers wheel, single-finger panning and scrolling keys. Pinch zoom, text editing and button activation keep their native behavior. The policy applies to user gestures. Application code can still set scroll positions directly.

Set a bounded size and `overflow: auto` on each region. Use `overscroll-behavior: contain` on its outer scroll container to keep native momentum from chaining into a surrounding scroller. A region with `tabindex="0"` and an accessible name can also receive keyboard scroll commands. See the [checkout example](../../guides/examples/#guide-regions).

```css
.checkout-list {
  max-block-size: 12rem;
  overflow: auto;
  overscroll-behavior: contain;
}
```

## Panel targets

Pass a connected HTML scroll container in the current document or a CSS selector in `target`. Omitting `target` locks the page.

```ts
type ScrollLockTarget = HTMLElement | string

interface ScrollLockScopeOptions extends ScrollLockRegionOptions {
  target?: ScrollLockTarget
}
```

```html
<details data-scroll-lock data-scroll-lock-target="#inbox-list">
  <summary>Freeze inbox list</summary>
</details>
<div id="inbox-list" class="checkout-list" tabindex="0" role="region" aria-label="Inbox">…</div>
```

The `target` is the container receiving the lock. The `root` option of `autoScrollLock` scopes the search for watched elements. A target selector in JavaScript resolves when the lock is acquired. When a selector belongs to a watched element, the search runs in its document or shadow root. Call `refresh()` on its watcher if you replace the target while the overlay stays open. A missing or invalid target, including an empty selector, acquires no lock.

The first lock on a panel sets its gutter policy and records its horizontal and vertical positions. The last one restores the positions and the original inline styles. When `reserveGap` is enabled, the panel keeps its native gutter where supported. Panel locks use local overflow and gutter styles. `mode`, `positionFixed` and `allowScroll` apply to page locks. Nested scroll containers keep their native behavior. An application can still set a panel's position programmatically while it is locked.

Queries without a target read the page. A reset without a target releases both page and panel locks. Pass a panel to reset it independently. See the [inbox](../../guides/examples/#guide-inbox) and [editor](../../guides/examples/#guide-editor) examples.

## Attributes

| Attribute                         | Values                      | Effect                                                      |
| --------------------------------- | --------------------------- | ----------------------------------------------------------- |
| `data-scroll-lock`                | present, `true` or `false`  | Watched by `autoScrollLock`. `false` turns the element off. |
| `data-scroll-lock-mode`           | `auto`, `overflow`, `ios`   | `mode` for this element.                                    |
| `data-scroll-lock-gap`            | `true`, `false`             | `reserveGap` for this element.                              |
| `data-scroll-lock-position-fixed` | `never`, `safari`, `always` | `positionFixed` for this element.                           |
| `data-scroll-lock-allow`          | CSS selector list or empty  | Override `allowScroll` for this element.                    |
| `data-scroll-lock-target`         | CSS selector                | Override `target` for this element.                         |

Attributes win over options. Changing one while the element is open takes the new lock before releasing the old one, so the page never unlocks in between.

```html
<dialog data-scroll-lock data-scroll-lock-position-fixed="safari">…</dialog>
```

## State

| Where           | Attribute                | Values                                                  |
| --------------- | ------------------------ | ------------------------------------------------------- |
| `<html>`        | `data-scroll-lock-state` | `locked` while a page lock is held.                     |
| Watched element | `data-scroll-lock-state` | `locked` while it holds its lock, `unlocked` otherwise. |
| Target panel    | `data-scroll-lock-state` | `locked` while a panel lock is held.                    |

When an element is both a watcher and a locked panel, its state stays `locked` until it meets neither condition. Cleanup restores its original attribute.

```css
html[data-scroll-lock-state='locked'] .chat-widget {
  visibility: hidden;
}
```

## `--scroll-lock-gap`

While locked, `<html>` carries `--scroll-lock-gap`: the width of the scrollbar the lock removed, in pixels (`0px` when nothing was compensated). Fixed and sticky elements are outside `<body>`'s padding, so pad them with it:

```css
.site-header {
  padding-right: var(--scroll-lock-gap, 0px);
}
```

A locked panel exposes the same property with its own measured inline gutter. The panel reserves its space through `scrollbar-gutter`, so its contents can rely on that gutter without adding padding.
