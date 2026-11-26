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

## Attributes

| Attribute                         | Values                      | Effect                                                      |
| --------------------------------- | --------------------------- | ----------------------------------------------------------- |
| `data-scroll-lock`                | present, `true` or `false`  | Watched by `autoScrollLock`. `false` turns the element off. |
| `data-scroll-lock-mode`           | `auto`, `overflow`, `ios`   | `mode` for this element.                                    |
| `data-scroll-lock-gap`            | `true`, `false`             | `reserveGap` for this element.                              |
| `data-scroll-lock-position-fixed` | `never`, `safari`, `always` | `positionFixed` for this element.                           |

Attributes win over options. Changing one while the element is open takes the new lock before releasing the old one, so the page never unlocks in between.

```html
<dialog data-scroll-lock data-scroll-lock-position-fixed="safari">…</dialog>
```

## State

| Where           | Attribute                | Values                                                  |
| --------------- | ------------------------ | ------------------------------------------------------- |
| `<html>`        | `data-scroll-lock-state` | `locked` while any lock is held, absent otherwise.      |
| Watched element | `data-scroll-lock-state` | `locked` while it holds its lock, `unlocked` otherwise. |

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
