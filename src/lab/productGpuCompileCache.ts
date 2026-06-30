/** Кэш GPU-компиляции продукта синтеза — повторные запуски без cold-start hitch. */
const STORAGE_KEY = 'atomlab:gpu-compiled-products'

const compiledProductIds = new Set<string>()

function loadFromSession(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const ids = JSON.parse(raw) as string[]
    if (Array.isArray(ids)) {
      for (const id of ids) {
        if (typeof id === 'string' && id.length > 0) compiledProductIds.add(id)
      }
    }
  } catch {
    /* ignore corrupt cache */
  }
}

function persistToSession(): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...compiledProductIds]))
  } catch {
    /* quota / private mode */
  }
}

loadFromSession()

export function isProductGpuCompiled(compoundId: string): boolean {
  return compiledProductIds.has(compoundId)
}

export function markProductGpuCompiled(compoundId: string): void {
  if (compiledProductIds.has(compoundId)) return
  compiledProductIds.add(compoundId)
  persistToSession()
}

export function resetProductGpuCompileCache(): void {
  compiledProductIds.clear()
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}
