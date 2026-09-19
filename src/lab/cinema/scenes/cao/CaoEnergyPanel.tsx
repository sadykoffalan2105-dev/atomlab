import { EnergyLadder } from '../kit/EnergyLadder'
import { CAO_LADDER } from './caoEnergetics'
import { getCaoMechanismText, type CaoLocale } from './caoMechanismText'

/**
 * Лестница Гесса для обжига известняка в панели урока.
 *
 * В отличие от NaCl и MgO это НЕ цикл Борна — Габера: степени окисления здесь
 * не меняются, ионизации и сродства к электрону нет. Ступени — теплоты
 * образования из простых веществ (CRC), сумма даёт ΔH реакции +179,2 кДж/моль,
 * поэтому итоговая ступень единственная в наборе сцен смотрит ВВЕРХ.
 */
export function CaoEnergyPanel({ locale, compact = false }: { locale: CaoLocale; compact?: boolean }) {
  const text = getCaoMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={CAO_LADDER}
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
