import { EnergyLadder } from '../kit/EnergyLadder'
import { NACL_LADDER } from './naclEnergetics'
import { getNaclMechanismText, type NaclLocale } from './naclMechanismText'

/**
 * Лестница Борна — Габера для NaCl в панели урока.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * ступени и знаки берутся из BORN_HABER.nacl, подписи — из текстов урока
 * (ru/en/uz). Этот файл остался тонкой обёрткой, чтобы панель механизма
 * не знала о внутренностях урока.
 */
export function NaclEnergyPanel({ locale, compact = false }: { locale: NaclLocale; compact?: boolean }) {
  const text = getNaclMechanismText(locale).energy
  return (
    <EnergyLadder
      ladder={NACL_LADDER}
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
