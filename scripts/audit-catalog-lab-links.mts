/**
 * Аудит «Этапы получения → лаборатория» для 200 веществ каталога.
 * У каждого вещества — способы получения из карточки (obtainingStepsRu или единственный рецепт); для каждого способа:
 *  A не уравнение (схема «оксид / гидроксид + кислота», текст, «не …», «… + …»);
 *  B уравнение не уравнено;
 *  C реактор не открывает (неизвестное вещество, ионы, слишком много членов …);
 *  D открывается только «шарами» (синтез не запускается);
 *  E сюжет реакции buildReactionStory не строится (нет анимации в лаборатории);
 * для вещества:
 *  F путь «Как образуется» (formationScript(id).route) не среди способов карточки (кроме пути «атомы → молекула»);
 *  G путь не из простых веществ, а первый способ карточки — другой;
 *  H карточка пишет «не реагирует / не проводят / не получают» про путь «Как образуется»;
 *  I ни один способ не открывается в лаборатории с анимацией;
 *  J formationEquation (direct для пути из простых веществ, lab — иначе) ≠ путь таблицы правил.
 * Запуск: npx tsx scripts/audit-catalog-lab-links.mts [--list] [--json <файл>]
 * Код выхода 1 — есть проблемы A–I.
 */
import fs from 'node:fs'
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationScript } from '../src/chemistry/formationScripts'
import { formationEquation } from '../src/chemistry/formationEquation'
import { parseEquationText, equationImbalance } from '../src/chemistry/equationFormula'
import { resolveReactorEquation } from '../src/lab/reactorDeepLink'
import {
  cleanObtainingEquation,
  equationKey,
  isNegativeStepText,
  obtainingMethodsOf,
  obtainingStepLabLink,
} from '../src/lab/obtainingLabLinks'

type Cat = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
const CATS: Record<Cat, string> = {
  A: 'способ — не уравнение (схема / текст / «не …»)',
  B: 'уравнение не уравнено',
  C: 'реактор не открывает',
  D: 'только «шарами» (без синтеза)',
  E: 'нет сюжета-анимации (buildReactionStory)',
  F: 'путь «Как образуется» не среди способов карточки',
  G: 'путь не из простых веществ ≠ первый способ карточки',
  H: 'карточка пишет «не реагирует / не проводят» про путь',
  I: 'ни один способ не открывается с анимацией',
  J: 'formationEquation (direct / lab) ≠ путь таблицы правил',
}

/**
 * Известные исключения (не ошибка данных): фтор получают только электролизом, а реактор показывает реакции,
 * где все продукты — простые вещества (2HF → H₂ + F₂), «шарами» без синтеза.
 */
const KNOWN: Partial<Record<Cat, readonly string[]>> = { D: ['tb_f2'], I: ['tb_f2'] }

const list = process.argv.includes('--list')
const jsonAt = process.argv.indexOf('--json')
const jsonPath = jsonAt > 0 ? process.argv[jsonAt + 1] : null

const problems: Record<Cat, string[]> = { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [], I: [], J: [] }
let methodsTotal = 0
let methodsOpen = 0
let methodsAnimated = 0
const byKind: Record<string, number> = { mr: 0, bank: 0, eq: 0 }
const rows: unknown[] = []

