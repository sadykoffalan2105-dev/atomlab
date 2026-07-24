export type ScientificSynthesisFxProps = {
  runId?: number
  /** Слабое устройство / mobile SoC — режем искры и материалы. */
  lowPower?: boolean
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete: () => void
}
