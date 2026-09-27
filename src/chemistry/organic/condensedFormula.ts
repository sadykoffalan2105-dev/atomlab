/**
 * Сокращённая структурная формула учебника → скелет молекулы (тяжёлые атомы, их H, связи).
 *
 * «CH₃–CH₂Cl», «CH₂=CH–CH₃», «HC≡CH», «C₆H₅–CH=CH₂», «HOCH₂CH₂OH», «CH₃COOC₂H₅», «(CH₃)₂C=C(CH₃)₂»,
 * «CH₃–(CH₂)₈–CH₃», «CH₂OH(CHOH)₄CH₂OH», «C₃H₅(OH)₃», «(C₁₇H₃₅COO)₃C₃H₅», «CH₃–C₆H₂(NO₂)₃», полимерное
 * звено «(–CH₂–CH₂–)n». Запись читается слева направо: каждый атом садится на ближайший предыдущий атом
 * со свободной валентностью; кратность связи — из знака «=», «≡» или (без знака) наибольшая, какую
 * допускают оба атома (C=O у «CHO», «CO», «COO»). Скобка со свободной валентностью 1 — заместитель
 * («(CH₃)₂» — два метила), с валентностью 2 — повтор звена цепи («(CH₂)₈»).
 *
 * Брутто-формула (C₄H₁₀, C₆H₁₂O₆) строения не задаёт — null. Результат проверяется: все валентности
 * закрыты, состав совпадает с формулой. Модуль без зависимостей — годится и для скриптов сборки.
 */

export type SkeletonAtom = { el: string; h: number }
export type SkeletonBond = readonly [number, number, 1 | 2 | 3]
export type CondensedSkeleton = {
  atoms: SkeletonAtom[]
  bonds: SkeletonBond[]
  /** Атомы с открытой связью полимерного звена (по разу на связь). */
  open: number[]
}

/** Допустимые валентности; при разборе свободная валентность считается по первой. */
const VALENCES: Readonly<Record<string, readonly number[]>> = {
  C: [4], H: [1], O: [2], N: [3], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1],
  Li: [1], Na: [1], K: [1], Ag: [1], Mg: [2], Ca: [2], Ba: [2], Zn: [2], Cu: [2, 1], Fe: [3, 2], Al: [3],
}
const MONOVALENT_SUBST = new Set(['F', 'Cl', 'Br', 'I'])

type Unit = {
  /** атомы звена (индексы в общем списке) по порядку точек присоединения */
  attach: number[]
  /** точки присоединения для трёх одинаковых заместителей (C₆H₂: 2, 4, 6) */
  triple?: number[]
}

type Abbrev = {
  atoms: SkeletonAtom[]
  bonds: SkeletonBond[]
  attach: number[]
  triple?: number[]
}

const ring6 = (h: number[], aromatic: boolean): { atoms: SkeletonAtom[]; bonds: SkeletonBond[] } => ({
  atoms: h.map((n) => ({ el: 'C', h: n })),
  bonds: [0, 1, 2, 3, 4, 5].map((i) => [i, (i + 1) % 6, aromatic && i % 2 === 0 ? 2 : 1] as const),
})

/** н-Алкил CₙH₂ₙ₊₁ (точка присоединения — первый атом), dbl — двойная связь после атома с этим номером. */
function alkyl(n: number, dbl?: number): Abbrev {
  const atoms: SkeletonAtom[] = []
  const bonds: SkeletonBond[] = []
  for (let i = 0; i < n; i++) atoms.push({ el: 'C', h: i === n - 1 ? 3 : 2 })
  for (let i = 0; i + 1 < n; i++) bonds.push([i, i + 1, dbl === i ? 2 : 1])
  if (dbl != null) {
    atoms[dbl]!.h -= 1
    atoms[dbl + 1]!.h -= 1
  }
  if (n === 1) atoms[0]!.h = 3
  return { atoms, bonds, attach: [0] }
}

