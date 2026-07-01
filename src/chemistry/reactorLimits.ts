/** Единые лимиты реактора: уравнение vs 3D-производительность. */

/** Макс. коэффициент в UI и state (реагенты и продукт). */
export const REACTOR_COEFF_MAX = 9999

/** Макс. число слагаемых слева. */
export const REACTOR_EQUATION_MAX_TERMS = 8

/** Полная анимация полёта каждого атома превью. */
export const REACTOR_VISUAL_FULL_ATOMS = 24

/** Lite-модели + ограниченное превью. */
export const REACTOR_VISUAL_LITE_ATOMS = 64

/**
 * Перформанс-потолок числа 3D-моделей атомов в превью реактора.
 * Коэффициент может быть до 9999, но рендерить тысячи Bohr-моделей нельзя
 * (лаги/чёрный экран). Реальный коэффициент всегда виден числом в уравнении;
 * 3D показывает до этого числа моделей, дальше счётчик растёт без новых моделей.
 */
export const REACTOR_PREVIEW_MODELS_TOTAL = 28
export const REACTOR_PREVIEW_MODELS_PER_TERM_MAX = 14
export const REACTOR_PREVIEW_MODELS_PER_TERM_MIN = 4

/** @deprecated Используйте REACTOR_VISUAL_FULL_ATOMS — только для визуала, не для валидации уравнения. */
export const REACTOR_EQUATION_MAX_FLY_ATOMS = REACTOR_VISUAL_FULL_ATOMS
