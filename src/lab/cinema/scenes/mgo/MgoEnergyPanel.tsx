import { EnergyLadder } from '../kit/EnergyLadder'
import { MGO_LADDER } from './mgoEnergetics'
import { getMgoMechanismText, type MgoLocale } from './mgoMechanismText'

/**
 * Лестница Борна — Габера для MgO в панели урока.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * семь ступеней и их знаки берутся из BORN_HABER.mgo, подписи — из текстов
 * урока (ru/en/uz). Главное, что видно на графике: EA₂ (O⁻ + e⁻ → O²⁻) —
 * ЕДИНСТВЕННАЯ ступень сродства, которая идёт ВВЕРХ, и всё равно весь цикл
 * уходит глубоко вниз за счёт энергии решётки.
 */
export function MgoEnergyPanel({ locale, compact = false }: { locale: MgoLocale; compact?: boolean }) {
  const text = getMgoMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={MGO_LADDER}
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
