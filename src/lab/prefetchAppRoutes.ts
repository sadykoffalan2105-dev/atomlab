/**
 * Предзагрузка чанков основных экранов.
 *
 * Без этого первый клик по вкладке (Органика / Каталог / Обучение…) тратит
 * время на скачивание JS: кажется, что «не зашло», и пользователь жмёт снова.
 */

let warmed = false

const ROUTE_IMPORTS = {
  organic: () => import('../pages/OrganicLabPage'),
  vrLab: () => import('../pages/VrLabPage'),
  periodic: () => import('../pages/PeriodicTablePage'),
  catalog: () => import('../pages/CatalogPage'),
  learn: () => import('../pages/LearnPage'),
  learnTeacher: () => import('../pages/LearnTeacherHub'),
  learnResearch: () => import('../pages/LearnResearchLab'),
  learnPathways: () => import('../pages/LearnPathwaysHub'),
} as const

export type PrefetchRouteId = keyof typeof ROUTE_IMPORTS

const done = new Set<PrefetchRouteId>()

/** Подгрузить один экран (hover / focus вкладки). */
export function prefetchAppRoute(id: PrefetchRouteId): void {
  if (done.has(id)) return
  done.add(id)
  void ROUTE_IMPORTS[id]().catch(() => {
    done.delete(id)
  })
}

/** Все основные вкладки — после boot или в idle. */
export function prefetchAppRoutes(): void {
  if (warmed) return
  warmed = true
  for (const id of Object.keys(ROUTE_IMPORTS) as PrefetchRouteId[]) {
    prefetchAppRoute(id)
  }
}

/** Маршрут → id чанка для hover-prefetch в шапке. */
export function prefetchRouteForPath(pathname: string): void {
  if (pathname === '/organic' || pathname.startsWith('/organic')) {
    prefetchAppRoute('organic')
    return
  }
  if (pathname === '/vr-lab' || pathname.startsWith('/vr-lab')) {
    prefetchAppRoute('vrLab')
    return
  }
  if (pathname === '/periodic' || pathname.startsWith('/periodic')) {
    prefetchAppRoute('periodic')
    return
  }
  if (pathname === '/catalog' || pathname.startsWith('/catalog')) {
    prefetchAppRoute('catalog')
    return
  }
  if (pathname.startsWith('/learn')) {
    prefetchAppRoute('learn')
    if (pathname.includes('/teacher')) prefetchAppRoute('learnTeacher')
    if (pathname.includes('/research')) prefetchAppRoute('learnResearch')
    if (pathname.includes('/pathway')) prefetchAppRoute('learnPathways')
  }
}
