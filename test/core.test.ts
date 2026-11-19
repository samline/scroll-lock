import { describe, expect, it } from 'vitest'

import {
  DEFAULTS,
  isIOS,
  isSafari,
  resolveMode,
  resolveOptions,
  usesPositionFixed,
} from '../src/core/index.js'
import type { PlatformInfo } from '../src/core/index.js'

const info = (platform: string, userAgent = '', maxTouchPoints = 0, standalone = false) =>
  ({ platform, userAgent, maxTouchPoints, standalone }) satisfies PlatformInfo

const safari = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
const chrome = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'
const android = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Mobile Safari/537.36'

describe('resolveOptions', () => {
  it('fills the defaults', () => {
    expect(resolveOptions()).toEqual(DEFAULTS)
    expect(DEFAULTS).toEqual({ mode: 'auto', reserveGap: true, positionFixed: 'never' })
  })

  it('keeps given values and ignores undefined ones', () => {
    expect(resolveOptions({ mode: 'ios', reserveGap: false, positionFixed: 'always' })).toEqual({
      mode: 'ios',
      reserveGap: false,
      positionFixed: 'always',
    })
    expect(resolveOptions({ mode: undefined } as never).mode).toBe('auto')
  })
})

describe('platform checks', () => {
  it('detects iPhone, iPod, iPad and iPadOS posing as a Mac', () => {
    expect(isIOS(info('iPhone'))).toBe(true)
    expect(isIOS(info('iPod touch'))).toBe(true)
    expect(isIOS(info('iPad'))).toBe(true)
    expect(isIOS(info('MacIntel', safari, 5))).toBe(true)
    expect(isIOS(info('MacIntel', safari, 0))).toBe(false)
    expect(isIOS(info('Win32'))).toBe(false)
    expect(isIOS(info('MacIntel', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'))).toBe(
      true
    )
  })

  it('detects Safari, not Chrome or Android browsers', () => {
    expect(isSafari(info('MacIntel', safari))).toBe(true)
    expect(isSafari(info('MacIntel', chrome))).toBe(false)
    expect(isSafari(info('Linux', android))).toBe(false)
  })

  it('resolves auto to ios on iOS and overflow elsewhere', () => {
    expect(resolveMode('auto', info('iPhone'))).toBe('ios')
    expect(resolveMode('auto', info('Win32'))).toBe('overflow')
    expect(resolveMode('overflow', info('iPhone'))).toBe('overflow')
    expect(resolveMode('ios', info('Win32'))).toBe('ios')
  })

  it('decides when to pin the body', () => {
    expect(usesPositionFixed('never', info('MacIntel', safari))).toBe(false)
    expect(usesPositionFixed('always', info('Win32', chrome))).toBe(true)
    expect(usesPositionFixed('safari', info('MacIntel', safari))).toBe(true)
    expect(usesPositionFixed('safari', info('MacIntel', chrome))).toBe(false)
    expect(usesPositionFixed('safari', info('iPhone', safari, 5, true))).toBe(false)
  })
})
