/**
 * Режим интерфейса «электронная доска» (scene/labUiMode.ts — файл исполнителя A; B только читает).
 * Модуль подключается через import.meta.glob: пока файла A нет (ветки сливаются по очереди), режим — обычный.
 */
interface UiModeState {
  readonly mode: 'normal' | 'board'
  readonly scale: number
}
interface UiModeModule {
  readonly useLabUiMode?: () => UiModeState
  readonly labUiMode?: { get: () => UiModeState }
}

const mods = import.meta.glob<UiModeModule>('../scene/labUiMode.ts', { eager: true })
const mod: UiModeModule | undefined = Object.values(mods)[0]
const NORMAL: UiModeState = { mode: 'normal', scale: 1 }
const useNormal = (): UiModeState => NORMAL

/** Хук режима интерфейса (стабилен между рендерами: выбор делается один раз при загрузке модуля). */
export const useUiMode: () => UiModeState = mod?.useLabUiMode ?? useNormal
export const getUiMode = (): UiModeState => mod?.labUiMode?.get() ?? NORMAL
