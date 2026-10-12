/**
 * Карта программы Kimyo 7–11 в памяти мозга: загрузка src/data/kb/curriculum/kimyo-map.json и индексы
 * (по id, классу, секции приложения, теме, стемам понятий/названий, реакциям). Файла нет — loadCurriculumMap() → null,
 * все потребители обязаны работать без карты (прежние подписи цитат, без §-карточки).
 */
import fs from 'node:fs'
import path from 'node:path'
import { analyzeTerms } from '../../src/learn/kb/analyzer.ts'
import type { CurriculumMapFile, GradeKey, TaskType, TaskTypeId, Unit, UnitReaction } from './types.ts'

const DEFAULT_FILE = path.join(path.resolve(import.meta.dirname, '..', '..'), 'src', 'data', 'kb', 'curriculum', 'kimyo-map.json')

/** «2 H2 + O2 -> 2 H2O» → множество формул без коэффициентов */
function speciesOf(side: string): string[] {
  return side
    .split(/\s\+\s/)
    .map((s) => s.trim().replace(/^\d+\s*/, '').replace(/[↑↓]/g, '').trim())
    .filter(Boolean)
}

export class CurriculumMap {
  readonly file: CurriculumMapFile
  readonly units: Unit[] = []
  readonly byId = new Map<string, Unit>()
  readonly byGrade = new Map<number, Unit[]>()
  /** стем → единицы, где он в понятиях/терминах/названии */
  readonly termIndex = new Map<string, Set<string>>()
  private readonly titleStems = new Map<string, Set<string>>()
  private readonly conceptStems = new Map<string, Set<string>>()
  private readonly appIndex = new Map<string, Unit[]>()
  private readonly topicIndex = new Map<string, Unit[]>()
  private readonly reactionIndex: { reaction: UnitReaction; unit: Unit; left: Set<string>; right: Set<string> }[] = []
  readonly taskTypes: TaskType[]
  loadMs = 0

  constructor(file: CurriculumMapFile) {
    const t0 = performance.now()
    this.file = file
    this.taskTypes = file.taskTypes
    for (const gk of Object.keys(file.grades) as GradeKey[]) {
      for (const u of file.grades[gk].units) {
        this.units.push(u)
        this.byId.set(u.id, u)
        const list = this.byGrade.get(u.grade) ?? []
        list.push(u)
        this.byGrade.set(u.grade, list)
        for (const s of u.appSections) {
          const k = `g${u.grade}:${s}`
          this.appIndex.set(k, [...(this.appIndex.get(k) ?? []), u])
        }
        for (const t of u.topics) this.topicIndex.set(t, [...(this.topicIndex.get(t) ?? []), u])
        const ts = new Set(analyzeTerms(u.title.ru))
        const cs = new Set(analyzeTerms([...u.concepts.map((c) => c.ru), ...u.definitions.map((d) => d.term.ru)].join(' ; ')))
        this.titleStems.set(u.id, ts)
        this.conceptStems.set(u.id, cs)
        for (const t of [...ts, ...cs]) {
          const set = this.termIndex.get(t) ?? new Set<string>()
          set.add(u.id)
          this.termIndex.set(t, set)
        }
        for (const r of u.reactions) {
          if (r.isGeneral) continue
          // «<=>» — обратимые реакции («CO2 + H2 <=> CO + H2O»): раньше делились по «=» (12.10)
          const [l, rr] = r.ascii.split(/\s*(?:<=>|->|=|⇄|<->)\s*/)
          if (!l || !rr) continue
          this.reactionIndex.push({ reaction: r, unit: u, left: new Set(speciesOf(l)), right: new Set(speciesOf(rr)) })
        }
      }
    }
    this.loadMs = performance.now() - t0
  }

  get version(): number {
    return this.file.version
  }

  unitFor(grade: number, kp: string): Unit | null {
    return this.byId.get(`g${grade}:${kp}`) ?? null
  }

  byAppSection(gradeId: string, appSection: string): Unit[] {
    return this.appIndex.get(`${gradeId.replace(/^g/, 'g')}:${appSection}`) ?? []
  }

  byTopic(slug: string): Unit[] {
    return this.topicIndex.get(slug) ?? []
  }

  taskTypesOf(unitId: string): TaskTypeId[] {
    return this.byId.get(unitId)?.tasks.types ?? []
  }

  /**
   * Единицы по термам вопроса: score = доля термов вопроса, найденных в единице (терм в названии — 1, в понятиях — 0.6).
   * grade задан — только этот класс. При равенстве: больше термов в названии, затем раньше в книге.
   */
  unitsForQuery(terms: Set<string>, grade: number | null): { unit: Unit; score: number }[] {
    if (!terms.size) return []
    const cand = new Set<string>()
    for (const t of terms) for (const id of this.termIndex.get(t) ?? []) cand.add(id)
    const out: { unit: Unit; score: number; inTitle: number; order: number }[] = []
    for (const id of cand) {
      const u = this.byId.get(id)!
      if (grade != null && u.grade !== grade) continue
      const ts = this.titleStems.get(id)!
      const cs = this.conceptStems.get(id)!
      let s = 0
      let inTitle = 0
      for (const t of terms) {
        if (ts.has(t)) {
          s += 1
          inTitle++
        } else if (cs.has(t)) s += 0.6
      }
      out.push({ unit: u, score: s / terms.size, inTitle, order: this.units.indexOf(u) })
    }
    out.sort((a, b) => b.score - a.score || b.inTitle - a.inTitle || a.order - b.order)
    return out.map(({ unit, score }) => ({ unit, score }))
  }

  /** Реакции карты с этими реагентами (ASCII-формулы; все должны быть слева) и, если задан, этим продуктом. */
  reactionsFor(reactantsAscii: string[], productAscii?: string): { reaction: UnitReaction; unit: Unit }[] {
    const want = reactantsAscii.map((s) => s.trim()).filter(Boolean)
    return this.reactionIndex
      .filter((x) => want.every((r) => x.left.has(r)) && (!productAscii || x.right.has(productAscii.trim())))
      .map(({ reaction, unit }) => ({ reaction, unit }))
  }

  /** Подпись цитаты учебника: «[Kimyo 8, §12, стр. 50]»; нет такой единицы — null. */
  citeFor(grade: number, kp: string, page?: number | null): string | null {
    const u = this.unitFor(grade, kp)
    if (!u) return null
    return page ? `${u.cite.slice(0, -1)}, стр. ${page}]` : u.cite
  }
}

/** Загрузить карту; файла нет или он битый — предупреждение и null. */
export function loadCurriculumMap(file = DEFAULT_FILE): CurriculumMap | null {
  if (!fs.existsSync(file)) {
    console.warn(`[brain] карта программы не найдена (${path.basename(file)}): npm run brain:curriculum-map`)
    return null
  }
  try {
    return new CurriculumMap(JSON.parse(fs.readFileSync(file, 'utf8')) as CurriculumMapFile)
  } catch (err) {
    console.warn('[brain] карта программы не загружена:', (err as Error).message)
    return null
  }
}

// ——— общий экземпляр для чистых функций без доступа к Knowledge (citationOf в retrieve.ts, сборка журнала)
let shared: CurriculumMap | null | undefined
/** Карта, загруженная один раз на процесс (Knowledge.loadRest() кладёт сюда свою). */
export function sharedCurriculum(): CurriculumMap | null {
  if (shared === undefined) shared = loadCurriculumMap()
  return shared
}
export function setSharedCurriculum(m: CurriculumMap | null): void {
  shared = m
}
