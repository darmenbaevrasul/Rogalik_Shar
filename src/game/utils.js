export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function magnitude(x, y) {
  return Math.hypot(x, y)
}

export function normalize(x, y) {
  const length = magnitude(x, y)
  if (!length) {
    return { x: 0, y: 0 }
  }

  return { x: x / length, y: y / length }
}

export function distanceSquared(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x)
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = String(Math.floor(total / 60)).padStart(2, '0')
  const remainder = String(total % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value))
}
