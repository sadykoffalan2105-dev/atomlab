import type { LearnGradeId } from '../types/learn'

/** Привязка § к ФГОС (базовый уровень, химия 7–9 класс, РФ). */
export type LearnFgosMeta = {
  /** Код темы / раздела программы (укрупнённо). */
  programBlock: string
  /** Формируемые умения (кратко). */
  skills: readonly string[]
  /** Рекомендуемое число академических часов на §. */
  hours: number
  /** Уровень наполнения контента в ATOMLAB. */
  contentTier: 'full' | 'standard' | 'outline'
}

const FULL_G7_PREFIXES = new Set(
  [
    ...Array.from({ length: 10 }, (_, i) => `g7-c1-s${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 6 }, (_, i) => `g7-c2-s${String(i + 1).padStart(2, '0')}`),
  ],
)

const BLOCK_BY_GRADE_CHAPTER: Record<string, string> = {
  'g7-c1': '7.1 Вещество. Химия как наука',
  'g7-c2': '7.2 Химический элемент и символ',
  'g7-c3': '7.3 Периодическая система',
  'g7-c4': '7.4 Воздух. Кислород. Оксиды',
  'g7-c5': '7.5 Водород. Кислоты',
  'g7-c6': '7.6 Вода',
  'g7-c7': '7.7 Химия в организме',
  'g7-c8': '7.8 Полезные ископаемые',
  'g8-c1': '8.1 Повторение. Классы неорганики',
  'g8-c2': '8.2 Периодический закон',
  'g8-c3': '8.3 Химическая связь',
  'g8-c4': '8.4 Растворы. Диссоциация',
  'g8-c5': '8.5 Расчёты по уравнениям',
  'g9-c1': '9.1 Металлы',
  'g9-c2': '9.2 Неметаллы',
  'g9-c3': '9.3 Кислоты. Соли. Оксиды',
  'g9-c4': '9.4 Органические вещества (введение)',
  'g9-c5': '9.5 Химия и общество',
  'g9-c6': '9.6 Повторение',
  'g9-c7': '9.7 Подготовка к итоговой аттестации',
}

function defaultSkills(gradeId: LearnGradeId): string[] {
  if (gradeId === 'g7') {
    return [
      'описывать свойства веществ и явления',
      'работать с моделями и 3D-иллюстрациями',
      'соблюдать правила ТБ на уроке',
    ]
  }
  if (gradeId === 'g8') {
    return [
      'классифицировать неорганические соединения',
      'составлять уравнения реакций',
      'решать расчётные задачи',
    ]
  }
  return [
    'объяснять свойства металлов и неметаллов',
    'применять ОВР и электролиз',
    'готовиться к ОГЭ по химии',
  ]
}

export function learnSectionPathKey(gradeId: string, chapterId: string, sectionId: string): string {
  return `${gradeId}-${chapterId}-${sectionId}`
}

export function getLearnFgosMeta(
  gradeId: LearnGradeId,
  chapterId: string,
  sectionId: string,
): LearnFgosMeta {
  const path = learnSectionPathKey(gradeId, chapterId, sectionId)
  const block = BLOCK_BY_GRADE_CHAPTER[`${gradeId}-${chapterId}`] ?? `Химия ${gradeId}`
  const contentTier: LearnFgosMeta['contentTier'] = FULL_G7_PREFIXES.has(path)
    ? 'full'
    : gradeId === 'g7'
      ? 'standard'
      : 'outline'
  return {
    programBlock: block,
    skills: defaultSkills(gradeId),
    hours: contentTier === 'full' ? 2 : 1,
    contentTier,
  }
}
