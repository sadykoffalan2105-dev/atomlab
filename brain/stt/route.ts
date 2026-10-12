/**
 * Распознавание речи (контракт «Голос» v1, диспетчер из brain/server.ts):
 *   POST /stt?lang=ru|uz|en|auto&session=<id>&partial=0|1 — тело: сырой WAV PCM16 16 кГц моно 0,3–25 с
 *        (Content-Type audio/wav или application/octet-stream) → {ok:true, text, lang, langSource, confidence, engine,
 *        device, ms:{queue,decode,infer,total}, durationMs, partial};
 *   GET  /stt/health — {ok, available, engines, langs, maxSeconds, queue}.
 * Ошибки {ok:false, error:{code,message}}: 400 bad_audio (detail) | too_short | bad_request; 413 too_long;
 * 415 unsupported_media_type; 429 rate | busy (+Retry-After); 503 stt_unavailable (+Retry-After: 10); 500 internal.
 * Сессия: query session=… (сайт; новых CORS-заголовков не нужно) или заголовок X-Brain-Session (скрипты, curl);
 * без неё — по адресу ученика. Потолок по адресу (щедрый: школьный NAT) — тоже здесь, brain/stt/limits.ts.
 *
 * Приватность: аудио только в памяти запроса (Buffer → сайдкар), в журналы — ни аудио, ни текста; язык текста
 * определяет detectLang (brain/pipeline/normalize.ts), нормализацию формул делает сайт (fixTranscript).
 */
import type http from 'node:http'
import type { BrainConfig, SttConfig } from '../config.ts'
import { DEFAULT_CONFIG } from '../config.ts'
import type { ClientInfo } from '../http/clientIp.ts'
import { BodyError, json, jsonError } from '../http/guard.ts'
import { detectLang } from '../pipeline/normalize.ts'
import { sttHealthBody, sttHealthField } from './health.ts'
import { SESSION_RE, SttLimits } from './limits.ts'
import { SttSidecar, type SidecarResult } from './sidecar.ts'
import { checkSttWav } from './wav.ts'

export type SttLang = 'ru' | 'uz' | 'en'
export type SttHttpContext = {
  req: http.IncomingMessage
  res: http.ServerResponse
  url: URL
  method: string
  cors: Record<string, string>
  client: ClientInfo
  /** false — владелец с этого ПК / админ: лимиты частоты не считаются */
  limited: boolean
  brain: { deps: { config: BrainConfig } }
}

/** Состояние /stt на один экземпляр мозга (без правки типа Brain в server.ts). */
type SttState = { limits: SttLimits; sidecar: SttSidecar }
const STATES = new WeakMap<object, SttState>()

/** Итоговый конфиг: файл (config.stt) + env BRAIN_STT_URL важнее файла. */
export function sttConfig(cfg: BrainConfig): SttConfig {
  const c = { ...DEFAULT_CONFIG.stt, ...(cfg.stt ?? {}) }
  c.rate = { ...DEFAULT_CONFIG.stt.rate, ...(cfg.stt?.rate ?? {}) }
  if (process.env.BRAIN_STT_URL) c.sidecarUrl = process.env.BRAIN_STT_URL
  return c
}

function stateOf(brain: { deps: { config: BrainConfig } }): SttState {
  const url = sttConfig(brain.deps.config).sidecarUrl
  let s = STATES.get(brain.deps)
  if (!s) {
    s = { limits: new SttLimits(), sidecar: new SttSidecar(url) }
    STATES.set(brain.deps, s)
  } else if (s.sidecar.url !== url.replace(/\/+$/, '')) s.sidecar = new SttSidecar(url) // адрес сменили на ходу (selftest)
  return s
}

/** Клиент сайдкара этого мозга (для арбитра GPU после слияния: stt.release() / stt.acquire()). */
export function sttSidecarOf(brain: { deps: { config: BrainConfig } }): SttSidecar {
  return stateOf(brain).sidecar
}

