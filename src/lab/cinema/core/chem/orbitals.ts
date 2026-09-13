import { SCENE_PER_ANGSTROM } from '../atoms'
import { LobeKind, type LobePool } from '../pools'
import type { Vec3Like } from './vibration'

/**
 * ATOMLAB Cinema — π-система ClO₂ / ClO₂⁻ в модели Хюккеля (ЛКАО).
 *
 * КАЧЕСТВЕННАЯ модель для урока, а не квантовая химия: три pπ-центра O1–Cl–O2,
 * оси перпендикулярны плоскости молекулы, перекрывание не учитывается, O···O = 0.
 * Кулоновские и резонансные интегралы — через параметры гетероатомов:
 *   α_X = α + h_X·β,   β_ClO = k·β   (β < 0, энергия E = α + x·β: чем больше x, тем ниже).
 *
 * Выбор параметров (Стрейтвизер, 1961; уточнения Van-Catledge, 1980):
 *   • h_O = 2.0 — «Ö»-тип, кислород отдаёт в π-систему два электрона (O⁻ в формуле хлорита);
 *   • h_Cl = 1.5 — ниже, чем у O (χ Cl 3.16 < χ O 3.44); стрейтвизеровское 2.0 для Cl
 *     рассчитано на связь с углеродом, PPP-перекалибровка даёт ≈ 1.5;
 *   • k_ClO = 0.6 ≈ √(k_CÖ·k_CCl) = √(0.8·0.4) ≈ 0.57 — связи Cl–O в таблицах нет,
 *     берём среднее геометрическое и округляем.
 * Любые разумные значения дают тот же качественный результат: порядок 1b1 < 1a2 < 2b1
 * гарантирован при любом k ≠ 0 (1a2 точно при x = h_O, а 2b1 всегда ниже по x).
 *
 * Орбитали (C2v, плоскость молекулы — σv', ось p ⟂ плоскости):
 *   1b1 — связывающая по обеим Cl–O;
 *   1a2 — несвязывающая, только на O (узел на Cl по симметрии);
 *   2b1 — разрыхляющая π*: HOMO хлорита (2 e⁻), SOMO радикала ClO₂ (1 e⁻).
 * Отрыв электрона с 2b1 (ClO₂⁻ → ClO₂) усиливает обе связи Cl–O — отсюда 1.57 → 1.47 Å.
 */

// ——— Якоби: собственные значения симметричной матрицы ———

export type EigenResult = {
  /** собственные значения (в порядке диагонали после вращений, не отсортированы) */
  values: number[]
  /** vectors[k] — собственный вектор для values[k] (нормирован) */
  vectors: number[][]
}

/**
 * Циклический метод Якоби для малых симметричных матриц (n ≲ 10).
 * Вызывается однократно при загрузке модуля — аллокации допустимы.
 */
export function jacobiEigenSymmetric(matrix: readonly (readonly number[])[], maxSweeps = 64): EigenResult {
  const n = matrix.length
  const a = matrix.map((row) => row.slice())
  const v: number[][] = []
  for (let i = 0; i < n; i++) {
    const row = new Array<number>(n).fill(0)
    row[i] = 1
    v.push(row)
  }
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p]![q]! * a[p]![q]!
    if (off < 1e-28) break
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p]![q]!
        if (Math.abs(apq) < 1e-300) continue
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq)
        const t = theta === 0 ? 1 : Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        // A ← A·J (столбцы p, q)
        for (let k = 0; k < n; k++) {
          const akp = a[k]![p]!
          const akq = a[k]![q]!
          a[k]![p] = c * akp - s * akq
          a[k]![q] = s * akp + c * akq
        }
        // A ← Jᵀ·A (строки p, q)
        for (let k = 0; k < n; k++) {
          const apk = a[p]![k]!
          const aqk = a[q]![k]!
          a[p]![k] = c * apk - s * aqk
          a[q]![k] = s * apk + c * aqk
        }
        // V ← V·J
        for (let k = 0; k < n; k++) {
          const vkp = v[k]![p]!
          const vkq = v[k]![q]!
          v[k]![p] = c * vkp - s * vkq
          v[k]![q] = s * vkp + c * vkq
        }
      }
    }
  }
  const values: number[] = []
  const vectors: number[][] = []
  for (let k = 0; k < n; k++) {
    values.push(a[k]![k]!)
    const vec: number[] = []
    for (let i = 0; i < n; i++) vec.push(v[i]![k]!)
    vectors.push(vec)
  }
  return { values, vectors }
}

// ——— Хюккель для ClO₂ ———

