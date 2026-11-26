import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { lockScroll, resetScrollLock } from '../src/index.js'
import { isTextInput, jump, scrollParent } from '../src/vanilla/ios.js'
import { page, platform, reset, syncFrames, touch } from './helpers.js'

const html = document.documentElement
const body = document.body

const scroller = (scrollTop: number, scrollHeight = 1000, clientHeight = 200) => {
  body.insertAdjacentHTML(
    'beforeend',
    '<div id="list" style="overflow: auto"><p id="item">Item</p></div>'
  )
  const list = document.getElementById('list')!
  Object.defineProperties(list, {
    scrollTop: { configurable: true, writable: true, value: scrollTop },
    scrollHeight: { configurable: true, value: scrollHeight },
    clientHeight: { configurable: true, value: clientHeight },
  })
  return list
}

beforeEach(() => platform('ios'))

afterEach(() => {
  resetScrollLock()
  reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('lockScroll (ios)', () => {
  it('runs on iPhone and iPadOS by default, and on demand anywhere', () => {
    page({ y: 500 })
    let release = lockScroll()
    expect(body.style.marginTop).toBe('-500px')
    expect(html.style.overflow).toBe('')
    release()

    platform('ipados')
    release = lockScroll()
    expect(body.style.marginTop).toBe('-500px')
    release()

    platform('windows')
    release = lockScroll({ mode: 'ios' })
    expect(body.style.marginTop).toBe('-500px')
    release()

    platform('ios')
    release = lockScroll({ mode: 'overflow' })
    expect(html.style.overflow).toBe('hidden')
    release()
  })

  it('offsets the body, scrolls to the top and restores both', () => {
    const { state, scrollTo } = page({ x: 0, y: 500, gap: 15 })
    const release = lockScroll()

    expect(body.style.marginTop).toBe('-500px')
    expect(html.style.paddingRight).toBe('15px')
    expect(state.y).toBe(0)
    expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' })

    release()
    expect(body.style.marginTop).toBe('')
    expect(html.style.paddingRight).toBe('')
    expect(state.y).toBe(500)
  })

  it('scrolls back to the top when the page scrolls anyway', () => {
    const { state } = page({ y: 500 })
    const release = lockScroll()
    state.y = 80
    window.dispatchEvent(new Event('scroll'))
    expect(state.y).toBe(0)
    release()
    state.y = 80
    window.dispatchEvent(new Event('scroll'))
    expect(state.y).toBe(80)
  })

  it('cancels touchmove outside scrollable elements', () => {
    page()
    body.innerHTML = '<p id="text">Text</p>'
    lockScroll()
    const text = document.getElementById('text')!
    touch('touchstart', text, 100)
    expect(touch('touchmove', text, 80).defaultPrevented).toBe(true)
  })

  it('lets a scrollable element scroll, but not past its edges', () => {
    page()
    lockScroll()

    const middle = scroller(300)
    const item = document.getElementById('item')!
    touch('touchstart', item, 100)
    expect(touch('touchmove', item, 80).defaultPrevented).toBe(false)
    expect(touch('touchmove', item, 120).defaultPrevented).toBe(false)
    middle.remove()

    const atTop = scroller(0)
    touch('touchstart', atTop, 100)
    expect(touch('touchmove', atTop, 120).defaultPrevented).toBe(true)
    expect(touch('touchmove', atTop, 100).defaultPrevented).toBe(false)
    atTop.remove()

    const atBottom = scroller(800)
    touch('touchstart', atBottom, 100)
    expect(touch('touchmove', atBottom, 80).defaultPrevented).toBe(true)
    atBottom.remove()

    const notScrolling = scroller(0, 200, 200)
    touch('touchstart', notScrolling, 100)
    expect(touch('touchmove', notScrolling, 120).defaultPrevented).toBe(false)
  })

  it('ignores touches without coordinates', () => {
    page()
    lockScroll()
    const list = scroller(0)
    const start = new Event('touchstart', { bubbles: true, cancelable: true })
    Object.defineProperty(start, 'changedTouches', { value: [] })
    list.dispatchEvent(start)
    const move = new Event('touchmove', { bubbles: true, cancelable: true })
    Object.defineProperty(move, 'changedTouches', { value: [] })
    list.dispatchEvent(move)
    expect(move.defaultPrevented).toBe(false)
  })

  it('focuses a tapped input itself, moved out of Safari’s way', () => {
    page()
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback)
    )
    vi.stubGlobal('visualViewport', null)
    body.innerHTML = '<input id="name"><input id="check" type="checkbox">'
    lockScroll()
    const input = document.getElementById('name') as HTMLInputElement

    expect(touch('touchend', input).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.style.transform).toBe('translateY(-2000px)')
    frames.splice(0).forEach(frame => frame(0))
    expect(input.style.transform).toBe('')

    // Already focused, or not a text field: left alone.
    expect(touch('touchend', input).defaultPrevented).toBe(false)
    expect(touch('touchend', document.getElementById('check')!).defaultPrevented).toBe(false)
  })

  it('scrolls a focused input into view inside its container once the keyboard is open', () => {
    page()
    syncFrames()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    const viewport = Object.assign(new EventTarget(), { height: 800 })
    vi.stubGlobal('visualViewport', viewport)
    const list = scroller(0)
    list.insertAdjacentHTML('beforeend', '<textarea id="note"></textarea>')
    const note = document.getElementById('note')!
    list.getBoundingClientRect = () => ({ top: 100, bottom: 300 }) as DOMRect
    note.getBoundingClientRect = () => ({ top: 500, bottom: 540 }) as DOMRect
    lockScroll()

    note.dispatchEvent(new FocusEvent('focus'))
    expect(list.scrollTop).toBe(0)
    viewport.dispatchEvent(new Event('resize'))
    expect(list.scrollTop).toBe(400)

    // The keyboard is already open: no waiting.
    list.scrollTop = 0
    viewport.height = 400
    note.dispatchEvent(new FocusEvent('focus'))
    expect(list.scrollTop).toBe(400)
  })

  it('leaves inputs already in view and ignores focus outside inputs', () => {
    page()
    syncFrames()
    const viewport = Object.assign(new EventTarget(), { height: 400 })
    vi.stubGlobal('visualViewport', viewport)
    const list = scroller(0)
    list.insertAdjacentHTML('beforeend', '<div id="edit" contenteditable="true"></div>')
    const edit = document.getElementById('edit')!
    Object.defineProperty(edit, 'isContentEditable', { value: true })
    list.getBoundingClientRect = () => ({ top: 100, bottom: 300 }) as DOMRect
    edit.getBoundingClientRect = () => ({ top: 150, bottom: 200 }) as DOMRect
    lockScroll()
    edit.dispatchEvent(new FocusEvent('focus'))
    expect(list.scrollTop).toBe(0)

    body.insertAdjacentHTML('beforeend', '<button id="go">Go</button>')
    document.getElementById('go')!.dispatchEvent(new FocusEvent('focus'))
    expect(document.getElementById('go')!.style.transform).toBe('')
  })

  it('reveals focused inputs inside the active region without scrolling an outside container', () => {
    page()
    syncFrames()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    vi.stubGlobal('visualViewport', { height: 400 })
    const outside = scroller(0)
    const inside = document.createElement('div')
    inside.style.overflow = 'auto'
    const field = document.createElement('input')
    inside.append(field)
    outside.append(inside)
    field.getBoundingClientRect = () => ({ top: 500, bottom: 540 }) as DOMRect
    inside.getBoundingClientRect = () => ({ top: 200, bottom: 400 }) as DOMRect
    outside.getBoundingClientRect = () => ({ top: 0, bottom: 100 }) as DOMRect
    lockScroll({ allowScroll: inside })

    field.dispatchEvent(new FocusEvent('focus'))
    expect(inside.scrollTop).toBe(300)
    expect(outside.scrollTop).toBe(0)
  })

  it('removes a keyboard listener still waiting on release', () => {
    page()
    syncFrames()
    const viewport = Object.assign(new EventTarget(), { height: 800 })
    const remove = vi.spyOn(viewport, 'removeEventListener')
    vi.stubGlobal('visualViewport', viewport)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    body.innerHTML = '<input id="name">'
    const release = lockScroll()
    document.getElementById('name')!.dispatchEvent(new FocusEvent('focus'))
    release()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('works without visualViewport', () => {
    page()
    syncFrames()
    vi.stubGlobal('visualViewport', null)
    body.innerHTML = '<input id="name">'
    lockScroll()
    const input = document.getElementById('name')!
    input.dispatchEvent(new FocusEvent('focus'))
    expect(input.style.transform).toBe('')
  })

  it('leaves the offset to a pinned body', () => {
    const { state } = page({ y: 500 })
    platform('ios')
    const release = lockScroll({ positionFixed: 'always' })
    expect(body.style.position).toBe('fixed')
    expect(body.style.top).toBe('-500px')
    expect(body.style.marginTop).toBe('')
    release()
    expect(state.y).toBe(500)
  })
})

describe('helpers', () => {
  it('falls back to scrollTo(x, y) where behavior: instant is rejected', () => {
    const calls: unknown[][] = []
    vi.stubGlobal('scrollTo', (...args: unknown[]) => {
      if (typeof args[0] === 'object') throw new TypeError('invalid enum')
      calls.push(args)
    })
    jump(10, 20)
    expect(calls).toEqual([[10, 20]])
  })

  it('finds the scroll parent, with or without the element itself', () => {
    const list = scroller(0)
    const item = document.getElementById('item')!
    expect(scrollParent(item)).toBe(list)
    expect(scrollParent(list, true)).toBe(list)
    expect(scrollParent(list)).toBe(document.scrollingElement ?? html)
  })

  it('tells text fields from other elements', () => {
    body.innerHTML = '<input id="a"><input id="b" type="radio"><textarea id="c"></textarea>'
    expect(isTextInput(document.getElementById('a'))).toBe(true)
    expect(isTextInput(document.getElementById('b'))).toBe(false)
    expect(isTextInput(document.getElementById('c'))).toBe(true)
    expect(isTextInput(null)).toBe(false)
  })
})
