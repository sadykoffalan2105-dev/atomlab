// Уравнения, выписанные из учебника вручную (src/data/textbook/curated/gN.json) → src/data/textbook/equations-gN.json.
// Для классов с курируемым файлом автоматическая выборка build-book-reader.mts полностью заменяется.
// Запуск: npx tsx scripts/textbook-inventory/build-curated-equations.mts [7 8 …]
import fs from 'node:fs'
import path from 'node:path'
import { readerUnitHref } from '../../src/data/textbook/bookReader'
import { reactorHrefForBank, reactorHrefForEquation, resolveReactorEquation } from '../../src/lab/reactorDeepLink'
import { SCHOOL_REACTION_BANK } from '../../src/chemistry/schoolReactionBank'

// Банк школьных реакций: если уравнение совпадает, ссылка идёт через id банка (у него есть условия и кино-анимации).
const norm = (s: string) => s.replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080)).replace(/[↑↓s]/g, '').replace(/→|=|⇄|⇌/g, '->')
const bankByEq = new Map(SCHOOL_REACTION_BANK.map((r) => [norm(r.equationRu), r.id]))

type Curated = { page: number; eq: string; type?: string; cond?: string | null; book?: string; exercise?: boolean }
type Unit = { unitId: string; pageStart: number | null; pageEnd: number | null; reactions: unknown[] }
type GradeFile = { grade: number; gradeId: string; generatedAt: string; units: Unit[] }

const DIR = path.resolve('src/data/textbook')
const SUBS = '₀₁₂₃₄₅₆₇₈₉'
const unicode = (s: string) =>
  s
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
    const unit = out.units.find((u) => u.pageStart != null && u.pageEnd != null && r.page >= u.pageStart && r.page <= u.pageEnd)
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
      const bankId = bankByEq.get(norm(r.eq)) ?? null
      const bankRes = bankId ? resolveReactorEquation({ reactionId: bankId }) : null
      const res = bankRes?.ok ? bankRes : resolveReactorEquation({ equation: r.eq })
      const lab = res.ok
        ? { ok: true as const, href: bankRes?.ok && bankId ? reactorHrefForBank(bankId, { src }) : reactorHrefForEquation(r.eq, { src }) }
        : { ok: false as const, reason: res.code }
      total++
      if (lab.ok) ok++
      else fails.push(`${u.unitId}/${id} ${r.eq} → ${res.code}`)
      return {
        id,
        page: r.page,
        equation: unicode(r.eq),
        equationAscii: r.eq,
        ...(r.book ? { asInBook: unicode(r.book) } : {}),
        ...(r.exercise ? { exercise: true } : {}),
        conditions: r.cond ?? null,
        type: r.type ?? 'other',
        isIonic: false,
        isGeneralScheme: false,
        bankId: bankRes?.ok ? bankId : null,
        lab,
      }
    })
  }
  out.generatedAt = new Date().toISOString()
  fs.writeFileSync(path.join(DIR, `equations-g${g}.json`), JSON.stringify(out) + '\n')
  console.log(`g${g}: curated ${total} reactions in ${byUnit.size} units, lab ok ${ok}${orphans.length ? `, pages without unit: ${orphans.join(',')}` : ''}`)
  if (fails.length) console.log(fails.join('\n'))
}
