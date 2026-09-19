import { EnergyLadder } from '../kit/EnergyLadder'
import { FES_LADDER } from './fesEnergetics'
import { getFesMechanismText, type FesLocale } from './fesMechanismText'

/**
 * Энергетическая лестница Fe + S → FeS в панели урока.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx).
 * Ступени и знаки приходят из fesEnergetics.ts (закон Гесса по данным
 * thermoData), подписи — из текстов урока (ru/en/uz). Этот файл остался тонкой
 * обёрткой, чтобы панель механизма не знала о внутренностях урока.
 */
export function FesEnergyPanel({ locale, compact = false }: { locale: FesLocale; compact?: boolean }) {
  const text = getFesMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={FES_LADDER}
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
