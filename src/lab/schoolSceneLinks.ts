import { getSchoolReaction, primaryReactionForCompound } from '../chemistry/schoolReactionBank'
import { isBankReactionReactorReady, reactorHrefForBank, reactorHrefForEquation, resolveReactorEquation, type ReactorLinkSpec } from './reactorDeepLink'
import { scientificSceneFor } from './scientificSynthesis/sceneSignatures'

/**
 * Карточка вещества → лаборатория со ШКОЛЬНОЙ СЦЕНОЙ его образования.
 *
 * Для первых 10 веществ каталога 7 класса реакция карточки — реакция школьной сцены из научной
 * спецификации (src/lab/cinema/scenes/school/specs/<id>.ts, поле reaction): по id банка, а если
 * в банке её нет — по записи уравнения (reactorHrefForEquation). Таблица повторяет спецификации
 * без их импорта (тексты спецификаций тяжёлые — каталогу не нужны); совпадение проверяет
 * scripts/test-g7-first10-links.mts. Для остальных веществ — предпочтительная реакция банка.
 *
 * Модуль без React и three: его читают CompoundDetailModal и тест.
 */

export type SchoolSceneReaction = {
  /** id реакции банка (balanceLessonBank / schoolReactions) или null — ссылка по записи уравнения. */
  readonly bankId: string | null
  /** Уравнение сцены (как reaction.equation спецификации). */
  readonly equation: string
  /** Главный продукт в правой части (у N₂O₅ + H₂O → 2HNO₃ это HNO₃). */
  readonly main: string
}

/** Реакции школьных сцен первых 10 веществ 7 класса (порядок каталога — SCHOOL_SPEC_IDS). */
export const G7_FIRST10_SCENE_REACTIONS: Readonly<Record<string, SchoolSceneReaction>> = {
  h2o: { bankId: 'h2-o2-h2o', equation: '2H₂ + O₂ → 2H₂O', main: 'h2o' },
  co2: { bankId: 'c-o2-co2', equation: 'C + O₂ → CO₂', main: 'co2' },
  nacl: { bankId: 'na-cl-nacl', equation: '2Na + Cl₂ → 2NaCl', main: 'nacl' },
  co: { bankId: 'c-o2-co', equation: '2C + O₂ → 2CO', main: 'co' },
  so2: { bankId: 's-o2-so2', equation: 'S + O₂ → SO₂', main: 'so2' },
  so3: { bankId: 'so2-o2-so3', equation: '2SO₂ + O₂ ⇄ 2SO₃', main: 'so3' },
  no: { bankId: 'n2-o2-no', equation: 'N₂ + O₂ → 2NO', main: 'no' },
  no2: { bankId: 'no-o2-no2', equation: '2NO + O₂ → 2NO₂', main: 'no2' },
  n2o: { bankId: 'nh4no3-n2o', equation: 'NH₄NO₃ → N₂O + 2H₂O', main: 'n2o' },
  // N₂O₅ в сцене — реагент (кислотный оксид + вода); продукт реакции — HNO₃.
  n2o5: { bankId: 'n2o5-h2o-hno3', equation: 'N₂O₅ + H₂O → 2HNO₃', main: 'hno3' },
}

/**
 * Вещества со школьной сценой «обмен в растворе» (scenes/school/solution): карточка ведёт на реакцию сцены,
 * а не на предпочтительную реакцию банка (для BaSO₄ это была бы нейтрализация Ba(OH)₂ + H₂SO₄ без сцены).
 * Совпадение со спецификацией (specs/baso4.ts) проверяет scripts/test-solution-scene.mts.
 */
export const SOLUTION_SCENE_REACTIONS: Readonly<Record<string, SchoolSceneReaction>> = {
  salt_ba_so4: { bankId: 'bacl2-h2so4', equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl', main: 'salt_ba_so4' },
}

export type SchoolSceneLink = {
  /** id реакции банка (для «Открыть в реакциях»), null — только ссылка по уравнению. */
  readonly bankId: string | null
  /** Уравнение для карточки (Unicode). */
  readonly equationRu: string
  readonly equationEn: string
  /** Путь роутера в лабораторию (<Link to>). */
  readonly href: string
  /** Для реакции есть научная/школьная сцена — кнопка зовёт смотреть анимацию. */
  readonly hasScene: boolean
}

/** Реакция откроется в реакторе, синтез запустится и для неё есть сцена (продукт + реагенты). */
export function reactorLinkHasScene(spec: ReactorLinkSpec): boolean {
  const r = resolveReactorEquation(spec)
  return r.ok && r.stageOnly == null && scientificSceneFor(r.productCompoundId, r.leftTerms) !== null
}

const cache = new Map<string, SchoolSceneLink | null>()

/** Школьная реакция карточки вещества и ссылка в лабораторию (null — реакции нет или реактор её не собирает). */
export function schoolSceneLinkForCompound(compoundId: string): SchoolSceneLink | null {
  const hit = cache.get(compoundId)
  if (hit !== undefined) return hit
  let out: SchoolSceneLink | null = null
  const g7 = G7_FIRST10_SCENE_REACTIONS[compoundId] ?? SOLUTION_SCENE_REACTIONS[compoundId]
  if (g7) {
    const spec: ReactorLinkSpec = g7.bankId ? { reactionId: g7.bankId, main: g7.main } : { equation: g7.equation, main: g7.main }
    const bank = g7.bankId ? getSchoolReaction(g7.bankId) : undefined
    if (resolveReactorEquation(spec).ok) {
      out = {
        bankId: bank?.id ?? null,
        equationRu: bank?.equationRu ?? g7.equation,
        equationEn: bank?.equationEn ?? g7.equation,
        href: g7.bankId ? reactorHrefForBank(g7.bankId, { main: g7.main }) : reactorHrefForEquation(g7.equation, { main: g7.main }),
        hasScene: reactorLinkHasScene(spec),
      }
    }
  } else {
    const rx = primaryReactionForCompound(compoundId)
    if (rx && isBankReactionReactorReady(rx.id)) {
      // Как раньше в карточке: главный — само вещество (реакции, где оно продукт).
      const main = compoundId
      out = {
        bankId: rx.id,
        equationRu: rx.equationRu,
        equationEn: rx.equationEn,
        href: reactorHrefForBank(rx.id, { main }),
        hasScene: reactorLinkHasScene({ reactionId: rx.id, main }),
      }
    }
  }
  cache.set(compoundId, out)
  return out
}
