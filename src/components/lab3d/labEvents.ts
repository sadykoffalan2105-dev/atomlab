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

export type LabEvent =
  | { readonly type: 'picked'; readonly itemId: LabItemId }
  /** zone 'work' — предмет поставлен на рабочее место опыта (WORK_AREA), 'bench' — на стол, 'shelf' — обратно. */
  | { readonly type: 'placed'; readonly itemId: LabItemId; readonly zone: 'work' | 'bench' | 'shelf' }
  | { readonly type: 'focus'; readonly position: Vec3Tuple; readonly target: Vec3Tuple }
  | { readonly type: 'focusReset' }
  | { readonly type: 'need'; readonly itemIds: readonly LabItemId[] }
  | { readonly type: 'hint'; readonly at: Vec3Tuple; readonly text: string }

type Handler<T extends LabEvent['type']> = (e: Extract<LabEvent, { type: T }>) => void

const handlers = new Map<LabEvent['type'], Set<(e: LabEvent) => void>>()
let lastNeed: Extract<LabEvent, { type: 'need' }> | null = null

export const labEvents = {
  emit(e: LabEvent): void {
    if (e.type === 'need') lastNeed = e
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
  /** Для тестов. */
  reset(): void {
    handlers.clear()
    lastNeed = null
  },
}
