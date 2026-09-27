/**
 * Мост научной спецификации к движку школьной сцены (агент A, school/schoolSpec.ts).
 * Типы движка здесь НЕ импортируются (в этой ветке их нет) — формы повторены структурно, чтобы при слиянии
 * результат этих функций подставлялся в SchoolSceneSpec движка без правок:
 *   • pairOrigins      → SchoolBondSpec.pairs ('ab' — обменная пара, 'a' / 'b' — донорно-акцепторная от a / b);
 *   • lessonText       → SchoolSceneSpec.text[locale] (intro, steps по SCHOOL_STEP_IDS, legend, safety);
 *   • stepTimings      → SchoolSceneSpec.steps (сплошное время сюжета из рекомендуемых длительностей);
 *   • textbookOf       → SchoolSceneSpec.textbook;
 *   • geometryOf       → длины и углы частицы, разрешённые в ядро (для построения координат в пм).
 * Координаты атомов, позиции split и place выбирает движок: это постановка кадра, а не химия.
 */
import { resolveAngleDeg, resolveLengthPm } from './core'
import { SCHOOL_STEP_IDS, type BondSpec, type ParticleSpec, type SchoolLocale, type SchoolSceneSpec, type SchoolStepId, type SchoolStepText } from './types'

export type PairOriginLike = 'ab' | 'a' | 'b'

/** Пары связи для движка: сначала обменные ('ab'), донорно-акцепторная — последней. */
export function pairOrigins(b: BondSpec): PairOriginLike[] {
  const out: PairOriginLike[] = []
  const dative = b.dative ? (b.dative.donor === b.a ? 'a' : 'b') : null
  for (let i = 0; i < b.pairs - (dative ? 1 : 0); i++) out.push('ab')
  if (dative) out.push(dative)
  return out
}

export type LessonTextLike = {
  readonly intro: { readonly title: string; readonly speak: string }
  readonly steps: Readonly<Record<SchoolStepId, SchoolStepText>>
  readonly legend: { readonly electron: string; readonly sharedPair: string; readonly lonePair: string; readonly unpaired: string }
  readonly safety: string
}

/** Тексты урока на языке locale в форме SchoolLessonText движка. */
export function lessonText(spec: SchoolSceneSpec, locale: SchoolLocale): LessonTextLike {
  const steps = {} as Record<SchoolStepId, SchoolStepText>
  for (const id of SCHOOL_STEP_IDS) {
    const s = spec.steps.find((x) => x.id === id)
    if (!s) throw new Error(`school specs: у «${spec.id}» нет шага «${id}»`)
    steps[id] = s.text[locale]
  }
  return {
    intro: { title: spec.intro.title[locale], speak: spec.intro.speak[locale] },
    steps,
    legend: {
      electron: spec.legend.electron[locale],
      sharedPair: spec.legend.sharedPair[locale],
      lonePair: spec.legend.lonePair[locale],
      unpaired: spec.legend.unpaired[locale],
    },
    safety: spec.safety[locale],
  }
}

/** Сплошная разметка времени сюжета: to шага = from следующего. */
export function stepTimings(spec: SchoolSceneSpec): { readonly id: SchoolStepId; readonly from: number; readonly to: number }[] {
  let t = 0
  return spec.steps.map((s) => {
    const from = t
    t = Math.round((t + s.seconds) * 1000) / 1000
    return { id: s.id, from, to: t }
  })
}

/** Главная ссылка на учебник: класс, параграф, первая страница. */
export function textbookOf(spec: SchoolSceneSpec): { readonly grade: number; readonly section: string; readonly page: number } {
  const main = spec.reaction.sources[0]!
  return { grade: main.grade, section: main.section, page: main.pages[0]! }
}

/** Длины связей и углы частицы из ядра — для построения координат. */
export function geometryOf(p: ParticleSpec): {
  readonly bonds: readonly { readonly a: string; readonly b: string; readonly pm: number; readonly pairs: PairOriginLike[] }[]
  readonly angles: readonly { readonly a: string; readonly center: string; readonly b: string; readonly deg: number }[]
} {
  return {
    bonds: p.bonds.map((b) => ({ a: b.a, b: b.b, pm: resolveLengthPm(b.length), pairs: pairOrigins(b) })),
    angles: (p.angles ?? []).map((an) => ({ a: an.atoms[0], center: an.atoms[1], b: an.atoms[2], deg: resolveAngleDeg(an.ref) })),
  }
}