for (const id of CATALOG_TOP200_IDS) {
  const c = compoundById[id]
  if (!c) {
    problems.I.push(`${id}: нет в данных`)
    continue
  }
  const methods = obtainingMethodsOf(id)
  let anyAnimated = false
  const keys: string[] = []
  /** ключ первого способа, где вещество карточки стоит справа (основной способ; в цепочке S → SO₂ → SO₃ → H₂SO₄ — последний шаг) */
  let firstOwnKey: string | null = null
  const ownComp = parseEquationText(`X → ${c.formulaUnicode}`)?.products[0]?.counts
  const ownKey = ownComp ? JSON.stringify(Object.entries(ownComp).sort()) : ''
  const mrows: unknown[] = []
  for (const m of methods) {
    methodsTotal++
    const tag = `${id} ${c.formulaUnicode}: ${m.equation}`
    const eq = cleanObtainingEquation(m.equation)
    const parsed = isNegativeStepText(m.equation) ? null : parseEquationText(eq)
    if (!parsed || parsed.isScheme || [...parsed.reactants, ...parsed.products].some((s) => !s.counts)) {
      problems.A.push(tag)
      mrows.push({ eq: m.equation, cat: 'A' })
      continue
    }
    const k = equationKey(eq)
    if (k) keys.push(k)
    if (k && firstOwnKey == null && parsed.products.some((p) => p.counts && JSON.stringify(Object.entries(p.counts).sort()) === ownKey)) firstOwnKey = k
    if (equationImbalance(parsed).length > 0) {
      problems.B.push(`${tag}  [${equationImbalance(parsed).join(', ')}]`)
      mrows.push({ eq: m.equation, cat: 'B' })
      continue
    }
    const link = obtainingStepLabLink(id, m.equation)
    if (!link) {
      const r = resolveReactorEquation({ equation: eq })
      problems.C.push(`${tag}  [${r.ok ? '?' : `${r.code} ${JSON.stringify(r.details)}`}]`)
      mrows.push({ eq: m.equation, cat: 'C' })
      continue
    }
    methodsOpen++
    byKind[link.kind]!++
    const r = resolveReactorEquation({ equation: eq })
    if (r.ok && r.stageOnly) {
      problems.D.push(`${tag}  [${r.stageOnly}]`)
      mrows.push({ eq: m.equation, cat: 'D', href: link.href })
      continue
    }
    if (!link.animated) {
      problems.E.push(`${tag}  [${link.kind} ${link.equation}]`)
      mrows.push({ eq: m.equation, cat: 'E', href: link.href })
      continue
    }
    methodsAnimated++
    anyAnimated = true
    mrows.push({ eq: m.equation, href: link.href, kind: link.kind })
  }
  if (!anyAnimated) problems.I.push(`${id} ${c.formulaUnicode}`)

  const fs0 = formationScript(id)
  if (fs0 && fs0.routeKind !== 'atoms') {
    const rk = equationKey(fs0.route)
    if (!rk || !keys.includes(rk)) problems.F.push(`${id} ${c.formulaUnicode}: путь «${fs0.route}»; карточка: ${methods.map((m) => m.equation).join(' | ')}`)
    else if (!fs0.direct && firstOwnKey !== rk) problems.G.push(`${id} ${c.formulaUnicode}: путь «${fs0.route}»; карточка: ${methods.map((m) => m.equation).join(' | ')}`)
    // formationEquation (подпись и сценарий «Как образуется») — тот же путь
    const fe = formationEquation(id)
    const feEq = fs0.direct ? fe?.direct : fe?.lab
    if (!feEq || equationKey(feEq) !== rk || (!fs0.direct && fe?.direct)) problems.J.push(`${id} ${c.formulaUnicode}: таблица «${fs0.route}»; formationEquation direct «${fe?.direct ?? '—'}», lab «${fe?.lab ?? '—'}»`)
    // «не реагирует» про реагент пути
    const notes = methods.map((m) => `${m.equation} ${m.note ?? ''}`).join(' ')
    const routeLeft = parseEquationText(fs0.route)?.reactants.map((s) => s.formula) ?? []
    const neg = /не реагирует|почти не реагирует|не проводят|напрямую не получают|не получают/i
    if (neg.test(notes)) {
      const sym = (f: string) => f.replace(/\d+$/, '')
      const mentioned = routeLeft.some((f) => {
        const u = parseEquationText(`${f} → X`)?.reactants[0]
        if (!u?.counts) return false
        const simple = Object.keys(u.counts).length === 1
        return simple && new RegExp(`(^|[^A-Za-z])${sym(f)}([^a-z]|$)[^.;]*?(не реагирует|не проводят)`).test(notes)
      })
      if (mentioned) problems.H.push(`${id} ${c.formulaUnicode}: путь «${fs0.route}»; карточка: ${notes.trim()}`)
    }
  }
  rows.push({ id, formula: c.formulaUnicode, methods: mrows, route: fs0?.route ?? null })
}

console.log(`Способов получения: ${methodsTotal}; открываются в реакторе: ${methodsOpen}; с анимацией: ${methodsAnimated}`)
console.log(`Ссылки: mr ${byKind.mr}, банк ${byKind.bank}, по уравнению ${byKind.eq}`)
console.log('Категория | проблем | что')
let total = 0
for (const k of Object.keys(CATS) as Cat[]) {
  const known = problems[k].filter((p) => (KNOWN[k] ?? []).includes(p.split(' ')[0]!)).length
  total += problems[k].length - known
  console.log(`${k} | ${problems[k].length}${known ? ` (известных исключений: ${known})` : ''} | ${CATS[k]}`)
}
if (list) {
  for (const k of Object.keys(CATS) as Cat[]) {
    if (!problems[k].length) continue
    console.log(`\n── ${k}: ${CATS[k]}`)
    for (const p of problems[k]) console.log('  ' + p)
  }
}
if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify({ methodsTotal, methodsOpen, methodsAnimated, byKind, problems, rows }, null, 1))
process.exit(total > 0 ? 1 : 0)
