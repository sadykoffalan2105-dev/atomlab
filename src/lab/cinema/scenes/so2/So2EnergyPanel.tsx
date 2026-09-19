import { EnergyLadder } from '../kit/EnergyLadder'
import { SO2_LADDER } from './so2Energetics'
import { getSo2MechanismText, type So2Locale } from './so2MechanismText'

/**
 * Энергетическая лестница реакции S + O₂ → SO₂ в панели урока.
 *
 * Это НЕ цикл Борна — Габера (связь ковалентная, решётки нет): три ступени —
 * атомизация серы, диссоциация кислорода и образование двух связей S=O.
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx),
 * числа берутся из so2Energetics (а те — из chemistry/data), подписи — из
 * текстов урока (ru/en/uz).
 */
export function So2EnergyPanel({ locale, compact = false }: { locale: So2Locale; compact?: boolean }) {
  const text = getSo2MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={SO2_LADDER}
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