/** Поле stt для healthBody (brain/server.ts). */
export function sttHealth(brain: { deps: { config: BrainConfig } }) {
  return sttHealthField(sttConfig(brain.deps.config), stateOf(brain).sidecar)
}

const AUDIO_TYPES = /^(audio\/(wav|wave|x-wav|vnd\.wave)|application\/octet-stream)\s*(;|$)/i

/** Тело как Buffer не больше limit байт (по Content-Length сразу) — иначе 413 too_long. */
function readAudio(req: http.IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > limit) {
    req.resume()
    return Promise.reject(new BodyError(413, 'too_long', `тело больше ${limit} байт`))
  }
  return new Promise((resolve, reject) => {
    let size = 0
    let over = false
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      if (over) return
      size += c.length
      if (size > limit) {
        over = true
        chunks.length = 0
        reject(new BodyError(413, 'too_long', `тело больше ${limit} байт`))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!over) resolve(Buffer.concat(chunks))
    })
    req.on('error', (e) => {
      if (!over) reject(e)
    })
  })
}

/**
 * Язык распознанного текста: сайдкар уже определил (whisper) → он; пусто → подсказка или 'unknown';
 * иначе detectLang по тексту; короткая реплика (≤ 2 слов) латиницей, не совпавшая с подсказкой uz/en, — по подсказке.
 */
export function sttLang(text: string, hint: SttLang | 'auto', fromSidecar?: string): { lang: SttLang | 'unknown'; langSource: 'hint' | 'script' | 'whisper' } {
  if (fromSidecar === 'ru' || fromSidecar === 'uz' || fromSidecar === 'en') return { lang: fromSidecar, langSource: 'whisper' }
  const t = text.trim()
  if (!t) return { lang: hint === 'auto' ? 'unknown' : hint, langSource: 'hint' }
  const d = detectLang(t)
  if (hint !== 'auto' && d !== hint && hint !== 'ru' && !/[а-яё]/i.test(t) && t.split(/\s+/).length <= 2) return { lang: hint, langSource: 'hint' }
  return { lang: d, langSource: 'script' }
}

function sidecarError(res: http.ServerResponse, cors: Record<string, string>, r: Extract<SidecarResult, { ok: false }>): void {
  switch (r.code) {
    case 'too_long':
      return jsonError(res, 413, 'too_long', 'аудио слишком длинное', cors)
    case 'bad_audio':
      return jsonError(res, 400, 'bad_audio', 'аудио не разобрано', cors, { detail: 'decode' })
    case 'busy':
      return jsonError(res, 429, 'busy', 'распознавание занято — повторите через пару секунд', { ...cors, 'Retry-After': '2' }, { retryAfterSec: 2 })
    case 'internal':
      return jsonError(res, 500, 'internal', 'внутренняя ошибка распознавания', cors)
    default:
      // unavailable / timeout / not_loaded — сайт переходит на Web Speech и проверяет снова через минуту
      return jsonError(res, 503, 'stt_unavailable', 'распознавание речи на сервере сейчас недоступно', { ...cors, 'Retry-After': '10' }, { retryAfterSec: 10 })
  }
}