/** Группы, которые учебник пишет одним блоком. */
const ABBREVS: Readonly<Record<string, Abbrev>> = {
  C6H5: { ...ring6([0, 1, 1, 1, 1, 1], true), attach: [0] },
  // двузамещённый бензол «–C₆H₄–» в цепи: пара-положение (терефталевая кислота, лавсан); орто-изомеры
  // фенолформальдегидных продуктов учебник пишет без тире — они в таблице записей labOrganicSpecies
  C6H4: { ...ring6([0, 1, 1, 0, 1, 1], true), attach: [0, 3] },
  // четырёхзамещённый: 1 и 2, 4, 6 (тротил, 2,4,6-трибромфенол)
  C6H2: { ...ring6([0, 0, 1, 0, 1, 0], true), attach: [0, 1, 3, 5], triple: [1, 3, 5] },
  C6H11: { ...ring6([1, 2, 2, 2, 2, 2], false), attach: [0] },
  C2H5: alkyl(2),
  C3H7: alkyl(3),
  C4H9: alkyl(4),
  C15H31: alkyl(15),
  C17H35: alkyl(17),
  // остаток олеиновой кислоты: цис-двойная связь C9=C10 (от карбоксила) — атомы цепи 7 и 8
  C17H33: alkyl(17, 7),
  // остаток глицерина CH₂–CH–CH₂: по заместителю на каждый углерод
  C3H5: {
    atoms: [{ el: 'C', h: 2 }, { el: 'C', h: 1 }, { el: 'C', h: 2 }],
    bonds: [[0, 1, 1], [1, 2, 1]],
    attach: [0, 1, 2],
  },
  // готовые функциональные группы
  NO2: { atoms: [{ el: 'N', h: 0 }, { el: 'O', h: 0 }, { el: 'O', h: 0 }], bonds: [[0, 1, 2], [0, 2, 1]], attach: [0] },
  SO3H: {
    atoms: [{ el: 'S', h: 0 }, { el: 'O', h: 0 }, { el: 'O', h: 0 }, { el: 'O', h: 1 }],
    bonds: [[0, 1, 2], [0, 2, 2], [0, 3, 1]],
    attach: [0],
  },
  SO3Na: {
    atoms: [{ el: 'S', h: 0 }, { el: 'O', h: 0 }, { el: 'O', h: 0 }, { el: 'O', h: 0 }, { el: 'Na', h: 0 }],
    bonds: [[0, 1, 2], [0, 2, 2], [0, 3, 1], [3, 4, 1]],
    attach: [0],
  },
}
/** Нитрогруппа: N(=O)–O — у атома N четыре связи (формально N⁺–O⁻). */
const NITRO_N_EXTRA = 1

const ABBREV_RE = /^(C6H5|C6H4|C6H2|C6H11|C2H5|C3H7|C4H9|C15H31|C17H35|C17H33|C3H5|NO2|SO3H|SO3Na)(?![0-9a-z])/

type Tok =
  | { t: 'el'; el: string; n: number }
  | { t: 'abbr'; key: string }
  | { t: 'bond'; order: 1 | 2 | 3 }
  | { t: 'group'; body: string; mult: number }

function tokenize(s: string): Tok[] | null {
  const out: Tok[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    if (ch === '-' || ch === '–' || ch === '—') {
      out.push({ t: 'bond', order: 1 })
      i++
    } else if (ch === '=') {
      out.push({ t: 'bond', order: 2 })
      i++
    } else if (ch === '≡' || ch === '#') {
      out.push({ t: 'bond', order: 3 })
      i++
    } else if (ch === '(' || ch === '[') {
      const close = ch === '(' ? ')' : ']'
      let depth = 0
      let j = i
      for (; j < s.length; j++) {
        if (s[j] === '(' || s[j] === '[') depth++
        else if (s[j] === ')' || s[j] === ']') {
          depth--
          if (depth === 0) break
        }
      }
      if (j >= s.length || s[j] !== close) return null
      const body = s.slice(i + 1, j)
      let k = j + 1
      let num = ''
      while (k < s.length && /\d/.test(s[k]!)) num += s[k++]
      out.push({ t: 'group', body, mult: num ? Number(num) : 1 })
      i = k
    } else if (/[A-Z]/.test(ch)) {
      const ab = ABBREV_RE.exec(s.slice(i))
      if (ab) {
        out.push({ t: 'abbr', key: ab[1]! })
        i += ab[1]!.length
        continue
      }
      let el = ch
      i++
      if (i < s.length && /[a-z]/.test(s[i]!)) el += s[i++]
      if (!VALENCES[el]) return null
      let num = ''
      while (i < s.length && /\d/.test(s[i]!)) num += s[i++]
      out.push({ t: 'el', el, n: num ? Number(num) : 1 })
    } else if (/\s/.test(ch)) {
      i++
    } else {
      return null
    }
  }
  return out
}

class Builder {
  atoms: SkeletonAtom[] = []
  bonds: SkeletonBond[] = []
  used: number[] = []
  extra: number[] = []

