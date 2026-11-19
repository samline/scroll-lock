---
title: 'Framework integrations'
titleAccent: 'integrations'
description: Use @samline/scroll-lock in React, Vue, Svelte and Astro, and release every lock when a client-side router changes the page.
locale: en
sidebar:
  group: guides
  order: 4
---

`lockScroll()` returns its release, so it fits any cleanup hook. Lock when the overlay opens, release when it closes or unmounts.

## React

```jsx
import { lockScroll } from '@samline/scroll-lock'
import { useEffect } from 'react'

export function Drawer({ open, children }) {
  useEffect(() => (open ? lockScroll() : undefined), [open])
  return open ? <aside className="drawer">{children}</aside> : null
}
```

## Vue

```vue
<script setup>
import { lockScroll } from '@samline/scroll-lock'
import { watchEffect } from 'vue'

const props = defineProps({ open: Boolean })

watchEffect(onCleanup => {
  if (props.open) onCleanup(lockScroll())
})
</script>
```

## Svelte

```svelte
<script>
  import { lockScroll } from '@samline/scroll-lock'

  let { open } = $props()

  $effect(() => {
    if (open) return lockScroll()
  })
</script>
```

## Astro

```astro
<dialog id="terms" data-scroll-lock>
  …
</dialog>

<script>
  import { autoScrollLock } from '@samline/scroll-lock'

  autoScrollLock()
</script>
```

`autoScrollLock` watches the whole document, so dialogs swapped in by Astro view transitions, swup, Turbo or htmx are picked up without starting it again, and the lock of a dialog removed while open is released.

## Client-side routers

A route change can unmount an overlay without running its cleanup. Release every lock after navigation:

```js
import { resetScrollLock } from '@samline/scroll-lock'

router.afterEach(() => resetScrollLock())
```

Controllers that held a lock report themselves unlocked afterwards and can lock again.
