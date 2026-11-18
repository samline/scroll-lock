import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  autoScrollLock,
  isOpenElement,
  isScrollLocked,
  resetScrollLock,
  scrollLock,
} from '../src/index.js'
import { page, platform, reset } from './helpers.js'

const html = document.documentElement
const body = document.body

/** MutationObserver callbacks run as microtasks. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0))

const add = (markup: string) => {
  body.insertAdjacentHTML('beforeend', markup)
  return body.lastElementChild as HTMLElement
}

beforeEach(() => {
  platform('windows')
  page()
})

afterEach(() => {
  resetScrollLock()
  reset()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('isOpenElement', () => {
  it('reads open on dialogs and details', () => {
    expect(isOpenElement(add('<dialog></dialog>'))).toBe(false)
    expect(isOpenElement(add('<dialog open></dialog>'))).toBe(true)
    expect(isOpenElement(add('<details></details>'))).toBe(false)
    expect(isOpenElement(add('<details open></details>'))).toBe(true)
  })

  it('reads :popover-open on popovers', () => {
    const popover = add('<div popover></div>')
    // jsdom does not know the selector: closed.
    expect(isOpenElement(popover)).toBe(false)
    vi.spyOn(popover, 'matches').mockReturnValue(true)
    expect(isOpenElement(popover)).toBe(true)
  })

  it('reads hidden and aria-hidden on other elements', () => {
    expect(isOpenElement(add('<div></div>'))).toBe(true)
    expect(isOpenElement(add('<div hidden></div>'))).toBe(false)
    expect(isOpenElement(add('<div aria-hidden="true"></div>'))).toBe(false)
    expect(isOpenElement(add('<div aria-hidden="false"></div>'))).toBe(true)
  })
})

describe('scrollLock', () => {
  it('locks while a dialog is open', async () => {
    const dialog = add('<dialog></dialog>') as HTMLDialogElement
    const controller = scrollLock(dialog)
    expect(dialog.getAttribute('data-scroll-lock-state')).toBe('unlocked')
    expect(isScrollLocked()).toBe(false)

    dialog.setAttribute('open', '')
    await settle()
    expect(controller.isLocked()).toBe(true)
    expect(dialog.getAttribute('data-scroll-lock-state')).toBe('locked')
    expect(html.style.overflow).toBe('hidden')

    dialog.removeAttribute('open')
    await settle()
    expect(controller.isLocked()).toBe(false)
    expect(html.style.overflow).toBe('')
  })

  it('locks while an element is shown', async () => {
    const menu = add('<nav hidden></nav>')
    scrollLock(menu)
    expect(isScrollLocked()).toBe(false)
    menu.hidden = false
    await settle()
    expect(isScrollLocked()).toBe(true)
  })

  it('follows popovers through their toggle event', () => {
    const popover = add('<div popover></div>')
    const matches = vi.spyOn(popover, 'matches').mockReturnValue(false)
    scrollLock(popover)
    matches.mockReturnValue(true)
    popover.dispatchEvent(new Event('toggle'))
    expect(isScrollLocked()).toBe(true)
  })

  it('accepts selectors and lists, one lock per element', async () => {
    add('<div class="sheet"></div>')
    add('<div class="sheet"></div>')
    const controller = scrollLock('.sheet')
    expect(controller.isLocked()).toBe(true)
    const [first, second] = Array.from(document.querySelectorAll<HTMLElement>('.sheet'))
    first!.hidden = true
    await settle()
    expect(isScrollLocked()).toBe(true)
    second!.hidden = true
    await settle()
    expect(isScrollLocked()).toBe(false)
    expect(controller.isLocked()).toBe(false)
  })

  it('takes a custom isOpen and re-checks on refresh', () => {
    const panel = add('<div></div>')
    let open = false
    const controller = scrollLock(panel, { isOpen: () => open })
    expect(isScrollLocked()).toBe(false)
    open = true
    controller.refresh()
    expect(isScrollLocked()).toBe(true)
  })

  it('reads options from attributes, which win over options', () => {
    const sheet = add(
      '<div data-scroll-lock-gap="false" data-scroll-lock-position-fixed="always"></div>'
    )
    scrollLock(sheet, { reserveGap: true })
    expect(body.style.paddingRight).toBe('')
    expect(body.style.position).toBe('fixed')
  })

  it('re-takes the lock when an option attribute changes, without unlocking in between', async () => {
    const sheet = add('<div></div>')
    scrollLock(sheet)
    expect(body.style.paddingRight).toBe('15px')
    sheet.setAttribute('data-scroll-lock-position-fixed', 'always')
    await settle()
    expect(body.style.position).toBe('fixed')
    expect(html.style.overflow).toBe('hidden')
    expect(isScrollLocked()).toBe(true)
  })

  it('is turned off by data-scroll-lock="false"', async () => {
    const sheet = add('<div data-scroll-lock="false"></div>')
    scrollLock(sheet)
    expect(isScrollLocked()).toBe(false)
    sheet.setAttribute('data-scroll-lock', '')
    await settle()
    expect(isScrollLocked()).toBe(true)
  })

  it('reports unlocked after resetScrollLock', () => {
    const sheet = add('<div></div>')
    scrollLock(sheet)
    resetScrollLock()
    expect(sheet.getAttribute('data-scroll-lock-state')).toBe('unlocked')
  })

  it('destroys idempotently and restores the state attribute', async () => {
    const sheet = add('<div data-scroll-lock-state="custom"></div>')
    const controller = scrollLock(sheet)
    expect(sheet.getAttribute('data-scroll-lock-state')).toBe('locked')
    controller.destroy()
    controller.destroy()
    expect(sheet.getAttribute('data-scroll-lock-state')).toBe('custom')
    expect(isScrollLocked()).toBe(false)

    sheet.hidden = true
    await settle()
    sheet.dispatchEvent(new Event('toggle'))
    controller.refresh()
    expect(sheet.getAttribute('data-scroll-lock-state')).toBe('custom')

    const other = add('<div></div>')
    scrollLock(other).destroy()
    expect(other.hasAttribute('data-scroll-lock-state')).toBe(false)
  })
})

describe('autoScrollLock', () => {
  it('watches [data-scroll-lock], including elements added and removed later', async () => {
    add('<dialog data-scroll-lock></dialog>')
    const controller = autoScrollLock()
    expect(isScrollLocked()).toBe(false)

    const sheet = add('<div data-scroll-lock></div>')
    await settle()
    expect(sheet.getAttribute('data-scroll-lock-state')).toBe('locked')
    expect(isScrollLocked()).toBe(true)

    sheet.remove()
    await settle()
    expect(isScrollLocked()).toBe(false)

    add('<div data-scroll-lock></div>')
    await settle()
    controller.destroy()
    expect(isScrollLocked()).toBe(false)
  })

  it('takes a root, observe: false and shared options', async () => {
    const root = add('<section><div data-scroll-lock></div></section>')
    add('<div data-scroll-lock></div>')
    const controller = autoScrollLock({ root, observe: false, reserveGap: false })
    expect(root.firstElementChild!.getAttribute('data-scroll-lock-state')).toBe('locked')
    expect(body.lastElementChild!.hasAttribute('data-scroll-lock-state')).toBe(false)
    expect(body.style.paddingRight).toBe('')

    root.insertAdjacentHTML('beforeend', '<div data-scroll-lock hidden></div>')
    await settle()
    expect(root.lastElementChild!.hasAttribute('data-scroll-lock-state')).toBe(false)
    controller.refresh()
    expect(root.lastElementChild!.getAttribute('data-scroll-lock-state')).toBe('unlocked')
  })
})
