import { learnSectionPathKey } from '../data/learnFgosMatrix'
import { getG7SectionQuizPool } from './g7SectionQuizBank'
import { G7_CHAPTER_TEMPLATES } from './g7TopicQuizTemplates'
import { getGradeChapterTemplates } from './g8g9TopicQuizTemplates'
import type { TopicQuizItem } from './topicQuizTypes'

type Template = {
  templateKey: string
  question: string
  choices: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation?: string
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWith<T>(items: T[], rand: () => number): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

function withChoices(
  correct: string,
  pool: string[],
  rand: () => number,
): { choices: [string, string, string, string]; correctIndex: 0 | 1 | 2 | 3 } {
  const wrong = pool.filter((x) => x !== correct)
  const picks = shuffleWith(wrong, rand).slice(0, 3)
  while (picks.length < 3) picks.push('Утверждение не соответствует учебнику')
  const choices = shuffleWith([correct, picks[0]!, picks[1]!, picks[2]!], rand) as string[]
  const correctIndex = choices.indexOf(correct) as 0 | 1 | 2 | 3
  return {
    choices: choices as [string, string, string, string],
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
  }
}

function mk(templateKey: string, question: string, correct: string, pool: string[], explanation?: string): Template {
  return {
    templateKey,
    question,
    choices: [correct, pool[0] ?? '—', pool[1] ?? '—', pool[2] ?? '—'],
    correctIndex: 0,
    explanation,
  }
}

const CHAPTER_TEMPLATES = G7_CHAPTER_TEMPLATES

function numericPool(ch: number, sec: number, i: number): Template {
  const n = ch * 10 + sec + i
  const mass = 18 + (n % 40)
  const mols = (mass / 18).toFixed(1)
  const wrong1 = (mass / 9).toFixed(1)
  const wrong2 = (mass / 36).toFixed(1)
  const wrong3 = String(mass)
  return mk(
    `num-${ch}-${sec}-${i}`,
    `Сколько моль содержится в ${mass} г воды (Mr ≈ 18)?`,
    `${mols} моль`,
    [`${wrong1} моль`, `${wrong2} моль`, `${wrong3} моль`],
    'n = m / Mr',
  )
}

function shuffleQuizItem(item: TopicQuizItem, rand: () => number): TopicQuizItem {
  const correct = item.choices[item.correctIndex] ?? item.choices[0]!
  const { choices, correctIndex } = withChoices(correct, [...item.choices], rand)
  return { ...item, choices, correctIndex }
}

/** Вопросы строго по § учебника Kimyo 7 (g7SectionQuizBank.json). */
function buildG7SectionPool(chapterId: string, sectionId: string, seed: number): TopicQuizItem[] {
  const base = getG7SectionQuizPool(chapterId, sectionId)
  if (base.length === 0) return []
  const rand = mulberry32(seed)
  return base.map((item) => shuffleQuizItem(item, rand))
}

function expandToPool(gradeId: string, ch: number, sec: number, seed: number): TopicQuizItem[] {
  const rand = mulberry32(seed)
  const gradeTemplates = getGradeChapterTemplates(gradeId, ch)
  const base = gradeTemplates ?? CHAPTER_TEMPLATES[ch] ?? CHAPTER_TEMPLATES[1]!
  const gradePrefix = gradeId === 'g8' || gradeId === 'g9' ? gradeId : 'g7'
  const out: TopicQuizItem[] = []

  for (let i = 0; i < 50; i++) {
    let template: Template
    if (i < base.length) {
      template = base[i % base.length]!
    } else if (i < 35 && ch >= 2) {
      template = numericPool(ch, sec, i)
    } else {
      template = base[i % base.length]!
    }

    const distractorPool = [...template.choices, 'Нужно повторить §', 'Зависит от условия', 'Неверное утверждение']
    const correct = template.choices[template.correctIndex] ?? template.choices[0]!
    const { choices, correctIndex } = withChoices(correct, distractorPool, rand)

    const id = `${gradePrefix}-c${ch}-s${String(sec).padStart(2, '0')}-q${i + 1}`

    out.push({
      id,
      templateKey: template.templateKey,
      question: template.question,
      choices,
      correctIndex,
      explanation: template.explanation,
    })
  }

  return out.slice(0, 50)
}

const POOL_CACHE = new Map<string, TopicQuizItem[]>()

export function getTopicQuizPool(gradeId: string, chapterId: string, sectionId: string): TopicQuizItem[] {
  const key = learnSectionPathKey(gradeId, chapterId, sectionId)
  let pool = POOL_CACHE.get(key)
  if (!pool) {
    const ch = Number(chapterId.replace(/^c/, '')) || 1
    const sec = Number(sectionId.replace(/^s/, '')) || 1
    const seed = ch * 1000 + sec * 17 + (gradeId === 'g8' ? 80 : gradeId === 'g9' ? 90 : 42)
    if (gradeId === 'g7') {
      pool = buildG7SectionPool(chapterId, sectionId, seed)
    } else {
      pool = expandToPool(gradeId, ch, sec, seed)
    }
    POOL_CACHE.set(key, pool)
  }
  return pool
}

export function pickRandomTopicQuiz(
  gradeId: string,
  chapterId: string,
  sectionId: string,
  excludeIds: ReadonlySet<string> = new Set(),
): TopicQuizItem {
  const pool = getTopicQuizPool(gradeId, chapterId, sectionId)
  const available = pool.filter((q) => !excludeIds.has(q.id))
  const list = available.length > 0 ? available : pool
  const idx = Math.floor(Math.random() * list.length)
  return list[idx]!
}

export function topicQuizPoolSize(gradeId: string, chapterId: string, sectionId: string): number {
  return getTopicQuizPool(gradeId, chapterId, sectionId).length
}
