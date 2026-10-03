/**
 * Каталог предметов, которые ученик берёт «рукой»: банки реактивов на открытых полках, посуда в навесном
 * шкафу со стеклянными дверцами и в тумбах под столом. Здесь — где лежит каждый предмет (дом), его размер
 * (круг-коллайдер на столе), название на трёх языках и места на столе, куда предметы ставятся.
 */
import { LAB_GLASS_IDS, LAB_REAGENT_IDS, type LabItemId } from '../labEvents'
import { BENCH_TOP_Y, WORK_AREA_CENTER, WORK_AREA_SIZE, type LabText } from '../labContract'
import { BENCH, COUNTER, ROOM } from '../scene/labSceneLayout'

export type V3 = readonly [number, number, number]

/** Где предмет хранится: открытая полка, навесной шкаф (дверцы) или тумба под столом (дверца N). */
export type LabStore = { readonly kind: 'shelf' } | { readonly kind: 'cabinet'; readonly doorId: string }

/** Вид содержимого банки: раствор, порошок, гранулы, кристаллы, куски, опилки. */
export type ReagentFill = 'liquid' | 'powder' | 'granules' | 'crystals' | 'lumps' | 'pellets' | 'filings'
export type Hazard = 'corrosive' | 'flammable' | 'toxic'

export interface ReagentInfo {
  readonly formula: string
  /** Сосуд: склянка с узким горлом и притёртой пробкой (растворы) или широкая банка с крышкой (твёрдые). */
  readonly vessel: 'bottle' | 'amber' | 'jar'
  readonly fill: ReagentFill
  readonly color: string
  /** Цвет полосы этикетки: кислоты — красный, щёлочи — синий, соли — зелёный, металлы — серый, спирт — оранжевый. */
  readonly band: string
  readonly hazard?: Hazard
}

export interface LabItemDef {
  readonly id: LabItemId
  readonly name: LabText
  readonly home: V3
  readonly store: LabStore
  /** Радиус круга-коллайдера на столе (м) и высота (для руки и меток). */
  readonly r: number
  readonly h: number
  readonly reagent?: ReagentInfo
}

/** Открытые полки над столешницей у мойки (верх полки). */
export const SHELF_TOPS = [1.4325, 1.8325] as const
export const SHELF_Z = ROOM.frontZ + 0.16
export const SHELF_X0 = COUNTER.x0 + 0.14

/** Навесной шкаф со стеклянными дверцами над полками. */
export const WALL_CAB = { x0: COUNTER.x0 + 0.04, x1: COUNTER.x0 + 1.16, y0: 1.98, y1: 2.5, d: 0.32, z0: ROOM.frontZ } as const
export const WALL_CAB_FLOOR = WALL_CAB.y0 + 0.02

/** Тумба под рабочим столом: 4 секции с дверцами (фасад к ученику). */
export const BENCH_CAB = (() => {
  const width = BENCH.w - 0.08
  const depth = BENCH.d - 0.12
  const bodyY0 = 0.1
  const bodyH = BENCH.topY - BENCH.topT - 0.1
  return {
    width,
    depth,
    bodyY0,
    bodyH,
    frontZ: BENCH.centerZ + depth / 2,
    backZ: BENCH.centerZ - depth / 2,
    doors: 4,
    doorW: width / 4,
    drawerH: 0.15,
    shelfY: 0.42,
  }
})()
export const benchDoorX = (i: number) => -BENCH_CAB.width / 2 + BENCH_CAB.doorW * (i + 0.5)
const CAB_IN_Z = BENCH_CAB.frontZ - 0.17

