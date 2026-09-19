import { EnergyLadder } from '../kit/EnergyLadder'
import { H2O_LADDER } from './h2oEnergetics'
import { getH2oMechanismText, type H2oLocale } from './h2oMechanismText'

/**
 * Лестница энергии воды в панели урока — расчёт по ЭНЕРГИЯМ СВЯЗЕЙ, а не
 * цикл Борна — Габера: связь ковалентная, кристаллической решётки нет.
 *
 * Сама лестница — общий компонент набора сцен (scenes/kit/EnergyLadder.tsx):
 * ступени и знаки берутся из h2oEnergetics (BOND_DATA + FORMATION_ENTHALPY),
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
      }}
    />
  )
}
