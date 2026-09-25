/**
 * Разбор реакций учебника Kimyo 7 (каталог «Реакции учебника», equations-g7.json) для плана анимаций:
 * повторы, обратные пары, движки анимации, покрытие строения веществ, уравнения из текста учебника вне каталога.
 * Запуск: npx tsx scripts/plan/analyze-g7-reactions.mts  → .smoke/g7-plan/report.json + сводка в консоль.
 */
import fs from 'node:fs'
import { compoundById } from '../../src/data/compounds'
import { REAGENT_GEOMETRY } from '../../src/chemistry/data/bondData'
import { CRYSTAL_IDS, getCrystal } from '../../src/chemistry/data/crystalData'

type Rx = { id: string; page: number | null; equation: string; equationAscii: string; asInBook?: string | null; exercise?: boolean; conditions: string | null; type: string; bankId: string | null; lab: { ok: boolean; reason?: string } }
type Unit = { unitId: string; kp: string; title: string; reactions: Rx[] }
const book = JSON.parse(fs.readFileSync('src/data/textbook/equations-g7.json', 'utf8')) as { units: Unit[] }
const all = book.units.flatMap((u) => u.reactions.map((r) => ({ ...r, unit: u.unitId, kp: u.kp, unitTitle: u.title })))

// ─── формулы ───
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const normF = (s: string) => s.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d))).replace(/[↑↓]/g, '').replace(/\s+/g, '').replace(/·/g, '*')
function elements(f: string): Record<string, number> {
  const out: Record<string, number> = {}
  const parts = f.replace(/^\d+/, '').split('*')
  for (const part0 of parts) {
    const m0 = /^(\d+)(.*)$/.exec(part0)
    const mult0 = m0 ? Number(m0[1]) : 1
    const part = m0 ? m0[2]! : part0
    const stack: Record<string, number>[] = [{}]
    const re = /([A-Z][a-z]?|\(|\)|\[|\])(\d*)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(part))) {
      const [, tok, num] = m
      if (tok === '(' || tok === '[') stack.push({})
      else if (tok === ')' || tok === ']') {
        const top = stack.pop()!
        const k = num ? Number(num) : 1
        for (const [e, c] of Object.entries(top)) stack[stack.length - 1]![e] = (stack[stack.length - 1]![e] ?? 0) + c * k
      } else stack[stack.length - 1]![tok!] = (stack[stack.length - 1]![tok!] ?? 0) + (num ? Number(num) : 1)
    }
    for (const [e, c] of Object.entries(stack[0]!)) out[e] = (out[e] ?? 0) + c * mult0
  }
  return out
}
function side(s: string): { coef: number; f: string }[] {
  return s.split(/\s\+\s|\+(?=[A-Z(\d])/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = /^(\d*)\s*(.+)$/.exec(normF(p))!
    return { coef: m[1] ? Number(m[1]) : 1, f: m[2]! }
  })
}
function parse(eq: string) {
  const a = normF(eq).replace(/<->|⇄|⇌/g, '→').replace(/->|=/g, '→')
  const [l, r] = a.split('→')
  return { L: side(l ?? ''), R: side(r ?? ''), reversible: /⇄|⇌|<->/.test(eq) }
}

const METALS = new Set('Li Na K Rb Cs Be Mg Ca Sr Ba Al Zn Fe Cu Ag Hg Pb Sn Cr Mn Ni Co W Ti Au Pt'.split(' '))
const NONMET_SIMPLE = new Set(['H2', 'O2', 'O3', 'N2', 'Cl2', 'Br2', 'I2', 'F2', 'S', 'P', 'P4', 'C', 'Si'])
const isMetal = (f: string) => METALS.has(f)
const isOrganic = (f: string) => { const e = elements(f); return 'C' in e && 'H' in e && !/CO3|HCO3/.test(f) }
const isOxide = (f: string) => { const e = Object.keys(elements(f)); return e.length === 2 && e.includes('O') && f !== 'H2O' && f !== 'H2O2' }
const isWater = (f: string) => f === 'H2O'
const isAcid = (f: string) => /^H/.test(f) && f !== 'H2O' && f !== 'H2O2' && f !== 'H2' && !isOrganic(f)
const isBase = (f: string) => /\(OH\)|OH$/.test(f) && !isOrganic(f)

