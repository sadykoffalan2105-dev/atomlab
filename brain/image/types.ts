/**
 * Картинки (POST /image): общие типы и тексты ошибок на языке запроса (ru / uz / en). Без «не знаю»:
 * если нарисовать нельзя, учитель честно говорит почему и предлагает описать словами или выбрать тему.
 */
import type { ImageEngine, ImageVariant } from '../config.ts'

export type ImageLang = 'ru' | 'uz' | 'en'
export type ImageRole = 'owner' | 'teacher' | 'student'
export type ImageSize = 'square' | 'wide' | 'tall'
export type ImageStyle = 'illustration' | 'diagram' | 'photo' | 'poster'
export type ImageErrorCode = 'disabled' | 'not_ready' | 'forbidden' | 'bad_request' | 'rate' | 'busy' | 'unsafe_prompt' | 'unsafe_image' | 'timeout' | 'internal'
export type ImagePhase = 'checking' | 'waiting_gpu' | 'switching' | 'loading' | 'sampling' | 'decoding' | 'safety' | 'encoding'

export const IMAGE_SIZES: readonly ImageSize[] = ['square', 'wide', 'tall']
export const IMAGE_STYLES: readonly ImageStyle[] = ['illustration', 'diagram', 'photo', 'poster']

/** Проверенное тело POST /image. */
export type ImageRequest = {
  sessionId: string
  studentId?: string
  lang: ImageLang | 'auto'
  presetId?: string
  prompt?: string
  size: ImageSize
  style?: ImageStyle
  seed?: number
  overlay?: { formula?: string; caption?: string }
  context?: { gradeId?: string; sectionTitle?: string; place?: 'chat' | 'lab' }
  teacherKey?: string
}

export type ImageTimings = { queueMs: number; drainMs: number; unloadMs: number; loadMs: number; genMs: number; safetyMs: number; reloadMs: number }

export type ImageSafety = { nsfw: number; normal: number }

/** Событие done (и тело ответа ?wait=1 без dataUrl-обёртки). */
export type ImageDone = {
  jobId: string
  dataUrl: string
  mime: 'image/webp'
  width: number
  height: number
  seed: number
  engine: ImageEngine
  variant: ImageVariant
  ms: number
  timings: ImageTimings
  prompt: { final: string; translated: boolean; presetId?: string }
  safety: ImageSafety
  overlay?: { formula?: string; caption?: string }
  url: string
}

export type ImageErrorEvent = { code: ImageErrorCode; message: string; retryAfterSec?: number }

/** Итог задания в окне GPU (арбитр → сервис). */
export type JobOutcome =
  | { ok: true; bytes: Buffer; safety: ImageSafety }
  | { ok: false; code: ImageErrorCode; reason?: string; retryAfterSec?: number; safety?: ImageSafety }

/**
 * Задание в очереди картинок. Арбитр знает только это: граф строит он сам по engine/variant из конфига,
 * события шлёт через emit, итог отдаёт через finish (ровно один раз).
 */
export type ImageJob = {
  id: string
  role: ImageRole
  createdAt: number
  /** когда задание встало в очередь картинок (после проверки текста) */
  queuedAt: number
  promptFinal: string
  width: number
  height: number
  seed: number
  /** порог классификатора (ученик 0.3, учитель/владелец 0.5) */
  nsfwThreshold: number
  timings: ImageTimings
  /** клиент ушёл — задание не рисуется (или результат выбрасывается) */
  aborted: boolean
  /** финал уже отдан */
  finished: boolean
  emit: (event: 'progress' | 'queue', data: Record<string, unknown>) => void
  finish: (r: JobOutcome) => void
}

export function emptyTimings(): ImageTimings {
  return { queueMs: 0, drainMs: 0, unloadMs: 0, loadMs: 0, genMs: 0, safetyMs: 0, reloadMs: 0 }
}

