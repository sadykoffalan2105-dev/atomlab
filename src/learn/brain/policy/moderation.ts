/**
 * Модерация реплики ученика (контракт «Локальный мозг» v1, R2).
 *
 * Мат и грубость (ru/uz/en) находятся и под маскировкой: регистр, гомоглифы латиница↔кириллица,
 * leet (0 3 4 @ $ 1 ! 6), звёздочки/точки/дефисы внутри слова, пробелы между одиночными буквами,
 * растянутые буквы («бляяя»). Срабатывание → ответ начинается с R2 на языке вопроса, затем пустая
 * строка и ответ по сути на очищенный вопрос. Сами слова не цитируются.
 */
import { detectQuestionLang, type PolicyLang } from './lang'

/** R2 — дословно как у сервера. */
export const MODERATION_NOTICE: Record<PolicyLang, string> = {
  ru: 'Пожалуйста, выражайтесь корректно, использование ненормативной лексики в этом чате недопустимо.',
  uz: 'Iltimos, odob bilan yozing, bu chatda haqoratli so‘zlar ishlatish mumkin emas.',
  en: 'Please keep it polite — profanity is not allowed in this chat.',
}

/* ------------------------------------------------------------ словари */

/** Корни (после нормализации и схлопывания повторов). `^` — только начало слова. */
const ROOTS: readonly RegExp[] = [
  // ru
  /ху[йяеию]/u,
  /пизд/u,
  /^бля/u,
  /бляд/u,
  /^(за|вы|у|по|на|до|от|отъ|раз|разъ|рас|съ|въ|при|про|об|объ|пере|под|подъ|из|изъ|недо|ото|вз|взъ|долбо|долба|ни|не)?еб(а|у|л|н|о|и|ы|е|ш|т|к|с)/u,
  /^(за|вы|у|по|на|до|от|раз|съ|въ|при|про|об|пере|под|из)?еб$/u,
  /(долбо|долба)е?б/u,
  /^сук(а|и|е|у|ой|ам|ами|ах|ин|ины|ину|ино)?$/u,
  /^суч(к|ар|ь|ий|ье|ья)/u,
  /мудак|мудил|мудач/u,
  /гандон|гондон/u,
  /^долбо/u,
  /пид[оа]р/u,
  /^(на|по|ни)?хер(ня|ни|ню|ней|ов|ова|ово|овый|а|ом|у)?$/u,
  /залуп/u,
  // uz (латиница / кириллица)
  /^jalab/u,
  /^qo'?toq/u,
  /dalba[yj]?o[bp]|dalbaeb/u,
  /^haromi/u,
  /^ko't(i|in|ing|ingni|ingga|ga)?$/u,
  /^жалаб/u,
  /^(қўтоқ|кўтоқ|кутоқ|қотоқ)/u,
  /далба[йи]?[ёе]б/u,
  /^[ҳх]ароми/u,
  // en
  /fuck|fuk(ing|in|er)?$|^fck/u,
  /^shit|shit(ty|head)?$|bulshit/u,
  /bitch/u,
  /ashole|^arsehole/u,
  /^cunt/u,
  /^dick(s|head)?$/u,
  /^bastard/u,
]

/** Канонические слова для масок со звёздочкой («б*я», «f**k», «п*здец»). */
const CANON: readonly string[] = [
  'бля', 'блядь', 'бляди', 'блять', 'сука', 'суки', 'сучка', 'хуй', 'хуя', 'хуе', 'хуйня', 'нахуй', 'похуй', 'охуеть',
  'пизда', 'пиздец', 'пизду', 'ебать', 'ебал', 'ебаный', 'заебал', 'уебок', 'мудак', 'гандон', 'долбоеб', 'пидор',
  'пидорас', 'хер', 'нахер', 'похер', 'херня', 'залупа',
  'jalab', 'qotoq', 'dalbayob', 'haromi',
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'bastard',
]

/** Белый список: обычные слова, похожие на корни. */
const WHITELIST: readonly string[] = [
  'употреб', 'хлеб', 'себя', 'скипидар', 'застрахуй', 'оскорблять', 'страху', 'бляшк', 'блях', 'корабл', 'рубл',
  'ансамбл', 'сабл', 'дирижабл', 'учеб', 'небо', 'колеба', 'требова', 'ебулио', 'хуан', 'shiitake', 'dickens', 'kotar',
  "ko'tar", 'ko‘tar',
]

/* ------------------------------------------------------------ нормализация */

