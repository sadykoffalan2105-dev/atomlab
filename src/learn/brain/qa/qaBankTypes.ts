/**
 * Формат базы фактов учителя (src/data/teacher/qaBank.json).
 * Собирается скриптом scripts/teacher-ml/build-qa-bank.mts из данных проекта — ничего не придумано.
 * Ключи короткие, чтобы JSON был компактным.
 */

export interface QaSubstance {
  id: string
  /** Название RU (из каталога), EN/UZ — из глоссария базы знаний, если есть. */
  ru: string
  en?: string
  uz?: string
  /** Формула с Unicode-индексами и в ASCII (H₂SO₄ / H2SO4). */
  f: string
  fa: string
  /** Класс каталога: oxide | acid | base | salt | other. */
  cls: string
  /** Класс по семействам 200 веществ: simple | oxide | base | acid | salt | binary. */
  cl2?: string
  fam?: { id: string; ru: string; en: string; uz: string; root?: string }
  /** Молярная масса, г/моль — посчитана из ELEMENTS. */
  M: number
  comp: Record<string, number>
  /** Классы школы, где изучается (по сверке учебников). */
  g: number[]
  /** Тема учебника (вода, оксиды, кислоты …). */
  ch?: string
  /** Первая страница учебника, где встречается. */
  pg?: number
  /** Описание / применение / откуда берут / получение — из каталога (compoundFacts). */
  d?: string
  use?: string
  src?: string
  rec?: string
}

export interface QaElement {
  z: number
  s: string
  ru: string
  en: string
  uz: string
  /** Относительная атомная масса. */
  A: number
  per: number | null
  grp: number | null
  /** Блок таблицы: Nonmetal, Alkali metal, Transition metal … */
  blk: string
  /** Степени окисления, как в данных («-2, -1, +1, +2»). */
  ox?: string
  cfg?: string
  /** Агрегатное состояние (Gas / Liquid / Solid). */
  st?: string
  /** Электроотрицательность. */
  en_?: number
}

export interface QaReaction {
  id: string
  /** Уравнение (Unicode). */
  eq: string
  /** Тип: combination | decomposition | substitution | exchange | neutralization | combustion | redox … */
  t?: string
  /** Условия, как записаны в источнике. */
  c?: string
  /** Классы, где встречается. */
  g: number[]
  /** § учебника (kp) первого источника, unitId, страница, заголовок параграфа. */
  kp?: string
  u?: string
  pg?: number
  ttl?: string
  /** Реагенты и продукты (ASCII, без коэффициентов). */
  r: string[]
  p: string[]
  /** ОВР (по расчёту степеней окисления в mainReactions200). */
  rx?: boolean
  /** id из 200 основных реакций. */
  mr?: string
  /** Короткое название / заметка. */
  n?: string
  lab?: { heat?: true; pressure?: true; catalyst?: string }
  /** Класс первого источника (для mr-реакций без kp). */
  bg?: number
  org?: true
}

export interface QaTerm {
  ru: string
  en: string[]
  uz: string[]
  f?: string[]
  /** core | element | compound | organic | class */
  src: string
}

export interface QaDefinition {
  term: string
  def: string
  g: number
  kp: string
  pg: number
}

export interface QaSection {
  g: number
  id?: string
  kp: string
  title: string
  pg: number
}

export interface QaBank {
  v: 1
  builtAt: string
  substances: QaSubstance[]
  elements: QaElement[]
  reactions: QaReaction[]
  terms: QaTerm[]
  definitions: QaDefinition[]
  sections: QaSection[]
}
