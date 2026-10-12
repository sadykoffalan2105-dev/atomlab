/**
 * Скорость ответов для удалённой диагностики (публично в /health, без текстов и адресов): последние ответы модели —
 * первый токен, длина подсказки, чтение подсказки, поиск; снимок /api/ps (сколько модели лежит в видеопамяти).
 * Нужен, чтобы видеть «первое слово 7 с» на ПК друга без доступа к его журналу.
 */
type Sample = { firstMs: number | null; promptTokens: number | null; promptMs: number | null; retrievalMs: number | null; at: number }
type PsModel = { name: string; sizeGB: number; vramGB: number }

const ring: Sample[] = []
let ps: { at: number; models: PsModel[] } | null = null
let psBusy = false

export function recordLlm(s: { firstMs?: number | null; promptTokens?: number | null; promptMs?: number | null; retrievalMs?: number | null }, ollamaUrl?: string): void {
  ring.push({ firstMs: num(s.firstMs), promptTokens: num(s.promptTokens), promptMs: num(s.promptMs), retrievalMs: num(s.retrievalMs), at: Date.now() })
  if (ring.length > 20) ring.shift()
  if (ollamaUrl && !psBusy && (!ps || Date.now() - ps.at > 30_000)) void refreshPs(ollamaUrl)
}

async function refreshPs(url: string): Promise<void> {
  psBusy = true
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 2000)
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/api/ps`, { signal: ac.signal })
    const j = r.ok ? ((await r.json()) as { models?: { name?: string; size?: number; size_vram?: number }[] }) : null
    if (j?.models) ps = { at: Date.now(), models: j.models.map((m) => ({ name: String(m.name ?? ''), sizeGB: gb(m.size), vramGB: gb(m.size_vram) })) }
  } catch {
    /* Ollama не ответила — оставляем прежний снимок */
  } finally {
    clearTimeout(t)
    psBusy = false
  }
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : null)
const gb = (x: unknown): number => (typeof x === 'number' ? Math.round((x / 2 ** 30) * 10) / 10 : 0)
function p50(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null).sort((a, b) => a - b)
  return v.length ? v[Math.floor((v.length - 1) / 2)]! : null
}

export function perfSummary(thinking?: boolean | null) {
  return {
    n: ring.length,
    firstMsP50: p50(ring.map((s) => s.firstMs)),
    promptTokensP50: p50(ring.map((s) => s.promptTokens)),
    promptMsP50: p50(ring.map((s) => s.promptMs)),
    retrievalMsP50: p50(ring.map((s) => s.retrievalMs)),
    last: ring.slice(-3).map(({ firstMs, promptTokens, promptMs, retrievalMs }) => ({ firstMs, promptTokens, promptMs, retrievalMs })),
    thinkingModel: thinking ?? null,
    ps: ps?.models ?? null,
  }
}
