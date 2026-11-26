import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createScrollLock, lockScroll, resetScrollLock, scrollLock } from '../src/index.js'
import { page, platform, reset } from './helpers.js'

const scroller = (id: string, parent: HTMLElement = document.body) => {
  const element = document.createElement('div')
  element.id = id
  element.tabIndex = 0
  element.style.overflowY = 'auto'
  Object.defineProperties(element, {
    scrollHeight: { value: 400 },
    clientHeight: { value: 100 },
  })
  parent.append(element)
  return element
}

const wheel = (target: Element, deltaY = 20, options: WheelEventInit = {}) =>
  !target.dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY, ...options })
  )

const key = (target: Element, key: string) =>
  !target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }))

beforeEach(() => {
  platform('windows')
  page()
})

afterEach(() => {
  resetScrollLock()
  reset()
})

describe('allowed scroll regions', () => {
  it('lets elements inside matching regions scroll and blocks outside or at a boundary', () => {
    const outside = scroller('outside')
    const inner = scroller('inner', outside)
    const child = document.createElement('span')
    inner.append(child)
    const other = scroller('other')
    const release = lockScroll({ allowScroll: ['#inner', other] })
    expect(wheel(outside)).toBe(true)
    expect(wheel(child)).toBe(false)
    expect(wheel(other)).toBe(false)
    expect(wheel(child, -20)).toBe(true)
    inner.scrollTop = 300
    expect(wheel(child)).toBe(true)
    expect(wheel(child, -20)).toBe(false)
    expect(wheel(outside, 20, { ctrlKey: true })).toBe(false)
    release()
    expect(wheel(outside)).toBe(false)
  })

  it('honors the latest explicit lock through either release order', () => {
    const first = scroller('first')
    const second = scroller('second')
    const cleanup = lockScroll({ allowScroll: first })
    const controller = createScrollLock({ allowScroll: second })
    controller.lock()
    const implicit = lockScroll()

    expect(wheel(first)).toBe(true)
    expect(wheel(second)).toBe(false)
    controller.unlock()
    expect(wheel(first)).toBe(false)
    expect(wheel(second)).toBe(true)
    controller.lock()
    cleanup()
    expect(wheel(first)).toBe(true)
    expect(wheel(second)).toBe(false)

    controller.destroy()
    expect(wheel(first)).toBe(false)
    implicit()
  })

  it('resolves new selector matches and refreshes an attribute without moving its layer', () => {
    const first = document.createElement('aside')
    first.setAttribute('data-scroll-lock-allow', '#first')
    document.body.append(first)
    const watcher = scrollLock(first, { allowScroll: '#fallback' })
    const original = scroller('first')
    const replacement = scroller('replacement')
    const fallback = scroller('fallback')
    const top = lockScroll({ allowScroll: fallback })
    expect(wheel(original)).toBe(true)
    first.setAttribute('data-scroll-lock-allow', '#replacement')
    first.setAttribute('data-scroll-lock-gap', 'false')
    watcher.refresh()
    expect(wheel(fallback)).toBe(false)
    expect(wheel(replacement)).toBe(true)

    top()
    expect(wheel(replacement)).toBe(false)
    first.removeAttribute('data-scroll-lock-allow')
    watcher.refresh()
    expect(wheel(fallback)).toBe(false)
    expect(wheel(replacement)).toBe(true)
    watcher.destroy()
  })

  it('supports an empty list and ignores invalid selectors and control keys', () => {
    const outside = scroller('outside')
    const input = document.createElement('input')
    const button = document.createElement('button')
    outside.append(input, button)
    const empty = lockScroll({ allowScroll: [] })
    expect(wheel(outside)).toBe(true)
    expect(key(outside, 'PageDown')).toBe(true)
    expect(key(input, 'ArrowDown')).toBe(false)
    expect(key(button, ' ')).toBe(false)
    empty()

    const lifetime = new AbortController()
    lockScroll({ allowScroll: ['[', '#outside'], signal: lifetime.signal })
    expect(key(outside, 'PageDown')).toBe(false)
    lifetime.abort()
    expect(wheel(outside)).toBe(false)
  })

  it('uses the gesture direction for an RTL scroller inside an open shadow root', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const region = scroller('rtl')
    shadow.append(region)
    region.style.overflowX = 'auto'
    region.style.direction = 'rtl'
    Object.defineProperties(region, {
      scrollWidth: { value: 400 },
      clientWidth: { value: 100 },
    })
    lockScroll({ allowScroll: host })

    expect(wheel(region, 0, { deltaX: 40, composed: true })).toBe(true)
    expect(wheel(region, 0, { deltaX: -40, composed: true })).toBe(false)
    region.scrollLeft = -300
    expect(wheel(region, -40, { shiftKey: true, composed: true })).toBe(true)
    expect(wheel(region, 40, { shiftKey: true, composed: true })).toBe(false)
  })

  it('filters single touch gestures in iOS mode and leaves pinch gestures alone', () => {
    const allowed = scroller('allowed')
    const outside = scroller('outside')
    lockScroll({ mode: 'ios', allowScroll: allowed })
    const dispatch = (target: Element, type: string, y: number, pinch = false) => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      const touch = { identifier: 0, clientX: 0, clientY: y, pageY: y }
      Object.defineProperties(event, {
        touches: { value: pinch ? [touch, { ...touch, identifier: 1 }] : [touch] },
        changedTouches: { value: [touch] },
      })
      return !target.dispatchEvent(event)
    }
    dispatch(allowed, 'touchstart', 100)
    expect(dispatch(allowed, 'touchmove', 80)).toBe(false)
    dispatch(outside, 'touchstart', 100)
    expect(dispatch(outside, 'touchmove', 80)).toBe(true)
    expect(dispatch(outside, 'touchmove', 60, true)).toBe(false)
  })
})
