/**
 * Точка подключения внешней модели (на будущее). Сейчас учитель работает полностью офлайн:
 * реестр пуст, и ответы строит локальный движок. Чтобы подключить модель (свой сервер,
 * локальная LLM в браузере и т. п.), достаточно вызвать registerTeacherModel(...) при старте —
 * маршрутизатор спросит её раньше локального ответа по учебнику и откатится, если она молчит.
 */
export interface TeacherModelMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface TeacherModelProvider {
  id: string
  /** Готова ли модель отвечать сейчас (сеть, ключ, загружены веса…). */
  available(): boolean
  /** Ответ или null (тогда отвечает локальный движок). */
  reply(
    messages: TeacherModelMessage[],
    ctx: { lang: 'ru' | 'en' | 'uz'; sectionTitle: string },
    signal?: AbortSignal,
  ): Promise<string | null>
}

const providers: TeacherModelProvider[] = []

export function registerTeacherModel(provider: TeacherModelProvider): () => void {
  providers.push(provider)
  return () => {
    const i = providers.indexOf(provider)
    if (i >= 0) providers.splice(i, 1)
  }
}

export function availableTeacherModels(): TeacherModelProvider[] {
  return providers.filter((p) => {
    try {
      return p.available()
    } catch {
      return false
    }
  })
}

/** Спросить подключённые модели по очереди; null — ни одна не ответила. */
export async function askTeacherModels(
  messages: TeacherModelMessage[],
  ctx: { lang: 'ru' | 'en' | 'uz'; sectionTitle: string },
  signal?: AbortSignal,
): Promise<{ text: string; provider: string } | null> {
  for (const p of availableTeacherModels()) {
    if (signal?.aborted) return null
    try {
      const text = (await p.reply(messages, ctx, signal))?.trim()
      if (text) return { text, provider: p.id }
    } catch {
      /* следующая модель или локальный ответ */
    }
  }
  return null
}
