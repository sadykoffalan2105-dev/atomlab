/**
 * Химическая оценка текста ДЗ: ключевые понятия + грубые ошибки + рубрика.
 */

import type { AppLocale } from '../../i18n/types'
import { retrieveChemistryKnowledge } from '../learnKnowledgeRetrieval'
import type { ChemistryAnalysis, ChemistryIssue, HomeworkChemistryVerdict } from './types'

const CONCEPT_BANK: { id: string; keys: RegExp; labelRu: string; labelEn: string; labelUz: string }[] = [
  {
    id: 'atom',
    keys: /атом|atom|atomlar/i,
    labelRu: 'атом',
    labelEn: 'atom',
    labelUz: 'atom',
  },
  {
    id: 'molecule',
    keys: /молекул|molecule|molekula/i,
    labelRu: 'молекула',
    labelEn: 'molecule',
    labelUz: 'molekula',
  },
  {
    id: 'reaction',
    keys: /реакц|reaction|reaksiya/i,
    labelRu: 'реакция',
    labelEn: 'reaction',
    labelUz: 'reaksiya',
  },
  {
    id: 'oxide',
    keys: /оксид|oxide|oksid/i,
    labelRu: 'оксид',
    labelEn: 'oxide',
    labelUz: 'oksid',
  },
  {
    id: 'acid',
    keys: /кислот|acid|kislota/i,
    labelRu: 'кислота',
    labelEn: 'acid',
    labelUz: 'kislota',
  },
  {
    id: 'base',
    keys: /основан|щёлоч|щелоч|hydroxide|asos|ishqor/i,
    labelRu: 'основание/щёлочь',
    labelEn: 'base/alkali',
    labelUz: 'asos/ishqor',
  },
  {
    id: 'salt',
    keys: /соль|соли|salt|tuz\b/i,
    labelRu: 'соль',
    labelEn: 'salt',
    labelUz: 'tuz',
  },
  {
    id: 'valence',
    keys: /валентн|valency|valence|valentlik/i,
    labelRu: 'валентность',
    labelEn: 'valency',
    labelUz: 'valentlik',
  },
  {
    id: 'oxidation',
    keys: /степен[ьи] окислен|oxidation state|oksidlanish daraja/i,
    labelRu: 'степень окисления',
    labelEn: 'oxidation state',
    labelUz: 'oksidlanish darajasi',
  },
  {
    id: 'mole',
    keys: /моль|molar|mol\b|n\s*=/i,
    labelRu: 'моль/расчёт',
    labelEn: 'mole/calculation',
    labelUz: 'mol/hisob',
  },
]

const ERROR_PATTERNS: { re: RegExp; ru: string; en: string; uz: string }[] = [
  {
    re: /натрий\s*\+\s*хлор\s*=\s*вода|sodium\s*\+\s*chlorine\s*=\s*water/i,
    ru: 'Неверная реакция: натрий с хлором не даёт воду.',
    en: 'Wrong reaction: sodium + chlorine does not make water.',
    uz: "Noto'g'ri reaksiya: natriy + xlor suv bermaydi.",
  },
  {
    re: /h2o\s*[—\-–]?\s*элемент|water is an element|suv element/i,
    ru: 'Вода — сложное вещество (соединение), не элемент.',
    en: 'Water is a compound, not an element.',
    uz: "Suv murakkab modda (birikma), element emas.",
  },
  {
    re: /кислород\s+металл|oxygen is a metal|kislorod metall/i,
    ru: 'Кислород — неметалл.',
    en: 'Oxygen is a non-metal.',
    uz: 'Kislorod — nometall.',
  },
]

function pickLabel(
  row: { labelRu: string; labelEn: string; labelUz: string },
  locale: AppLocale,
): string {
  if (locale === 'en') return row.labelEn
  if (locale === 'uz') return row.labelUz
  return row.labelRu
}

function msg(row: { ru: string; en: string; uz: string }, locale: AppLocale): string {
  if (locale === 'en') return row.en
  if (locale === 'uz') return row.uz
  return row.ru
}

function verdictFromScore(score: number): HomeworkChemistryVerdict {
  if (score >= 88) return 'excellent'
  if (score >= 72) return 'good'
  if (score >= 55) return 'fair'
  if (score >= 35) return 'weak'
  return 'off_topic'
}

