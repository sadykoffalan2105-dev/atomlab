/** Кэш GPU-компиляции продукта синтеза — повторные запуски без cold-start hitch. */
const compiledProductIds = new Set<string>()

export function isProductGpuCompiled(compoundId: string): boolean {
  return compiledProductIds.has(compoundId)
}

export function markProductGpuCompiled(compoundId: string): void {
  compiledProductIds.add(compoundId)
}

export function resetProductGpuCompileCache(): void {
  compiledProductIds.clear()
}