const REAGENTS: ReadonlyArray<{ id: LabItemId; name: LabText; info: ReagentInfo; shelf: 0 | 1 }> = [
  { id: 'reagent:HCl', shelf: 0, name: { ru: 'Соляная кислота', en: 'Hydrochloric acid', uz: 'Xlorid kislota' }, info: { formula: 'HCl', vessel: 'bottle', fill: 'liquid', color: '#eef6ff', band: '#d93a2e', hazard: 'corrosive' } },
  { id: 'reagent:H2SO4', shelf: 0, name: { ru: 'Серная кислота', en: 'Sulfuric acid', uz: 'Sulfat kislota' }, info: { formula: 'H₂SO₄', vessel: 'amber', fill: 'liquid', color: '#f5efe2', band: '#d93a2e', hazard: 'corrosive' } },
  { id: 'reagent:NaOH', shelf: 0, name: { ru: 'Гидроксид натрия', en: 'Sodium hydroxide', uz: 'Natriy gidroksid' }, info: { formula: 'NaOH', vessel: 'jar', fill: 'pellets', color: '#f6f7f8', band: '#2f7cf6', hazard: 'corrosive' } },
  { id: 'reagent:CaOH2', shelf: 0, name: { ru: 'Гидроксид кальция', en: 'Calcium hydroxide', uz: 'Kalsiy gidroksid' }, info: { formula: 'Ca(OH)₂', vessel: 'jar', fill: 'powder', color: '#f3f3ef', band: '#2f7cf6' } },
  { id: 'reagent:BaCl2', shelf: 0, name: { ru: 'Хлорид бария', en: 'Barium chloride', uz: 'Bariy xlorid' }, info: { formula: 'BaCl₂', vessel: 'jar', fill: 'crystals', color: '#fbfbfb', band: '#2f9e5b', hazard: 'toxic' } },
  { id: 'reagent:NaCl', shelf: 0, name: { ru: 'Хлорид натрия', en: 'Sodium chloride', uz: 'Natriy xlorid' }, info: { formula: 'NaCl', vessel: 'jar', fill: 'crystals', color: '#ffffff', band: '#2f9e5b' } },
  { id: 'reagent:CuSO4', shelf: 0, name: { ru: 'Сульфат меди (II)', en: 'Copper(II) sulfate', uz: 'Mis (II) sulfat' }, info: { formula: 'CuSO₄', vessel: 'jar', fill: 'crystals', color: '#2d7fd6', band: '#2f9e5b' } },
  { id: 'reagent:Zn', shelf: 1, name: { ru: 'Цинк (гранулы)', en: 'Zinc granules', uz: 'Rux (donador)' }, info: { formula: 'Zn', vessel: 'jar', fill: 'granules', color: '#a3acb6', band: '#6b7683' } },
  { id: 'reagent:Fe', shelf: 1, name: { ru: 'Железо (опилки)', en: 'Iron filings', uz: 'Temir (qipiq)' }, info: { formula: 'Fe', vessel: 'jar', fill: 'filings', color: '#55575c', band: '#6b7683' } },
  { id: 'reagent:Al', shelf: 1, name: { ru: 'Алюминий', en: 'Aluminium', uz: 'Alyuminiy' }, info: { formula: 'Al', vessel: 'jar', fill: 'granules', color: '#d3d8de', band: '#6b7683' } },
  { id: 'reagent:CuO', shelf: 1, name: { ru: 'Оксид меди (II)', en: 'Copper(II) oxide', uz: 'Mis (II) oksid' }, info: { formula: 'CuO', vessel: 'jar', fill: 'powder', color: '#1e1f22', band: '#6b7683' } },
  { id: 'reagent:CaO', shelf: 1, name: { ru: 'Оксид кальция', en: 'Calcium oxide', uz: 'Kalsiy oksid' }, info: { formula: 'CaO', vessel: 'jar', fill: 'lumps', color: '#f1efe8', band: '#2f7cf6' } },
  { id: 'reagent:C2H5OH', shelf: 1, name: { ru: 'Спирт', en: 'Ethanol', uz: 'Spirt' }, info: { formula: 'C₂H₅OH', vessel: 'bottle', fill: 'liquid', color: '#f4f9ff', band: '#f0a020', hazard: 'flammable' } },
]

const GLASS: ReadonlyArray<{ id: LabItemId; name: LabText; r: number; h: number; place: 'wall' | `bench${0 | 1 | 2 | 3}`; at: V3 }> = [
  // Навесной шкаф: стеклянная посуда (x — от левого края шкафа)
  { id: 'glass:conicalFlask', name: { ru: 'Коническая колба', en: 'Conical flask', uz: 'Konussimon kolba' }, r: 0.055, h: 0.145, place: 'wall', at: [0.1, 0, 0] },
  { id: 'glass:roundFlask', name: { ru: 'Круглодонная колба', en: 'Round-bottom flask', uz: 'Yumaloq tubli kolba' }, r: 0.058, h: 0.18, place: 'wall', at: [0.25, 0, 0] },
  { id: 'glass:beaker', name: { ru: 'Химический стакан', en: 'Beaker', uz: 'Kimyoviy stakan' }, r: 0.045, h: 0.1, place: 'wall', at: [0.4, 0, 0] },
  { id: 'glass:cylinder', name: { ru: 'Мерный цилиндр', en: 'Measuring cylinder', uz: 'O‘lchov silindri' }, r: 0.035, h: 0.26, place: 'wall', at: [0.53, 0, 0] },
  { id: 'glass:funnel', name: { ru: 'Воронка', en: 'Funnel', uz: 'Voronka' }, r: 0.055, h: 0.125, place: 'wall', at: [0.67, 0, 0] },
  { id: 'glass:testTube', name: { ru: 'Пробирка', en: 'Test tube', uz: 'Probirka' }, r: 0.028, h: 0.16, place: 'wall', at: [0.8, 0, 0] },
  { id: 'glass:watchGlass', name: { ru: 'Часовое стекло', en: 'Watch glass', uz: 'Soat oynasi' }, r: 0.05, h: 0.02, place: 'wall', at: [0.95, 0, 0.02] },
  // Тумба под столом: левая секция — спиртовка, спички, лучинки; правая — фарфоровая чашка
  { id: 'tool:spiritLamp', name: { ru: 'Спиртовка', en: 'Spirit lamp', uz: 'Spirt lampa' }, r: 0.05, h: 0.11, place: 'bench0', at: [-0.12, 0, 0] },
  { id: 'tool:matches', name: { ru: 'Спички', en: 'Matches', uz: 'Gugurt' }, r: 0.035, h: 0.018, place: 'bench0', at: [0.1, 1, 0.02] },
  { id: 'tool:splint', name: { ru: 'Лучинки', en: 'Wooden splints', uz: 'Cho‘plar' }, r: 0.03, h: 0.16, place: 'bench0', at: [-0.12, 1, -0.04] },
  { id: 'glass:porcelainDish', name: { ru: 'Фарфоровая чашка', en: 'Porcelain dish', uz: 'Chinni kosacha' }, r: 0.065, h: 0.04, place: 'bench3', at: [0, 0, 0] },
]

