/**
 * Тесты движка Конструктора органики v2 (src/chemistry/organicV2).
 * Запуск: npx tsx scripts/test-organic-v2-engine.mts [--verbose]
 *
 * Оракул намера — реестр ORGANIC_MOLECULES (nameRu). 3D сравнивается с координатами RDKit:
 * src/data/organicV2/molecules.json, а если его ещё нет — .tmp/organic-v2/molecules-v0.json (иначе раздел пропускается).
 */
import { existsSync, readFileSync } from 'node:fs'
import { ORGANIC_MOLECULES } from '../src/data/organicLab/organicMoleculeRegistry'
import {
  type SkeletonGraph, type Mol, type Vec3,
  nameSkeleton, canonicalCode, canonicalizeMol, parseSmiles, toSmiles, hillFormula, perceiveCisTrans, checkValence, toMol,
  sameMolecule, sameConstitution, classifyMolecule, semiStructuralFormula, carbonDegrees,
  alkaneIsomers, alkeneIsomers, alcoholEtherIsomers, checkIsomerAnswers,
  embed3D, geometryDeviation, alignedRmsd, buildRegistryIndex, matchRegistry,
} from '../src/chemistry/organicV2'

const VERBOSE = process.argv.includes('--verbose')
let failed = 0
const ok = (cond: boolean, msg: string) => { if (!cond) { failed++; console.log('  ✗ ' + msg) } else if (VERBOSE) console.log('  ✓ ' + msg) }
const section = (s: string) => console.log('\n' + s)

/** Граф реестра (с явными H) → SkeletonGraph. Цис/транс берётся из 3D реестра, только если он назван в nameRu. */
function registryToSkeleton(m: (typeof ORGANIC_MOLECULES)[number]): SkeletonGraph {
  const idx = new Map(m.graph.atoms.map((a, i) => [a.id, i]))
  const g: SkeletonGraph = {
    atoms: m.graph.atoms.map((a) => (a.element === 'H' ? { el: 'H' } : { el: a.element, h: 0 })),
    bonds: m.graph.bonds.map((b) => ({ a: idx.get(b.a)!, b: idx.get(b.b)!, o: Math.round(b.order) as 1 | 2 | 3 })),
  }
  return /цис|транс/i.test(m.nameRu) ? perceiveCisTrans(g, m.graph.atoms.map((a) => a.pos)) : g
}

/** Перестановка атомов скелета (та же молекула, другая «рисовка»). */
function permute(g: SkeletonGraph, seed: number): SkeletonGraph {
  const n = g.atoms.length
  const order = [...Array(n).keys()]
  let s = seed
  for (let i = n - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [order[i], order[j]] = [order[j], order[i]] }
  const inv = new Array(n); order.forEach((o, i) => { inv[o] = i })
  return { atoms: order.map((o) => g.atoms[o]), bonds: g.bonds.map((b) => ({ ...b, a: inv[b.a], b: inv[b.b], ...(b.ref ? { ref: [inv[b.ref[0]], inv[b.ref[1]]] as const } : {}) })).reverse() }
}

/** Явные H у всех атомов (ещё одна «рисовка»). */
function explicitH(g: SkeletonGraph): SkeletonGraph {
  const m = toMol(g)
  const atoms = m.src.map((i) => ({ ...g.atoms[i], h: 0 }))
  const remap = new Map(m.src.map((s, i) => [s, i]))
  const bonds = g.bonds.filter((b) => remap.has(b.a) && remap.has(b.b)).map((b) => ({ ...b, a: remap.get(b.a)!, b: remap.get(b.b)!, ...(b.ref ? { ref: [remap.get(b.ref[0])!, remap.get(b.ref[1])!] as const } : {}) }))
  m.hc.forEach((k, i) => { for (let j = 0; j < k; j++) { atoms.push({ el: 'H', h: 0 }); bonds.push({ a: i, b: atoms.length - 1, o: 1 }) } })
  return { atoms, bonds }
}

