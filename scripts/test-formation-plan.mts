/**
 * «Как образуется» — план строения для всех 200 веществ каталога (src/chemistry/formationPlan.ts) и тексты RU/EN/UZ:
 *  • план строится; частицы × число = формула (compound.composition);
 *  • ионное: сумма зарядов = 0, строка баланса вида «2·(+1) + (−2) = 0»;
 *  • атомы модели разложены на частицы ровно по одному разу, порядок связей — без повторов;
 *  • тип связи на эталонах (NaCl — ионная; HCl — ковалентная полярная; Cl₂, O₂, N₂ — неполярная; Na₂SO₄, KNO₃,
 *    CaCO₃ — ионная + ковалентная внутри корня; H₂SO₄ — ковалентная полярная; NH₄Cl — ионная + ковалентная,
 *    в том числе донорно-акцепторная, внутри NH₄⁺);
 *  • тексты трёх языков — без пустых строк, «undefined», «NaN».
 * Расхождения модели с формулой (модели ведёт другой модуль) печатаются как предупреждения.
 * Запуск: npx tsx scripts/test-formation-plan.mts
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan, type FormationPlan } from '../src/chemistry/formationPlan'
import { formationTexts, type FormationLocale } from '../src/chemistry/formationText'
import { buildSchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { formationEquation, isBalanced, equationSides } from '../src/chemistry/formationEquation'
import { atomPosAt, formationStoryFor } from '../src/components/lab/formation/formationStory'
import { formationStageTexts } from '../src/components/lab/formation/formationStageText'

let fails = 0
let checks = 0
function ok(cond: boolean, msg: string): void {
  checks++
  if (!cond) {
    fails++
    console.error(`  ✗ ${msg}`)
  }
}

const OBTAINING: Record<FormationLocale, string> = { ru: 'Этапы получения', en: 'Obtaining steps', uz: 'Olish bosqichlari' }
const warnings: string[] = []
const plans = new Map<string, FormationPlan>()

for (const id of CATALOG_TOP200_IDS) {
  const c = compoundById[id]
  ok(!!c, `${id}: вещество есть в данных`)
  if (!c) continue
  const p = formationPlan(id)
  ok(!!p, `${id}: план строится`)
  if (!p) continue
  plans.set(id, p)
  const f = c.formulaUnicode
  // Состав
  const sum: Record<string, number> = {}
  for (const s of p.species) for (const [e, n] of Object.entries(s.comp)) sum[e] = (sum[e] ?? 0) + n * s.count
  const comp = Object.fromEntries(Object.entries(c.composition).filter(([, n]) => n > 0))
  ok(JSON.stringify(Object.entries(sum).sort()) === JSON.stringify(Object.entries(comp).sort()), `${f}: частицы ${JSON.stringify(sum)} = формула ${JSON.stringify(comp)}`)
  ok(p.species.every((s) => s.count > 0 && Number.isInteger(s.count)), `${f}: число частиц — целое > 0`)
  // Заряды
  if (p.mode === 'ionic') {
    const q = p.species.reduce((s, x) => s + x.charge * x.count, 0)
    ok(q === 0, `${f}: сумма зарядов ${q} = 0`)
    ok(!!p.balance && /= 0$/.test(p.balance) && !/NaN|undefined/.test(p.balance), `${f}: строка баланса «${p.balance}»`)
    ok(p.species.some((s) => s.charge > 0) && p.species.some((s) => s.charge < 0), `${f}: есть катион и анион`)
    ok(p.bondType === 'ionic' || p.bondType === 'ionic-covalent', `${f}: ионное вещество — ионная связь`)
  } else {
    ok(p.species.every((s) => s.charge === 0 && s.kind === 'atom'), `${f}: молекула — из атомов`)
    ok(p.bondType === 'covalent-polar' || p.bondType === 'covalent-nonpolar', `${f}: молекула — ковалентная связь`)
    ok(p.species.every((s) => (s.valences?.length ?? 0) > 0), `${f}: у каждого элемента названа валентность`)
    const one = Object.keys(comp).length === 1
    ok(one === (p.bondType === 'covalent-nonpolar'), `${f}: неполярная ⇔ одинаковые неметаллы`)
  }
  // Частицы модели
  const model = buildSchoolHeroModel(c)
  if (model) {
    const seen = new Array(model.atoms.length).fill(0)
    for (const u of p.units) for (const a of u.atoms) seen[a]++
    ok(seen.every((n) => n === 1), `${f}: каждый атом модели — ровно в одной частице`)
    ok(p.units.every((u) => u.species >= 0 && u.species < p.species.length), `${f}: частицы модели ссылаются на частицы формулы`)
    ok(new Set(p.bondOrder).size === p.bondOrder.length && p.bondOrder.every((k) => k >= 0 && k < model.bonds.length), `${f}: порядок связей без повторов`)
    if (p.mode === 'molecular') ok(p.bondOrder.length === model.bonds.length, `${f}: молекула — появляются все связи модели`)
    ok(p.unitOrder.length === p.units.length, `${f}: порядок прихода — все частицы`)
  } else warnings.push(`${f}: нет 3D-модели (buildSchoolHeroModel → null) — «Как образуется» только текстом`)
  for (const w of p.modelIssues) warnings.push(`${f}: ${w}`)
  // Тексты
  for (const loc of ['ru', 'en', 'uz'] as const) {
    const t = formationTexts(p, loc, OBTAINING[loc])
    const all = [...t.steps.flatMap((s) => [s.title, s.main, s.sub]), t.note, ...Object.values(t.ui)]
    ok(all.every((s) => typeof s === 'string' && s.trim().length > 0), `${f} [${loc}]: тексты без пустот (${t.steps.map((s) => [s.title, s.main, s.sub].map((x) => (x ? '+' : '∅')).join('')).join(' ')})`)
    ok(all.every((s) => !/undefined|NaN|null|\[object/.test(s)), `${f} [${loc}]: без undefined / NaN`)
    if (loc !== 'ru') ok(!/[А-Яа-яЁё]/.test(t.steps.map((s) => s.title + s.main + s.sub).join('')), `${f} [${loc}]: без кириллицы`)
  }
}

// Эталоны
const ref = (id: string) => plans.get(id)
const bt = (id: string) => ref(id)?.bondType
ok(bt('nacl') === 'ionic', `NaCl — ионная (${bt('nacl')})`)
ok(bt('hcl') === 'covalent-polar', `HCl — ковалентная полярная (${bt('hcl')})`)
for (const id of ['tb_cl2', 'tb_o2', 'tb_n2']) ok(bt(id) === 'covalent-nonpolar', `${id} — ковалентная неполярная (${bt(id)})`)
for (const id of ['salt_na_so4', 'salt_k_no3', 'salt_ca_co3']) ok(bt(id) === 'ionic-covalent', `${id} — ионная + ковалентная внутри корня (${bt(id)})`)
ok(bt('h2so4') === 'covalent-polar', `H₂SO₄ — ковалентная полярная (${bt('h2so4')})`)
ok(bt('salt_nh4_cl') === 'ionic-covalent' && !!ref('salt_nh4_cl')?.species.find((s) => s.formula === 'NH₄⁺')?.donorAcceptor, 'NH₄Cl — ионная + ковалентная (донорно-акцепторная) внутри NH₄⁺')
const nh4Ru = ref('salt_nh4_cl') ? formationTexts(ref('salt_nh4_cl')!, 'ru', OBTAINING.ru).steps[3].main : ''
ok(/Ионная связь между NH₄⁺ и Cl⁻/.test(nh4Ru) && /донорно-акцепторная/.test(nh4Ru) && /внутри NH₄⁺/.test(nh4Ru), `NH₄Cl RU: «${nh4Ru}»`)
const na2so4Ru = ref('salt_na_so4') ? formationTexts(ref('salt_na_so4')!, 'ru', OBTAINING.ru) : null
ok(na2so4Ru?.steps[1].main === '2·(+1) + (−2) = 0', `Na₂SO₄ — баланс «${na2so4Ru?.steps[1].main}»`)
ok(/Ионная связь между Na⁺ и SO₄²⁻; ковалентная полярная — внутри SO₄²⁻/.test(na2so4Ru?.steps[3].main ?? ''), `Na₂SO₄ RU: «${na2so4Ru?.steps[3].main}»`)
ok(/SO₄²⁻ — тетраэдр \(вокруг S\)/.test(na2so4Ru?.steps[3].sub ?? ''), `Na₂SO₄ — форма SO₄²⁻: «${na2so4Ru?.steps[3].sub}»`)
ok(ref('nacl')?.balance === '(+1) + (−1) = 0', `NaCl — баланс «${ref('nacl')?.balance}»`)
ok(ref('salt_al_so4')?.balance === '2·(+3) + 3·(−2) = 0', `Al₂(SO₄)₃ — баланс «${ref('salt_al_so4')?.balance}»`)
ok(ref('fe3o4')?.balance === '(+2) + 2·(+3) + 4·(−2) = 0', `Fe₃O₄ — баланс «${ref('fe3o4')?.balance}»`)
ok(ref('salt_fe3_cl')?.species[0]?.formula === 'Fe³⁺', 'FeCl₃ — Fe³⁺ из электронейтральности')
ok(ref('tb_k2mno4')?.species.some((s) => s.formula === 'MnO₄²⁻') === true && ref('salt_k_mno4')?.species.some((s) => s.formula === 'MnO₄⁻') === true, 'KMnO₄ — MnO₄⁻, K₂MnO₄ — MnO₄²⁻')
const h2so4 = ref('h2so4')
ok(h2so4?.species.find((s) => s.formula === 'S')?.valences?.join() === '6', 'H₂SO₄ — S(VI)')
ok(ref('co2')?.shapes[0]?.key === 'linear' && ref('h2o')?.shapes[0]?.key === 'angular' && ref('nh3')?.shapes[0]?.key === 'trigonal-pyramidal', 'формы: CO₂ линейная, H₂O угловая, NH₃ пирамида')
ok(ref('tb_cuso4_5h2o')?.species.find((s) => s.formula === 'H₂O')?.count === 5, 'CuSO₄·5H₂O — 5 молекул H₂O')
const cuEn = ref('salt_cu_so4') ? formationTexts(ref('salt_cu_so4')!, 'en', OBTAINING.en).steps[0].sub : ''
ok(/Cu²⁺ — copper\(II\) ion/.test(cuEn), `CuSO₄ EN — «${cuEn}»`)
const feRu = ref('salt_fe3_cl') ? formationTexts(ref('salt_fe3_cl')!, 'ru', OBTAINING.ru).steps[0].sub : ''
ok(/Fe³⁺ — ион железа\(III\)/.test(feRu), `FeCl₃ RU — «${feRu}»`)
// Связи «внутри корня» — только самого иона (у кристаллогидрата O–H воды туда не входит).
const innerLabels = (id: string) => (ref(id)?.innerBonds ?? []).flatMap((x) => x.kinds.map((k) => k.label.replace(/[–=≡]/, '-')))
ok(innerLabels('tb_cuso4_5h2o').every((l) => /^S-O$/.test(l)) && innerLabels('tb_cuso4_5h2o').length > 0, `CuSO₄·5H₂O — внутри SO₄²⁻ только S–O (${innerLabels('tb_cuso4_5h2o')})`)
ok(innerLabels('salt_nh4_cl').join() === 'N-H', `NH₄Cl — внутри NH₄⁺ только N–H (${innerLabels('salt_nh4_cl')})`)
for (const p of plans.values()) {
  if (p.mode !== 'ionic') continue
  for (const x of p.innerBonds) {
    const sp = p.species.find((s) => s.formula === x.of)
    const els = new Set(Object.keys(sp?.comp ?? {}))
    ok(x.kinds.every((k) => k.label.split(/[–=≡]/).every((e) => els.has(e))), `${p.formula}: связи внутри ${x.of} — из его элементов (${x.kinds.map((k) => k.label)})`)
  }
}
const nh4so4 = ref('salt_nh4_so4') ? formationTexts(ref('salt_nh4_so4')!, 'ru', OBTAINING.ru).steps[3].main : ''
ok(/внутри NH₄⁺ \(в том числе донорно-акцепторная\) и SO₄²⁻/.test(nh4so4), `(NH₄)₂SO₄ RU — донорно-акцепторная только у NH₄⁺: «${nh4so4}»`)
// Формы — только справочные: модель с другой формой не озвучивается; у полимерных веществ «молекулы» нет.
ok(ref('p2o5')?.shapes[0]?.key === 'p4o10', `P₂O₅ — простейшая формула, молекулы P₄O₁₀ (${ref('p2o5')?.shapes.map((x) => x.key)})`)
ok(!ref('hclo3')?.shapes.some((x) => x.key === 'trigonal-planar'), `HClO₃ — не «плоский треугольник» (${ref('hclo3')?.shapes.map((x) => x.key)})`)
ok(!ref('salt_na_sio3')?.shapes.some((x) => x.of === 'SiO₃²⁻'), 'Na₂SiO₃ — у SiO₃²⁻ отдельной формы нет (цепи SiO₄)')
// V₂O₅: модель каталога 200 — школьная графическая формула O=V(=O)–O–V(=O)=O (V — валентность V): связи перечисляются, O–O нет
ok(ref('tb_v2o5')?.alsoNonpolar === false && ref('tb_v2o5')?.bondsReliable === true, 'V₂O₅ — нет «O–O неполярной», связи V=O ×4 и V–O ×2 по графической формуле')
ok(ref('h2o2')?.alsoNonpolar === true, 'H₂O₂ — O–O неполярная')
const polyShapes: Record<string, string> = { 'SO₄²⁻': 'tetrahedral', 'SO₃²⁻': 'trigonal-pyramidal', 'NO₃⁻': 'trigonal-planar', 'CO₃²⁻': 'trigonal-planar', 'PO₄³⁻': 'tetrahedral', 'NH₄⁺': 'tetrahedral', 'ClO₃⁻': 'trigonal-pyramidal', 'NO₂⁻': 'angular' }
for (const p of plans.values()) for (const sh of p.shapes) if (polyShapes[sh.of]) ok(sh.key === polyShapes[sh.of], `${p.formula}: ${sh.of} — ${polyShapes[sh.of]} (${sh.key})`)

// «От и до» (formationStory): итог = модель карточки, уравнение образования уравнено, этапы не короче нормы.
for (const id of CATALOG_TOP200_IDS) {
  const c = compoundById[id]
  const p = plans.get(id)
  if (!c || !p) continue
  const f = c.formulaUnicode
  const model = buildSchoolHeroModel(c)
  const story = formationStoryFor(id)
  ok(!!story === !!model, `${f}: сценарий «от и до» строится вместе с моделью`)
  if (!story || !model) continue
  const q: [number, number, number] = [0, 0, 0]
  let dev = 0
  for (let i = 0; i < model.atoms.length; i++) {
    atomPosAt(story, i, story.total + 0.01, q)
    const m = model.atoms[i]!.pos
    dev = Math.max(dev, Math.hypot(q[0] - m[0], q[1] - m[1], q[2] - m[2]))
  }
  ok(dev < 1e-6, `${f}: в конце показа атомы — ровно на местах модели карточки (отклонение ${dev})`)
  const sticks = new Map<number, number>()
  for (const s of story.sticks) sticks.set(s.bond, (sticks.get(s.bond) ?? 0) + 1)
  ok(model.bonds.every((b, k) => (sticks.get(k) ?? 0) === Math.max(1, Math.min(3, Math.round(b.order)))), `${f}: палочки в конце показа — все связи модели с их кратностью`)
  // wf20: темп по правилам (раздел 2) — каждый e⁻ и каждая общая пара по одной, этап «Путь получения» — показ 30–60 с.
  ok(story.total >= 30 && story.total <= 60, `${f}: показ ${story.total.toFixed(1)} с (30–60 с)`)
  for (const st of story.stages) {
    ok(st.dur >= 2.5, `${f}: этап ${st.key} — не короче 2,5 с (${st.dur.toFixed(1)})`)
    if (['transfer', 'pairs', 'bonds', 'inner'].includes(st.key)) ok(st.dur >= 4, `${f}: этап ${st.key} (e⁻ / связи) — не короче 4 с (${st.dur.toFixed(1)})`)
  }
  ok(story.stages[0]?.key === 'reagents' && story.stages[story.stages.length - 1]?.key === 'final', `${f}: от исходных веществ до итоговой модели`)
  if (p.mode === 'ionic') ok(story.stages.some((s) => s.key === 'transfer') && story.transferred > 0, `${f}: ионное — показан переход e⁻ (${story.transferred})`)
  else ok(story.stages.some((s) => s.key === 'pairs') && story.sharedPairs > 0, `${f}: ковалентное — показаны общие пары (${story.sharedPairs})`)
  const eq = formationEquation(id)
  ok(!!eq && !!(eq.direct || eq.lab), `${f}: есть уравнение образования`)
  for (const e of [eq?.direct, eq?.lab]) {
    if (!e) continue
    ok(isBalanced(e), `${f}: уравнение уравнено — ${e}`)
    ok(!!equationSides(e)?.right.some(([, x]) => x === f), `${f}: справа — само вещество (${e})`)
  }
  for (const loc of ['ru', 'en', 'uz'] as const) {
    const t = formationStageTexts(p, story, eq, loc, OBTAINING[loc])
    const all = [...t.stages.flatMap((s) => [s.title, s.main, s.sub]), t.equation.lead, t.equation.text, ...Object.values(t.ui)]
    ok(t.stages.length === story.stages.length && all.every((s) => typeof s === 'string' && s.trim().length > 0 && !/undefined|NaN(?!O)|null|\[object/.test(s)), `${f} [${loc}]: подписи этапов без пустот (NaNO₃ — формула, не NaN)`)
    if (loc !== 'ru') ok(!/[А-Яа-яЁё]/.test(all.join('')), `${f} [${loc}]: подписи этапов без кириллицы`)
  }
}
const eqOf = (id: string) => formationEquation(id)
ok(eqOf('nacl')?.direct === '2Na + Cl₂ → 2NaCl', `NaCl: 2Na + Cl₂ → 2NaCl (${eqOf('nacl')?.direct})`)
ok(eqOf('h2o')?.direct === '2H₂ + O₂ → 2H₂O', `H₂O: 2H₂ + O₂ → 2H₂O (${eqOf('h2o')?.direct})`)
ok(eqOf('nh3')?.direct === 'N₂ + 3H₂ ⇄ 2NH₃', `NH₃: N₂ + 3H₂ ⇄ 2NH₃ (${eqOf('nh3')?.direct})`)
ok(!eqOf('h2so4')?.direct && eqOf('h2so4')?.lab === 'SO₃ + H₂O → H₂SO₄', `H₂SO₄: из простых не получают; SO₃ + H₂O → H₂SO₄ (${eqOf('h2so4')?.lab})`)
ok(!eqOf('salt_ca_co3')?.direct && /CaO \+ CO₂ → CaCO₃/.test(eqOf('salt_ca_co3')?.lab ?? ''), `CaCO₃: CaO + CO₂ → CaCO₃ (${eqOf('salt_ca_co3')?.lab})`)
ok(!eqOf('no2')?.direct && !eqOf('so3')?.direct && !eqOf('salt_fe2_cl')?.direct, 'NO₂, SO₃, FeCl₂ — не из простых веществ напрямую')
const naclStory = formationStoryFor('salt_na_so4')
ok(naclStory?.transferred === 2, `Na₂SO₄: переходят 2 e⁻ (${naclStory?.transferred})`)
const h2oStory = formationStoryFor('h2o')
ok(h2oStory?.sharedPairs === 2 && h2oStory.reagentSticks.length === 3, `H₂O: 2 общие пары; H–H и O=O у исходных (${h2oStory?.sharedPairs}, ${h2oStory?.reagentSticks.length})`)
const n2Story = formationStoryFor('nh3')
ok(n2Story?.reagentSticks.filter((s) => s.n === 3).length === 3, 'NH₃: у N₂ — тройная связь N≡N (3 палочки)')

if (warnings.length) {
  console.log(`Предупреждения по моделям (${warnings.length}) — модели ведёт schoolHeroModel / геометрия каталога:`)
  for (const w of warnings) console.log(`  ! ${w}`)
}
console.log(`test-formation-plan: ${checks - fails}/${checks} проверок, веществ ${plans.size}/${CATALOG_TOP200_IDS.length}`)
if (fails > 0) process.exit(1)
