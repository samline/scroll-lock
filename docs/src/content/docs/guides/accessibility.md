---
title: 'Accessibility'
description: What @samline/scroll-lock does for assistive technology, keyboard and motion, and what your dialog or overlay still has to provide.
locale: en
sidebar:
  group: guides
  order: 3
  label: Accessibility
---

## Responsibilities

A scroll lock stops the page behind an overlay from moving. It does not make the overlay accessible on its own.

| Concern                        | Who handles it                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Page scroll behind the overlay | The lock: wheel, touch, keyboard and scrollbar, on desktop and iOS.                               |
| Scrolling inside the overlay   | Keeps working; on iOS, scrollable areas scroll, the page does not.                                |
| Focus inside the overlay       | Your dialog: `<dialog>.showModal()` traps focus and returns it on close.                          |
| Background hidden from AT      | `showModal()` makes the rest of the page inert; add `inert` for custom overlays.                  |
| Escape and light dismiss       | `<dialog>`, `popover` or your own handler. The lock follows them when you use `data-scroll-lock`. |
| A name for the overlay         | `aria-labelledby` or `aria-label` on the dialog.                                                  |

## Keyboard

`overflow: hidden` on `<html>` also stops Page Down, Space and the arrow keys from scrolling the page, while focused elements inside the overlay keep their keys.

## Motion

A lock moves nothing visible: the page stays where it was while locked and returns without animation on release, so there is nothing for `prefers-reduced-motion` to reduce. Your overlay's own transitions still need to respect it.

## Without JavaScript

The page keeps scrolling behind the overlay, as it would without the package. Content is never hidden by the lock.
