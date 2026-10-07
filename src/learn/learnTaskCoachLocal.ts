import type { LearnTaskGenerated } from './learnTaskProblems'
import type { LearnTaskCoachContext } from './learnTaskCoachTypes'

const NEXT_STEP_MARK = '__task_coach_next__'
const CHECK_MARK = '__task_coach_check__'

export function taskCoachUserPromptNext(locale: 'ru' | 'en' | 'uz'): string {
  return locale === 'en' ? NEXT_STEP_MARK : NEXT_STEP_MARK
}

export function taskCoachUserPromptCheck(locale: 'ru' | 'en' | 'uz'): string {
  return locale === 'en' ? CHECK_MARK : CHECK_MARK
}

function isNextStepRequest(text: string): boolean {
  return text.includes(NEXT_STEP_MARK) || /следующ|next step|что дальше|plan next/i.test(text)
}

function isCheckRequest(text: string): boolean {
  return text.includes(CHECK_MARK) || /проверь|check my|мои рассуж|reasoning/i.test(text)
}

function socraticWrap(hint: string, ru: boolean): string {
  const t = hint.trim()
  if (/^\?/.test(t) || t.endsWith('?')) return t
  return ru ? `Подумай: ${t} Что запишешь в черновик?` : `Think: ${t} What will you write in your notes?`
}

function wrongFeedbackReply(tc: LearnTaskCoachContext, ru: boolean): string {
  if (tc.problemKind === 'numeric' && tc.userAttempt) {
    return ru
      ? `Ответ пока не совпал — это нормально. Перечитай условие: всё ли перевёл в одни единицы? Проверь порядок действий в черновике. Какой шаг сделаешь сейчас — без подсчёта итога?`
      : `Not quite yet — re-read the problem. Same units everywhere? Which step will you take next without computing the final value?`
  }
  return ru
    ? `Пока не то. Вернись к условию: что именно спрашивают? Исключи варианты, которые точно не подходят по смыслу. Какой критерий поможет сузить выбор?`
    : `Not yet. What exactly is asked? Rule out options that clearly do not fit. What criterion helps you narrow down?`
}

function genericStep(level: number, tc: LearnTaskCoachContext, ru: boolean): string {
  const stepsRu = [
    'Что дано в задаче? Выпиши величины и единицы в черновик.',
    'Что нужно найти? Подчеркни вопрос одной фразой.',
    'Какая формула или закон связывает данное и искомое?',
    'Какой расчёт или рассуждение сделаешь первым — ещё без окончательного ответа?',
    'Проверь размерность и здравый смысл: ответ должен быть правдоподобным?',
  ]
  const stepsEn = [
    'What is given? List quantities and units.',
    'What must you find? State it in one phrase.',
    'Which formula or law links known and unknown?',
    'What is your first calculation step — without the final answer?',
    'Check units and plausibility — does your path make sense?',
  ]
  const steps = ru ? stepsRu : stepsEn
  if (tc.problemKind === 'mcq') {
    const mcqRu = [
      'Прочитай вопрос: о каком явлении, веществе или правиле речь?',
      'Сравни варианты: какие противоречат определению из учебника?',
      'Исключи заведомо неверные ответы. Что осталось и почему?',
      'Какой один тест или пример из урока подтвердит твой выбор?',
    ]
    const mcqEn = [
      'What is the question really about?',
      'Which options contradict the textbook definition?',
      'Eliminate clearly wrong answers. What remains?',
      'What lesson example would confirm your choice?',
    ]
    const m = ru ? mcqRu : mcqEn
    return m[Math.min(level, m.length - 1)]!
  }
  return steps[Math.min(level, steps.length - 1)]!
}

export function generateTaskCoachLocalReply(
  messages: { role: string; content: string }[],
  taskCoach: LearnTaskCoachContext,
  problem: LearnTaskGenerated | null,
  locale: 'ru' | 'en' | 'uz',
): string {
  const ru = locale === 'ru'
  let lastUser = ''
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      lastUser = messages[i].content
      break
    }
  }

  if (taskCoach.feedback === 'wrong' && (isNextStepRequest(lastUser) || isCheckRequest(lastUser))) {
    return wrongFeedbackReply(taskCoach, ru)
  }

  if (isCheckRequest(lastUser)) {
    const pad = taskCoach.scratchpad?.trim()
    if (!pad) {
      return ru
        ? 'Запиши в черновик хотя бы «Дано» и «Найти» — тогда смогу проверить ход мыслей, не выдавая ответ.'
        : 'Write at least Given and Find in the scratchpad — then I can check your reasoning without giving the answer.'
    }
    return ru
      ? `Вижу твой черновик. Сверь: все ли данные из условия учтены? Следующий шаг — одно действие, без итогового числа. Что запишешь?`
      : `I see your notes. Did you include all data from the problem? Next — one action without the final number. What will you write?`
  }

  const level = taskCoach.aiHintsGiven
  void problem
  if (taskCoach.labTaskId) return labStep(level, taskCoach, locale)
  const hintText = genericFromCategory(taskCoach.categoryId, level, ru, taskCoach.problemKind)
  return socraticWrap(hintText || genericStep(level, taskCoach, ru), ru)
}

