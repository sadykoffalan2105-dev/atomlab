/**
 * Детектор «человек vs ИИ» для школьного ДЗ по химии.
 *
 * Это не «антиплагиат-облако», а локальный педагогический анализатор:
 * шаблонные ИИ-фразы, идеальная структура без черновика, отсутствие
 * ученических шероховатостей, «конспект→пересказ LLM».
 *
 * Работает offline; LLM может уточнить вердикт поверх эвристик.
 */

import type { AppLocale } from '../../i18n/types'
import type { AuthorshipAnalysis, AuthorshipSignal, HomeworkAuthorship } from './types'

const AI_PHRASES_RU = [
  'в заключение можно отметить',
  'таким образом, можно сделать вывод',
  'важно подчеркнуть, что',
  'следует отметить, что',
  'необходимо учитывать, что',
  'в современном мире',
  'данная тема является',
  'рассмотрим более подробно',
  'подводя итог вышесказанному',
  'с точки зрения химии',
  'ключевым аспектом является',
  'стоит отметить следующее',
  'в рамках данного вопроса',
  'как известно из курса',
  'для более глубокого понимания',
  'нельзя не упомянуть',
  'играет важную роль',
  'на основании вышеизложенного',
  'подведём итог',
  'рассмотрим основные аспекты',
]

const AI_PHRASES_EN = [
  'in conclusion',
  'it is important to note that',
  'it should be noted that',
  "in today's world",
  'this topic is of great importance',
  'let us delve deeper',
  'from a chemistry perspective',
  'a key aspect is',
  'to summarize the above',
  'as is well known',
  'plays a crucial role',
  'in this essay we will',
  'let us explore',
  'to gain a deeper understanding',
]

const AI_PHRASES_UZ = [
  "xulosa qilib aytganda",
  "shuni ta'kidlash lozim",
  "zamonaviy dunyoda",
  "ushbu mavzu muhim ahamiyatga ega",
  "chuqurroq ko'rib chiqamiz",
  "kimyo nuqtai nazaridan",
  "muhim rol o'ynaydi",
  "asosiy jihatlarni ko'rib chiqamiz",
]

const HUMAN_MARKERS_RU = [
  'я думаю',
  'мне кажется',
  'по-моему',
  'не уверен',
  'не уверена',
  'забыл',
  'забыла',
  'примерно',
  'вроде',
  'типа',
  'короче',
  'ну',
  'типа того',
  'на уроке',
  'учитель говорил',
  'в учебнике',
]

const HUMAN_MARKERS_EN = [
  "i think",
  "i'm not sure",
  'kinda',
  'maybe',
  'in class',
  'the teacher said',
  'from the book',
]

const HUMAN_MARKERS_UZ = ["menimcha", "ishonchim komil emas", "darsda", "o'qituvchi", 'darslikda']

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[''`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?…]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
}

function words(text: string): string[] {
  return text.match(/[a-zа-яўқғҳʼ']+/giu) ?? []
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  const v = mean(xs.map((x) => (x - m) ** 2))
  return Math.sqrt(v)
}

function countHits(hay: string, needles: readonly string[]): number {
  let n = 0
  for (const p of needles) {
    if (hay.includes(p)) n++
  }
  return n
}

function phraseBank(locale: AppLocale): { ai: readonly string[]; human: readonly string[] } {
  if (locale === 'en') return { ai: AI_PHRASES_EN, human: HUMAN_MARKERS_EN }
  if (locale === 'uz') return { ai: AI_PHRASES_UZ, human: HUMAN_MARKERS_UZ }
  return { ai: AI_PHRASES_RU, human: HUMAN_MARKERS_RU }
}

function labelAuthorship(p: number): HomeworkAuthorship {
  if (p >= 0.72) return 'ai_likely'
  if (p <= 0.32) return 'human'
  if (p >= 0.45 && p <= 0.62) return 'mixed'
  return 'uncertain'
}

function summaryFor(
  authorship: HomeworkAuthorship,
  aiProbability: number,
  locale: AppLocale,
): string {
  const pct = Math.round(aiProbability * 100)
  if (locale === 'en') {
    if (authorship === 'ai_likely') {
      return `High chance of AI-generated text (~${pct}%). Looks polished like a model rewrite of notes, not a student draft.`
    }
    if (authorship === 'human') {
      return `Likely written by a student (~${100 - pct}% human markers). Natural unevenness and school wording.`
    }
    if (authorship === 'mixed') {
      return `Mixed signals (~${pct}% AI). Possibly student text edited/expanded by AI.`
    }
    return `Uncertain authorship (~${pct}% AI). Ask the student to explain one step aloud.`
  }
  if (locale === 'uz') {
    if (authorship === 'ai_likely') {
      return `Matn sun'iy intellekt tomonidan yozilgan bo'lishi mumkin (~${pct}%). Juda silliq, o'quvchi qoralamasiga o'xshamaydi.`
    }
    if (authorship === 'human') {
      return `Ko'pincha o'quvchi yozgan (~${100 - pct}% inson belgilari). Tabiiy noto'g'riliklar bor.`
    }
    if (authorship === 'mixed') {
      return `Aralash belgilari (~${pct}% AI). Ehtimol, o'quvchi matnini AI tahrirlagan.`
    }
    return `Muallif noaniq (~${pct}% AI). O'quvchidan og'zaki bitta qadamni so'rang.`
  }
  if (authorship === 'ai_likely') {
    return `Высокая вероятность текста от ИИ (~${pct}%). Похоже на гладкий пересказ конспекта моделью, а не на черновик ученика.`
  }
  if (authorship === 'human') {
    return `Похоже на работу ученика (~${100 - pct}% человеческих маркеров). Есть естественная неровность школьной речи.`
  }
  if (authorship === 'mixed') {
    return `Смешанные признаки (~${pct}% ИИ). Возможно, ученик написал основу, а ИИ сильно отредактировал.`
  }
  return `Авторство неясно (~${pct}% ИИ). Попросите ученика устно объяснить один шаг.`
}

