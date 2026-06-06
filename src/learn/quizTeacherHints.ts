import type { TopicQuizItem } from './topicQuizTypes'

type HintPack = { ru: readonly string[]; en: readonly string[] }

/** Сократические подсказки — без буквы и текста правильного ответа. */
const QUIZ_TEACHER_HINTS: Record<string, HintPack> = {
  'c1-t01': {
    ru: [
      'Подумай: наука о природе изучает не только то, что мы видим и нюхаем. Что ещё важно — состав, устройство или превращения?',
      'Сравни варианты: какие говорят только о внешних признаках или приборах, а какие — о самих объектах и их изменениях?',
      'Вспомни три слова из определения: вещества, строение, реакции. Какой вариант охватывает всё это, а не одну деталь?',
      'Метод исключения: убери ответы про «только цвет», «только запах» и пустые формулировки. Что остаётся как суть химии?',
    ],
    en: [
      'Think: chemistry is not only what we see or smell. What else matters — composition, structure, or transformations?',
      'Compare options: which mention only senses or lab tools, and which describe objects and their changes?',
      'Recall three ideas: substances, structure, reactions. Which option covers all of them?',
      'Eliminate answers about “only color/smell” or vague statements. What fits the definition of chemistry?',
    ],
  },
  'c1-t02': {
    ru: [
      'Спроси себя: можно ли записать состав этой «чистоты» одной формулой, и будет ли он всегда одинаковым?',
      'Если перемешать компоненты в разных пропорциях — это ещё одно вещество или смесь?',
      'Чистое вещество vs смесь: у кого состав постоянен, а у кого можно менять доли компонентов?',
      'Исключи варианты, где состав «плавает» или формулы нет. Что характерно для одного вещества?',
    ],
    en: [
      'Ask: can you write one formula with fixed composition?',
      'If you mix components in different ratios — is it still one substance or a mixture?',
      'Pure substance vs mixture: which has fixed composition?',
      'Rule out options where composition varies. What defines a pure substance?',
    ],
  },
  'c1-t03': {
    ru: [
      'Возьми каплю раствора из разных мест стакана — состав одинаковый или разный?',
      'Гетерогенная смесь — когда видны разные фазы или частицы. Гомогенная — как?',
      'Воздух, сироп, сплав — что общего в однородности?',
      'Отбрось варианты про «видимые кристаллы» и «всегда мутно» — это про неоднородность.',
    ],
    en: [
      'Take a drop from different parts of the beaker — same composition?',
      'Heterogeneous = visible parts; homogeneous = ?',
      'Air, syrup, alloys — what do they share?',
      'Reject “visible crystals” and “always cloudy” — those suggest heterogeneity.',
    ],
  },
  'c1-t04': {
    ru: [
      'Главный тест: после явления осталось то же вещество (та же формула) или появилось новое?',
      'Плавление, кипение, растворение — меняется ли химический состав частиц?',
      'Если «вернуть условия назад» получится исходное вещество — это какой тип явления?',
      'Варианты с «новым веществом» и «взрывом» — это скорее про другой тип. Что остаётся?',
    ],
    en: [
      'Key test: same substance after the change, or a new one?',
      'Melting, boiling, dissolving — does chemical composition change?',
      'If you can reverse conditions and get the same substance — what type of change?',
      'Options about new substances point elsewhere. What fits physical change?',
    ],
  },
  'c1-t05': {
    ru: [
      'Признаки: газ, осадок, новый цвет, запах — часто говорят о каком типе явления?',
      'Фильтрация и переливание — это разделение или образование новых веществ?',
      'Горение, ржавление — появляются ли новые формулы веществ?',
      'Ищи вариант, где именно рождаются новые вещества, а не меняется только форма.',
    ],
    en: [
      'Gas, precipitate, new color — often signs of which change type?',
      'Filtration and pouring — separation or new substances?',
      'Burning, rusting — do new chemical formulas appear?',
      'Pick the option where new substances are formed.',
    ],
  },
  'c1-t06': {
    ru: [
      'При разбавлении кислоты выделяется много тепла. Куда безопаснее лить жидкость — в воду или воду в кислоту?',
      'Почему нельзя пробовать кислоты на вкус и зачем перчатки?',
      'Вспомни правило из § по ТБ: «кислоту в воду» — какой вариант это отражает?',
      'Исключи опасные советы (вкус, без перчаток, вода в кислоту).',
    ],
    en: [
      'Diluting acid releases heat. Pour acid into water or water into acid?',
      'Why no tasting acids and why gloves?',
      'Recall lab safety: “acid into water” — which option matches?',
      'Reject dangerous options (taste, no gloves, water into acid).',
    ],
  },
  'c1-t07': {
    ru: [
      'Фильтр задерживает то, что не проходит сквозь поры. Что обычно остаётся на фильтре?',
      'Растворённое вещество проходит или застревает?',
      'Это метод для «твёрдое + жидкость», а не для газов или изотопов.',
      'Подумай про песок в воде или нерастворимый осадок.',
    ],
    en: [
      'A filter holds what cannot pass through pores. What stays on the filter?',
      'Does dissolved material pass through?',
      'This method is for solid + liquid, not gases or isotopes.',
      'Think sand in water or insoluble precipitate.',
    ],
  },
  'c1-t08': {
    ru: [
      'Лёд превращается в воду — меняется формула H₂O или только состояние?',
      'Это быстрый или медленный процесс изменения агрегатного состояния?',
      'Ядерные и ОВР-процессы здесь не нужны — слишком сложно для таяния льда.',
      'Если формула та же — физическое или химическое?',
    ],
    en: [
      'Ice becomes water — does H₂O formula change or only state?',
      'Is this a change of state only?',
      'Nuclear or redox is overkill for melting ice.',
      'Same formula — physical or chemical?',
    ],
  },
  'c1-t09': {
    ru: [
      'Спиртовка даёт пламя для чего в лаборатории — нагрева, взвешивания или измерения pH?',
      'Маленький объём + контролируемое пламя — зачем это нужно?',
      'Электролиз и весы — другие приборы. Что делает горелка?',
      'Свяжи прибор с действием «подогреть пробирку».',
    ],
    en: [
      'A alcohol lamp is for heating, weighing, or pH?',
      'Small flame — why in the lab?',
      'Electrolysis and balances use other tools. What does a burner do?',
      'Link the tool to “heat a test tube”.',
    ],
  },
  'c1-t10': {
    ru: [
      'Соль растворима в воде, песок — нет. Какой первый шаг разделения?',
      'После растворения что фильтруют, а что потом выпаривают?',
      'Один магнит не отделит соль от песка — почему?',
      'Цепочка: растворить → отфильтровать → выпарить. Какой вариант про это?',
    ],
    en: [
      'Salt dissolves, sand does not. First separation step?',
      'After dissolving — filter what, evaporate what?',
      'A magnet won’t separate salt and sand — why?',
      'Chain: dissolve → filter → evaporate. Which option?',
    ],
  },
  'c1-t11': {
    ru: [
      'Вода бывает льдом, жидкостью и паром — сколько основных агрегатных состояний в школьном курсе?',
      'Плазма — редко в 7 классе; что учат в первую очередь?',
      'Температура влияет на состояние — значит состояний больше одного.',
      'Твёрдое, жидкое, газообразное — ищи полный набор.',
    ],
    en: [
      'Water: ice, liquid, steam — how many main states in grade 7?',
      'Plasma is advanced; what triplet is taught first?',
      'Temperature changes state — so more than one state exists.',
      'Solid, liquid, gas — find the full set.',
    ],
  },
  'c1-t12': {
    ru: [
      'Где в быту появляется новое вещество с другой формулой — при горении или при испарении воды?',
      'Растворение сахара и таяние масла — меняется ли состав молекул?',
      'Газ на плите реагирует с кислородом — это про что?',
      'Ищи пример с химической реакцией, а не только сменой состояния.',
    ],
    en: [
      'At home: where do new substances form — burning or evaporating water?',
      'Dissolving sugar or melting fat — do molecules change?',
      'Gas on a stove reacts with oxygen — what type of change?',
      'Find a chemical reaction example, not just state change.',
    ],
  },
}

