import type { AppLocale } from '../../../i18n/types'

/**
 * Подписи bento-хаба «Обучение» (#/learn), которых нет в общих словарях.
 * Отдельный маленький словарь RU/EN/UZ, чтобы не раздувать messages*.ts.
 */
const RU = {
  grades: 'Классы',
  chaptersShort: '{n} гл.',
  byGrade: 'По классам',
  startEyebrow: 'С чего начать',
  startTitle: 'Начните с 7 класса',
  startCta: 'Начать',
  resumeCta: 'Продолжить',
  gradeAria: '{title}: {done} из {total} параграфов, {pct}%',
  askSample: 'Почему железо ржавеет?',
  answerSample: 'Железо окисляется кислородом при участии воды.',
  startMeta: 'Kimyo, 7 класс (2022)',
  startHint: 'Начните с любого класса — прогресс сохраняется в этом браузере',
  stNotStarted: 'Не начат',
  stInProgress: 'В процессе',
  stDone: 'Пройден',
  stHere: 'Вы здесь',
  heroStart: 'Начать учёбу',
  heroResume: 'Продолжить учёбу',
  heroAsk: 'Спросить ИИ-учителя',
  sectionsShort: '§',
}

type BentoDict = typeof RU

const EN: BentoDict = {
  grades: 'Grades',
  chaptersShort: '{n} ch.',
  byGrade: 'By grade',
  startEyebrow: 'Where to start',
  startTitle: 'Start with Grade 7',
  startCta: 'Start',
  resumeCta: 'Continue',
  gradeAria: '{title}: {done} of {total} sections, {pct}%',
  askSample: 'Why does iron rust?',
  answerSample: 'Iron is oxidised by oxygen when water is present.',
  startMeta: 'Kimyo, grade 7 (2022)',
  startHint: 'Start with any grade — progress is saved in this browser',
  stNotStarted: 'Not started',
  stInProgress: 'In progress',
  stDone: 'Completed',
  stHere: 'You are here',
  heroStart: 'Start learning',
  heroResume: 'Continue learning',
  heroAsk: 'Ask the AI teacher',
  sectionsShort: '§',
}

const UZ: BentoDict = {
  grades: 'Sinflar',
  chaptersShort: '{n} bob',
  byGrade: 'Sinflar bo‘yicha',
  startEyebrow: 'Nimadan boshlash',
  startTitle: '7-sinfdan boshlang',
  startCta: 'Boshlash',
  resumeCta: 'Davom etish',
  gradeAria: '{title}: {total} ta paragrafdan {done} tasi, {pct}%',
  askSample: 'Nega temir zanglaydi?',
  answerSample: 'Temir suv ishtirokida kislorod bilan oksidlanadi.',
  startMeta: 'Kimyo, 7-sinf (2022)',
  startHint: 'Istalgan sinfdan boshlang — natijalar shu brauzerda saqlanadi',
  stNotStarted: 'Boshlanmagan',
  stInProgress: 'Jarayonda',
  stDone: 'Tugallangan',
  stHere: 'Siz shu yerdasiz',
  heroStart: 'O‘qishni boshlash',
  heroResume: 'O‘qishni davom ettirish',
  heroAsk: 'AI o‘qituvchidan so‘rash',
  sectionsShort: '§',
}

const TABLE: Record<AppLocale, BentoDict> = { ru: RU, en: EN, uz: UZ }

export type BentoKey = keyof BentoDict

export function bentoText(
  locale: AppLocale,
  key: BentoKey,
  params?: Readonly<Record<string, string | number>>,
): string {
  const raw = (TABLE[locale] ?? RU)[key] ?? RU[key]
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m))
}
