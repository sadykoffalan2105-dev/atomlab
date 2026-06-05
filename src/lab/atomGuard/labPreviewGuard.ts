/** Инварианты превью лаборатории: продукт в 3D только после синтеза. */

export function assertNoProductHeroBeforeRun(
  runId: number,
  productSlotVisible: boolean,
  transformPreviewActive: boolean,
): void {
  if (import.meta.env.PROD) return
  if (runId <= 0 && (productSlotVisible || transformPreviewActive)) {
    console.warn(
      '[atomGuard] 3D-продукт не должен показываться до запуска синтеза (runId=0).',
    )
  }
}
