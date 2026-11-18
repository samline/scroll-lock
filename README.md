# @samline/scroll-lock

Lock the page scroll while a modal, drawer or menu is open: nested locks that release in any order, no layout shift when the scrollbar goes away, the scroll position back where it was, and the workaround iOS Safari needs. For vanilla JavaScript, any framework and plain HTML.

[Demo](https://samline.github.io/scroll-lock/) · [Examples](https://samline.github.io/scroll-lock/examples/) · [Documentation](https://samline.github.io/scroll-lock/docs/) · [Changelog](CHANGELOG.md)

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [HTML / CDN](#html--cdn)
- [Capabilities](#capabilities)
- [API at a glance](#api-at-a-glance)
- [Documentation](#documentation)
- [Changelog](#changelog)
- [AI agent skill](#ai-agent-skill)
- [License](#license)

## Installation

```sh
npm install @samline/scroll-lock
```

```sh
pnpm add @samline/scroll-lock
```

```sh
bun add @samline/scroll-lock
```

Any modern browser. On the server, every function is inert. No runtime dependencies.

## Quick start

Mark the element; the page stays locked while it is open:

```html
<dialog id="terms" data-scroll-lock>…</dialog>
```

```js
import { autoScrollLock } from '@samline/scroll-lock'

autoScrollLock()
document.querySelector('#terms').showModal() // locked until it closes
```

From your own code:

```js
import { lockScroll } from '@samline/scroll-lock'

const unlock = lockScroll()
// …
unlock()
```

One lock per component, opened and closed as often as it likes:

```js
import { createScrollLock } from '@samline/scroll-lock'

const lock = createScrollLock()
menuButton.addEventListener('click', () => lock.toggle())
```

## HTML / CDN

For Shopify, WordPress or plain HTML pages without a build step, load the browser bundle. It watches every `[data-scroll-lock]` element as soon as the DOM is ready. Pin the version in production.

```html
<script
  src="https://cdn.jsdelivr.net/npm/@samline/scroll-lock@1.0.0/dist/browser/scroll-lock.global.js"
  defer
></script>
```

The bundle defines `window.ScrollLock`. `ScrollLock.lock()` and `ScrollLock.unlock()` hold one shared lock for inline handlers. Add `data-manual` to the script tag and call `ScrollLock.auto(options)` to start it with your own options.

## Capabilities

### Nested locks

A drawer opens a dialog that opens a menu: each takes its own lock, and the page unlocks only when the last one is released, in any order. Releasing twice does nothing, and `createScrollLock()` gives each component one lock it cannot release twice.

### No layout shift

When the scrollbar disappears, its width moves to `<body>`'s right padding, so the content does not jump sideways. The same width is available as `--scroll-lock-gap` for fixed headers and toolbars. Pages that already reserve the gutter with `scrollbar-gutter: stable` are left alone.

### Back where it was

The page keeps its scroll position while locked and after, even with `scroll-behavior: smooth`, which would otherwise animate it back. Pin the body with `positionFixed` and the position is restored when it unpins.

### Works on iOS Safari

`overflow: hidden` does not stop Mobile Safari: it scrolls the page while the toolbars collapse, under the keyboard and when an input is focused. On iPhone and iPad, the lock switches to a proven workaround, adapted from vaul and React Spectrum, that blocks page touches, keeps scrollable areas inside the modal working and keeps focused inputs above the keyboard.

### Declarative

`data-scroll-lock` on a `<dialog>`, `<details>`, popover or any element locks the page while it is open, and releases it when it closes or leaves the DOM. `data-scroll-lock-state` tells CSS which elements hold a lock and whether the page is locked.

## API at a glance

| API                            | Purpose                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `lockScroll(options?)`         | Lock the page. Returns the release, safe to call twice.                                           |
| `createScrollLock(options?)`   | One lock for a component: `{ lock, unlock, toggle, isLocked, destroy }`.                          |
| `scrollLock(target, options?)` | Lock while an element is open. Returns `{ refresh, isLocked, destroy }`.                          |
| `autoScrollLock(options?)`     | Watch every `[data-scroll-lock]`, including elements added later. Returns `{ refresh, destroy }`. |
| `isScrollLocked()`             | Whether any lock is held.                                                                         |
| `resetScrollLock()`            | Release every lock, for example after a client-side navigation.                                   |
| `mode`                         | `'auto'` (default), `'overflow'` or `'ios'`.                                                      |
| `reserveGap`                   | Compensate the scrollbar width. Defaults to `true`.                                               |
| `positionFixed`                | Pin `<body>`: `'never'` (default), `'safari'` or `'always'`.                                      |

### Entrypoints

| Entrypoint                     | When to use                                      |
| ------------------------------ | ------------------------------------------------ |
| `@samline/scroll-lock`         | ESM or CommonJS, every function.                 |
| `@samline/scroll-lock/vanilla` | `lockScroll` as the default export.              |
| `@samline/scroll-lock/browser` | Classic script that defines `window.ScrollLock`. |

## Documentation

Read the [documentation](https://samline.github.io/scroll-lock/docs/) for the full guides and API contracts, and explore [working examples](https://samline.github.io/scroll-lock/examples/) with complete and separate source files.

| Guide                                                                             | What it covers                                                        |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Installation](https://samline.github.io/scroll-lock/docs/getting-started/)       | npm, CDN and the first lock.                                          |
| [API reference](https://samline.github.io/scroll-lock/docs/reference/api/)        | Every function, its types and `window.ScrollLock`.                    |
| [Options](https://samline.github.io/scroll-lock/docs/reference/configuration/)    | Options, attributes, the state attribute and `--scroll-lock-gap`.     |
| [How it works](https://samline.github.io/scroll-lock/docs/guides/strategies/)     | Nesting, the scrollbar gap, iOS Safari and `positionFixed`.           |
| [Accessibility](https://samline.github.io/scroll-lock/docs/guides/accessibility/) | What a lock does and does not do for focus, inert content and motion. |
| [Frameworks](https://samline.github.io/scroll-lock/docs/guides/frameworks/)       | React, Vue, Svelte, Astro and client-side routers.                    |

## Changelog

Read [CHANGELOG.md](CHANGELOG.md) or the [published changelog](https://samline.github.io/scroll-lock/docs/changelog/) for release history and explicitly marked breaking and behavior changes. Review the notes before upgrading.

## AI agent skill

The [Scroll Lock skill](https://samline.github.io/scroll-lock/skills/scroll-lock/SKILL.md) teaches verified package integration. Its maintained [repository source](skills/scroll-lock/SKILL.md) and website download are the same file. Verify the installed package version before applying its guidance.

Download [SKILL.md](https://samline.github.io/scroll-lock/skills/scroll-lock/SKILL.md) into a `scroll-lock/` folder in your agent's supported skill directory. For agents that discover project skills from `.agents/skills/`:

```sh
mkdir -p .agents/skills/scroll-lock
curl --fail --location https://samline.github.io/scroll-lock/skills/scroll-lock/SKILL.md \
  --output .agents/skills/scroll-lock/SKILL.md
```

Keep the filename `SKILL.md`; discovery paths and invocation syntax depend on the agent.

## License

MIT — [LICENSE.md](LICENSE.md). It also carries the notices of vaul (MIT) and React Spectrum (Apache-2.0), the sources of the iOS Safari workaround.
