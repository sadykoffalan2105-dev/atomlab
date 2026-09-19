import { EnergyLadder } from '../kit/EnergyLadder'
import { ZNCL2_LADDER } from './zncl2Energetics'
import { getZncl2MechanismText, type Zncl2Locale } from './zncl2MechanismText'

/**
 * Лестница энергии реакции Zn + 2 HCl → ZnCl₂ + H₂↑ в панели урока.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * ступени и знаки берутся из BORN_HABER.zncl2_aq, подписи — из текстов урока
 * (ru/en/uz). Это не цикл Борна — Габера, а цикл Гесса того же вида: реакцию
 * в растворе разложили на газофазные стадии, сумма равна ΔH реакции.
 */
export function Zncl2EnergyPanel({ locale, compact = false }: { locale: Zncl2Locale; compact?: boolean }) {
  const text = getZncl2MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={ZNCL2_LADDER}
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
