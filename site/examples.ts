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

const navigationScript = (api: string) => `const panel = document.querySelector('#project-tools')
const section = document.querySelector('#view-title')
const status = document.querySelector('#navigation-status')
const opener = document.querySelector('#open-tools')
let lifetime

const report = () => {
  const { locked, count } = ${api}getScrollLockState()
  status.value = locked ? \`Page locked (\${count})\` : 'Page scrolls'
}

opener.addEventListener('click', () => {
  if (lifetime) return
  lifetime = new AbortController()
  ${api}lockScroll({ signal: lifetime.signal })
  panel.hidden = false
  opener.setAttribute('aria-expanded', 'true')
  report()
})

for (const button of document.querySelectorAll('[data-view]')) {
  button.addEventListener('click', () => {
    panel.hidden = true
    lifetime?.abort()
    lifetime = undefined
    opener.setAttribute('aria-expanded', 'false')
    section.textContent = button.dataset.view
    report()
  })
}`

const animatedScript = (api: string) => `const menu = document.querySelector('#animated-menu')
const lock = ${api}createScrollLock()
let exit

document.querySelector('#open-animated').addEventListener('click', () => {
  if (exit || menu.open) return
  menu.showModal()
  lock.lock()
})

const close = async () => {
  if (exit || !menu.open) return
  if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    exit = menu.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' })
    await Promise.allSettled([exit.finished])
  }
  menu.close()
  exit?.cancel()
  exit = undefined
  lock.unlock()
}

menu.addEventListener('cancel', event => {
  event.preventDefault()
  void close()
})
menu.querySelector('button').addEventListener('click', close)
menu.addEventListener('close', () => {
  if (!menu.open) lock.unlock()
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
  {
    id: 'navigation',
    tab: 'Navigation cleanup',
    title: 'Release a lock when leaving a view',
    description:
      'Open the project tools, then switch views. The outgoing view aborts its scroll lock and the status shows how many locks remain on the page.',
    files: {
      html: `<nav class="view-controls" aria-label="Workspace views">
  <button type="button" data-view="Overview">Overview</button>
  <button type="button" data-view="Projects">Projects</button>
  <button type="button" id="open-tools" aria-controls="project-tools" aria-expanded="false">Open project tools</button>
  <output id="navigation-status" aria-live="polite">Page scrolls</output>
</nav>
<div class="workspace">
  <h1 id="view-title">Overview</h1>
  <aside id="project-tools" hidden aria-label="Project tools">Switch views to dismiss the project tools.</aside>
  ${page}
</div>`,
      css: `${pageCss}
.view-controls { position: fixed; inset: 0 0 auto; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1rem; background: white; }
.workspace { padding: 6rem 1.5rem 0; }`,
      js: navigationScript('ScrollLock.'),
      esm: `import { getScrollLockState, lockScroll } from '@samline/scroll-lock'

${navigationScript('')}`,
    },
  },
  {
    id: 'animated',
    tab: 'Animated close',
    title: 'Keep the page locked during an exit animation',
    description:
      'The menu keeps its lock until the fade finishes. Close it with the button or Escape. With reduced motion, it closes immediately.',
    files: {
      html: `<button type="button" id="open-animated" aria-haspopup="dialog">Open account menu</button>
<dialog id="animated-menu" aria-labelledby="account-title">
  <h1 id="account-title">Account menu</h1>
  <button type="button" autofocus>Close account menu</button>
</dialog>
${page}`,
      css: `${pageCss}
#open-animated { position: fixed; inset: 1rem 1rem auto auto; }
dialog { width: min(24rem, calc(100vw - 2rem)); box-sizing: border-box; }
dialog::backdrop { background: rgb(0 0 0 / 0.4); }`,
      js: animatedScript('ScrollLock.'),
      esm: `import { createScrollLock } from '@samline/scroll-lock'

${animatedScript('')}`,
    },
  },
]
