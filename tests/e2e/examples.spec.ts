// The website shows each example twice: a live preview and copyable files
// (site/examples.ts) that load the browser bundle. These tests run the copyable
// files against the built bundle, so the code people copy keeps working.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

import examples from '../../site/examples'

type Page = import('@playwright/test').Page
type Example = (typeof examples)[number]

const bundle = readFileSync(
  fileURLToPath(new URL('../../dist/browser/scroll-lock.global.js', import.meta.url)),
  'utf8'
)

const open = async (page: Page, id: string) => {
  const example = examples.find(item => item.id === id) as Example
  await page.setViewportSize({ width: 1000, height: 700 })
  await page.setContent(
    `<!doctype html><html lang="en"><head><style>${example.files.css ?? ''}</style></head><body>${example.files.html}<script>${bundle}</script><script>${example.files.js}</script></body></html>`
  )
}

const locked = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-scroll-lock-state'))

test.describe('scroll-lock copyable examples', () => {
  test('the dialog unlocks however it closes', async ({ page }) => {
    await open(page, 'dialog')
    const opener = page.getByRole('button', { name: 'Read the terms' })
    const dialog = page.getByRole('dialog', { name: 'Terms' })

    await opener.click()
    await expect.poll(() => locked(page)).toBe('locked')
    await page.keyboard.press('Escape')
    await expect.poll(() => locked(page)).toBeNull()

    await opener.click()
    await dialog.getByRole('button', { name: 'Close the terms' }).click()
    await expect.poll(() => locked(page)).toBeNull()

    await opener.click()
    await dialog.getByRole('button', { name: 'Accept' }).click()
    await expect.poll(() => locked(page)).toBeNull()

    // Light dismiss: closedby="any", or the script's fallback where it is missing.
    await opener.click()
    await expect.poll(() => locked(page)).toBe('locked')
    await page.mouse.click(5, 690)
    await expect(dialog).toBeHidden()
    await expect.poll(() => locked(page)).toBeNull()
  })

  test('nested panels unlock after the last one closes, in any order', async ({ page }) => {
    await open(page, 'nested')
    const cart = page.getByRole('button', { name: 'Cart', exact: true })
    const filters = page.getByRole('button', { name: 'Filters', exact: true })
    const status = page.locator('#status')
    await cart.click()
    await filters.click()
    await expect(status).toHaveText('Page locked, 2 panels open')
    await expect(page.locator('#filters')).toBeVisible()

    // Escape closes the panel opened last; the other keeps the page locked.
    await page.keyboard.press('Escape')
    await expect(page.locator('#filters')).toBeHidden()
    await expect(status).toHaveText('Page locked, 1 panel open')
    expect(await locked(page)).toBe('locked')

    await page.getByRole('button', { name: 'Close cart' }).click()
    await expect(status).toHaveText('Page scrolls')
    expect(await locked(page)).toBeNull()

    await filters.click()
    await cart.click()
    await page.getByRole('button', { name: 'Close filters' }).click()
    expect(await locked(page)).toBe('locked')
    await expect(cart).toHaveAttribute('aria-expanded', 'true')
    await page.getByRole('button', { name: 'Close cart' }).click()
    await expect(status).toHaveText('Page scrolls')
    expect(await locked(page)).toBeNull()
  })

  test('the popover menu unlocks however it closes', async ({ page }) => {
    await open(page, 'popover')
    const opener = page.getByRole('button', { name: 'Menu', exact: true })

    await opener.click()
    await expect.poll(() => locked(page)).toBe('locked')
    await page.keyboard.press('Escape')
    await expect.poll(() => locked(page)).toBeNull()

    await opener.click()
    await page.getByRole('link', { name: 'Products' }).click()
    await expect.poll(() => locked(page)).toBeNull()

    await opener.click()
    await page.getByRole('button', { name: 'Close the menu' }).click()
    await expect.poll(() => locked(page)).toBeNull()

    await opener.click()
    await page.mouse.click(20, 400)
    await expect.poll(() => locked(page)).toBeNull()
  })

  test('switching views releases only the outgoing view lock', async ({ page }) => {
    await open(page, 'navigation')
    const keep = await page.evaluateHandle(() => {
      const { ScrollLock } = window as Window & {
        ScrollLock: import('../../src/browser/global').ScrollLockGlobal
      }
      return ScrollLock.lockScroll()
    })
    const opener = page.getByRole('button', { name: 'Open project tools' })
    const status = page.getByRole('status')

    await opener.click()
    await expect(status).toHaveText('Page locked (2)')
    await page.getByRole('button', { name: 'Projects', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible()
    await expect(opener).toHaveAttribute('aria-expanded', 'false')
    await expect(status).toHaveText('Page locked (1)')

    await keep.evaluate(release => release())
    await keep.dispose()
    await opener.click()
    await expect(status).toHaveText('Page locked (1)')
    await page.getByRole('button', { name: 'Overview', exact: true }).click()
    await expect(status).toHaveText('Page scrolls')
    expect(await locked(page)).toBeNull()
  })

  test('holds the lock until the menu exit animation settles', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await open(page, 'animated')
    const opener = page.getByRole('button', { name: 'Open account menu' })
    const menu = page.getByRole('dialog', { name: 'Account menu' })
    await opener.press('Enter')

    const animation = await menu.evaluateHandle(dialog => {
      dialog.querySelector('button')!.click()
      const exit = dialog.getAnimations()[0]!
      exit.pause()
      return exit
    })
    await expect(menu).toBeVisible()
    expect(await locked(page)).toBe('locked')
    await animation.evaluate(exit => exit.finish())
    await animation.dispose()

    await expect(menu).toBeHidden()
    await expect(opener).toBeFocused()
    expect(await locked(page)).toBeNull()
  })

  test('Escape closes the menu immediately with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, 'animated')
    const opener = page.getByRole('button', { name: 'Open account menu' })
    const menu = page.getByRole('dialog', { name: 'Account menu' })
    await opener.click()
    await expect(menu).toBeVisible()
    expect(await locked(page)).toBe('locked')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    expect(await locked(page)).toBeNull()
  })

  test('scrolls only the top explicit regions, then restores the previous regions', async ({
    page,
  }) => {
    await open(page, 'regions')
    const checkout = page.getByRole('button', { name: 'Checkout', exact: true })
    const picker = page.getByRole('button', { name: 'Country picker', exact: true })
    const order = page.getByRole('region', { name: 'Order' })
    const delivery = page.getByRole('region', { name: 'Delivery' })
    const countries = page.getByRole('region', { name: 'Countries' })
    const position = (region: ReturnType<Page['locator']>) => region.evaluate(el => el.scrollTop)

    await page.evaluate(() => window.scrollTo(0, 240))
    await checkout.click()
    await expect.poll(() => locked(page)).toBe('locked')
    await order.hover()
    await page.mouse.wheel(0, 140)
    await expect.poll(() => position(order)).toBeGreaterThan(0)
    await delivery.press('PageDown')
    await expect.poll(() => position(delivery)).toBeGreaterThan(0)

    await picker.click()
    await expect(page.locator('#countries')).toHaveAttribute('data-scroll-lock-state', 'locked')
    await order.evaluate(el => {
      el.scrollTop = 0
    })
    await order.hover()
    await page.mouse.wheel(0, 140)
    await countries.hover()
    await page.mouse.wheel(0, 140)
    await expect.poll(() => position(countries)).toBeGreaterThan(0)
    expect(await position(order)).toBe(0)

    await picker.click()
    await expect(page.locator('#countries')).toHaveAttribute('data-scroll-lock-state', 'unlocked')
    await order.hover()
    await page.mouse.wheel(0, 140)
    await expect.poll(() => position(order)).toBeGreaterThan(0)
    await order.evaluate(el => {
      el.scrollTop = el.scrollHeight
    })
    await page.mouse.wheel(0, 240)
    expect(await page.evaluate(() => window.scrollY)).toBe(240)

    // Removing the lower layer first leaves the picker in control.
    await picker.click()
    await expect(page.locator('#countries')).toHaveAttribute('data-scroll-lock-state', 'locked')
    await checkout.click()
    await expect(page.locator('#checkout')).toHaveAttribute('data-scroll-lock-state', 'unlocked')
    expect(await locked(page)).toBe('locked')
    await picker.click()
    await expect.poll(() => locked(page)).toBeNull()
  })

  test('freezes the inbox while its message and the page stay scrollable', async ({ page }) => {
    await open(page, 'inbox')
    const inbox = page.getByRole('region', { name: 'Inbox' })
    const message = page.getByRole('region', { name: 'Message', exact: true })
    const toggle = page.getByText('Freeze inbox list', { exact: true })
    await inbox.evaluate(el => {
      el.scrollTop = 100
    })
    await toggle.click()
    await expect(inbox).toHaveAttribute('data-scroll-lock-state', 'locked')
    expect(await locked(page)).toBeNull()
    await inbox.hover()
    await page.mouse.wheel(0, 100)
    await message.press('PageDown')
    await expect.poll(() => message.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
    expect(await inbox.evaluate(el => el.scrollTop)).toBe(100)
    await toggle.press('PageDown')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await toggle.click()
    await expect(inbox).not.toHaveAttribute('data-scroll-lock-state', /./)
  })

  test('restores the two editor panel positions in any release order', async ({ page }) => {
    await open(page, 'editor')
    const source = page.getByRole('region', { name: 'Source' })
    const preview = page.getByRole('region', { name: 'Preview' })
    const sourceLock = page.getByRole('button', { name: 'Lock source' })
    const previewLock = page.getByRole('button', { name: 'Lock preview' })
    const pageLock = page.getByRole('button', { name: 'Lock page' })
    const initialWidth = await source.evaluate(el => {
      el.scrollTop = 80
      ;(el as HTMLElement).style.setProperty('--scroll-lock-gap', '2px', 'important')
      return el.clientWidth
    })
    await preview.evaluate(el => {
      el.scrollTop = 120
    })
    await sourceLock.click()
    await previewLock.click()
    expect(await locked(page)).toBeNull()
    expect(await source.evaluate(el => el.clientWidth)).toBe(initialWidth)
    await pageLock.click()
    expect(await locked(page)).toBe('locked')
    await source.evaluate(el => {
      el.scrollTop = 200
    })
    await preview.evaluate(el => {
      el.scrollTop = 240
    })

    await previewLock.click()
    expect(await preview.evaluate(el => el.scrollTop)).toBe(120)
    await expect(source).toHaveAttribute('data-scroll-lock-state', 'locked')
    await pageLock.click()
    expect(await locked(page)).toBeNull()
    await sourceLock.click()
    expect(await source.evaluate(el => el.scrollTop)).toBe(80)
    expect(
      await source.evaluate(el =>
        (el as HTMLElement).style.getPropertyPriority('--scroll-lock-gap')
      )
    ).toBe('important')
  })
})