function buildItems(): readonly LabItemDef[] {
  const out: LabItemDef[] = []
  const perShelf = [0, 0]
  for (const r of REAGENTS) {
    const i = perShelf[r.shelf]++
    const bottle = r.info.vessel !== 'jar'
    out.push({
      id: r.id,
      name: r.name,
      home: [SHELF_X0 + i * 0.152, SHELF_TOPS[r.shelf], SHELF_Z],
      store: { kind: 'shelf' },
      r: bottle ? 0.036 : 0.04,
      h: bottle ? 0.19 : 0.145,
      reagent: r.info,
    })
  }
  const wallZ = WALL_CAB.z0 + WALL_CAB.d / 2 + 0.01
  for (const g of GLASS) {
    if (g.place === 'wall') {
      out.push({ id: g.id, name: g.name, r: g.r, h: g.h, store: { kind: 'cabinet', doorId: g.at[0] < 0.56 ? 'wall:0' : 'wall:1' }, home: [WALL_CAB.x0 + g.at[0], WALL_CAB_FLOOR, wallZ + g.at[2]] })
    } else {
      const door = Number(g.place.slice(5))
      const y = g.at[1] > 0 ? BENCH_CAB.shelfY + 0.012 : BENCH_CAB.bodyY0 + 0.02
      out.push({ id: g.id, name: g.name, r: g.r, h: g.h, store: { kind: 'cabinet', doorId: `bench:${door}` }, home: [benchDoorX(door) + g.at[0], y, CAB_IN_Z + g.at[2]] })
    }
  }
  return out
}

export const LAB_ITEMS: readonly LabItemDef[] = buildItems()
export const LAB_ITEM_BY_ID: ReadonlyMap<LabItemId, LabItemDef> = new Map(LAB_ITEMS.map((d) => [d.id, d]))

/** Проверка каталога: каждый id из шины есть ровно один раз. */
export const ALL_ITEM_IDS: readonly LabItemId[] = [...LAB_REAGENT_IDS, ...LAB_GLASS_IDS]

/** Стол: куда можно двигать предметы (столешница минус поля). */
export const BENCH_BOUNDS = {
  x0: -BENCH.w / 2 + 0.07,
  x1: BENCH.w / 2 - 0.07,
  z0: BENCH.centerZ - BENCH.d / 2 + 0.08,
  z1: BENCH.centerZ + BENCH.d / 2 - 0.06,
} as const

/** Рабочее место (из контракта) в мировых координатах. */
export const WORK_RECT = {
  x0: WORK_AREA_CENTER.x - WORK_AREA_SIZE.w / 2,
  x1: WORK_AREA_CENTER.x + WORK_AREA_SIZE.w / 2,
  z0: WORK_AREA_CENTER.z - WORK_AREA_SIZE.d / 2,
  z1: WORK_AREA_CENTER.z + WORK_AREA_SIZE.d / 2,
} as const

/** Слоты по краям рабочего места: предметы не мешают установке опыта в центре. */
export const WORK_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [WORK_RECT.x1 - 0.08, WORK_RECT.z1 - 0.07],
  [WORK_RECT.x0 + 0.08, WORK_RECT.z1 - 0.07],
  [WORK_RECT.x1 - 0.2, WORK_RECT.z1 - 0.06],
  [WORK_RECT.x0 + 0.2, WORK_RECT.z1 - 0.06],
  [WORK_RECT.x1 - 0.08, WORK_RECT.z0 + 0.08],
  [WORK_RECT.x0 + 0.08, WORK_RECT.z0 + 0.08],
]

/** Свободные места на столе вне рабочего места. */
export const BENCH_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0.86, 0.26],
  [-0.86, 0.26],
  [1.1, 0.26],
  [0.86, 0.02],
  [-0.86, 0.02],
  [1.1, 0.02],
]

/** Неподвижные предметы на столе (декор): круги-коллайдеры [x, z, r]. */
export const BENCH_STATIC: ReadonlyArray<readonly [number, number, number]> = [
  [-1.03, -0.3, 0.14], // штатив с пробирками
  [-1.12, 0.3, 0.09], // очки
  [-1.13, 0.0, 0.08], // перчатки
  [1.15, -0.3, 0.13], // штатив с кольцом
  [-1.0, -0.42, 0.04], // газовые краны
  [1.0, -0.42, 0.04],
]

export const BENCH_Y = BENCH_TOP_Y

/** Подпись метки «Возьмите» над нужным предметом. */
export const TAKE_LABEL: LabText = { ru: 'Возьмите', en: 'Take it', uz: 'Oling' }
