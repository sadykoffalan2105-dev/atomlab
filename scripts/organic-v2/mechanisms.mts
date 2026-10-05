/**
 * Органика v2 · правила школьных механизмов (Kimyo 10) для атомного соответствия и их автоисправление.
 * Используется: scripts/audit-organic-v2-mechanisms.mts (проверка) и scripts/organic-v2/fix-mechanisms.mts
 * (исправление reactions.json; вызывается в конце build_reactions.py).
 *  1. этерификация/гидролиз/нитроэфиры — рвётся/образуется связь АЦИЛ–O, а не O–алкил;
 *  2. присоединение HX/H₂O — по Марковникову; 3. отщепление — по Зайцеву;
 *  4. замещение H на X — X садится на тот же C, H уходит в HX/H₂O, кольцо бензола не меняется;
 *     нитрование — O воды из HNO₃;
 *  5. присоединение H₂/Hal₂ к C=C — оба атома из одной молекулы;
 *  7. полимеризация — новые C–C только между атомами бывших кратных связей;
 *  8. Вюрц — новая C–C между атомами, потерявшими галоген; 9. окисление альдегида — C=O сохраняется;
 * 10. брожение — C–C только рвутся (≤ 3); 11. нет «перестановки скелета» (разрыв + образование C–C).
 */
import type { OV2BondChange, OV2Reaction } from '../../src/data/organicV2/types.ts'

export interface Side {
  el: Map<number, string>
  nb: Map<number, Map<number, number>>
  sp: Map<number, number>
  spRef: string[]
}

export function side(r: OV2Reaction, s: 'L' | 'R'): Side {
  const el = new Map<number, string>()
  const nb = new Map<number, Map<number, number>>()
  const sp = new Map<number, number>()
  const spRef: string[] = []
  r.species.forEach((x, k) => {
    if (x.side !== s) return
    spRef[k] = x.ref
    x.atoms.forEach((a, i) => {
      el.set(x.map[i], a.el)
      nb.set(x.map[i], new Map())
      sp.set(x.map[i], k)
    })
    for (const b of x.bonds) {
      const A = x.map[b.a]
      const B = x.map[b.b]
      nb.get(A)!.set(B, b.o)
      nb.get(B)!.set(A, b.o)
    }
  })
  return { el, nb, sp, spRef }
}

const hCount = (S: Side, a: number) => [...S.nb.get(a)!.keys()].filter((x) => S.el.get(x) === 'H').length
const order = (S: Side, a: number, b: number) => S.nb.get(a)?.get(b) ?? 0
/** «кислотный центр»: C/N/S с двойной связью к O */
const acidCenter = (S: Side, a: number) =>
  ['C', 'N', 'S', 'P'].includes(S.el.get(a)!) && [...S.nb.get(a)!].some(([x, o]) => o === 2 && S.el.get(x) === 'O')
/** O сложноэфирной группы: соседи — кислотный центр и C, который не кислотный центр */
function esterOAlkyl(S: Side, o: number): number | null {
  if (S.el.get(o) !== 'O') return null
  const ns = [...S.nb.get(o)!.keys()].filter((x) => S.el.get(x) !== 'H')
  if (ns.length !== 2) return null
  const ac = ns.filter((x) => acidCenter(S, x))
  const alk = ns.filter((x) => S.el.get(x) === 'C' && !acidCenter(S, x))
  return ac.length === 1 && alk.length === 1 ? alk[0] : null
}
const HAL = new Set(['F', 'Cl', 'Br', 'I'])

const CC_CHANGES_OK = new Set(['wurtz', 'cracking', 'isomerization', 'combustion', 'fermentation', 'other', 'oxidation', 'trimerization', 'polymerization', 'polycondensation', 'elimination', 'dehydrogenation', 'dehydration'])

export type Violation = { id: string; rule: string; msg: string }

