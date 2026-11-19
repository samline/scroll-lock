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
  test('the dialog locks the page until it closes', async ({ page }) => {
    await open(page, 'dialog')
    await page.getByRole('button', { name: 'Read the terms' }).click()
    await expect.poll(() => locked(page)).toBe('locked')
    await page.keyboard.press('Escape')
    await expect.poll(() => locked(page)).toBeNull()
  })

  test('nested panels unlock after the last one closes, in any order', async ({ page }) => {
    await open(page, 'nested')
    const cart = page.getByRole('button', { name: 'Cart' })
    const filters = page.getByRole('button', { name: 'Filters' })
    await cart.click()
    await filters.click()
    await expect(page.locator('#status')).toHaveText('Page locked')
    await cart.click()
    await expect(page.locator('#status')).toHaveText('Page locked')
    expect(await locked(page)).toBe('locked')
    await filters.click()
    await expect(page.locator('#status')).toHaveText('Page scrolls')
    expect(await locked(page)).toBeNull()
  })

  test('the popover menu locks while open, light dismiss included', async ({ page }) => {
    await open(page, 'popover')
    await page.getByRole('button', { name: 'Menu' }).click()
    await expect.poll(() => locked(page)).toBe('locked')
    await page.keyboard.press('Escape')
    await expect.poll(() => locked(page)).toBeNull()
  })
})
