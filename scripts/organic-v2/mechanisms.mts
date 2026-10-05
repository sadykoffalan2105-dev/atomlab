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
 * Исправляет соответствие атомов перестановками номеров справа (атомы одного элемента), пока нарушения
 * механизмов не исчезнут и число изменённых связей не станет минимальным. Возвращает новую реакцию или null.
 */
export function fixMechanisms(r0: OV2Reaction): OV2Reaction | null {
  const v0 = mechanismViolations(r0)
  if (!v0.length) return null
  const r = JSON.parse(JSON.stringify(r0)) as OV2Reaction & Mut
  const score = () => {
    const ch = recomputeChanges(r)
    ;(r as { changes: OV2BondChange[] }).changes = ch
    return mechanismViolations(r).length * 1000 + changeCost(r, ch)
  }
  let best = score()
  // атомы справа: [вид, индекс]
  const pos: [number, number][] = []
  r.species.forEach((s, k) => { if (s.side === 'R') s.atoms.forEach((_, i) => pos.push([k, i])) })
  for (let round = 0; round < 12; round++) {
    // кандидаты — атомы, участвующие в изменениях, и их соседи (номера соответствия)
    const hot = new Set<number>()
    for (const c of r.changes) { hot.add(c.a); hot.add(c.b) }
    for (const s of r.species) for (const b of s.bonds) {
      const A = s.map[b.a], B = s.map[b.b]
      if (hot.has(A) || hot.has(B)) { hot.add(A); hot.add(B) }
    }
    const cand = pos.filter(([k, i]) => hot.has(r.species[k].map[i]))
    let improved = false
    for (let x = 0; x < cand.length; x++) {
      for (let y = x + 1; y < cand.length; y++) {
        const [k1, i1] = cand[x], [k2, i2] = cand[y]
        const s1 = r.species[k1], s2 = r.species[k2]
        if (s1.atoms[i1].el !== s2.atoms[i2].el) continue
        const m1 = s1.map[i1], m2 = s2.map[i2]
        s1.map[i1] = m2; s2.map[i2] = m1
        const sc = score()
        if (sc < best - 1e-9) { best = sc; improved = true }
        else { s1.map[i1] = m1; s2.map[i2] = m2 }
      }
    }
    if (!improved) break
  }
  ;(r as { changes: OV2BondChange[] }).changes = recomputeChanges(r)
  return r
}