/** Нарушения школьных механизмов в одной реакции; checked — счётчик применённых проверок по правилам. */
export function mechanismViolations(r: OV2Reaction, checked: Record<string, number> = {}): Violation[] {
  const out: Violation[] = []
  const L = side(r, 'L')
  const R = side(r, 'R')
  const bad = (rule: string, msg: string) => out.push({ id: r.id, rule, msg })
  const hit = (rule: string) => (checked[rule] = (checked[rule] ?? 0) + 1)
  const broken = r.changes.filter((c) => c.from > 0 && c.to === 0)
  const formed = r.changes.filter((c) => c.from === 0 && c.to > 0)
  const lowered = r.changes.filter((c) => c.from > c.to && c.to > 0)
  const isEl = (S: Side, a: number, e: string) => S.el.get(a) === e
  const pairEl = (S: Side, c: { a: number; b: number }) => [S.el.get(c.a)!, S.el.get(c.b)!].sort().join('')

  // 1. ацил–O (этерификация / гидролиз / омыление / эфиры HNO₃, H₂SO₄)
  // (алкилирование C₂H₅OSO₃H + ROH → эфир идёт именно по O–алкилу — там правило не применяется)
  if (['esterification', 'hydrolysis', 'nitration'].includes(r.type)) {
    for (const c of r.changes) {
      for (const [S, ch] of [[L, c.from > 0 && c.to === 0], [R, c.from === 0 && c.to > 0]] as const) {
        if (!ch) continue
        for (const [o, cc] of [[c.a, c.b], [c.b, c.a]]) {
          const alk = esterOAlkyl(S, o)
          if (alk !== null && alk === cc) {
            hit('ester-acyl-O')
            bad('ester-acyl-O', `${S === L ? 'рвётся' : 'образуется'} связь O–алкил (O#${o}–C#${cc}) вместо ацил–O`)
          }
        }
      }
    }
    if (r.type === 'esterification' || r.type === 'hydrolysis') hit('ester-acyl-O')
  }

  // 2/6. Марковников: C=C или C≡C понижает кратность, к одному C садится H, к другому — гетероатом
  for (const c of lowered.concat(broken.filter(() => false))) {
    if (!isEl(L, c.a, 'C') || !isEl(L, c.b, 'C')) continue
    const gets = (x: number) => formed.filter((f) => f.a === x || f.b === x).map((f) => (f.a === x ? f.b : f.a))
    const gA = gets(c.a)
    const gB = gets(c.b)
    const het = (g: number[]) => g.some((y) => !['H', 'C'].includes(L.el.get(y)!))
    const hyd = (g: number[]) => g.some((y) => L.el.get(y) === 'H')
    // Кучеров: O садится двойной связью (енол → карбонил) — гетероатом может прийти как к любому из двух C
    let xC: number | null = null
    let hC: number | null = null
    if (het(gA) && !het(gB) && hyd(gB)) [xC, hC] = [c.a, c.b]
    else if (het(gB) && !het(gA) && hyd(gA)) [xC, hC] = [c.b, c.a]
    if (xC === null || hC === null) continue
    if (!['hydrohalogenation', 'hydration', 'addition', 'halogenation'].includes(r.type)) continue
    hit('markovnikov')
    if (hCount(L, hC) < hCount(L, xC)) bad('markovnikov', `H садится к C#${hC} (H: ${hCount(L, hC)}), X — к C#${xC} (H: ${hCount(L, xC)}) — против Марковникова`)
  }

  // 3. Зайцев: рвётся C–X (X = O / Hal), у Cα повышается кратность C–C к Cβ, Cβ теряет H
  if (['dehydration', 'dehydrohalogenation', 'elimination', 'isomerization'].includes(r.type)) {
    for (const c of broken) {
      const pe = pairEl(L, c)
      let ca: number | null = null
      if (pe === 'CO' || ['CCl', 'BrC', 'CI', 'CF'].includes(pe)) ca = isEl(L, c.a, 'C') ? c.a : c.b
      if (ca === null) continue
      const raised = r.changes.filter((x) => x.to > x.from && x.from > 0 && (x.a === ca || x.b === ca) && isEl(L, x.a, 'C') && isEl(L, x.b, 'C'))
      for (const rz of raised) {
        const cb = rz.a === ca ? rz.b : rz.a
        const lostH = broken.some((x) => (x.a === cb || x.b === cb) && (isEl(L, x.a, 'H') || isEl(L, x.b, 'H')))
        if (!lostH) continue
        hit('zaitsev')
        const betas = [...L.nb.get(ca)!.keys()].filter((y) => isEl(L, y, 'C') && hCount(L, y) > 0)
        const minH = Math.min(...betas.map((y) => hCount(L, y)))
        if (hCount(L, cb) > minH) bad('zaitsev', `H уходит от C#${cb} (H: ${hCount(L, cb)}), а у соседа Cα есть C с ${minH} H — против Зайцева`)
      }
    }
  }

  // 4. замещение H → X: X садится на тот же C, от которого ушёл H, H уходит в HX / H₂O
  if (['substitutionRadical', 'substitution', 'nitration', 'sulfonation', 'halogenation'].includes(r.type)) {
    for (const f of formed) {
      const cc = isEl(R, f.a, 'C') ? f.a : isEl(R, f.b, 'C') ? f.b : null
      if (cc === null) continue
      const x = cc === f.a ? f.b : f.a
      const xe = R.el.get(x)!
      if (!(HAL.has(xe) || xe === 'N' || xe === 'S')) continue
      // ушёл ли H от этого C
      const hLost = broken.filter((b) => (b.a === cc || b.b === cc) && (isEl(L, b.a, 'H') || isEl(L, b.b, 'H'))).map((b) => (b.a === cc ? b.b : b.a))
      const xLost = broken.filter((b) => (b.a === cc || b.b === cc) && !isEl(L, b.a, 'H') && !isEl(L, b.b, 'H'))
      if (xLost.length) continue // замещение группы (OH → Cl и т. п.), не H
      // присоединение к C=C (Cl₂ к этилену) и радикал R• — не замещение H
      if (lowered.some((b) => (b.a === cc || b.b === cc) && isEl(L, b.a, 'C') && isEl(L, b.b, 'C'))) continue
      if ([...L.nb.get(cc)!.values()].reduce((x, y) => x + y, 0) < 4) continue
      hit('subst-H')
      if (hLost.length === 0) {
        bad('subst-H', `${xe}#${x} садится на C#${cc}, но этот C не теряет H`)
        continue
      }
      // куда ушёл H: должен стать частью HX/H₂O (связан с гетероатомом справа)
      const h = hLost[0]
      const hn = [...R.nb.get(h)!.keys()]
      if (!hn.length || ['C', 'H'].includes(R.el.get(hn[0])!)) bad('subst-H', `H#${h} от C#${cc} не уходит в HX/H₂O (связан с ${hn.map((y) => R.el.get(y)).join(',') || '—'})`)
      if (xe === 'N' && r.type === 'nitration') {
        // O воды — из HNO₃
        for (let k = 0; k < r.species.length; k++) {
          const s = r.species[k]
          if (s.side !== 'R' || s.ref !== 'inorg:H2O') continue
          const o = s.map[s.atoms.findIndex((a) => a.el === 'O')]
          const ln = [...L.nb.get(o)!.keys()].filter((y) => L.el.get(y) !== 'H')
          hit('nitration-water')
          if (!ln.some((y) => L.el.get(y) === 'N')) bad('nitration-water', `O воды #${o} не из HNO₃`)
        }
      }
    }
    // кольцо бензола не меняется
    const ringChange = r.changes.filter((c) => {
      const la = r.species.find((s) => s.side === 'L' && s.map.includes(c.a))
      if (!la) return false
      const ia = la.map.indexOf(c.a)
      const ib = la.map.indexOf(c.b)
      return ib >= 0 && la.atoms[ia].ar && la.atoms[ib].ar
    })
    if (r.type !== 'addition' && ringChange.length) {
      hit('arene-kept')
      bad('arene-kept', `меняются связи бензольного кольца (${ringChange.length})`)
    }
  }

  // 5. присоединение H₂ / Hal₂ к C=C — оба атома из одной молекулы
  if (['hydrogenation', 'halogenation'].includes(r.type)) {
    for (const c of lowered) {
      if (!isEl(L, c.a, 'C') || !isEl(L, c.b, 'C')) continue
      const add = (x: number) => formed.filter((f) => (f.a === x || f.b === x) && !isEl(L, f.a === x ? f.b : f.a, 'C')).map((f) => (f.a === x ? f.b : f.a))
      // бензол + 3H₂: кольцо ароматическое, пары H по формуле Кекуле не задаются учебником
      if (r.species.some((s) => s.side === 'L' && s.map.some((m, i) => (m === c.a || m === c.b) && s.atoms[i].ar))) continue
      const A = add(c.a)
      const B = add(c.b)
      if (!A.length || !B.length) continue
      hit('addition-pair')
      const ok = A.some((y) => B.some((z) => order(L, y, z) > 0))
      if (!ok) bad('addition-pair', `к C#${c.a} и C#${c.b} садятся атомы из разных молекул`)
    }
  }

  // 7. полимеризация
  if (r.type === 'polymerization') {
    const wasMulti = new Set<number>()
    for (const c of lowered) if (isEl(L, c.a, 'C') && isEl(L, c.b, 'C')) [c.a, c.b].forEach((x) => wasMulti.add(x))
    for (const f of formed) {
      if (!isEl(L, f.a, 'C') || !isEl(L, f.b, 'C')) continue
      hit('polymer')
      if (!wasMulti.has(f.a) || !wasMulti.has(f.b)) bad('polymer', `новая C–C (C#${f.a}–C#${f.b}) не между атомами бывших кратных связей`)
    }
  }

  // 8. Вюрц
  if (r.type === 'wurtz') {
    for (const f of formed) {
      if (!isEl(L, f.a, 'C') || !isEl(L, f.b, 'C')) continue
      hit('wurtz')
      const lostHal = (x: number) => [...L.nb.get(x)!.keys()].some((y) => HAL.has(L.el.get(y)!) && order(R, x, y) === 0)
      if (!lostHal(f.a) || !lostHal(f.b)) bad('wurtz', `новая C–C (C#${f.a}–C#${f.b}) не между атомами, потерявшими галоген`)
    }
    for (const f of formed) {
      const na = isEl(R, f.a, 'Na') ? f.a : isEl(R, f.b, 'Na') ? f.b : null
      if (na === null) continue
      const hal = na === f.a ? f.b : f.a
      if (!HAL.has(R.el.get(hal)!)) continue
      hit('wurtz')
      const was = [...L.nb.get(hal)!.keys()].some((y) => L.el.get(y) === 'C')
      if (!was) bad('wurtz', `Hal#${hal} в NaHal не из галогеналкана`)
    }
  }

  // 9. окисление альдегида: C=O альдегида сохраняется (2→2), новый O на тот же C
  if (r.type === 'oxidation') {
    for (const [c, nbs] of L.nb) {
      if (L.el.get(c) !== 'C') continue
      const oDouble = [...nbs].filter(([y, o]) => o === 2 && L.el.get(y) === 'O').map(([y]) => y)
      if (oDouble.length !== 1 || hCount(L, c) === 0) continue
      const isAld = [...nbs.keys()].filter((y) => L.el.get(y) !== 'H').length <= 2
      if (!isAld) continue
      const gainsO = formed.some((f) => (f.a === c || f.b === c) && L.el.get(f.a === c ? f.b : f.a) === 'O')
      if (!gainsO) continue
      hit('aldehyde-ox')
      const o = oDouble[0]
      if (order(R, c, o) !== 2) bad('aldehyde-ox', `C=O альдегида (C#${c}=O#${o}) меняется на ${order(R, c, o) || 'разрыв'} — новый O должен прийти отдельно`)
    }
  }

  // 10. брожение
  if (r.type === 'fermentation') {
    hit('fermentation')
    const ccF = formed.filter((f) => pairEl(L, f) === 'CC').length
    const ccB = broken.filter((f) => pairEl(L, f) === 'CC').length
    if (ccF > 0 || ccB > 3) bad('fermentation', `C–C образуется ${ccF}, рвётся ${ccB}`)
  }

  // 11. общий запрет перестановки скелета
  if (!CC_CHANGES_OK.has(r.type)) {
    const ccF = formed.filter((f) => pairEl(L, f) === 'CC').length
    const ccB = broken.filter((f) => pairEl(L, f) === 'CC').length
    hit('skeleton')
    if (ccF > 0 && ccB > 0) bad('skeleton', `одновременно рвётся ${ccB} и образуется ${ccF} связей C–C`)
  }
  return out
}

