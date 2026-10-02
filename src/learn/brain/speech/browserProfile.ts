/**
 * Профиль браузера для голоса — ЕДИНСТВЕННОЕ место, где код учителя смотрит на user-agent.
 *
 *  • Chrome: Web Speech распознаёт через серверы Google (без них — onerror 'network' или
 *    пустые сессии), 'uz-UZ' не поддерживается, непрерывный режим сам закрывается через
 *    ~60 с / после тишины, эхо колонок ловится особенно легко → во время речи учителя
 *    распознавание ставим на «жёсткую паузу».
 *  • Edge: распознавание Microsoft, узбекский есть, эхо-фильтра обычно достаточно → мягкий режим.
 *  • Safari/iOS: continuous ненадёжен → push-to-talk по умолчанию.
 *
 * Чистый модуль: user-agent передаётся параметром (тесты), по умолчанию берётся из navigator.
 */
export type SpeechVendor = 'chrome' | 'edge' | 'safari' | 'firefox' | 'other'

/** Как слушать ученика, пока говорит учитель. */
export type ListenWhileSpeaking = 'hard_pause' | 'soft_echo_filter'

export interface BrowserVoiceProfile {
  vendor: SpeechVendor
  isChrome: boolean
  isEdge: boolean
  isSafari: boolean
  isAndroid: boolean
  isIos: boolean
  /** Рекомендуемый режим во время речи учителя (при наличии VAD; без VAD всегда hard_pause). */
  listenWhileSpeaking: ListenWhileSpeaking
  /** Рекомендуемый режим микрофона по умолчанию. */
  recommendedMode: 'continuous' | 'push_to_talk'
  /** Языки распознавания, которые браузер поддерживает (по наблюдениям в проекте). */
  supportedLocales: readonly ('ru' | 'en' | 'uz')[]
  /** Распознавание зависит от внешних серверов (Chrome → Google). */
  needsCloudRecognition: boolean
}

export function detectSpeechVendor(ua: string): SpeechVendor {
  const u = ua.toLowerCase()
  if (u.includes('edg/') || u.includes('edga/') || u.includes('edgios/')) return 'edge'
  if (u.includes('firefox/') || u.includes('fxios/')) return 'firefox'
  if (u.includes('crios/') || (u.includes('chrome/') && !u.includes('edg'))) return 'chrome'
  if (u.includes('safari/') && !u.includes('chrome/') && !u.includes('crios/')) return 'safari'
  return 'other'
}

export function browserVoiceProfile(ua?: string): BrowserVoiceProfile {
  const agent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const vendor = detectSpeechVendor(agent)
  const low = agent.toLowerCase()
  const isAndroid = low.includes('android')
  const isIos = /iphone|ipad|ipod/.test(low)
  const isChrome = vendor === 'chrome'
  const isEdge = vendor === 'edge'
  const isSafari = vendor === 'safari'
  return {
    vendor,
    isChrome,
    isEdge,
    isSafari,
    isAndroid,
    isIos,
    // Жёсткая пауза — там, где эхо колонок ловится особенно легко (Chrome/Android); иначе эхо-фильтр + барджин.
    listenWhileSpeaking: isChrome || isAndroid ? 'hard_pause' : 'soft_echo_filter',
    recommendedMode: isSafari || isIos ? 'push_to_talk' : 'continuous',
    supportedLocales: isEdge ? ['ru', 'en', 'uz'] : ['ru', 'en'],
    needsCloudRecognition: isChrome || isAndroid,
  }
}

let cached: BrowserVoiceProfile | null = null
/** Профиль текущего браузера (кешируется). */
export function currentBrowserVoiceProfile(): BrowserVoiceProfile {
  if (!cached) cached = browserVoiceProfile()
  return cached
}