  free(i: number): number {
    const a = this.atoms[i]!
    return (VALENCES[a.el]![0]! + (this.extra[i] ?? 0)) - a.h - this.used[i]!
  }
  add(a: SkeletonAtom): number {
    this.atoms.push({ ...a })
    this.used.push(0)
    this.extra.push(0)
    return this.atoms.length - 1
  }
  bond(a: number, b: number, order: 1 | 2 | 3) {
    this.bonds.push([a, b, order])
    this.used[a]! += order
    this.used[b]! += order
  }
  placeAbbrev(key: string): Unit {
    const ab = ABBREVS[key]!
    const base = this.atoms.length
    for (const a of ab.atoms) this.add(a)
    for (const [a, b, o] of ab.bonds) this.bond(base + a, base + b, o)
    if (key === 'SO3H' || key === 'SO3Na') this.extra[base] = 4
    if (key === 'NO2') {
      this.extra[base] = NITRO_N_EXTRA
      this.extra[base + 2] = -1
    }
    return { attach: ab.attach.map((k) => base + k), ...(ab.triple ? { triple: ab.triple.map((k) => base + k) } : {}) }
  }
}

type ParseCtx = {
  b: Builder
  /** звенья цепи по порядку записи */
  chain: Unit[]
}

/** Ближайшая точка присоединения со свободной валентностью (с конца цепи). */
function lastFree(ctx: ParseCtx, min = 1): number | null {
  for (let u = ctx.chain.length - 1; u >= 0; u--) {
    for (const i of ctx.chain[u]!.attach) if (ctx.b.free(i) >= min) return i
  }
  return null
}

function firstFreeOf(ctx: ParseCtx, unit: Unit, min = 1): number | null {
  for (const i of unit.attach) if (ctx.b.free(i) >= min) return i
  return null
}

/**
 * Разбор цепи (строки без внешних скобок). Возвращает звено-результат: точки присоединения,
 * у которых осталась свободная валентность (для группы в скобках).
 */
