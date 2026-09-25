/**
 * Уравнения учебника (Kimyo 7–11) по параграфам — данные боковой панели PDF-читалки.
 *
 * Файлы equations-gN.json собирает `npm run book:reader`
 * (scripts/textbook-inventory/build-book-reader.mts) из инвентаря учебника
 * и резолвера ссылок в лабораторию (src/lab/reactorDeepLink.ts).
 *
 * Каждый класс грузится через dynamic import() — отдельный чанк, в стартовый бандл не попадает.
 *
 *   const grade = await loadReaderGrade('g8')
 *   const unitId = bookUnitIdForAppSection(grade, 'c1', 's01')
 */

/**
 * Можно ли открыть реакцию в лаборатории.
 * reason — код отказа resolveReactorEquation (scheme | generalFormula | unknownSubstance | organic |
 * noCompoundProduct | tooManyTerms | unbalanced; ionic — только в старых данных: ионы теперь частицы реактора);
 * altHref — запасная ссылка (например, органическая лаборатория).
 */
export type ReaderLab = { ok: true; href: string } | { ok: false; reason: string; altHref?: string }

/**
 * Реакция параграфа. id — «r1», «r2»… (уникален в юните, для ?rx=). lab.href — путь роутера
 * «/?reactor=1&reaction=…|eq=…&src=<readerUnitHref(…, {rx: id, page})>», лаборатория покажет «назад к учебнику».
 * Для «уравняй сам» добавьте к href «&balance=1».
 */
export type ReaderReaction = {
  id: string
  page: number | null
  equation: string
  equationAscii: string
  /** Как напечатано в задании («KOH + CO₂ → ...»); null — уравнения в книге нет (задача словами). */
  asInBook?: string | null
  /**
   * Задание учебника («Завершите: KOH + CO₂ → …», «Уравняйте», тест, задача словами): equation — это ответ.
   * Карточка показывает asInBook, уравнение и лаборатория — только после «Показать ответ».
   */
  exercise?: boolean
  conditions: string | null
  type: string
  isIonic: boolean
  isGeneralScheme: boolean
  bankId: string | null
  lab: ReaderLab
}

/**
 * Параграф книги.
 * unitId: 7/10/11 — «c1-s01» (как раздел приложения); 8/9 — «p24» по номеру § и «lab» для практических работ.
 * chapterId: 7/10/11 — глава приложения «c1» (совпадает с главой книги); 8/9 — глава книги «ch1»…, «lab»
 * (главы приложения там другие — для них есть appSections и firstUnitIdForChapter).
 */
export type ReaderUnit = {
  unitId: string
  chapterId: string | null
  chapterTitle: string | null
  kp: string | null
  title: string
  pageStart: number | null
  pageEnd: number | null
  appSections: string[]
  reactions: ReaderReaction[]
  labWorks: { title: string; page: number | null }[]
}

export type ReaderGrade = {
  grade: 7 | 8 | 9 | 10 | 11
  gradeId: string
  generatedAt: string
  units: ReaderUnit[]
}

export type ReaderGradeId = 'g7' | 'g8' | 'g9' | 'g10' | 'g11'

export const READER_GRADE_IDS: readonly ReaderGradeId[] = ['g7', 'g8', 'g9', 'g10', 'g11']

export function isReaderGradeId(id: string | null | undefined): id is ReaderGradeId {
  return id != null && (READER_GRADE_IDS as readonly string[]).includes(id)
}

type JsonModule = { default: unknown }

const IMPORTERS: Record<ReaderGradeId, () => Promise<JsonModule>> = {
  g7: () => import('./equations-g7.json'),
  g8: () => import('./equations-g8.json'),
  g9: () => import('./equations-g9.json'),
  g10: () => import('./equations-g10.json'),
  g11: () => import('./equations-g11.json'),
}

const cache = new Map<ReaderGradeId, Promise<ReaderGrade>>()