// ───────── валентность ─────────
section('Валентность и автодобавление H')
{
  const bad: SkeletonGraph = { atoms: [{ el: 'C' }, { el: 'C' }, { el: 'C' }, { el: 'C' }, { el: 'C' }, { el: 'C' }], bonds: [1, 2, 3, 4, 5].map((k) => ({ a: 0, b: k, o: 1 as const })) }
  const iss = checkValence(bad)
  ok(iss.length === 1 && iss[0].label === 'C1' && /пять связей/.test(iss[0].messageRu) && /уберите одну/.test(iss[0].messageRu), `пятивалентный C: «${iss[0]?.messageRu}»`)
  ok(checkValence(parseSmiles('CC(C)(C)C')).length === 0, 'неопентан — без ошибок')
  ok(checkValence({ atoms: [{ el: 'O' }, { el: 'C' }, { el: 'C' }], bonds: [{ a: 0, b: 1, o: 2 }, { a: 0, b: 2, o: 1 }] }).length === 1, 'O с тремя связями — ошибка')
  ok(hillFormula(parseSmiles('CC')) === 'C2H6' && hillFormula(parseSmiles('C=O')) === 'CH2O' && hillFormula(parseSmiles('CC#N')) === 'C2H3N', 'H по валентности: C2H6, CH2O, C2H3N')
  ok(canonicalCode(parseSmiles('CN(=O)=O')) === canonicalCode(parseSmiles('C[N+](=O)[O-]')) && checkValence(parseSmiles('CN(=O)=O')).length === 0, 'школьная нитрогруппа N(=O)=O ≡ [N+](=O)[O-]')
  ok(hillFormula(parseSmiles('CCO[N+](=O)[O-]')) === 'C2H5NO3', 'этилнитрат C2H5NO3')
}

// ───────── канонизация ─────────
section('Канонизация: одна молекула — один код')
{
  const sets = ['CC(C)CC(C)(C)C', 'OCC(O)CO', 'CC(=O)OCC', 'Cc1ccccc1C', 'C/C=C/C', 'C/C=C\\CC', 'CC(C)=CC(Cl)Br', 'OC(=O)c1ccccc1O', 'C1CCC(CC1)C(C)C', 'CCCCCCCCCCCCCCCC(=O)OCC(COC(=O)CCCCCCCCCCCCCCC)OC(=O)CCCCCCCCCCCCCCC']
  for (const s of sets) {
    const g = parseSmiles(s)
    const c0 = canonicalCode(g)
    const drawings = [permute(g, 1), permute(g, 7), explicitH(permute(g, 3)), parseSmiles(toSmiles(permute(g, 11))), permute(explicitH(g), 5)]
    const codes = drawings.map((d) => canonicalCode(d))
    ok(codes.every((c) => c === c0), `${s}: 5 рисовок → один код ${c0}${codes.every((c) => c === c0) ? '' : ' ≠ ' + codes.join(' | ')}`)
  }
  ok(canonicalCode(parseSmiles('CC1=CC=CC=C1C')) === canonicalCode(parseSmiles('CC1=C(C)C=CC=C1')), 'о-ксилол: две формы Кекуле → один код')
  const hex = ['CCCCCC', 'CCCC(C)C', 'CCC(C)CC', 'CC(C)C(C)C', 'CCC(C)(C)C'].map((s) => canonicalCode(parseSmiles(s)))
  ok(new Set(hex).size === 5, '5 изомеров гексана → 5 разных кодов')
  ok(!sameMolecule(parseSmiles('C/C=C/C'), parseSmiles('C/C=C\\C')) && sameConstitution(parseSmiles('C/C=C/C'), parseSmiles('C/C=C\\C')), 'цис- и транс-бутен-2: разные молекулы, один структурный граф')
  ok(canonicalCode(parseSmiles('C/C=C(/C)C')) === canonicalCode(parseSmiles('CC=C(C)C')), 'у 2-метилбутена-2 цис/транс нет — метка отбрасывается')
  ok(canonicalCode(parseSmiles('C(C)/C=C/C')) === canonicalCode(parseSmiles('CC/C=C/C')) && canonicalCode(parseSmiles('CC/C=C/C')) !== canonicalCode(parseSmiles('CC/C=C\\C')), 'пентен-2: транс в разных записях совпадает, цис ≠ транс')
}

