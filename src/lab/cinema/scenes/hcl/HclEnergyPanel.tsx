import { EnergyLadder } from '../kit/EnergyLadder'
import { HCL_LADDER } from './hclEnergetics'
import { getHclMechanismText, type HclLocale } from './hclMechanismText'

/**
 * Лестница по энергиям связей для H₂ + Cl₂ → 2 HCl в панели урока.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * ступени и знаки берутся из bondData через hclEnergetics, подписи — из текстов
 * урока (ru/en/uz). Этот файл остался тонкой обёрткой, чтобы панель механизма
 * не знала о внутренностях урока.
 */
export function HclEnergyPanel({ locale, compact = false }: { locale: HclLocale; compact?: boolean }) {
  const text = getHclMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={HCL_LADDER}
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
