// Copyable files are complete pages: they load the published browser bundle
// (window.ScrollLock watches [data-scroll-lock] on its own) and lock the page
// itself. The previews in examples/*.astro import the package and lock this page.
const paragraphs = (count: number, text: string) =>
  Array.from({ length: count }, (_, i) => `    <p>${text} ${i + 1}.</p>`).join('\n')

const page = `<div class="page">
${Array.from({ length: 6 }, (_, i) => `  <section><h2>Section ${i + 1}</h2></section>`).join('\n')}
</div>`

const closeIcon = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`

const pageCss = `body { margin: 0; font-family: system-ui, sans-serif; }
.page { padding: 1rem 1.5rem; }
section { min-height: 60vh; border-top: 1px solid #ddd; }
.close { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border: 1px solid #ddd; border-radius: 50%; background: #fff; cursor: pointer; }
.header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }`

// Light dismiss where closedby="any" is not supported yet (Safari).
const lightDismiss = `const dialog = document.querySelector('#terms')

document.querySelector('#open').addEventListener('click', () => dialog.showModal())

// Light dismiss where closedby="any" is not supported yet (Safari).
if (!('closedBy' in HTMLDialogElement.prototype)) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return
    const box = dialog.getBoundingClientRect()
    const inside =
      event.clientX >= box.left && event.clientX <= box.right &&
      event.clientY >= box.top && event.clientY <= box.bottom
    if (!inside) dialog.close()
  })
}`

const nestedScript = (api: string) => `const status = document.querySelector('#status')
const open = [] // Most recently opened last, so Escape closes the top panel first.

