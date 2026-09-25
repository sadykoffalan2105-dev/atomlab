/**
 * ATOMLAB — «герой» продукта после синтеза: КАКУЮ структуру показывать для вещества.
 *
 * Карта compoundId → вид героя. Здесь только ССЫЛКИ на данные ядра (id кристалла, ключи длин,
 * углов, двугранных углов и энтальпий образования) — ни одного числа химии. Геометрию считает
 * src/components/lab/hero/heroGeometry.ts из crystalData / bondData, карточку заполняет thermoData.
 *
 * Законы (docs/prompts/OPUS-3D-FORMATION-11.md, раздел «Итог»):
 *  • ионные и атомные решётки (NaCl, MgO, Al₂O₃, SiO₂, PbO) — фрагмент из ЦЕЛЫХ ячеек с видимыми
 *    рёбрами, подписью параметров ячейки и КЧ; радиусы — Шеннон при фактическом КЧ (ионные) или
 *    Кордеро (полярно-ковалентный каркас SiO₂);
 *  • молекулярные вещества (H₂O, CO₂, H₂O₂, SO₃, Mn₂O₇, Cl₂O₇) — одна молекула крупно с геометрией
 *    из bondData; у воды — соседи на водородных связях (пунктир);
 *  • агрегатное состояние — при 25 °C и 1 атм.
 * Вещества, которых здесь нет, показываются каталожной моделью, как раньше.
 *
 * Модуль без three и React — его читает и тест scripts/test-product-hero.mts.
 */
import type { ElementSymbol } from './atomicData'
import type { AngleKey, BondKey, DihedralKey } from './bondData'

/** Агрегатное состояние при 25 °C и 1 атм. */
export type HeroPhase = 'solid' | 'liquid' | 'gas'

export type CrystalHeroSpec = {
  readonly kind: 'crystal'
  /** id в CRYSTAL_DATA (с базисом) */
  readonly crystalId: string
  /** целое число ячеек по a, b, c */
  readonly cells: readonly [number, number, number]
  /**
   * 'ionic' — радиус Шеннона при КЧ узла в бесконечном кристалле;
   * 'covalent' — радиус Кордеро (полярно-ковалентный каркас: подписи δ+/δ−, не «Si⁴⁺ и O²⁻»).
   */
  readonly radiusModel: 'ionic' | 'covalent'
  /** σ-связи палочками — только для ковалентного каркаса; у ионной решётки палочек нет */
  readonly drawBonds: boolean
  readonly phase: 'solid'
  /** ключ FORMATION_ENTHALPY для карточки */
  readonly formationKey: string
}

export type MoleculeGeometry =
  /** уголковая X–L₂ (H₂O) */
  | { readonly shape: 'bent'; readonly center: ElementSymbol; readonly ligand: ElementSymbol; readonly bond: BondKey; readonly angle: AngleKey; readonly order: number }
  /** линейная L=X=L (CO₂) */
  | { readonly shape: 'linear'; readonly center: ElementSymbol; readonly ligand: ElementSymbol; readonly bond: BondKey; readonly order: number }
  /** плоский треугольник XL₃ (SO₃) */
  | { readonly shape: 'trigonalPlanar'; readonly center: ElementSymbol; readonly ligand: ElementSymbol; readonly bond: BondKey; readonly angle: AngleKey; readonly order: number }
  /** H–O–O–H с двугранным углом (H₂O₂, гош-конформация C₂) */
  | { readonly shape: 'peroxide'; readonly oo: BondKey; readonly oh: BondKey; readonly angle: AngleKey; readonly dihedral: DihedralKey }
  /** O₃X–O–XO₃ — два тетраэдра по общей вершине (Mn₂O₇, Cl₂O₇) */
  | {
      readonly shape: 'bridged'
      readonly center: ElementSymbol
      readonly bridge: BondKey
      readonly term: BondKey
      readonly bridgeAngle: AngleKey
      /** угол между концевыми связями одного центра; у Mn₂O₇ отдельного значения нет — тетраэдрический */
      readonly termAngle: AngleKey
      readonly termOrder: number
    }

export type MoleculeHeroSpec = {
  readonly kind: 'molecule'
  readonly geometry: MoleculeGeometry
  readonly phase: HeroPhase
  /**
   * Соседние молекулы на честных расстояниях: 'hbond-water' — четыре соседа воды на водородных
   * связях (O–H 95.8 + H···O из bondData 'O-H...O'); 'none' — только одна молекула (для жидкостей
   * без межмолекулярных данных в ядре и для газов, где соседи в ~10 раз дальше размера молекулы).
   */
  readonly neighbors: 'hbond-water' | 'none'
  /** ключ FORMATION_ENTHALPY для карточки (состояние ключа показывается рядом с числом) */
  readonly formationKey: string
}

export type HeroSpec = CrystalHeroSpec | MoleculeHeroSpec

