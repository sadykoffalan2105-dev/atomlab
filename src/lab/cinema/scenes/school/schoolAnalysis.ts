import { ATOMIC_DATA } from '../../../../chemistry/data/atomicData'
import { bondAngleDeg, bondLengthPm } from '../../../../chemistry/data/bondData'
import { outerElectrons } from '../../../../chemistry/data/electronLevels'
import type { SchoolBondSpec, SchoolMoleculeSpec, SchoolPairOrigin, SchoolSceneSpec, SchoolVec3 } from './schoolSpec'

/**
 * РАЗБОР СПЕЦИФИКАЦИИ школьной сцены (чистые функции, без three): учёт электронов внешнего слоя
 * по трём фазам и направления «мест» электронов у атомов.
 *
 * Фазы: R — реагенты (шаги reactants, atoms), S — после разрыва (breaking → pairs),
 * P — продукты (pairs → molecule, result). У каждого электрона внешнего слоя в каждой фазе ровно
 * одно место: общая пара связи, неподелённая пара или неспаренный электрон. Электрон сохраняет
 * «личность» между фазами: пара H–H расходится по одному электрону к своим атомам, а в пару O–H
 * приходит электрон атома H и электрон атома O (обменный механизм, как в учебнике).
 *
 * Любое несоответствие (не хватает электронов на пару, лишний электрон, чужой атом) — исключение
 * с понятным текстом: спецификацию правит химик, движок — нет.
 */

export type V3 = [number, number, number]

/** Место электрона в фазе. */
export type ElectronPlace =
  | { readonly kind: 'bond'; readonly bond: number; readonly pair: number; readonly slot: 0 | 1 }
  | { readonly kind: 'lone'; readonly atom: number; readonly pair: number; readonly slot: 0 | 1 }
  | { readonly kind: 'single'; readonly atom: number; readonly index: number }

export type PhaseBond = {
  readonly a: number
  readonly b: number
  readonly pairs: readonly SchoolPairOrigin[]
  /** Длина из ядра / спецификации, пм. */
  readonly lengthPm: number
  /** Индекс молекулы фазы. */
  readonly molecule: number
  /** Гетеролиз: атом, которому достаются оба электрона разрываемых пар (−1 — гомолиз). */
  readonly breakTo: number
}

export type PhaseAtom = {
  readonly lone: number
  readonly single: number
  /** Направления неподелённых пар и неспаренных электронов (единичные, система сцены). */
  readonly loneDirs: V3[]
  readonly singleDirs: V3[]
}

export type Phase = {
  readonly bonds: PhaseBond[]
  readonly atoms: PhaseAtom[]
  /** Заряд атома в фазе: электронов у него = электроны внешнего слоя − заряд. */
  readonly charge: number[]
  /** Координаты атомов в фазе, пм (система сцены). */
  readonly pos: V3[]
}

export type SchoolAtomInfo = {
  readonly id: string
  readonly element: SchoolSceneSpec['atoms'][number]['element']
  readonly z: number
  /** Электронов внешнего слоя (школьная схема слоёв). */
  readonly valence: number
  /** Ёмкость внешнего слоя в школьной модели: H — 2, остальные — 8. */
  readonly capacity: number
  readonly covalentPm: number
  readonly cpk: number
  readonly en: number
}

export type SchoolElectron = {
  readonly owner: number
  readonly r: ElectronPlace
  readonly s: ElectronPlace
  readonly p: ElectronPlace
  /** Номер разорванной пары (в SchoolAnalysis.broken) или −1. */
  readonly broken: number
  /** Номер образованной пары (в SchoolAnalysis.formed) или −1. */
  readonly formed: number
}

export type BrokenPair = { readonly rBond: number; readonly pair: number }
export type FormedPair = { readonly pBond: number; readonly pair: number; readonly sBond: number }

export type SchoolAnalysis = {
  readonly spec: SchoolSceneSpec
  readonly atoms: SchoolAtomInfo[]
  readonly index: ReadonlyMap<string, number>
  readonly R: Phase
  readonly S: Phase
  readonly P: Phase
  readonly electrons: SchoolElectron[]
  readonly broken: BrokenPair[]
  readonly formed: FormedPair[]
  /** Для связи продукта: сколько её пар сохранилось из реагентов (NO + O₂ → NO₂: у N=O — 2). */
  readonly persistPairs: number[]
  /** Для связи реагента: сколько её пар сохраняется. */
  readonly keptPairs: number[]
  /** Индекс связи фазы S (сохранившиеся связи) по связи продукта (−1 — связь новая). */
  readonly pToS: number[]
  readonly rToS: number[]
}

