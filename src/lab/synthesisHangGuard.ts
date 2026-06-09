/** Таймауты и лимиты — защита UI от «зависших» операций синтеза. */

/** Catalog match в worker: прерывание и fallback на main thread. */
export const CATALOG_MATCH_WORKER_TIMEOUT_MS = 2500

/** Debounce подбора продукта по каталогу (мс). */
export const CATALOG_MATCH_DEBOUNCE_MS = 120

/** Debounce авто-выбора продукта при единственном совпадении. */
export const CATALOG_AUTO_PRODUCT_MS = 180
