import { lockScroll } from './lock.js'

export * from '../core/index.js'
export { createScrollLock, isScrollLocked, lockScroll, resetScrollLock } from './lock.js'
export type { ScrollLock } from './lock.js'
export { autoScrollLock, isOpenElement, scrollLock } from './watch.js'
export type {
  AutoScrollLockOptions,
  ScrollLockController,
  ScrollLockWatchOptions,
} from './watch.js'

export default lockScroll
