/** Краткие квизы по номенклатуре Kimyo 10 (гл. I и классы углеводородов). */

export type NomenclatureOption = {
  id: string
  labelRu: string
  labelEn: string
  labelUz: string
  correct: boolean
}

export type NomenclatureQuestion = {
  id: string
  promptRu: string
  promptEn: string
  promptUz: string
  /** Подсказка: формула / класс */
  formula?: string
  options: readonly NomenclatureOption[]
}

export type NomenclatureQuiz = {
  id: string
  titleRu: string
  titleEn: string
  titleUz: string
  questions: readonly NomenclatureQuestion[]
}

function q(
  partial: Omit<NomenclatureQuestion, 'promptEn' | 'promptUz'> & {
    promptEn?: string
    promptUz?: string
  },
): NomenclatureQuestion {
  return {
    ...partial,
    promptEn: partial.promptEn ?? partial.promptRu,
    promptUz: partial.promptUz ?? partial.promptRu,
  }
}

function opt(
  id: string,
  labelRu: string,
  correct: boolean,
  labelEn?: string,
  labelUz?: string,
): NomenclatureOption {
  return {
    id,
    labelRu,
    labelEn: labelEn ?? labelRu,
    labelUz: labelUz ?? labelRu,
    correct,
  }
}

export const NOMENCLATURE_QUIZZES: readonly NomenclatureQuiz[] = [
  {
    id: 'basics-suffix',
    titleRu: 'Суффиксы классов',
    titleEn: 'Class suffixes',
    titleUz: 'Sinf suffikslari',
    questions: [
      q({
        id: 'suf-ane',
        promptRu: 'Какой суффикс у насыщенных углеводородов (алканов)?',
        promptEn: 'Which suffix do alkanes use?',
        formula: 'CₙH₂ₙ₊₂',
        options: [
          opt('a', '‑ан', true, '-ane', '-an'),
          opt('b', '‑ен', false, '-ene', '-en'),
          opt('c', '‑ин', false, '-yne', '-in'),
          opt('d', '‑ол', false, '-ol', '-ol'),
        ],
      }),
      q({
        id: 'suf-ene',
        promptRu: 'Суффикс алкенов (одна двойная связь)?',
        formula: 'CₙH₂ₙ',
        options: [
          opt('a', '‑ан', false, '-ane', '-an'),
          opt('b', '‑ен', true, '-ene', '-en'),
          opt('c', '‑он', false, '-one', '-on'),
          opt('d', '‑аль', false, '-al', '-al'),
        ],
      }),
      q({
        id: 'suf-ol',
        promptRu: 'Суффикс одноатомных спиртов?',
        formula: 'R–OH',
        options: [
          opt('a', '‑ол', true, '-ol', '-ol'),
          opt('b', '‑аль', false, '-al', '-al'),
          opt('c', '‑он', false, '-one', '-on'),
          opt('d', '‑овая кислота', false, '-oic acid', '-kislota'),
        ],
      }),
      q({
        id: 'suf-al',
        promptRu: 'Суффикс альдегидов?',
        formula: '–CHO',
        options: [
          opt('a', '‑он', false, '-one', '-on'),
          opt('b', '‑аль', true, '-al', '-al'),
          opt('c', '‑ол', false, '-ol', '-ol'),
          opt('d', '‑ат', false, '-ate', '-at'),
        ],
      }),
      q({
        id: 'name-ch4',
        promptRu: 'Как называется CH₄?',
        formula: 'CH₄',
        options: [
          opt('a', 'Метан', true, 'Methane', 'Metan'),
          opt('b', 'Этан', false, 'Ethane', 'Etan'),
          opt('c', 'Метанол', false, 'Methanol', 'Metanol'),
          opt('d', 'Этен', false, 'Ethene', 'Eten'),
        ],
      }),
      q({
        id: 'name-c2h4',
        promptRu: 'Как называется C₂H₄?',
        formula: 'C₂H₄',
        options: [
          opt('a', 'Этан', false, 'Ethane', 'Etan'),
          opt('b', 'Этен (этилен)', true, 'Ethene (ethylene)', 'Eten (etilen)'),
          opt('c', 'Этин', false, 'Ethyne', 'Etin'),
          opt('d', 'Этанол', false, 'Ethanol', 'Etanol'),
        ],
      }),
      q({
        id: 'name-c2h5oh',
        promptRu: 'Систематическое название C₂H₅OH?',
        formula: 'C₂H₅OH',
        options: [
          opt('a', 'Этанол', true, 'Ethanol', 'Etanol'),
          opt('b', 'Этан', false, 'Ethane', 'Etan'),
          opt('c', 'Этаналь', false, 'Ethanal', 'Etanal'),
          opt('d', 'Диметиловый эфир', false, 'Dimethyl ether', 'Dimetil efir'),
        ],
      }),
      q({
        id: 'iso-c4',
        promptRu: 'Какое название у (CH₃)₃CH?',
        formula: 'C₄H₁₀',
        options: [
          opt('a', 'н-Бутан', false, 'n-Butane', 'n-Butan'),
          opt('b', '2-Метилпропан (изобутан)', true, '2-Methylpropane', '2-Metilpropan'),
          opt('c', 'Циклобутан', false, 'Cyclobutane', 'Tsiklobutan'),
          opt('d', 'Бутен', false, 'Butene', 'Buten'),
        ],
      }),
    ],
  },
]

export const NOMENCLATURE_QUIZ_BY_ID: Readonly<Record<string, NomenclatureQuiz>> = Object.fromEntries(
  NOMENCLATURE_QUIZZES.map((z) => [z.id, z]),
)
