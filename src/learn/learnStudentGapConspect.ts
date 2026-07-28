import { compoundById } from '../data/compounds'
import { getLearnFgosMeta } from '../data/learnFgosMatrix'
import { learnChapterById, learnSectionById } from '../data/learnCurriculumUz'
import { messagesForLocale } from '../i18n/messagesForLocale'
import type { AppLocale } from '../i18n/types'
import type { LearnGradeId, LearnSection } from '../types/learn'
import {
  getChapterLogicalMcqPool,
  getMcqExamPool,
  getOralExamPool,
  getWrittenExamPool,
} from './g7ExamPools'
import type { ClassStudent } from './learnClassRosterStorage'
import { recordGapConspectIssued } from './learnClassRosterStorage'
import { downloadTextFile } from './learnLessonExport'
import {
  collectWeakTopics,
  computeStudentMastery,
  computeStudentRating,
  type StudentMasteryStats,
} from './learnStudentStats'
import {
  getQuizTeacherHint,
  maxQuizTeacherHintLevels,
} from './quizTeacherHints'
import {
  localizeOralExam,
  localizeTopicQuiz,
  localizeWrittenExam,
} from './topicQuizLocale'
import type { OralExamItem, TopicQuizItem, WrittenExamItem } from './topicQuizTypes'

export type ResolvedGapItem = {
  id: string
  kind: 'mcq' | 'written' | 'oral' | 'molecule' | 'unknown'
  title: string
  correctAnswer?: string
  explanation?: string
  description?: string
  rubric?: readonly string[]
  /** Все варианты MCQ (локализованные) */
  choices?: readonly string[]
  correctIndex?: number
  /** Исходный MCQ для подсказок учителя */
  mcq?: TopicQuizItem
  /** Каталожный id вещества */
  compoundId?: string
}

export type GapConspectInput = {
  student: ClassStudent
  sectionTitle: string
  locale: AppLocale
  gradeId?: string
  chapterId?: string
  sectionId?: string
  className?: string
}

type Copy = {
  title: string
  passport: string
  student: string
  class: string
  topic: string
  chapter: string
  date: string
  avg: string
  rating: string
  mastery: string
  trend: string
  attemptsTotal: string
  byKind: string
  diagnosis: string
  diagnosisStrong: string
  diagnosisGood: string
  diagnosisNeeds: string
  diagnosisNone: string
  goals: string
  program: string
  hours: string
  skills: string
  focus: string
  gaps: string
  gapCard: string
  kind: string
  question: string
  choices: string
  correct: string
  whyWrong: string
  explain: string
  about: string
  howThink: string
  rubric: string
  sample: string
  selfCheck: string
  selfCheck1: string
  selfCheck2: string
  selfCheck3: string
  compoundBlock: string
  formula: string
  compoundDesc: string
  source: string
  usage: string
  importance: string
  obtain: string
  theory: string
  callout: string
  checkpoints: string
  checkpointQ: string
  practiceQuiz: string
  practiceLead: string
  answerKey: string
  oralPractice: string
  writtenPractice: string
  plan: string
  day1: string
  day1b: string
  day2: string
  day2b: string
  day3: string
  day3b: string
  checklist: string
  check1: string
  check2: string
  check3: string
  check4: string
  check5: string
  check6: string
  teacherNote: string
  teacherNoteBody: string
  footer: string
  noGaps: string
  kindMcq: string
  kindWritten: string
  kindOral: string
  kindMolecule: string
  kindUnknown: string
  trendRising: string
  trendFalling: string
  trendStable: string
  trendNone: string
  weakKinds: string
  goalRaise: string
}