// ───────── SMILES туда-обратно ─────────
section('SMILES туда-обратно (реестр)')
{
  let n = 0, good = 0
  const bad: string[] = []
  for (const m of ORGANIC_MOLECULES) {
    const g = registryToSkeleton(m)
    const c = canonicalCode(g)
    const s = toSmiles(g)
    n++
    let back = ''
    try { back = canonicalCode(parseSmiles(s)) } catch (e) { back = String(e) }
    // канонический SMILES тоже должен читаться и давать тот же код
    let back2 = ''
    try { back2 = canonicalCode(parseSmiles(c)) } catch (e) { back2 = String(e) }
    if (back === c && back2 === c) good++
    else bad.push(`${m.id}: ${s} → ${back} ≠ ${c}`)
  }
  console.log(`  ${good}/${n} молекул реестра: SMILES → граф → тот же код`)
  for (const b of bad.slice(0, 10)) console.log('   · ' + b)
  ok(good === n, 'SMILES туда-обратно без потерь')
  ok(hillFormula(parseSmiles('c1ccc2ccccc2c1')) === 'C10H8' && hillFormula(parseSmiles('[nH]1cccc1')) === 'C4H5N', 'ароматика → Кекуле: нафталин C10H8, пиррол C4H5N')
}

// ───────── намер против реестра ─────────
const norm = (s: string) => s.replace(/[CНHNOS][₀-₉A-Za-z]*[₀-₉][₀-₉A-Za-z]*/g, '').toLowerCase().replace(/ё/g, 'е').replace(/[\s‑–—-]+/g, '-').replace(/[«»"]/g, '').replace(/^-+|-+$/g, '')
section('Намер ИЮПАК против реестра (nameRu)')
{
  const CLASSES = new Set(['alkane', 'cycloalkane', 'alkene', 'alkyne', 'alkadiene', 'halo', 'alcohol', 'aldehyde', 'ketone', 'acid', 'ester', 'ether', 'arene'])
  let total = 0, hit = 0
  const miss: string[] = []
  const t0 = performance.now()
  for (const m of ORGANIC_MOLECULES) {
    if (!CLASSES.has(m.classId)) continue
    total++
    const g = registryToSkeleton(m)
    const nm = nameSkeleton(g)
    const regVariants = [m.nameRu, ...m.nameRu.split(/[()]/).map((s) => s.trim()).filter(Boolean)].map(norm)
    const mine = nm.synonymsRu.map(norm)
    if (regVariants.some((r) => mine.includes(r))) hit++
    else miss.push(`${m.id} [${m.classId}] реестр «${m.nameRu}» ↔ движок «${nm.synonymsRu.slice(0, 4).join(' | ')}»`)
    ok(!!nm.en && !!nm.uz, `${m.id}: есть EN и UZ`)
  }
  const pct = (100 * hit) / total
  console.log(`  совпало ${hit}/${total} = ${pct.toFixed(1)} % (${(performance.now() - t0).toFixed(0)} мс)`)
  for (const s of miss) console.log('   · ' + s)
  ok(pct >= 90, `намер ≥ 90 % (${pct.toFixed(1)} %)`)
  // все классы реестра: сколько назвали хоть как-то
  let named = 0
  for (const m of ORGANIC_MOLECULES) if (nameSkeleton(registryToSkeleton(m)).ru) named++
  console.log(`  название есть у ${named}/${ORGANIC_MOLECULES.length} молекул реестра (все классы)`)
  const cases: [string, string][] = [
    ['CC(C)CC(C)(C)C', '2,2,4-Триметилпентан'], ['CC=C(C)C', '2-Метилбутен-2'], ['C/C=C\\C', 'Цис-бутен-2'], ['CC#CC', 'Бутин-2'],
    ['C=CC=C', 'Бутадиен-1,3'], ['CC(O)C', 'Пропанол-2'], ['CCC(C)=O', 'Бутанон'], ['CC(C)C(O)=O', '2-Метилпропановая кислота'],
    ['CCOC(=O)C', 'Этиловый эфир уксусной кислоты'], ['CCOCC', 'Диэтиловый эфир'], ['CC(Cl)CBr', '1-Бром-2-хлорпропан'], ['CCN', 'Этанамин'],
    ['C[N+](=O)[O-]', 'Нитрометан'], ['CCc1ccccc1', 'Этилбензол'], ['Cc1ccc(C)cc1', 'п-Ксилол'], ['OCCO', 'Этиленгликоль'], ['C1CCCC1', 'Циклопентан'],
  ]
  for (const [s, want] of cases) {
    const nm = nameSkeleton(parseSmiles(s))
    ok(nm.synonymsRu.map(norm).includes(norm(want)), `${s} → «${want}» (движок: ${nm.synonymsRu.slice(0, 3).join(' | ')}; EN ${nm.en}; UZ ${nm.uz})`)
  }
}

// ───────── классы, формулы, степень C ─────────
section('Класс вещества, полуструктурная формула, степень углерода')
{
  const map: Record<string, string> = { alkane: 'alkane', cycloalkane: 'cycloalkane', alkene: 'alkene', alkyne: 'alkyne', alkadiene: 'alkadiene', halo: 'halo', alcohol: 'alcohol', aldehyde: 'aldehyde', ketone: 'ketone', acid: 'acid', ester: 'ester', ether: 'ether', arene: 'arene', polyol: 'polyol', phenol: 'phenol' }
  let n = 0, same = 0
  const diff: string[] = []
  for (const m of ORGANIC_MOLECULES) {
    if (!map[m.classId]) continue
    n++
    const c = classifyMolecule(registryToSkeleton(m))
    if (c === map[m.classId] || (m.classId === 'alkene' && c === 'cycloalkene')) same++
    else diff.push(`${m.id}: реестр ${m.classId}, движок ${c}`)
  }
  console.log(`  класс совпал ${same}/${n}`)
  if (VERBOSE) for (const d of diff) console.log('   · ' + d)
  ok(same / n >= 0.85, `класс по группам совпадает с реестром ≥ 85 % (${((100 * same) / n).toFixed(1)} %)`)
  const f: [string, string][] = [['CC(C)C', 'CH₃–CH(CH₃)–CH₃'], ['CCO', 'CH₃–CH₂–OH'], ['CC(O)=O', 'CH₃–COOH'], ['CC(=O)OCC', 'CH₃–COO–CH₂–CH₃'], ['C=CC', 'CH₂=CH–CH₃'], ['C#C', 'CH≡CH'], ['OCC(O)CO', 'HO–CH₂–CH(OH)–CH₂–OH'], ['NCC(O)=O', 'H₂N–CH₂–COOH'], ['ClC(Cl)Cl', 'CHCl₃'], ['Oc1ccccc1', 'C₆H₅–OH'], ['CC(C)(C)CC', 'CH₃–C(CH₃)₂–CH₂–CH₃']]
  for (const [s, want] of f) { const got = semiStructuralFormula(parseSmiles(s)).text; ok(got === want, `${s} → ${want} (движок: ${got})`) }
  ok(carbonDegrees(parseSmiles('CC(C)(C)CC(C)C')).join(',') === '1,4,1,1,2,3,1,1', 'степени C в 2,2,4-триметилпентане: I, IV, I, I, II, III, I, I')
}

// ───────── изомеры ─────────
section('Изомеры')
{
  const want = [1, 1, 1, 2, 3, 5, 9, 18]
  const got = want.map((_, i) => alkaneIsomers(i + 1).length)
  ok(got.join(',') === want.join(','), `алканы C1–C8: ${got.join(', ')}`)
  const c4 = alkeneIsomers(4), c5 = alkeneIsomers(5), c6 = alkeneIsomers(6)
  const cons = (l: { constitution: string }[]) => new Set(l.map((e) => e.constitution)).size
  ok(c4.length === 6 && cons(c4) === 5, `C4H8: 6 с цис/транс, 5 структурных (${c4.length}/${cons(c4)})`)
  ok(c5.length === 11 && cons(c5) === 10, `C5H10: 11 с цис/транс, 10 структурных (${c5.length}/${cons(c5)})`)
  ok(cons(c6) === 25 && c6.filter((e) => e.kind === 'alkene').length === 17, `C6H12: 25 структурных (13 алкенов + 12 циклоалканов), алкенов с цис/транс 17 (${cons(c6)}, ${c6.filter((e) => e.kind === 'alkene').length})`)
  const ae = [2, 3, 4, 5].map((n) => alcoholEtherIsomers(n))
  ok(ae.map((l) => l.length).join(',') === '2,3,7,14' && ae[3].filter((e) => e.kind === 'alcohol').length === 8, `CnH2n+2O, n=2…5: ${ae.map((l) => l.length).join(', ')} (C5: 8 спиртов + 6 эфиров)`)
  // имена изомеров различны
  for (const n of [5, 6, 7]) {
    const names = alkaneIsomers(n).map((e) => nameSkeleton(e.graph).ru)
    ok(new Set(names).size === names.length, `C${n}H${2 * n + 2}: ${names.length} разных названий (${names.join(', ')})`)
  }
  // «это тот же 2-метилбутан, просто повёрнут»
  const exp = alkaneIsomers(5)
  const r = checkIsomerAnswers(exp, [parseSmiles('CCC(C)C'), parseSmiles('CC(C)CC'), parseSmiles('CCCCC'), parseSmiles('CCCC')])
  ok(r.found.length === 2 && r.duplicates.join() === '1' && r.wrong.join() === '3' && r.missing.length === 1, 'проверка ответов: повтор и лишний распознаны, не хватает неопентана')
}

// ───────── сопоставление с реестром ─────────
section('Сопоставление собранного с реестром')
{
  const index = buildRegistryIndex(ORGANIC_MOLECULES.map((m) => ({ id: m.id, smiles: toSmiles(registryToSkeleton(m)) })))
  let self = 0
  for (const m of ORGANIC_MOLECULES) { const r = matchRegistry(registryToSkeleton(m), index); if (r && (r.id === m.id || index.exact.get(canonicalCode(registryToSkeleton(m))) === r.id)) self++ }
  ok(self === ORGANIC_MOLECULES.length, `все ${ORGANIC_MOLECULES.length} молекул реестра находят себя (${self})`)
  console.log(`  уникальных структур в реестре: ${index.exact.size} из ${ORGANIC_MOLECULES.length}`)
  ok(matchRegistry(parseSmiles('CC(C)C'), index)?.id === 'isobutane', 'нарисованный CH₃–CH(CH₃)–CH₃ → isobutane')
  ok(matchRegistry(parseSmiles('CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'), index) === null, 'чего нет в реестре → null (тогда embed3D)')
}

// ───────── 3D ─────────
section('3D собранного: качество и скорость')
{
  // геометрия на всех молекулах реестра
  let n = 0, goodB = 0, goodA = 0
  const badGeo: string[] = []
  for (const m of ORGANIC_MOLECULES) {
    const g = registryToSkeleton(m)
    const e = embed3D(g)
    const d = geometryDeviation(e)
    n++
    if (d.maxBond <= 0.03) goodB++
    if (d.maxAngle <= 5) goodA++
    if (d.maxBond > 0.03 || d.maxAngle > 5) badGeo.push(`${m.id} ${d.maxBond.toFixed(3)} Å ${d.maxAngle.toFixed(1)}°`)
  }
  console.log(`  длины ±0,03 Å: ${goodB}/${n}; углы ±5°: ${goodA}/${n}`)
  for (const b of badGeo) console.log('   · ' + b)
  ok(goodB / n >= 0.93 && goodA / n >= 0.93, 'геометрия ≥ 93 % молекул реестра в допуске')
  // сравнение с RDKit
  const file = ['src/data/organicV2/molecules.json', '.tmp/organic-v2/molecules-v0.json', 'C:/Users/Первый/Desktop/химия/.tmp/organic-v2/molecules-v0.json'].find((p) => existsSync(p))
  if (!file) console.log('  (нет координат RDKit — сравнение пропущено)')
  else {
    type Rec = { id: string; smiles: string; atoms: { el: string; p: Vec3 }[]; bonds: unknown[] }
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Omit<Rec, 'id'>> | { molecules: Rec[] }
    const list: Rec[] = 'molecules' in raw && Array.isArray(raw.molecules) ? raw.molecules : Object.entries(raw as Record<string, Omit<Rec, 'id'>>).map(([id, v]) => ({ id, ...v }))
    const acyclic = list.filter((m) => m.bonds.length === m.atoms.length - 1 && !/[@]/.test(m.smiles)).filter((m) => { const h = m.atoms.filter((a) => a.el !== 'H').length; return h >= 3 && h <= 9 })
    const sample = acyclic.slice(0, 60)
    // Сверяем ВНУТРЕННЮЮ геометрию (длины связей 1–2 и расстояния 1–3, т. е. валентные углы) — она не зависит от
    // конформера. RMSD всей молекулы — только для справки: данные v2 нарочно берут вытянутый зигзаг длинных цепей,
    // а встраиватель может выбрать другой поворот вокруг одинарных связей — геометрия при этом верная.
    const rms: { id: string; r: number }[] = []
    const d12: number[] = []
    const d13: number[] = []
    const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
    for (const m of sample) {
      const g = parseSmiles(m.smiles.replace(/[/\\]/g, ''))
      const e = embed3D(g)
      const heavy = m.atoms.filter((a) => a.el !== 'H').map((a) => a.p)
      const mine = e.atoms.slice(0, e.heavy).map((a) => a.p)
      const mol = toMol(g)
      rms.push({ id: m.id, r: symmetryRmsd(mol, mine, heavy) })
      // Порядок атомов в данных v2 (граф реестра) и в разборе SMILES разный — сравниваем отсортированные наборы
      // расстояний по типам («C–O», «C–C–O»), нумерация не нужна.
      const groupsOf = (els: string[], nbrs: number[][], pos: Vec3[]) => {
        const m12 = new Map<string, number[]>(), m13 = new Map<string, number[]>()
        const push = (mp: Map<string, number[]>, k: string, v: number) => { const a = mp.get(k) ?? []; a.push(v); mp.set(k, a) }
        for (let i = 0; i < els.length; i++) {
          for (const j of nbrs[i]) if (j > i) push(m12, [els[i], els[j]].sort().join('-'), dist(pos[i], pos[j]))
          for (let a = 0; a < nbrs[i].length; a++) for (let b = a + 1; b < nbrs[i].length; b++) {
            const [x, y] = [els[nbrs[i][a]], els[nbrs[i][b]]].sort()
            push(m13, `${x}-${els[i]}-${y}`, dist(pos[nbrs[i][a]], pos[nbrs[i][b]]))
          }
        }
        return { m12, m13 }
      }
      const mineG = groupsOf(mol.el, mol.adj.map((xs) => xs.map((x) => x.to)), mine)
      const hIdx = m.atoms.map((a, i) => (a.el !== 'H' ? i : -1)).filter((i) => i >= 0)
      const back = new Map(hIdx.map((i, k) => [i, k]))
      const refN: number[][] = hIdx.map(() => [])
      for (const b of m.bonds as { a: number; b: number }[]) {
        const A = back.get(b.a), B = back.get(b.b)
        if (A !== undefined && B !== undefined) { refN[A].push(B); refN[B].push(A) }
      }
      const refG = groupsOf(hIdx.map((i) => m.atoms[i].el), refN, heavy)
      const cmp = (A: Map<string, number[]>, B: Map<string, number[]>, out: number[]) => {
        for (const [k, xs] of A) {
          const ys = B.get(k)
          if (!ys || ys.length !== xs.length) { out.push(9); continue }
          const s1 = [...xs].sort((p, r) => p - r), s2 = [...ys].sort((p, r) => p - r)
          s1.forEach((v, i) => out.push(Math.abs(v - s2[i])))
        }
      }
      cmp(mineG.m12, refG.m12, d12)
      cmp(mineG.m13, refG.m13, d13)
    }
    rms.sort((a, b) => a.r - b.r)
    const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))]
    const within = rms.filter((x) => x.r <= 0.35).length
    console.log(`  ${file}: ${sample.length} ациклических молекул (3–9 тяжёлых атомов)`)
    console.log(`  связи 1–2: медиана |Δ| ${q(d12, 0.5).toFixed(3)} Å, 95 % ${q(d12, 0.95).toFixed(3)} Å; через атом 1–3: медиана ${q(d13, 0.5).toFixed(3)} Å, 95 % ${q(d13, 0.95).toFixed(3)} Å`)
    console.log(`  (справка) RMSD всей молекулы ≤ 0,35 Å: ${within}/${sample.length}, медиана ${rms[rms.length >> 1].r.toFixed(3)} Å — разница конформеров, не ошибка`)
    ok(sample.length >= 50 && q(d12, 0.5) <= 0.02 && q(d12, 0.95) <= 0.05 && q(d13, 0.5) <= 0.05 && q(d13, 0.95) <= 0.12, 'внутренняя геометрия = RDKit: связи (медиана ≤ 0,02, 95 % ≤ 0,05 Å), углы через 1–3 (медиана ≤ 0,05, 95 % ≤ 0,12 Å)')
  }
  // скорость: 30 тяжёлых атомов
  const g30 = parseSmiles('CCCCCCCCC(C)CCCC(O)CCCCC(=O)OCCC(C)CCC=CCC')
  const heavy = toMol(g30).n
  for (let i = 0; i < 3; i++) embed3D(g30)
  const times: number[] = []
  for (let i = 0; i < 7; i++) times.push(embed3D(g30).ms)
  times.sort((a, b) => a - b)
  const ring = parseSmiles('OCC1OC(O)C(O)C(O)C1OC1OC(CO)C(O)C(O)C1O')
  const tr: number[] = []
  for (let i = 0; i < 5; i++) tr.push(embed3D(ring).ms)
  tr.sort((a, b) => a - b)
  console.log(`  ${heavy} тяжёлых атомов: медиана ${times[3].toFixed(1)} мс; дисахарид (23 тяж., 2 цикла): ${tr[2].toFixed(1)} мс`)
  ok(times[3] <= 30, `embed3D ≤ 30 мс для ${heavy} тяжёлых атомов (${times[3].toFixed(1)} мс)`)
  // цис/транс сохраняется в 3D
  const cis = embed3D(parseSmiles('C/C=C\\C')), trans = embed3D(parseSmiles('C/C=C/C'))
  const d03 = (e: ReturnType<typeof embed3D>) => Math.hypot(...[0, 1, 2].map((k) => e.atoms[0].p[k] - e.atoms[3].p[k]))
  ok(d03(cis) < 3.2 && d03(trans) > 3.6, `цис-бутен-2: C1…C4 ${d03(cis).toFixed(2)} Å, транс: ${d03(trans).toFixed(2)} Å`)
}

