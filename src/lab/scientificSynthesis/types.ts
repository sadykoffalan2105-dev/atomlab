export type ScientificSynthesisFxProps = {
  runId?: number
  /** Слабое устройство / mobile SoC — режем искры и материалы. */
  lowPower?: boolean
  /** Удлинённая раскадровка + озвучка преподавателя (ClO₂). */
  teacherMode?: boolean
  /** Cue раскадровки для внешнего Narrator (вне Canvas). */
  onNarrationCue?: (id: string) => void
  onEmbryoReady?: () => void
  onBirthReady?: () => void
  onComplete: () => void
}
