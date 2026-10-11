/**
 * Мозг v2, DIALOG: реплика ученика → самодостаточный вопрос (StandaloneQuery) по состоянию диалога.
 *   «а у натрия?» после «Какая валентность у кислорода?» → «Какая валентность у натрия?» (тема «валентность», сущность «натрий»);
 *   «а почему?» → «Почему: <первое предложение ответа учителя> Объясни причину.»; «объясни проще» → «Объясни проще: валентность»;
 *   «а в 8 классе как это объясняют?» → прежний вопрос + класс g8; «да» после «Хотите задачу?» → выполнить предложение.
 * Правила синхронные (< 5 мс) и идемпотентные: содержательная реплика возвращается как есть (followUp 'none',
 * resolvedBy 'none') — так сайт (src/learn/brain/dialog/dialogManager.ts уже шлёт «объясни проще валентность»)
 * и сервер не переписывают вопрос дважды. Переписывание моделью — только в профиле gpu (maybeLlmRewrite).
 *
 * Шаблоны follow-up и вводные слова — по образцу src/learn/brain/dualMode/followUps.ts (тот модуль тянет
 * локальный компоновщик ответов сайта, поэтому списки скопированы сюда, а не импортированы).
 */
import type { BrainConfig } from '../config.ts'
import { CONCEPTS, type Concept } from '../kb/concepts.ts'
import type { Knowledge } from '../kb/shards.ts'
import type { LlmClient } from '../llm/ollama.ts'
import { ruToEn, ruToUz, uzTopicTerms } from '../persona/uzGlossary.ts'
import { genitive } from './declension.ts'
import type { DialogState, FollowUp, GradeId, LengthClass, Profile, QuestionKind, StandaloneQuery } from './dialogTypes.ts'
import { findConcepts, findElements, findFormulas, findSubstances } from './entities.ts'
import type { Lang } from './normalize.ts'
import { hasCjk, languageOk, splitSentences } from './postcheck.ts'

// ---------------------------------------------------------------- слова

/** Вводные слова в начале реплики (followUps.ts: LEADING_DISCOURSE). */
const LEADING_DISCOURSE = new Set([
  'подожди', 'подождите', 'погоди', 'погодите', 'стоп', 'секунду', 'секундочку', 'минутку', 'слушай', 'слушайте',
  'ну', 'так', 'вот', 'ой', 'эм', 'э', 'хм', 'ага', 'извини', 'извините', 'прости', 'простите', 'а', 'и', 'но',
  'окей', 'ок', 'ладно', 'хорошо', 'учитель', 'wait', 'hold', 'on', 'sorry', 'well', 'so', 'ok', 'okay', 'um', 'uh',
  'hmm', 'and', 'but', 'teacher', 'kuting', "to'xta", 'ustoz', "xo'p", 'mayli', 'domla', 'endi',
])