export function analyzeChemistryLocal(
  text: string,
  opts: { locale: AppLocale; topicHint?: string; gradeId?: string },
): ChemistryAnalysis {
  const locale = opts.locale
  const trimmed = text.trim()
  const issues: ChemistryIssue[] = []
  const strengths: string[] = []
  const keyConceptsHit: string[] = []

  if (trimmed.length < 20) {
    return {
      verdict: 'weak',
      score: 15,
      strengths: [],
      issues: [
        {
          kind: 'omission',
          message:
            locale === 'en'
              ? 'Almost empty work.'
              : locale === 'uz'
                ? 'Ish deyarli bo\'sh.'
                : 'Работа почти пустая.',
        },
      ],
      keyConceptsHit: [],
      teacherNote:
        locale === 'en'
          ? 'Ask the student to rewrite with definitions and an example.'
          : locale === 'uz'
            ? "O'quvchidan ta'rif va misol bilan qayta yozishni so'rang."
            : 'Попросите переписать с определением и примером.',
    }
  }

  for (const c of CONCEPT_BANK) {
    if (c.keys.test(trimmed) || (opts.topicHint && c.keys.test(opts.topicHint))) {
      if (c.keys.test(trimmed)) {
        keyConceptsHit.push(pickLabel(c, locale))
      }
    }
  }

  for (const err of ERROR_PATTERNS) {
    if (err.re.test(trimmed)) {
      issues.push({ kind: 'error', message: msg(err, locale) })
    }
  }

  const retrieved = retrieveChemistryKnowledge(opts.topicHint ? `${opts.topicHint}\n${trimmed}` : trimmed, {
    maxChunks: 6,
    minScore: 1,
    gradeId: opts.gradeId,
  })

  let score = 40
  score += Math.min(30, keyConceptsHit.length * 6)
  score += Math.min(18, retrieved.score * 3)
  if (/[=→+\-]|→/.test(trimmed) || /\bH2O\b|\bNaCl\b|\bCO2\b/i.test(trimmed)) {
    score += 8
    strengths.push(
      locale === 'en'
        ? 'Uses formulas/equation signs'
        : locale === 'uz'
          ? 'Formula/tenglama belgilari bor'
          : 'Есть формулы или знаки уравнения',
    )
  }
  if (/\d/.test(trimmed)) {
    score += 5
    strengths.push(
      locale === 'en' ? 'Includes numbers/amounts' : locale === 'uz' ? 'Raqamlar bor' : 'Есть числа/количества',
    )
  }
  if (keyConceptsHit.length >= 2) {
    strengths.push(
      locale === 'en'
        ? `Key ideas: ${keyConceptsHit.slice(0, 4).join(', ')}`
        : locale === 'uz'
          ? `Asosiy tushunchalar: ${keyConceptsHit.slice(0, 4).join(', ')}`
          : `Ключевые понятия: ${keyConceptsHit.slice(0, 4).join(', ')}`,
    )
  }

  score -= issues.filter((i) => i.kind === 'error').length * 18
  if (trimmed.length < 80) {
    issues.push({
      kind: 'omission',
      message:
        locale === 'en'
          ? 'Too short for a full homework answer.'
          : locale === 'uz'
            ? 'To\'liq uy ishi uchun juda qisqa.'
            : 'Слишком коротко для полноценного ответа ДЗ.',
    })
    score -= 8
  }

  if (retrieved.score < 2 && keyConceptsHit.length === 0) {
    issues.push({
      kind: 'omission',
      message:
        locale === 'en'
          ? 'Weak link to school chemistry topic.'
          : locale === 'uz'
            ? 'Maktab kimyo mavzusiga bog\'liqligi zaif.'
            : 'Слабая связь со школьной темой по химии.',
    })
    score -= 12
  }

  score = Math.min(100, Math.max(0, Math.round(score)))
  const verdict = verdictFromScore(score)

  const teacherNote =
    locale === 'en'
      ? `Chemistry score ${score}/100 (${verdict}). Focus feedback on missing concepts and any factual errors.`
      : locale === 'uz'
        ? `Kimyo bahosi ${score}/100 (${verdict}). Yetishmayotgan tushunchalar va xatolarga e'tibor bering.`
        : `Химия: ${score}/100 (${verdict}). Сфокусируйте разбор на пробелах и фактических ошибках.`

  return {
    verdict,
    score,
    strengths,
    issues,
    keyConceptsHit,
    teacherNote,
  }
}