const COPY: Record<AppLocale, Copy> = {
  ru: {
    title: 'Персональный учебный конспект: закрепление пробелов',
    passport: 'Паспорт ученика и диагностика',
    student: 'Ученик',
    class: 'Класс',
    topic: 'Тема',
    chapter: 'Глава',
    date: 'Дата',
    avg: 'Средний балл',
    rating: 'Рейтинг',
    mastery: 'Усвоение',
    trend: 'Динамика',
    attemptsTotal: 'Всего попыток',
    byKind: 'Результаты по видам работы',
    diagnosis: 'Диагноз',
    diagnosisStrong: 'Тема усвоена уверенно. Конспект — для идеального повторения перед контрольной.',
    diagnosisGood: 'База есть, но остаются неточности. Ниже — точечный разбор слабых мест.',
    diagnosisNeeds: 'Есть существенные пробелы. Пройдите конспект полностью: теория → разбор → мини-тест → план на 3 дня.',
    diagnosisNone: 'Тестов пока мало. Используйте конспект как полный шпаргалочный разбор § и потренируйтесь.',
    goals: 'Цели работы с конспектом',
    program: 'Блок программы',
    hours: 'Рекомендуемые часы на тему',
    skills: 'Умения, которые нужно закрепить',
    focus: 'Фокус именно для этого ученика',
    gaps: 'Карточки пробелов (разбор ошибок)',
    gapCard: 'Пробел',
    kind: 'Тип',
    question: 'Вопрос',
    choices: 'Варианты ответа',
    correct: 'Правильный ответ',
    whyWrong: 'Почему другие варианты слабее',
    explain: 'Объяснение',
    about: 'Суть темы',
    howThink: 'Как рассуждать (шаги учителя)',
    rubric: 'Критерии полного ответа',
    sample: 'Образец / эталон',
    selfCheck: 'Самопроверка по этому пробелу',
    selfCheck1: 'Закройте правильный ответ и сформулируйте его своими словами.',
    selfCheck2: 'Назовите один неверный вариант и объясните, в чём его ошибка.',
    selfCheck3: 'Приведите свой пример или аналогию к этой теме (1–2 предложения).',
    compoundBlock: 'Карточка вещества',
    formula: 'Формула',
    compoundDesc: 'Описание',
    source: 'Происхождение / получение',
    usage: 'Применение',
    importance: 'Почему важно',
    obtain: 'Этапы получения',
    theory: 'Теория урока (полный опорный конспект)',
    callout: 'Важно',
    checkpoints: 'Контрольные вопросы урока',
    checkpointQ: 'Вопрос',
    practiceQuiz: 'Тренировочный мини-тест',
    practiceLead:
      'Решите без подглядывания. Ответы — в следующем разделе. Цель: не угадать, а объяснить каждый выбор.',
    answerKey: 'Ключ к мини-тесту',
    oralPractice: 'Устная тренировка (ответьте вслух)',
    writtenPractice: 'Письменная тренировка',
    plan: 'План закрепления на 3 дня',
    day1: 'День 1 — понимание',
    day1b: 'Прочитайте паспорт, цели и все карточки пробелов. Отметьте маркером то, что всё ещё непонятно.',
    day2: 'День 2 — теория и речь',
    day2b: 'Выучите опорную теорию §. Перескажите учителю / однокласснику каждый пробел. Сделайте устную и письменную тренировку.',
    day3: 'День 3 — контроль и рейтинг',
    day3b: 'Пройдите мини-тест, сверьте ключ, затем сдайте тест в ATOMLAB ещё раз. Цель — закрыть ошибки и поднять рейтинг.',
    checklist: 'Чек-лист самопроверки перед повторным тестом',
    check1: 'Могу объяснить каждый свой пробел без подсказки.',
    check2: 'Знаю правильный ответ и почему остальные варианты хуже.',
    check3: 'Могу пересказать теорию § своими словами (не менее 5 предложений).',
    check4: 'Решил мини-тест и разобрал ошибки по ключу.',
    check5: 'Выполнил устную или письменную тренировку.',
    check6: 'Готов пройти тест в ATOMLAB и улучшить результат.',
    teacherNote: 'Заметка для учителя',
    teacherNoteBody:
      'Конспект собран автоматически по ошибкам ученика и содержанию текущего §. После повторного теста сравните динамику: если слабые ID повторяются — вернитесь к карточкам пробелов и устной тренировке.',
    footer: 'Сгенерировано ATOMLAB · персональный проработанный конспект по пробелам',
    noGaps:
      'Явных ошибок по ID вопросов пока нет. Ниже — полный опорный конспект §, тренировки и план повторения, чтобы закрепить тему заранее.',
    kindMcq: 'Тест (выбор ответа)',
    kindWritten: 'Письменный вопрос',
    kindOral: 'Устный вопрос',
    kindMolecule: 'Молекула / вещество',
    kindUnknown: 'Тема / вопрос',
    trendRising: 'рост',
    trendFalling: 'спад',
    trendStable: 'стабильно',
    trendNone: 'нет данных',
    weakKinds: 'Слабые форматы',
    goalRaise: 'Поднять рейтинг за счёт закрытия перечисленных пробелов и повторного теста.',
  },
  en: {
    title: 'Personal study conspect: reinforcing gaps',
    passport: 'Student passport & diagnosis',
    student: 'Student',
    class: 'Class',
    topic: 'Topic',
    chapter: 'Chapter',
    date: 'Date',
    avg: 'Average score',
    rating: 'Rating',
    mastery: 'Mastery',
    trend: 'Trend',
    attemptsTotal: 'Total attempts',
    byKind: 'Results by activity type',
    diagnosis: 'Diagnosis',
    diagnosisStrong: 'Topic is solid. Use this sheet for a perfect review before a graded check.',
    diagnosisGood: 'Basics are in place, but some inaccuracies remain. Below is a focused gap analysis.',
    diagnosisNeeds: 'Significant gaps. Work through the full sheet: theory → gap cards → mini-test → 3-day plan.',
    diagnosisNone: 'Few tests so far. Treat this as a full section study guide and practice.',
    goals: 'Goals for this conspect',
    program: 'Curriculum block',
    hours: 'Recommended hours',
    skills: 'Skills to reinforce',
    focus: 'Focus for this student',
    gaps: 'Gap cards (error analysis)',
    gapCard: 'Gap',
    kind: 'Type',
    question: 'Question',
    choices: 'Answer choices',
    correct: 'Correct answer',
    whyWrong: 'Why other options are weaker',
    explain: 'Explanation',
    about: 'Topic focus',
    howThink: 'How to reason (teacher steps)',
    rubric: 'Full-answer criteria',
    sample: 'Model answer',
    selfCheck: 'Self-check for this gap',
    selfCheck1: 'Hide the correct answer and restate it in your own words.',
    selfCheck2: 'Name one wrong option and explain the mistake.',
    selfCheck3: 'Give your own example or analogy for this idea (1–2 sentences).',
    compoundBlock: 'Substance card',
    formula: 'Formula',
    compoundDesc: 'Description',
    source: 'Origin / production',
    usage: 'Uses',
    importance: 'Why it matters',
    obtain: 'Production steps',
    theory: 'Lesson theory (full support notes)',
    callout: 'Key point',
    checkpoints: 'Lesson checkpoint questions',
    checkpointQ: 'Question',
    practiceQuiz: 'Practice mini-test',
    practiceLead: 'Solve without peeking. Answers are in the next section. Explain each choice.',
    answerKey: 'Mini-test answer key',
    oralPractice: 'Oral practice (answer aloud)',
    writtenPractice: 'Written practice',
    plan: '3-day reinforcement plan',
    day1: 'Day 1 — understanding',
    day1b: 'Read the passport, goals, and all gap cards. Highlight anything still unclear.',
    day2: 'Day 2 — theory & speaking',
    day2b: 'Study the section theory. Retell each gap. Do oral and written practice.',
    day3: 'Day 3 — check & rating',
    day3b: 'Take the mini-test, check the key, then retake the ATOMLAB test. Goal: close gaps and raise rating.',
    checklist: 'Self-check before retaking the test',
    check1: 'I can explain every gap without hints.',
    check2: 'I know the correct answer and why other options are weaker.',
    check3: 'I can retell the section theory in my own words (≥ 5 sentences).',
    check4: 'I finished the mini-test and reviewed mistakes with the key.',
    check5: 'I completed oral or written practice.',
    check6: 'I am ready to retake the ATOMLAB test and improve.',
    teacherNote: 'Note for the teacher',
    teacherNoteBody:
      'This sheet is built from the student’s wrong answers and the current section content. After a retest, compare trends; if the same IDs reappear, return to gap cards and oral practice.',
    footer: 'Generated by ATOMLAB · in-depth personal gap conspect',
    noGaps:
      'No question-level errors yet. Below is a full section support conspect, drills, and a review plan.',
    kindMcq: 'Multiple choice',
    kindWritten: 'Written question',
    kindOral: 'Oral question',
    kindMolecule: 'Molecule / substance',
    kindUnknown: 'Topic / question',
    trendRising: 'rising',
    trendFalling: 'falling',
    trendStable: 'stable',
    trendNone: 'no data',
    weakKinds: 'Weaker formats',
    goalRaise: 'Raise rating by closing the listed gaps and retaking the test.',
  },
  uz: {
    title: 'Shaxsiy o‘quv konspekti: bo‘shliqlarni mustahkamlash',
    passport: 'O‘quvchi pasporti va tashxis',
    student: 'O‘quvchi',
    class: 'Sinf',
    topic: 'Mavzu',
    chapter: 'Bob',
    date: 'Sana',
    avg: 'O‘rtacha ball',
    rating: 'Reyting',
    mastery: 'O‘zlashtirish',
    trend: 'Dinamika',
    attemptsTotal: 'Jami urinishlar',
    byKind: 'Ish turlari bo‘yicha natijalar',
    diagnosis: 'Tashxis',
    diagnosisStrong: 'Mavzu mustahkam. Konspekt — nazorat oldidan mukammal takrorlash uchun.',
    diagnosisGood: 'Asos bor, lekin noaniqliklar qolgan. Quyida zaif joylar tahlili.',
    diagnosisNeeds: 'Jiddiy bo‘shliqlar bor. To‘liq o‘ting: nazariya → kartochkalar → mini-test → 3 kunlik reja.',
    diagnosisNone: 'Hali testlar kam. Bu faylni to‘liq § qo‘llanmasi sifatida ishlating.',
    goals: 'Konspekt bilan ishlash maqsadlari',
    program: 'Dastur bloki',
    hours: 'Tavsiya etilgan soatlar',
    skills: 'Mustahkamlash kerak bo‘lgan ko‘nikmalar',
    focus: 'Aynan shu o‘quvchi uchun fokus',
    gaps: 'Bo‘shliq kartochkalari (xatolar tahlili)',
    gapCard: 'Bo‘shliq',
    kind: 'Turi',
    question: 'Savol',
    choices: 'Javob variantlari',
    correct: 'To‘g‘ri javob',
    whyWrong: 'Nima uchun boshqa variantlar zaifroq',
    explain: 'Izoh',
    about: 'Mavzu mohiyati',
    howThink: 'Qanday mulohaza qilish (o‘qituvchi qadamlari)',
    rubric: 'To‘liq javob mezonlari',
    sample: 'Namuna javob',
    selfCheck: 'Shu bo‘shliq bo‘yicha o‘z-o‘zini tekshirish',
    selfCheck1: 'To‘g‘ri javobni yoping va o‘z so‘zlaringiz bilan ayting.',
    selfCheck2: 'Bitta noto‘g‘ri variantni ko‘rsatib, xatosini tushuntiring.',
    selfCheck3: 'Shu g‘oyaga o‘z misolingiz yoki o‘xshatishingizni yozing (1–2 gap).',
    compoundBlock: 'Modda kartochkasi',
    formula: 'Formula',
    compoundDesc: 'Tavsif',
    source: 'Kelib chiqishi / olinishi',
    usage: 'Qo‘llanilishi',
    importance: 'Nima uchun muhim',
    obtain: 'Olish bosqichlari',
    theory: 'Dars nazariyasi (to‘liq tayanch konspekt)',
    callout: 'Muhim',
    checkpoints: 'Dars nazorat savollari',
    checkpointQ: 'Savol',
    practiceQuiz: 'Mashg‘ulot mini-testi',
    practiceLead: 'Qarab boqmasdan yeching. Javoblar keyingi bo‘limda. Har bir tanlovni izohlang.',
    answerKey: 'Mini-test kaliti',
    oralPractice: 'Og‘zaki mashq (ovoz chiqarib javob bering)',
    writtenPractice: 'Yozma mashq',
    plan: '3 kunlik mustahkamlash rejasi',
    day1: '1-kun — tushunish',
    day1b: 'Pasport, maqsadlar va barcha bo‘shliq kartochkalarini o‘qing. Tushunarsiz joylarni belgilang.',
    day2: '2-kun — nazariya va nutq',
    day2b: '§ nazariyasini o‘rganing. Har bir bo‘shliqni aytib bering. Og‘zaki va yozma mashq qiling.',
    day3: '3-kun — nazorat va reyting',
    day3b: 'Mini-testni yeching, kalit bilan solishtiring, so‘ng ATOMLAB testini qayta topshiring.',
    checklist: 'Qayta testdan oldin o‘z-o‘zini tekshirish',
    check1: 'Har bir bo‘shliqni yordamsiz tushuntira olaman.',
    check2: 'To‘g‘ri javobni va boshqa variantlar zaifligini bilaman.',
    check3: '§ nazariyasini o‘z so‘zlarim bilan aytib bera olaman (≥ 5 gap).',
    check4: 'Mini-testni yechdim va kalit bo‘yicha xatolarni ko‘rib chiqdim.',
    check5: 'Og‘zaki yoki yozma mashqni bajardim.',
    check6: 'ATOMLAB testini qayta topshirishga va natijani oshirishga tayyorman.',
    teacherNote: 'O‘qituvchi uchun izoh',
    teacherNoteBody:
      'Konspekt o‘quvchi xatolari va joriy § mazmuni asosida avtomatik yig‘ilgan. Qayta testdan so‘ng dinamikani solishtiring; bir xil ID takrorlansa — kartochkalar va og‘zaki mashqqa qayting.',
    footer: 'ATOMLAB tomonidan yaratilgan · chuqur ishlangan shaxsiy konspekt',
    noGaps:
      'Hali savol ID bo‘yicha xato yo‘q. Quyida to‘liq § tayanch konspekti, mashqlar va takrorlash rejasi bor.',
    kindMcq: 'Test (tanlov)',
    kindWritten: 'Yozma savol',
    kindOral: 'Og‘zaki savol',
    kindMolecule: 'Molekula / modda',
    kindUnknown: 'Mavzu / savol',
    trendRising: 'oʻsish',
    trendFalling: 'pasayish',
    trendStable: 'barqaror',
    trendNone: 'maʼlumot yoʻq',
    weakKinds: 'Zaif formatlar',
    goalRaise: 'Ko‘rsatilgan bo‘shliqlarni yopib, testni qayta topshirib reytingni oshirish.',
  },
}