/** Задача-опыт: шаги рассуждения опираются на журнал измерений ученика (а не на числа учебника). */
function labStep(level: number, tc: LearnTaskCoachContext, locale: 'ru' | 'en' | 'uz'): string {
  const list = (tc.labMeasurements ?? []).slice(0, 4).join('; ')
  const steps: Record<'ru' | 'en' | 'uz', string[]> = {
    ru: [
      `Посмотри в журнал измерений${list ? ` (${list})` : ''}: это и есть твоё «Дано». Что из этого нужно, чтобы ответить на вопрос задачи?`,
      'Запиши уравнение реакции. Какое вещество ты взвесил или отмерил — найди его количество вещества n = m / M.',
      'По коэффициентам уравнения перейди к искомому веществу. Какой множитель даёт уравнение?',
      'Газ измерен при температуре класса, а задача — при н.у. Как привести объём: V₀ = V · 273 / (273 + t)?',
      'Опыт поставлен в уменьшенном масштабе. Во сколько раз задача больше опыта — на что умножишь результат?',
      'Сравни свой результат с учебником. Если разница в пару процентов — какие причины назовёшь: прибор, потери, температура?',
    ],
    en: [
      `Look at your measurement log${list ? ` (${list})` : ''}: this is your "Given". Which values answer the question?`,
      'Write the equation. Which substance did you weigh or measure? Find its amount n = m / M.',
      'Use the equation coefficients to move to the substance you are asked about.',
      'The gas was measured at room temperature, the problem is at STP: V₀ = V · 273 / (273 + t).',
      'The experiment is scaled down. How many times bigger is the problem? Multiply accordingly.',
      'Compare with the textbook. If it differs by a few percent, what are the reasons: instrument, losses, temperature?',
    ],
    uz: [
      `O‘lchovlar jurnaliga qarang${list ? ` (${list})` : ''}: bu sizning «Berilgan»ingiz. Savolga javob uchun qaysi qiymatlar kerak?`,
      'Reaksiya tenglamasini yozing. Qaysi moddani tortdingiz yoki o‘lchadingiz — n = m / M ni toping.',
      'Tenglama koeffitsiyentlari bo‘yicha izlanayotgan moddaga o‘ting.',
      'Gaz xona haroratida o‘lchangan, masala esa n.sh. da: V₀ = V · 273 / (273 + t).',
      'Tajriba kichraytirilgan masshtabda. Masala necha marta katta — natijani nimaga ko‘paytirasiz?',
      'Natijani darslik bilan solishtiring. Farq bir necha foiz bo‘lsa — sabablari: asbob, yo‘qotishlar, harorat?',
    ],
  }
  const s = steps[locale]
  return s[Math.min(level, s.length - 1)]!
}

function genericFromCategory(
  categoryId: string,
  level: number,
  ru: boolean,
  kind: 'numeric' | 'mcq',
): string {
  if (kind === 'mcq') {
    const mcqRu = [
      'Прочитай вопрос: о каком явлении, веществе или правиле речь?',
      'Сравни варианты: какие противоречат определению из учебника?',
      'Исключи заведомо неверные ответы. Что осталось и почему?',
      'Какой один тест или пример из урока подтвердит твой выбор?',
    ]
    const mcqEn = [
      'What is the question really about?',
      'Which options contradict the textbook definition?',
      'Eliminate clearly wrong answers. What remains?',
      'What lesson example would confirm your choice?',
    ]
    const m = ru ? mcqRu : mcqEn
    return m[Math.min(level, m.length - 1)]!
  }
  const map: Record<string, string[]> = {
    solutions: [
      'Массовая доля — это отношение массы растворённого вещества к массе раствора. Что дано?',
      'Сколько граммов соли в растворе, если знаешь массу раствора и процент?',
      'Как найти массу воды, если известна масса раствора и соли?',
    ],
    stoichiometry: [
      'Переведи массу вещества в количество вещества. Какая молярная масса нужна?',
      'Запиши уравнение реакции и коэффициенты — они связывают моли.',
      'Составь пропорцию по уравнению — что ищешь?',
    ],
    limiting_reagent: [
      'Посчитай моли каждого реагента. Кто в избытке?',
      'Сравни мольные отношения с коэффициентами в уравнении.',
      'По недостающему реагенту найди продукт — но пока только план.',
    ],
    yield_impurities: [
      'Сначала масса чистого вещества без примесей — какой процент чистоты?',
      'Дальше — стехиометрия по уравнению.',
    ],
    metal_plate: [
      'Какой металл активнее по ряду напряжений? Кто должен растворяться?',
      'Изменение массы пластинки связано с переносом металла.',
    ],
    oge_prep: [
      'Выпиши «Дано» с единицами СИ.',
      'Выбери формулу из темы ОГЭ для этой задачи.',
    ],
    electron_balance: [
      'Найди степени окисления до и после реакции.',
      'Сколько электронов отдаёт восстановитель и принимает окислитель?',
    ],
    ionic_equations: [
      'Разложи вещества на ионы в растворе.',
      'Какие ионы дают осадок, газ или воду?',
    ],
    reaction_chains: [
      'Какой продукт первой ступени? Он — реагент для следующей.',
    ],
    qualitative: [
      'Какая характерная реакция для этого иона или класса веществ?',
    ],
  }
  const en: Record<string, string[]> = {
    solutions: ['Mass fraction links solute to solution mass.', 'Find salt mass from total mass and percent.'],
    stoichiometry: ['Convert mass to moles.', 'Use equation coefficients.'],
  }
  const list = ru ? map[categoryId] : en[categoryId] ?? map[categoryId]
  if (!list?.length) return genericStep(level, { categoryId, categoryTitle: '', problemKind: 'numeric', questionText: '', staticHintsRevealed: 0, aiHintsGiven: level, feedback: 'idle' }, ru)
  return list[Math.min(level, list.length - 1)]!
}
