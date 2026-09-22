/**
 * Шина намерений экрана входа.
 *
 * LabScene рендерит <DecorativeAtom /> внутри Canvas вообще без пропсов, так что
 * колбэк «открой реактор» передать некуда. Проектный приём развязки уже есть —
 * CustomEvent на window (см. `learn/learnClassRosterStorage.ts`), здесь он же
 * плюс обычный Set подписчиков: события внутри вкладки идут напрямую, а window
 * остаётся запасным каналом для кода, который не импортирует этот модуль.
 *
 * ЗАВИСИМОСТЬ: подписка живёт в LaboratoryPage.tsx (три строки: useEffect →
 * subscribeLabEntryIntent → открыть реактор / перейти в каталог) и делается
 * отдельной задачей. Без неё сцена полностью работоспособна: намерение просто
 * никто не слушает, ошибок нет.
 */

export type LabEntryIntent = 'open-reactor' | 'open-catalog' | 'inspect-element'

export type LabEntryIntentDetail = {
  intent: LabEntryIntent
  /** id вещества каталога или символ элемента — зависит от намерения. */
  payload?: string
}

export const LAB_ENTRY_INTENT_EVENT = 'atomlab:lab-entry-intent'

const listeners = new Set<(detail: LabEntryIntentDetail) => void>()

/**
 * Запасной переход, если намерение никто не слушает.
 *
 * Клик по молекуле обязан КУДА-ТО вести, иначе пояс веществ — декорация.
 * Подписчика в LaboratoryPage ещё нет, поэтому каталог открывается мягко:
 * pushState + popstate — ровно то событие, на которое подписан history
 * react-router (v7), то есть переход идёт без перезагрузки приложения.
 * Если что-то пойдёт не так — обычная навигация браузера.
 */
function fallbackNavigate(intent: LabEntryIntent): void {
  if (typeof window === 'undefined') return
  // Реактор живёт состоянием самой страницы лаборатории, адреса у него нет:
  // без подписчика бросок молекулы остаётся жестом сцены.
  if (intent !== 'open-catalog') return
  const url = '/catalog?view=inorganic'
  try {
    window.history.pushState({}, '', url)
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
  } catch {
    window.location.assign(url)
  }
}

export function emitLabEntryIntent(intent: LabEntryIntent, payload?: string): void {
  const detail: LabEntryIntentDetail = payload == null ? { intent } : { intent, payload }
  let handled = listeners.size > 0
  listeners.forEach((fn) => {
    try {
      fn(detail)
    } catch {
      /* один сломанный слушатель не должен ронять сцену */
    }
  })
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<LabEntryIntentDetail>(LAB_ENTRY_INTENT_EVENT, {
      detail,
      cancelable: true,
    })
    // Слушатель window может перехватить намерение сам — тогда preventDefault().
    if (!window.dispatchEvent(event)) handled = true
  }
  if (!handled) fallbackNavigate(intent)
}

export function subscribeLabEntryIntent(fn: (detail: LabEntryIntentDetail) => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