function grammar(p: ReturnType<typeof parse>, type: string): string {
  const L = p.L.map((x) => x.f)
  const R = p.R.map((x) => x.f)
  if (L.some(isOrganic) || R.some((f) => isOrganic(f) || /C6H10O5/.test(f))) {
    if (L.includes('O2') && R.includes('CO2')) return 'G01 горение органики'
    return 'G15 органика: прочее'
  }
  if (L.length === 1 && R.length >= 2) {
    const f = L[0]!
    if (f === 'H2O') return 'G08b разложение воды (электролиз)'
    if (/CO3/.test(f)) return 'G08a разложение карбонатов'
    if (isBase(f)) return 'G08c разложение гидроксидов'
    if (R.includes('O2')) return 'G08d разложение с выделением O₂ (KMnO₄, KClO₃, H₂O₂, оксиды)'
    return 'G08e разложение: прочее'
  }
  if (L.length === 2 && L.includes('O2') && R.length === 1) {
    const other = L.find((f) => f !== 'O2')!
    if (isMetal(other)) return 'G02 металл + O₂ → оксид (ионная)'
    if (NONMET_SIMPLE.has(other)) return 'G03 неметалл + O₂ → оксид (ковалентная)'
    if (isOxide(other)) return 'G03 неметалл + O₂ → оксид (ковалентная)'
  }
  if (L.includes('O2') && R.some(isOxide) && !R.includes('CO2')) return 'G03b горение соединений (H₂S, FeS₂, NH₃…) → оксиды'
  if (L.length === 2 && R.length === 1 && L.some(isMetal) && L.some((f) => NONMET_SIMPLE.has(f))) return 'G04 металл + неметалл → бинарное соединение (ионная)'
  if (L.length === 2 && R.length === 1 && L.every((f) => NONMET_SIMPLE.has(f))) return 'G05 неметалл + неметалл → ковалентное'
  if (L.length === 2 && L.some(isWater) && L.some(isOxide) && R.length === 1) return 'G06 оксид + вода → основание / кислота'
  if (L.length === 2 && L.every(isOxide) && R.length === 1) return 'G07 оксид + оксид → соль'
  if (L.some(isMetal) && L.some(isWater) && R.includes('H2')) return 'G10 металл + вода → щёлочь + H₂'
  if (L.some(isMetal) && L.some(isAcid) && R.includes('H2')) return 'G09 металл + кислота → соль + H₂'
  if (L.some((f) => ['H2', 'C', 'CO', 'Al'].includes(f)) && L.some(isOxide) && R.some(isMetal)) return 'G12 восстановление оксида'
  if (L.some(isMetal) && R.some(isMetal)) return 'G11 металл + соль → соль + металл'
  if (L.some(isAcid) && L.some(isBase) && R.includes('H2O')) return 'G14 нейтрализация'
  if (type === 'exchange' || (L.length === 2 && R.length === 2)) return 'G13 обмен (осадок / газ / вода)'
  if (L.length >= 2 && R.length === 1) return 'G07b соединение: прочее (гидраты, O₂ → O₃…)'
  return 'G16 прочее'
}

// ─── повторы и обратные пары ───
const canon = (p: ReturnType<typeof parse>) => `${p.L.map((x) => x.f).sort().join('+')}→${p.R.map((x) => x.f).sort().join('+')}`
const groups = new Map<string, typeof all>()
for (const r of all) {
  const k = canon(parse(r.equationAscii || r.equation))
  groups.set(k, [...(groups.get(k) ?? []), r])
}
const keys = [...groups.keys()]
const reversePairs: [string, string][] = []
for (const k of keys) {
  const [l, r] = k.split('→')
  const rev = `${r}→${l}`
  if (k < rev && groups.has(rev)) reversePairs.push([k, rev])
}

