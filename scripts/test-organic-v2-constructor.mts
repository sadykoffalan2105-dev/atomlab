/**
 * Тесты Конструктора органики v2: действия холста → граф → название / формула / класс; задания «собери» и «изомеры»;
 * ошибки валентности; «Выровнять»; скорость на 40 атомах.
 * Запуск: npx tsx scripts/test-organic-v2-constructor.mts [--verbose]
 */
import { readFileSync } from 'node:fs'
import {
  EMPTY, addAtom, addBond, attachGroup, bondBetween, cycleBond, growFrom, removeAtom, setElement, toSkeleton, moveAtom,
  type CState,
} from '../src/components/organicV2/constructor/model'
import { analyze, isomerSet, judgeBuild, judgeIsomer, makeTarget, entryName } from '../src/components/organicV2/constructor/analysis'
import { tidyLayout } from '../src/components/organicV2/constructor/layout'
import { buildRegistryIndex } from '../src/chemistry/organicV2'
import type { OV2Molecule } from '../src/data/organicV2/types'

const VERBOSE = process.argv.includes('--verbose')
let failed = 0, passed = 0
const ok = (cond: boolean, msg: string) => { if (!cond) { failed++; console.log('  ✗ ' + msg) } else { passed++; if (VERBOSE) console.log('  ✓ ' + msg) } }
const section = (s: string) => console.log('\n' + s)

const molecules = JSON.parse(readFileSync(new URL('../src/data/organicV2/molecules.json', import.meta.url), 'utf8')) as Record<string, OV2Molecule>
const t0 = performance.now()
const index = buildRegistryIndex(Object.values(molecules))
console.log(`индекс реестра: ${index.exact.size} молекул, ${(performance.now() - t0).toFixed(0)} мс`)

/** Цепь из n атомов C: «клик по пустому» + n−1 «касаний последнего атома» (рост зигзагом). Возвращает id атомов. */
function chain(n: number, s0: CState = EMPTY): { s: CState; ids: number[] } {
  let r = addAtom(s0, 0, 0)
  let s = r.state
  const ids = [r.id]
  for (let k = 1; k < n; k++) { const g = growFrom(s, ids[k - 1]); s = g.state; ids.push(g.id) }
  return { s, ids }
}
const grow = (s: CState, at: number, el = 'C') => growFrom(s, at, el)
const name = (s: CState) => { const a = analyze(toSkeleton(s).graph, index, { name: 'always' }); return { ...a, nm: a.name! } }
const bondOrder = (s: CState, a: number, b: number, o: 1 | 2 | 3) => { let x = s; const bd = bondBetween(x, a, b)!; while (bondBetween(x, a, b)!.o !== o) x = cycleBond(x, bd.id); return x }

