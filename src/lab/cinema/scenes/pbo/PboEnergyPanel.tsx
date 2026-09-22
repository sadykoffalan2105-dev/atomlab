import { EnergyLadder } from '../kit/EnergyLadder'
import { PBO_LADDER } from './pboEnergetics'
import { getPboMechanismText, type PboLocale } from './pboMechanismText'

/**
 * Формальная лестница Борна — Габера для PbO в панели урока (общий компонент kit/EnergyLadder):
 * семь ступеней и их знаки — из BORN_HABER.pbo, подписи — из текстов урока (ru/en/uz).
 * EA₂ (O⁻ + e⁻ → O²⁻) — единственная ступень сродства, которая идёт вверх.
 */
export function PboEnergyPanel({ locale, compact = false }: { locale: PboLocale; compact?: boolean }) {
  const text = getPboMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={PBO_LADDER}
      compact={compact}
      text={{
        unit: text.unit,
        stages: text.stages,
        total: text.stages.total,
        caption: text.caption,
        sources: text.sources,
        summary: text.summary,
        // Десятичный знак по соглашению учебника языка: ru/uz — запятая, en — точка.
        decimal: locale === 'en' ? '.' : ',',
      }}
    />
  )
}
