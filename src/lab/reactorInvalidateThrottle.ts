/** Ограничение invalidate() при burst — не чаще maxHz. */
export function createReactorInvalidateThrottle(maxHz = 30) {
  let lastMs = 0
  const minGap = 1000 / Math.max(8, maxHz)
  return {
    request(invalidate: () => void): boolean {
      const now = performance.now()
      if (now - lastMs < minGap) return false
      lastMs = now
      invalidate()
      return true
    },
    reset() {
      lastMs = 0
    },
  }
}
