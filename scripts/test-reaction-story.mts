/**
 * Сюжет реакции «на уровне частиц» (src/chemistry/reactionStory.ts) — анимация после синтеза.
 * Проверяет на всех реакциях банка (SCHOOL_REACTION_BANK), на 200 основных реакциях (если в ветке есть
 * src/data/catalog/mainReactions200.ts) и на уравнениях учебников 7–9 классов:
 *  • атомы сохраняются (по элементам) и сопоставление атомов — биекция с тем же элементом;
 *  • Σ степеней окисления каждой частицы = её заряду;
 *  • число отданных e⁻ = числу принятых, переносы (from → to) в сумме дают то же число;
 *  • сохранённые связи соединяют образы атомов; многоатомные группы, перешедшие целиком, — тот же состав;
 *  • тексты трёх языков без пустот («undefined», «NaN», пустые строки);
 *  • эталоны: Zn + 2HCl, 2Na + Cl₂, Fe + CuSO₄, 2H₂ + O₂, BaCl₂ + H₂SO₄, NaOH + HCl, CaCO₃ → CaO + CO₂, 2KMnO₄ → …
 * Запуск: npx tsx scripts/test-reaction-story.mts
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank'
import { buildReactionStory, unitOxSum, type ReactionStory } from '../src/chemistry/reactionStory'
import { parseEquationText, equationImbalance } from '../src/chemistry/equationFormula'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let fails = 0
let checks = 0
function ok(cond: boolean, msg: string): void {
  checks++
  if (!cond) {
    fails++
    console.error(`  ✗ ${msg}`)
  }
}

function checkStory(label: string, s: ReactionStory): void {
  const L = s.left
  const R = s.right
  // атомы сохраняются
  const cnt = (atoms: readonly { el: string }[]) => {
    const c: Record<string, number> = {}
    for (const a of atoms) c[a.el] = (c[a.el] ?? 0) + 1
    return JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]]))
  }
  ok(cnt(L.atoms) === cnt(R.atoms), `${label}: атомы сохраняются`)
  // биекция
  const seen = new Set<number>()
  let bij = s.map.length === L.atoms.length && L.atoms.length === R.atoms.length
  s.map.forEach((r, l) => {
    if (r < 0 || seen.has(r) || R.atoms[r]?.el !== L.atoms[l]!.el) bij = false
    seen.add(r)
  })
  ok(bij, `${label}: сопоставление атомов — биекция по элементам`)
  // Σ степеней окисления = заряду частицы
  for (const side of [L, R]) {
    for (const u of side.units) {
      const sum = unitOxSum(side, u.id)
      ok(Math.abs(sum - u.charge) < 1e-6, `${label}: Σ с.о. ${u.formula} = ${sum}, заряд ${u.charge}`)
      for (const g of u.groups) {
        const gr = side.groups[g]!
        if (gr.kind === 'cation' || gr.kind === 'anion') {
          const gs = gr.atoms.reduce((acc, a) => acc + side.atoms[a]!.ox, 0)
          ok(Math.abs(gs - gr.charge) < 1e-6, `${label}: Σ с.о. иона ${gr.label} = ${gs}, заряд ${gr.charge}`)
        }
      }
    }
  }
  // электроны
  ok(Math.abs(s.given - s.accepted) < 1e-6, `${label}: отдано ${s.given} = принято ${s.accepted}`)
  const tSum = s.transfers.reduce((acc, t) => acc + t.n, 0)
  ok(Math.abs(tSum - s.electrons) < 1e-5, `${label}: переносы дают ${tSum} = ${s.electrons}`)
  ok(s.redox === s.steps.includes('electrons'), `${label}: шаг «перенос электронов» только при ОВР`)
  for (const t of s.transfers) {
    const dFrom = R.atoms[s.map[t.from]!]!.ox - L.atoms[t.from]!.ox
    const dTo = R.atoms[s.map[t.to]!]!.ox - L.atoms[t.to]!.ox
    ok(dFrom > 0 && dTo < 0, `${label}: перенос от восстановителя к окислителю`)
  }
  // связи
  const rb = new Set(R.bonds.map((b) => [b.a, b.b].sort((x, y) => x - y).join('-')))
  for (const i of s.bondsKept) {
    const b = L.bonds[i]!
    ok(rb.has([s.map[b.a]!, s.map[b.b]!].sort((x, y) => x - y).join('-')), `${label}: сохранённая связь есть справа`)
  }
  ok(s.bondsKept.length + s.bondsBroken.length === L.bonds.length, `${label}: связи слева разделены на сохранённые и разорванные`)
  ok(s.bondsKept.length + s.bondsFormed.length === R.bonds.length, `${label}: связи справа — сохранённые + новые`)
  for (const [gl, gr] of s.conserved) {
    const a = L.groups[gl]!
    const b = R.groups[gr]!
    ok(a.key === b.key && a.atoms.every((x) => b.atoms.includes(s.map[x]!)), `${label}: группа ${b.label} переходит целиком`)
  }
  // тексты
  for (const loc of ['ru', 'en', 'uz'] as const) {
    for (const id of s.steps) {
      const t = s.text[loc][id]
      for (const [k, v] of Object.entries(t)) {
        ok(typeof v === 'string' && v.trim().length > 0 && !/undefined|NaN|null|\[object/.test(v), `${label}: текст ${loc}/${id}/${k} без пустот: «${v}»`)
      }
    }
  }
}

// ——— 1. банк реакций ———
let bankOk = 0
const bankSkipped: string[] = []
for (const r of SCHOOL_REACTION_BANK) {
  const eq = parseEquationText(r.equationRu)
  if (!eq || eq.isScheme || equationImbalance(eq).length > 0 || [...eq.reactants, ...eq.products].some((x) => x.electron)) {
    bankSkipped.push(`${r.id} (${r.equationRu}) — не полное уравнение`)
    continue
  }
  const s = buildReactionStory(r.equationRu)
  ok(!!s, `банк ${r.id}: сюжет строится (${r.equationRu})`)
  if (!s) continue
  bankOk++
  checkStory(`банк ${r.id} «${r.equationRu}»`, s)
}

// ——— 2. 200 основных реакций (если модуль уже есть в ветке) ———
let main200 = 0
const mainPath = resolve(ROOT, 'src/data/catalog/mainReactions200.ts')
if (existsSync(mainPath)) {
  const mod = (await import(pathToFileURL(mainPath).href)) as Record<string, unknown>
  const list = (Object.values(mod).find((v) => Array.isArray(v) && v.length >= 100) ?? []) as { id?: string; equation?: string; equationRu?: string }[]
  for (const r of list) {
    const text = r.equation ?? r.equationRu
    if (!text) continue
    const s = buildReactionStory(text)
    ok(!!s, `200: ${r.id ?? text}: сюжет строится (${text})`)
    if (!s) continue
    main200++
    checkStory(`200 ${r.id ?? ''} «${text}»`, s)
  }
}

// ——— 3. уравнения учебников 7–9 ———
let bookOk = 0
let bookTotal = 0
const bookFail: string[] = []
for (const g of [7, 8, 9]) {
  const j = JSON.parse(readFileSync(resolve(ROOT, `src/data/textbook/equations-g${g}.json`), 'utf8')) as {
    units: { reactions?: { id: string; page: number; equation: string; isGeneralScheme?: boolean; isIonic?: boolean }[] }[]
  }
  for (const u of j.units) {
    for (const r of u.reactions ?? []) {
      if (r.isGeneralScheme) continue
      const eq = parseEquationText(r.equation)
      if (!eq || eq.isScheme || equationImbalance(eq).length > 0) continue
      const all = [...eq.reactants, ...eq.products]
      if (all.some((x) => x.electron || x.perUnit || x.polymer || x.radical || !Number.isInteger(x.coeff))) continue
      bookTotal++
      const s = buildReactionStory(r.equation)
      if (!s) {
        bookFail.push(`${g} кл. с. ${r.page}: ${r.equation}`)
        continue
      }
      bookOk++
      checkStory(`${g} кл. с. ${r.page} «${r.equation}»`, s)
    }
  }
}
ok(bookOk >= bookTotal * 0.97, `учебники 7–9: сюжет строится для ${bookOk} из ${bookTotal}`)

// ——— 4. эталоны ———
function ref(eq: string): ReactionStory {
  const s = buildReactionStory(eq)
  if (!s) throw new Error(`эталон не строится: ${eq}`)
  checkStory(`эталон «${eq}»`, s)
  return s
}
const oxOf = (s: ReactionStory, side: 'left' | 'right', el: string) => [...new Set((side === 'left' ? s.left : s.right).atoms.filter((a) => a.el === el).map((a) => a.ox))].sort()

{
  const s = ref('Zn + 2HCl → ZnCl₂ + H₂')
  ok(s.redox && s.electrons === 2, 'Zn + 2HCl: 2e⁻')
  ok(s.oxidations.length === 1 && s.oxidations[0]!.el === 'Zn' && s.oxidations[0]!.from === 0 && s.oxidations[0]!.to === 2, 'Zn + 2HCl: Zn⁰ → Zn⁺²')
  ok(s.reductions.length === 1 && s.reductions[0]!.el === 'H' && s.reductions[0]!.count === 2 && s.reductions[0]!.from === 1 && s.reductions[0]!.to === 0, 'Zn + 2HCl: 2H⁺ → H₂⁰')
  ok(s.transfers.length === 2 && s.transfers.every((t) => s.left.atoms[t.from]!.el === 'Zn' && s.left.atoms[t.to]!.el === 'H' && t.n === 1), 'Zn + 2HCl: по e⁻ к каждому H⁺')
  ok(s.terms.find((t) => t.formula === 'H₂')?.fate === 'gas', 'Zn + 2HCl: H₂ — газ ↑')
  ok(s.type === 'substitution', 'Zn + 2HCl: замещение')
  ok(s.text.ru.electrons.body.includes('Восстановитель — Zn'), 'Zn + 2HCl: текст называет восстановитель')
}
{
  const s = ref('2Na + Cl₂ → 2NaCl')
  ok(s.electrons === 2 && s.type === 'combination', '2Na + Cl₂: 2e⁻, соединение')
  ok(s.right.groups.some((g) => g.label === 'Na⁺') && s.right.groups.some((g) => g.label === 'Cl⁻'), '2Na + Cl₂: NaCl из ионов Na⁺ и Cl⁻')
}
{
  const s = ref('Fe + CuSO₄ → FeSO₄ + Cu')
  ok(s.electrons === 2, 'Fe + CuSO₄: 2e⁻')
  ok(JSON.stringify(oxOf(s, 'left', 'Cu')) === '[2]' && JSON.stringify(oxOf(s, 'right', 'Fe')) === '[2]', 'Fe + CuSO₄: Cu⁺² → Cu⁰, Fe⁰ → Fe⁺²')
  ok(s.conserved.length === 1 && s.right.groups[s.conserved[0]![1]]!.label === 'SO₄²⁻', 'Fe + CuSO₄: SO₄²⁻ сохраняется')
  ok(s.terms.find((t) => t.formula === 'Cu')?.fate === 'deposit', 'Fe + CuSO₄: медь оседает')
}
{
  const s = ref('2H₂ + O₂ → 2H₂O')
  ok(s.electrons === 4, '2H₂ + O₂: 4e⁻')
  ok(s.bondsBroken.length === 3 && s.bondsFormed.length === 4, '2H₂ + O₂: рвутся H–H ×2 и O–O, образуются O–H ×4')
}
{
  const s = ref('BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl')
  ok(!s.redox && s.electrons === 0, 'BaCl₂ + H₂SO₄: ОВР нет')
  ok(s.conserved.some(([, g]) => s.right.groups[g]!.label === 'SO₄²⁻'), 'BaCl₂ + H₂SO₄: SO₄²⁻ сохраняется')
  ok(s.terms.find((t) => t.formula === 'BaSO₄')?.fate === 'precipitate', 'BaCl₂ + H₂SO₄: BaSO₄ — осадок ↓')
  ok(s.type === 'exchange', 'BaCl₂ + H₂SO₄: обмен')
  ok(!s.steps.includes('electrons'), 'BaCl₂ + H₂SO₄: без шага электронов')
}
{
  const s = ref('NaOH + HCl → NaCl + H₂O')
  ok(!s.redox, 'NaOH + HCl: ОВР нет')
  ok(s.type === 'neutralization', 'NaOH + HCl: нейтрализация')
  // H⁺ + OH⁻ → H₂O: связь O–H гидроксид-иона сохраняется, образуется одна новая O–H, рвётся H–Cl
  ok(s.bondsKept.length === 1 && s.bondsFormed.length === 1 && s.bondsBroken.length === 1, 'NaOH + HCl: H⁺ + OH⁻ → H₂O')
  const water = s.right.units.find((u) => u.formula === 'H₂O')!
  const fromOH = s.left.groups.find((g) => g.label === 'OH⁻')!
  ok(fromOH.atoms.every((a) => water.atoms.includes(s.map[a]!)), 'NaOH + HCl: OH⁻ целиком в воде')
  ok(s.terms.find((t) => t.formula === 'H₂O')?.fate === 'water', 'NaOH + HCl: вода')
}
{
  const s = ref('CaCO₃ → CaO + CO₂')
  ok(!s.redox && s.type === 'decomposition', 'CaCO₃: ОВР нет, разложение')
  ok(s.bondsBroken.length === 1 && s.bondsFormed.length === 0, 'CaCO₃: рвётся одна связь C–O, CO₂ уходит готовым')
  ok(s.terms.find((t) => t.formula === 'CO₂')?.fate === 'gas', 'CaCO₃: CO₂ — газ ↑')
}
{
  const s = ref('2KMnO₄ → K₂MnO₄ + MnO₂ + O₂')
  ok(s.electrons === 4, '2KMnO₄: 4e⁻ (2O⁻² → O₂⁰; Mn⁺⁷ → Mn⁺⁶ и Mn⁺⁴)')
  ok(JSON.stringify(oxOf(s, 'right', 'Mn')) === '[4,6]', '2KMnO₄: Mn⁺⁶ и Mn⁺⁴')
}
{
  const s = ref('2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂ + 8H₂O')
  ok(s.electrons === 10, 'KMnO₄ + HCl: 10e⁻')
}
{
  const s = ref('2Na + O₂ → Na₂O₂')
  ok(s.electrons === 2 && JSON.stringify(oxOf(s, 'right', 'O')) === '[-1]', 'Na₂O₂: пероксид O⁻¹, 2e⁻')
}
{
  const s = ref('NH₄NO₃ → N₂O + 2H₂O')
  ok(s.electrons === 4 && JSON.stringify(oxOf(s, 'left', 'N')) === '[-3,5]', 'NH₄NO₃: N⁻³ и N⁺⁵, 4e⁻')
}
{
  const s = ref('3Fe + 2O₂ → Fe₃O₄')
  ok(s.electrons === 8, 'Fe₃O₄: 8e⁻ (Fe⁺² + 2Fe⁺³)')
}

if (bankSkipped.length) console.log(`  · банк: пропущено ${bankSkipped.length} (не полное уравнение): ${bankSkipped.slice(0, 6).join('; ')}`)
if (bookFail.length) console.log(`  · учебники: не построено ${bookFail.length}: ${bookFail.slice(0, 12).join(' | ')}`)
console.log(`банк: ${bankOk}/${SCHOOL_REACTION_BANK.length}; 200 основных: ${main200 || 'нет модуля в ветке'}; учебники 7–9: ${bookOk}/${bookTotal}`)
console.log(`test-reaction-story: ${checks - fails}/${checks} проверок`)
if (fails > 0) {
  console.error(`FAIL: ${fails}`)
  process.exit(1)
}
console.log('OK')