/** Служебные слова, вопросительные слова, слова follow-up — не задают тему. */
const FILLER = new Set([
  // ru: follow-up (followUps.ts: FOLLOW_UP_FILLER) + вопросительные и служебные
  'почему', 'зачем', 'отчего', 'пример', 'примеры', 'примера', 'приведи', 'приведите', 'например', 'проще', 'попроще',
  'подробнее', 'подробно', 'поподробнее', 'развернуто', 'кратко', 'коротко', 'короче', 'покороче', 'повтори', 'повторите',
  'понял', 'поняла', 'понятно', 'непонятно', 'объясни', 'объясните', 'расскажи', 'расскажите', 'больше', 'поглубже', 'снова',
  'можно', 'пожалуйста', 'давай', 'давайте', 'еще', 'раз', 'скажи', 'скажите', 'деталей', 'словами', 'простыми', 'сначала',
  'жизни', 'что', 'такое', 'такой', 'такая', 'такие', 'какой', 'какая', 'какое', 'какие', 'каким', 'какую', 'какого', 'как',
  'где', 'когда', 'кто', 'сколько', 'чем', 'чему', 'чего', 'ли', 'же', 'бы', 'не', 'нет', 'да', 'то', 'там', 'тут', 'так',
  'тогда', 'теперь', 'тоже', 'также', 'а', 'и', 'но', 'или', 'у', 'для', 'про', 'в', 'во', 'с', 'со', 'на', 'о', 'об', 'от',
  'до', 'по', 'из', 'к', 'ко', 'за', 'при', 'мне', 'меня', 'нам', 'ты', 'вы', 'я', 'мы', 'есть', 'будет', 'было', 'был',
  'была', 'это', 'этого', 'этому', 'этим', 'этом', 'эта', 'эти', 'этот', 'он', 'она', 'оно', 'они', 'его', 'ее', 'их',
  'него', 'нее', 'них', 'ним', 'ней', 'нем', 'ему', 'им', 'ей', 'тема', 'тему', 'теме', 'темы', 'вопрос', 'класс', 'классе',
  'класса', 'классов', 'классах', 'объясняют', 'объяснить', 'объясняется', 'проходят', 'изучают', 'учат', 'учебнике',
  'учебник', 'уровне', 'именно', 'вообще', 'всё', 'все', 'ещё', 'спасибо', 'хочу', 'ага', 'ок', 'окей', 'конечно',
  // en
  'why', 'how', 'what', 'which', 'who', 'when', 'where', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'the', 'a', 'an',
  'of', 'for', 'with', 'in', 'on', 'about', 'and', 'or', 'but', 'it', 'this', 'that', 'they', 'them', 'its', 'please',
  'example', 'examples', 'simpler', 'simply', 'more', 'detail', 'details', 'repeat', 'again', 'explain', 'tell', 'me',
  'deeper', 'understand', 'dont', "don't", 'not', 'once', 'grade', 'th', 'can', 'you', 'give', 'say', 'so', 'come',
  'yes', 'ok', 'okay', 'sure', 'briefly', 'short', 'shorter', 'detailed', 'school', 'level', 'taught', 'explained',
  // uz
  'nega', 'nima', 'uchun', 'nimaga', 'qanday', 'qanaqa', 'qaysi', 'qachon', 'qayerda', 'kim', 'necha', 'qancha', 'bu', 'u',
  'ular', 'uni', 'buni', 'bunda', 'shu', 'misol', 'keltir', 'keltiring', 'batafsil', 'takrorla', 'qayta', 'soddaroq',
  'oddiyroq', 'tushuntir', 'tushuntiring', 'tushunmadim', 'chi', 'va', 'yoki', 'ham', 'esa', 'da', 'haqida', 'sinf', 'sinfda',
  'sinfi', 'ha', 'mayli', 'albatta', 'iltimos', 'yana', 'aytib', 'ber', 'bering', "ko'proq", 'qisqa', 'qisqacha',
])

/** Местоимения-указатели без собственного предмета: «а почему он так реагирует?». */
const DEICTIC = new Set(['это', 'этого', 'этим', 'этом', 'он', 'она', 'оно', 'они', 'его', 'ее', 'их', 'него', 'нее', 'них', 'ним', 'ней', 'такой', 'такая', 'такое', 'такие', 'it', 'this', 'they', 'them', 'bu', 'u', 'ular', 'uni', 'buni'])

const CONFIRM = new Set(['да', 'ага', 'ок', 'окей', 'давай', 'давайте', 'конечно', 'хочу', 'хорошо', 'можно', 'ha', 'xa', 'mayli', 'albatta', "xo'p", 'xop', 'yes', 'ok', 'okay', 'sure', 'yeah', 'yep', 'please', 'go'])