/** Данные учебника класса (кэш промиса; при ошибке загрузки кэш сбрасывается для повтора). */
export function loadReaderGrade(gradeId: ReaderGradeId): Promise<ReaderGrade> {
  let p = cache.get(gradeId)
  if (!p) {
    p = IMPORTERS[gradeId]()
      .then((mod) => mod.default as ReaderGrade)
      .catch((err: unknown) => {
        cache.delete(gradeId)
        throw err
      })
    cache.set(gradeId, p)
  }
  return p
}

/**
 * Путь роутера к параграфу в PDF-читалке: «/learn/g/g8/book?page=57&unit=p24&rx=r2» (без «#»).
 * Это же значение уходит в лабораторию как src= (кнопка «назад к учебнику»).
 */
export function readerUnitHref(gradeId: string, unitId: string, opts?: { rx?: string; page?: number | null }): string {
  const q = new URLSearchParams()
  if (opts?.page != null && Number.isFinite(opts.page)) q.set('page', String(opts.page))
  q.set('unit', unitId)
  if (opts?.rx) q.set('rx', opts.rx)
  return `/learn/g/${encodeURIComponent(gradeId)}/book?${q.toString()}`
}

/**
 * Параграф учебника для раздела приложения (chapterId «c1», sectionId «s01»).
 * unit.appSections содержит «c1-s01». Если разделу соответствуют несколько параграфов — первый.
 */
export function bookUnitIdForAppSection(grade: ReaderGrade, chapterId: string, sectionId: string): string | null {
  const key = `${chapterId}-${sectionId}`
  const hit = grade.units.find((u) => u.unitId === key) ?? grade.units.find((u) => u.appSections.includes(key))
  return hit?.unitId ?? null
}

/**
 * Первый параграф главы: по chapterId юнита («c1» для 7/10/11, «ch1» для 8/9), иначе (главы приложения 8–9 классов)
 * параграф самого раннего раздела главы «c5-s01», «c5-s02»… — а не первый по книге: в 8 классе глава c5
 * «Химические реакции» начинается с § 33, хотя § 1 тоже относится к её разделу s02.
 */
export function firstUnitIdForChapter(grade: ReaderGrade, chapterId: string): string | null {
  const byChapter = grade.units.find((u) => u.chapterId === chapterId)
  if (byChapter) return byChapter.unitId
  const prefix = `${chapterId}-s`
  let best: { n: number; unitId: string } | null = null
  for (const u of grade.units) {
    for (const s of u.appSections) {
      if (!s.startsWith(prefix)) continue
      const n = Number(s.slice(prefix.length))
      if (Number.isFinite(n) && (!best || n < best.n)) best = { n, unitId: u.unitId }
    }
  }
  return best?.unitId ?? null
}

/**
 * Все параграфы главы приложения (chapterId «c1» / «c5»): по chapterId юнита либо (8–9 классы) по appSections
 * «c5-sNN», в порядке разделов главы.
 */
export function unitsForAppChapter(grade: ReaderGrade, chapterId: string): ReaderUnit[] {
  const byChapter = grade.units.filter((u) => u.chapterId === chapterId)
  if (byChapter.length) return byChapter
  const prefix = `${chapterId}-s`
  const scored: { n: number; u: ReaderUnit }[] = []
  for (const u of grade.units) {
    let n = Infinity
    for (const s of u.appSections) {
      if (!s.startsWith(prefix)) continue
      const k = Number(s.slice(prefix.length))
      if (Number.isFinite(k) && k < n) n = k
    }
    if (n !== Infinity) scored.push({ n, u })
  }
  return scored.sort((a, b) => a.n - b.n || a.u.unitId.localeCompare(b.u.unitId)).map((x) => x.u)
}

/** Юнит по id (или null). */
export function readerUnitById(grade: ReaderGrade, unitId: string): ReaderUnit | null {
  return grade.units.find((u) => u.unitId === unitId) ?? null
}
