/**
 * Аудит «Как образуется» для всех 200 веществ каталога: план, сценарий «от и до» (formationStory), уравнение образования.
 * Категории проблем (таблица «до / после»):
 *  A план или 3D-модель не строятся;
 *  B итог анимации ≠ модель карточки (положения атомов в конце показа, палочки и их кратность — как у buildSchoolHeroModel);
 *  C частицы: атомы модели разложены не по одному разу / частицы × число ≠ формула;
 *  D ионные: сумма зарядов ≠ 0, число перешедших e⁻ ≠ сумме зарядов катионов формульной единицы (нет показа переноса e⁻);
 *  E ковалентные: число общих пар ≠ сумме кратностей связей (нет показа общих пар);
 *  F исходные вещества: не простые вещества школьной записи (H₂, O₂, N₂, Cl₂ — молекулы; металлы — атомы), у X₂ нет палочек
 *    нужной кратности (H–H, O=O, N≡N);
 *  G уравнение образования: нет, не уравнено или продукт не тот;
 *  H длительность: показ не 25–45 с, этап с переносом e⁻ / связями короче 4 с;
 *  I расхождения модели с формулой (предупреждения formationPlan.modelIssues).
 * «До» — прежний показ (4 шага: Состав → Заряды → Сборка 6–10 с → Готово, без электронов, исходных веществ и уравнения).
 * Запуск: npx tsx scripts/audit-formation-200.mts [--list]
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan } from '../src/chemistry/formationPlan'
import { formationEquation, isBalanced, equationSides, DIATOMIC, simpleFormula } from '../src/chemistry/formationEquation'
import { buildSchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { atomPosAt, formationStoryFor } from '../src/components/lab/formation/formationStory'

type Cat = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
const CATS: Record<Cat, string> = {
  A: 'план / 3D-модель не строятся',
  B: 'итог анимации ≠ модель карточки',
  C: 'частицы ≠ формула / атомы не по разу',
  D: 'ионные: заряды / перенос e⁻',
  E: 'ковалентные: общие пары',
  F: 'исходные вещества',
  G: 'уравнение образования',
  H: 'длительность этапов',
  I: 'модель ≠ формула (предупр.)',
}
const before: Record<Cat, Set<string>> = { A: new Set(), B: new Set(), C: new Set(), D: new Set(), E: new Set(), F: new Set(), G: new Set(), H: new Set(), I: new Set() }
const after: Record<Cat, Set<string>> = { A: new Set(), B: new Set(), C: new Set(), D: new Set(), E: new Set(), F: new Set(), G: new Set(), H: new Set(), I: new Set() }
const notes: string[] = []
const flag = (cat: Cat, id: string, msg: string) => {
  after[cat].add(id)
  notes.push(`${cat} ${id}: ${msg}`)
}

for (const id of CATALOG_TOP200_IDS) {
  const c = compoundById[id]
  const plan = formationPlan(id)
  const model = c ? buildSchoolHeroModel(c) : null
  if (!c || !plan || !model) {
    before.A.add(id)
    flag('A', id, !c ? 'нет вещества' : !plan ? 'нет плана' : 'нет модели')
    continue
  }
  const f = c.formulaUnicode
  // ── «До»: прежний показ ──
  const oldN = plan.mode === 'molecular' ? plan.bondOrder.length : plan.units.length
  const oldAssembly = plan.crystal ? 8 : Math.min(10, Math.max(6, 4 + 0.5 * oldN))
  const oldTotal = 2.6 + 3.2 + oldAssembly
  if (oldTotal < 25) before.H.add(id)
  before.G.add(id) // уравнения образования не было
  before.F.add(id) // показ начинался с готовых ионов / атомов, без простых веществ
  if (plan.mode === 'ionic') before.D.add(id) // перенос e⁻ не показывался
  else before.E.add(id) // общие пары не показывались
  if (plan.modelIssues.length) {
    before.I.add(id)
    after.I.add(id)
    notes.push(`I ${id}: ${plan.modelIssues.join('; ')}`)
  }
  // ── C: частицы ──
  const seen = new Array(model.atoms.length).fill(0)
  for (const u of plan.units) for (const a of u.atoms) seen[a]++
  const sum: Record<string, number> = {}
  for (const s of plan.species) for (const [e, n] of Object.entries(s.comp)) sum[e] = (sum[e] ?? 0) + n * s.count
  const comp = Object.fromEntries(Object.entries(c.composition).filter(([, n]) => n > 0))
  const cBad = !seen.every((n) => n === 1) || JSON.stringify(Object.entries(sum).sort()) !== JSON.stringify(Object.entries(comp).sort())
  if (cBad) {
    before.C.add(id)
    flag('C', id, 'частицы / атомы')
  }
  const story = formationStoryFor(id)
  if (!story) {
    flag('A', id, 'нет сценария')
    continue
  }
  // ── B: итог = модель карточки ──
  let dev = 0
  const p: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < model.atoms.length; i++) {
    atomPosAt(story, i, story.total + 0.01, p)
    const q = model.atoms[i]!.pos
    dev = Math.max(dev, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))
  }
  const stickCount = new Map<number, number>()
  for (const s of story.sticks) stickCount.set(s.bond, (stickCount.get(s.bond) ?? 0) + 1)
  const missing = model.bonds.filter((b, k) => (stickCount.get(k) ?? 0) !== Math.max(1, Math.min(3, Math.round(b.order))))
  if (dev > 1e-6) flag('B', id, `атомы в конце показа отстоят от модели на ${dev.toExponential(2)}`)
  if (missing.length) {
    before.B.add(id)
    flag('B', id, `палочек модели карточки нет в конце показа: ${missing.length} (${missing.map((b) => `${model.atoms[b.a]!.el}-${model.atoms[b.b]!.el}`).slice(0, 4).join(', ')})`)
  }
  // ── D / E ──
  if (plan.mode === 'ionic') {
    const q = plan.species.reduce((s, x) => s + x.charge * x.count, 0)
    if (q !== 0) flag('D', id, `сумма зарядов ${q}`)
    if (!plan.crystal) {
      // Формульная единица: e⁻ уходят от металлов (и H иона аммония) к анионам — ровно сумма зарядов катионов.
      const need = plan.units.reduce((s, u) => {
        const sp = plan.species[u.species]!
        return s + (sp.charge > 0 ? sp.charge : 0)
      }, 0)
      const acc = plan.units.reduce((s, u) => {
        const sp = plan.species[u.species]!
        return s + (sp.charge < 0 ? -sp.charge : 0)
      }, 0)
      if (story.transferred !== Math.min(need, acc) || need !== acc) flag('D', id, `перешло e⁻ ${story.transferred}, катионы отдают ${need}, анионы принимают ${acc}`)
    } else if (story.transferred < 1) flag('D', id, 'в кристалле не показан переход e⁻')
  } else {
    const pairs = plan.bondOrder.reduce((s, k) => s + Math.max(1, Math.min(3, Math.round(model.bonds[k]!.order))), 0)
    if (!plan.crystal && story.sharedPairs !== pairs) flag('E', id, `общих пар ${story.sharedPairs}, связей (с кратностью) ${pairs}`)
    if (plan.crystal && story.sharedPairs < 1) flag('E', id, 'в кристалле не показаны общие пары')
  }
  // ── F: исходные вещества ──
  const eq = formationEquation(id)
  const els = [...new Set(model.atoms.map((a) => a.el))]
  if (eq?.direct && eq.directKind === 'elements') {
    const want = new Set(Object.keys(comp).map(simpleFormula))
    const got = new Set(eq.reagents)
    if ([...want].some((x) => !got.has(x)) || [...got].some((x) => !want.has(x))) flag('F', id, `исходные ${[...got].join(', ')} ≠ простые вещества ${[...want].join(', ')}`)
  }
  const atomsMode = eq?.directKind === 'atoms' && eq.reagents[0] !== 'O₂'
  for (const el of els) {
    if (!DIATOMIC.has(el) || atomsMode) continue
    const nAt = model.atoms.filter((a) => a.el === el).length
    const sticks = story.reagentSticks.filter((s) => model.atoms[s.a]!.el === el)
    const order = el === 'N' ? 3 : el === 'O' ? 2 : 1
    if (sticks.length !== Math.ceil(nAt / 2) * order) flag('F', id, `${el}₂: палочек ${sticks.length}, нужно ${Math.ceil(nAt / 2) * order}`)
  }
  // ── G: уравнение ──
  if (!eq) flag('G', id, 'нет уравнения')
  else {
    for (const e of [eq.direct, eq.lab]) {
      if (!e) continue
      if (!isBalanced(e)) flag('G', id, `не уравнено: ${e}`)
      if (!equationSides(e)?.right.some(([, x]) => x === f)) flag('G', id, `справа нет ${f}: ${e}`)
    }
    if (!eq.direct && !eq.lab) flag('G', id, 'пустое уравнение')
  }
  // ── H: длительность ──
  if (story.total < 25 || story.total > 45) flag('H', id, `показ ${story.total.toFixed(1)} с`)
  for (const st of story.stages) {
    if (['transfer', 'pairs', 'bonds', 'inner'].includes(st.key) && st.dur < 4) flag('H', id, `этап ${st.key} ${st.dur.toFixed(1)} с < 4 с`)
    if (st.dur < 2.5) flag('H', id, `этап ${st.key} ${st.dur.toFixed(1)} с`)
  }
}

const N = CATALOG_TOP200_IDS.length
console.log(`Аудит «Как образуется» — ${N} веществ`)
console.log('Категория                                  | до  | после')
console.log('-------------------------------------------|-----|------')
for (const k of Object.keys(CATS) as Cat[]) console.log(`${k} ${CATS[k].padEnd(41)}| ${String(before[k].size).padStart(3)} | ${String(after[k].size).padStart(4)}`)
const fails = (Object.keys(CATS) as Cat[]).filter((k) => k !== 'I').reduce((s, k) => s + after[k].size, 0)
if (process.argv.includes('--list') || fails > 0) for (const n of notes) console.log(`  ${n}`)
console.log(fails === 0 ? 'ОК: проблем A–H нет' : `Проблем A–H: ${fails}`)
