/**
 * РЕЖИМ УРОКА: «школьный» (по умолчанию, стандарт ОГЭ/ЕГЭ — H⁺, без воды и решётки) или «продвинутый»
 * (научная сцена: H₃O⁺, гидратные оболочки, ячейка барита). Источник — docs/plans/baso4-modes.md.
 *
 * Хранится в localStorage (`atomlab.lesson.mode`); маленький стор с подпиской — его читают панель урока
 * (переключатель у уроков с `modes: true`) и обёртка сцены (перезапуск с текущего шага). Модуль без React.
 */

export type LessonMode = 'school' | 'advanced'

export const LESSON_MODE_KEY = 'atomlab.lesson.mode'

function readMode(): LessonMode {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LESSON_MODE_KEY) === 'advanced' ? 'advanced' : 'school'
  } catch {
    return 'school'
  }
}

let mode: LessonMode | null = null
const listeners = new Set<() => void>()

export const lessonModeStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot(): LessonMode {
    if (mode == null) mode = readMode()
    return mode
  },

  set(next: LessonMode): void {
    if (next === lessonModeStore.getSnapshot()) return
    mode = next
    try {
      localStorage.setItem(LESSON_MODE_KEY, next)
    } catch {
      /* приватный режим: режим живёт до перезагрузки */
    }
    for (const l of listeners) l()
  },
}

/** Режим урока сейчас (для getText уроков и фабрик сцен). */
export function getLessonMode(): LessonMode {
  return lessonModeStore.getSnapshot()
}
