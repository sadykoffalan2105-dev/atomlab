/**
 * Сколько холста сверху и снизу закрыто интерфейсом (CSS px): на телефоне сверху — полоса видов и «Приборы»,
 * снизу — подсказка руки и панель опыта (раскрытая — почти половина экрана). Пишет страница (Lab3DPage, измеряет),
 * читает камера (LabCameraRig): крупный план ставит предмет в середину свободной полосы, а не под панель.
 * Отдельный модуль без three — страница не тянет сцену в свой чанк.
 */
export interface LabCameraInsets {
  readonly top: number
  readonly bottom: number
}

let current: LabCameraInsets = { top: 0, bottom: 0 }
const subs = new Set<() => void>()

export const labCameraInsets = {
  get: (): LabCameraInsets => current,
  set(top: number, bottom: number) {
    const t = Math.max(0, Math.round(top))
    const b = Math.max(0, Math.round(bottom))
    if (t === current.top && b === current.bottom) return
    current = { top: t, bottom: b }
    for (const f of subs) f()
  },
  subscribe(f: () => void): () => void {
    subs.add(f)
    return () => subs.delete(f)
  },
}
