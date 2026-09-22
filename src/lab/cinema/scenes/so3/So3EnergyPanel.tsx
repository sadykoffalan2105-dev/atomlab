import { EnergyLadder } from '../kit/EnergyLadder'
import { SO3_LADDER } from './so3Energetics'
import { getSo3MechanismText, type So3Locale } from './so3MechanismText'

/**
 * Лестница энергии контактного способа в панели урока: две стадии школьной схемы катализа
 * (V₂O₅ + SO₂ → V₂O₄ + SO₃ и V₂O₄ + ½ O₂ → V₂O₅), обе с множителем 2 на уравнение
 * 2 SO₂ + O₂ → 2 SO₃. Ступени и знаки — из thermoData (REACTION_STEP_CHAINS.so2_v2o5),
 * подписи — из текстов урока (ru/en/uz).
 */
export function So3EnergyPanel({ locale, compact = false }: { locale: So3Locale; compact?: boolean }) {
  const text = getSo3MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={SO3_LADDER}
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
