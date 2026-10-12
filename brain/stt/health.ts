/**
 * Состояние распознавания речи для сайта:
 *   GET /stt/health → {ok, available, engines, langs, maxSeconds, queue} (сайт опрашивает ≤ 1 раза в 30 с);
 *   поле stt в /health мозга → {available, langs, device} (сверх контракта v1 — только новое поле).
 * Сайдкар спрашивается не чаще раза в 5 с (кеш в SttSidecar); /health мозга сайдкар не ждёт.
 */
import type { SttConfig } from '../config.ts'
import type { SidecarHealth, SttSidecar } from './sidecar.ts'

export const STT_LANGS = ['ru', 'uz', 'en'] as const

export type SttHealthField = { available: boolean; langs: string[]; device: 'cuda' | 'cpu' | null }

function summarize(h: SidecarHealth | null): SttHealthField {
  const loaded = h?.ok ? h.engines.filter((e) => e.loaded) : []
  if (!loaded.length) return { available: false, langs: [], device: null }
  const main = loaded.find((e) => e.name.startsWith('gigaam')) ?? loaded[0]!
  const langs = STT_LANGS.filter((l) => loaded.some((e) => e.langs.includes(l)))
  return { available: true, langs: langs.length ? [...langs] : [...STT_LANGS], device: main.device === 'cuda' ? 'cuda' : 'cpu' }
}

/** Поле stt для /health мозга: без ожидания сайдкара (последнее известное, обновление в фоне). */
export function sttHealthField(cfg: SttConfig | undefined, sidecar: SttSidecar): SttHealthField {
  if (!cfg?.enabled) return { available: false, langs: [], device: null }
  return summarize(sidecar.peek())
}

/** Ответ GET /stt/health. */
export async function sttHealthBody(cfg: SttConfig | undefined, sidecar: SttSidecar, running: number) {
  const maxSeconds = cfg?.maxSeconds ?? 25
  if (!cfg?.enabled) return { ok: true, available: false, reason: 'disabled', engines: [], langs: [...STT_LANGS], maxSeconds, queue: { running: 0, waiting: 0 } }
  const h = await sidecar.health()
  const s = summarize(h)
  return {
    ok: true,
    available: s.available,
    ...(h ? {} : { reason: 'sidecar_down' }),
    engines: (h?.engines ?? []).map((e) => ({ name: e.name, device: e.device, loaded: e.loaded, langs: e.langs })),
    langs: [...STT_LANGS],
    maxSeconds,
    queue: { running: Math.max(running, h?.queue.running ?? 0), waiting: h?.queue.waiting ?? 0 },
  }
}
