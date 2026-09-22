import { EnergyLadder } from '../kit/EnergyLadder'
import { H2O_LADDER } from './h2oEnergetics'
import { getH2oMechanismText, type H2oLocale } from './h2oMechanismText'

/**
 * Лестница энергии воды в панели урока — РАСЧЁТНЫЙ путь закона Гесса через свободные атомы
 * (не стадии реакции: реальный путь — цепь шагов 2–4), а не цикл Борна — Габера.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * ступени и знаки берутся из h2oEnergetics (ΔH°f ядра, у H₂ → 2 H — множитель 2),
 * подписи — из текстов урока (ru/en/uz).
 */
export function H2oEnergyPanel({ locale, compact = false }: { locale: H2oLocale; compact?: boolean }) {
  const text = getH2oMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={H2O_LADDER}
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