type Mut = { species: { side: 'L' | 'R'; map: number[]; atoms: readonly { el: string; ar?: boolean }[]; bonds: readonly { a: number; b: number; o: number; ar?: boolean }[] }[] }

/** changes = разница связей по номерам соответствия (как bond_changes в ov2_mapper.py). */
export function recomputeChanges(r: Mut): OV2BondChange[] {
  const key = (a: number, b: number) => (a < b ? a * 100000 + b : b * 100000 + a)
  const Lb = new Map<number, [number, boolean]>()
  const Rb = new Map<number, [number, boolean]>()
  for (const s of r.species) {
    const M = s.side === 'L' ? Lb : Rb
    for (const b of s.bonds) M.set(key(s.map[b.a], s.map[b.b]), [b.o, !!b.ar])
  }
  const out: OV2BondChange[] = []
  for (const k of new Set([...Lb.keys(), ...Rb.keys()])) {
    const l = Lb.get(k)
    const rr = Rb.get(k)
    if (l && rr && l[1] && rr[1]) continue
    const f = l ? l[0] : 0
    const t = rr ? rr[0] : 0
    if (f !== t) out.push({ a: Math.floor(k / 100000), b: k % 100000, from: f as 0 | 1 | 2 | 3, to: t as 0 | 1 | 2 | 3 })
  }
  out.sort((x, y) => x.a - y.a || x.b - y.b)
  return out
}

