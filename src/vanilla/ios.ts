/*!
 * The Mobile Safari scroll prevention below is adapted from:
 * - vaul (https://github.com/emilkowalski/vaul), `use-prevent-scroll.ts` and
 *   `use-position-fixed.ts`. MIT License, Copyright (c) 2023 Emil Kowalski.
 * - React Spectrum (https://github.com/adobe/react-spectrum), `usePreventScroll.ts`,
 *   which vaul's version is based on. Apache License 2.0, Copyright 2020 Adobe.
 * Changes: React hooks replaced by plain functions, shared ownership for nested
 * locks, pending `visualViewport` listeners removed on release, and scroll
 * restoration that ignores `scroll-behavior: smooth`. See LICENSE.md.
 */

import { hasScrollRegions, isAllowedScrollContainer } from './regions.js'

// Space kept between a focused input and the software keyboard.
const KEYBOARD_BUFFER = 24

// Input types that do not open the software keyboard.
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
  'button',
  'submit',
  'reset',
])

type Cleanup = () => void

/** Run every cleanup in order; one that throws does not stop the rest. */
export const chain =
  (...cleanups: Array<Cleanup | null | undefined>): Cleanup =>
  () => {
    for (const cleanup of cleanups) {
      try {
        cleanup?.()
      } catch (error) {
        console.warn('[@samline/scroll-lock] cleanup failed:', error)
      }
    }
  }

/** Scroll the window without animation, whatever `scroll-behavior` says. */
export const jump = (left: number, top: number): void => {
  try {
    window.scrollTo({ left, top, behavior: 'instant' })
  } catch {
    // Browsers that predate `behavior: 'instant'` reject it as an invalid enum.
    window.scrollTo(left, top)
  }
}

/** Set an inline style and return a function that puts the previous one back. */
export const setStyle = (
  element: HTMLElement,
  property: string,
  value: string,
  priority = ''
): Cleanup => {
  const previous = element.style.getPropertyValue(property)
  const previousPriority = element.style.getPropertyPriority(property)
  element.style.setProperty(property, value, priority)
  return () => {
    if (previous) element.style.setProperty(property, previous, previousPriority)
    else element.style.removeProperty(property)
  }
}

const listen = <K extends keyof DocumentEventMap>(
  target: Document | Window,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options: boolean | AddEventListenerOptions
): Cleanup => {
  target.addEventListener(type, handler as EventListener, options)
  return () => target.removeEventListener(type, handler as EventListener, options)
}

const isScrollable = (element: Element): boolean => {
  const style = getComputedStyle(element)
  return /(auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY)
}

/** The nearest scrollable ancestor (or `element` itself with `self`). */
export const scrollParent = (element: Element, self = false): Element => {
  let node: Element | null = self ? element : element.parentElement
  while (node && !isScrollable(node)) node = node.parentElement
  return node ?? document.scrollingElement ?? document.documentElement
}

const isPage = (element: Element | undefined): boolean =>
  !element || element === document.documentElement || element === document.body

export const isTextInput = (target: EventTarget | null): target is HTMLElement =>
  (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)) ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable === true)

// Scroll each scrollable ancestor of `target` so it sits above the keyboard,
// without scrolling the page.
const scrollIntoView = (target: Element): void => {
  const root = document.scrollingElement ?? document.documentElement
  let current: Element | null = target
  while (current && current !== root) {
    const scrollable = scrollParent(current)
    if (!isPage(scrollable) && scrollable !== current && isAllowedScrollContainer(scrollable)) {
      const box = scrollable.getBoundingClientRect()
      const rect = current.getBoundingClientRect()
      if (rect.bottom > box.bottom + KEYBOARD_BUFFER) scrollable.scrollTop += rect.top - box.top
    }
    current = scrollable.parentElement
  }
}

/**
 * Keep the page still in Mobile Safari, where `overflow: hidden` on the root
 * is not enough:
 *
 * 1. The page always scrolls while the toolbars collapse.
 * 2. With the keyboard open, the covered part of the viewport scrolls.
 * 3. Tapping an input scrolls the page to center it, even past fixed elements.
 * 4. The keyboard's next and previous buttons scroll the whole page.
 *
 * The workaround:
 *
 * 1. Cancel `touchmove` outside scrollable elements.
 * 2. Cancel `touchmove` at the top or bottom edge of a scrollable element, so
 *    the page does not take over (this disables edge bounce, the best we can do).
 * 3. Cancel `touchend` on inputs and focus them ourselves.
 * 4. Move a focusing input up with a transform so Safari does not scroll to it,
 *    then scroll it into view inside its own scroll container.
 * 5. Offset `<body>` by the scroll position and scroll the window to 0, so the
 *    real scroll position is always zero.
 * 6. As a last resort, scroll the window back to the top on `scroll`.
 *
 * Returns the release, which restores the styles and the scroll position.
 */
