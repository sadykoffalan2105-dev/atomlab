// Уравнения, выписанные из учебника вручную (src/data/textbook/curated/gN.json) → src/data/textbook/equations-gN.json.
// Для классов с курируемым файлом автоматическая выборка build-book-reader.mts полностью заменяется.
// Запуск: npx tsx scripts/textbook-inventory/build-curated-equations.mts [7 8 …]
import fs from 'node:fs'
import path from 'node:path'
import { readerUnitHref } from '../../src/data/textbook/bookReader'
import { reactorHrefForBank, reactorHrefForEquation, resolveReactorEquation } from '../../src/lab/reactorDeepLink'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank'
import { exampleDisplay, exampleLab, resolveExample } from './scheme-example.mts'

/** Почему пример не открылся: код реактора и вещества, которых в нём нет. */
function describeExample(example: string): string {
  const { res } = resolveExample(example)
  if (res.ok) return 'ok'
  const formulas = (res.details as { formulas?: string[] }).formulas
  return `${res.code}${formulas?.length ? `: ${formulas.join(', ')}` : ''}`
}

// Банк школьных реакций: если уравнение совпадает, ссылка идёт через id банка (у него есть условия и кино-анимации).
const norm = (s: string) => s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/[↑↓\s]/g, '').replace(/<->|<=>|→|=|⇄|⇌/g, '->')
const bankByEq = new Map(SCHOOL_REACTION_BANK.map((r) => [norm(r.equationRu), r.id]))
/** Те же члены уравнения в любом порядке: «a + b → c + d» → отсортированные части. */
const canonEq = (s: string) =>
  norm(s)
    .split('->')
    .map((side) => side.split('+').sort().join('+'))
    .join('->')
/** Явная привязка к банку: только если уравнение банка — та же реакция (иначе генератор падает). */
function bankMatches(r: { eq: string; bankId?: string }): string | null {
  if (!r.bankId) return null
  const bank = SCHOOL_REACTION_BANK.find((x) => x.id === r.bankId)
  if (!bank || canonEq(bank.equationRu) !== canonEq(unicode(r.eq))) throw new Error(`curated: bankId «${r.bankId}» не совпадает с «${r.eq}»`)
  return bank.id
}

/**
 * labExample — формула с «n» (полимер, олеум, ржавчина) открывается в реакторе по конкретному примеру учебника
 * (scheme-example.mts); note — пояснение карточки («пример: …»).
 */
type Curated = {
  page: number
  unit?: string
  eq: string
  type?: string
  cond?: string | null
  book?: string
  exercise?: boolean
  ionic?: boolean
  labExample?: string
  note?: string
  /**
   * Реакция банка, если запись учебника та же реакция, но в другом порядке веществ (8 кл. с. 139:
   * «H₂SO₄ + BaCl₂» = банк bacl2-h2so4 «BaCl₂ + H₂SO₄»): уравнения сверяются по составу (bankMatches).
   */
  bankId?: string
}
type Unit = { unitId: string; pageStart: number | null; pageEnd: number | null; reactions: unknown[] }
type GradeFile = { grade: number; gradeId: string; generatedAt: string; units: Unit[] }

const DIR = path.resolve('src/data/textbook')
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const unicode = (s: string) =>
  s
    .replace(/<->/g, '⇄')
    .replace(/->/g, '→')
    .replace(/\*/g, '·')
    .replace(/(?<=[A-Za-z\])])(\d+)/g, (d) => d.replace(/\d/g, (x) => SUBS[Number(x)]!))
    .replace(/\s+/g, ' ')
    .trim()

const grades = process.argv.slice(2).map(Number).filter(Boolean)
const files = (grades.length ? grades : [7, 8, 9, 10, 11]).filter((g) => fs.existsSync(path.join(DIR, 'curated', `g${g}.json`)))

for (const g of files) {
  const curated = JSON.parse(fs.readFileSync(path.join(DIR, 'curated', `g${g}.json`), 'utf8')) as { reactions: Curated[] }
  const out = JSON.parse(fs.readFileSync(path.join(DIR, `equations-g${g}.json`), 'utf8')) as GradeFile
  const gradeId = `g${g}`
  const byUnit = new Map<string, Curated[]>()
  const orphans: number[] = []
  for (const r of curated.reactions) {
    const unit = r.unit
      ? out.units.find((u) => u.unitId === r.unit)
      : out.units.find((u) => u.pageStart != null && u.pageEnd != null && r.page >= u.pageStart && r.page <= u.pageEnd)
    if (!unit) {
      orphans.push(r.page)
      continue
    }
    const arr = byUnit.get(unit.unitId) ?? []
    arr.push(r)
    byUnit.set(unit.unitId, arr)
  }
  let total = 0
  let ok = 0
  const fails: string[] = []
  for (const u of out.units) {
    const list = byUnit.get(u.unitId) ?? []
    u.reactions = list.map((r, i) => {
      const id = `r${i + 1}`
      const src = readerUnitHref(gradeId, u.unitId, { rx: id, page: u.pageStart })
      const bankId = r.ionic ? null : (bankMatches(r) ?? bankByEq.get(norm(r.eq)) ?? null)
      const bankRes = bankId ? resolveReactorEquation({ reactionId: bankId }) : null
      // Ионные уравнения и полуреакции тоже открываются — ионы и e⁻ стали частицами реактора.
      const res = bankRes?.ok ? bankRes : resolveReactorEquation({ equation: r.eq })
      // только формула с «n» (полимер, олеум, ржавчина) — по примеру учебника
      const byExample = !res.ok && res.code === 'generalFormula' ? exampleLab(r.labExample, src) : null
      const lab = res.ok
        ? { ok: true as const, href: bankRes?.ok && bankId ? reactorHrefForBank(bankId, { src }) : reactorHrefForEquation(r.eq, { src }) }
        : (byExample ?? { ok: false as const, reason: res.code, ...(r.labExample ? { example: exampleDisplay(r.labExample) } : {}) })
      total++
      if (lab.ok) ok++
      else fails.push(`${u.unitId}/${id} ${r.eq} → ${res.ok ? '?' : res.code}${r.labExample ? ` (пример ${r.labExample} → ${describeExample(r.labExample)})` : ''}`)
      return {
        id,
        page: r.page,
        equation: unicode(r.eq),
        equationAscii: r.eq,
        ...(r.book ? { asInBook: unicode(r.book) } : {}),
        ...(r.exercise ? { exercise: true } : {}),
        conditions: r.cond ?? null,
        type: r.type ?? 'other',
        isIonic: r.ionic === true,
        isGeneralScheme: false,
        bankId: bankRes?.ok ? bankId : null,
        lab,
        ...(r.note ? { note: r.note } : {}),
      }
    })
  }
  out.generatedAt = new Date().toISOString()
  fs.writeFileSync(path.join(DIR, `equations-g${g}.json`), JSON.stringify(out) + '\n')
  console.log(`g${g}: curated ${total} reactions in ${byUnit.size} units, lab ok ${ok}${orphans.length ? `, pages without unit: ${orphans.join(',')}` : ''}`)
  if (fails.length) console.log(fails.join('\n'))
}
