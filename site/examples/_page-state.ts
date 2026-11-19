// Every preview on a page locks the same page, so each status line reads the
// page state from <html data-scroll-lock-state> instead of its own events:
// a lock taken by another preview (or the Home demo) shows up everywhere.
const STATE = 'data-scroll-lock-state'

/** Keep `output` in sync with the page lock state; returns the cleanup. */
export const showPageState = (output: HTMLOutputElement, detail: () => string = () => '') => {
  const html = document.documentElement
  const update = () => {
    const page = html.getAttribute(STATE) === 'locked' ? 'Page locked' : 'Page scrolls'
    const extra = detail()
    output.value = extra ? `${page}, ${extra}` : page
  }
  const observer = new MutationObserver(update)
  observer.observe(html, { attributes: true, attributeFilter: [STATE] })
  update()
  return { update, destroy: () => observer.disconnect() }
}
