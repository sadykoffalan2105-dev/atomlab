import { EnergyLadder } from '../kit/EnergyLadder'
import { SIO2_LADDER } from './sio2Energetics'
import { getSio2MechanismText, type Sio2Locale } from './sio2MechanismText'

/**
 * Лестница Гесса для SiO₂ в панели урока (атомизация Si, 2 O, четыре связи Si–O).
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx): ступени и множители
 * приходят из sio2Energetics (числа — из ядра), подписи — из текстов урока (ru/en/uz).
 */
export function Sio2EnergyPanel({ locale, compact = false }: { locale: Sio2Locale; compact?: boolean }) {
  const text = getSio2MechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={SIO2_LADDER}
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
