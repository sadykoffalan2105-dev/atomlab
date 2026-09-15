/**
 * «Умный ИИ» (бесплатно) — явное согласие ученика на облачный мозг Puter.js.
 *
 * Продуктовое правило: учитель работает без платных серверов и ключей.
 * Локальная база знаний отвечает всегда; Puter подключается только когда
 * ученик сам нажал «Подключить умный ИИ».
 *
 * Единый источник правды — `learn/learnPuterChat.ts` (им же пользуется движок
 * живого урока), здесь только React-обёртка, чтобы чипы в чате и в онлайн-уроке
 * всегда показывали одно и то же состояние.
 */
import { useCallback, useSyncExternalStore } from 'react'
import {
  connectSmartAi as connectEngineSmartAi,
  disconnectSmartAi as disconnectEngineSmartAi,
  getSmartAiState,
  isSmartAiConnected,
  subscribeSmartAi,
  type SmartAiState,
} from '../../../learn/learnPuterChat'
import { SMART_AI_STORAGE_KEY } from '../../../learn/learnPuterTts'

export type SmartAiStatus = SmartAiState

function subscribe(cb: () => void): () => void {
  const off = subscribeSmartAi(() => cb())
  const onStorage = (e: StorageEvent) => {
    if (e.key === SMART_AI_STORAGE_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    off()
    window.removeEventListener('storage', onStorage)
  }
}

const getSnapshot = (): SmartAiStatus => getSmartAiState()
const getServerSnapshot = (): SmartAiStatus => 'off'

/** Согласие дано (для движка: можно ли звать Puter без спроса). */
export function isSmartAiOptedIn(): boolean {
  const s = getSmartAiState()
  return s === 'on' || s === 'connecting'
}

/** Готов отвечать прямо сейчас (согласие + Puter загружен + вход выполнен). */
export { isSmartAiConnected }

/** Вызывать из обработчика клика: Puter открывает окно входа только по жесту. */
export function connectSmartAi(): Promise<boolean> {
  return connectEngineSmartAi()
}

export function disconnectSmartAi(): void {
  disconnectEngineSmartAi()
}

export function useSmartAi() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const connect = useCallback(() => connectSmartAi(), [])
  const disconnect = useCallback(() => disconnectSmartAi(), [])
  return { status: current, connected: current === 'on', connect, disconnect }
}
