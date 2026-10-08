/**
 * Какие реакции реактора имеют показ «Как образуется» (лёгкий модуль без three — его читает панель реактора).
 * Реакция узнаётся по id из «200 основных» (mr=…) или по набору веществ (школьный каталог «Уравнение»).
 */
export type ReactorRouteId = 'co2-combustion' | 'co2-acid' | 'co2-calcination'

type RouteRef = { id: ReactorRouteId; product: string; mr: readonly string[]; left: readonly string[]; right: readonly string[] }

export const REACTOR_ROUTES: readonly RouteRef[] = [
  { id: 'co2-combustion', product: 'co2', mr: ['mr156'], left: ['C', 'O₂'], right: ['co2'] },
  { id: 'co2-acid', product: 'co2', mr: ['mr097'], left: ['salt_ca_co3', 'hcl'], right: ['salt_ca_cl', 'co2', 'h2o'] },
  { id: 'co2-calcination', product: 'co2', mr: ['mr035'], left: ['salt_ca_co3'], right: ['cao', 'co2'] },
]

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

/** Путь для текущей реакции реактора: по id основной реакции или по набору веществ слева и справа. */
export function reactorRouteFor(q: { mainReactionId?: string | null; left?: readonly string[]; right?: readonly string[] }): ReactorRouteId | null {
  if (q.mainReactionId) {
    const r = REACTOR_ROUTES.find((x) => x.mr.includes(q.mainReactionId!))
    if (r) return r.id
  }
  if (q.left?.length && q.right?.length) {
    const r = REACTOR_ROUTES.find((x) => sameSet(x.left, q.left!) && sameSet(x.right, q.right!))
    if (r) return r.id
  }
  return null
}

/** Другие пути получения того же вещества (для переключателя в показе). */
export function siblingRoutes(id: ReactorRouteId): ReactorRouteId[] {
  const p = REACTOR_ROUTES.find((x) => x.id === id)?.product
  return REACTOR_ROUTES.filter((x) => x.product === p).map((x) => x.id)
}