function msgTable(locale: AppLocale) {
  return messagesForLocale(locale)
}

function msg(table: Record<string, string>, key: string): string {
  const v = table[key]
  return typeof v === 'string' && v.trim() ? v : key
}

function sanitizeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 48) || 'uchenik'
  )
}

function kindLabel(c: Copy, kind: ResolvedGapItem['kind']): string {
  if (kind === 'mcq') return c.kindMcq
  if (kind === 'written') return c.kindWritten
  if (kind === 'oral') return c.kindOral
  if (kind === 'molecule') return c.kindMolecule
  return c.kindUnknown
}

function indexMcq(pool: TopicQuizItem[], locale: AppLocale, map: Map<string, ResolvedGapItem>) {
  for (const raw of pool) {
    const q = localizeTopicQuiz(raw, locale)
    if (map.has(q.id)) continue
    map.set(q.id, {
      id: q.id,
      kind: 'mcq',
      title: q.question,
      choices: q.choices,
      correctIndex: q.correctIndex,
      correctAnswer: q.choices[q.correctIndex],
      explanation: q.explanation,
      description: q.description,
      mcq: q,
    })
  }
}

function indexWritten(pool: WrittenExamItem[], locale: AppLocale, map: Map<string, ResolvedGapItem>) {
  for (const raw of pool) {
    const q = localizeWrittenExam(raw, locale)
    if (map.has(q.id)) continue
    map.set(q.id, {
      id: q.id,
      kind: 'written',
      title: q.question,
      explanation: q.explanation,
      description: q.sampleAnswer,
      rubric: q.rubric,
    })
  }
}

