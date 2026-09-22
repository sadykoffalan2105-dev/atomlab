import { EnergyLadder } from '../kit/EnergyLadder'
import { MN2O7_LADDER } from './mn2o7Energetics'
import { getMn2o7MechanismText, type Mn2o7Locale } from './mn2o7MechanismText'

/**
 * Лестница Гесса для уравнения учебника 2 KMnO₄ + H₂SO₄ → Mn₂O₇ + K₂SO₄ + H₂O в панели урока.
 *
 * Это НЕ цикл Борна — Габера: степени окисления не меняются. Ступени — теплоты образования
 * из простых веществ (с множителем 2 у KMnO₄), сумма — ΔH реакции. ΔH°f(Mn₂O₇) — оценка
 * из вторичного источника, поэтому и сумма — оценка (подпись говорит об этом).
 */
export function Mn2o7EnergyPanel({ locale, compact = false }: { locale: Mn2o7Locale; compact?: boolean }) {
  const text = getMn2o7MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={MN2O7_LADDER}
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