/**
 * Локальный анализ авторства. Чем выше aiProbability — тем сильнее признаки LLM.
 */
export function analyzeAuthorshipLocal(rawText: string, locale: AppLocale = 'ru'): AuthorshipAnalysis {
  const text = rawText.trim()
  const signals: AuthorshipSignal[] = []
  if (text.length < 40) {
    return {
      authorship: 'uncertain',
      aiProbability: 0.5,
      signals: [
        {
          id: 'too_short',
          weight: 0,
          detail:
            locale === 'en'
              ? 'Text too short for a reliable authorship check.'
              : locale === 'uz'
                ? 'Mualliflikni aniqlash uchun matn juda qisqa.'
                : 'Текст слишком короткий для надёжной проверки авторства.',
        },
      ],
      summary:
        locale === 'en'
          ? 'Need more text to judge human vs AI.'
          : locale === 'uz'
            ? 'Inson/AI farqi uchun ko\'proq matn kerak.'
            : 'Нужно больше текста, чтобы отличить человека от ИИ.',
    }
  }

  const norm = normalize(text)
  const sents = sentences(text)
  const w = words(text)
  const bank = phraseBank(locale)

  const aiHits = countHits(norm, bank.ai)
  if (aiHits > 0) {
    signals.push({
      id: 'ai_stock_phrases',
      weight: Math.min(0.28, 0.09 * aiHits),
      detail:
        locale === 'en'
          ? `Stock AI essay phrases: ${aiHits}.`
          : locale === 'uz'
            ? `AI shablon iboralari: ${aiHits}.`
            : `Шаблонные ИИ-обороты: ${aiHits}.`,
    })
  }

  const humanHits = countHits(norm, bank.human)
  if (humanHits > 0) {
    signals.push({
      id: 'human_voice',
      weight: -Math.min(0.3, 0.08 * humanHits),
      detail:
        locale === 'en'
          ? `Student voice markers: ${humanHits}.`
          : locale === 'uz'
            ? `O'quvchi nutqi belgilari: ${humanHits}.`
            : `Маркеры ученической речи: ${humanHits}.`,
    })
  }

  const lengths = sents.map((s) => words(s).length)
  const burst = stdev(lengths) / Math.max(1, mean(lengths))
  // Низкий «burstiness» — одинаковые предложения → типично для LLM.
  if (sents.length >= 4 && burst < 0.28) {
    signals.push({
      id: 'low_burstiness',
      weight: 0.18,
      detail:
        locale === 'en'
          ? 'Sentences are unusually even in length (common in AI drafts).'
          : locale === 'uz'
            ? 'Gaplar uzunligi juda tekis (AI uchun tipik).'
            : 'Предложения подозрительно ровные по длине (часто у ИИ).',
    })
  } else if (sents.length >= 4 && burst > 0.55) {
    signals.push({
      id: 'natural_burstiness',
      weight: -0.12,
      detail:
        locale === 'en'
          ? 'Natural variation in sentence length.'
          : locale === 'uz'
            ? 'Gaplar uzunligi tabiiy o\'zgaradi.'
            : 'Естественный разброс длины предложений.',
    })
  }

  // Идеальная пунктуация + длинные абзацы без помарок
  const typoProxy = (text.match(/[а-яa-z]{3,}[а-яa-z]*[бвгджзклмнпрстфхцчшщ]{4,}/gi) ?? []).length
  const hasEllipsisOrDashMess = /-{2,}|\.{3,}|,{2,}/.test(text)
  if (text.length > 280 && !hasEllipsisOrDashMess && typoProxy === 0 && /[.!]/.test(text)) {
    signals.push({
      id: 'over_polished',
      weight: 0.12,
      detail:
        locale === 'en'
          ? 'Over-polished punctuation and wording for a homework draft.'
          : locale === 'uz'
            ? 'Uy ishi uchun juda silliq yozilgan.'
            : 'Слишком «вылизанный» текст для черновика ДЗ.',
    })
  }

  // Формулы идеально оформлены везде + вводные ИИ
  const formulaDense = (text.match(/\b[A-Z][a-z]?\d*(?:[+\-→=]|→)/g) ?? []).length
  if (formulaDense >= 4 && aiHits >= 1) {
    signals.push({
      id: 'perfect_formula_essay',
      weight: 0.1,
      detail:
        locale === 'en'
          ? 'Dense perfect formulas wrapped in essay boilerplate.'
          : locale === 'uz'
            ? 'Ideal formulalar + esse uslubi.'
            : 'Плотные идеальные формулы в «эссе-обёртке».',
    })
  }

  // Повтор структуры «Во-первых / Во-вторых / В-третьих» без живой речи
  const enumHits = (
    norm.match(/во-первых|во-вторых|в-третьих|firstly|secondly|thirdly|birinchidan|ikkinchidan/g) ?? []
  ).length
  if (enumHits >= 2 && humanHits === 0) {
    signals.push({
      id: 'rigid_enumeration',
      weight: 0.1,
      detail:
        locale === 'en'
          ? 'Rigid firstly/secondly structure without student voice.'
          : locale === 'uz'
            ? 'Qattiq raqamlangan tuzilma, o\'quvchi ovozi yo\'q.'
            : 'Жёсткая нумерация без ученического голоса.',
    })
  }

  // Слишком мало уникальных слов при большой длине (шаблон)
  const unique = new Set(w.map((x) => x.toLowerCase()))
  const uniqueness = unique.size / Math.max(1, w.length)
  if (w.length > 120 && uniqueness < 0.42) {
    signals.push({
      id: 'low_lexical_diversity',
      weight: 0.14,
      detail:
        locale === 'en'
          ? 'Low lexical diversity for this length.'
          : locale === 'uz'
            ? 'Lug\'at boyligi past.'
            : 'Низкое лексическое разнообразие для такого объёма.',
    })
  }

  // Конспект→ИИ: очень общие определения без расчётов/примеров из условия
  const genericDef =
    /является веществом|is a substance|modda hisoblanadi|представляет собой|can be defined as/i.test(
      text,
    )
  if (genericDef && text.length > 200 && !/\d+[.,]?\d*\s*(г|моль|л|%|g|mol|l)/i.test(text)) {
    signals.push({
      id: 'generic_definition_pad',
      weight: 0.11,
      detail:
        locale === 'en'
          ? 'Generic textbook definition padding without concrete homework numbers.'
          : locale === 'uz'
            ? "Umumiy ta'rif, aniq uy ishi raqamlari yo'q."
            : 'Общее определение-простыня без конкретных чисел из ДЗ.',
    })
  }

  // Markdown / эмодзи «как у чатбота»
  const mdHits = (text.match(/^#{1,3}\s|^\*\s|^\-\s|\*\*[^*]+\*\*/gm) ?? []).length
  const emojiHits = (text.match(/[\u{1F300}-\u{1FAFF}]/gu) ?? []).length
  if (mdHits >= 3 || emojiHits >= 2) {
    signals.push({
      id: 'chatbot_formatting',
      weight: 0.12,
      detail:
        locale === 'en'
          ? 'Chatbot-like markdown/emoji formatting unusual for handwritten homework.'
          : locale === 'uz'
            ? "Uy ishi uchun noodatiy markdown/emoji (chatbot uslubi)."
            : 'Форматирование как у чат-бота (markdown/эмодзи) — редко для рукописного ДЗ.',
    })
  }

  // Идеальные маркированные списки без живой речи
  const bulletLines = (text.match(/^\s*([•\-\*]|\d+[.)])\s+\S+/gm) ?? []).length
  if (bulletLines >= 5 && humanHits === 0 && burst < 0.35) {
    signals.push({
      id: 'perfect_bullet_dump',
      weight: 0.1,
      detail:
        locale === 'en'
          ? 'Long tidy bullet dump without student voice — often AI notes rewrite.'
          : locale === 'uz'
            ? "Uzun tartibli ro'yxat, o'quvchi ovozi yo'q — ko'pincha AI konspekt."
            : 'Длинный аккуратный список без голоса ученика — часто ИИ-пересказ конспекта.',
    })
  }

  // Риторические «давайте разберём» без личного опыта
  if (
    /давайте (рассмотрим|разберём)|let us (consider|examine)|keling (ko'rib|tahlil)/i.test(norm) &&
    humanHits === 0
  ) {
    signals.push({
      id: 'lecture_voice',
      weight: 0.09,
      detail:
        locale === 'en'
          ? 'Lecture-style “let us examine” voice without student hedging.'
          : locale === 'uz'
            ? "Ma'ruza uslubi, o'quvchi ikkilanishi yo'q."
            : 'Голос лектора («давайте разберём») без ученических оговорок.',
    })
  }

  let score = 0.42
  for (const s of signals) score += s.weight
  const aiProbability = Math.min(0.97, Math.max(0.03, score))
  const authorship = labelAuthorship(aiProbability)

  return {
    authorship,
    aiProbability,
    signals,
    summary: summaryFor(authorship, aiProbability, locale),
  }
}
