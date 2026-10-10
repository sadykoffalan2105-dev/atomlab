/**
 * Шаг 2: мат и грубость (ru / uz / en) со снятием маскировки ДО сравнения:
 *   гомоглифы латиница ↔ кириллица («xyй»), транслит («blyat», «suka»), leet («bl9d», «п1зд»),
 *   звёздочки как пропуск буквы («б*я», «f**k»), точки/дефисы внутри слова («х.у.й»),
 *   буквы через пробел («х у й»), повторы букв («бляяять»).
 * Корни привязаны к началу слова (с приставками), поэтому «употреблять», «требует», «скипидар»,
 * «застрахуй», «команда», «себя» не срабатывают; есть и явный белый список.
 * При срабатывании ответ начинается с R2 (на языке вопроса), слова мата вырезаются, конвейер продолжается.
 */
import type { Lang } from './normalize.ts'

/** R2 — дословно из контракта (одинаково в web и server). */
export const R2: Record<Lang, string> = {
  ru: 'Пожалуйста, выражайтесь корректно, использование ненормативной лексики в этом чате недопустимо.',
  uz: 'Iltimos, odob bilan yozing, bu chatda haqoratli so‘zlar ishlatish mumkin emas.',
  en: 'Please keep it polite — profanity is not allowed in this chat.',
}

export const ASK_CHEM: Record<Lang, string> = {
  ru: 'Сформулируйте вопрос по химии — отвечу.',
  uz: 'Kimyo boʻyicha savol bering — javob beraman.',
  en: 'Ask me a chemistry question — I will answer.',
}

const P = '(?:на|по|о|об|от|отъ|ни|за|до|вы|рас|раз|разъ|при|у|с|съ|из|изъ|въ|подъ|про|недо|пере|а|ах|долбо)?'

const RU: RegExp[] = [
  new RegExp(`^${P}ху[йяеию]`),
  /пизд/,
  /^бля/,
  new RegExp(`^${P}(?:еба|ебу|ебл|ебн|ебк|ебо|ебет|ебеш|еби|ебуч)`),
  /^сук(?:а|и|е|у|ой|ин|ам|ами)$/,
  /^суч(?:ар|ий|ье|ья|ка|ки|ку|кой)/,
  /^муд(?:ак|ил|оз|ач)/,
  /гандон/,
  /^долбо/,
  /^пид(?:о|а)р|^пидр/,
  /^(?:на|по|за|ни)?хер(?:ня|ни|н[еиюя]|ов|ова|ово|овы|ач|ь)?$/,
  /залуп/,
  /^манд(?:а|ы|е|у|ой)$|^мандавош/,
  /^шлюх/,
]
const UZ: RegExp[] = [/^jalab/, /^qotoq/, /^am(?:i)?ng(?:ga|ni|izga|i)?$/, /^dalbayob/, /^haromi/, /^iflos/, /^kot(?:$|ing|ga|ni|ingga|ingni)/]
const EN: RegExp[] = [/fuck/, /^(?:bull|horse)?shit/, /bitch/, /asshole/, /^cunt/, /^dick(?:s|head|heads)?$/, /^bastard/, /^motherf/]

const WHITELIST = [
  'употреб', 'хлеб', 'себя', 'себе', 'себаст', 'скипидар', 'застрах', 'страху', 'оскорбл', 'команд', 'подсчет', 'колеб', 'требу',
  'бляшк', 'shiitake', 'shitake', 'mandarin', 'мандарин', 'аминга', 'aminga', 'херес', 'хересск', 'ebon', 'ebol', 'ebul', 'ebay',
]
/** Латинские слова, которые транслитом совпадают с корнями («her» → «хер», «hue» → «хуе»). */
const EXACT_OK = new Set(['her', 'hers', 'hue', 'hues', 'huey', 'ebb'])
/** «iflos» — «грязный»: после него химическое слово — это не ругательство («iflos suv»). */
const IFLOS_OK = /^(suv|havo|eritma|modda|tuproq|idish|gaz|suvni|suvlar|havoni)/

const LAT2CYR: Record<string, string> = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', b: 'в', h: 'н', u: 'и', i: 'и', n: 'п' }
const LEET_CYR: Record<string, string> = { '0': 'о', '3': 'з', '4': 'ч', '@': 'а', '1': 'и', '9': 'я', '6': 'б', $: 'с', '!': 'и' }
const LEET_LAT: Record<string, string> = { '0': 'o', '3': 'e', '4': 'a', '@': 'a', '1': 'i', '!': 'i', $: 's', '5': 's', '7': 't', '9': 'g' }
const TRANSLIT: [RegExp, string][] = [
  [/sch/g, 'щ'], [/sh/g, 'ш'], [/ch/g, 'ч'], [/zh/g, 'ж'], [/kh/g, 'х'], [/ts/g, 'ц'], [/ya/g, 'я'], [/yu/g, 'ю'], [/yo/g, 'е'], [/ye/g, 'е'],
  [/(?<=[aeiouy])y/g, 'й'], [/y$/g, 'й'],
]
const TRANSLIT1: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с',
  t: 'т', u: 'у', f: 'ф', h: 'х', c: 'к', x: 'х', w: 'в', q: 'к', y: 'ы', '9': 'я', '6': 'б', '3': 'з', '4': 'ч', '0': 'о', '@': 'а', '1': 'и',
}

