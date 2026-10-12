/**
 * Подсказка для модели картинок. Пресет — его prompt_en + шаблон стиля, без LLM.
 * Свободный текст (только владелец/учитель): нормализация → мат (moderation.ts, ответ R2) → опасные инструкции
 * (postcheck.ts, DANGER_REPLY) → фильтр категорий ЗРУ-444 (filter.ts) → проверка и перевод Gemma строгим JSON
 * (через очередь LLM, ДО окна GPU — пока Gemma в памяти). Ответ не JSON → латиница как есть, иначе просьба
 * написать по-английски или выбрать тему.
 */
import type { LlmClient } from '../llm/ollama.ts'
import { LlmQueue, QueueTicket } from '../llm/queue.ts'
import { moderate, R2 } from '../pipeline/moderation.ts'
import { normalizeInput } from '../pipeline/normalize.ts'
import { DANGER_REPLY, isDangerousRequest } from '../pipeline/postcheck.ts'
import { imageFilter, type ImageFilterCategory } from './filter.ts'
import type { ImagePreset } from './presets.ts'
import { ASK_ENGLISH, IMAGE_MESSAGES, type ImageErrorCode, type ImageLang, type ImageStyle } from './types.ts'

/** Системная подсказка проверки (мок узнаёт её по первому слову IMAGE_CHECK). */
export const IMAGE_CHECK_SYSTEM =
  'IMAGE_CHECK. You screen requests for a picture generator in a school chemistry course for children aged 12–17 in Uzbekistan. ' +
  'Reject (ok=false) if the request involves: nudity or sexual content; violence, gore, cruelty, weapons as the subject; suicide or self-harm; ' +
  'drugs, alcohol, tobacco, vaping or gambling; extremist or hate symbols, politics, flags of organisations; real identifiable people ' +
  '(politicians, celebrities, religious figures); horror meant to frighten; insults, obscene gestures; instructions for explosives, poisons or drugs. ' +
  'Historical scientists are allowed only as a stylised, non-photorealistic illustration (historical_figure=true). ' +
  'Otherwise ok=true and write subject_en: a concise English description (≤ 40 words) of the picture for an educational illustration, ' +
  'no text or labels inside the picture. school=true if the subject fits a school science lesson (chemistry, physics, biology, nature, ' +
  'laboratory equipment, experiments, materials, safety, scientists, everyday science), school=false for unrelated subjects (games, memes, ' +
  'cars, fashion, anime, celebrities, random scenes). Answer ONLY JSON {"ok":bool,"reason":"short, in Russian","subject_en":"…","historical_figure":bool,"school":bool}'

/** Ученик без ключа попросил не учебную картинку. */
const OFF_TOPIC: Record<ImageLang, string> = {
  ru: 'Это не учебная тема. Нарисую что-нибудь по химии или другой науке: прибор, опыт, вещество, схему — опишите, что нужно.',
  uz: 'Bu oʻquv mavzusi emas. Kimyo yoki boshqa fan boʻyicha chizaman: asbob, tajriba, modda, sxema — nima kerakligini yozing.',
  en: 'That is not a school topic. I can draw something from chemistry or another science: apparatus, an experiment, a substance, a diagram — describe it.',
}

/** Шаблоны стилей ({subject} — тема); финальная подсказка ≤ 600 символов. */
export const STYLE_TEMPLATES: Record<ImageStyle, string> = {
  illustration:
    'Clean educational illustration for a school chemistry textbook: {subject}. Accurate laboratory glassware and proportions, soft studio light, plain white background, crisp outlines, gentle shading, high detail. Unlabeled, no text, no letters, no numbers, no logos, no watermark, no people.',
  diagram:
    'Flat vector-style schematic diagram for a chemistry lesson: {subject}. Clear silhouettes, thin dark outlines, calm pastel fills, isometric three-quarter view, plain white background, unlabeled parts, no text, no letters, no watermark.',
  photo:
    'Realistic photograph for a school chemistry textbook: {subject}, on a clean laboratory bench, natural daylight, shallow depth of field, accurate colours of substances, no text, no labels, no people, no brand logos.',
  poster: 'Bright friendly classroom poster illustration: {subject}. Flat colours, bold shapes, cheerful palette, plain background, no text, no letters, no watermark, no people.',
}

const HISTORICAL = ' Stylised historical illustration, not photorealistic.'
export const MAX_FINAL_CHARS = 600

/** Не учебная тема (любое безопасное описание): нейтральная иллюстрация без «лабораторного» шаблона. */
export function generalPrompt(subject: string): string {
  const subj = subject.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim().slice(0, 400)
  return `High-quality detailed illustration: ${subj}. Balanced composition, soft natural light, rich but calm colors, sharp focus. No text, no letters, no watermark, no logos.`.slice(0, MAX_FINAL_CHARS)
}

export function stylePrompt(subject: string, style: ImageStyle, historical = false): string {
  const tpl = STYLE_TEMPLATES[style] ?? STYLE_TEMPLATES.illustration
  const room = MAX_FINAL_CHARS - (tpl.length - '{subject}'.length) - (historical ? HISTORICAL.length : 0)
  const subj = subject.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim().slice(0, Math.max(40, room))
  return (tpl.replace('{subject}', subj) + (historical ? HISTORICAL : '')).slice(0, MAX_FINAL_CHARS)
}