const report = () => {
  status.textContent = ${api}isScrollLocked()
    ? \`Page locked, \${open.length} \${open.length === 1 ? 'panel' : 'panels'} open\`
    : 'Page scrolls'
}

for (const button of document.querySelectorAll('[aria-controls]')) {
  const panel = document.getElementById(button.getAttribute('aria-controls'))
  const lock = ${api}createScrollLock()
  const set = wanted => {
    lock.toggle(wanted)
    panel.togglePopover(wanted)
    button.setAttribute('aria-expanded', String(wanted))
    if (open.includes(close)) open.splice(open.indexOf(close), 1)
    if (wanted) open.push(close)
    report()
  }
  const close = () => set(false)
  button.addEventListener('click', () => set(!lock.isLocked()))
  panel.querySelector('.close').addEventListener('click', close)
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && open.length) open.at(-1)()
})`

const menuScript = `const menu = document.querySelector('#menu')

// A chosen link closes the menu, which releases the lock.
menu.addEventListener('click', event => {
  if (event.target.closest('a')) menu.hidePopover()
})`

export default [
  {
    id: 'dialog',
    tab: 'Modal dialog',
    title: 'Lock the page behind a modal dialog',
    description:
      'data-scroll-lock on the dialog locks the page while it is open and releases it however it closes: the close button, the form, Escape or a click outside. The list inside still scrolls.',
    files: {
      html: `<button type="button" id="open" aria-haspopup="dialog">Read the terms</button>
<dialog id="terms" data-scroll-lock closedby="any" aria-labelledby="terms-title">
  <div class="header">
    <h2 id="terms-title">Terms</h2>
    <form method="dialog">
      <button class="close" aria-label="Close the terms">${closeIcon}</button>
    </form>
  </div>
  <div class="list" tabindex="0" role="region" aria-label="Clauses">
${paragraphs(12, 'Clause')}
  </div>
  <form method="dialog"><button>Accept</button></form>
</dialog>
${page}`,
      css: `${pageCss}
#open { position: fixed; top: 1rem; right: 1rem; }
dialog { width: min(28rem, calc(100vw - 2rem)); box-sizing: border-box; }
dialog::backdrop { background: rgb(0 0 0 / 0.4); }
.list { max-height: 12rem; overflow-y: auto; overscroll-behavior: contain; }`,
      js: `// The bundle already watches [data-scroll-lock].
${lightDismiss}`,
      esm: `import { autoScrollLock } from '@samline/scroll-lock'

autoScrollLock()

${lightDismiss}`,
    },
  },
  {
    id: 'nested',
    tab: 'Nested locks',
    title: 'Open several panels, unlock in any order',
    description:
      'Each side panel holds its own lock with createScrollLock. The page stays locked until the last one closes, whichever order you close them in (button or Escape), and returns to the same scroll position.',
    files: {
      html: `<div class="toolbar">
  <button type="button" aria-expanded="false" aria-controls="cart">Cart</button>
  <button type="button" aria-expanded="false" aria-controls="filters">Filters</button>
  <output id="status" aria-live="polite">Page scrolls</output>
</div>
<aside class="panel" id="cart" popover="manual" aria-labelledby="cart-title">
  <div class="header">
    <h2 id="cart-title">Cart</h2>
    <button type="button" class="close" aria-label="Close cart">${closeIcon}</button>
  </div>
</aside>
<aside class="panel" id="filters" popover="manual" aria-labelledby="filters-title">
  <div class="header">
    <h2 id="filters-title">Filters</h2>
    <button type="button" class="close" aria-label="Close filters">${closeIcon}</button>
  </div>
</aside>
${page}`,
      css: `${pageCss}
.toolbar { position: fixed; inset: 0 0 auto; z-index: 1; display: flex; gap: 0.5rem; align-items: center; padding: 0.75rem 1rem; padding-right: calc(1rem + var(--scroll-lock-gap, 0px)); background: #fff; border-bottom: 1px solid #ddd; }
[aria-expanded='true'] { background: #1d4ed8; color: #fff; }
/* Below the toolbar, so both buttons stay in reach. */
.panel { position: fixed; inset: 3.5rem auto 0; width: min(18rem, calc(100vw - 3rem)); height: auto; margin: 0; padding: 1rem; box-sizing: border-box; border: 0; background: #fff; box-shadow: 0 0 2rem rgb(0 0 0 / 0.2); }
#cart { right: 0; }
#filters { left: 0; }
.page { padding-top: 4rem; }`,
      js: `// ScrollLock comes from the browser bundle.
${nestedScript('ScrollLock.')}`,
      esm: `import { createScrollLock, isScrollLocked } from '@samline/scroll-lock'

${nestedScript('')}`,
    },
  },
  {
    id: 'popover',
    tab: 'Popover menu',
    title: 'Lock while a popover menu is open',
    description:
      'A popover with data-scroll-lock locks the page from the moment it opens until it closes: the close button, a chosen link, Escape or a click outside. The lock needs no script of your own.',
    files: {
      html: `<button type="button" popovertarget="menu">Menu</button>
<nav id="menu" popover data-scroll-lock aria-labelledby="menu-title">
  <div class="header">
    <h2 id="menu-title">Menu</h2>
    <button type="button" class="close" popovertarget="menu" popovertargetaction="hide" aria-label="Close the menu">${closeIcon}</button>
  </div>
  <a href="#home">Home</a>
  <a href="#products">Products</a>
  <a href="#contact">Contact</a>
</nav>
${page}`,
      css: `${pageCss}
[popovertarget='menu']:not(.close) { position: fixed; top: 1rem; right: 1rem; }
#menu { position: fixed; inset: 0 0 0 auto; width: min(18rem, calc(100vw - 3rem)); height: 100dvh; margin: 0; padding: 1rem; box-sizing: border-box; flex-direction: column; gap: 1rem; border: 0; box-shadow: 0 0 2rem rgb(0 0 0 / 0.2); }
#menu:popover-open { display: flex; }`,
      js: `// The bundle already watches [data-scroll-lock], popovers included.
${menuScript}`,
      esm: `import { autoScrollLock } from '@samline/scroll-lock'

autoScrollLock()

${menuScript}`,
    },
  },
]