export type ClO2HuckelParams = {
  /** h_O: α_O = α + h_O·β */
  hO: number
  /** h_Cl: α_Cl = α + h_Cl·β */
  hCl: number
  /** k: β_ClO = k·β */
  kClO: number
}

export const CLO2_HUCKEL_PARAMS: Readonly<ClO2HuckelParams> = { hO: 2.0, hCl: 1.5, kClO: 0.6 }

/** Порядок центров во всех массивах коэффициентов. */
export const CLO2_PI_CENTRES = ['O1', 'Cl', 'O2'] as const
export type SlaterElement = 'O' | 'Cl'
/** Элементы центров в порядке CLO2_PI_CENTRES. */
export const CLO2_PI_ELEMENTS: readonly SlaterElement[] = ['O', 'Cl', 'O']

export type ClO2PiLabel = '1b1' | '1a2' | '2b1'

export type PiOrbital = {
  label: ClO2PiLabel
  irrep: 'b1' | 'a2'
  /** E = α + x·β (β < 0): больше x — ниже энергия */
  x: number
  /** коэффициенты ЛКАО [O1, Cl, O2], нормированы (без перекрывания) */
  coefs: readonly [number, number, number]
  character: 'bonding' | 'nonbonding' | 'antibonding'
}

/** Коэффициенты меньше порога — ноль по симметрии (убираем шум ~1e-16 от вращений). */
const SYMMETRY_ZERO = 1e-12

/** Решить π-систему ClO₂; орбитали отсортированы по энергии (снизу вверх). */
export function solveClO2PiSystem(params: Readonly<ClO2HuckelParams> = CLO2_HUCKEL_PARAMS): PiOrbital[] {
  const { hO, hCl, kClO } = params
  const { values, vectors } = jacobiEigenSymmetric([
    [hO, kClO, 0],
    [kClO, hCl, kClO],
    [0, kClO, hO],
  ])
  const order = values.map((_, i) => i).sort((i, j) => values[j]! - values[i]!)
  let b1Count = 0
  let a2Count = 0
  return order.map((idx) => {
    let [c0, c1, c2] = vectors[idx]!.map((c) => (Math.abs(c) < SYMMETRY_ZERO ? 0 : c)) as [number, number, number]
    // σv (O1 ↔ O2): симметричная — b1, антисимметричная — a2.
    const antisym = Math.abs(c0 + c2) < Math.abs(c0 - c2)
    // Соглашение о фазе: у b1 коэффициент Cl > 0, у a2 коэффициент O1 > 0.
    const pivot = antisym ? c0 : c1
    if (pivot < 0) {
      c0 = -c0 || 0
      c1 = -c1 || 0
      c2 = -c2 || 0
    }
    const irrep = antisym ? 'a2' : 'b1'
    const num = antisym ? ++a2Count : ++b1Count
    const bondContribution = c0 * c1
    const character = bondContribution > SYMMETRY_ZERO ? 'bonding' : bondContribution < -SYMMETRY_ZERO ? 'antibonding' : 'nonbonding'
    return { label: `${num}${irrep}` as ClO2PiLabel, irrep, x: values[idx]!, coefs: [c0, c1, c2], character }
  })
}

/** π-орбитали ClO₂ по энергии: [1b1, 1a2, 2b1]. Считаются один раз. */
export const CLO2_PI_ORBITALS: readonly PiOrbital[] = solveClO2PiSystem()

/** Заселённости [1b1, 1a2, 2b1]: хлорит ClO₂⁻ — 6 π-электронов, радикал ClO₂ — 5. */
export const CLO2_PI_OCCUPANCY = {
  chlorite: [2, 2, 2],
  radical: [2, 2, 1],
} as const satisfies Record<string, readonly [number, number, number]>

export function clo2PiOrbital(label: ClO2PiLabel, orbitals: readonly PiOrbital[] = CLO2_PI_ORBITALS): PiOrbital {
  const o = orbitals.find((x) => x.label === label)
  if (!o) throw new Error(`[cinema] ClO2 π orbital ${label} not found`)
  return o
}

/** π-порядки связей Cl–O1 и Cl–O2 по Коулсону: p_ij = Σ n_k·c_ik·c_jk. */
export function piBondOrders(
  orbitals: readonly PiOrbital[],
  occupancy: readonly number[],
): { clO1: number; clO2: number } {
  let clO1 = 0
  let clO2 = 0
  for (let k = 0; k < orbitals.length; k++) {
    const n = occupancy[k] ?? 0
    const c = orbitals[k]!.coefs
    clO1 += n * c[0] * c[1]
    clO2 += n * c[2] * c[1]
  }
  return { clO1, clO2 }
}

