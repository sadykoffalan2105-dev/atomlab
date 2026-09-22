/**
 * Данные карточки героя (без React и CSS — их читает и тест scripts/test-product-hero.mts).
 * ΔH°f берётся из FORMATION_ENTHALPY ядра вместе с агрегатным состоянием ключа.
 */
import { FORMATION_ENTHALPY } from '../../../chemistry/data'
import type { HeroPhase } from '../../../chemistry/data/heroStructures'
import type { MessageKey } from '../../../i18n/messagesRu'
import { localizeLabelText, toSceneLocale } from '../../../lab/cinema/scenes/kit/sceneKit'

const PHASE_TOKEN: Readonly<Record<string, string>> = { тв: '{s}', ж: '{l}', г: '{g}' }
export const HERO_PHASE_KEY: Readonly<Record<HeroPhase, MessageKey>> = {
  solid: 'hero.state.solid',
  liquid: 'hero.state.liquid',
  gas: 'hero.state.gas',
}

/** Число с настоящим минусом и десятичным знаком локали (ru/uz — запятая). */
export function formatHeroNumber(value: number, digits: number, locale: string): string {
  const s = Math.abs(value).toFixed(digits)
  const body = locale === 'en' ? s : s.replace('.', ',')
  return value < 0 ? `−${body}` : body
}

/** Строка ΔH°f для карточки — из FORMATION_ENTHALPY, со состоянием ключа (г./ж./тв.). */
export function heroFormationLine(formationKey: string, locale: string): { text: string; estimated: boolean } | null {
  const d = FORMATION_ENTHALPY[formationKey]
  if (!d) return null
  const sl = toSceneLocale(locale)
  const phase = localizeLabelText(PHASE_TOKEN[d.state] ?? '', sl)
  const unit = localizeLabelText('{kJmol}', sl)
  const sign = d.dHfKJ > 0 ? '+' : ''
  return {
    text: `ΔH°f (${phase}) = ${sign}${formatHeroNumber(d.dHfKJ, 1, locale)} ${unit}`,
    estimated: Boolean(d.estimated),
  }
}