const MASK = '*'
const ALPHA_RU = 'аеиоуыяюлбзйхдпнкст'
const ALPHA_EN = 'aeiouyckt'

function collapse(s: string): string {
  return s.replace(/(.)\1+/g, '$1')
}

function mapChars(s: string, table: Record<string, string>): string {
  let out = ''
  for (const ch of s) out += table[ch] ?? ch
  return out
}

function translit(s: string): string {
  let t = s
  for (const [re, to] of TRANSLIT) t = t.replace(re, to)
  return mapChars(t, TRANSLIT1)
}

/** Подставить буквы вместо «*» (до 3 масок): каждая маска — одна буква алфавита или ничего. */
function expandMasks(s: string, alpha: string): string[] {
  const n = (s.match(/\*/g) ?? []).length
  if (!n) return [s]
  if (n > 3) return [s.replace(/\*/g, '')]
  let outs = ['']
  for (const ch of s) {
    if (ch !== MASK) {
      outs = outs.map((o) => o + ch)
      continue
    }
    const next: string[] = []
    for (const o of outs) {
      next.push(o)
      for (const a of alpha) next.push(o + a)
    }
    outs = next
  }
  return outs
}

/** Варианты написания слова после снятия маскировки. */
function variants(token: string): { cyr: string[]; lat: string[] } {
  const base = token
    .toLowerCase()
    .normalize('NFC')
    .replace(/ё/g, 'е')
    .replace(/[#%]/g, MASK)
    .replace(/[ʻʼ‘’'`´.\-_~^"]/g, '')
  const hasCyr = /[а-я]/.test(base)
  const hasLat = /[a-z]/.test(base)
  const cyr = new Set<string>()
  const lat = new Set<string>()
  const homo = mapChars(mapChars(base, LAT2CYR), LEET_CYR)
  if (/[а-я]/.test(homo)) cyr.add(homo)
  if (hasLat && !hasCyr) {
    if (!EXACT_OK.has(base)) cyr.add(translit(base))
    // английский и узбекский — только для слов латиницей (иначе русский «кот» стал бы узбекским «kot»)
    const l = mapChars(base, LEET_LAT)
    if (/^[a-z*]+$/.test(l)) lat.add(l)
  }
  const outCyr = new Set<string>()
  for (const v of cyr) for (const e of expandMasks(v, ALPHA_RU)) {
    const w = e.replace(/[^а-я]/g, '')
    if (w) {
      outCyr.add(w)
      outCyr.add(collapse(w))
    }
  }
  const outLat = new Set<string>()
  for (const v of lat) for (const e of expandMasks(v, ALPHA_EN)) {
    const w = e.replace(/[^a-z]/g, '')
    if (w) {
      outLat.add(w)
      outLat.add(collapse(w))
    }
  }
  return { cyr: [...outCyr], lat: [...outLat] }
}

function whitelisted(token: string): boolean {
  const t = token.toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ‘’'`]/g, '')
  return EXACT_OK.has(t) || WHITELIST.some((w) => t.startsWith(w))
}

/** Слово — мат? next — следующее слово (для «iflos suv»). */
export function isProfaneWord(token: string, next = ''): boolean {
  if (!/[\p{L}*]/u.test(token) || whitelisted(token)) return false
  const { cyr, lat } = variants(token)
  for (const w of cyr) if (w.length >= 3 && RU.some((re) => re.test(w)) && !whitelisted(w)) return true
  for (const w of lat) {
    if (w.length < 3 || whitelisted(w)) continue
    if (EN.some((re) => re.test(w))) return true
    for (const re of UZ) {
      if (!re.test(w)) continue
      if (re.source === '^iflos' && IFLOS_OK.test(next.toLowerCase().replace(/[ʻʼ‘’'`]/g, ''))) continue
      return true
    }
  }
  return false
}

export type ModerationResult = { flagged: boolean; cleaned: string; words: number }

const EDGE_PUNCT = /^[«»"“”„(),.!?:;…[\]{}]+|[«»"“”„(),.!?:;…[\]{}]+$/g

export function moderate(text: string): ModerationResult {
  const parts = text.split(/(\s+)/)
  const tokens: { i: number; core: string }[] = []
  parts.forEach((p, i) => {
    if (!/^\s+$/.test(p) && p) tokens.push({ i, core: p.replace(EDGE_PUNCT, '') })
  })
  const bad = new Set<number>()
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k]!
    if (t.core && isProfaneWord(t.core, tokens[k + 1]?.core ?? '')) bad.add(t.i)
  }
  // буквы через пробел: «х у й», «б л я т ь»
  for (let k = 0; k < tokens.length; k++) {
    if ([...tokens[k]!.core].length !== 1) continue
    let j = k
    while (j < tokens.length && [...tokens[j]!.core].length === 1) j++
    if (j - k >= 2) {
      const joined = tokens.slice(k, j).map((t) => t.core).join('')
      if (isProfaneWord(joined)) for (let q = k; q < j; q++) bad.add(tokens[q]!.i)
    }
    k = j - 1
  }
  if (!bad.size) return { flagged: false, cleaned: text, words: 0 }
  const kept = parts.map((p, i) => (bad.has(i) ? '' : p)).join('')
  const cleaned = kept
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
    .replace(/^[\s,.;:!?—–-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { flagged: true, cleaned: /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : '', words: bad.size }
}
