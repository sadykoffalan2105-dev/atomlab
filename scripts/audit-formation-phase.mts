/**
 * Категории N / O / P аудита «Как образуется» (scripts/audit-formation-200.mts):
 *  N фаза 25 °C: у каждого id есть finalPhase; 'gas' — копий 6–10 (шаг 2,4–3,0 диаметра), 'liquid' — 10–12 (шаг ≈ 1,08),
 *    'solution' — воды 4–8; у газа/жидкости/раствора latticeAtoms пусты; 'ionic' | 'molecular' | 'chain' — фрагмент непуст
 *    (модель-кристалл — сама решётка), включая 7 ОВР-веществ (окно роста внутри «Готово»); раствор 'strong' — acidH
 *    непусты и указывают на атомы H модели; облака (orbitals) на каждый атом; карточка фазы в HUD на RU/EN/UZ
 *    (EN/UZ без кириллицы, без пустых строк);
 *  O решётка по структурному типу (RS/CsCl/ZB/WZ/AF/CUP/COR/CdI2/L3/RUT/NiAs): фрагмент из генератора; КЧ катиона и аниона
 *    (частицы на расстоянии ≤ 1,15·d_min) = табличному; ближайшее катион–анион фрагмента = модельному ±2 %;
 *    наложений нет: d ≥ 0,8·(r₁ + r₂) у любых двух атомов фрагмента и модели;
 *  P нормы движения — scripts/test-formation-motion.mts (vibOf ≤ VIB_LIMITS, vibOffset — если есть motion.ts,
 *    непрерывность atomPosAt).
 */
import { CATALOG_TOP200_IDS } from '../src/data/catalog/catalogTop200'
import { compoundById } from '../src/data/compounds'
import { formationPlan } from '../src/chemistry/formationPlan'
import { formationScript } from '../src/chemistry/formationScripts'
import { buildSchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { formationStoryFor, screenToModel } from '../src/components/lab/formation/formationStory'
import { latticeFor, type LatticeAtom } from '../src/components/lab/formation/story/lattice'
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
      flag('O', id, `${code}: фрагмент не из генератора (${lat.src})`)
      continue
    }
    if (story.latticeAtoms.length !== lat.atoms.length) flag('O', id, 'story.latticeAtoms ≠ latticeFor')
    // частицы: модель (по plan.units) + фрагмент (по u)
    type Part = { sign: number; c: V3; atoms: { el: string; pos: V3; r: number }[]; model: boolean }
    const parts: Part[] = []
    for (const u of plan.units) {
      const q = plan.species[u.species]!.charge
      if (!q) continue
      const atoms = u.atoms.map((a) => ({ el: model.atoms[a]!.el, pos: model.atoms[a]!.pos as V3, r: model.atoms[a]!.r }))
      parts.push({ sign: Math.sign(q), c: anchor(atoms), atoms, model: true })
    }
    const byU = new Map<number, LatticeAtom[]>()
    for (const a of lat.atoms) byU.set(a.u ?? -1, [...(byU.get(a.u ?? -1) ?? []), a])
    for (const [, atoms] of byU) parts.push({ sign: atoms[0]!.ion ?? 0, c: anchor(atoms), atoms, model: false })
    if (parts.some((p) => !p.model && !p.sign)) {
      flag('O', id, 'у узлов фрагмента нет знака (ion)')
      continue
    }
    const mCat = parts.filter((p) => p.model && p.sign > 0)
    const mAn = parts.filter((p) => p.model && p.sign < 0)
    const C0 = mCat[0]!
    const A0 = [...mAn].sort((a, b) => len(sub(a.c, C0.c)) - len(sub(b.c, C0.c)))[0]!
    const dModel = len(sub(A0.c, C0.c))
    // ближайшее катион–анион внутри фрагмента
    const fC = parts.filter((p) => !p.model && p.sign > 0)
    const fA = parts.filter((p) => !p.model && p.sign < 0)
    let dFrag = Infinity
    for (const x of fC) for (const y of fA) dFrag = Math.min(dFrag, len(sub(x.c, y.c)))
    if (!Number.isFinite(dFrag) || Math.abs(dFrag - dModel) > 0.02 * dModel) flag('O', id, `d(катион–анион) фрагмента ${dFrag.toFixed(3)} ≠ модели ${dModel.toFixed(3)} ±2 %`)
    // КЧ: у иона модели, иначе — у ближайших к модели ионов фрагмента (модель «как в паре» может не совпадать с узлами)
    const lim = 1.15 * Math.min(dModel, dFrag)
    const cnOf = (p: Part) => parts.filter((o) => o.sign === -p.sign && len(sub(o.c, p.c)) <= lim).length
    const centre = anchor(model.atoms.map((a) => ({ el: a.el, pos: a.pos as V3 })))
    const pick = (sign: number, m0: Part, wantCN: number) => {
      const cands = [m0, ...parts.filter((p) => !p.model && p.sign === sign).sort((a, b) => len(sub(a.c, centre)) - len(sub(b.c, centre))).slice(0, 12)]
      const got = cands.map(cnOf)
      const k = got.findIndex((g) => g === wantCN)
      return { ok: k >= 0, at: k === 0 ? 'модель' : k > 0 ? 'фрагмент' : '—', got }
    }
    const cc = pick(1, C0, want[0])
    const ca = pick(-1, A0, want[1])
    if (!cc.ok) flag('O', id, `${code}: КЧ катиона ${cc.got.join('/')} ≠ ${want[0]}`)
    if (!ca.ok) flag('O', id, `${code}: КЧ аниона ${ca.got.join('/')} ≠ ${want[1]}`)
    // наложения
    const all = parts.flatMap((p, pi) => p.atoms.map((a) => ({ ...a, pi, model: p.model })))
    let worst = Infinity
    let wAt = ''
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const x = all[i]!
        const y = all[j]!
        if (x.pi === y.pi || (x.model && y.model)) continue
        const r = len(sub(x.pos, y.pos)) / (x.r + y.r)
        if (r < worst) {
          worst = r
          wAt = `${x.el}${x.model ? '(модель)' : ''}–${y.el}${y.model ? '(модель)' : ''}`
        }
      }
    if (worst < 0.8) flag('O', id, `наложение ${wAt}: d = ${worst.toFixed(2)}·(r₁ + r₂) < 0,8`)
    oStats.push(`${id} ${code}: КЧ ${cc.got[cc.got.findIndex((g) => g === want[0])] ?? cc.got[0]}(${cc.at}):${ca.got[ca.got.findIndex((g) => g === want[1])] ?? ca.got[0]}(${ca.at}), d ${(dFrag / dModel).toFixed(3)}, мин. ${worst.toFixed(2)}·Σr, атомов ${lat.atoms.length}`)
  }
  // ── P ──
  const m = await checkMotion(CATALOG_TOP200_IDS)
  for (const id of m.flagged) after.P.add(id)
  notes.push(...m.notes)
  const summary = [`Решётки по типу (O), ${oStats.length} веществ:`, ...oStats.map((s) => `  ${s}`)]
  return { before, after, notes, summary, pSkipped: m.skipped }
}