export function presetPrompt(p: ImagePreset, style?: ImageStyle): string {
  return stylePrompt(p.prompt_en, style ?? p.style)
}

export type FreeTextResult =
  | { ok: true; final: string; translated: boolean; subject: string }
  | { ok: false; code: ImageErrorCode; message: string; category?: ImageFilterCategory | 'profanity' | 'danger' | 'llm' }

/** Только латиница/цифры/знаки — можно отдать модели как есть. */
export function isLatinOnly(text: string): boolean {
  return /[A-Za-z]/.test(text) && !/[^\x20-\x7E\n]/.test(text)
}

/** Первый {...} JSON в ответе модели. */
export function parseCheck(raw: string | null): { ok: boolean; reason: string; subject_en: string; historical_figure: boolean; school: boolean } | null {
  if (!raw) return null
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>
    if (typeof j.ok !== 'boolean') return null
    // school отсутствует (старая подсказка/модель) — считаем учебной: отказ только при явном false
    return { ok: j.ok, reason: typeof j.reason === 'string' ? j.reason : '', subject_en: typeof j.subject_en === 'string' ? j.subject_en.trim() : '', historical_figure: j.historical_figure === true, school: j.school !== false }
  } catch {
    return null
  }
}

/**
 * Проверка и перевод свободного запроса. llm — клиент модели (через QueueTicket занимает слот очереди и отдаёт его);
 * null или недоступна — правило латиницы.
 */
export async function checkFreeText(o: {
  text: string
  lang: ImageLang
  style: ImageStyle
  llm: LlmClient | null
  queue: LlmQueue
  llmCheck: boolean
  /** ученик без ключа: без проверки Gemma не рисуем (нет модели → честный not_ready) */
  strict?: boolean
  /** только учебные темы (config.image.students.schoolOnly); по умолчанию — любая безопасная тема */
  schoolOnly?: boolean
  signal?: AbortSignal
}): Promise<FreeTextResult> {
  const lang = o.lang
  const text = normalizeInput(o.text, lang).text
  if (moderate(text).flagged) return { ok: false, code: 'unsafe_prompt', message: R2[lang], category: 'profanity' }
  if (isDangerousRequest(text)) return { ok: false, code: 'unsafe_prompt', message: DANGER_REPLY[lang], category: 'danger' }
  const f = imageFilter(text)
  if (!f.ok) return { ok: false, code: 'unsafe_prompt', message: IMAGE_MESSAGES.unsafe_prompt[lang], category: f.category }
  const fallback = (): FreeTextResult =>
    isLatinOnly(text) ? { ok: true, final: stylePrompt(text, o.style), translated: false, subject: text } : { ok: false, code: 'not_ready', message: ASK_ENGLISH[lang] }
  const st = o.llm?.status()
  if (!o.llmCheck || !o.llm || !st?.available) return o.strict ? { ok: false, code: 'not_ready', message: IMAGE_MESSAGES.not_ready[lang] } : fallback()
  const ticket = new QueueTicket(o.llm, o.queue, { signal: o.signal })
  let raw: string | null
  try {
    raw = await ticket.complete({
      model: st.fastModel ?? st.chatModel ?? '',
      temperature: 0,
      numPredict: 220,
      timeoutMs: 8000,
      signal: o.signal,
      messages: [
        { role: 'system', content: IMAGE_CHECK_SYSTEM },
        { role: 'user', content: text },
      ],
    })
  } catch {
    raw = null
  } finally {
    ticket.release()
  }
  const j = parseCheck(raw)
  if (j && !j.ok) return { ok: false, code: 'unsafe_prompt', message: lang === 'ru' && j.reason ? `${IMAGE_MESSAGES.unsafe_prompt.ru} (${j.reason.slice(0, 160)})` : IMAGE_MESSAGES.unsafe_prompt[lang], category: 'llm' }
  if (!j || !j.subject_en || j.subject_en.length > 400) return o.strict ? { ok: false, code: 'not_ready', message: IMAGE_MESSAGES.not_ready[lang] } : fallback()
  // ученик: только учебная тема (химия, физика, природа, приборы, схемы) — иначе отказ с причиной
  if (o.strict && o.schoolOnly && !j.school) return { ok: false, code: 'unsafe_prompt', message: OFF_TOPIC[lang], category: 'llm' }
  // перевод Gemma тоже проходит фильтр (вдруг модель дописала запрещённое)
  const f2 = imageFilter(j.subject_en)
  if (!f2.ok) return { ok: false, code: 'unsafe_prompt', message: IMAGE_MESSAGES.unsafe_prompt[lang], category: f2.category }
  // учебная тема — школьный стиль (лаборатория, белый фон); любая другая — нейтральная качественная иллюстрация
  const final = j.school ? stylePrompt(j.subject_en, o.style, j.historical_figure) : generalPrompt(j.subject_en)
  return { ok: true, final, translated: !isLatinOnly(text) || j.subject_en !== text, subject: j.subject_en }
}
