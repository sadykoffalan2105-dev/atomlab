import { events as createPointerEvents } from '@react-three/fiber'

/**
 * События r3f для холстов органики, которые не падают, если холст убран раньше, чем r3f успел подключить события.
 * Canvas вызывает connect(divRef.current) асинхронно после создания корня; при быстрой смене режима, карточки изомера
 * или молекулы в Конструкторе div уже снят и приходит null → «Cannot read properties of null (reading 'addEventListener')».
 */
export const safeCanvasEvents: typeof createPointerEvents = (store) => {
  const ev = createPointerEvents(store)
  const connect = ev.connect
  return {
    ...ev,
    connect: (target: HTMLElement) => {
      if (target) connect?.(target)
    },
  }
}
