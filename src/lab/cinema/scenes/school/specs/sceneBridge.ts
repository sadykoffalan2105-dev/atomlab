import type { BondKey } from '../../../../../chemistry/data'
import { lessonText, pairOrigins, stepTimings, textbookOf } from './adapter'
import type { BondSpec, ParticleSpec, SchoolScienceSpec } from './types'

/**
 * Сборка школьной сцены (SchoolSceneSpec движка) из научной спецификации: тексты, шаги, учебник и
 * связи берутся ТОЛЬКО из неё, сцена задаёт лишь постановку кадра (координаты, place, split).
 * Формы результатов повторяют типы движка структурно (как adapter.ts), поэтому модуль не зависит
 * от движка — его читают спецификации сцен (scenes/co2, co, so2, so3 …) и тест.
 */

/** Тексты урока на трёх языках (SchoolSceneSpec.text). */
export function sceneTexts(spec: SchoolScienceSpec) {
  return { ru: lessonText(spec, 'ru'), en: lessonText(spec, 'en'), uz: lessonText(spec, 'uz') }
}

/** Разметка шагов и учебник (SchoolSceneSpec.steps / textbook). */
export function sceneTiming(spec: SchoolScienceSpec) {
  return { steps: stepTimings(spec), textbook: textbookOf(spec) }
}

/** Частица спецификации по id (ошибка — сразу, при загрузке модуля). */
export function particleOf(spec: SchoolScienceSpec, id: string): ParticleSpec {
  const p = spec.particles.find((x) => x.id === id)
  if (!p) throw new Error(`school specs: у «${spec.id}» нет частицы «${id}»`)
  return p
}

/**
 * Связь частицы → связь сцены: атомы переименованы по карте ids (id частицы → id атома сцены),
 * пары — pairOrigins (донорно-акцепторная пара — последней), длина — ключ ядра bondData.
 */
export function sceneBond(p: ParticleSpec, a: string, b: string, ids: Readonly<Record<string, string>>): { a: string; b: string; pairs: ('ab' | 'a' | 'b')[]; bondKey: BondKey } {
  const bond: BondSpec | undefined = p.bonds.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
  if (!bond) throw new Error(`school specs: в «${p.id}» нет связи ${a}–${b}`)
  if (!('bond' in bond.length)) throw new Error(`school specs: связь ${a}–${b} частицы «${p.id}» — не ключ bondData`)
  const map = (x: string) => ids[x] ?? x
  return { a: map(bond.a), b: map(bond.b), pairs: pairOrigins(bond), bondKey: bond.length.bond }
}

/** Неподелённые пары / неспаренные электроны частицы с переименованием атомов. */
export function sceneCounts(counts: Readonly<Record<string, number>>, ids: Readonly<Record<string, string>>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) if (v) out[ids[k] ?? k] = v
  return out
}