// ─── вещества и покрытие строения ───
const formulaIndex = new Map<string, string>()
for (const c of Object.values(compoundById) as { id: string; formulaUnicode: string }[]) formulaIndex.set(normF(c.formulaUnicode ?? ''), c.id)
const geomKeys = new Set(Object.keys(REAGENT_GEOMETRY).map((k) => k.toLowerCase()))
const crystalFormulas = new Map<string, string>()
for (const id of CRYSTAL_IDS) { const c = getCrystal(id) as Record<string, unknown> | null; const fo = (c?.formula ?? c?.formulaUnicode ?? '') as string; if (fo) crystalFormulas.set(normF(fo), id) }
console.log('кристаллы ядра:', CRYSTAL_IDS.join(' '), '| молекулы ядра:', Object.keys(REAGENT_GEOMETRY).join(' '))
let pubchem: Record<string, unknown> = {}
try { pubchem = JSON.parse(fs.readFileSync('src/data/pubchemGeometryById.json', 'utf8')) } catch { /* нет файла */ }
const substances = new Map<string, { uses: number; catalog: string | null; core: string | null; pubchem: boolean }>()
for (const k of keys) {
  const p = parse(groups.get(k)![0]!.equationAscii || groups.get(k)![0]!.equation)
  for (const x of [...p.L, ...p.R]) {
    const f = x.f
    const cur = substances.get(f) ?? { uses: 0, catalog: formulaIndex.get(f) ?? null, core: null, pubchem: false }
    cur.uses++
    const id = cur.catalog
    cur.core = crystalFormulas.get(f) ? `crystal:${crystalFormulas.get(f)}` : geomKeys.has(f.toLowerCase()) || (id && geomKeys.has(id.toLowerCase())) ? 'molecule' : null
    cur.pubchem = !!(id && pubchem[id])
    substances.set(f, cur)
  }
}