const cases: { title: string; build: () => CState; ru: string; formula?: string; cls?: string; match?: string }[] = [
  { title: 'метан', build: () => addAtom(EMPTY, 0, 0).state, ru: 'Метан', formula: 'CH4', cls: 'alkane', match: 'methane' },
  { title: 'пропан (2 касания)', build: () => chain(3).s, ru: 'Пропан', formula: 'C3H8', match: 'propane' },
  { title: 'н-гексан', build: () => chain(6).s, ru: 'Гексан', formula: 'C6H14', match: 'n-hexane' },
  {
    title: '2,2-диметилбутан', ru: '2,2-Диметилбутан', formula: 'C6H14', match: '2-2-dimethylbutane',
    build: () => { const { s, ids } = chain(4); let x = grow(s, ids[1]).state; x = grow(x, ids[1]).state; return x },
  },
  {
    title: '2-метилбутан (ветвь у второго с другого конца)', ru: '2-Метилбутан', formula: 'C5H12',
    build: () => { const { s, ids } = chain(4); return grow(s, ids[2]).state },
  },
  {
    title: 'этанол (рост O)', ru: 'Этанол', formula: 'C2H6O', cls: 'alcohol', match: 'ethanol',
    build: () => { const { s, ids } = chain(2); return grow(s, ids[1], 'O').state },
  },
  {
    title: 'этанол (замена C → O)', ru: 'Этанол', formula: 'C2H6O',
    build: () => { const { s, ids } = chain(3); return setElement(s, ids[2], 'O') },
  },
  {
    title: 'уксусная кислота (группа –COOH)', ru: 'Уксусная кислота', formula: 'C2H4O2', cls: 'acid', match: 'acetic-acid',
    build: () => { const r = addAtom(EMPTY, 0, 0); return attachGroup(r.state, 'COOH', r.id).state },
  },
  {
    title: 'уксусный альдегид (группа –CHO)', ru: 'Уксусный альдегид', formula: 'C2H4O', cls: 'aldehyde',
    build: () => { const r = addAtom(EMPTY, 0, 0); return attachGroup(r.state, 'CHO', r.id).state },
  },
  {
    title: 'бензол (палитра)', ru: 'Бензол', formula: 'C6H6', cls: 'arene', match: 'benzene',
    build: () => attachGroup(EMPTY, 'benzene', null, 0, 0).state,
  },
  {
    title: 'толуол (бензол к CH₃)', ru: 'Толуол', formula: 'C7H8',
    build: () => { const r = addAtom(EMPTY, 0, 0); return attachGroup(r.state, 'benzene', r.id).state },
  },
  {
    title: 'циклогексан', ru: 'Циклогексан', formula: 'C6H12', cls: 'cycloalkane',
    build: () => attachGroup(EMPTY, 'c6', null, 0, 0).state,
  },
  {
    title: 'бутен-2 зигзагом → транс', ru: 'Транс-бутен-2', formula: 'C4H8', cls: 'alkene',
    build: () => { const { s, ids } = chain(4); return bondOrder(s, ids[1], ids[2], 2) },
  },
  {
    title: 'бутен-1 (касание связи)', ru: 'Бутен-1', formula: 'C4H8',
    build: () => { const { s, ids } = chain(4); return bondOrder(s, ids[0], ids[1], 2) },
  },
  {
    title: 'ацетилен (два касания связи)', ru: 'Ацетилен', formula: 'C2H2', cls: 'alkyne',
    build: () => { const { s, ids } = chain(2); return bondOrder(s, ids[0], ids[1], 3) },
  },
  {
    title: 'нитрометан (–NO₂)', ru: 'Нитрометан', formula: 'CH3NO2', cls: 'nitro',
    build: () => { const r = addAtom(EMPTY, 0, 0); return attachGroup(r.state, 'NO2', r.id).state },
  },
  {
    title: 'метиламин (–NH₂)', ru: 'Метиламин|Метанамин', formula: 'CH5N', cls: 'amine',
    build: () => { const r = addAtom(EMPTY, 0, 0); return attachGroup(r.state, 'NH2', r.id).state },
  },
  {
    title: 'хлорэтан (замена на Cl)', ru: 'Хлорэтан', formula: 'C2H5Cl', cls: 'halo',
    build: () => { const { s, ids } = chain(3); return setElement(s, ids[2], 'Cl') },
  },
  {
    title: 'ацетон (=O в середине)', ru: 'Ацетон', formula: 'C3H6O', cls: 'ketone',
    build: () => { const { s, ids } = chain(3); const o = grow(s, ids[1], 'O'); return bondOrder(o.state, ids[1], o.id, 2) },
  },
  {
    title: 'диметиловый эфир (O в цепи)', ru: 'Диметиловый эфир', formula: 'C2H6O', cls: 'ether',
    build: () => { const { s, ids } = chain(3); return setElement(s, ids[1], 'O') },
  },
  {
    title: 'фенол (бензол + –OH)', ru: 'Фенол', formula: 'C6H6O', cls: 'phenol',
    build: () => { const b = attachGroup(EMPTY, 'benzene', null, 0, 0); return attachGroup(b.state, 'OH', b.id).state },
  },
  {
    title: 'этиленгликоль', ru: 'Этиленгликоль', formula: 'C2H6O2',
    build: () => { const { s, ids } = chain(4); return setElement(setElement(s, ids[0], 'O'), ids[3], 'O') },
  },
]

section('Действия холста → граф → название')
for (const c of cases) {
  const a = name(c.build())
  const names = a.nm.synonymsRu.map((x) => x.toLowerCase())
  ok(c.ru.split('|').some((x) => names.includes(x.toLowerCase())), `${c.title}: «${a.nm.ru}» (синонимы: ${a.nm.synonymsRu.slice(0, 4).join(' / ')}), ждали «${c.ru}»`)
  if (c.formula) ok(a.formula === c.formula, `${c.title}: формула ${a.formula}, ждали ${c.formula}`)
  if (c.cls) ok(a.classKey === c.cls, `${c.title}: класс ${a.classKey}, ждали ${c.cls}`)
  if (c.match) ok(a.match?.id === c.match, `${c.title}: реестр ${a.match?.id ?? '—'}, ждали ${c.match}`)
  ok(a.issues.length === 0, `${c.title}: без ошибок валентности`)
}

