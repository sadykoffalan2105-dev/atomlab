/** Политика GPU-prewarm продукта: при балансе уравнения и во время синтеза. */
export type GpuPrewarmPolicy = 'off' | 'synthesis-only' | 'intent'

export function shouldMountProductGpuPrewarm(opts: {
  policy: GpuPrewarmPolicy
  synthesisRunActive: boolean
  synthActive: boolean
  showSettledHero: boolean
  hasPrewarmIntent?: boolean
}): boolean {
  const { policy, synthesisRunActive, synthActive, showSettledHero, hasPrewarmIntent } = opts
  if (showSettledHero) return false
  if (policy === 'off') return false
  if (policy === 'intent') return hasPrewarmIntent === true || synthesisRunActive || synthActive
  if (policy === 'synthesis-only') return synthesisRunActive || synthActive
  return synthesisRunActive || synthActive
}
