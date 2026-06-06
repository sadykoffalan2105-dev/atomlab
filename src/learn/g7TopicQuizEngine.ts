import { learnSectionPathKey } from '../data/learnFgosMatrix'
import { G7_C1_S01_QUIZ_ENRICHMENTS } from './g7C1S01QuizEnrichments'
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
  while (picks.length < 3) picks.push('Зависит от условий опыта')
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

/** Базовые шаблоны по главам учебника (Kimyo 7). */
const CHAPTER_TEMPLATES: Record<number, Template[]> = {
  1: [
    mk('c1-t01', 'Химия изучает…', 'Вещества, их состав, строение и превращения', [
      'Только цвет и запах',
      'Только историю открытий',
      'Только названия лабораторных приборов',
    ]),
    mk('c1-t02', 'Чистое вещество…', 'Имеет постоянный состав и свойства', [
      'Всегда является смесью',
      'Меняет состав при перемешивании',
      'Не имеет химической формулы',
    ]),
    mk('c1-t03', 'Гомогенная смесь…', 'Одинакова по составу в любой точке', [
      'Состоит из видимых кристаллов разных размеров',
      'Всегда мутная',
      'Не может быть жидкой',
    ]),
    mk('c1-t04', 'Физическое явление…', 'Изменяются лишь физические свойства', [
      'Обязательно образуется новое вещество',
      'Всегда сопровождается взрывом',
      'Невозможно в быту',
    ]),
    mk('c1-t05', 'Химическое явление…', 'Образуются новые вещества', [
      'Только изменение агрегатного состояния',
      'Только переливание жидкости',
      'Только фильтрование',
    ]),
    mk('c1-t06', 'Правило ТБ: при работе с кислотами…', 'Наливают кислоту в воду, а не наоборот', [
      'Можно разбавлять воду кислотой',
      'Кислоту можно пробовать на вкус',
      'Перчатки не нужны',
    ]),
    mk('c1-t07', 'Фильтрование отделяет…', 'Нерастворимый осадок от жидкости', [
      'Газы от воздуха',
      'Металлы от неметаллов по массе',
      'Изотопы друг от друга',
    ]),
    mk('c1-t08', 'Плавление льда — это…', 'Физическое явление', [
      'Химическое явление',
      'Только ядерная реакция',
      'Окислительно-восстановительный процесс',
    ]),
    mk('c1-t09', 'Спиртовая лампа используется для…', 'Нагревания небольших объёмов', [
      'Взвешивания твёрдых тел',
      'Измерения pH',
      'Электролиза воды',
    ]),
    mk('c1-t10', 'Смесь песка и соли можно разделить…', 'Растворением, фильтрованием и выпариванием', [
      'Только магнитом',
      'Только центрифугой без растворителя',
      'Невозможно',
    ]),
    mk('c1-t11', 'Агрегатные состояния вещества…', 'Твёрдое, жидкое, газообразное', [
      'Только твёрдое и жидкое',
      'Только плазма и газ',
      'Не зависят от температуры',
    ]),
    mk('c1-t12', 'Пример химического явления в быту…', 'Горение газа на плите', [
      'Таяние масла на сковороде',
      'Растворение сахара в чае',
      'Испарение воды с белья',
    ]),
  ],
  2: [
    mk('c2-t01', 'Атом состоит из…', 'Ядра и электронной оболочки', ['Только из протонов', 'Только из нейтронов', 'Только из молекул']),
    mk('c2-t02', 'Протоны находятся…', 'В ядре', ['На внешней орбите', 'Между молекулами', 'В растворе']),
    mk('c2-t03', 'Химический элемент определяется…', 'Числом протонов в ядре', ['Числом нейтронов только', 'Цветом порошка', 'Массой образца']),
    mk('c2-t04', 'Изотопы одного элемента отличаются…', 'Числом нейтронов', ['Числом протонов', 'Зарядом иона', 'Валентностью в соединении']),
    mk('c2-t05', 'Mr(H₂O) ≈', '18', ['2', '32', '44']),
    mk('c2-t06', 'Валентность — это…', 'Способность атома образовывать связи', ['Масса молекулы', 'Объём газа', 'Цвет раствора']),
    mk('c2-t07', 'Простое вещество…', 'Состоит из атомов одного элемента', ['Всегда ионное', 'Всегда смесь', 'Обязательно жидкое']),
    mk('c2-t08', '1 моль вещества содержит…', '6,02·10²³ частиц', ['1 г', '1 л', '22,4 мг']),
    mk('c2-t09', 'Молярная масса измеряется в…', 'г/моль', ['моль/л', 'Па', 'К']),
    mk('c2-t10', 'В уравнении 2H₂ + O₂ → 2H₂O коэффициент перед O₂…', '1', ['2', '4', '0']),
    mk('c2-t11', 'Относительная атомная масса…', 'Сравнительная величина без единиц', ['Всегда в граммах', 'Только для газов', 'Равна заряду ядра']),
    mk('c2-t12', 'Молекула — это…', 'Наименьшая частица вещества, сохраняющая его свойства', ['Всегда ион', 'Только атом металла', 'Ядро без электронов']),
  ],
  3: [
    mk('c3-t01', 'Период в таблице Менделеева…', 'Горизонтальный ряд элементов', ['Группа по valence', 'Список оксидов', 'Только благородные газы']),
    mk('c3-t02', 'Группа в ПС…', 'Вертикальный столбец элементов', ['Период', 'Изотоп', 'Смесь']),
    mk('c3-t03', 'Металлы в ПС…', 'Преимущественно слева и в центре', ['Только справа вверху', 'Только в VIII группе', 'Отсутствуют']),
    mk('c3-t04', 'Электроотрицательность обычно…', 'Растёт слева направо в периоде', ['Падает слева направо', 'Не меняется', 'Одинакова у всех']),
    mk('c3-t05', 'Благородные газы…', 'Малоактивны', ['Самые сильные окислители', 'Всегда жидкие', 'Только радиоактивны']),
    mk('c3-t06', 'Галогены — это…', 'VII группа', ['I группа', 'II группа', 'VIII группа']),
    mk('c3-t07', 'Периодический закон связывает…', 'Свойства элементов с зарядом ядра', ['Только цвета', 'Только плотности жидкостей', 'Только историю']),
    mk('c3-t08', 'Атомный номер — это…', 'Число протонов', ['Число нейтронов', 'Массовое число', 'Валентность']),
  ],
  4: [
    mk('c4-t01', 'Воздух — это…', 'Смесь газов', ['Чистое вещество', 'Только кислород', 'Только азот в любом случае']),
    mk('c4-t02', 'Основной компонент сухого воздуха…', 'Азот (~78%)', ['Кислород (~78%)', 'CO₂ (~50%)', 'Водород']),
    mk('c4-t03', 'Кислород поддерживает…', 'Горение', ['Только тление без окисления', 'Только физическое смешивание', 'Только растворение']),
    mk('c4-t04', 'Озон (O₃)…', 'Аллотропная модификация кислорода', ['Смесь азота и кислорода', 'Оксид металла', 'Кислота']),
    mk('c4-t05', 'Оксид — соединение…', 'Элемента с кислородом', ['Двух металлов', 'Кислоты и соли', 'Только водорода']),
    mk('c4-t06', 'Горение — это…', 'Реакция с кислородом с выделением тепла и света', ['Только плавление', 'Только растворение', 'Только фильтрование']),
    mk('c4-t07', 'SO₂ — пример…', 'Оксида неметалла', ['Кислоты', 'Щёлочи', 'Соли']),
    mk('c4-t08', 'Загрязнение воздуха усиливается…', 'Сжиганием топлива и выбросами', ['Только дождём', 'Только ветром', 'Только фотосинтезом']),
  ],
  5: [
    mk('c5-t01', 'Водород (H₂)…', 'Самый лёгкий газ', ['Тяжёлый благородный газ', 'Жидкий металл', 'Кислотный оксид']),
    mk('c5-t02', 'Водород получают…', 'Действием кислот на активные металлы', ['Только электролизом каменной соли без воды', 'Только сгоранием угля', 'Невозможно в лаборатории']),
    mk('c5-t03', 'Кислоты в водном растворе…', 'Диссоциируют с выделением H⁺', ['Дают только OH⁻', 'Не проводят ток', 'Всегда твёрдые']),
    mk('c5-t04', 'HCl — это…', 'Сильная кислота', ['Основание', 'Соль', 'Оксид']),
    mk('c5-t05', 'Кислотные дожди связаны с…', 'SO₂ и NOₓ в атмосфере', ['Только с O₂', 'Только с N₂ без примесей', 'Только с водой']),
    mk('c5-t06', 'Индикатор в кислой среде…', 'Может изменить цвет', ['Всегда синий', 'Не реагирует', 'Растворяет стекло']),
  ],
  6: [
    mk('c6-t01', 'Вода (H₂O) — это…', 'Оксид водорода', ['Соль', 'Металл', 'Смесь газов']),
    mk('c6-t02', 'Круговорот воды включает…', 'Испарение, конденсацию, осадки', ['Только горение', 'Только электролиз', 'Только фильтрование']),
    mk('c6-t03', 'Нейтрализация — реакция…', 'Кислоты и основания', ['Двух металлов', 'Двух газов', 'Соли с солью']),
    mk('c6-t04', 'Ca(OH)₂ — это…', 'Основание', ['Кислота', 'Оксид без водорода', 'Благородный газ']),
    mk('c6-t05', 'Загрязнение воды…', 'Ухудшает качество питьевой воды', ['Не влияет на экосистемы', 'Увеличивает pH всегда', 'Удаляет соли']),
    mk('c6-t06', 'Электролиз воды даёт…', 'H₂ и O₂', ['Только Na', 'Только Cl₂', 'CO₂']),
  ],
  7: [
    mk('c7-t01', 'Белки состоят из…', 'Аминокислот', ['Только углеводов', 'Только жиров', 'Только солей']),
    mk('c7-t02', 'Углеводы — источник…', 'Энергии для организма', ['Только кислорода', 'Только металлов', 'Только кислот']),
    mk('c7-t03', 'Витамины…', 'Нужны в малых количествах для обмена веществ', ['Заменяют воду', 'Являются металлами', 'Не растворяются']),
    mk('c7-t04', 'Ca в организме важен для…', 'Костей и зубов', ['Только для окраски крови', 'Только для дыхания', 'Только для жиров']),
    mk('c7-t05', 'Жиры — это…', 'Эsters жирных кислот и глицерина', ['Только белки', 'Только минералы', 'Только газы']),
  ],
  8: [
    mk('c8-t01', 'Полезные ископаемые…', 'Природные скопления минералов', ['Только газы в воздухе', 'Только смеси в лаборатории', 'Только растворы кислот']),
    mk('c8-t02', 'CaCO₃ (известняк)…', 'Используется в строительстве', ['Является благородным газом', 'Не реагирует с кислотами', 'Только жидкость']),
    mk('c8-t03', 'Экологический след добычи…', 'Связан с нарушением ландшафта и выбросами', ['Не влияет на природу', 'Улучшает почву всегда', 'Уменьшает CO₂ автоматически']),
    mk('c8-t04', 'Уголь и нефть — это…', 'Природные органические ископаемые', ['Чистые металлы', 'Смеси благородных газов', 'Только вода']),
  ],
}

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

