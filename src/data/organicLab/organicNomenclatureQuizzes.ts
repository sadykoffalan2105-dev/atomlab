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
  {
    id: 'g10-textbook-names',
    titleRu: 'Названия молекул учебника (с. 30–33)',
    titleEn: 'Naming the textbook molecules (pp. 30–33)',
    titleUz: 'Darslikdagi molekulalar nomi (30–33-betlar)',
    questions: [
      q({
        id: 'tb-2-methylpentane',
        promptRu: 'Назовите алкан (с. 30): выберите самую длинную цепь и нумеруйте от ближайшего разветвления.',
        promptEn: 'Name the alkane (p. 30): take the longest chain and number from the nearest branch.',
        promptUz: 'Alkanni nomlang (30-bet): eng uzun zanjirni oling va eng yaqin shoxdan raqamlang.',
        formula: 'CH₃–CH(CH₃)–CH₂–CH₂–CH₃',
        options: [
          opt('a', '2-Метилпентан', true, '2-Methylpentane', '2-Metilpentan'),
          opt('b', '4-Метилпентан', false, '4-Methylpentane', '4-Metilpentan'),
          opt('c', '2-Метилбутан', false, '2-Methylbutane', '2-Metilbutan'),
          opt('d', '1,1-Диметилбутан', false, '1,1-Dimethylbutane', '1,1-Dimetilbutan'),
        ],
      }),
      q({
        id: 'tb-2-2-dimethylbutane',
        promptRu: 'Как называется этот изомер гексана (с. 30)?',
        promptEn: 'What is this hexane isomer called (p. 30)?',
        promptUz: 'Geksanning bu izomeri qanday nomlanadi (30-bet)?',
        formula: 'CH₃–C(CH₃)₂–CH₂–CH₃',
        options: [
          opt('a', '3,3-Диметилбутан', false, '3,3-Dimethylbutane', '3,3-Dimetilbutan'),
          opt('b', '2,2-Диметилбутан', true, '2,2-Dimethylbutane', '2,2-Dimetilbutan'),
          opt('c', '2-Метилпентан', false, '2-Methylpentane', '2-Metilpentan'),
          opt('d', '2,2-Метилбутан', false, '2,2-Methylbutane', '2,2-Metilbutan'),
        ],
      }),
      q({
        id: 'tb-2-3-dimethylbutane',
        promptRu: 'Название по учебнику (с. 30)?',
        promptEn: 'Name as in the textbook (p. 30)?',
        promptUz: 'Darslikdagi nomi (30-bet)?',
        formula: 'CH₃–CH(CH₃)–CH(CH₃)–CH₃',
        options: [
          opt('a', '2,2-Диметилбутан', false, '2,2-Dimethylbutane', '2,2-Dimetilbutan'),
          opt('b', '3-Метилпентан', false, '3-Methylpentane', '3-Metilpentan'),
          opt('c', '2,3-Диметилбутан', true, '2,3-Dimethylbutane', '2,3-Dimetilbutan'),
          opt('d', '1,2-Диметилбутан', false, '1,2-Dimethylbutane', '1,2-Dimetilbutan'),
        ],
      }),
      q({
        id: 'tb-cysteine-senior',
        promptRu: 'Цистеин (с. 31): какая характеристическая группа старшая и даёт окончание названия?',
        promptEn: 'Cysteine (p. 31): which characteristic group is senior and gives the name ending?',
        promptUz: 'Sistein (31-bet): qaysi xarakteristik guruh eng katta va nom oxirini beradi?',
        formula: 'HS–CH₂–CH(NH₂)–COOH',
        options: [
          opt('a', '–COOH (карбоксильная)', true, '–COOH (carboxyl)', '–COOH (karboksil)'),
          opt('b', '–NH₂ (амино)', false, '–NH₂ (amino)', '–NH₂ (amino)'),
          opt('c', '–SH (сульфанил)', false, '–SH (sulfanyl)', '–SH (sulfanil)'),
          opt('d', '–CH₂– (метилен)', false, '–CH₂– (methylene)', '–CH₂– (metilen)'),
        ],
      }),
      q({
        id: 'tb-cysteine-iupac',
        promptRu: 'Систематическое (IUPAC) название цистеина?',
        promptEn: 'Systematic (IUPAC) name of cysteine?',
        promptUz: 'Sisteinning sistematik (IUPAC) nomi?',
        formula: 'HS–CH₂–CH(NH₂)–COOH',
        options: [
          opt('a', '3-Амино-2-сульфанилпропановая кислота', false, '3-Amino-2-sulfanylpropanoic acid', '3-Amino-2-sulfanilpropan kislota'),
          opt('b', '2-Амино-3-сульфанилпропановая кислота', true, '2-Amino-3-sulfanylpropanoic acid', '2-Amino-3-sulfanilpropan kislota'),
          opt('c', '2-Амино-3-сульфанилпропанол', false, '2-Amino-3-sulfanylpropanol', '2-Amino-3-sulfanilpropanol'),
          opt('d', '1-Амино-2-сульфанилэтановая кислота', false, '1-Amino-2-sulfanylethanoic acid', '1-Amino-2-sulfaniletan kislota'),
        ],
      }),
      q({
        id: 'tb-propanoic',
        promptRu: 'Как называется кислота (с. 31)? Углерод –COOH входит в цепь.',
        promptEn: 'Name the acid (p. 31). The –COOH carbon is part of the chain.',
        promptUz: 'Kislotani nomlang (31-bet). –COOH uglerodi zanjirga kiradi.',
        formula: 'CH₃–CH₂–COOH',
        options: [
          opt('a', 'Этановая кислота', false, 'Ethanoic acid', 'Etan kislota'),
          opt('b', 'Пропаналь', false, 'Propanal', 'Propanal'),
          opt('c', 'Пропанол-1', false, 'Propan-1-ol', 'Propanol-1'),
          opt('d', 'Пропановая кислота', true, 'Propanoic acid', 'Propan kislota'),
        ],
      }),
      q({
        id: 'tb-2-methylpropane',
        promptRu: 'Название разветвлённого алкана (с. 32)?',
        promptEn: 'Name of the branched alkane (p. 32)?',
        promptUz: 'Shoxlangan alkan nomi (32-bet)?',
        formula: 'CH₃–CH(CH₃)–CH₃',
        options: [
          opt('a', '2-Метилпропан', true, '2-Methylpropane', '2-Metilpropan'),
          opt('b', '1-Метилпропан', false, '1-Methylpropane', '1-Metilpropan'),
          opt('c', 'Бутан', false, 'Butane', 'Butan'),
          opt('d', '2-Метилбутан', false, '2-Methylbutane', '2-Metilbutan'),
        ],
      }),
      q({
        id: 'tb-2-methylpropene',
        promptRu: 'Название алкена (с. 32)? Нумерация — от конца, ближайшего к двойной связи.',
        promptEn: 'Name the alkene (p. 32). Number from the end nearest the double bond.',
        promptUz: 'Alkenni nomlang (32-bet). Qoʻsh bogʻga yaqin uchidan raqamlang.',
        formula: 'CH₂=C(CH₃)–CH₃',
        options: [
          opt('a', '2-Метилпропен-2', false, '2-Methylprop-2-ene', '2-Metilpropen-2'),
          opt('b', '2-Метилпропен-1 (IUPAC: 2-метилпроп-1-ен)', true, '2-Methylpropene (IUPAC: 2-methylprop-1-ene)', '2-Metilpropen-1 (IUPAC: 2-metilprop-1-en)'),
          opt('c', 'Бутен-1', false, 'But-1-ene', 'Buten-1'),
          opt('d', '2-Метилпропан', false, '2-Methylpropane', '2-Metilpropan'),
        ],
      }),
      q({
        id: 'tb-butan-2-ol',
        promptRu: 'Название спирта (с. 32)?',
        promptEn: 'Name the alcohol (p. 32)?',
        promptUz: 'Spirtni nomlang (32-bet)?',
        formula: 'CH₃–CH(OH)–CH₂–CH₃',
        options: [
          opt('a', 'Бутанол-3', false, 'Butan-3-ol', 'Butanol-3'),
          opt('b', 'Бутанол-1', false, 'Butan-1-ol', 'Butanol-1'),
          opt('c', 'Бутанол-2 (IUPAC: бутан-2-ол)', true, 'Butan-2-ol', 'Butanol-2 (IUPAC: butan-2-ol)'),
          opt('d', 'Бутаналь', false, 'Butanal', 'Butanal'),
        ],
      }),
      q({
        id: 'tb-butadiene',
        promptRu: 'Название диена (с. 32)?',
        promptEn: 'Name the diene (p. 32)?',
        promptUz: 'Diyenni nomlang (32-bet)?',
        formula: 'CH₂=CH–CH=CH₂',
        options: [
          opt('a', 'Бутадиен-1,3 (IUPAC: бута-1,3-диен)', true, 'Buta-1,3-diene', 'Butadien-1,3 (IUPAC: buta-1,3-diyen)'),
          opt('b', 'Бутадиен-2,4', false, 'Buta-2,4-diene', 'Butadien-2,4'),
          opt('c', 'Бутен-1', false, 'But-1-ene', 'Buten-1'),
          opt('d', 'Бутин-1', false, 'But-1-yne', 'Butin-1'),
        ],
      }),
      q({
        id: 'tb-butanone',
        promptRu: 'Название кетона (с. 32)?',
        promptEn: 'Name the ketone (p. 32)?',
        promptUz: 'Ketonni nomlang (32-bet)?',
        formula: 'CH₃–CO–CH₂–CH₃',
        options: [
          opt('a', 'Бутаналь', false, 'Butanal', 'Butanal'),
          opt('b', 'Бутанон-3', false, 'Butan-3-one', 'Butanon-3'),
          opt('c', 'Бутанол-2', false, 'Butan-2-ol', 'Butanol-2'),
          opt('d', 'Бутанон-2 (IUPAC: бутан-2-он)', true, 'Butan-2-one', 'Butanon-2 (IUPAC: butan-2-on)'),
        ],
      }),
      q({
        id: 'tb-bromomethylheptane',
        promptRu: 'Задача (с. 33): главная цепь — самая длинная цепь атомов C. Как назвать вещество?',
        promptEn: 'Task (p. 33): the main chain is the longest carbon chain. Name the compound.',
        promptUz: 'Masala (33-bet): asosiy zanjir — eng uzun C zanjiri. Moddani qanday nomlash kerak?',
        formula: 'CH₃CH₂CH₂–CH(CH₂Br)–CH₂CH₂CH₃',
        options: [
          opt('a', '1-Бром-2-пропилпентан', false, '1-Bromo-2-propylpentane', '1-Brom-2-propilpentan'),
          opt('b', '4-(Бромметил)гептан', true, '4-(Bromomethyl)heptane', '4-(Brommetil)geptan'),
          opt('c', '4-Бромоктан', false, '4-Bromooctane', '4-Bromoktan'),
          opt('d', '4-Бром-4-метилгептан', false, '4-Bromo-4-methylheptane', '4-Brom-4-metilgeptan'),
        ],
      }),
    ],
  },
]

export const NOMENCLATURE_QUIZ_BY_ID: Readonly<Record<string, NomenclatureQuiz>> = Object.fromEntries(
  NOMENCLATURE_QUIZZES.map((z) => [z.id, z]),
)