// ─── уравнения из текста учебника вне каталога ───
const corpusRaw = JSON.parse(fs.readFileSync('src/data/kb/corpus/kb-corpus-g7.json', 'utf8'))
const corpus = ((Array.isArray(corpusRaw) ? corpusRaw : corpusRaw.chunks ?? corpusRaw.items ?? Object.values(corpusRaw)[0]) as { title: string; kp: string; text: string; type: string; pageStart: number }[]).filter((c) => c.type === 'textbook')
const FORM = String.raw`(?:\d{0,2}\s?(?:\(?[A-Z][a-z]?\d*(?:\([A-Za-z0-9]+\)\d*)?)+)`
const EQ = new RegExp(String.raw`${FORM}(?:\s?\+\s?${FORM})*\s?(?:→|->|=|⇄|—>|–>|⟶)\s?${FORM}(?:\s?\+\s?${FORM})*`, 'g')
const inCatalog = new Set(keys)
const extra = new Map<string, { eq: string; where: string }>()
for (const c of corpus) {
  const t = normF(c.text).replace(/[—–]>|⟶/g, '→').replace(/\(t°?\)/g, '')
  for (const m of t.matchAll(EQ)) {
    const eq0 = m[0]
    // Варианты: как есть и с отрезанными 1–2 цифрами в конце (номер упражнения, приклеенный OCR к формуле).
    const variants = [eq0, eq0.replace(/\d$/, ''), eq0.replace(/\d\d$/, ''), eq0.replace(/^O2(?=[A-Z])/, '')]
    const hitV = variants.find((v) => { try { const pv = parse(v); const kv = canon(pv); const [lv, rv] = kv.split('→'); return inCatalog.has(kv) || inCatalog.has(`${rv}→${lv}`) } catch { return false } })
    if (hitV) continue
    const eq = variants.find((v) => { try { const pv = parse(v); return pv.R.every((x) => /^[A-Z(]/.test(x.f)) } catch { return false } }) ?? eq0
    let p: ReturnType<typeof parse>
    try { p = parse(eq) } catch { continue }
    if (p.L.length === 0 || p.R.length === 0) continue
    const L = p.L.flatMap((x) => Object.entries(elements(x.f)).map(([e, n]) => [e, n * x.coef] as const))
    const R = p.R.flatMap((x) => Object.entries(elements(x.f)).map(([e, n]) => [e, n * x.coef] as const))
    const sum = (a: readonly (readonly [string, number])[]) => { const o: Record<string, number> = {}; for (const [e, n] of a) o[e] = (o[e] ?? 0) + n; return o }
    const sl = sum(L), sr = sum(R)
    const sameEl = Object.keys(sl).sort().join() === Object.keys(sr).sort().join()
    if (!sameEl || Object.keys(sl).length === 0) continue // не уравнение (схема, таблица, шум OCR)
    const k = canon(p)
    if (inCatalog.has(k)) continue
    const [l, r] = k.split('→')
    if (inCatalog.has(`${r}→${l}`)) continue
    if (!extra.has(k)) extra.set(k, { eq, where: `${c.kp} ${c.title} (с. ${c.pageStart})` })
  }
}

// ─── отчёт ───
const byGrammar = new Map<string, { eq: string; n: number; units: string[]; exercise: boolean; lab: boolean }[]>()
for (const [k, rs] of groups) {
  const r0 = rs[0]!
  const g = grammar(parse(r0.equationAscii || r0.equation), r0.type)
  byGrammar.set(g, [...(byGrammar.get(g) ?? []), { eq: r0.equation, n: rs.length, units: [...new Set(rs.map((x) => x.kp))], exercise: rs.every((x) => x.exercise), lab: rs.some((x) => x.lab.ok) }])
  void k
}
const subs = [...substances.entries()].sort((a, b) => b[1].uses - a[1].uses)
const report = {
  total: all.length,
  unique: groups.size,
  repeated: [...groups.values()].filter((g) => g.length > 1).map((g) => ({ eq: g[0]!.equation, times: g.length, where: g.map((x) => x.kp) })),
  reversePairs,
  grammars: Object.fromEntries([...byGrammar.entries()].sort()),
  substances: subs.map(([f, v]) => ({ f, ...v })),
  extraFromBook: [...extra.values()],
}
fs.mkdirSync('.smoke/g7-plan', { recursive: true })
fs.writeFileSync('.smoke/g7-plan/report.json', JSON.stringify(report, null, 2))

console.log(`реакций ${report.total}, уникальных ${report.unique}, повторяющихся уравнений ${report.repeated.length} (лишних карточек ${report.total - report.unique}), обратных пар ${reversePairs.length}`)
console.log('самые частые:', report.repeated.sort((a, b) => b.times - a.times).slice(0, 8).map((r) => `${r.eq} ×${r.times}`).join(' | '))
console.log('\nдвижки:')
for (const [g, list] of [...byGrammar.entries()].sort()) console.log(`  ${g}: ${list.length} уник. (${list.reduce((s, x) => s + x.n, 0)} карточек)`)
const cov = { core: subs.filter(([, v]) => v.core).length, pubchem: subs.filter(([, v]) => !v.core && v.pubchem).length, catalogOnly: subs.filter(([, v]) => !v.core && !v.pubchem && v.catalog).length, none: subs.filter(([, v]) => !v.catalog).length }
console.log(`\nвеществ ${subs.length}: строение в научном ядре ${cov.core}, только PubChem-геометрия ${cov.pubchem}, только карточка каталога ${cov.catalogOnly}, нет в каталоге ${cov.none}`)
console.log('нет в каталоге:', subs.filter(([, v]) => !v.catalog).map(([f]) => f).join(' '))
console.log(`\nуравнений в тексте учебника вне каталога: ${extra.size}`)
for (const e of [...extra.values()].slice(0, 40)) console.log(`  ${e.eq}   — ${e.where}`)