/** RMSD с учётом симметрии (перебор автоморфизмов графа, до 500). */
function symmetryRmsd(m: Mol, A: Vec3[], B: Vec3[]): number {
  const cls = canonicalizeMol(m).symmetryClass
  const order: number[] = []
  const seen = new Array(m.n).fill(false)
  for (let s0 = 0; s0 < m.n; s0++) if (!seen[s0]) { seen[s0] = true; const q = [s0]; for (let h = 0; h < q.length; h++) { order.push(q[h]); for (const e of m.adj[q[h]]) if (!seen[e.to]) { seen[e.to] = true; q.push(e.to) } } }
  const map = new Array(m.n).fill(-1), used = new Array(m.n).fill(false)
  let best = Infinity, count = 0
  const rec = (k: number) => {
    if (count >= 500) return
    if (k === order.length) { count++; best = Math.min(best, alignedRmsd(A, map.map((j: number) => B[j]))); return }
    const v = order[k]
    for (let w = 0; w < m.n; w++) {
      if (used[w] || cls[w] !== cls[v]) continue
      if (m.adj[v].some((e) => map[e.to] >= 0 && !m.adj[w].some((x) => x.to === map[e.to] && x.o === e.o))) continue
      map[v] = w; used[w] = true; rec(k + 1); map[v] = -1; used[w] = false
    }
  }
  rec(0)
  return best
}

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nВСЁ ЗЕЛЁНОЕ')
process.exit(failed ? 1 : 0)
