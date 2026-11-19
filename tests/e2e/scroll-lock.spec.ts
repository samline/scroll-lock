import { devices } from '@playwright/test'

import { expect, test } from './fixtures'

type Page = import('@playwright/test').Page

const layout = `
  <style>
    html { scroll-behavior: smooth; overflow-y: scroll }
    section { height: 1200px; border-top: 1px solid }
    #marker { height: 40px; background: #ccc }
    #box { height: 120px; overflow: auto }
    #box p { height: 600px; margin: 0 }
  </style>
  <section></section>
  <div id="marker"></div>
  <section></section>
  <dialog id="dialog" data-scroll-lock>
    <div id="box"><p>Long content</p></div>
    <button id="close">Close</button>
  </dialog>
  <section></section>
`

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY))
const markerBox = (page: Page) =>
  page.evaluate(() => {
    const rect = document.getElementById('marker')!.getBoundingClientRect()
    return { top: Math.round(rect.top), width: Math.round(rect.width) }
  })

const start = async (page: Page, y = 1000) => {
  await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y)
  await expect.poll(() => scrollY(page)).toBe(y)
}

test('locks the page against wheel and keys, keeps the layout and the position', async ({
  load,
}) => {
  const page = await load(layout, 'scroll-lock')
  await start(page)
  const before = await markerBox(page)

  await page.evaluate(() => {
    ;(window as any).release = (window as any).ScrollLock.lockScroll()
  })
  expect(await markerBox(page)).toEqual(before)

  await page.mouse.move(200, 200)
  await page.mouse.wheel(0, 600)
  await page.keyboard.press('PageDown')
  await page.waitForTimeout(300)
  expect(await scrollY(page)).toBe(1000)

  await page.evaluate(() => (window as any).release())
  expect(await scrollY(page)).toBe(1000)
  expect(await markerBox(page)).toEqual(before)
  await page.mouse.wheel(0, 300)
  await expect.poll(() => scrollY(page)).toBeGreaterThan(1000)
})

for (const options of [{ positionFixed: 'always' }, { mode: 'ios' }] as const) {
  test(`${JSON.stringify(options)} keeps the page still and jumps back on release`, async ({
    load,
  }) => {
    const page = await load(layout, 'scroll-lock')
    await start(page)
    const before = await markerBox(page)

    await page.evaluate(options => {
      ;(window as any).release = (window as any).ScrollLock.lockScroll(options)
    }, options)
    expect(await markerBox(page)).toEqual(before)

    // No smooth scroll back, despite html { scroll-behavior: smooth }.
    expect(await page.evaluate(() => ((window as any).release(), Math.round(window.scrollY)))).toBe(
      1000
    )
    expect(await markerBox(page)).toEqual(before)
  })
}

test('a [data-scroll-lock] dialog locks while open, and its content still scrolls', async ({
  load,
}) => {
  const page = await load(layout, 'scroll-lock')
  await start(page)
  await page.evaluate(() => (document.getElementById('dialog') as HTMLDialogElement).showModal())
  await expect(page.locator('html')).toHaveAttribute('data-scroll-lock-state', 'locked')
  await expect(page.locator('#dialog')).toHaveAttribute('data-scroll-lock-state', 'locked')

  await page.locator('#box').hover()
  await page.mouse.wheel(0, 200)
  await expect.poll(() => page.locator('#box').evaluate(box => box.scrollTop)).toBeGreaterThan(0)
  expect(await scrollY(page)).toBe(1000)

  await page.evaluate(() => (document.getElementById('dialog') as HTMLDialogElement).close())
  await expect(page.locator('html')).not.toHaveAttribute('data-scroll-lock-state', /./)
  await expect(page.locator('#dialog')).toHaveAttribute('data-scroll-lock-state', 'unlocked')
  expect(await scrollY(page)).toBe(1000)
})

test('nested locks unlock after the last release', async ({ load }) => {
  const page = await load(layout, 'scroll-lock')
  const state = await page.evaluate(() => {
    const { lockScroll, isScrollLocked } = (window as any).ScrollLock
    const first = lockScroll()
    const second = lockScroll()
    first()
    const middle = [isScrollLocked(), document.documentElement.style.overflow]
    second()
    return [...middle, isScrollLocked(), document.documentElement.style.overflow]
  })
  expect(state).toEqual([true, 'hidden', false, ''])
})

test('exposes the scrollbar gap as a custom property', async ({ load }) => {
  const page = await load(layout, 'scroll-lock')
  const gap = await page.evaluate(() => {
    const expected = window.innerWidth - document.documentElement.clientWidth
    const release = (window as any).ScrollLock.lockScroll()
    const value = document.documentElement.style.getPropertyValue('--scroll-lock-gap')
    release()
    return { expected, value }
  })
  expect(gap.value).toBe(`${gap.expected}px`)
})

test.describe('on an emulated iPhone', () => {
  const { defaultBrowserType: _, ...iPhone } = devices['iPhone 15']
  test.use(iPhone)

  test('auto mode takes the iOS workaround and blocks page touches', async ({
    load,
    browserName,
  }) => {
    test.skip(browserName === 'firefox', 'Firefox has no mobile emulation')
    const page = await load(layout, 'scroll-lock')
    // Scroll near 600 px; device pixel ratios can round the exact position.
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
    await expect.poll(() => scrollY(page)).toBeGreaterThan(590)
    const result = await page.evaluate(() => {
      const before = window.scrollY
      const release = (window as any).ScrollLock.lockScroll()
      const touch = (type: string, target: Element, y: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'changedTouches', { value: [{ pageY: y }] })
        target.dispatchEvent(event)
        return event.defaultPrevented
      }
      const marker = document.getElementById('marker')!
      touch('touchstart', marker, 300)
      const blocked = touch('touchmove', marker, 200)
      const offset = parseFloat(document.body.style.marginTop) + before
      const lockedY = Math.round(window.scrollY)
      release()
      return { blocked, offset, lockedY, restored: Math.abs(window.scrollY - before) }
    })
    expect(result.blocked).toBe(true)
    expect(Math.abs(result.offset)).toBeLessThan(1)
    expect(result.lockedY).toBe(0)
    expect(result.restored).toBeLessThan(1)
  })
})