const fail = (spec: SchoolSceneSpec, msg: string): never => {
  throw new Error(`school scene «${spec.id}»: ${msg}`)
}

export function bondLengthOf(spec: SchoolSceneSpec, b: SchoolBondSpec): number {
  if (b.bondKey) return bondLengthPm(b.bondKey)
  if (b.lengthPm != null && b.source) return b.lengthPm
  return fail(spec, `у связи ${b.a}–${b.b} нет ни bondKey, ни lengthPm + source`)
}

export function angleDegOf(spec: SchoolSceneSpec, a: NonNullable<SchoolMoleculeSpec['angles']>[number]): number {
  if (a.angleKey) return bondAngleDeg(a.angleKey)
  if (a.deg != null && a.source) return a.deg
  return fail(spec, `у угла ${a.a}–${a.center}–${a.b} нет ни angleKey, ни deg + source`)
}

const pairKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)

function add(a: readonly number[], b: readonly number[]): V3 {
  return [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!]
}
function sub(a: readonly number[], b: readonly number[]): V3 {
  return [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
}
function len(a: readonly number[]): number {
  return Math.hypot(a[0]!, a[1]!, a[2]!)
}
function norm(a: readonly number[]): V3 {
  const l = len(a) || 1
  return [a[0]! / l, a[1]! / l, a[2]! / l]
}
function dot(a: readonly number[], b: readonly number[]): number {
  return a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
}
function scale(a: readonly number[], k: number): V3 {
  return [a[0]! * k, a[1]! * k, a[2]! * k]
}

/**
 * Расставляет свободные «домены» (неподелённые пары, неспаренные электроны) на сфере вокруг атома:
 * связи и заданные направления закреплены, свободные расталкиваются (модель отталкивания
 * электронных пар — как в VSEPR). Детерминированно: одинаковый результат в каждом прогоне.
 */
function relaxDomains(fixed: readonly V3[], freeCount: number, weights: readonly number[], planar = false): V3[] {
  if (freeCount === 0) return []
  if (planar) return relaxPlanar(fixed, freeCount, weights)
  const out: V3[] = []
  // Начальные направления: против суммы закреплённых, с разведением по кругу в плоскости,
  // перпендикулярной ей; лёгкий сдвиг к зрителю (+z), чтобы пары не прятались за шаром.
  let back: V3 = [0, 0, 0]
  for (const f of fixed) back = sub(back, f)
  if (len(back) < 1e-6) back = fixed.length ? norm([-fixed[0]![1], fixed[0]![0], 0.35]) : [0, 1, 0]
  back = norm(back)
  let t1 = norm(Math.abs(back[2]) < 0.9 ? [-back[1], back[0], 0] : [1, 0, 0])
  if (len(t1) < 1e-6) t1 = [1, 0, 0]
  const t2 = norm([back[1] * t1[2] - back[2] * t1[1], back[2] * t1[0] - back[0] * t1[2], back[0] * t1[1] - back[1] * t1[0]])
  for (let k = 0; k < freeCount; k++) {
    const ang = (2 * Math.PI * k) / freeCount + 0.3
    const spread = freeCount === 1 ? 0 : 0.9
    out.push(norm(add(add(back, scale(t1, Math.cos(ang) * spread)), add(scale(t2, Math.sin(ang) * spread), [0, 0, 0.12]))))
  }
  for (let it = 0; it < 400; it++) {
    for (let i = 0; i < out.length; i++) {
      let f: V3 = [0, 0, 0]
      const di = out[i]!
      const push = (dj: V3, w: number) => {
        const d = sub(di, dj)
        const l = Math.max(0.05, len(d))
        f = add(f, scale(d, w / (l * l * l)))
      }
      for (const fx of fixed) push(fx, 1)
      for (let j = 0; j < out.length; j++) if (j !== i) push(out[j]!, weights[j] ?? 1)
      // Касательная составляющая.
      const radial = dot(f, di)
      const tang = sub(f, scale(di, radial))
      out[i] = norm(add(di, scale(tang, 0.04)))
    }
  }
  return out
}

/**
 * Свободный атом (нет связей в фазе): у одиночного атома нет «формы», и его электроны рисуют в
 * плоскости рисунка, как точечную формулу учебника (·Ö·). Закреплённые направления (неспаренные
 * электроны к будущему партнёру) проецируются в плоскость; свободные расталкиваются по окружности.
 */
function relaxPlanar(fixed: readonly V3[], freeCount: number, weights: readonly number[]): V3[] {
  const fa = fixed.map((f) => Math.atan2(f[1], f[0]))
  let back: number
  if (fa.length) {
    let sx = 0
    let sy = 0
    for (const a of fa) {
      sx -= Math.cos(a)
      sy -= Math.sin(a)
    }
    back = Math.hypot(sx, sy) > 1e-6 ? Math.atan2(sy, sx) : fa[0]! + Math.PI
  } else back = Math.PI / 2
  const ang: number[] = []
  for (let k = 0; k < freeCount; k++) ang.push(back + ((k - (freeCount - 1) / 2) * 2 * Math.PI) / (freeCount + fa.length + 0.001))
  for (let it = 0; it < 500; it++) {
    for (let i = 0; i < ang.length; i++) {
      let f = 0
      const push = (a: number, w: number) => {
        let d = ang[i]! - a
        d = Math.atan2(Math.sin(d), Math.cos(d))
        const dd = Math.max(0.08, Math.abs(d))
        f += (Math.sign(d) * w) / (dd * dd)
      }
      for (const a of fa) push(a, 1)
      for (let j = 0; j < ang.length; j++) if (j !== i) push(ang[j]!, weights[j] ?? 1)
      ang[i] = ang[i]! + Math.max(-0.05, Math.min(0.05, f * 0.004))
    }
  }
  return ang.map((a) => [Math.cos(a), Math.sin(a), 0] as V3)
}

/** Сведения об элементе: z, электроны внешнего слоя, ёмкость слоя, CPK, ЭО. */
export function atomInfo(id: string, element: SchoolAtomInfo['element']): SchoolAtomInfo {
  const d = ATOMIC_DATA[element]
  return {
    id,
    element,
    z: d.z,
    valence: outerElectrons(d.z),
    capacity: d.z <= 2 ? 2 : 8,
    covalentPm: d.covalentRadiusPm,
    cpk: d.cpk,
    en: d.electronegativity ?? 2,
  }
}

export function analyzeSchoolSpec(spec: SchoolSceneSpec): SchoolAnalysis {
  const atoms = spec.atoms.map((a) => atomInfo(a.id, a.element))
  const index = new Map<string, number>()
  atoms.forEach((a, i) => {
    if (index.has(a.id)) fail(spec, `атом ${a.id} объявлен дважды`)
    index.set(a.id, i)
  })
  const idx = (id: string, where: string): number => index.get(id) ?? fail(spec, `${where}: неизвестный атом ${id}`)
  const n = atoms.length

  // ——— молекулы: каждый атом ровно в одной молекуле реагентов и продуктов ———
  const molOf = (list: readonly SchoolMoleculeSpec[], side: string): number[] => {
    const m = new Array<number>(n).fill(-1)
    list.forEach((mol, k) => {
      for (const id of mol.atoms) {
        const i = idx(id, `${side} ${mol.id}`)
        if (m[i] !== -1) fail(spec, `${side}: атом ${id} входит в две молекулы`)
        m[i] = k
        if (!mol.coords[id]) fail(spec, `${side} ${mol.id}: нет координат атома ${id}`)
      }
    })
    m.forEach((k, i) => k === -1 && fail(spec, `${side}: атом ${atoms[i]!.id} не входит ни в одну молекулу`))
    return m
  }
  molOf(spec.reactants, 'реагенты')
  molOf(spec.products, 'продукты')

  const posOf = (list: readonly SchoolMoleculeSpec[]): V3[] => {
    const out: V3[] = new Array(n)
    for (const mol of list) for (const id of mol.atoms) out[index.get(id)!] = add(mol.place, mol.coords[id]!)
    return out
  }
  const bondsOf = (list: readonly SchoolMoleculeSpec[], side: string): PhaseBond[] => {
    const out: PhaseBond[] = []
    const seen = new Set<string>()
    list.forEach((mol, k) => {
      for (const b of mol.bonds) {
        const a = idx(b.a, `${side} ${mol.id}`)
        const c = idx(b.b, `${side} ${mol.id}`)
        if (!mol.atoms.includes(b.a) || !mol.atoms.includes(b.b)) fail(spec, `${side} ${mol.id}: связь ${b.a}–${b.b} с атомом другой молекулы`)
        if (b.pairs.length < 1 || b.pairs.length > 3) fail(spec, `${side} ${mol.id}: порядок связи ${b.a}–${b.b} должен быть 1–3`)
        const key = pairKey(a, c)
        if (seen.has(key)) fail(spec, `${side}: связь ${b.a}–${b.b} объявлена дважды`)
        seen.add(key)
        out.push({ a, b: c, pairs: b.pairs, lengthPm: bondLengthOf(spec, b), molecule: k, breakTo: b.breakTo ? (b.breakTo === 'a' ? a : c) : -1 })
      }
    })
    return out
  }
  const rBonds = bondsOf(spec.reactants, 'реагенты')
  const pBonds = bondsOf(spec.products, 'продукты')
  const rPos = posOf(spec.reactants)
  const pPos = posOf(spec.products)
  const sPos: V3[] = atoms.map((a) => {
    const p = spec.split[a.id] ?? fail(spec, `split: нет позиции атома ${a.id}`)
    return [p[0], p[1], p[2]]
  })

  // ——— сохранившиеся, разорванные и новые пары ———
  const pByKey = new Map<string, number>()
  pBonds.forEach((b, k) => pByKey.set(pairKey(b.a, b.b), k))
  const keptPairs = rBonds.map(() => 0)
  const persistPairs = pBonds.map(() => 0)
  const sBonds: PhaseBond[] = []
  const rToS = rBonds.map(() => -1)
  const pToS = pBonds.map(() => -1)
  rBonds.forEach((b, k) => {
    const pk = pByKey.get(pairKey(b.a, b.b))
    if (pk === undefined) return
    const pb = pBonds[pk]!
    // Пары сравниваются в системе (a, b) реагента.
    const flip = pb.a !== b.a
    let kept = 0
    for (let q = 0; q < Math.min(b.pairs.length, pb.pairs.length); q++) {
      const po = pb.pairs[q]!
      const pInR = po === 'ab' ? 'ab' : flip ? (po === 'a' ? 'b' : 'a') : po
      if (pInR !== b.pairs[q]) break
      kept++
    }
    keptPairs[k] = kept
    persistPairs[pk] = kept
    if (kept > 0) {
      rToS[k] = sBonds.length
      pToS[pk] = sBonds.length
      sBonds.push({ a: b.a, b: b.b, pairs: b.pairs.slice(0, kept), lengthPm: b.lengthPm, molecule: -1, breakTo: -1 })
    }
  })
  const broken: BrokenPair[] = []
  rBonds.forEach((b, k) => {
    for (let q = keptPairs[k]!; q < b.pairs.length; q++) broken.push({ rBond: k, pair: q })
  })
  const formed: FormedPair[] = []
  pBonds.forEach((b, k) => {
    for (let q = persistPairs[k]!; q < b.pairs.length; q++) formed.push({ pBond: k, pair: q, sBond: pToS[k]! })
  })

  // ——— электроны: фаза R ———
  const nE = atoms.reduce((s, a) => s + a.valence, 0)
  const owner = new Array<number>(nE)
  const firstE: number[] = []
  {
    let e = 0
    atoms.forEach((a, i) => {
      firstE.push(e)
      for (let k = 0; k < a.valence; k++) owner[e++] = i
    })
  }
  const placeR = new Array<ElectronPlace>(nE)
  const placeS = new Array<ElectronPlace>(nE)
  const placeP = new Array<ElectronPlace>(nE)
  const brokenOf = new Array<number>(nE).fill(-1)
  const formedOf = new Array<number>(nE).fill(-1)

  const countMap = (list: readonly SchoolMoleculeSpec[], field: 'lonePairs' | 'unpaired' | 'charges'): number[] => {
    const out = new Array<number>(n).fill(0)
    for (const mol of list) {
      const m = mol[field]
      if (!m) continue
      for (const [id, c] of Object.entries(m)) {
        const i = idx(id, `${mol.id}.${field}`)
        if (!mol.atoms.includes(id)) fail(spec, `${mol.id}.${field}: атом ${id} не из этой молекулы`)
        out[i] = c
      }
    }
    return out
  }
  const rLone = countMap(spec.reactants, 'lonePairs')
  const rSingle = countMap(spec.reactants, 'unpaired')
  const pLone = countMap(spec.products, 'lonePairs')
  const pSingle = countMap(spec.products, 'unpaired')
  const rQ = countMap(spec.reactants, 'charges')
  const pQ = countMap(spec.products, 'charges')
  const sumQ = (q: number[]) => q.reduce((x, y) => x + y, 0)
  if (sumQ(rQ) !== sumQ(pQ)) fail(spec, `сумма зарядов реагентов (${sumQ(rQ)}) ≠ продуктов (${sumQ(pQ)})`)

  // Электроны, которыми атом распоряжается в фазе R: свои минус отданные (заряд > 0) плюс принятые
  // (заряд < 0). Перенос — по порядку атомов (ионы NH₄⁺ / NO₃⁻ и т. п.).
  const holdR: number[][] = atoms.map((a, i) => Array.from({ length: a.valence }, (_, k) => firstE[i]! + k))
  {
    const pool: number[] = []
    atoms.forEach((a, i) => {
      for (let c = 0; c < rQ[i]!; c++) pool.push(holdR[i]!.pop() ?? fail(spec, `реагенты: заряд ${a.id} больше числа его электронов`))
    })
    atoms.forEach((a, i) => {
      for (let c = 0; c < -rQ[i]!; c++) holdR[i]!.push(pool.shift() ?? fail(spec, `реагенты: заряду ${a.id} не хватает электронов других атомов`))
    })
  }

  // Электроны атома в фазе R: вклад в пары (по порядку связей), неподелённые пары, неспаренные.
  const rPairSlots: number[][][] = rBonds.map((b) => b.pairs.map(() => [-1, -1]))
  const rLoneSlots: number[][][] = atoms.map((_, i) => Array.from({ length: rLone[i]! }, () => [-1, -1]))
  const rSingleSlots: number[][] = atoms.map((_, i) => new Array<number>(rSingle[i]!).fill(-1))
  atoms.forEach((a, i) => {
    const hold = holdR[i]!
    let e = 0
    const end = hold.length
    const take = (): number => (e < end ? hold[e++]! : fail(spec, `реагенты: у атома ${a.id} не хватает электронов (${end})`))
    rBonds.forEach((b, k) => {
      if (b.a !== i && b.b !== i) return
      b.pairs.forEach((o, q) => {
        if (o === 'ab') {
          const slot = b.a === i ? 0 : 1
          const x = take()
          rPairSlots[k]![q]![slot] = x
          placeR[x] = { kind: 'bond', bond: k, pair: q, slot }
        } else if ((o === 'a' && b.a === i) || (o === 'b' && b.b === i)) {
          for (const slot of [0, 1] as const) {
            const x = take()
            rPairSlots[k]![q]![slot] = x
            placeR[x] = { kind: 'bond', bond: k, pair: q, slot }
          }
        }
      })
    })
    for (let q = 0; q < rLone[i]!; q++) {
      for (const slot of [0, 1] as const) {
        const x = take()
        rLoneSlots[i]![q]![slot] = x
        placeR[x] = { kind: 'lone', atom: i, pair: q, slot }
      }
    }
    for (let q = 0; q < rSingle[i]!; q++) {
      const x = take()
      rSingleSlots[i]![q] = x
      placeR[x] = { kind: 'single', atom: i, index: q }
    }
    if (e !== end) fail(spec, `реагенты: у атома ${a.id} ${end - e} электрон(а) без места (всего ${end})`)
  })

  // ——— фаза S: разрыв ———
  const sLone = new Array<number>(n).fill(0)
  const sSingle = new Array<number>(n).fill(0)
  const sLoneSlots: number[][][] = atoms.map(() => [])
  const sSingleSlots: number[][] = atoms.map(() => [])
  {
    // Свободные электроны атома после разрыва: сначала «парные» (неподелённые пары реагента и
    // донорские пары разорванных связей), потом одиночные (из пар 'ab' и неспаренные реагента).
    const pairedFree: number[][] = atoms.map(() => [])
    const singleFree: number[][] = atoms.map(() => [])
    atoms.forEach((_, i) => {
      for (const pr of rLoneSlots[i]!) pairedFree[i]!.push(pr[0]!, pr[1]!)
    })
    broken.forEach((bp, bi) => {
      const b = rBonds[bp.rBond]!
      const o = b.pairs[bp.pair]!
      const [x0, x1] = rPairSlots[bp.rBond]![bp.pair]! as [number, number]
      brokenOf[x0] = bi
      brokenOf[x1] = bi
      if (b.breakTo >= 0) {
        // Гетеролиз: пара целиком уходит к атому breakTo (H–Cl → H⁺ + Cl⁻).
        pairedFree[b.breakTo]!.push(x0, x1)
      } else if (o === 'ab') {
        singleFree[b.a]!.push(x0)
        singleFree[b.b]!.push(x1)
      } else {
        // Донорская пара уходит к донору целиком (гетеролиз).
        const donor = o === 'a' ? b.a : b.b
        pairedFree[donor]!.push(x0, x1)
      }
    })
    atoms.forEach((_, i) => {
      for (const x of rSingleSlots[i]!) singleFree[i]!.push(x)
    })
    // Сохранившиеся пары — на местах (индекс связи S).
    rBonds.forEach((b, k) => {
      for (let q = 0; q < keptPairs[k]!; q++) {
        const slots = rPairSlots[k]![q]!
        for (const slot of [0, 1] as const) placeS[slots[slot]!] = { kind: 'bond', bond: rToS[k]!, pair: q, slot }
      }
      void b
    })
    atoms.forEach((a, i) => {
      const free = [...pairedFree[i]!, ...singleFree[i]!]
      const ov = spec.splitElectrons?.[a.id]
      const lone = ov ? ov.lone : pairedFree[i]!.length / 2
      const single = ov ? ov.unpaired : singleFree[i]!.length
      if (2 * lone + single !== free.length) {
        fail(spec, `split: у атома ${a.id} ${free.length} свободных электронов, а задано ${lone} пар + ${single} неспаренных`)
      }
      sLone[i] = lone
      sSingle[i] = single
      let p = 0
      for (let q = 0; q < lone; q++) {
        const pr = [free[p++]!, free[p++]!]
        sLoneSlots[i]!.push(pr)
        placeS[pr[0]!] = { kind: 'lone', atom: i, pair: q, slot: 0 }
        placeS[pr[1]!] = { kind: 'lone', atom: i, pair: q, slot: 1 }
      }
      for (let q = 0; q < single; q++) {
        const x = free[p++]!
        sSingleSlots[i]!.push(x)
        placeS[x] = { kind: 'single', atom: i, index: q }
      }
    })
  }

  // Заряды фазы S: сколько электронов у атома после разрыва (сохранённые пары + свободные).
  const heldS = atoms.map((_, i) => {
    let c = 2 * sLone[i]! + sSingle[i]!
    for (const b of sBonds) {
      for (const o of b.pairs) {
        if (o === 'ab') {
          if (b.a === i || b.b === i) c += 1
        } else if ((o === 'a' && b.a === i) || (o === 'b' && b.b === i)) c += 2
      }
    }
    return c
  })
  const sQ = atoms.map((a, i) => a.valence - heldS[i]!)

  // ——— фаза P: образование пар ———
  const pPairSlots: number[][][] = pBonds.map((b) => b.pairs.map(() => [-1, -1]))
  // Доступные для продуктов электроны атома (копии списков S): при смене зарядов (ионы) лишние
  // электроны атома переходят к атому, которому их не хватает, — неспаренными.
  const availSingle: number[][] = sSingleSlots.map((l) => [...l])
  const availLone: number[][][] = sLoneSlots.map((l) => l.map((pr) => [...pr]))
  {
    const moved: number[] = []
    atoms.forEach((a, i) => {
      let surplus = heldS[i]! - (a.valence - pQ[i]!)
      while (surplus > 0) {
        const x = availSingle[i]!.pop()
        if (x !== undefined) moved.push(x)
        else {
          const pr = availLone[i]!.pop() ?? fail(spec, `продукты: у атома ${a.id} нечего отдать для заряда ${pQ[i]}`)
          moved.push(pr[1]!)
          availSingle[i]!.push(pr[0]!)
        }
        surplus--
      }
    })
    atoms.forEach((a, i) => {
      let deficit = a.valence - pQ[i]! - heldS[i]!
      while (deficit > 0) {
        availSingle[i]!.push(moved.shift() ?? fail(spec, `продукты: атому ${a.id} не хватает электронов для заряда ${pQ[i]}`))
        deficit--
      }
    })
  }
  {
    const usedSingle = atoms.map(() => new Set<number>())
    const usedLone = atoms.map(() => new Set<number>())
    // Сохранившиеся пары.
    rBonds.forEach((rb, k) => {
      const pk = pByKey.get(pairKey(rb.a, rb.b))
      if (pk === undefined) return
      const flip = pBonds[pk]!.a !== rb.a
      for (let q = 0; q < keptPairs[k]!; q++) {
        const slots = rPairSlots[k]![q]!
        for (const slot of [0, 1] as const) {
          const ps = (flip ? 1 - slot : slot) as 0 | 1
          pPairSlots[pk]![q]![ps] = slots[slot]!
          placeP[slots[slot]!] = { kind: 'bond', bond: pk, pair: q, slot: ps }
        }
      }
    })
    const takeSingle = (i: number, what: string): number => {
      const list = availSingle[i]!
      for (const x of list) {
        if (!usedSingle[i]!.has(x)) {
          usedSingle[i]!.add(x)
          return x
        }
      }
      return fail(spec, `${what}: у атома ${atoms[i]!.id} нет неспаренного электрона для общей пары`)
    }
    const takeLone = (i: number, what: string): [number, number] => {
      const list = availLone[i]!
      for (let q = 0; q < list.length; q++) {
        if (!usedLone[i]!.has(q)) {
          usedLone[i]!.add(q)
          return [list[q]![0]!, list[q]![1]!]
        }
      }
      return fail(spec, `${what}: у атома-донора ${atoms[i]!.id} нет неподелённой пары`)
    }
    formed.forEach((fp, fi) => {
      const b = pBonds[fp.pBond]!
      const o = b.pairs[fp.pair]!
      const what = `пара ${fp.pair + 1} связи ${atoms[b.a]!.id}–${atoms[b.b]!.id}`
      let x0: number
      let x1: number
      if (o === 'ab') {
        x0 = takeSingle(b.a, what)
        x1 = takeSingle(b.b, what)
      } else {
        ;[x0, x1] = takeLone(o === 'a' ? b.a : b.b, what)
      }
      pPairSlots[fp.pBond]![fp.pair] = [x0, x1]
      placeP[x0] = { kind: 'bond', bond: fp.pBond, pair: fp.pair, slot: 0 }
      placeP[x1] = { kind: 'bond', bond: fp.pBond, pair: fp.pair, slot: 1 }
      formedOf[x0] = fi
      formedOf[x1] = fi
    })
    atoms.forEach((a, i) => {
      const rest: number[] = []
      availLone[i]!.forEach((pr, q) => {
        if (!usedLone[i]!.has(q)) rest.push(pr[0]!, pr[1]!)
      })
      for (const x of availSingle[i]!) if (!usedSingle[i]!.has(x)) rest.push(x)
      if (2 * pLone[i]! + pSingle[i]! !== rest.length) {
        fail(spec, `продукты: у атома ${a.id} после образования пар осталось ${rest.length} электрон(ов), а задано ${pLone[i]} неподелённых пар + ${pSingle[i]} неспаренных`)
      }
      let p = 0
      for (let q = 0; q < pLone[i]!; q++) {
        placeP[rest[p++]!] = { kind: 'lone', atom: i, pair: q, slot: 0 }
        placeP[rest[p++]!] = { kind: 'lone', atom: i, pair: q, slot: 1 }
      }
      for (let q = 0; q < pSingle[i]!; q++) placeP[rest[p++]!] = { kind: 'single', atom: i, index: q }
    })
  }

  // ——— направления мест у атомов ———
  const dirsFor = (bonds: readonly PhaseBond[], pos: readonly V3[], lone: readonly number[], single: readonly number[], singleTargets?: (i: number) => V3[]): PhaseAtom[] =>
    atoms.map((_, i) => {
      const fixed: V3[] = []
      for (const b of bonds) {
        if (b.a === i) fixed.push(norm(sub(pos[b.b]!, pos[i]!)))
        else if (b.b === i) fixed.push(norm(sub(pos[b.a]!, pos[i]!)))
      }
      const targets = singleTargets?.(i) ?? []
      const singleDirs: V3[] = targets.slice(0, single[i]!)
      const nFreeSingle = single[i]! - singleDirs.length
      const relaxed = relaxDomains(
        [...fixed, ...singleDirs],
        lone[i]! + nFreeSingle,
        [...new Array<number>(lone[i]!).fill(1.25), ...new Array<number>(nFreeSingle).fill(0.8)],
        fixed.length === 0,
      )
      return {
        lone: lone[i]!,
        single: single[i]!,
        loneDirs: relaxed.slice(0, lone[i]!),
        singleDirs: [...singleDirs, ...relaxed.slice(lone[i]!)],
      }
    })

  // В фазе S неспаренный электрон смотрит на атом, с которым он образует пару; несколько электронов
  // к одному партнёру (кратная связь) — веером в плоскости кадра.
  const sTargets = (i: number): V3[] => {
    const slots = sSingleSlots[i]!
    const partners = slots.map((x) => {
      const fi = formedOf[x]!
      if (fi < 0) return -1
      const b = pBonds[formed[fi]!.pBond]!
      return b.a === i ? b.b : b.a
    })
    const out: V3[] = []
    slots.forEach((_, q) => {
      const p = partners[q]!
      if (p < 0) return
      const same = partners.filter((v) => v === p).length
      const j = partners.slice(0, q).filter((v) => v === p).length
      const d0 = sub(sPos[p]!, sPos[i]!)
      const d = norm(Math.hypot(d0[0], d0[1]) > 1e-3 ? [d0[0], d0[1], 0] : d0)
      const perp = Math.hypot(d[0], d[1]) > 1e-3 ? norm([-d[1], d[0], 0]) : ([0, 1, 0] as V3)
      out.push(norm(add(d, scale(perp, (j - (same - 1) / 2) * 0.46))))
    })
    return out
  }
  // Формирующиеся неспаренные электроны идут первыми в списке слотов S.
  atoms.forEach((_, i) => {
    const slots = sSingleSlots[i]!
    slots.sort((x, y) => {
      const fx = formedOf[x]!
      const fy = formedOf[y]!
      return (fx < 0 ? 1e9 : fx) - (fy < 0 ? 1e9 : fy)
    })
    slots.forEach((x, q) => (placeS[x] = { kind: 'single', atom: i, index: q }))
  })

  const R: Phase = { bonds: rBonds, atoms: dirsFor(rBonds, rPos, rLone, rSingle), pos: rPos, charge: rQ }
  const S: Phase = { bonds: sBonds, atoms: dirsFor(sBonds, sPos, sLone, sSingle, sTargets), pos: sPos, charge: sQ }
  const P: Phase = { bonds: pBonds, atoms: dirsFor(pBonds, pPos, pLone, pSingle), pos: pPos, charge: pQ }

  const electrons: SchoolElectron[] = []
  for (let e = 0; e < nE; e++) {
    if (!placeR[e] || !placeS[e] || !placeP[e]) fail(spec, `электрон ${e} атома ${atoms[owner[e]!]!.id} без места`)
    electrons.push({ owner: owner[e]!, r: placeR[e]!, s: placeS[e]!, p: placeP[e]!, broken: brokenOf[e]!, formed: formedOf[e]! })
  }

  return { spec, atoms, index, R, S, P, electrons, broken, formed, persistPairs, keptPairs, pToS, rToS }
}

/** Электронов атома в фазе (вклад в пары + 2 · неподелённые + неспаренные) — для теста. */
export function electronsOfAtom(phase: Phase, i: number): number {
  let c = 0
  for (const b of phase.bonds) {
    b.pairs.forEach((o) => {
      if (o === 'ab') {
        if (b.a === i || b.b === i) c += 1
      } else if ((o === 'a' && b.a === i) || (o === 'b' && b.b === i)) c += 2
    })
  }
  return c + 2 * phase.atoms[i]!.lone + phase.atoms[i]!.single
}

/** Электронов на внешнем слое атома «в пользовании» (для заполнения облака): общие пары целиком. */
export function shellElectronsOfAtom(phase: Phase, i: number): number {
  let c = 0
  for (const b of phase.bonds) if (b.a === i || b.b === i) c += 2 * b.pairs.length
  return c + 2 * phase.atoms[i]!.lone + phase.atoms[i]!.single
}

export type { SchoolVec3 }