export const preventScrollMobileSafari = (gap: number): Cleanup => {
  let scrollable: Element | undefined
  let lastY = 0
  // A focus waits for the keyboard (a visualViewport resize) that may never
  // come; each waiting listener is removed on release.
  const pending = new Set<Cleanup>()

  const onTouchStart = (event: TouchEvent) => {
    scrollable = event.target instanceof Element ? scrollParent(event.target, true) : undefined
    if (isPage(scrollable)) return
    const touch = event.changedTouches[0]
    if (touch) lastY = touch.pageY
  }

  const onTouchMove = (event: TouchEvent) => {
    if (hasScrollRegions()) return
    if (isPage(scrollable)) {
      if (event.cancelable) event.preventDefault()
      return
    }
    const touch = event.changedTouches[0]
    const element = scrollable as Element
    const bottom = element.scrollHeight - element.clientHeight
    if (!touch || bottom === 0) return
    const y = touch.pageY
    const top = element.scrollTop
    if (((top <= 0 && y > lastY) || (top >= bottom && y < lastY)) && event.cancelable) {
      event.preventDefault()
    }
    lastY = y
  }

  const onTouchEnd = (event: TouchEvent) => {
    const target = event.target
    if (!isTextInput(target) || target === document.activeElement) return
    if (event.cancelable) event.preventDefault()
    // The transform has to be in place before the focus event.
    target.style.transform = 'translateY(-2000px)'
    target.focus()
    requestAnimationFrame(() => {
      target.style.transform = ''
    })
  }

  const onFocus = (event: FocusEvent) => {
    const target = event.target
    if (!isTextInput(target)) return
    // Also for focus that does not come from a tap (keyboard next/previous).
    target.style.transform = 'translateY(-2000px)'
    requestAnimationFrame(() => {
      target.style.transform = ''
      const viewport = window.visualViewport
      if (!viewport) return
      if (viewport.height < window.innerHeight) {
        // The keyboard is open: wait one more frame for the transform to go.
        requestAnimationFrame(() => scrollIntoView(target))
        return
      }
      // Wait for the keyboard to open so the position can be measured.
      const onResize = () => {
        stop()
        scrollIntoView(target)
      }
      const stop = () => {
        viewport.removeEventListener('resize', onResize)
        pending.delete(stop)
      }
      viewport.addEventListener('resize', onResize)
      pending.add(stop)
    })
  }

  const onWindowScroll = () => jump(0, 0)

  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const html = document.documentElement
  const body = document.body

  const restoreStyles = chain(
    gap > 0 ? setStyle(html, 'padding-right', `${gap}px`) : null,
    // A body already pinned by positionFixed carries the offset itself.
    body.style.position !== 'fixed' ? setStyle(body, 'margin-top', `${-scrollY}px`) : null
  )

  jump(0, 0)

  const removeEvents = chain(
    listen(document, 'touchstart', onTouchStart, { passive: false, capture: true }),
    listen(document, 'touchmove', onTouchMove, { passive: false, capture: true }),
    listen(document, 'touchend', onTouchEnd, { passive: false, capture: true }),
    listen(document, 'focus', onFocus, true),
    listen(window, 'scroll', onWindowScroll, false),
    () => Array.from(pending).forEach(stop => stop())
  )

  return () => {
    removeEvents()
    restoreStyles()
    jump(scrollX, scrollY)
  }
}

/**
 * Pin `<body>` with `position: fixed`, offset by the scroll position, so the
 * page cannot move (vaul#433, vaul#435). Returns the release, which unpins it
 * and scrolls back.
 */
export const pinBody = (): Cleanup => {
  const body = document.body
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  const innerHeight = window.innerHeight
  const important = 'important'

  const restoreStyles = chain(
    setStyle(body, 'position', 'fixed', important),
    setStyle(body, 'top', `${-scrollY}px`, important),
    setStyle(body, 'left', `${-scrollX}px`, important),
    setStyle(body, 'right', '0px', important),
    setStyle(body, 'height', 'auto', important)
  )

  // Safari may show its bottom bar while pinning; when it did, the visible
  // page moved by its height, so move the body with it.
  let frame = 0
  const timer = window.setTimeout(() => {
    frame = requestAnimationFrame(() => {
      const bar = innerHeight - window.innerHeight
      if (bar && scrollY >= innerHeight) {
        body.style.setProperty('top', `${-(scrollY + bar)}px`, important)
      }
    })
  }, 300)

  return () => {
    clearTimeout(timer)
    cancelAnimationFrame(frame)
    restoreStyles()
    jump(scrollX, scrollY)
  }
}
