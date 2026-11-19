// Copyable files are complete pages: they load the published browser bundle
// (window.ScrollLock watches [data-scroll-lock] on its own) and lock the page
// itself. The previews in examples/*.astro import the package and lock this page.
const paragraphs = (count: number, text: string) =>
  Array.from({ length: count }, (_, i) => `    <p>${text} ${i + 1}.</p>`).join('\n')

const page = `<main>
${Array.from({ length: 6 }, (_, i) => `  <section><h2>Section ${i + 1}</h2></section>`).join('\n')}
</main>`

const pageCss = `body { margin: 0; font-family: system-ui, sans-serif; }
main { padding: 1rem 1.5rem; }
section { min-height: 60vh; border-top: 1px solid #ddd; }`

export default [
  {
    id: 'dialog',
    tab: 'Modal dialog',
    title: 'Lock the page behind a modal dialog',
    description:
      'data-scroll-lock on the dialog locks the page while it is open and releases it when it closes, by button, form or Escape. The list inside still scrolls.',
    files: {
      html: `<button type="button" id="open">Read the terms</button>
<dialog id="terms" data-scroll-lock aria-labelledby="terms-title">
  <h2 id="terms-title">Terms</h2>
  <div class="list" tabindex="0">
${paragraphs(12, 'Clause')}
  </div>
  <form method="dialog"><button>Close</button></form>
</dialog>
${page}`,
      css: `${pageCss}
#open { position: fixed; top: 1rem; right: 1rem; }
dialog { max-width: 28rem; }
.list { max-height: 12rem; overflow-y: auto; overscroll-behavior: contain; }`,
      js: `// The bundle already watches [data-scroll-lock].
document.querySelector('#open').addEventListener('click', () => {
  document.querySelector('#terms').showModal()
})`,
      esm: `import { autoScrollLock } from '@samline/scroll-lock'

autoScrollLock()

document.querySelector('#open').addEventListener('click', () => {
  document.querySelector('#terms').showModal()
})`,
    },
  },
  {
    id: 'nested',
    tab: 'Nested locks',
    title: 'Open several panels, unlock in any order',
    description:
      'Each panel holds its own lock with createScrollLock. The page stays locked until the last one closes, whichever order you close them in, and returns to the same scroll position.',
    files: {
      html: `<div class="toolbar">
  <button type="button" aria-pressed="false" aria-controls="cart">Cart</button>
  <button type="button" aria-pressed="false" aria-controls="filters">Filters</button>
  <output id="status" aria-live="polite">Page scrolls</output>
</div>
<aside class="panel" id="cart" hidden>Cart</aside>
<aside class="panel" id="filters" hidden>Filters</aside>
${page}`,
      css: `${pageCss}
.toolbar { position: fixed; inset: 0 0 auto; z-index: 1; display: flex; gap: 0.5rem; align-items: center; padding: 0.75rem 1rem; padding-right: calc(1rem + var(--scroll-lock-gap, 0px)); background: #fff; border-bottom: 1px solid #ddd; }
[aria-pressed='true'] { background: #2563eb; color: #fff; }
.panel { position: fixed; top: 4rem; z-index: 1; width: 14rem; padding: 1rem; background: #fff; border: 1px solid #ddd; }
#cart { right: 1rem; }
#filters { left: 1rem; }
main { padding-top: 4rem; }`,
      js: `const status = document.querySelector('#status')

for (const button of document.querySelectorAll('[aria-controls]')) {
  const panel = document.getElementById(button.getAttribute('aria-controls'))
  const lock = ScrollLock.createScrollLock()
  button.addEventListener('click', () => {
    lock.toggle()
    panel.hidden = !lock.isLocked()
    button.setAttribute('aria-pressed', String(lock.isLocked()))
    status.textContent = ScrollLock.isScrollLocked() ? 'Page locked' : 'Page scrolls'
  })
}`,
      esm: `import { createScrollLock, isScrollLocked } from '@samline/scroll-lock'

const status = document.querySelector('#status')

for (const button of document.querySelectorAll('[aria-controls]')) {
  const panel = document.getElementById(button.getAttribute('aria-controls'))
  const lock = createScrollLock()
  button.addEventListener('click', () => {
    lock.toggle()
    panel.hidden = !lock.isLocked()
    button.setAttribute('aria-pressed', String(lock.isLocked()))
    status.textContent = isScrollLocked() ? 'Page locked' : 'Page scrolls'
  })
}`,
    },
  },
  {
    id: 'popover',
    tab: 'Popover menu',
    title: 'Lock while a popover menu is open',
    description:
      'A popover with data-scroll-lock locks the page from the moment it opens until it closes, including light dismiss with a click outside or Escape. No script of your own.',
    files: {
      html: `<button type="button" popovertarget="menu">Menu</button>
<nav id="menu" popover data-scroll-lock aria-label="Main">
  <a href="#">Home</a>
  <a href="#">Products</a>
  <a href="#">Contact</a>
</nav>
${page}`,
      css: `${pageCss}
[popovertarget] { position: fixed; top: 1rem; right: 1rem; }
#menu { display: none; inset: 0 0 auto auto; height: 100vh; margin: 0; padding: 2rem; flex-direction: column; gap: 1rem; border: 0; border-left: 1px solid #ddd; }
#menu:popover-open { display: flex; }`,
      js: `// Nothing to add: the bundle watches [data-scroll-lock], popovers included.`,
      esm: `import { autoScrollLock } from '@samline/scroll-lock'

autoScrollLock()`,
    },
  },
]
