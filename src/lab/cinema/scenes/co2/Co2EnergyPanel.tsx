import { EnergyLadder } from '../kit/EnergyLadder'
import { CO2_LADDER } from './co2Energetics'
import { getCo2MechanismText, type Co2Locale } from './co2MechanismText'

/**
 * Лестница энергии горения углерода в панели урока.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * ступени и знаки берутся из BORN_HABER.co2 (цикл Гесса: атомизация графита — формальная,
 * НЕ физическая стадия; диссоциация O₂ — 2 × ΔH°f(O, г.); образование двух связей C=O),
 * подписи — из текстов урока (ru/en/uz). Этот файл — тонкая обёртка, чтобы панель
 * механизма не знала о внутренностях урока.
 */
export function Co2EnergyPanel({ locale, compact = false }: { locale: Co2Locale; compact?: boolean }) {
  const text = getCo2MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={CO2_LADDER}
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
