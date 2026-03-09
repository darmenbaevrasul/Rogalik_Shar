import { normalize } from './utils.js'

function normalizeKey(key) {
  if (key === ' ') {
    return 'space'
  }

  return key.toLowerCase()
}

export function createInput(target = window) {
  const held = new Set()
  const pressed = new Set()
  const blockedKeys = new Set([
    'w',
    'a',
    's',
    'd',
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    ' ',
    'f',
    'm',
    '1',
    '2',
    '3',
    'r',
  ])

  const onKeyDown = (event) => {
    const key = normalizeKey(event.key)
    if (!held.has(key)) {
      pressed.add(key)
    }
    held.add(key)

    if (blockedKeys.has(event.key.toLowerCase()) || blockedKeys.has(event.key)) {
      event.preventDefault()
    }
  }

  const onKeyUp = (event) => {
    held.delete(normalizeKey(event.key))
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)

  return {
    getMovementVector() {
      const horizontal = (held.has('d') || held.has('arrowright') ? 1 : 0) - (held.has('a') || held.has('arrowleft') ? 1 : 0)
      const vertical = (held.has('s') || held.has('arrowdown') ? 1 : 0) - (held.has('w') || held.has('arrowup') ? 1 : 0)
      return normalize(horizontal, vertical)
    },
    consumePressed(key) {
      const normalized = normalizeKey(key)
      if (!pressed.has(normalized)) {
        return false
      }

      pressed.delete(normalized)
      return true
    },
    consumeDigitChoice() {
      for (const key of ['1', '2', '3']) {
        if (this.consumePressed(key)) {
          return Number(key) - 1
        }
      }

      return null
    },
  }
}
