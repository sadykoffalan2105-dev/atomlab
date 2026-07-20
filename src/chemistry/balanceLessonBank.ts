import type { ReactorEquationTerm } from './reactorEquationBalance'

export type BalanceLessonKind = 'synthesis' | 'practice_only'

export type BalanceLesson = {
  id: string
  /** i18n key or plain RU title fallback */
  titleRu: string
  titleEn: string
  kind: BalanceLessonKind
  /** Продукт каталога для синтеза (null для practice_only) */
  productId: string | null
  /** Начальные коэффициенты = 1 */
  left: readonly Omit<ReactorEquationTerm, 'id'>[]
  /** Правильные коэффициенты после баланса (для проверки урока) */
  correctLeftCoeffs: readonly number[]
  correctProductCoeff: number
  /** Для practice_only: отображаемое уравнение */
  displayEquationRu?: string
  methodHint: 'substitution' | 'electron' | 'both'
  gradeHint: 7 | 8 | 9
}

/**
 * Учебные примеры 7–9 классов (Kimyo / школьный курс).
 * synthesis — загружается в реактор; practice_only — только балансировка (два продукта).
 */
export const BALANCE_LESSON_BANK: readonly BalanceLesson[] = [
  {
    id: 'fe-o2-fe2o3',
    titleRu: 'Горение железа: Fe + O₂ → Fe₂O₃',
    titleEn: 'Iron combustion: Fe + O₂ → Fe₂O₃',
    kind: 'synthesis',
    productId: 'fe2o3',
    left: [
      { z: 26, coeff: 1 },
      { z: 8, coeff: 1, diatomic: true },
    ],
    correctLeftCoeffs: [4, 3],
    correctProductCoeff: 2,
    methodHint: 'both',
    gradeHint: 7,
  },
  {
    id: 'h2-o2-h2o',
    titleRu: 'Образование воды: H₂ + O₂ → H₂O',
    titleEn: 'Water formation: H₂ + O₂ → H₂O',
    kind: 'synthesis',
    productId: 'h2o',
    left: [
      { z: 1, coeff: 1, diatomic: true },
      { z: 8, coeff: 1, diatomic: true },
    ],
    correctLeftCoeffs: [2, 1],
    correctProductCoeff: 2,
    methodHint: 'substitution',
    gradeHint: 7,
  },
  {
    id: 'al-o2-al2o3',
    titleRu: 'Горение алюминия: Al + O₂ → Al₂O₃',
    titleEn: 'Aluminum combustion: Al + O₂ → Al₂O₃',
    kind: 'synthesis',
    productId: 'al2o3',
    left: [
      { z: 13, coeff: 1 },
      { z: 8, coeff: 1, diatomic: true },
    ],
    correctLeftCoeffs: [4, 3],
    correctProductCoeff: 2,
    methodHint: 'both',
    gradeHint: 8,
  },
  {
    id: 'zn-cuso4',
    titleRu: 'Вытеснение меди: Zn + CuSO₄ → ZnSO₄ + Cu',
    titleEn: 'Copper displacement: Zn + CuSO₄ → ZnSO₄ + Cu',
    kind: 'practice_only',
    productId: null,
    left: [{ z: 30, coeff: 1 }],
    correctLeftCoeffs: [1],
    correctProductCoeff: 1,
    displayEquationRu: 'Zn + CuSO₄ → ZnSO₄ + Cu',
    methodHint: 'electron',
    gradeHint: 9,
  },
]

export function getBalanceLesson(id: string): BalanceLesson | undefined {
  return BALANCE_LESSON_BANK.find((l) => l.id === id)
}

export function lessonToLeftTerms(lesson: BalanceLesson, idPrefix = 'lesson'): ReactorEquationTerm[] {
  return lesson.left.map((t, i) => ({
    id: `${idPrefix}-${lesson.id}-${i}`,
    z: t.z,
    coeff: 1,
    diatomic: t.diatomic,
  }))
}