/** Тексты ошибок для ученика/учителя (без «не знаю»; ст. 16 ЗРУ-444 — без пересказа запрещённого). */
export const IMAGE_MESSAGES: Record<ImageErrorCode, Record<ImageLang, string>> = {
  disabled: {
    ru: 'Рисование сейчас выключено. Давайте я опишу это словами — спросите в чате.',
    uz: 'Rasm chizish hozir oʻchirilgan. Keling, buni soʻz bilan tushuntirib beraman — chatda soʻrang.',
    en: 'Drawing is switched off right now. I can describe it in words instead — just ask in the chat.',
  },
  not_ready: {
    ru: 'Художник ещё готовится (модель картинок загружается). Попробуйте через минуту или спросите словами — опишу.',
    uz: 'Rassom hali tayyorlanmoqda (rasm modeli yuklanmoqda). Bir daqiqadan keyin urinib koʻring yoki soʻz bilan soʻrang.',
    en: 'The artist is still getting ready (the image model is loading). Try again in a minute, or ask in words and I will describe it.',
  },
  forbidden: {
    ru: 'Ученикам рисование пока недоступно — это включает учитель. Могу описать словами.',
    uz: 'Oʻquvchilar uchun rasm chizish hozircha yoqilmagan — buni oʻqituvchi yoqadi. Soʻz bilan tushuntira olaman.',
    en: 'Drawing is not available to students yet — a teacher turns it on. I can describe it in words.',
  },
  bad_request: {
    ru: 'Выберите тему из списка — по ней я нарисую картинку.',
    uz: 'Roʻyxatdan mavzu tanlang — shu boʻyicha rasm chizaman.',
    en: 'Please pick a topic from the list — I will draw it.',
  },
  rate: {
    ru: 'Слишком много картинок подряд — подождите немного.',
    uz: 'Ketma-ket juda koʻp rasm — biroz kuting.',
    en: 'Too many pictures in a row — please wait a little.',
  },
  busy: {
    ru: 'Сейчас много желающих — картинка не успела. Попробуйте через полминуты.',
    uz: 'Hozir navbat koʻp — rasm ulgurmadi. Yarim daqiqadan keyin urinib koʻring.',
    en: 'Lots of requests right now — the picture did not make it. Try again in half a minute.',
  },
  unsafe_prompt: {
    ru: 'Такую картинку я не рисую: на уроке химии для школьников это недопустимо. Давайте нарисуем опыт или прибор.',
    uz: 'Bunday rasm chizmayman: maktab kimyo darsida bu mumkin emas. Keling, tajriba yoki asbobni chizamiz.',
    en: 'I do not draw that: it is not suitable for a school chemistry lesson. Let us draw an experiment or a piece of equipment.',
  },
  unsafe_image: {
    ru: 'Картинка не прошла проверку безопасности, поэтому я её не показываю. Попробуйте другую тему.',
    uz: 'Rasm xavfsizlik tekshiruvidan oʻtmadi, shuning uchun koʻrsatmayman. Boshqa mavzuni sinab koʻring.',
    en: 'The picture did not pass the safety check, so I am not showing it. Please try another topic.',
  },
  timeout: {
    ru: 'Картинка рисовалась слишком долго. Попробуйте ещё раз чуть позже.',
    uz: 'Rasm juda uzoq chizildi. Birozdan keyin yana urinib koʻring.',
    en: 'The picture took too long. Please try again a bit later.',
  },
  internal: {
    ru: 'Художник споткнулся. Попробуйте ещё раз — или спросите словами, я опишу.',
    uz: 'Rassomda nosozlik boʻldi. Yana urinib koʻring yoki soʻz bilan soʻrang — tushuntirib beraman.',
    en: 'The artist stumbled. Please try again, or ask in words and I will describe it.',
  },
}

/** Просьба написать по-английски или выбрать тему (перевод не удался). */
export const ASK_ENGLISH: Record<ImageLang, string> = {
  ru: 'Не получилось разобрать запрос для художника. Напишите его по-английски или выберите тему из списка.',
  uz: 'Rassom uchun soʻrovni tushunib boʻlmadi. Uni inglizcha yozing yoki roʻyxatdan mavzu tanlang.',
  en: 'I could not prepare that request for the artist. Please write it in English or pick a topic from the list.',
}

/** HTTP-статус ошибки для ответа JSON (до потока или ?wait=1). */
export const ERROR_STATUS: Record<ImageErrorCode, number> = {
  disabled: 503,
  not_ready: 503,
  forbidden: 403,
  bad_request: 400,
  rate: 429,
  busy: 503,
  unsafe_prompt: 422,
  unsafe_image: 422,
  timeout: 504,
  internal: 500,
}