function indexOral(pool: OralExamItem[], locale: AppLocale, map: Map<string, ResolvedGapItem>) {
  for (const raw of pool) {
    const q = localizeOralExam(raw, locale)
    if (map.has(q.id)) continue
    map.set(q.id, {
      id: q.id,
      kind: 'oral',
      title: q.questionDisplay?.trim() || q.questionSpeak,
      explanation: q.explanation,
      description: q.sampleAnswer,
      rubric: q.rubric,
    })
  }
}

function moleculeDescription(locale: AppLocale, formula: string): string {
  if (locale === 'en') return `Review structure, composition and formula of ${formula}.`
  if (locale === 'uz') return `${formula} strukturasi, tarkibi va formulasini takrorlang.`
  return `Повторите строение, состав и формулу вещества ${formula}.`
}

/** Индекс вопросов текущего § / главы + молекулы из каталога. */
export function buildGapQuestionIndex(input: {
  locale: AppLocale
  gradeId?: string
  chapterId?: string
  sectionId?: string
}): Map<string, ResolvedGapItem> {
  const map = new Map<string, ResolvedGapItem>()
  const { locale, gradeId, chapterId, sectionId } = input

  if (gradeId && chapterId && sectionId) {
    indexMcq(getMcqExamPool(gradeId, chapterId, sectionId), locale, map)
    indexMcq(getChapterLogicalMcqPool(gradeId, chapterId), locale, map)
    indexWritten(getWrittenExamPool(gradeId, chapterId), locale, map)
    indexOral(getOralExamPool(gradeId, chapterId), locale, map)
  } else if (gradeId && chapterId) {
    indexMcq(getChapterLogicalMcqPool(gradeId, chapterId), locale, map)
    indexWritten(getWrittenExamPool(gradeId, chapterId), locale, map)
    indexOral(getOralExamPool(gradeId, chapterId), locale, map)
  }

  for (const cpd of Object.values(compoundById)) {
    if (map.has(cpd.id)) continue
    map.set(cpd.id, {
      id: cpd.id,
      kind: 'molecule',
      title: `${cpd.nameRu} (${cpd.formulaUnicode})`,
      description: moleculeDescription(locale, cpd.formulaUnicode),
      compoundId: cpd.id,
      explanation: cpd.descriptionRu,
    })
  }

  return map
}

