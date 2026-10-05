/**
 * Органика v2 — проверки чистой логики просмотрщика (src/components/organicV2/viewer/molMath.ts):
 * вписывание в кадр, жёсткий поворот ракурса, проекция Ньюмена (углы, φ после вращения), торсионная энергия,
 * вид изомерии на парах молекул реестра, масса, стереометки.
 * Запуск: npx tsx scripts/test-organic-v2-viewer.mts
 */
import { readFileSync } from 'node:fs'
import type { OV2Molecule } from '../src/data/organicV2/types'
import {
  boundingRadius,
  conformationName,
  dist,
  fitDistance,
  fitDistanceBox,
  halfExtents,
  isomerKind,
  isRotatable,
  molarMass,
  neighbors,
  newmanProjection,
  norm,
  orientForView,
  rotateAround,
  sideOf,
  stereoMarks,
  sub,
  torsionEnergy,
  hybridCounts,
  type V3,
} from '../src/components/organicV2/viewer/molMath'

const all = JSON.parse(readFileSync(new URL('../src/data/organicV2/molecules.json', import.meta.url), 'utf8')) as Record<string, OV2Molecule>
let fails = 0
let passes = 0
const ok = (cond: boolean, msg: string) => {
  if (cond) passes++
  else {
    fails++
    console.error('✗', msg)
  }
}
const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps
const angDiff = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return Math.min(d, 360 - d)
}

// ── 1. вписывание ──
for (const aspect of [0.5, 1, 1.6, 2.4]) {
  const r = 7
  const d = fitDistance(r, 38, aspect, 1)
  const vf = (38 * Math.PI) / 180
  const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect)
  ok(near(Math.sin(Math.min(vf, hf) / 2) * d, r, 1e-9), `сфера r=${r} касается края кадра (aspect ${aspect})`)
}
for (const id of ['triolein', 'oleic-acid', 'benzene', 'ethane']) {
  const m = all[id]
  const pos = orientForView(m.atoms.map((a) => a.p))
  const radii = m.atoms.map(() => 0.4)
  const h = halfExtents(pos, radii)
  for (const aspect of [0.46, 1.4]) {
    const d = Math.min(fitDistance(boundingRadius(pos, radii), 38, aspect, 1.04), fitDistanceBox(h, 38, aspect, 1.12))
    const tv = Math.tan((38 * Math.PI) / 360)
    // каждая точка (с радиусом) проецируется внутрь кадра
    let inside = true
    for (const p of pos) {
      const z = d - p[2]
      if (Math.abs(p[0]) + 0.4 > tv * aspect * z * 1.001 || Math.abs(p[1]) + 0.4 > tv * z * 1.001) inside = false
    }
    ok(inside, `${id}: все атомы в кадре (aspect ${aspect})`)
  }
  // длинная ось — по X
  // без наклона: длинная ось — X, вторая — Y, «толщина» — Z (по дисперсии)
  const flat = orientForView(m.atoms.map((a) => a.p), 0)
  const v = [0, 1, 2].map((d) => flat.reduce((s, p) => s + p[d] * p[d], 0))
  ok(v[0] >= v[1] - 1e-6 && v[1] >= v[2] - 1e-6, `${id}: ракурс по главным осям (X ≥ Y ≥ Z): ${v.map((x) => x.toFixed(1)).join(' ')}`)
}

// ── 2. жёсткий поворот: все расстояния сохраняются ──
for (const id of ['glucose-pyranose', 'sucrose', '2-2-dimethylbutane']) {
  const m = all[id]
  const pos = orientForView(m.atoms.map((a) => a.p))
  let worst = 0
  for (const b of m.bonds) worst = Math.max(worst, Math.abs(dist(pos[b.a], pos[b.b]) - dist(m.atoms[b.a].p, m.atoms[b.b].p)))
  ok(worst < 1e-9, `${id}: длины связей после поворота ракурса не изменились (Δ=${worst.toExponential(1)})`)
}

