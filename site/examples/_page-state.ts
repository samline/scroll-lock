// Every preview on a page locks the same page, so each status line reads the
// page state from <html data-scroll-lock-state> instead of its own events:
// a lock taken by another preview (or the Home demo) shows up everywhere.
import { getScrollLockState } from '@samline/scroll-lock'

const STATE = 'data-scroll-lock-state'

type PageStateOptions = {
  /** Text appended after the lock count, for example "2 panels open". */
  detail?: () => string
  /** Replaces the whole line while it returns text (for example during an exit animation). */
  override?: () => string | undefined
}

/**
 * Keep `output` in sync with the page lock state, with the number of locks held.
 * The attribute only changes on the first lock and the last release, so call
 * `update()` after a change that leaves the page locked (a second lock, one less).
 * Returns the cleanup.
 */
export const showPageState = (output: HTMLOutputElement, options: PageStateOptions = {}) => {
  const html = document.documentElement
  const update = () => {
    const held = options.override?.()
    if (held) {
      output.value = held
      return
    }
    const locked = html.getAttribute(STATE) === 'locked'
    const { count } = getScrollLockState()
    const parts = locked
      ? ['Page locked', `${count} ${count === 1 ? 'lock' : 'locks'}`, options.detail?.() ?? '']
      : ['Page scrolls']
    output.value = parts.filter(Boolean).join(', ')
  }
  const observer = new MutationObserver(update)
  observer.observe(html, { attributes: true, attributeFilter: [STATE] })
  update()
  return { update, destroy: () => observer.disconnect() }
}