function parseChain(b: Builder, text: string): { units: Unit[]; first: number | null } | null {
  const toks = tokenize(text)
  if (!toks || toks.length === 0) return null
  const ctx: ParseCtx = { b, chain: [] }
  let pendingOrder: 1 | 2 | 3 | null = null
  let prefixH = 0
  /** заместители, записанные до атома, к которому они относятся: «(CH₃)₂C=», «(C₁₇H₃₅COO)₃C₃H₅» */
  let pendingSubs: number[] = []
  let first: number | null = null

  const attachNew = (unit: Unit): boolean => {
    const head = unit.attach[0]!
    if (first == null) first = head
    // отложенные заместители — на новое звено
    if (pendingSubs.length) {
      const pts = pendingSubs.length === 3 && unit.triple ? unit.triple : null
      for (const [k, s] of pendingSubs.entries()) {
        const at = pts ? pts[k]! : firstFreeOf(ctx, unit)
        if (at == null || b.free(at) < 1) return false
        b.bond(at, s, 1)
      }
      pendingSubs = []
    }
    if (ctx.chain.length > 0) {
      const order = pendingOrder
      const target = lastFree(ctx, order ?? 1)
      if (target == null) return false
      const mine = firstFreeOf(ctx, unit, order ?? 1)
      if (mine == null) return false
      const o = order ?? (Math.min(b.free(target), b.free(mine), 3) as 1 | 2 | 3)
      if (o < 1) return false
      b.bond(target, mine, o)
    }
    pendingOrder = null
    ctx.chain.push(unit)
    return true
  }

  for (let ti = 0; ti < toks.length; ti++) {
    const tok = toks[ti]!
    if (tok.t === 'bond') {
      pendingOrder = tok.order
      continue
    }
    if (tok.t === 'abbr') {
      const unit = b.placeAbbrev(tok.key)
      if (prefixH) return null
      if (!attachNew(unit)) return null
      continue
    }
    if (tok.t === 'group') {
      // «(=O)», «(O)» у карбонила — заместитель с двойной связью
      let body = tok.body
      let headOrder: 1 | 2 | 3 = 1
      if (/^[=≡#]/.test(body)) {
        headOrder = body[0] === '=' ? 2 : 3
        body = body.slice(1)
      } else if (body === 'O') headOrder = 2
      // каждая копия группы — отдельный разбор
      const copies: { units: Unit[]; first: number }[] = []
      for (let k = 0; k < tok.mult; k++) {
        const r = parseChain(b, body)
        if (!r || r.first == null) return null
        copies.push({ units: r.units, first: r.first })
      }
      const freeOf = (c: { units: Unit[] }) => {
        let f = 0
        const seen = new Set<number>()
        for (const u of c.units) {
          for (const i of u.attach) {
            if (seen.has(i)) continue
            seen.add(i)
            f += b.free(i)
          }
        }
        return f
      }
      const f = freeOf(copies[0]!)
      if (f === headOrder) {
        // заместители: к предыдущему звену или (в начале) к следующему
        const heads = copies.map((c) => {
          for (const u of c.units) for (const i of u.attach) if (b.free(i) >= 1) return i
          return c.first
        })
        if (ctx.chain.length === 0) {
          if (headOrder !== 1) return null
          pendingSubs.push(...heads)
          continue
        }
        const anchorUnit = ctx.chain[ctx.chain.length - 1]!
        const pts = heads.length === 3 && anchorUnit.triple && anchorUnit.triple.every((i) => b.free(i) >= 1) ? anchorUnit.triple : null
        for (const [k, h] of heads.entries()) {
          const at = pts ? pts[k]! : (firstFreeOf(ctx, anchorUnit, headOrder) ?? lastFree(ctx, headOrder))
          if (at == null) return null
          b.bond(at, h, headOrder)
        }
        pendingOrder = null
        continue
      }
      if (f === 2 && headOrder === 1) {
        // повтор звена цепи: «(CH₂)₈», «(CHOH)₄»
        for (const c of copies) {
          const pts: number[] = []
          for (const u of c.units) for (const i of u.attach) if (b.free(i) >= 1 && !pts.includes(i)) pts.push(i)
          if (!attachNew({ attach: pts })) return null
        }
        continue
      }
      return null
    }
    // элемент
    if (tok.el === 'H') {
      const prev = ctx.chain.length > 0 && toks[ti - 1]?.t === 'el' ? ctx.chain[ctx.chain.length - 1]! : null
      if (prev && prev.attach.length === 1 && pendingOrder == null) {
        // «CH₃», «OH» — водороды предыдущего атома
        const at = prev.attach[0]!
        b.atoms[at]!.h += tok.n
        if (b.free(at) < 0) return null
      } else {
        // «HO–», «H₂C=», «HCOOH» — водороды следующего атома
        prefixH += tok.n
      }
      continue
    }
    if (MONOVALENT_SUBST.has(tok.el) && ctx.chain.length > 0 && toks[ti - 1]?.t !== 'bond' && (tok.n > 1 || toks[ti - 1]?.t === 'el' || toks[ti - 1]?.t === 'abbr' || toks[ti - 1]?.t === 'group')) {
      // «CH₂Cl», «CHCl₃», «C₆H₂Br₃» — галогены предыдущего звена
      const anchorUnit = ctx.chain[ctx.chain.length - 1]!
      const pts = tok.n === 3 && anchorUnit.triple && anchorUnit.triple.every((i) => b.free(i) >= 1) ? anchorUnit.triple : null
      for (let k = 0; k < tok.n; k++) {
        const x = b.add({ el: tok.el, h: 0 })
        const at = pts ? pts[k]! : (firstFreeOf(ctx, anchorUnit) ?? lastFree(ctx))
        if (at == null) return null
        b.bond(at, x, 1)
      }
      continue
    }
    if (tok.n !== 1) return null // «C₂», «O₃» — брутто-запись, строения нет
    // водороды атома — до присоединения, иначе «CH₂OH» дал бы C=O
    let h = prefixH
    const nx = toks[ti + 1]
    if (nx?.t === 'el' && nx.el === 'H') {
      h += nx.n
      ti++
    }
    const idx = b.add({ el: tok.el, h })
    prefixH = 0
    if (b.free(idx) < 0) return null
    if (!attachNew({ attach: [idx] })) return null
  }
  if (prefixH || pendingSubs.length || pendingOrder != null) return null
  return { units: ctx.chain, first }
}

function toAscii(formula: string): string {
  return formula
    .replace(/[₀-₉]/g, (c) => String(c.charCodeAt(0) - 0x2080))
    .replace(/[•·∙]/g, '')
    .replace(/\s+/g, '')
}

/** Перестановки записи учебника, которые читаются справа налево: «HOOC–» = HO–C(=O)–, «KOOC–», «…COH» = …CHO. */
function normalizeSpelling(s: string): string {
  return s
    .replace(/^(H|Na|K)OOC(?=[-–—A-Z(]|$)/, '$1OC(=O)')
    .replace(/(\(CHOH\)\d)COH$/, '$1CHO')
}

/** Разбор записи; null — брутто-формула или запись, строение которой не восстановить однозначно. */
export function parseCondensedFormula(formulaRaw: string): CondensedSkeleton | null {
  let s = toAscii(formulaRaw)
  if (!s) return null
  // полимерное звено «(–CH₂–CH₂–)n» / «(–CH₂–CHCl–)ₙ»
  let polymer = false
  const pm = /^\((.*)\)n$/.exec(s.replace(/ₙ$/, 'n'))
  if (pm && /^[-–—]|[-–—]$/.test(pm[1]!)) {
    polymer = true
    s = pm[1]!.replace(/^[-–—]/, '').replace(/[-–—]$/, '')
    // «–OC–C₆H₄–CO–O–…» — карбонил в начале звена записан задом наперёд
    s = s.replace(/^OC(?=[-–—])/, 'C(=O)')
  }
  s = normalizeSpelling(s)
  const b = new Builder()
  const r = parseChain(b, s)
  if (!r) return null
  const open: number[] = []
  if (polymer) {
    // открытые связи — у первого и последнего атома цепи звена
    const heads = r.units.flatMap((u) => u.attach)
    const firstAt = heads.find((i) => b.free(i) >= 1)
    const lastAt = [...heads].reverse().find((i) => b.free(i) >= 1 && i !== firstAt)
    if (firstAt == null || lastAt == null) return null
    open.push(firstAt, lastAt)
    b.used[firstAt]! += 1
    b.used[lastAt]! += 1
  }
  for (let i = 0; i < b.atoms.length; i++) if (b.free(i) !== 0) return null
  return { atoms: b.atoms, bonds: b.bonds, open }
}

/** Состав скелета: {C: 2, H: 6, O: 1}. */
export function skeletonComposition(sk: Pick<CondensedSkeleton, 'atoms'>): Record<string, number> {
  const c: Record<string, number> = {}
  for (const a of sk.atoms) {
    c[a.el] = (c[a.el] ?? 0) + 1
    if (a.h) c.H = (c.H ?? 0) + a.h
  }
  return c
}

// ───────────────────────── упрощённый SMILES ─────────────────────────

/**
 * Упрощённый SMILES для веществ, которые учебник пишет брутто-формулой или особой записью (звено целлюлозы,
 * глюкозид, соли): атомы C N O S F Cl Br I, [Na] [K] [Ca] [Cu] [Fe] (в скобках — без неявных H),
 * «*» — открытая связь полимерного звена, циклы цифрами, «=», «#». Неявные H — по наименьшей валентности.
 */
export function parseSimpleSmiles(smiles: string): CondensedSkeleton | null {
  const atoms: SkeletonAtom[] = []
  const bonds: SkeletonBond[] = []
  const explicit: boolean[] = []
  const open: number[] = []
  const stack: number[] = []
  const rings = new Map<number, { at: number; order: 1 | 2 | 3 }>()
  let prev = -1
  let order: 1 | 2 | 3 = 1
  const link = (a: number, c: number, o: 1 | 2 | 3) => bonds.push([a, c, o])
  for (let i = 0; i < smiles.length; i++) {
    const ch = smiles[i]!
    if (ch === '(') stack.push(prev)
    else if (ch === ')') prev = stack.pop() ?? -1
    else if (ch === '=') order = 2
    else if (ch === '#') order = 3
    else if (ch === '.') {
      prev = -1
      order = 1
    } else if (ch === '*') {
      if (prev < 0) return null
      open.push(prev)
      order = 1
    } else if (/\d/.test(ch)) {
      const d = Number(ch)
      const o = rings.get(d)
      if (o) {
        link(o.at, prev, (order > o.order ? order : o.order) as 1 | 2 | 3)
        rings.delete(d)
      } else rings.set(d, { at: prev, order })
      order = 1
    } else {
      let el: string
      let exp = false
      let hx = 0
      if (ch === '[') {
        const j = smiles.indexOf(']', i)
        if (j < 0) return null
        const m = /^([A-Z][a-z]?)(?:H(\d*))?$/.exec(smiles.slice(i + 1, j))
        if (!m) return null
        el = m[1]!
        if (m[2] != null) hx = m[2] ? Number(m[2]) : 1
        i = j
        exp = true
      } else if (smiles.startsWith('Cl', i) || smiles.startsWith('Br', i)) {
        el = smiles.slice(i, i + 2)
        i++
      } else el = ch
      if (!VALENCES[el]) return null
      atoms.push({ el, h: hx })
      explicit.push(exp)
      const idx = atoms.length - 1
      if (prev >= 0) link(prev, idx, order)
      order = 1
      prev = idx
    }
  }
  if (rings.size || stack.length) return null
  const usedOf = (i: number) =>
    bonds.reduce((acc, [a, c, o]) => acc + (a === i || c === i ? o : 0), 0) + open.filter((x) => x === i).length
  atoms.forEach((a, i) => {
    if (explicit[i]) return
    const u = usedOf(i)
    const v = VALENCES[a.el]!.find((x) => x >= u) ?? u
    a.h = v - u
  })
  return { atoms, bonds, open }
}
