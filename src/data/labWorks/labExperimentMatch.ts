/**
 * Какой 3D-опыт открыть для уравнения из учебника (кнопка «3D-опыт →» у реакций § 2.12).
 * Сравнение — по нормализованному уравнению: те же вещества с теми же коэффициентами, «+ Q», «↑», «↓» не важны.
 */
import { parseEquationText } from '../../chemistry/equationFormula'
import type { LabExperimentId } from '../../components/lab3d/labContract'

/** Уравнение → опыт (опыты § 2.12, получение аммиака и вытеснение галогенов; § 5.2 открывается из списка на доске). */
const CHIP_EQUATIONS: ReadonlyArray<{ id: LabExperimentId; equation: string }> = [
  { id: 'baso4', equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl' },
  { id: 'ch4-burn', equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O + Q' },
  { id: 'zn-hcl', equation: 'Zn + 2HCl → ZnCl₂ + H₂↑' },
  { id: 'nh3', equation: '2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O' },
  { id: 'halogens', equation: 'Cl₂ + 2NaBr → 2NaCl + Br₂' },
  { id: 'halogens', equation: 'Cl₂ + 2KBr → 2KCl + Br₂' },
  { id: 'halogens', equation: 'Cl₂ + 2NaI → 2NaCl + I₂' },
  { id: 'halogens', equation: 'Cl₂ + 2KI → 2KCl + I₂' },
  { id: 'halogens', equation: 'Br₂ + 2NaI → 2NaBr + I₂' },
  { id: 'halogens', equation: 'Br₂ + 2KI → 2KBr + I₂' },
]

/** Убрать тепловой эффект «+ Q» / «– Q» / «+ 890 кДж» — его нет в составе веществ. */
export function stripHeatTerm(text: string): string {
  return text
    .replace(/\s*[+\-−–]\s*(?:\d[\d\s.,]*\s*(?:кДж|kJ)|Q)\s*$/i, '')
    .replace(/\s*[+\-−–]\s*Q\s*(?=[→=⇌])/g, ' ')
    .trim()
}

/** Ключ уравнения: «BaCl2 + H2SO4 = BaSO4 + 2HCl» с отсортированными членами; null — не уравнение. */
export function equationMatchKey(text: string): string | null {
  const parsed = parseEquationText(stripHeatTerm(text))
  if (!parsed || parsed.isScheme || parsed.isIonic) return null
  const side = (list: typeof parsed.reactants) =>
    list
      .map((s) => `${s.coeff === 1 ? '' : s.coeff}${s.formula}`)
      .sort()
      .join(' + ')
  return `${side(parsed.reactants)} = ${side(parsed.products)}`
}

let chipKeys: ReadonlyArray<{ id: LabExperimentId; key: string }> | null = null

/** Опыт новой 3D-лаборатории для уравнения учебника или null. */
export function findLabExperimentForEquation(equation: string | null | undefined): LabExperimentId | null {
  if (!equation) return null
  const key = equationMatchKey(equation)
  if (!key) return null
  chipKeys ??= CHIP_EQUATIONS.flatMap(({ id, equation: eq }) => {
    const k = equationMatchKey(eq)
    return k ? [{ id, key: k }] : []
  })
  return chipKeys.find((c) => c.key === key)?.id ?? null
}

/** Ссылка на опыт (HashRouter: #/vr-lab?exp=<id>). */
export function labExperimentHref(id: LabExperimentId): string {
  return `/vr-lab?exp=${encodeURIComponent(id)}`
}
