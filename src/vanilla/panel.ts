import { GAP_PROPERTY } from '../core/scroll-lock.js'
import { chain, setStyle } from './ios.js'
import { markLocked } from './state.js'

export type ScrollLockTarget = HTMLElement | string

/** Undefined is the page. An explicitly invalid target resolves to null. */
export const resolveLockTarget = (
  target?: ScrollLockTarget,
  root: ParentNode = document
): HTMLElement | null | undefined => {
  if (target === undefined) return undefined
  let element: Element | null
  try {
    element = typeof target === 'string' ? root.querySelector(target) : target
  } catch {
    return null
  }
  return element instanceof HTMLElement &&
    element.ownerDocument === document &&
    element !== document.documentElement &&
    element !== document.body
    ? element
    : null
}

const scrollbarGap = (element: HTMLElement): number => {
  const style = getComputedStyle(element)
  if (style.getPropertyValue('scrollbar-gutter').includes('stable')) return 0
  const verticalWriting = /^(vertical|sideways)/.test(style.writingMode)
  const size = verticalWriting
    ? element.offsetHeight - element.clientHeight
    : element.offsetWidth - element.clientWidth
  const start = verticalWriting ? style.borderTopWidth : style.borderLeftWidth
  const end = verticalWriting ? style.borderBottomWidth : style.borderRightWidth
  return Math.max(0, Math.round(size - (parseFloat(start) || 0) - (parseFloat(end) || 0)))
}

export const lockPanel = (element: HTMLElement, reserveGap: boolean): (() => void) => {
  const left = element.scrollLeft
  const top = element.scrollTop
  const gap = reserveGap ? scrollbarGap(element) : 0
  const gutter = gap ? setStyle(element, 'scrollbar-gutter', 'stable', 'important') : null
  const property = setStyle(element, GAP_PROPERTY, `${gap}px`)
  const x = setStyle(element, 'overflow-x', 'hidden', 'important')
  const y = setStyle(element, 'overflow-y', 'hidden', 'important')
  const marked = markLocked(element)

  return chain(marked, y, x, property, gutter, () => {
    if (element.scrollLeft === left && element.scrollTop === top) return
    try {
      element.scrollTo({ left, top, behavior: 'instant' })
    } catch {
      element.scrollLeft = left
      element.scrollTop = top
    }
  })
}
