import { STATE_ATTRIBUTE } from '../core/scroll-lock.js'

interface State {
  original: string | null
  owners: Set<() => 'locked' | 'unlocked' | undefined>
}

const states = new WeakMap<Element, State>()

/** Watched elements can also be targets of other locks. A held lock wins. */
export const trackLockState = (element: Element, idle?: 'unlocked') => {
  let state = states.get(element)
  if (!state) {
    state = { original: element.getAttribute(STATE_ATTRIBUTE), owners: new Set() }
    states.set(element, state)
  }
  const { original, owners } = state
  let locked = false
  const read = () => (locked ? 'locked' : idle)
  owners.add(read)

  const sync = () => {
    let value: string | null = original
    for (const owner of owners) {
      const current = owner()
      if (current) value = current
      if (current === 'locked') break
    }
    if (element.getAttribute(STATE_ATTRIBUTE) === value) return
    if (value === null) element.removeAttribute(STATE_ATTRIBUTE)
    else element.setAttribute(STATE_ATTRIBUTE, value)
  }

  return {
    update: (value: boolean) => {
      locked = value
      sync()
    },
    destroy: () => {
      if (!owners.delete(read)) return
      if (!owners.size) states.delete(element)
      sync()
    },
  }
}

export const markLocked = (element: Element): (() => void) => {
  const state = trackLockState(element)
  state.update(true)
  return state.destroy
}