function expandC1S01Pool(seed: number): TopicQuizItem[] {
  const rand = mulberry32(seed)
  const base = CHAPTER_TEMPLATES[1]!
  return base.map((template, i) => {
    const enrichment = G7_C1_S01_QUIZ_ENRICHMENTS[template.templateKey]!
    const correct = template.choices[template.correctIndex]!
    const distractorPool = [
      ...template.choices.filter((_, idx) => idx !== template.correctIndex),
      'Нужно повторить §',
      'Зависит от условия',
      'Неверное утверждение',
    ]
    const { choices, correctIndex } = withChoices(correct, distractorPool, rand)
    return {
      id: `g7-c1-s01-q${i + 1}`,
      question: template.question,
      choices,
      correctIndex,
      explanation: enrichment?.explanation ?? template.explanation,
      description: enrichment?.description,
      visualId: enrichment?.visualId,
    }
  })
}

function expandToPool(ch: number, sec: number, seed: number): TopicQuizItem[] {
  const rand = mulberry32(seed)
  const base = CHAPTER_TEMPLATES[ch] ?? CHAPTER_TEMPLATES[1]!
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

    const id = `g7-c${ch}-s${String(sec).padStart(2, '0')}-q${i + 1}`

    out.push({
      id,
      question: template.question,
      choices,
      correctIndex,
      explanation: template.explanation,
    })
  }

  while (out.length < 45) {
    const i = out.length
    const template = numericPool(ch, sec, i + 100)
    const correct = template.choices[0]!
    const { choices, correctIndex } = withChoices(correct, [...template.choices, '0 моль', '1 моль'], rand)
    out.push({
      id: `g7-c${ch}-s${String(sec).padStart(2, '0')}-extra${i}`,
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
    const seed = ch * 1000 + sec * 17 + 42
    if (gradeId === 'g7' && chapterId === 'c1' && sectionId === 's01') {
      pool = expandC1S01Pool(seed)
    } else {
      pool = expandToPool(ch, sec, seed)
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
