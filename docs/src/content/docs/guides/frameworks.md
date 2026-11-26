---
title: 'Lock lifetimes'
titleAccent: 'lifetimes'
description: Release scroll locks on vanilla navigation and keep them held during animated dismissal.
locale: en
sidebar:
  group: guides
  order: 4
---

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
