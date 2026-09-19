import { EnergyLadder } from '../kit/EnergyLadder'
import { NH3_LADDER } from './nh3Energetics'
import { getNh3MechanismText, type Nh3Locale } from './nh3MechanismText'

/**
 * Лестница энергии по связям для синтеза аммиака в панели урока.
 *
 * У аммиака нет ионной решётки, поэтому цикла Борна — Габера тоже нет: ступени
 * считаются по энергиям связей (nh3Energetics.ts), а сумма проверяется
 * независимым расчётом по теплотам образования. Подписи — из текстов урока (ru/en/uz).
 */
export function Nh3EnergyPanel({ locale, compact = false }: { locale: Nh3Locale; compact?: boolean }) {
  const text = getNh3MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={NH3_LADDER}
      compact={compact}
      text={{
        unit: text.unit,
        stages: text.stages,
        total: text.stages.total,
        caption: text.caption,
        sources: text.sources,
        summary: text.summary,
      }}
    />
  )
}
