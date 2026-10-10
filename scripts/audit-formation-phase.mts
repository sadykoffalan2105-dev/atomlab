/**
 * Категории N / O / P аудита «Как образуется» (scripts/audit-formation-200.mts):
 *  N фаза 25 °C: у каждого id есть finalPhase; 'gas' — копий 6–10 (шаг 2,4–3,0 диаметра), 'liquid' — 10–12 (шаг ≈ 1,08),
 *    'solution' — воды 4–8; у газа/жидкости/раствора latticeAtoms пусты; 'ionic' | 'molecular' | 'chain' — фрагмент непуст
 *    (модель-кристалл — сама решётка), включая 7 ОВР-веществ (окно роста внутри «Готово»); раствор 'strong' — acidH
 *    непусты и указывают на атомы H модели; облака (orbitals) на каждый атом; карточка фазы в HUD на RU/EN/UZ
 *    (EN/UZ без кириллицы, без пустых строк);
 *  O решётка по структурному типу (RS/CsCl/ZB/WZ/AF/CUP/COR/CdI2/L3/RUT/NiAs): фрагмент из генератора, модель карточки —
 *    в узлах (story/lattice.ts buildIonicFragment); КЧ каждого иона модели по оболочке S1 (частицы противоположного знака
 *    на ≤ CONTACT_TOL·d) = табличному; ближайшее катион–анион фрагмента = модельному ±1 %; Σr ≤ 0,92·d у пар ионов
 *    (одноатомных), d ≥ Σr у прочих пар разных частиц. Модель, не ложащаяся в узлы (ε > 0,15·d: линейный Cu–O–Cu против
 *    тетраэдра O в куприте, плоский MCl₃ против слоя, бипирамида M₂O₃ против корунда) — схема по правилам, строка
 *    в сводке (доля генератора — scripts/test-formation-lattice.mts, ≥ 85 %);
 *  P нормы движения — scripts/test-formation-motion.mts (vibOf ≤ VIB_LIMITS, vibOffset — если есть motion.ts,
 *    непрерывность atomPosAt).
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan } from '../src/chemistry/formationPlan'
import { formationScript } from '../src/chemistry/formationScripts'
import { buildSchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { formationStoryFor, screenToModel } from '../src/components/lab/formation/formationStory'
import { CONTACT_TOL, latticeFor, type LatticeAtom } from '../src/components/lab/formation/story/lattice'
import { phaseRow, type LatticeCode } from '../src/components/lab/formation/story/phase-data'
import { redoxDecomposition } from '../src/chemistry/formationRedoxDecomposition'
import { checkMotion } from './test-formation-motion.mts'

type V3 = [number, number, number]
type C3 = 'N' | 'O' | 'P'
const CN: Partial<Record<LatticeCode, [number, number]>> = {
  RS: [6, 6], CsCl: [8, 8], ZB: [4, 4], WZ: [4, 4], AF: [4, 8], CUP: [2, 4], COR: [6, 4], CdI2: [6, 3], L3: [6, 2], RUT: [6, 3], NiAs: [6, 6],
}
const OLD_HINT = /типа NaCl|типа ZnS|типа корунда|антифлюорит/
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const anchor = (pts: { el: string; pos: V3 }[]): V3 => {
  const h = pts.filter((p) => p.el !== 'H')
  const use = h.length ? h : pts
  const c: V3 = [0, 0, 0]
  for (const p of use) for (let q = 0; q < 3; q++) c[q] += p.pos[q]! / use.length
  return c
}

export async function auditPhases() {
  const mk = () => ({ N: new Set<string>(), O: new Set<string>(), P: new Set<string>() })
  const before = mk()
  const after = mk()
  const notes: string[] = []
  const flag = (cat: C3, id: string, msg: string) => {
    after[cat].add(id)
    notes.push(`${cat} ${id}: ${msg}`)
  }
  const oStats: string[] = []
  const schemaO: string[] = []
  for (const id of CATALOG_TOP200_IDS) {
    const c = compoundById[id]
    const plan = formationPlan(id)
    const model = c ? buildSchoolHeroModel(c) : null
    const story = formationStoryFor(id)
    if (!c || !plan || !model || !story) continue
    const row = phaseRow(id)
    const redox = !!redoxDecomposition(id)
    const sc = formationScript(id)
    // «До»: фазы не было ни у кого; решётка по типу — только у старых генераторов / хинтов; тряска нагрева 7–18 Гц у ОВР.
    before.N.add(id)
    if (row?.code && CN[row.code] && model.kind !== 'crystal' && (redox || !(sc?.latticeKind === 'generator' || OLD_HINT.test(sc?.lattice ?? '')))) before.O.add(id)
    if (redox) before.P.add(id)

    // ── N ──
    const ph = story.finalPhase
    const info = story.phaseInfo
    if (!row) flag('N', id, 'нет строки в story/phase-data.ts')
    if (!ph || !info) flag('N', id, 'нет finalPhase / phaseInfo')
    else {
      if (ph === 'gas' || ph === 'liquid' || ph === 'solution') {
        if (story.latticeAtoms.length) flag('N', id, `${ph}: фрагмент решётки (${story.latticeAtoms.length}) должен быть пуст`)
        if (ph === 'gas' && (info.copies < 6 || info.copies > 10 || info.spacing < 2.4 || info.spacing > 3.0)) flag('N', id, `газ: копий ${info.copies}, шаг ${info.spacing}`)
        if (ph === 'liquid' && (info.copies < 10 || info.copies > 12 || Math.abs(info.spacing - 1.08) > 0.1)) flag('N', id, `жидкость: копий ${info.copies}, шаг ${info.spacing}`)
        if (ph === 'solution') {
          if ((info.waters ?? 0) < 4 || (info.waters ?? 0) > 8) flag('N', id, `раствор: воды ${info.waters}`)
          if (info.dissociation === 'strong' && !info.acidH?.length) flag('N', id, 'сильная кислота без acidH')
          for (const h of info.acidH ?? []) if (model.atoms[h]?.el !== 'H') flag('N', id, `acidH ${h} — не атом H модели (${model.atoms[h]?.el})`)
        }
      }
      if (ph === 'ionic' || ph === 'molecular' || ph === 'chain') {
        if (model.kind !== 'crystal' && story.latticeAtoms.length === 0) flag('N', id, `${ph}: нет фрагмента решётки`)
        if (ph === 'ionic' && story.latticeKind !== 'ionic') flag('N', id, `ionic, а latticeKind ${story.latticeKind}`)
      }
      if (redox) {
        const fin = story.stages.find((s) => s.key === 'final')!
        const [w0, w1] = story.latticeWin
        if (!(w0 >= fin.t0 && w1 <= fin.t0 + fin.dur && w1 > w0)) flag('N', id, `ОВР: окно роста решётки [${w0.toFixed(1)}, ${w1.toFixed(1)}] вне «Готово»`)
      }
      // облака
      const orb = story.orbitals
      if (!orb || orb.atoms.length !== model.atoms.length) flag('N', id, 'нет облаков на каждый атом')
      else
        for (const a of orb.atoms) {
          if (a.el !== model.atoms[a.i]?.el || a.s < 0 || a.s > 2 || a.p < 0 || a.p > 6 || a.lone < 0 || a.n < 1 || a.n > 7) flag('N', id, `облако атома ${a.i}: ${JSON.stringify(a)}`)
          if ((a.role === 'cation' || a.role === 'anion') && a.dq == null) flag('N', id, `ион ${a.el}${a.i} без dq`)
        }
      // карточка фазы в HUD
      const card = (story.hud ?? []).find((h) => h.tone === 'check' && h.titleT && h.t1 === story.total && h.linesT?.length)
      if (!card) flag('N', id, 'нет карточки фазы в HUD')
      else {
        const all = [card.titleT!, ...card.linesT!]
        for (const t of all) {
          if (t.some((x) => !x.trim())) flag('N', id, `пустая строка HUD: ${JSON.stringify(t)}`)
          if (/[А-Яа-яЁё]/.test(t[1]) || /[А-Яа-яЁё]/.test(t[2])) flag('N', id, `EN/UZ с кириллицей: ${t[1]} | ${t[2]}`)
        }
      }
    }

    // ── O ──
    const code = row?.code
    const want = code ? CN[code] : undefined
    if (!want || model.kind === 'crystal') continue
    const lat = latticeFor(sc, plan, model, (s) => screenToModel(model, s))
    if (lat.src !== 'generator') {
      schemaO.push(`${id} ${code}`)
      continue
    }
    if (story.latticeAtoms.length !== lat.atoms.length) flag('O', id, 'story.latticeAtoms ≠ latticeFor')
    if (!lat.nodes?.length) {
      flag('O', id, 'нет узлов частиц модели')
      continue
    }
    // частицы: узлы модели + фрагмент (по u)
    type Part = { sign: number; c: V3; atoms: { el: string; pos: V3; r: number; ion: boolean }[]; model: boolean }
    const snap = story.latticeSnap
    const parts: Part[] = lat.nodes.map((n) => ({
      sign: n.ion,
      c: n.node,
      model: true,
      atoms: n.atoms.map((a) => {
        const p = model.atoms[a]!.pos
        const sv = snap?.[a] ?? [0, 0, 0]
        return { el: model.atoms[a]!.el, pos: [p[0] + sv[0], p[1] + sv[1], p[2] + sv[2]] as V3, r: model.atoms[a]!.r, ion: n.atoms.length === 1 }
      }),
    }))
    const byU = new Map<number, LatticeAtom[]>()
    for (const a of lat.atoms) byU.set(a.u ?? -1, [...(byU.get(a.u ?? -1) ?? []), a])
    for (const [, atoms] of byU) parts.push({ sign: atoms[0]!.ion ?? 0, c: anchor(atoms), atoms: atoms.map((a) => ({ el: a.el, pos: a.pos as V3, r: a.r, ion: atoms.length === 1 })), model: false })
    if (parts.some((p) => !p.model && !p.sign)) {
      flag('O', id, 'у узлов фрагмента нет знака (ion)')
      continue
    }
    let dModel = Infinity
    for (const x of parts) for (const y of parts) if (x.model && y.model && x.sign > 0 && y.sign < 0) dModel = Math.min(dModel, len(sub(x.c, y.c)))
    let dFrag = Infinity
    for (const x of parts) for (const y of parts) if (!x.model && !y.model && x.sign > 0 && y.sign < 0) dFrag = Math.min(dFrag, len(sub(x.c, y.c)))
    if (!Number.isFinite(dFrag) || Math.abs(dFrag - dModel) > 0.01 * dModel) flag('O', id, `d(катион–анион) фрагмента ${dFrag.toFixed(3)} ≠ модели ${dModel.toFixed(3)} ±1 %`)
    // КЧ каждого иона модели по S1 (соседи противоположного знака на ≤ CONTACT_TOL·d)
    const cnOf = (p: Part) => parts.filter((o) => o.sign === -p.sign && len(sub(o.c, p.c)) <= CONTACT_TOL * dModel).length
    const cc = parts.filter((p) => p.model && p.sign > 0).map(cnOf)
    const ca = parts.filter((p) => p.model && p.sign < 0).map(cnOf)
    if (!cc.every((g) => g === want[0])) flag('O', id, `${code}: КЧ катионов модели ${cc.join('/')} ≠ ${want[0]}`)
    if (!ca.every((g) => g === want[1])) flag('O', id, `${code}: КЧ анионов модели ${ca.join('/')} ≠ ${want[1]}`)
    // касание: Σr ≤ 0,92·d у пар ионов, d ≥ Σr у прочих пар разных частиц
    const all = parts.flatMap((p, pi) => p.atoms.map((a) => ({ ...a, pi, model: p.model })))
    let worst = Infinity
    let wAt = ''
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const x = all[i]!
        const y = all[j]!
        if (x.pi === y.pi) continue
        const r = ((x.ion && y.ion ? 0.92 : 1) * len(sub(x.pos, y.pos))) / (x.r + y.r)
        if (r < worst) {
          worst = r
          wAt = `${x.el}${x.model ? '(модель)' : ''}–${y.el}${y.model ? '(модель)' : ''}`
        }
      }
    if (worst < 1 - 1e-6) flag('O', id, `наложение ${wAt}: норма·d = ${worst.toFixed(3)}·(r₁ + r₂) < 1`)
    const sh = lat.shells
    oStats.push(`${id} ${code}: КЧ ${cc.join('/')}:${ca.join('/')} (S1), d ${(dFrag / dModel).toFixed(3)}, норма ${worst.toFixed(2)}, S1 ${sh?.n1} + S2 ${sh?.n2} частиц, атомов ${lat.atoms.length}`)
  }
  // ── P ──
  const m = await checkMotion(CATALOG_TOP200_IDS)
  for (const id of m.flagged) after.P.add(id)
  notes.push(...m.notes)
  const summary = [
    `Решётки по типу (O), ${oStats.length} веществ (модель в узлах, КЧ по S1):`,
    ...oStats.map((s) => `  ${s}`),
    `  схема (модель карточки не ложится в узлы структурного типа, ε > 0,15·d): ${schemaO.length} — ${schemaO.join(', ') || '—'}`,
  ]
  return { before, after, notes, summary, pSkipped: m.skipped }
}
