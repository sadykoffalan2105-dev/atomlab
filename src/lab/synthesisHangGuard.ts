/** Таймауты и лимиты — защита UI от «зависших» операций синтеза. */

/** Catalog match в worker: прерывание и fallback на main thread. */
export const CATALOG_MATCH_WORKER_TIMEOUT_MS = 2500

/** Layout preview в worker: sync-fallback при зависании. */
export const REACTOR_PREVIEW_LAYOUT_WORKER_TIMEOUT_MS = 1800

/** Debounce подбора продукта по каталогу (мс). */
export const CATALOG_MATCH_DEBOUNCE_MS = 120

/** Debounce авто-выбора продукта при единственном совпадении. */
export const CATALOG_AUTO_PRODUCT_MS = 180

/** Пауза между фоновыми GPU-compile задачами (мс). */
export const GPU_COMPILE_QUEUE_GAP_MS = 120
