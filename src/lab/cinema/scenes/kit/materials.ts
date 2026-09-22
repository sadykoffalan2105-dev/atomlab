/**
 * ATOMLAB Cinema kit — МАТЕРИАЛ АТОМА ПО ТИПУ ВЕЩЕСТВА.
 *
 * Визуальный язык документа OPUS-3D-FORMATION-11: металл, ион, ковалентная
 * молекула и газ не должны выглядеть одинаково.
 *   • metal    — металлический блеск: отражение окрашено цветом элемента (F0 = albedo),
 *                лёгкая анизотропия блика, диффуза почти нет (Na, Mg, Al, Pb в решётке);
 *   • ion      — матовый, мягкий широкий ободок (Na⁺, Cl⁻, Mg²⁺, O²⁻ в кристалле);
 *   • covalent — глянец: узкий яркий блик (молекулы H₂O, CO₂, SO₃…);
 *   • polar    — между ионом и ковалентным (полярно-ковалентный каркас SiO₂, δ+/δ−);
 *   • gas      — светлее и чуть прозрачнее, прозрачность смешиванием, без узора
 *                screen-door (реагенты H₂, O₂, Cl₂ до реакции);
 *   • default  — прежний «стеклянный» материал движка (так выглядят сцены,
 *                которые материал не задают).
 *
 * Это СХЕМА восприятия, а не физика отдельного атома: у одиночного атома нет
 * «металлического блеска» — блеск есть у металла как вещества. Поэтому материал
 * задаёт сцена по ВЕЩЕСТВУ на текущем шаге (Na в решётке — metal, Na⁺ в
 * кристалле — ion), и меняется он в тот же кадр, что и заряд, — одна программа,
 * один draw call (атрибут aSurface в core/atomImpostorShader.ts).
 *
 * Числа ниже — параметры рендера (шероховатость, анизотропия), а не химия.
 */
import { ATOM_SURFACE_GAS_FLAG } from '../../core/atomImpostorShader'
import type { AtomPool } from '../../core/pools'

export type SubstanceKind = 'metal' | 'ion' | 'covalent' | 'polar' | 'gas' | 'default'

export type AtomSurface = {
  readonly kind: SubstanceKind
  /** 0…1 — доля металлического отражения (F0 → albedo) */
  readonly metalness: number
  /** 0…1 — шероховатость; 0 — прежний материал движка */
  readonly roughness: number
  /** 0…1 — вытянутость блика (шлифованный металл) */
  readonly anisotropy: number
  /** 0…1 — мягкость и ширина ободка (ион, газ) */
  readonly rimSoftness: number
  /** прозрачность смешиванием вместо screen-door (только газ) */
  readonly translucent: boolean
  /** 0…1 — осветление цвета элемента к белому (газ «легче») */
  readonly lighten: number
  /** множитель непрозрачности, который writeAtom применяет к opacity */
  readonly opacityScale: number
}

const SURFACES: Readonly<Record<SubstanceKind, AtomSurface>> = {
  metal: { kind: 'metal', metalness: 1, roughness: 0.2, anisotropy: 0.55, rimSoftness: 0.1, translucent: false, lighten: 0, opacityScale: 1 },
  ion: { kind: 'ion', metalness: 0, roughness: 0.78, anisotropy: 0, rimSoftness: 1, translucent: false, lighten: 0, opacityScale: 1 },
  covalent: { kind: 'covalent', metalness: 0, roughness: 0.26, anisotropy: 0, rimSoftness: 0.2, translucent: false, lighten: 0, opacityScale: 1 },
  polar: { kind: 'polar', metalness: 0, roughness: 0.45, anisotropy: 0, rimSoftness: 0.55, translucent: false, lighten: 0, opacityScale: 1 },
  gas: { kind: 'gas', metalness: 0, roughness: 0.5, anisotropy: 0, rimSoftness: 0.7, translucent: true, lighten: 0.16, opacityScale: 0.82 },
  default: { kind: 'default', metalness: 0, roughness: 0, anisotropy: 0, rimSoftness: 0, translucent: false, lighten: 0, opacityScale: 1 },
}

for (const k of Object.keys(SURFACES) as SubstanceKind[]) Object.freeze(SURFACES[k])

/** Материал по типу вещества. Возвращает общий замороженный объект — без аллокаций в кадре. */
export function materialFor(kind: SubstanceKind): AtomSurface {
  return SURFACES[kind] ?? SURFACES.default
}

/** Прежний материал движка (roughness 0 → старый набор констант шейдера). */
export const SURFACE_DEFAULT: AtomSurface = SURFACES.default

/**
 * Пишет поверхность атома i в pool.surface. Без surface — прежний материал.
 * Осветление и множитель непрозрачности применяет writeAtom (cpkAtoms.ts) —
 * здесь только атрибут шейдера.
 */
export function writeSurface(pool: AtomPool, i: number, surface?: AtomSurface): void {
  const s = pool.surface
  if (!s) return
  const o = i * 4
  const m = surface ?? SURFACE_DEFAULT
  s[o] = m.metalness
  s[o + 1] = m.roughness
  s[o + 2] = m.anisotropy
  s[o + 3] = m.translucent ? ATOM_SURFACE_GAS_FLAG + m.rimSoftness : m.rimSoftness
}

/** Прочитать тип вещества атома i обратно из пула (для тестов и отладки). */
export function surfaceKindAt(pool: AtomPool, i: number): SubstanceKind {
  const s = pool.surface
  const o = i * 4
  if (!s || !(s[o + 1]! > 0)) return 'default'
  if (s[o + 3]! >= ATOM_SURFACE_GAS_FLAG) return 'gas'
  let best: SubstanceKind = 'default'
  let bestD = Infinity
  for (const k of ['metal', 'ion', 'covalent', 'polar'] as const) {
    const m = SURFACES[k]
    const d = Math.abs(m.metalness - s[o]!) + Math.abs(m.roughness - s[o + 1]!) + Math.abs(m.rimSoftness - s[o + 3]!)
    if (d < bestD) {
      bestD = d
      best = k
    }
  }
  return best
}