export async function handleSttRequest(c: SttHttpContext): Promise<void> {
  const { req, res, url, method, cors, client, limited, brain } = c
  const path = url.pathname
  const cfg = sttConfig(brain.deps.config)
  const st = stateOf(brain)

  if (method === 'GET' && path === '/stt/health') return json(res, 200, await sttHealthBody(cfg, st.sidecar, st.limits.running), cors)
  if (method !== 'POST' || path !== '/stt') {
    req.resume()
    return jsonError(res, 404, 'not_found', `${method} ${path.slice(0, 80)}`, cors)
  }
  if (!cfg.enabled) {
    req.resume()
    return jsonError(res, 503, 'stt_unavailable', 'распознавание речи на сервере выключено', { ...cors, 'Retry-After': '60' }, { retryAfterSec: 60 })
  }

  // параметры — до чтения тела
  const langQ = (url.searchParams.get('lang') ?? 'auto').toLowerCase()
  if (langQ !== 'ru' && langQ !== 'uz' && langQ !== 'en' && langQ !== 'auto') {
    req.resume()
    return jsonError(res, 400, 'bad_request', 'lang: ru | uz | en | auto', cors)
  }
  const hint = langQ as SttLang | 'auto'
  const sessHeader = req.headers['x-brain-session']
  const sessRaw = url.searchParams.get('session') ?? (Array.isArray(sessHeader) ? sessHeader[0] : sessHeader) ?? ''
  if (sessRaw && !SESSION_RE.test(sessRaw)) {
    req.resume()
    return jsonError(res, 400, 'bad_request', 'session: [A-Za-z0-9_-]{1,64}', cors)
  }
  const session = sessRaw ? `s:${sessRaw}` : `ip:${client.key}`
  const pq = url.searchParams.get('partial')
  const partial = pq === '1' || pq === 'true'
  if (!AUDIO_TYPES.test(String(req.headers['content-type'] ?? ''))) {
    req.resume()
    return jsonError(res, 415, 'unsupported_media_type', 'нужен Content-Type: audio/wav', cors)
  }

  const verdict = st.limits.acquire(session, client.key, partial, cfg.rate, limited)
  if (!verdict.ok) {
    req.resume()
    const msg = verdict.code === 'busy' ? 'дождитесь распознавания предыдущей реплики' : 'слишком много реплик подряд — подождите немного'
    return jsonError(res, 429, verdict.code, msg, { ...cors, 'Retry-After': String(verdict.retryAfterSec) }, { rule: verdict.rule, retryAfterSec: verdict.retryAfterSec })
  }
  const t0 = performance.now()
  const ac = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })
  try {
    let body: Buffer
    try {
      body = await readAudio(req, cfg.maxBodyBytes)
    } catch (err) {
      if (err instanceof BodyError) return jsonError(res, err.status, err.code, err.message, err.status === 413 ? { ...cors, Connection: 'close' } : cors)
      throw err
    }
    const w = checkSttWav(body, cfg.maxSeconds * 1000)
    if (!w.ok) return jsonError(res, w.error.status, w.error.code, w.error.message, cors, w.error.detail ? { detail: w.error.detail } : {})

    const r1 = await st.sidecar.transcribe(body, { lang: hint, partial, engine: partial ? 'gigaam' : 'auto', timeoutMs: cfg.timeoutMs, signal: ac.signal })
    if (!r1.ok) {
      if (r1.code === 'unavailable' || r1.code === 'timeout' || r1.code === 'not_loaded') st.sidecar.invalidate()
      console.warn(`[stt] ${r1.code} · ${w.info.durationMs} мс аудио · ${body.length} Б`)
      return sidecarError(res, cors, r1)
    }
    let r = r1
    let infer = r1.ms.infer
    let lang = sttLang(r1.text, hint, r1.lang)
    // английский: GigaAM на en «умеренно» — финальную реплику переслушивает whisper (если он загружен)
    if (!partial && lang.lang === 'en' && !r1.engine.startsWith('whisper')) {
      const h = await st.sidecar.health()
      if (h?.engines.some((e) => e.name.startsWith('whisper') && e.loaded)) {
        const r2 = await st.sidecar.transcribe(body, { lang: 'en', partial: false, engine: 'whisper', timeoutMs: cfg.timeoutMs, signal: ac.signal })
        if (r2.ok && r2.text.trim()) {
          r = r2
          infer += r2.ms.infer
          lang = { lang: 'en', langSource: 'whisper' }
        }
      }
    }
    return json(
      res,
      200,
      {
        ok: true,
        text: r.text.trim(),
        lang: lang.lang,
        langSource: lang.langSource,
        confidence: typeof r.confidence === 'number' ? r.confidence : null,
        engine: r.engine,
        device: r.device === 'cuda' ? 'cuda' : 'cpu',
        ms: { queue: r1.ms.queue, decode: r1.ms.decode, infer, total: Math.round(performance.now() - t0) },
        durationMs: w.info.durationMs,
        partial,
      },
      cors,
    )
  } finally {
    st.limits.release(session, partial)
  }
}