/**
 * π-порядок каждой связи Cl–O у хлорита и радикала в модели Хюккеля.
 * При параметрах по умолчанию: хлорит 0.000 (заполненная π-система не даёт π-связывания),
 * ClO₂ ≈ 0.339 на связь — отрыв электрона с разрыхляющей 2b1 усиливает обе Cl–O.
 * (Школьная модель урока — +0.25 на связь, см. bondOrder.ts; знак и смысл совпадают.)
 */
export function piBondOrderChange(orbitals: readonly PiOrbital[] = CLO2_PI_ORBITALS): {
  chlorite: { clO1: number; clO2: number }
  radical: { clO1: number; clO2: number }
  deltaPerBond: number
} {
  const chlorite = piBondOrders(orbitals, CLO2_PI_OCCUPANCY.chlorite)
  const radical = piBondOrders(orbitals, CLO2_PI_OCCUPANCY.radical)
  return { chlorite, radical, deltaPerBond: radical.clO1 - chlorite.clO1 }
}

/** Спиновая плотность неспаренного электрона ClO₂ по центрам [O1, Cl, O2] = c² орбитали 2b1. */
export const CLO2_SOMO_SPIN_DENSITY: readonly [number, number, number] = (() => {
  const c = clo2PiOrbital('2b1').coefs
  return [c[0] * c[0], c[1] * c[1], c[2] * c[2]] as const
})()

// ——— Слейтеровские p-орбитали ———

/** 1 бор, Å. */
export const BOHR_A = 0.529177
/** 1 бор в единицах сцены (1 Å = SCENE_PER_ANGSTROM). */
export const SCENE_PER_BOHR = BOHR_A * SCENE_PER_ANGSTROM

/**
 * Слейтеровские показатели валентных p-орбиталей (правила Слейтера), бор⁻¹:
 *   O 2p:  Z_eff = 8 − (5·0.35 + 2·0.85) = 4.55, n* = 2 → ζ = 2.275;
 *   Cl 3p: Z_eff = 17 − (6·0.35 + 8·0.85 + 2·1.0) = 6.10, n* = 3 → ζ = 2.033.
 * У функций Слейтера нет радиальных узлов — это ещё одно упрощение.
 */
export const SLATER_P: Readonly<Record<SlaterElement, { n: number; zetaBohr: number }>> = {
  O: { n: 2, zetaBohr: 2.275 },
  Cl: { n: 3, zetaBohr: 2.033 },
}

function factorial(k: number): number {
  let f = 1
  for (let i = 2; i <= k; i++) f *= i
  return f
}

/** Нормировка радиальной STO: N = (2ζ)^(n+½) / √((2n)!). */
export function slaterNorm(n: number, zeta: number): number {
  return Math.pow(2 * zeta, n + 0.5) / Math.sqrt(factorial(2 * n))
}

/** Радиальная STO R(r) = N·r^(n−1)·e^(−ζr); r и 1/ζ в одних единицах. */
export function slaterRadial(n: number, zeta: number, r: number): number {
  return slaterNorm(n, zeta) * Math.pow(r, n - 1) * Math.exp(-zeta * r)
}

/** Среднее расстояние ⟨r⟩ = (2n + 1)/(2ζ) — характерный размер орбитали. */
export function slaterMeanRadius(n: number, zeta: number): number {
  return (2 * n + 1) / (2 * zeta)
}

/** Показатель ζ в ед. сцены⁻¹ (O 2p ≈ 15.1, Cl 3p ≈ 13.5). */
export function slaterZetaScene(element: SlaterElement): number {
  return SLATER_P[element].zetaBohr / SCENE_PER_BOHR
}

/** ⟨r⟩ валентной p-орбитали в ед. сцены (O ≈ 0.166, Cl ≈ 0.260). */
export function slaterExtentScene(element: SlaterElement): number {
  return slaterMeanRadius(SLATER_P[element].n, slaterZetaScene(element))
}

/** Кэш на элемент для горячей функции evalPiOrbital (без аллокаций в кадре). */
const STO_SCENE: Readonly<Record<SlaterElement, { n: number; zeta: number; norm: number }>> = {
  O: { n: SLATER_P.O.n, zeta: slaterZetaScene('O'), norm: slaterNorm(SLATER_P.O.n, slaterZetaScene('O')) },
  Cl: { n: SLATER_P.Cl.n, zeta: slaterZetaScene('Cl'), norm: slaterNorm(SLATER_P.Cl.n, slaterZetaScene('Cl')) },
}