// ── 3. Ньюмен ──
function ccBond(m: OV2Molecule) {
  const adj = neighbors(m)
  const cdeg = (i: number) => adj[i].filter((j) => m.atoms[j].el === 'C').length
  let best = -1
  let score = -1
  m.bonds.forEach((b, i) => {
    if (m.atoms[b.a].el !== 'C' || m.atoms[b.b].el !== 'C' || !isRotatable(m, adj, i)) return
    const s = Math.min(cdeg(b.a), cdeg(b.b)) * 10 + cdeg(b.a) + cdeg(b.b)
    if (s > score) {
      score = s
      best = i
    }
  })
  return best
}
{
  const m = all['ethane']
  const adj = neighbors(m)
  const bi = ccBond(m)
  ok(bi >= 0, 'этан: связь C–C вращается')
  const bd = m.bonds[bi]
  const pos = orientForView(m.atoms.map((a) => a.p))
  const nm = newmanProjection(m, pos, adj, bd.a, bd.b)
  ok(nm.front.length === 3 && nm.back.length === 3, 'этан: по 3 заместителя спереди и сзади')
  const fa = nm.front.map((s) => s.angle).sort((x, y) => x - y)
  ok(near(angDiff(fa[0], fa[1]), 120, 4) && near(angDiff(fa[1], fa[2]), 120, 4), `этан: передние H через 120° (${fa.map((x) => x.toFixed(0)).join(', ')})`)
  ok(nm.pair === 'HH', 'этан: пара опорных групп H/H')
  ok(conformationName(nm.phi, nm.pair) === 'staggered', `этан из RDKit — заторможенная (φ=${nm.phi.toFixed(1)}°)`)
  const minBack = Math.min(...nm.back.map((s) => Math.min(...nm.front.map((f) => angDiff(s.angle, f.angle)))))
  ok(near(minBack, 60, 4), `этан: задние H посередине между передними (${minBack.toFixed(1)}°)`)
}
{
  const m = all['n-butane']
  const adj = neighbors(m)
  const bi = ccBond(m)
  const bd = m.bonds[bi]
  const deg = (i: number) => adj[i].filter((j) => m.atoms[j].el === 'C').length
  ok(deg(bd.a) === 2 && deg(bd.b) === 2, 'бутан: выбрана центральная связь C2–C3')
  const pos = orientForView(m.atoms.map((a) => a.p))
  const nm0 = newmanProjection(m, pos, adj, bd.a, bd.b)
  ok(nm0.pair === 'XX' && m.atoms[nm0.refFront].el === 'C' && m.atoms[nm0.refBack].el === 'C', 'бутан: опорные группы — CH₃/CH₃')
  ok(nm0.front.some((s) => s.label === 'CH₃') && nm0.back.some((s) => s.label === 'CH₃'), 'бутан: подписи CH₃ на проекции')
  const side = sideOf(adj, bd.a, bd.b)!
  const axis = norm(sub(pos[bd.b], pos[bd.a]))
  for (const target of [0, 60, 120, 180, 300]) {
    const delta = ((target - nm0.phi) * Math.PI) / 180
    const moved = new Set(side)
    const p2: V3[] = pos.map((p, i) => (moved.has(i) ? rotateAround(p, pos[bd.a], axis, delta) : p))
    const nm = newmanProjection(m, p2, adj, bd.a, bd.b)
    ok(angDiff(nm.phi, target) < 0.01, `бутан: после вращения φ=${target}° (получено ${nm.phi.toFixed(2)}°)`)
    let worst = 0
    for (const b of m.bonds) worst = Math.max(worst, Math.abs(dist(p2[b.a], p2[b.b]) - dist(pos[b.a], pos[b.b])))
    ok(worst < 1e-9, `бутан φ=${target}°: длины связей не изменились`)
  }
  ok(conformationName(180, 'XX') === 'anti' && conformationName(60, 'XX') === 'gauche' && conformationName(0, 'XX') === 'syn' && conformationName(120, 'XX') === 'eclipsed', 'бутан: названия конформаций')
  const ring = all['cyclohexane']
  const radj = neighbors(ring)
  const ringBond = ring.bonds.findIndex((b) => ring.atoms[b.a].el === 'C' && ring.atoms[b.b].el === 'C')
  ok(!isRotatable(ring, radj, ringBond), 'циклогексан: связь в цикле не вращается')
  const eth = all['ethylene']
  ok(!isRotatable(eth, neighbors(eth), eth.bonds.findIndex((b) => b.o === 2)), 'этилен: двойная связь не вращается')
}