export const HERO_STRUCTURES: Readonly<Record<string, HeroSpec>> = {
  // ── ионные и атомные решётки ──
  // 2×2×2 — та же решётка, которой кончается сцена урока (scenes/nacl): сцена встаёт на место героя
  // без второй решётки в кадре, карточка описывает ровно то, что видно (125 ионов, 5 по ребру — школьный рисунок)
  nacl: { kind: 'crystal', crystalId: 'nacl', cells: [2, 2, 2], radiusModel: 'ionic', drawBonds: false, phase: 'solid', formationKey: 'NaCl(s)' },
  mgo: { kind: 'crystal', crystalId: 'mgo', cells: [2, 2, 2], radiusModel: 'ionic', drawBonds: false, phase: 'solid', formationKey: 'MgO(s)' },
  // Корунд: c ≈ 2,7·a, поэтому 2×2×1 целых ячейки — почти кубический фрагмент (2×2×2 был бы столбом)
  al2o3: { kind: 'crystal', crystalId: 'corundum', cells: [2, 2, 1], radiusModel: 'ionic', drawBonds: false, phase: 'solid', formationKey: 'Al2O3(s)' },
  // α-кварц — устойчивая форма SiO₂ при 25 °C (оксид на самом кремнии — аморфный: сказано в карточке)
  sio2: { kind: 'crystal', crystalId: 'quartz', cells: [2, 2, 2], radiusModel: 'covalent', drawBonds: true, phase: 'solid', formationKey: 'SiO2(s)' },
  // Глёт (α-PbO, красный) — устойчивая форма ниже 489 °C; КЧ Pb 4 → радиус Шеннона для КЧ 4
  pbo: { kind: 'crystal', crystalId: 'litharge', cells: [2, 2, 2], radiusModel: 'ionic', drawBonds: false, phase: 'solid', formationKey: 'PbO(litharge)' },

  // ── молекулярные вещества ──
  // r_0-набор воды: O–H 95.8 пм и ∠ 104.5° — не смешивать с r_e
  h2o: {
    kind: 'molecule',
    geometry: { shape: 'bent', center: 'O', ligand: 'H', bond: 'O-H', angle: 'water', order: 1 },
    phase: 'liquid',
    neighbors: 'hbond-water',
    formationKey: 'H2O(l)',
  },
  co2: {
    kind: 'molecule',
    geometry: { shape: 'linear', center: 'C', ligand: 'O', bond: 'C=O(CO2)', order: 2 },
    phase: 'gas',
    neighbors: 'none',
    formationKey: 'CO2(g)',
  },
  // Набор Redington 1962 целиком (r_0): O–O 147.5, O–H 95.0, ∠OOH 94.8, двугранный 111.5 (газ)
  h2o2: {
    kind: 'molecule',
    geometry: { shape: 'peroxide', oo: 'O-O', oh: 'O-H(H2O2)', angle: 'hydrogenPeroxideOOH', dihedral: 'hydrogenPeroxideGas' },
    phase: 'liquid',
    neighbors: 'none',
    formationKey: 'H2O2(l)',
  },
  // При 25 °C SO₃ — жидкость (γ, тримеры S₃O₉) или твёрдые полимеры (α, β); в ядре ΔH°f только для газа —
  // карточка так и пишет «(г)»
  so3: {
    kind: 'molecule',
    geometry: { shape: 'trigonalPlanar', center: 'S', ligand: 'O', bond: 'S=O(SO3)', angle: 'sulfurTrioxide', order: 2 },
    phase: 'liquid',
    neighbors: 'none',
    formationKey: 'SO3(g)',
  },
  // Mn₂O₇: кристалл 173 K (Simon 1987) — Mn–O концевая 158.5, мостиковая 177, ∠Mn–O–Mn 120.7
  tb_mn2o7: {
    kind: 'molecule',
    geometry: { shape: 'bridged', center: 'Mn', bridge: 'Mn-O(bridge)', term: 'Mn-O(term)', bridgeAngle: 'mn2o7MnOMn', termAngle: 'tetrahedral', termOrder: 2 },
    phase: 'liquid',
    neighbors: 'none',
    formationKey: 'Mn2O7(l)',
  },
  // Cl₂O₇: один газовый набор Beagley 1965 (r_g) — 140.5 / 170.9 пм, ∠Cl–O–Cl 118.6, ∠O–Cl–O 115.2
  tb_cl2o7: {
    kind: 'molecule',
    geometry: { shape: 'bridged', center: 'Cl', bridge: 'Cl-O(bridge)', term: 'Cl-O(term)', bridgeAngle: 'cl2o7ClOCl', termAngle: 'cl2o7OClO', termOrder: 2 },
    phase: 'liquid',
    neighbors: 'none',
    formationKey: 'Cl2O7(l)',
  },
}

/** Одиннадцать веществ документа OPUS-3D-FORMATION-11 в порядке каталога. */
export const HERO_COMPOUND_IDS = ['h2o', 'co2', 'sio2', 'pbo', 'h2o2', 'tb_mn2o7', 'tb_cl2o7', 'so3', 'al2o3', 'mgo', 'nacl'] as const

export function heroSpecFor(compoundId: string | null | undefined): HeroSpec | null {
  if (!compoundId) return null
  return HERO_STRUCTURES[compoundId] ?? null
}

// ─── Газ при стандартных условиях: почему соседей не рисуем ─────────────────

/** Постоянная Больцмана, Дж/К (SI 2019, точное значение). */
const BOLTZMANN_J_PER_K = 1.380649e-23
/** 25 °C в кельвинах и 1 атм в паскалях — условия, для которых указано агрегатное состояние. */
const T_25C_K = 298.15
const P_1ATM_PA = 101325

/**
 * Среднее расстояние между молекулами идеального газа при 25 °C и 1 атм, нм:
 * d = (kT/p)^(1/3) ≈ 3,4 нм — в 10–30 раз больше самой молекулы. Поэтому у газа-героя соседи
 * не рисуются (при 0 °C получается известное ≈ 3,3 нм).
 */
export function meanGasSpacingNm(): number {
  return Math.cbrt((BOLTZMANN_J_PER_K * T_25C_K) / P_1ATM_PA) * 1e9
}