const P_ANGULAR = Math.sqrt(3 / (4 * Math.PI))

/**
 * ψ(point) = Σ c_i·χ_i, χ_i — нормированная слейтеровская p-орбиталь центра i с осью `normal`:
 *   χ = N·r^(n−1)·e^(−ζr)·√(3/4π)·cos θ,  cos θ = (d·n̂)/r.
 * Всё в ед. сцены. В плоскости молекулы (d·n̂ = 0) ψ = 0 точно — узловая плоскость π-орбитали.
 * Эталон для raymarch-шейдера и тестов; на CPU — для редких проб, не для каждого пикселя.
 */
export function evalPiOrbital(
  point: Vec3Like,
  atoms: readonly Vec3Like[],
  normal: Vec3Like,
  coefs: readonly number[],
  elements: readonly SlaterElement[] = CLO2_PI_ELEMENTS,
): number {
  const nl = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z)
  if (nl < 1e-12) return 0
  const nx = normal.x / nl
  const ny = normal.y / nl
  const nz = normal.z / nl
  let psi = 0
  const count = Math.min(atoms.length, coefs.length)
  for (let i = 0; i < count; i++) {
    const c = coefs[i]!
    if (c === 0) continue
    const at = atoms[i]!
    const dx = point.x - at.x
    const dy = point.y - at.y
    const dz = point.z - at.z
    const dn = dx * nx + dy * ny + dz * nz
    if (dn === 0) continue
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const sto = STO_SCENE[elements[i] ?? 'O']
    // r^(n−1)·cos θ = r^(n−2)·(d·n̂)
    psi += c * sto.norm * P_ANGULAR * Math.pow(r, sto.n - 2) * dn * Math.exp(-sto.zeta * r)
  }
  return psi
}

/** Размер лепестка на единицу ⟨r⟩: при нём лепесток O ≈ 0.30 (дефолт LobePool). */
export const LOBE_SIZE_PER_SLATER_RADIUS = 1.8

/** Число электронов на орбитали (0..2) → заселённость пула лепестков (0..1). */
export function electronsToOccupancy(electrons: number): number {
  return electrons <= 0 ? 0 : electrons >= 2 ? 1 : electrons / 2
}

/**
 * Разложить орбиталь на лепестки: по одной записи LobeKind.p на центр, начиная со слота `start`.
 *   center = атом, axis = нормаль плоскости молекулы, coef = знаковый коэффициент ЛКАО,
 *   size = LOBE_SIZE_PER_SLATER_RADIUS·⟨r⟩ элемента (рендерер масштабирует по |coef|),
 *   occupancy — 0..1 (см. electronsToOccupancy).
 * Центр с нулевым коэффициентом (Cl у 1a2) тоже пишется — с coef = 0 (узел виден как пустота).
 * Пишет только то, что влезает в ёмкость; поднимает `count` до конца записи и `version`.
 * Возвращает индекс слота после последнего записанного. Без аллокаций.
 */
export function lobeLayoutForOrbital(
  pool: LobePool,
  start: number,
  atoms: readonly Vec3Like[],
  normal: Vec3Like,
  coefs: readonly number[],
  occupancy: number,
  elements: readonly SlaterElement[] = CLO2_PI_ELEMENTS,
  sizeScale = LOBE_SIZE_PER_SLATER_RADIUS,
  opacity = 1,
): number {
  let nx = normal.x
  let ny = normal.y
  let nz = normal.z
  const nl = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (nl < 1e-12) {
    nx = 0
    ny = 0
    nz = 1
  } else {
    nx /= nl
    ny /= nl
    nz /= nl
  }
  const end = Math.min(start + Math.min(atoms.length, coefs.length), pool.capacity)
  for (let slot = start; slot < end; slot++) {
    const i = slot - start
    const at = atoms[i]!
    const o = slot * 3
    pool.center[o] = at.x
    pool.center[o + 1] = at.y
    pool.center[o + 2] = at.z
    pool.axis[o] = nx
    pool.axis[o + 1] = ny
    pool.axis[o + 2] = nz
    pool.coef[slot] = coefs[i]!
    pool.size[slot] = sizeScale * slaterExtentScene(elements[i] ?? 'O')
    pool.occupancy[slot] = occupancy
    pool.opacity[slot] = opacity
    pool.kind[slot] = LobeKind.p
  }
  if (end > pool.count) pool.count = end
  pool.version++
  return end
}