const changeCost = (r: OV2Reaction, ch: readonly OV2BondChange[]) => {
  const el = new Map<number, string>()
  for (const s of r.species) if (s.side === 'L') s.atoms.forEach((a, i) => el.set(s.map[i], a.el))
  let c = 0
  for (const x of ch) c += 1 + (el.get(x.a) === 'C' && el.get(x.b) === 'C' ? 0.5 : 0)
  return c
}

/**
 * Исправляет соответствие атомов перестановками номеров справа: тяжёлые атомы одного элемента меняются местами
 * (одиночные обмены, затем двойные с участием атома-нарушителя), водороды после каждого обмена
 * переназначаются «за своим соседом». Цель — нет нарушений механизмов и минимум изменённых связей.
 * Возвращает новую реакцию или null (нарушений нет).
 */
export function fixMechanisms(r0: OV2Reaction): OV2Reaction | null {
  const v0 = mechanismViolations(r0)
  if (!v0.length) return null
  const r = JSON.parse(JSON.stringify(r0)) as OV2Reaction & Mut
  const Ladj = new Map<number, number[]>()
  const Lel = new Map<number, string>()
  for (const s of r.species) {
    if (s.side !== 'L') continue
    s.atoms.forEach((a, i) => { Lel.set(s.map[i], a.el); Ladj.set(s.map[i], []) })
    for (const b of s.bonds) { Ladj.get(s.map[b.a])!.push(s.map[b.b]); Ladj.get(s.map[b.b])!.push(s.map[b.a]) }
  }
  const pos: [number, number][] = []
  r.species.forEach((s, k) => { if (s.side === 'R') s.atoms.forEach((_, i) => pos.push([k, i])) })
  const heavy = pos.filter(([k, i]) => r.species[k].atoms[i].el !== 'H')
  const hyd = pos.filter(([k, i]) => r.species[k].atoms[i].el === 'H')
  const rNb = new Map<string, [number, number][]>()
  r.species.forEach((s, k) => {
    if (s.side !== 'R') return
    for (const b of s.bonds) {
      const A = `${k}:${b.a}`, B = `${k}:${b.b}`
      if (!rNb.has(A)) rNb.set(A, [])
      if (!rNb.has(B)) rNb.set(B, [])
      rNb.get(A)!.push([k, b.b]); rNb.get(B)!.push([k, b.a])
    }
  })
  /** водороды — за своим тяжёлым соседом (как шаг 3 ov2_mapper.py) */
  const assignH = () => {
    const pool = new Set(hyd.map(([k, i]) => r.species[k].map[i]))
    const rest: [number, number][] = []
    for (const [k, i] of hyd) {
      const hn = (rNb.get(`${k}:${i}`) ?? []).find(([kk, ii]) => r.species[kk].atoms[ii].el !== 'H')
      let got: number | undefined
      if (hn) {
        const mh = r.species[hn[0]].map[hn[1]]
        const cur = r.species[k].map[i]
        const opts = (Ladj.get(mh) ?? []).filter((x) => Lel.get(x) === 'H' && pool.has(x))
        got = opts.includes(cur) ? cur : opts[0]
      }
      if (got === undefined) rest.push([k, i])
      else { pool.delete(got); r.species[k].map[i] = got }
    }
    const left = [...pool].sort((x, y) => x - y)
    for (const [k, i] of rest) r.species[k].map[i] = left.shift()!
  }
  const W = (v: Violation[]) => v.reduce((s, x) => s + (x.rule === 'skeleton' ? 3000 : 1000), 0)
  const score = () => {
    assignH()
    const ch = recomputeChanges(r)
    ;(r as { changes: OV2BondChange[] }).changes = ch
    return W(mechanismViolations(r)) + changeCost(r, ch)
  }
  const snap = () => r.species.map((s) => s.map.slice())
  const restore = (m: number[][]) => r.species.forEach((s, k) => { s.map = m[k].slice() })
  const swap = (x: [number, number], y: [number, number]) => {
    const s1 = r.species[x[0]], s2 = r.species[y[0]]
    const m = s1.map[x[1]]
    s1.map[x[1]] = s2.map[y[1]]
    s2.map[y[1]] = m
  }
  /** перестановки номеров справа по отображению m: номер x → m(x) */
  const relabel = (m: Map<number, number>) => {
    for (const s of r.species) if (s.side === 'R') s.map = s.map.map((x) => m.get(x) ?? x)
  }
  const groupMoves = (): (() => void)[] => {
    const mv: (() => void)[] = []
    // кольца: простые циклы из 6 ароматических атомов
    r.species.forEach((s) => {
      if (s.side !== 'R') return
      const adj = new Map<number, number[]>()
      for (const b of s.bonds) if (b.ar) {
        if (!adj.has(b.a)) adj.set(b.a, [])
        if (!adj.has(b.b)) adj.set(b.b, [])
        adj.get(b.a)!.push(b.b); adj.get(b.b)!.push(b.a)
      }
      const seen = new Set<number>()
      for (const st of adj.keys()) {
        if (seen.has(st) || adj.get(st)!.length !== 2) continue
        const ring = [st]
        let prev = -1, cur = st
        for (let g = 0; g < 7; g++) {
          const nx = adj.get(cur)!.find((x) => x !== prev && adj.get(x)!.length === 2)
          if (nx === undefined || nx === st) break
          ring.push(nx); prev = cur; cur = nx
        }
        ring.forEach((x) => seen.add(x))
        if (ring.length !== 6) continue
        for (let rot = 0; rot < 6; rot++) for (const refl of [false, true]) {
          if (rot === 0 && !refl) continue
          mv.push(() => {
            const vals = ring.map((i) => s.map[i])
            ring.forEach((i, j) => { s.map[i] = vals[refl ? (6 - j + rot) % 6 : (j + rot) % 6] })
          })
        }
      }
    })
    // одинаковые молекулы слева
    const L = r.species.filter((s) => s.side === 'L')
    for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      if (L[a].ref !== L[b].ref || L[a].map.length !== L[b].map.length || L[a].map.length < 3) continue
      mv.push(() => {
        const m = new Map<number, number>()
        L[a].map.forEach((x, i) => { m.set(x, L[b].map[i]); m.set(L[b].map[i], x) })
        relabel(m)
      })
    }
    return mv
  }
  let best = score()
  let bestMap = snap()
  const sameEl = (x: [number, number], y: [number, number]) => r.species[x[0]].atoms[x[1]].el === r.species[y[0]].atoms[y[1]].el
  for (let round = 0; round < 10; round++) {
    const hot = new Set<number>()
    for (const c of r.changes) { hot.add(c.a); hot.add(c.b) }
    for (const m of [...hot]) for (const y of Ladj.get(m) ?? []) hot.add(y)
    const cand = heavy.filter(([k, i]) => hot.has(r.species[k].map[i]))
    const pairs: [[number, number], [number, number]][] = []
    for (let x = 0; x < cand.length; x++) for (let y = x + 1; y < cand.length; y++) if (sameEl(cand[x], cand[y])) pairs.push([cand[x], cand[y]])
    let improved = false
    for (const [x, y] of pairs) {
      swap(x, y)
      const sc = score()
      if (sc < best - 1e-9) { best = sc; bestMap = snap(); improved = true }
      else restore(bestMap)
    }
    if (improved) continue
    // поворот / отражение бензольного кольца справа (12 симметрий) и обмен целых одинаковых молекул слева
    for (const mv of groupMoves()) {
      const before = snap()
      mv()
      const sc = score()
      if (sc < best - 1e-9) { best = sc; bestMap = snap(); improved = true }
      else restore(before)
    }
    if (improved) continue
    // двойные обмены: первый — с участием атома из сообщения о нарушении
    const vs = mechanismViolations(r)
    if (!vs.length || cand.length > 40) break
    const vAtoms = new Set<number>()
    for (const v of vs) for (const m of v.msg.matchAll(/#(\d+)/g)) vAtoms.add(+m[1])
    const first = pairs.filter(([x, y]) => vAtoms.has(r.species[x[0]].map[x[1]]) || vAtoms.has(r.species[y[0]].map[y[1]]))
    for (const [x, y] of first) {
      for (const [u, w] of pairs) {
        if ((u === x && w === y)) continue
        swap(x, y); swap(u, w)
        const sc = score()
        if (sc < best - 1e-9) { best = sc; bestMap = snap(); improved = true; break }
        restore(bestMap)
      }
      if (improved) break
    }
    if (!improved) break
  }
  restore(bestMap)
  // форма Кекуле справа — как слева (после поворота кольца двойные связи не должны «прыгать»)
  const Lar = new Map<string, number>()
  for (const s of r.species) if (s.side === 'L') for (const b of s.bonds) if (b.ar) {
    const A = s.map[b.a], B = s.map[b.b]
    Lar.set(A < B ? `${A}-${B}` : `${B}-${A}`, b.o)
  }
  for (const s of r.species) if (s.side === 'R') for (const b of s.bonds as { a: number; b: number; o: number; ar?: boolean }[]) {
    if (!b.ar) continue
    const A = s.map[b.a], B = s.map[b.b]
    const o = Lar.get(A < B ? `${A}-${B}` : `${B}-${A}`)
    if (o !== undefined) b.o = o
  }
  score()
  return r
}
