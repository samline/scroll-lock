import { lockScroll } from './lock.js'

export * from '../core/index.js'
export {
  createScrollLock,
  getScrollLockState,
  isScrollLocked,
  lockScroll,
  resetScrollLock,
} from './lock.js'
export type { ScrollLock, ScrollLockLifecycleOptions, ScrollLockState } from './lock.js'
export type { ScrollLockRegionOptions, ScrollLockRegions } from './regions.js'
export { autoScrollLock, isOpenElement, scrollLock } from './watch.js'
export type {
  AutoScrollLockOptions,
  ScrollLockController,
  ScrollLockWatchOptions,
} from './watch.js'

export default lockScroll