/** Шаблоны follow-up на трёх языках (по образцу followUps.ts: PATTERNS). */
const FU = {
  why: /(?<!\p{L})(почему|зачем|отчего|why|how come|nega|nima uchun|nimaga)(?!\p{L})/iu,
  example: /(пример|например|example|misol)/iu,
  simpler: /(проще|попроще|простыми словами|не понял|не поняла|непонятно|не понятно|simpler|simply|don'?t understand|do not understand|soddaroq|oddiyroq|tushunmadim)/iu,
  more: /(подробн|поглубже|расскажи (ещ[её]|больше)|more detail|in detail|tell me more|go deeper|batafsil|ko['ʻ’‘]?proq)/iu,
  repeat: /(повтори|ещ[её] раз|скажи снова|repeat|say (it )?again|once more|takrorla|qayta ayt)/iu,
}

/** Маркер «переключения»: «а у натрия?», «and for sodium?», «what about…», «natriy-chi?». */
const SWITCH_MARK = /^((ну|так)\s+)?(а|и|and|what about|how about|а что насч[её]т|а как насч[её]т)(?!\p{L})|(?<=\p{L})-?chi\s*[?？.!]*$/iu
/** Вопрос со своей постановкой — не обрывок: «а что такое моль?», «what is…», «… nima?». */
const FULL_Q = /(что так|что это|что значит|что называ|какие свойства|как получ|what is|what are|what does|define|nima(\s|$|\?)|nima degani)/iu

/** Явная длина в текущей реплике. */
const SHORT_RE = /(кратко|коротко|короче|покороче|в двух словах|одним предложением|в одном предложении|briefly|in short|in brief|one sentence|shorter|qisqa(cha|roq)?|bir jumla)/iu
const LONG_RE = /(подробно|подробнее|развёрнуто|развернуто|поподробнее|максимально полно|in detail|detailed|thoroughly|more detail|batafsil|to['ʻ’‘]?liq)/iu
/** Просьба о стиле на весь разговор: «пиши короче», «отвечай подробнее». */
const STYLE_SHORT = /((пиши|отвечай|говори|объясняй)\s+(короче|покороче|кратко|коротко|кратче)|(write|answer|be)\s+(shorter|briefer|brief|more briefly)|qisqaroq\s+(yoz|gapir|javob))/iu
const STYLE_LONG = /((пиши|отвечай|говори|объясняй)\s+(подробнее|подробно|развёрнуто|развернуто)|(write|answer)\s+(longer|in more detail|in detail)|batafsilroq\s+(yoz|gapir|javob))/iu

/** Подсказка класса: «в 8 классе», «для 8-го класса», «8-sinf(da)», «grade 8», «8th grade». */
const GRADE_RES = [
  /(?<!\d)(7|8|9|10|11)\s*[-–]?\s*(?:г?о|й|м|ом|ый)?\s+класс/iu,
  /(?<!\d)(7|8|9|10|11)\s*[-–]?\s*sinf/iu,
  /grade\s*(7|8|9|10|11)(?!\d)/iu,
  /(?<!\d)(7|8|9|10|11)(?:th)?\s+grade/iu,
  /(?<!\d)(7|8|9|10|11)(?:th)?\s+form/iu,
]

export function gradeHint(text: string): GradeId | null {
  for (const re of GRADE_RES) {
    const m = text.match(re)
    if (m) return `g${m[1]}` as GradeId
  }
  return null
}

function fold(w: string): string {
  return w.toLowerCase().replace(/ё/g, 'е').replace(/[ʻʼ‘’`´]/g, "'")
}

type Tok = { w: string; i: number; len: number }

/** Слова текста (как entities.ts: words) с позициями — дефис и знаки делят слова («natriy-chi» → natriy, chi). */
function toks(text: string): Tok[] {
  const out: Tok[] = []
  for (const m of fold(text).matchAll(/[\p{L}']+/gu)) out.push({ w: m[0].replace(/^'+|'+$/g, ''), i: m.index ?? 0, len: m[0].length })
  return out.filter((t) => t.w)
}

/** Снять вводные слова в начале («подождите, а почему…» → «почему…»); если ничего не остаётся — как было. */
export function stripLeadingDiscourse(text: string): string {
  const words = text.trim().split(/\s+/)
  let i = 0
  while (i < words.length - 1) {
    const bare = fold(words[i]!.replace(/[^\p{L}\p{N}'ʻʼ’]/gu, ''))
    if (!bare || !LEADING_DISCOURSE.has(bare)) break
    i++
  }
  if (i === 0) return text.trim()
  const rest = words.slice(i).join(' ').replace(/^[,;:.!—–-]+\s*/, '').trim()
  return rest || text.trim()
}

// ---------------------------------------------------------------- сущности

export type FoundEntity = { ru: string; local: string; kind: 'formula' | 'substance' | 'element'; at: number; end: number }

/** Сущности реплики: формулы (ASCII), вещества и элементы (название по-русски и на языке реплики), с позициями. */
export function entitiesOf(text: string, kb: Knowledge, lang: Lang): FoundEntity[] {
  const out: FoundEntity[] = []
  for (const f of findFormulas(text, lang !== 'en')) {
    // одиночный символ элемента («Na») — элемент по-русски, формула — как есть
    const el = /^[A-Z][a-z]?$/.test(f.ascii) ? kb.qa.elements.find((e) => e.s === f.ascii) : undefined
    out.push({ ru: el ? el.ru : f.ascii, local: el ? (lang === 'ru' ? el.ru : lang === 'uz' ? el.uz : el.en) : f.pretty, kind: el ? 'element' : 'formula', at: f.index, end: f.index + f.raw.length })
  }
  const ws = toks(text)
  const span = (index: number, n: number) => {
    const k = ws.findIndex((t) => t.i === index)
    const last = ws[Math.min(ws.length - 1, (k < 0 ? 0 : k) + Math.max(1, n) - 1)]
    return last ? last.i + last.len : index
  }
  // «misol» (пример) — не «mis» (медь): служебное слово под названием вещества/элемента не считается
  const fillerAt = (index: number) => {
    const t = ws.find((x) => x.i === index)
    return !!t && FILLER.has(t.w)
  }
  for (const s of findSubstances(text, kb)) {
    if (fillerAt(s.index)) continue
    const nWords = (lang === 'ru' ? s.item.ru : lang === 'uz' ? s.item.uz : s.item.en).split(/\s+/).length
    out.push({ ru: s.item.ru, local: (lang === 'ru' ? s.item.ru : lang === 'uz' ? s.item.uz : s.item.en) || s.item.ru, kind: 'substance', at: s.index, end: span(s.index, nWords) })
  }
  for (const e of findElements(text, kb)) {
    if (fillerAt(e.index)) continue
    if (out.some((o) => o.at <= e.index && e.index < o.end)) continue // «серная кислота» уже включает «сера»
    out.push({ ru: e.item.ru, local: lang === 'ru' ? e.item.ru : lang === 'uz' ? e.item.uz : e.item.en, kind: 'element', at: e.index, end: span(e.index, 1) })
  }
  return out.filter((x, i, a) => a.findIndex((y) => y.ru === x.ru) === i).sort((a, b) => a.at - b.at)
}

/** Слова понятий (concepts.ts) — для подсчёта «своих» слов реплики. */
function conceptWordHit(w: string, cs: Concept[]): boolean {
  if (w.length < 3) return false
  return cs.some((c) => [...c.names.ru, ...c.names.uz, ...c.names.en].some((n) => fold(n).split(/[\s-]+/).some((x) => x.length >= 3 && (x === w || (x.length >= 4 && w.length >= 4 && x.slice(0, 5) === w.slice(0, 5))))))
}

/** Содержательные слова реплики (не служебные, не follow-up, не сущности и не понятия). */
export function contentWords(text: string, ents: FoundEntity[] = [], concepts: Concept[] = []): string[] {
  return toks(text)
    .filter((t) => !ents.some((e) => t.i >= e.at && t.i < e.end))
    .map((t) => t.w)
    .filter((w) => w.length >= 3 && !FILLER.has(w) && !/^(почем|объясн|поясн|расскаж|подробн|пример|tushunt|izohla)/u.test(w) && !conceptWordHit(w, concepts))
}

/** Тема по-русски: первое понятие (names.ru[0]), иначе русский термин из узбекского словаря. */
export function topicOf(text: string, lang: Lang): string | null {
  const c = findConcepts(text)[0]
  if (c) return c.names.ru[0]!
  if (lang === 'uz') return uzTopicTerms(text)[0] ?? null
  return null
}

/** Тема на языке ученика (для шаблонов standalone). */
export function topicLocal(topic: string, lang: Lang): string {
  if (lang === 'ru') return topic
  const c = CONCEPTS.find((x) => x.names.ru.some((n) => fold(n) === fold(topic)))
  if (c) return c.names[lang][0]!
  return (lang === 'uz' ? ruToUz(topic) : ruToEn(topic)) ?? topic
}

// ---------------------------------------------------------------- утилиты текста

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const noQ = (s: string) => s.trim().replace(/[?？!.…\s]+$/u, '')

/** Первое предложение ответа учителя без приветствия/R2 (≥ 4 слов), ≤ n символов. */
export function firstSentence(answer: string | null, n = 160): string {
  if (!answer) return ''
  const ss = splitSentences(answer.replace(/\n+/g, ' ')).filter((s) => s.split(/\s+/).length >= 4 && !/^(Пожалуйста, выражайтесь|Iltimos, odob|Please keep it polite)/u.test(s))
  const s = (ss[0] ?? '').trim()
  return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s
}

/** Последнее предложение-вопрос ответа учителя («Хотите задачу?»). */
export function trailingQuestion(answer: string | null): string | null {
  if (!answer || !/\?\s*$/.test(answer.trim())) return null
  const ss = splitSentences(answer.trim())
  return ss[ss.length - 1]?.trim() ?? null
}

/** Слово текста с той же основой, что и слово названия (падежи: «кислорода» ~ «кислород»). */
function sameStem(a: string, b: string): boolean {
  if (a === b) return true
  let p = 0
  while (p < a.length && p < b.length && a[p] === b[p]) p++
  return p >= Math.max(3, Math.max(a.length, b.length) - 3)
}

/**
 * Заменить в тексте прежнюю сущность/тему (в любой падежной форме) на новую. Если прежняя стояла не в
 * именительном — новая ставится в родительный («у кислорода» → «у натрия»). null — заменить нечего.
 */
export function replaceEntity(text: string, oldName: string, newName: string, lang: Lang): string | null {
  // формула — точное совпадение (и с индексами-цифрами)
  if (/^[A-Z]/.test(oldName)) {
    const pretty = oldName.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!)
    for (const v of [oldName, pretty]) {
      const re = new RegExp(`(?<![A-Za-z])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9₀-₉])`)
      if (re.test(text)) return text.replace(re, newName)
    }
    return null
  }
  const ow = toks(oldName).map((t) => t.w)
  if (!ow.length) return null
  const tw = toks(text)
  for (let i = 0; i + ow.length <= tw.length; i++) {
    let ok = true
    for (let k = 0; k < ow.length && ok; k++) ok = sameStem(tw[i + k]!.w, ow[k]!) || (lang !== 'ru' && tw[i + k]!.w.startsWith(ow[k]!))
    if (!ok) continue
    const from = tw[i]!.i
    const last = tw[i + ow.length - 1]!
    const to = last.i + last.len
    const nominative = tw.slice(i, i + ow.length).every((t, k) => t.w === ow[k])
    const lowered = /^[A-Z]/.test(newName) && /\d|[A-Z].*[A-Z]/.test(newName) ? newName : newName.charAt(0).toLowerCase() + newName.slice(1)
    // uz/en: аффикс остаётся («Kislorodning» → «natriyning»), ru: падеж через родительный («у кислорода» → «у натрия»)
    const tail = lang !== 'ru' ? last.w.slice(ow[ow.length - 1]!.length) : ''
    const repl = lang === 'ru' && !nominative && !/^[A-Z]/.test(newName) ? genitive(newName) : lowered + tail
    return text.slice(0, from) + repl + text.slice(to)
  }
  return null
}

// ---------------------------------------------------------------- длина

/** Класс длины по явным словам реплики и follow-up (null — решает план по типу вопроса). */
export function cueLength(original: string, followUp: FollowUp, state: Pick<DialogState, 'lengthPref'> | null): LengthClass | null {
  if (SHORT_RE.test(original)) return 'short'
  if (LONG_RE.test(original) && followUp !== 'simpler') return 'long'
  if (followUp === 'simpler' || followUp === 'example') return 'short'
  if (followUp === 'more') return 'long'
  if (followUp === 'confirm') return /^(спасибо|ок|окей|ok|okay|rahmat)\b/iu.test(original.trim()) ? 'tiny' : 'short'
  return state?.lengthPref ?? null
}

/** Запомнившийся стиль: «пиши короче» / «отвечай подробнее» в прошлых репликах (последний выигрывает). */
export function styleCue(text: string): LengthClass | null {
  if (STYLE_SHORT.test(text)) return 'short'
  if (STYLE_LONG.test(text)) return 'long'
  return null
}

// ---------------------------------------------------------------- разбор реплики

export type ReplyShape = {
  clean: string
  followUp: FollowUp
  ents: FoundEntity[]
  concepts: Concept[]
  own: string[]
  grade: GradeId | null
  cues: (keyof typeof FU)[]
  deictic: string | null
}

export function analyzeReply(text: string, state: DialogState, lang: Lang, kb: Knowledge): ReplyShape {
  const clean = stripLeadingDiscourse(text)
  const ents = entitiesOf(clean, kb, lang)
  const concepts = findConcepts(clean)
  const own = contentWords(clean, ents, concepts)
  const grade = gradeHint(clean)
  const cues = (Object.keys(FU) as (keyof typeof FU)[]).filter((k) => FU[k].test(clean))
  const words = toks(clean).map((t) => t.w)
  const deictic = words.find((w) => DEICTIC.has(w)) ?? null
  const shape = { clean, ents, concepts, own, grade, cues, deictic }
  const hasPrev = !!(state.lastStandalone || state.topic || state.entities.length)
  // «да», «давай», «ha» после ответа, который закончился предложением-вопросом
  if (words.length && words.length <= 2 && words.every((w) => CONFIRM.has(w)) && trailingQuestion(state.lastAnswer)) return { ...shape, followUp: 'confirm' }
  if (!hasPrev) return { ...shape, followUp: 'none' }
  const newSubject = ents.length > 0 || concepts.length > 0
  if (newSubject) {
    // «а у натрия?», «natriy-chi?», «and for sodium?», «а степень окисления?» — та же постановка, другой предмет.
    // Полный вопрос («а что такое моль?», «а у натрия какая валентность?») — не переключение, а новый вопрос.
    const knownEnt = ents.length > 0 && ents.every((e) => state.entities.some((s) => s === e.ru))
    const sameTopic = !ents.length && concepts.every((c) => c.names.ru[0] === state.topic)
    const oneSubject = (ents.length > 0) !== (concepts.length > 0)
    const fragment = SWITCH_MARK.test(text.trim()) && words.length <= 6 && !FULL_Q.test(clean)
    if (fragment && oneSubject && !own.length && !cues.length && !knownEnt && !sameTopic && state.lastStandalone) return { ...shape, followUp: 'switch_entity' }
    return { ...shape, followUp: 'none' }
  }
  if (grade && !own.length) return { ...shape, followUp: 'switch_grade' }
  if (!own.length && cues.length) {
    const pick: (keyof typeof FU)[] = ['repeat', 'simpler', 'example', 'more', 'why']
    return { ...shape, followUp: pick.find((k) => cues.includes(k))! }
  }
  if (deictic && own.length <= 3 && (state.entities[0] || state.topic)) return { ...shape, followUp: 'deictic' }
  // короткий обрывок без предмета: «а как получить?», «где применяется?» — предмет из прошлого вопроса
  if (own.length <= 2 && words.length <= 5 && (state.entities[0] || state.topic) && (/\?\s*$/.test(clean) || SWITCH_MARK.test(text.trim()))) return { ...shape, followUp: 'deictic' }
  return { ...shape, followUp: 'none' }
}

// ---------------------------------------------------------------- самодостаточный вопрос

const TPL = {
  why: { ru: (s: string) => `Почему: ${s} Объясни причину.`, uz: (s: string) => `Nega: ${s} Sababini tushuntir.`, en: (s: string) => `Why: ${s} Explain the reason.` },
  whyTopic: { ru: (t: string) => `Почему так устроено: ${t}? Объясни причину.`, uz: (t: string) => `Nega shunday: ${t}? Sababini tushuntir.`, en: (t: string) => `Why is it so: ${t}? Explain the reason.` },
  simpler: { ru: (t: string) => `Объясни проще: ${t}`, uz: (t: string) => `Soddaroq tushuntir: ${t}`, en: (t: string) => `Explain more simply: ${t}` },
  example: { ru: (t: string) => `Приведи пример: ${t}`, uz: (t: string) => `Misol keltir: ${t}`, en: (t: string) => `Give an example: ${t}` },
  more: { ru: (t: string) => `Расскажи подробнее: ${t}`, uz: (t: string) => `Batafsil aytib ber: ${t}`, en: (t: string) => `Tell me more about: ${t}` },
  confirm: { ru: (q: string, t: string) => `Да: ${q}${t ? ` — по теме «${t}»` : ''}`, uz: (q: string, t: string) => `Ha: ${q}${t ? ` — «${t}» mavzusida` : ''}`, en: (q: string, t: string) => `Yes: ${q}${t ? ` — on “${t}”` : ''}` },
  forEntity: { ru: (b: string, x: string) => `${b} — у ${genitive(x)}?`, uz: (b: string, x: string) => `${x} uchun: ${b}?`, en: (b: string, x: string) => `${b} — for ${x}?` },
}

/** «Натрий» → «натрий» (формулы и аббревиатуры как есть). */
function lowerFirst(s: string): string {
  if (/^[A-Z]/.test(s) && (/\d/.test(s) || /^[A-Z][a-z]?$/.test(s) || /[A-Z].*[A-Z]/.test(s))) return s
  const first = s.split(/\s+/)[0] ?? ''
  if (first.length > 1 && first === first.toUpperCase()) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}

/** Сущность (по-русски или формула ASCII) на языке ученика. */
function localName(e: string, lang: Lang, kb: Knowledge): string {
  if (/^[A-Z]/.test(e)) return e.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]!)
  if (lang === 'ru') return lowerFirst(e)
  const el = kb.qa.elements.find((x) => x.ru === e)
  if (el) return lowerFirst(lang === 'uz' ? el.uz : el.en)
  const s = kb.qa.substances.find((x) => x.ru === e)
  if (s) return lowerFirst((lang === 'uz' ? s.uz : s.en) || s.f)
  return e
}

/** Предмет прошлого вопроса на языке ученика: сущность или тема. */
function subjectLocal(state: DialogState, lang: Lang, kb: Knowledge): string | null {
  const e = state.entities[0]
  if (e) return localName(e, lang, kb)
  return state.topic ? topicLocal(state.topic, lang) : null
}

export function resolveStandalone(text: string, state: DialogState, env: { lang: Lang; cmp: string; kb: Knowledge; gradeId: string }): StandaloneQuery {
  const { lang, kb } = env
  const shape = analyzeReply(text, state, lang, kb)
  const ctxGrade = /^g(7|8|9|10|11)$/.test(env.gradeId) ? (env.gradeId as GradeId) : null
  const base: StandaloneQuery = {
    text,
    lang,
    topic: topicOf(shape.clean, lang),
    entities: shape.ents.map((e) => e.ru),
    grade: shape.grade ?? state.grade ?? ctxGrade,
    scope: 'school',
    kind: 'general',
    lengthClass: 'short',
    followUp: 'none',
    resolvedBy: 'none',
    original: text,
  }
  const done = (sq: StandaloneQuery): StandaloneQuery => ({ ...sq, lengthClass: cueLength(text, sq.followUp, state) ?? sq.lengthClass })
  const tLocal = state.topic ? topicLocal(state.topic, lang) : null
  const subj = subjectLocal(state, lang, kb)
  const lastQ = state.lastStandalone ? noQ(state.lastStandalone) : null
  const rules = (t: string, extra: Partial<StandaloneQuery>): StandaloneQuery =>
    done({ ...base, text: t, topic: state.topic, entities: state.entities.slice(0, 3), resolvedBy: 'rules', ...extra })

  switch (shape.followUp) {
    case 'none':
      return done(base)
    case 'confirm': {
      const q = noQ(trailingQuestion(state.lastAnswer) ?? '')
      return rules(TPL.confirm[lang](q.charAt(0).toLowerCase() + q.slice(1), tLocal ?? ''), { followUp: 'confirm', kind: 'confirm' })
    }
    case 'switch_entity': {
      const x = shape.ents[0]
      if (x) {
        const old = state.entities[0] ? localName(state.entities[0], lang, kb) : null
        const xName = lang === 'ru' ? x.ru : x.local
        const swapped = lastQ && old ? replaceEntity(lastQ, old, xName, lang) : null
        const t = swapped ? `${cap(swapped)}?` : lastQ ? TPL.forEntity[lang](lastQ, lowerFirst(xName)) : text
        return rules(t, { followUp: 'switch_entity', entities: [x.ru], topic: state.topic })
      }
      // новое понятие в той же постановке: «а степень окисления?» после «Какая валентность у натрия?»
      const c = shape.concepts[0]!
      const name = c.names[lang][0]!
      const swapped = lastQ && state.topic ? replaceEntity(lastQ, lang === 'ru' ? state.topic : topicLocal(state.topic, lang), name, lang) : null
      const t = swapped ? `${cap(swapped)}?` : subj && state.entities[0] ? TPL.forEntity[lang](cap(name), subj) : `${cap(name)}?`
      return rules(t, { followUp: 'switch_entity', topic: c.names.ru[0]!, entities: state.entities.slice(0, 3) })
    }
    case 'switch_grade':
      if (!lastQ) return done(base)
      return rules(`${cap(lastQ)}?`, { followUp: 'switch_grade', grade: shape.grade })
    case 'deictic': {
      if (!subj) return done(base)
      const words = shape.clean.split(/\s+/)
      const k = shape.deictic ? words.findIndex((w) => fold(w.replace(/[^\p{L}'ʻʼ’]/gu, '')) === shape.deictic) : -1
      let t: string
      if (k >= 0) {
        const tail = words[k]!.match(/[^\p{L}'ʻʼ’]+$/u)?.[0] ?? ''
        words[k] = subj + tail
        t = words.join(' ')
      } else t = `${noQ(shape.clean)} ${subj}?`
      t = cap(t.replace(/^(а|and)\s+/iu, ''))
      return rules(t, { followUp: 'deictic' })
    }
    case 'why': {
      const s = firstSentence(state.lastAnswer)
      const t = s ? TPL.why[lang](s) : TPL.whyTopic[lang](lastQ ?? subj ?? text)
      return rules(t, { followUp: 'why', kind: 'why' })
    }
    case 'simpler':
      return rules(TPL.simpler[lang](tLocal ?? lastQ ?? subj ?? ''), { followUp: 'simpler', kind: state.lastKind ?? 'definition' })
    case 'example':
      return rules(TPL.example[lang](tLocal ?? subj ?? lastQ ?? ''), { followUp: 'example', kind: 'general' })
    case 'more':
      return rules(TPL.more[lang](tLocal ?? lastQ ?? subj ?? ''), { followUp: 'more', kind: state.lastKind ?? 'general' })
    case 'repeat':
      return rules(state.lastStandalone ?? text, { followUp: 'repeat', kind: 'repeat' })
  }
}

// ---------------------------------------------------------------- переписывание моделью (только gpu)

export const REWRITE_PROMPT: Record<Lang, string> = {
  ru: 'Перепиши последнюю реплику ученика как самостоятельный вопрос по химии на том же языке, используя контекст. Выведи только вопрос.',
  uz: 'Oʻquvchining oxirgi gapini kontekstdan foydalanib, oʻsha tilda mustaqil kimyo savoli qilib qayta yoz. Faqat savolni chiqar.',
  en: "Rewrite the student's last message as a self-contained chemistry question in the same language, using the context. Output only the question.",
}

/** Реплика требует прошлого контекста (нет своего предмета) — кандидат на переписывание моделью. */
function needsPrevious(sq: StandaloneQuery): boolean {
  return sq.resolvedBy === 'none' && !sq.entities.length && !sq.topic
}

export async function maybeLlmRewrite(
  sq: StandaloneQuery,
  state: DialogState,
  deps: { llm: LlmClient | null; config: BrainConfig; profile: Profile },
  signal?: AbortSignal,
): Promise<StandaloneQuery> {
  const { llm, config, profile } = deps
  if (profile !== 'gpu' || !llm || sq.resolvedBy !== 'none' || !needsPrevious(sq)) return sq
  if (sq.original.split(/\s+/).length > 8 || !(state.lastStandalone || state.lastAnswer)) return sq
  const st = llm.status()
  const model = st.fastModel ?? st.chatModel
  if (!st.available || !model) return sq
  const ctx = [state.lastStandalone ? `Q: ${state.lastStandalone}` : '', state.lastAnswer ? `A: ${state.lastAnswer}` : ''].filter(Boolean).join('\n')
  const out = await llm.complete({
    model,
    messages: [
      { role: 'system', content: REWRITE_PROMPT[sq.lang] },
      { role: 'user', content: `${ctx}\n\n${sq.original}` },
    ],
    numPredict: 40,
    timeoutMs: config.dialog.rewriteMs,
    signal,
  })
  const q = out?.trim().split('\n')[0]?.replace(/^["«“]|["»”]$/g, '').trim()
  if (!q || hasCjk(q) || !languageOk(q + ' ' + q, sq.lang) || q.split(/\s+/).length > 25) return sq
  // принимаем, только если вопрос остался в теме прошлого разговора
  const anchors = [state.topic, ...state.entities].filter((x): x is string => !!x).map((x) => fold(x).slice(0, 5))
  const lq = fold(q)
  if (anchors.length && !anchors.some((a) => lq.includes(a))) {
    // тема по-русски, вопрос мог быть на uz/en — сверяем по локальным названиям
    const local = [state.topic ? topicLocal(state.topic, sq.lang) : null].filter((x): x is string => !!x).map((x) => fold(x).slice(0, 5))
    if (!local.some((a) => lq.includes(a))) return sq
  }
  return { ...sq, text: q, topic: sq.topic ?? state.topic, entities: sq.entities.length ? sq.entities : state.entities.slice(0, 3), resolvedBy: 'llm' }
}

/** Тип вопроса для сводки (без SOURCES): совместимость — по старому questionType. */
export type KindFn = (cmp: string, text: string) => QuestionKind
