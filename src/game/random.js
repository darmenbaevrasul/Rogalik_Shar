export function createRng(seed = Date.now()) {
  let value = seed >>> 0

  function next() {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return ((value >>> 0) % 1_000_000) / 1_000_000
  }

  return {
    next,
    float(min, max) {
      return min + (max - min) * next()
    },
    int(min, max) {
      return Math.floor(this.float(min, max + 1))
    },
  }
}