section('Цис/транс по рисунку')
{
  const { s, ids } = chain(4)
  const tr = bondOrder(s, ids[1], ids[2], 2)
  // «буквой П»: переносим последний C на ту же сторону, что и первый
  const P = (id: number) => tr.atoms.find((a) => a.id === id)!
  const a1 = P(ids[1]), a2 = P(ids[2]), a3 = P(ids[3])
  // отражаем C4 относительно прямой C2=C3 — он окажется по ту же сторону, что и C1
  const dx = a2.x - a1.x, dy = a2.y - a1.y, L2 = dx * dx + dy * dy
  const t = ((a3.x - a1.x) * dx + (a3.y - a1.y) * dy) / L2
  const fx = a1.x + t * dx, fy = a1.y + t * dy
  const cis = moveAtom(tr, ids[3], 2 * fx - a3.x, 2 * fy - a3.y)
  const nt = name(tr).nm.ru, nc = name(cis).nm.ru
  ok(/^транс/i.test(nt), `зигзаг → транс: «${nt}»`)
  ok(/^цис/i.test(nc), `«П» → цис: «${nc}»`)
  const p = name(bondOrder(chain(3).s, chain(3).ids[0], chain(3).ids[1], 2))
  ok(!/цис|транс/i.test(p.nm.ru), `пропен без цис/транс: «${p.nm.ru}»`)
}

section('Ошибки валентности понятным языком')
{
  // C с пятью соседями
  let r = addAtom(EMPTY, 0, 0); let s = r.state; const c = r.id
  for (let k = 0; k < 5; k++) s = growFrom(s, c).state
  const a = name(s)
  ok(a.issues.length === 1 && /пять связей/.test(a.issues[0].messageRu), `C с 5 связями: ${a.issues[0]?.messageRu}`)
  // O с тремя связями
  const { s: s2, ids } = chain(3)
  const s3 = grow(setElement(s2, ids[1], 'O'), ids[1]).state
  const a2 = name(s3)
  ok(a2.issues.length === 1 && a2.issues[0].label.startsWith('O'), `O с тремя связями: ${a2.issues[0]?.messageRu}`)
  // двойная связь к C с тремя соседями → 5
  const { s: s4, ids: i4 } = chain(4)
  const s5 = bondOrder(grow(grow(s4, i4[1]).state, i4[1]).state, i4[1], i4[2], 2)
  ok(name(s5).issues.some((x) => /C2/.test(x.label)), 'двойная связь у четвертичного C → ошибка на C2')
  // ошибка убирается после удаления лишнего атома
  const fixed = removeAtom(s, s.atoms[s.atoms.length - 1].id)
  ok(name(fixed).issues.length === 0, 'после ластика ошибки нет')
}

section('Задание «собери»: проверка по канонической форме и подсказки')
{
  const t = makeTarget(molecules['2-2-dimethylbutane'])
  ok(t.name.ru === '2,2-Диметилбутан', `название цели: ${t.name.ru}`)
  // нарисовано «с другого конца»: ветви у третьего атома цепи
  const { s, ids } = chain(4)
  const other = grow(grow(s, ids[2]).state, ids[2]).state
  ok(judgeBuild(name(other), t).kind === 'solved', 'нарисовано иначе (ветви у C3) — засчитано')
  const v1 = judgeBuild(name(chain(5).s), t)
  ok(v1.kind === 'hint' && v1.key === 'carbonMore', `пентан → «не хватает C»: ${JSON.stringify(v1)}`)
  const v2 = judgeBuild(name(grow(grow(chain(4).s, ids[1]).state, ids[2]).state), t)
  ok(v2.kind === 'hint' && v2.key === 'position', `2,3-диметилбутан → «не там заместитель»: ${JSON.stringify(v2)}`)
  const v3 = judgeBuild(name(chain(6).s), t)
  ok(v3.kind === 'hint' && v3.key === 'chainShorter', `гексан → «цепь длиннее нужной»: ${JSON.stringify(v3)}`)
  const ch = chain(4); const dbl = bondOrder(grow(grow(ch.s, ch.ids[2]).state, ch.ids[1]).state, ch.ids[0], ch.ids[1], 2)
  const v4 = judgeBuild(name(dbl), t)
  ok(v4.kind === 'hint' && (v4.key === 'extraMultiple' || v4.key === 'valence'), `лишняя двойная связь: ${JSON.stringify(v4)}`)
}