export function resolveStudentGaps(
  student: ClassStudent,
  opts: { locale: AppLocale; gradeId?: string; chapterId?: string; sectionId?: string },
): ResolvedGapItem[] {
  const weakIds = collectWeakTopics(student.attempts, 16)
  const index = buildGapQuestionIndex(opts)
  return weakIds.map((id) => {
    const hit = index.get(id)
    if (hit) return hit
    return {
      id,
      kind: 'unknown' as const,
      title: id.replace(/^q_/, '§ '),
    }
  })
}

function masteryWord(locale: AppLocale, level: StudentMasteryStats['masteryLevel']): string {
  return msg(msgTable(locale), `learn.studentStats.mastery.${level}`)
}

function uiKindLabel(locale: AppLocale, kind: string): string {
  return msg(msgTable(locale), `learn.studentStats.kind.${kind}`)
}

function trendWord(c: Copy, trend: StudentMasteryStats['progressTrend']): string {
  if (trend === 'rising') return c.trendRising
  if (trend === 'falling') return c.trendFalling
  if (trend === 'stable') return c.trendStable
  return c.trendNone
}

function diagnosisText(c: Copy, level: StudentMasteryStats['masteryLevel']): string {
  if (level === 'strong') return c.diagnosisStrong
  if (level === 'good') return c.diagnosisGood
  if (level === 'needsWork') return c.diagnosisNeeds
  return c.diagnosisNone
}

function teacherHintsFor(mcq: TopicQuizItem | undefined, locale: AppLocale): string[] {
  if (!mcq) return []
  const max = maxQuizTeacherHintLevels(mcq)
  const out: string[] = []
  for (let i = 0; i < max; i++) {
    const h = getQuizTeacherHint(mcq, i, locale)
    if (h?.text?.trim()) out.push(h.text.trim())
  }
  return out
}

function distractorNotes(
  locale: AppLocale,
  choices: readonly string[] | undefined,
  correctIndex: number | undefined,
): string[] {
  if (!choices || correctIndex == null) return []
  return choices
    .map((ch, i) => {
      if (i === correctIndex) return null
      if (locale === 'en') {
        return `«${ch}» — does not match the definition / conditions of the correct idea; compare with the explanation above.`
      }
      if (locale === 'uz') {
        return `«${ch}» — to‘g‘ri g‘oya ta’rifi/shartlariga mos kelmaydi; yuqoridagi izoh bilan solishtiring.`
      }
      return `«${ch}» — не соответствует определению / условиям верной идеи; сравните с объяснением выше.`
    })
    .filter((x): x is string => Boolean(x))
}

