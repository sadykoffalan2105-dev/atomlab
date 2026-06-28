/** Инвариант zero-gap: при edit с атомами центр реактора не пустой. */
export type ReactorPreviewZeroGapInput = {
  reactorViewOpen: boolean
  synthLive: boolean
  previewAtomCount: number
  previewMounted: boolean
  previewVisible: boolean
  productPrewarm: boolean
}

export function isReactorPreviewZeroGapOk(input: ReactorPreviewZeroGapInput): boolean {
  const {
    reactorViewOpen,
    synthLive,
    previewAtomCount,
    previewMounted,
    previewVisible,
    productPrewarm,
  } = input
  if (!reactorViewOpen || synthLive || previewAtomCount <= 0) return true
  if (previewVisible && previewMounted) return true
  if (productPrewarm) return true
  return false
}

export function assertReactorPreviewZeroGap(input: ReactorPreviewZeroGapInput): void {
  if (import.meta.env.PROD) return
  if (!isReactorPreviewZeroGapOk(input)) {
    console.warn('[reactorPreviewZeroGap] empty center during coeff edit', input)
  }
}