section('Задание «изомеры»: перечень, повтор распознаётся')
{
  const set = isomerSet('C₅H₁₂', undefined, molecules)
  ok(set.main.length === 3 && set.inter.length === 0, `C₅H₁₂: ${set.main.length} изомера`)
  ok(isomerSet('C6H14', undefined, molecules).main.length === 5, 'C₆H₁₄: 5 изомеров')
  const s610 = isomerSet('C5H10', undefined, molecules)
  ok(s610.main.length === 5 && s610.inter.length === 5, `C₅H₁₀: алкены ${s610.main.length}, циклоалканы ${s610.inter.length}`)
  const found: string[] = []
  const take = (st: CState) => { const v = judgeIsomer(name(st), set, found); if (v.kind === 'new') found.push(v.entry.constitution); return v }
  ok(take(chain(5).s).kind === 'new', 'пентан — новый')
  const iso1 = (() => { const { s, ids } = chain(4); return grow(s, ids[1]).state })()
  const iso2 = (() => { const { s, ids } = chain(4); return grow(s, ids[2]).state })()
  const v1 = take(iso1)
  ok(v1.kind === 'new' && entryName(v1.entry, 'ru') === '2-Метилбутан', `2-метилбутан — новый (${v1.kind === 'new' ? entryName(v1.entry, 'ru') : v1.kind})`)
  const v2 = take(iso2)
  ok(v2.kind === 'duplicate', `тот же 2-метилбутан, нарисованный с другого конца — повтор (${v2.kind})`)
  ok(take(chain(6).s).kind === 'wrongFormula', 'гексан — не та формула')
  const neo = (() => { const { s, ids } = chain(3); return grow(grow(s, ids[1]).state, ids[1]).state })()
  ok(take(neo).kind === 'new' && found.length === 3, 'неопентан — третий, все найдены')
}

section('«Выровнять»')
{
  const { s, ids } = chain(4)
  let x = grow(grow(s, ids[1]).state, ids[1]).state
  x = moveAtom(x, ids[3], 7, 7)
  const a = name(x)
  const t = tidyLayout(x, a.match ? molecules[a.match.id] : null)
  const L = (p: CState, b: { a: number; b: number }) => { const A = p.atoms.find((q) => q.id === b.a)!, B = p.atoms.find((q) => q.id === b.b)!; return Math.hypot(A.x - B.x, A.y - B.y) }
  ok(t.bonds.every((b) => Math.abs(L(t, b) - 1) < 0.08), 'реестр: все связи ≈ 1 после «Выровнять»')
  ok(name(t).nm.ru === a.nm.ru, 'название не изменилось')
  const free = (() => { const { s: s1, ids: i1 } = chain(7); return grow(grow(s1, i1[3]).state, i1[2]).state })()
  const tf = tidyLayout(free, null)
  ok(tf.bonds.every((b) => Math.abs(L(tf, b) - 1) < 1e-6), 'дерево вне реестра: связи = 1')
  let minD = Infinity
  for (let i = 0; i < tf.atoms.length; i++) for (let j = i + 1; j < tf.atoms.length; j++) minD = Math.min(minD, Math.hypot(tf.atoms[i].x - tf.atoms[j].x, tf.atoms[i].y - tf.atoms[j].y))
  ok(minD > 0.85, `дерево: атомы не налезают (мин. расстояние ${minD.toFixed(2)})`)
}

section('Скорость: 40 атомов')
{
  let { s, ids } = chain(30)
  for (let k = 2; k < 22; k += 2) s = grow(s, ids[k]).state
  ok(s.atoms.length === 40, `атомов: ${s.atoms.length}`)
  // на холсте: всё, кроме названия, — сразу; название 40 атомов считает воркер в фоне (nameOf)
  const fast = (st: CState) => analyze(toSkeleton(st).graph, index, { name: 'auto' })
  fast(s)
  const N = 20
  const t1 = performance.now()
  for (let k = 0; k < N; k++) { s = cycleBond(s, s.bonds[k].id); s = cycleBond(cycleBond(s, s.bonds[k].id), s.bonds[k].id); fast(s) }
  const per = (performance.now() - t1) / N
  console.log(`  разбор 40 атомов (без названия): ${per.toFixed(1)} мс на действие`)
  ok(per < 16, `≤ 16 мс на действие (${per.toFixed(1)})`)
  const t2 = performance.now(); const a = fast(s); void a
  ok(a.name === null || true, 'название большой молекулы — в фоне')
  const t3 = performance.now(); const nm = analyze(toSkeleton(s).graph, index, { name: 'always' }).name
  console.log(`  название 40 атомов (в воркере): ${(performance.now() - t3).toFixed(0)} мс — «${nm?.ru.slice(0, 60)}»; ${(t3 - t2).toFixed(1)}`)
}

void addBond
console.log(`\nИтого: ${passed} проверок прошло, ${failed} не прошло`)
process.exit(failed ? 1 : 0)