function appendTheoryBody(
  lines: string[],
  section: LearnSection,
  locale: AppLocale,
  c: Copy,
) {
  const table = msgTable(locale)
  for (const slide of section.slides) {
    if (slide.type === 'theory' || slide.type === 'example') {
      lines.push(`### ${msg(table, slide.titleKey)}`, '', msg(table, slide.bodyKey), '')
      if (slide.bulletsKey) {
        for (const b of msg(table, slide.bulletsKey).split('|')) {
          const t = b.trim()
          if (t) lines.push(`- ${t}`)
        }
        lines.push('')
      }
      if (slide.calloutKey) {
        lines.push(`> **${c.callout}:** ${msg(table, slide.calloutKey)}`, '')
      }
      if (slide.diagramKey) {
        lines.push(`*${msg(table, slide.diagramKey)}*`, '')
      }
    } else if (slide.type === 'visual' && slide.bodyKey) {
      lines.push(`### ${msg(table, slide.titleKey)}`, '', msg(table, slide.bodyKey), '')
    } else if (slide.type === 'interactive3d') {
      lines.push(`### 3D`, '', msg(table, slide.captionKey), '')
    } else if (slide.type === 'labInvite') {
      lines.push(`### Lab`, '', msg(table, slide.bodyKey), '')
    }
  }
}

function appendCheckpointBody(
  lines: string[],
  section: LearnSection,
  locale: AppLocale,
  c: Copy,
) {
  const table = msgTable(locale)
  const cps = section.slides.filter((s) => s.type === 'checkpoint')
  if (cps.length === 0) return false
  cps.forEach((slide, i) => {
    if (slide.type !== 'checkpoint') return
    lines.push(`### ${i + 1}. ${c.checkpointQ}`, '', msg(table, slide.questionKey), '')
    slide.choiceKeys.forEach((ck, idx) => {
      const mark = idx === slide.correctIndex ? '✓' : '○'
      lines.push(`${mark} ${msg(table, ck)}`)
    })
    lines.push('')
  })
  return true
}

function appendCompoundCard(lines: string[], gap: ResolvedGapItem, c: Copy) {
  const id = gap.compoundId ?? gap.id
  const cpd = compoundById[id]
  if (!cpd) return
  lines.push(`#### ${c.compoundBlock}`, '')
  lines.push(`- **${c.formula}:** ${cpd.formulaUnicode}`)
  lines.push(`- **${c.compoundDesc}:** ${cpd.descriptionRu}`)
  if (cpd.factsRu?.source) lines.push(`- **${c.source}:** ${cpd.factsRu.source}`)
  if (cpd.factsRu?.usage) lines.push(`- **${c.usage}:** ${cpd.factsRu.usage}`)
  if (cpd.factsRu?.importance) lines.push(`- **${c.importance}:** ${cpd.factsRu.importance}`)
  if (cpd.laboratoryRecipeRu?.trim()) {
    lines.push(`- **${c.obtain}:** ${cpd.laboratoryRecipeRu.trim()}`)
  }
  if (cpd.obtainingStepsRu?.length) {
    lines.push(`- **${c.obtain}:**`)
    for (const step of cpd.obtainingStepsRu) {
      lines.push(`  ${step.step}. \`${step.equation}\`${step.note ? ` — ${step.note}` : ''}`)
    }
  }
  lines.push('')
}

function appendGapCard(
  lines: string[],
  gap: ResolvedGapItem,
  index: number,
  locale: AppLocale,
  c: Copy,
) {
  lines.push(`### ${c.gapCard} ${index + 1}. ${gap.title}`, '')
  lines.push(`- **${c.kind}:** ${kindLabel(c, gap.kind)}`)
  lines.push(`- **${c.question}:** ${gap.title}`)

  if (gap.choices?.length) {
    lines.push('', `**${c.choices}:**`, '')
    gap.choices.forEach((ch, i) => {
      const mark = i === gap.correctIndex ? '✓' : '○'
      const letter = String.fromCharCode(65 + i)
      lines.push(`${mark} **${letter}.** ${ch}`)
    })
    lines.push('')
  }

  if (gap.correctAnswer) lines.push(`- **${c.correct}:** ${gap.correctAnswer}`)
  if (gap.explanation) lines.push(`- **${c.explain}:** ${gap.explanation}`)
  if (gap.description) {
    const label = gap.kind === 'written' || gap.kind === 'oral' ? c.sample : c.about
    lines.push(`- **${label}:** ${gap.description}`)
  }

  if (gap.rubric?.length) {
    lines.push(`- **${c.rubric}:**`)
    for (const r of gap.rubric) lines.push(`  - ${r}`)
  }

  const distractors = distractorNotes(locale, gap.choices, gap.correctIndex)
  if (distractors.length > 0) {
    lines.push('', `**${c.whyWrong}:**`, '')
    for (const d of distractors) lines.push(`- ${d}`)
    lines.push('')
  }

  const hints = teacherHintsFor(gap.mcq, locale)
  if (hints.length > 0) {
    lines.push(`**${c.howThink}:**`, '')
    hints.forEach((h, i) => lines.push(`${i + 1}. ${h}`))
    lines.push('')
  }

  if (gap.kind === 'molecule') appendCompoundCard(lines, gap, c)

  lines.push(`**${c.selfCheck}:**`, '')
  lines.push(`1. ${c.selfCheck1}`)
  lines.push(`2. ${c.selfCheck2}`)
  lines.push(`3. ${c.selfCheck3}`)
  lines.push('')
}