function genericHints(question: TopicQuizItem, locale: 'ru' | 'en'): readonly string[] {
  const stem = question.question.replace(/…$/, '').trim()
  if (locale === 'en') {
    return [
      `Read the question again: "${stem}". What definition from the lesson fits best?`,
      'Cross out options that are too narrow (“only…”) or obviously unrelated to the topic.',
      'For each remaining option, ask: “Does the textbook support this?” Write your reasoning.',
      'Compare two most likely answers. What single fact from the § rules one of them out?',
    ]
  }
  return [
    `Перечитай вопрос: «${stem}». Какое определение из § подходит лучше всего?`,
    'Вычеркни варианты, которые слишком узкие («только…») или явно не по теме.',
    'Для каждого оставшегося спроси: «Так пишет учебник?» — аргументируй про себя.',
    'Сравни два самых правдоподобных ответа. Какой один факт из § отсекает один из них?',
  ]
}

function numericHints(_question: TopicQuizItem, locale: 'ru' | 'en'): readonly string[] {
  if (locale === 'en') {
    return [
      'Write the formula n = m / M. What is M for water?',
      'Divide mass (g) by molar mass (g/mol). Units must give moles.',
      'Check: is your answer roughly mass/18? Too big or too small?',
      'Round sensibly — moles are often between 0.1 and 10 in school problems.',
    ]
  }
  return [
    'Запиши формулу n = m / M. Чему равна M для воды?',
    'Раздели массу (г) на молярную массу (г/моль). В ответе должны получиться моли.',
    'Проверка: ответ близок к массе/18? Не слишком ли велик или мал?',
    'Округли разумно — в школьных задачах n часто от 0,1 до 10 моль.',
  ]
}

