import { EnergyLadder } from '../kit/EnergyLadder'
import { AL2O3_LADDER } from './al2o3Energetics'
import { getAl2o3MechanismText, type Al2o3Locale } from './al2o3MechanismText'

/**
 * Лестница Борна — Габера для Al₂O₃ в панели урока: ступени с множителями частиц
 * (2 Al, 3 O) из BORN_HABER.al2o3, подписи — из текстов урока (ru/en/uz).
 * Тонкая обёртка над общим компонентом набора сцен (scenes/kit/EnergyLadder.tsx).
 */
export function Al2o3EnergyPanel({ locale, compact = false }: { locale: Al2o3Locale; compact?: boolean }) {
  const text = getAl2o3MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={AL2O3_LADDER}
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