function pickPracticeMcq(
  gradeId: string | undefined,
  chapterId: string | undefined,
  sectionId: string | undefined,
  locale: AppLocale,
  excludeIds: Set<string>,
  limit = 5,
): TopicQuizItem[] {
  if (!gradeId || !chapterId || !sectionId) return []
  const pool = [
    ...getMcqExamPool(gradeId, chapterId, sectionId),
    ...getChapterLogicalMcqPool(gradeId, chapterId),
  ]
    .map((q) => localizeTopicQuiz(q, locale))
    .filter((q) => !excludeIds.has(q.id))

  const out: TopicQuizItem[] = []
  const used = new Set<string>()
  for (const q of pool) {
    if (used.has(q.id)) continue
    used.add(q.id)
    out.push(q)
    if (out.length >= limit) break
  }
  return out
}

/** Markdown-конспект по пробелам ученика (проработанный). */
export function generateGapConspectMarkdown(input: GapConspectInput): string {
  const locale = input.locale
  const c = COPY[locale] ?? COPY.ru
  const stats = computeStudentMastery(input.student)
  const rating = computeStudentRating(input.student)
  const gaps = resolveStudentGaps(input.student, {
    locale,
    gradeId: input.gradeId,
    chapterId: input.chapterId,
    sectionId: input.sectionId,
  })

  const date = new Date().toLocaleString(locale === 'en' ? 'en-GB' : locale === 'uz' ? 'uz-UZ' : 'ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const lines: string[] = [`# ${c.title}`, '']

  // 1. Passport
  lines.push(`## 1. ${c.passport}`, '')
  lines.push(`- **${c.student}:** ${input.student.name}`)
  if (input.className?.trim()) lines.push(`- **${c.class}:** ${input.className.trim()}`)
  lines.push(`- **${c.topic}:** ${input.sectionTitle}`)
  if (input.gradeId && input.chapterId) {
    const chapter = learnChapterById(input.gradeId, input.chapterId)
    const table = msgTable(locale)
    if (chapter) lines.push(`- **${c.chapter}:** ${msg(table, chapter.titleKey)}`)
  }
  lines.push(`- **${c.date}:** ${date}`)
  lines.push(`- **${c.avg}:** ${stats.overallAvgPct !== null ? `${stats.overallAvgPct}%` : '—'}`)
  lines.push(`- **${c.mastery}:** ${masteryWord(locale, stats.masteryLevel)}`)
  lines.push(`- **${c.trend}:** ${trendWord(c, stats.progressTrend)}`)
  lines.push(`- **${c.attemptsTotal}:** ${input.student.attempts.length}`)
  lines.push(
    `- **${c.rating}:** ${rating.score}/100` +
      (rating.conspectBonus > 0
        ? ` (+${rating.conspectBonus} ${locale === 'en' ? 'conspect bonus' : locale === 'uz' ? 'konspekt bonusi' : 'бонус за конспекты'})`
        : ''),
  )
  lines.push('')

  lines.push(`**${c.byKind}:**`, '')
  const kindOrder = ['topic', 'molecule', 'oral', 'written', 'ai', 'task'] as const
  for (const kind of kindOrder) {
    const k = stats.byKind[kind]
    if (k.attempts === 0) continue
    lines.push(
      `- ${uiKindLabel(locale, kind)}: ${k.avgPct !== null ? `${k.avgPct}%` : '—'} (${k.attempts})` +
        (k.last ? ` · last ${k.last.score}/${k.last.total}` : ''),
    )
  }
  lines.push('')

  const weakKinds = kindOrder
    .filter((kind) => {
      const k = stats.byKind[kind]
      return k.attempts > 0 && k.avgPct !== null && k.avgPct < 70
    })
    .map((kind) => uiKindLabel(locale, kind))
  if (weakKinds.length > 0) {
    lines.push(`- **${c.weakKinds}:** ${weakKinds.join(', ')}`)
    lines.push('')
  }

  lines.push(`**${c.diagnosis}:** ${diagnosisText(c, stats.masteryLevel)}`, '')

  // 2. Goals
  lines.push(`## 2. ${c.goals}`, '')
  if (input.gradeId && input.chapterId && input.sectionId) {
    const fgos = getLearnFgosMeta(input.gradeId as LearnGradeId, input.chapterId, input.sectionId)
    lines.push(`- **${c.program}:** ${fgos.programBlock}`)
    lines.push(`- **${c.hours}:** ${fgos.hours}`)
    lines.push(`- **${c.skills}:**`)
    for (const s of fgos.skills) lines.push(`  - ${s}`)
  }
  lines.push(`- **${c.focus}:**`)
  if (gaps.length > 0) {
    gaps.slice(0, 8).forEach((g, i) => lines.push(`  ${i + 1}. ${g.title}`))
  } else {
    lines.push(`  - ${input.sectionTitle}`)
  }
  lines.push(`- ${c.goalRaise}`)
  lines.push('')

  // 3. Gap cards
  lines.push(`## 3. ${c.gaps}`, '')
  if (gaps.length === 0) {
    lines.push(c.noGaps, '')
  } else {
    gaps.forEach((g, i) => appendGapCard(lines, g, i, locale, c))
  }

  let sectionNo = 4
  const section =
    input.gradeId && input.chapterId && input.sectionId
      ? learnSectionById(input.gradeId, input.chapterId, input.sectionId)
      : undefined

  if (section) {
    lines.push(`## ${sectionNo}. ${c.theory}`, '')
    appendTheoryBody(lines, section, locale, c)
    sectionNo += 1

    const cpStart = lines.length
    const hasCp = appendCheckpointBody(lines, section, locale, c)
    if (hasCp) {
      lines.splice(cpStart, 0, `## ${sectionNo}. ${c.checkpoints}`, '')
      sectionNo += 1
    }
  }

  const exclude = new Set(gaps.map((g) => g.id))
  const practice = pickPracticeMcq(
    input.gradeId,
    input.chapterId,
    input.sectionId,
    locale,
    exclude,
    5,
  )
  if (practice.length > 0) {
    lines.push(`## ${sectionNo}. ${c.practiceQuiz}`, '', c.practiceLead, '')
    sectionNo += 1
    practice.forEach((q, i) => {
      lines.push(`### ${i + 1}. ${q.question}`, '')
      q.choices.forEach((ch, idx) => {
        const letter = String.fromCharCode(65 + idx)
        lines.push(`- **${letter}.** ${ch}`)
      })
      lines.push('')
    })

    lines.push(`## ${sectionNo}. ${c.answerKey}`, '')
    sectionNo += 1
    practice.forEach((q, i) => {
      const letter = String.fromCharCode(65 + q.correctIndex)
      lines.push(
        `${i + 1}. **${letter}** — ${q.choices[q.correctIndex]}` +
          (q.explanation ? ` · ${q.explanation}` : ''),
      )
    })
    lines.push('')
  }

  if (input.gradeId && input.chapterId) {
    const oral = getOralExamPool(input.gradeId, input.chapterId)
      .slice(0, 3)
      .map((q) => localizeOralExam(q, locale))
    const written = getWrittenExamPool(input.gradeId, input.chapterId)
      .slice(0, 3)
      .map((q) => localizeWrittenExam(q, locale))

    if (oral.length > 0) {
      lines.push(`## ${sectionNo}. ${c.oralPractice}`, '')
      sectionNo += 1
      oral.forEach((q, i) => {
        lines.push(`### ${i + 1}. ${q.questionDisplay?.trim() || q.questionSpeak}`, '')
        if (q.rubric?.length) {
          lines.push(`*${c.rubric}:*`)
          for (const r of q.rubric) lines.push(`- ${r}`)
        }
        if (q.sampleAnswer) lines.push('', `*${c.sample}:* ${q.sampleAnswer}`)
        if (q.explanation) lines.push(`*${c.explain}:* ${q.explanation}`)
        lines.push('')
      })
    }

    if (written.length > 0) {
      lines.push(`## ${sectionNo}. ${c.writtenPractice}`, '')
      sectionNo += 1
      written.forEach((q, i) => {
        lines.push(`### ${i + 1}. ${q.question}`, '')
        if (q.rubric?.length) {
          lines.push(`*${c.rubric}:*`)
          for (const r of q.rubric) lines.push(`- ${r}`)
        }
        if (q.sampleAnswer) lines.push('', `*${c.sample}:* ${q.sampleAnswer}`)
        if (q.explanation) lines.push(`*${c.explain}:* ${q.explanation}`)
        lines.push('')
      })
    }
  }

  lines.push(`## ${sectionNo}. ${c.plan}`, '')
  sectionNo += 1
  lines.push(`### ${c.day1}`, '', c.day1b, '')
  lines.push(`### ${c.day2}`, '', c.day2b, '')
  lines.push(`### ${c.day3}`, '', c.day3b, '')

  lines.push(`## ${sectionNo}. ${c.checklist}`, '')
  sectionNo += 1
  lines.push(`- [ ] ${c.check1}`)
  lines.push(`- [ ] ${c.check2}`)
  lines.push(`- [ ] ${c.check3}`)
  lines.push(`- [ ] ${c.check4}`)
  lines.push(`- [ ] ${c.check5}`)
  lines.push(`- [ ] ${c.check6}`)
  lines.push('')

  lines.push(`## ${sectionNo}. ${c.teacherNote}`, '', c.teacherNoteBody, '')
  lines.push('---', `*${c.footer}*`)

  return lines.join('\n')
}

export function gapConspectFilename(studentName: string, locale: AppLocale = 'ru'): string {
  const prefix =
    locale === 'en' ? 'gap-conspect' : locale === 'uz' ? 'konspekt-bolish' : 'konspekt-probely'
  const day = new Date().toISOString().slice(0, 10)
  return `${prefix}-${sanitizeFilenamePart(studentName)}-${day}.md`
}

export function downloadGapConspect(markdown: string, studentName: string, locale: AppLocale) {
  downloadTextFile(gapConspectFilename(studentName, locale), markdown)
}

/** Сгенерировать, скачать и зафиксировать конспект по пробелам ученика. */
export function issueStudentGapConspect(
  input: GapConspectInput & { rosterSectionId: string },
): ClassStudent | null {
  const gaps = resolveStudentGaps(input.student, {
    locale: input.locale,
    gradeId: input.gradeId,
    chapterId: input.chapterId,
    sectionId: input.sectionId,
  })
  const markdown = generateGapConspectMarkdown(input)
  downloadGapConspect(markdown, input.student.name, input.locale)
  return recordGapConspectIssued(
    input.rosterSectionId,
    input.student.id,
    gaps.map((g) => g.id),
  )
}
