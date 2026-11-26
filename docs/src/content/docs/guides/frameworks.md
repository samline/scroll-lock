---
title: 'Frameworks and lock lifetimes'
titleAccent: 'lock lifetimes'
description: Lock scroll from React, Vue, Svelte, Astro, Shopify and WordPress, release locks on navigation and keep them held during animated dismissal.
locale: en
sidebar:
  group: guides
  order: 4
---

Scroll Lock has no framework components. Take a lock when your overlay opens and release it when the overlay closes or its owner goes away. Every function is inert on the server, but take the lock in a mount hook or effect anyway, so it is tied to the overlay's lifetime.

## React, Vue and Svelte

Acquire in the lifecycle, release in its cleanup.

```jsx
// React
import { lockScroll } from '@samline/scroll-lock'
import { useEffect } from 'react'

export function Sheet({ open }) {
  useEffect(() => {
    if (!open) return
    return lockScroll() // the cleanup releases it
  }, [open])
  return open ? <div role="dialog">…</div> : null
}
```

```vue
<!-- Vue -->
<script setup>
import { createScrollLock } from '@samline/scroll-lock'
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps({ open: Boolean })
const lock = createScrollLock()

watch(
  () => props.open,
  open => (open ? lock.lock() : lock.unlock()),
  { immediate: true }
)
onBeforeUnmount(() => lock.destroy())
</script>
```

```svelte
<!-- Svelte 5 -->
<script>
  import { lockScroll } from '@samline/scroll-lock'

  let { open } = $props()

  $effect(() => {
    if (open) return lockScroll() // re-runs release the previous lock
  })
</script>
```

`lockScroll()` returns the release function and `createScrollLock()` returns a controller; `destroy()` releases whatever it holds.

## Astro

Use a processed client `<script>` in the `.astro` file. Mark the elements with `data-scroll-lock` and start `autoScrollLock()` once. With `<ClientRouter />`, start it on `astro:page-load` and destroy it on `astro:before-swap`, so an open dialog never leaves the next page locked.

```astro
<dialog id="terms" data-scroll-lock>
  …
</dialog>

<script>
  import { autoScrollLock } from '@samline/scroll-lock'

  let controller: { destroy: () => void } | undefined

  // astro:page-load fires only with <ClientRouter />. Without client navigation, run this setup once at the top level.
  document.addEventListener('astro:page-load', () => {
    controller = autoScrollLock()
  })
  document.addEventListener('astro:before-swap', () => controller?.destroy())
</script>
```

## Shopify

Copy `dist/browser/scroll-lock.global.js` of the pinned release into the theme's `assets/` folder and load it once in `layout/theme.liquid`. It defines `window.ScrollLock` and watches every `[data-scroll-lock]` element, including sections the theme editor adds later.

```liquid
<script src="{{ 'scroll-lock.global.js' | asset_url }}" defer></script>
```

For a lock your own section script opens, such as a cart drawer, hold a controller per section: create it on `shopify:section:load` and call `destroy()` on `shopify:section:unload`, which releases any lock it holds. `event.target` is the section element. Run `mount` once for the sections already on the page.

```js
const locks = new Map()

const mount = root => {
  const lock = window.ScrollLock.createScrollLock()
  locks.set(root, lock)
  root.querySelector('[data-open]')?.addEventListener('click', () => lock.lock())
  root.querySelector('[data-close]')?.addEventListener('click', () => lock.unlock())
}

document.addEventListener('shopify:section:load', event => mount(event.target))
document.addEventListener('shopify:section:unload', event => {
  locks.get(event.target)?.destroy()
  locks.delete(event.target)
})
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.shopify-section').forEach(mount)
})
```

See [Shopify's section events](https://shopify.dev/docs/storefronts/themes/best-practices/editor/integrate-sections-and-blocks).

## WordPress

Enqueue the pinned classic script from your theme or plugin, deferred, on the front end. `'strategy' => 'defer'` needs WordPress 6.3 or newer.

```php
add_action('wp_enqueue_scripts', function () {
  wp_enqueue_script(
    'scroll-lock',
    'https://cdn.jsdelivr.net/npm/@samline/scroll-lock@1.3.0/dist/browser/scroll-lock.global.js',
    [],
    null,
    ['strategy' => 'defer', 'in_footer' => true]
  );
});
```

Once the DOM is ready the bundle watches every `[data-scroll-lock]` element in the rendered content, so a Custom HTML block needs no JavaScript of its own. Inline event attributes such as `onclick` are stripped by WordPress for users without the `unfiltered_html` capability, so prefer the enqueued script approach and attach the click handler there. The markup below shows the inline form:

```html
<dialog id="terms" data-scroll-lock>…</dialog>
<button onclick="document.getElementById('terms').showModal()">Terms</button>
```

For your own scripts, enqueue them with `scroll-lock` as a dependency so `window.ScrollLock` exists. See [wp_enqueue_script](https://developer.wordpress.org/reference/functions/wp_enqueue_script/).

## Release a lock when leaving a view

Create an abort controller when you open the overlay. Abort it when the view unmounts or navigation replaces it.

```js
import { getScrollLockState, lockScroll } from '@samline/scroll-lock'

const lifetime = new AbortController()
lockScroll({ signal: lifetime.signal })

const leaveView = () => {
  lifetime.abort()
  const { count } = getScrollLockState()
  return count
}
```

Other components keep their locks. Create a fresh abort controller the next time the view opens.

## Keep the lock during animated dismissal

With a modal `<dialog>`, call `showModal()` and acquire the lock. Route the close button and the dialog's native `cancel` request through the same closing code. Keep the dialog open while its animation runs, then close it and release the lock. Skip the animation when the user prefers reduced motion.

The [working examples](../examples/) include the full HTML, CSS and JavaScript for both lifetimes, in module and CDN form.

## Recover after interrupted navigation

`resetScrollLock()` releases every lock. Use it when you own the entire page and need to recover from missing cleanup. A controller can take a new lock after a reset unless it has been destroyed.