// ── 4. энергия ──
ok(near(torsionEnergy(0, 'HH'), 12, 1e-9) && near(torsionEnergy(60, 'HH'), 0, 1e-9), 'этан: барьер 12 кДж/моль')
ok(near(torsionEnergy(180, 'XX'), 0, 1e-3), 'бутан: анти 0')
ok(near(torsionEnergy(60, 'XX'), 3.8, 1e-3), 'бутан: гош 3,8')
ok(near(torsionEnergy(120, 'XX'), 16, 1e-3), 'бутан: заслонённая 16')
ok(near(torsionEnergy(0, 'XX'), 19, 1e-3), 'бутан: син 19')
let minE = Infinity
let argMin = 0
for (let p = 0; p <= 360; p++) {
  const e = torsionEnergy(p, 'XX')
  if (e < minE) {
    minE = e
    argMin = p
  }
}
ok(argMin === 180, `бутан: глобальный минимум при 180° (${argMin})`)

// ── 5. вид изомерии ──
const PAIRS: [string, string, string][] = [
  ['but-1-ene', 'but-2-ene', 'bondPosition'],
  ['cis-but-2-ene', 'trans-but-2-ene', 'cisTrans'],
  ['n-butane', 'isobutane', 'chain'],
  ['n-pentane', 'neopentane', 'chain'],
  ['ethanol', 'dimethyl-ether', 'interclass'],
  ['propanol', 'propan-2-ol', 'groupPosition'],
  ['but-1-ene', 'cyclobutane', 'interclass'],
  ['but-1-yne', 'butadiene', 'interclass'],
  ['pent-1-ene', 'pent-2-ene', 'bondPosition'],
  ['butanal', 'butanone', 'interclass'],
  ['propanoic-acid', 'methyl-acetate', 'interclass'],
  ['n-hexane', '2-2-dimethylbutane', 'chain'],
  ['1-chlorobutane', '2-chlorobutane', 'groupPosition'],
]
for (const [a, b, want] of PAIRS) {
  if (!all[a] || !all[b]) {
    ok(false, `нет молекулы ${a} или ${b}`)
    continue
  }
  ok(all[a].formula === all[b].formula, `${a}/${b}: одна брутто-формула`)
  const v = isomerKind(all[a], all[b])
  ok(v.kind === want, `${a} → ${b}: ${want} (получено ${v.kind})`)
  if (want !== 'cisTrans') ok(v.highlight.length > 0, `${a} → ${b}: есть атомы для подсветки`)
}
// оптическая: зеркальная копия молекулы со стереоцентром (R ↔ S, координаты отражены)
{
  const src = Object.values(all).find((m) => m.atoms.filter((x) => x.cip).length === 1 && m.atoms.length < 20)
  if (src) {
    const mirror: OV2Molecule = {
      ...src,
      id: `${src.id}-mirror`,
      atoms: src.atoms.map((x) => ({ ...x, p: [-x.p[0], x.p[1], x.p[2]] as const, cip: x.cip ? (x.cip === 'R' ? 'S' : 'R') : undefined })),
    }
    ok(isomerKind(src, mirror).kind === 'optical', `${src.id}: зеркальная копия — оптическая изомерия`)
  }
  ok(isomerKind(all['ethanol'], all['ethanol']).kind === 'same', 'этанол сам с собой — та же молекула')
}

// ── 6. карточка ──
ok(near(molarMass(all['ethanol']), 46.07, 0.01), `этанол: M = 46,07 (${molarMass(all['ethanol'])})`)
ok(near(molarMass(all['sucrose']), 342.3, 0.05), `сахароза: M = 342,3 (${molarMass(all['sucrose'])})`)
const hb = hybridCounts(all['benzene'])
ok(hb.sp2 === 6 && hb.sp3 === 0, 'бензол: 6 × sp²')
const hp = hybridCounts(all['propyne'])
ok(hp.sp === 2 && hp.sp3 === 1, 'пропин: 2 × sp, 1 × sp³')
const st = stereoMarks(all['cis-but-2-ene'])
ok(st.length === 1 && st[0].label === 'Z' && st[0].cisTrans === 'cis', 'цис-бутен-2: Z (цис)')
const st2 = stereoMarks(all['trans-but-2-ene'])
ok(st2.length === 1 && st2[0].cisTrans === 'trans', 'транс-бутен-2: E (транс)')
const ol = stereoMarks(all['oleic-acid'])
ok(ol.some((s) => s.cisTrans === 'cis'), 'олеиновая кислота: цис-двойная связь')

console.log(`\nпросмотрщик органики v2: ${passes} проверок прошло, ${fails} не прошло`)
if (fails) process.exit(1)