function leakGuard(text: string, question: TopicQuizItem): string {
  const correct = question.choices[question.correctIndex]
  if (!correct || correct.length < 4) return text
  if (text.toLowerCase().includes(correct.toLowerCase().slice(0, Math.min(12, correct.length)))) {
    return ''
  }
  const letter = String.fromCharCode(65 + question.correctIndex)
  if (new RegExp(`\\b${letter}\\b`, 'i').test(text)) return ''
  return text
}

export type QuizTeacherHintResult = {
  text: string
  level: number
  hasMore: boolean
}

export function getQuizTeacherHint(
  question: TopicQuizItem,
  level: number,
  locale: 'ru' | 'en',
): QuizTeacherHintResult | null {
  const key = question.templateKey ?? ''
  let pack = QUIZ_TEACHER_HINTS[key]
  let hints: readonly string[]

  if (pack) {
    hints = locale === 'en' ? pack.en : pack.ru
  } else if (key.startsWith('num-') || question.question.includes('моль') || question.question.includes('mole')) {
    hints = numericHints(question, locale)
  } else {
    hints = genericHints(question, locale)
  }

  const idx = Math.min(Math.max(0, level), hints.length - 1)
  let text = leakGuard(hints[idx] ?? '', question)
  if (!text) {
    text =
      locale === 'en'
        ? 'Reason step by step: which options contradict the textbook definition? Do not guess — eliminate.'
        : 'Рассуждай по шагам: какие варианты противоречат определению в учебнике? Не угадывай — исключай.'
  }

  return {
    text,
    level: idx,
    hasMore: idx < hints.length - 1,
  }
}

export function maxQuizTeacherHintLevels(question: TopicQuizItem): number {
  const key = question.templateKey ?? ''
  const pack = QUIZ_TEACHER_HINTS[key]
  if (pack) return pack.ru.length
  if (key.startsWith('num-')) return 4
  return 4
}