const LAT_TO_CYR_VISUAL: Record<string, string> = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', b: 'в', h: 'н' }
const LAT_TO_CYR_SOUND: Record<string, string> = { a: 'а', e: 'е', o: 'о', p: 'п', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', b: 'б', h: 'х', u: 'у', i: 'и', l: 'л', s: 'с', d: 'д', z: 'з', n: 'н', r: 'р', g: 'г', f: 'ф', v: 'в', j: 'й' }
const CYR_TO_LAT: Record<string, string> = { а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', м: 'm', т: 't', в: 'b', н: 'h', и: 'u', і: 'i' }
const LEET_LAT: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '@': 'a', $: 's', '1': 'i', '!': 'i', '6': 'b', '7': 't' }
const LEET_CYR: Record<string, string> = { '0': 'о', '3': 'е', '4': 'а', '@': 'а', $: 'с', '1': 'и', '!': 'и', '6': 'б', '7': 'т' }

const mapChars = (s: string, table: Record<string, string>) => [...s].map((ch) => table[ch] ?? ch).join('')
const collapse = (s: string) => s.replace(/(\p{L})\1+/gu, '$1')
const isCyr = (s: string) => /\p{Script=Cyrillic}/u.test(s)
const isLat = (s: string) => /\p{Script=Latin}/u.test(s)

function baseFold(token: string): string {
  return token
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`´]/g, "'")
}

/** Варианты написания токена для проверки по корням. */
function variants(token: string, script: 'cyr' | 'lat'): string[] {
  const raw = baseFold(token).replace(/[.\-_*#~|]+/g, '')
  const hasLeet = /\p{L}/u.test(raw) && /[0-9@$!]/.test(raw)
  const out = new Set<string>()
  const add = (s: string) => {
    const clean = s.replace(/[^\p{L}']/gu, '')
    if (!clean) return
    out.add(collapse(clean))
    out.add(collapse(clean.replace(/'/g, '')))
  }
  add(raw)
  const leetC = hasLeet ? mapChars(raw, LEET_CYR) : raw
  const leetL = hasLeet ? mapChars(raw, LEET_LAT) : raw
  add(leetC)
  add(leetL)
  const mixed = isCyr(raw) && isLat(raw)
  // Смешанное слово (xyй, cуkа) — в кириллицу и в латиницу; чисто латинское в кириллическом
  // сообщении (cyka) — в кириллицу; чисто кириллическое в латинском сообщении (фак) — не трогаем.
  if (mixed || (script === 'cyr' && isLat(raw))) {
    add(mapChars(leetC, LAT_TO_CYR_VISUAL))
    add(mapChars(leetC, LAT_TO_CYR_SOUND))
  }
  if (mixed || (script === 'lat' && isCyr(raw))) add(mapChars(leetL, CYR_TO_LAT))
  return [...out]
}

function whitelisted(v: string): boolean {
  return WHITELIST.some((w) => v.includes(w))
}

function rootHit(v: string): boolean {
  if (v.length < 2 || whitelisted(v)) return false
  return ROOTS.some((re) => re.test(v))
}

/** Маска со звёздочкой/решёткой: «б*я» → /^б\p{L}{1,3}я$/ против канонических слов (нужны ≥2 явные буквы). */
function maskHit(token: string): boolean {
  const t = baseFold(token).replace(/['.\-_]/g, '')
  if (!/[*#]/.test(t)) return false
  const letters = t.replace(/[^\p{L}*#]/gu, '')
  if (letters.replace(/[*#]/g, '').length < 2) return false
  const forms = new Set([letters, mapChars(letters, LAT_TO_CYR_SOUND)])
  for (const form of forms) {
    const source = form
      .split(/[*#]+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\p{L}{1,3}')
    let re: RegExp
    try {
      re = new RegExp(`^${source}$`, 'u')
    } catch {
      continue
    }
    if (CANON.some((w) => re.test(w))) return true
  }
  return false
}

/* ------------------------------------------------------------ разбор */

export interface ModerationResult {
  flagged: boolean
  /** Очищенный текст вопроса (без грубых слов). */
  cleaned: string
  lang: PolicyLang
  /** Сколько слов убрано (сами слова не возвращаем). */
  hits: number
}

/** Токены с позициями: одиночные буквы через пробел склеиваем («б л я», «f u c k»). */
function tokenize(text: string): { start: number; end: number; text: string }[] {
  const raw: { start: number; end: number; text: string }[] = []
  const re = /\S+/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) raw.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
  const out: typeof raw = []
  for (let i = 0; i < raw.length; i++) {
    const single = (s: string) => s.replace(/[^\p{L}0-9@$*]/gu, '').length === 1
    if (single(raw[i]!.text)) {
      let j = i
      while (j + 1 < raw.length && single(raw[j + 1]!.text)) j++
      if (j - i + 1 >= 3) {
        out.push({ start: raw[i]!.start, end: raw[j]!.end, text: raw.slice(i, j + 1).map((r) => r.text).join('') })
        i = j
        continue
      }
    }
    out.push(raw[i]!)
  }
  return out
}

/** Проверить реплику ученика. */
export function moderateText(text: string, fallbackLang: PolicyLang = 'ru'): ModerationResult {
  const src = text ?? ''
  const lang = detectQuestionLang(src, fallbackLang)
  const script: 'cyr' | 'lat' = (src.match(/\p{Script=Cyrillic}/gu) ?? []).length >= (src.match(/\p{Script=Latin}/gu) ?? []).length ? 'cyr' : 'lat'
  const tokens = tokenize(src)
  const bad: { start: number; end: number }[] = []
  for (const tok of tokens) {
    // Края токена: пунктуация («б*я,» → «б*я»), но маска внутри слова сохраняется.
    const core = tok.text.replace(/^[^\p{L}0-9@$*#]+|[^\p{L}0-9@$*#]+$/gu, '')
    if (!core) continue
    const hit = maskHit(core) || variants(core, script).some(rootHit)
    if (hit) bad.push(tok)
  }
  if (!bad.length) return { flagged: false, cleaned: src.trim(), lang, hits: 0 }
  let cleaned = ''
  let pos = 0
  for (const b of bad) {
    cleaned += src.slice(pos, b.start)
    pos = b.end
  }
  cleaned += src.slice(pos)
  cleaned = cleaned
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/^[\s,.;:!?—–-]+/u, '')
    .replace(/([,;:])\s*(?=[,;:.!?]|$)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { flagged: true, cleaned, lang, hits: bad.length }
}

/** R2 + пустая строка + ответ по сути. */
export function withModerationNotice(answer: string, lang: PolicyLang): string {
  const notice = MODERATION_NOTICE[lang]
  const body = (answer ?? '').trim()
  return body ? `${notice}\n\n${body}` : notice
}
