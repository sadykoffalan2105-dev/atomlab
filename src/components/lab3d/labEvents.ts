/**
 * Шина событий 3D-лаборатории: связывает сцену (стеллажи, шкафы, камера, «рука» ученика) и опыты, которые
 * собираются независимо. Без React-контекста — простой типизированный издатель (одна лаборатория на странице).
 *
 *  • сцена публикует: 'picked' / 'placed' / 'dropped' — ученик взял предмет со стеллажа или из шкафа, поставил его;
 *  • опыты публикуют: 'focus' — крупный план момента реакции (камера плавно наезжает), 'focusReset' — обратно;
 *    'need' — какой предмет сейчас нужен (сцена подсвечивает его на стеллаже/в шкафу);
 *  • 'hint' — короткая подсказка в 3D над точкой (сцена может не показывать, если опыт рисует свою).
 */

/** Предметы стеллажей и шкафов: реактивы 'reagent:<формула ASCII>' и посуда 'glass:<вид>'. */
export const LAB_REAGENT_IDS = [
  'reagent:HCl',
  'reagent:H2SO4',
  'reagent:BaCl2',
  'reagent:Zn',
  'reagent:NaOH',
  'reagent:CaO',
  'reagent:CuO',
  'reagent:CuSO4',
  'reagent:Fe',
  'reagent:Al',
  'reagent:NaCl',
  'reagent:C2H5OH',
  'reagent:CaOH2',
] as const
export const LAB_GLASS_IDS = [
  'glass:testTube',
  'glass:beaker',
  'glass:conicalFlask',
  'glass:roundFlask',
  'glass:cylinder',
  'glass:funnel',
  'glass:porcelainDish',
  'glass:watchGlass',
  'tool:spiritLamp',
  'tool:splint',
  'tool:matches',
] as const
export type LabItemId = (typeof LAB_REAGENT_IDS)[number] | (typeof LAB_GLASS_IDS)[number]

export type Vec3Tuple = readonly [number, number, number]

/** Средства защиты (то же, что LabGear в контракте; продублировано, чтобы шина не зависела от three). */
export type LabGearId = 'goggles' | 'gloves' | 'coat'

export type LabEvent =
  | { readonly type: 'picked'; readonly itemId: LabItemId }
  /** zone 'work' — предмет поставлен на рабочее место опыта (WORK_AREA), 'bench' — на стол, 'shelf' — обратно. */
  | { readonly type: 'placed'; readonly itemId: LabItemId; readonly zone: 'work' | 'bench' | 'shelf' }
  | { readonly type: 'focus'; readonly position: Vec3Tuple; readonly target: Vec3Tuple }
  | { readonly type: 'focusReset' }
  | { readonly type: 'need'; readonly itemIds: readonly LabItemId[] }
  | { readonly type: 'hint'; readonly at: Vec3Tuple; readonly text: string }
  /** Ученик надел/снял средство защиты (сцена публикует; опыт ждёт нужное перед началом). */
  | { readonly type: 'safety'; readonly gear: LabGearId; readonly on: boolean }
  /** Опыт просит надеть средства защиты (сцена подсвечивает их на крючке/в шкафу). */
  | { readonly type: 'needGear'; readonly gear: readonly LabGearId[] }
  /** Звук события (сцена проигрывает пространственно у точки at; опыт может звучать и сам). */
  | { readonly type: 'sound'; readonly name: string; readonly at?: Vec3Tuple; readonly gain?: number }
  /**
   * Пламя у точки at: опыт публикует on: true, когда зажёг спиртовку/горелку (сцена знает, где горит, —
   * огнетушитель, «горячие» предметы рядом), и on: false, когда погасил. Сцена публикует on: false, когда
   * ученик потушил пламя огнетушителем, — опыт гасит своё пламя у этой точки.
   */
  | { readonly type: 'fire'; readonly on: boolean; readonly at?: Vec3Tuple }
  /**
   * Показание прибора в задаче-опыте (весы, мензурка, газ над водой, термометр): опыт публикует, когда шаг
   * с измерением выполнен; журнал сцены, доска и учитель записывают. text — готовая строка «m(Zn) = 26,03 г».
   */
  | { readonly type: 'measure'; readonly taskId: string; readonly key: string; readonly label: string; readonly value: number; readonly text: string }
  /** Команда интерфейсу от VR-доски/HUD (B публикует, Lab3DPage исполняет). */
  | { readonly type: 'uiCommand'; readonly cmd: 'next' | 'back' | 'restart' | 'view' | 'select' | 'quality'; readonly view?: 'desk' | 'board' | 'shelves' | 'hood' | 'cabinets'; readonly experimentId?: string; readonly quality?: 'low' | 'high' }

type Handler<T extends LabEvent['type']> = (e: Extract<LabEvent, { type: T }>) => void

const handlers = new Map<LabEvent['type'], Set<(e: LabEvent) => void>>()
let lastNeed: Extract<LabEvent, { type: 'need' }> | null = null
const worn = new Set<LabGearId>()

export const labEvents = {
  emit(e: LabEvent): void {
    if (e.type === 'need') lastNeed = e
    if (e.type === 'safety') {
      if (e.on) worn.add(e.gear)
      else worn.delete(e.gear)
    }
    for (const h of handlers.get(e.type) ?? []) h(e)
  },
  /** Подписка; возвращает отписку (удобно для useEffect). */
  on<T extends LabEvent['type']>(type: T, fn: Handler<T>): () => void {
    const set = handlers.get(type) ?? new Set()
    const h = fn as (e: LabEvent) => void
    set.add(h)
    handlers.set(type, set)
    return () => set.delete(h)
  },
  /** Последний запрос «нужен предмет» (сцена, смонтированная позже опыта, сразу подсвечивает). */
  currentNeed(): readonly LabItemId[] {
    return lastNeed?.itemIds ?? []
  },
  /** Что сейчас надето (опыт, смонтированный позже, сразу знает). */
  wornGear(): readonly LabGearId[] {
    return [...worn]
  },
  /** Для тестов. */
  reset(): void {
    handlers.clear()
    lastNeed = null
    worn.clear()
  },
}
