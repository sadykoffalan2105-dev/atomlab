export type PilotSlideLocale = 'ru' | 'en' | 'uz'

const UI: Record<
  PilotSlideLocale,
  {
    slide0Body: (topic: string) => string
    defaultBullets0: (topic: string) => string[]
    defaultBullets3: (topic: string) => string[]
    defaultCallout0: string
    defaultCallout3: string
    defaultDiagram: (topic: string) => [string, string]
    slide1Bullets: string
    slide2Caption: string
    slide3Body: (topic: string) => string
    slide5Title: string
    slide1Title: string
    slide3Title: string
  }
> = {
  ru: {
    slide0Body: () =>
      'Химия — экспериментальная наука о веществах, их составе, строении и превращениях. На уроке мы опираемся на учебник, 3D-модели ATOMLAB и ваши записи — так материал запоминается надёжнее.',
    defaultBullets0: (topic) => [
      `Предмет урока: ${topic}`,
      'Связывайте текст с 3D-моделью справа',
      'Записывайте выводы в рабочую зону',
    ],
    defaultBullets3: (topic) => [
      `Главное: ${topic}`,
      'Повторите определение вслух',
      'Проверьте себя вопросом ниже',
    ],
    defaultCallout0: 'На электронной доске удобно показывать 3D-панель крупно — включите «Режим доски».',
    defaultCallout3: 'ИИ-учитель справа поможет пересказать тему и проверить понимание.',
    defaultDiagram: (topic) => [topic, 'Схема и модель дополняют друг друга'],
    slide1Title: 'Интересный факт',
    slide1Bullets: 'Наблюдайте явление|Сформулируйте вопрос|Сверьте с моделью',
    slide2Caption:
      'Интерактивная 3D-модель: вращайте, приближайте, обсуждайте строение на доске.',
    slide3Title: 'Опыт и наблюдение',
    slide3Body: (topic) =>
      `Итог параграфа: ${topic}. Сформулируйте определение своими словами и закрепите его задачей в рабочей зоне.`,
    slide5Title: 'Связь с лабораторией ATOMLAB',
  },
  en: {
    slide0Body: () =>
      'Chemistry is an experimental science about substances, their composition, structure, and transformations. Use the textbook, ATOMLAB 3D models, and your notes — that helps the material stick.',
    defaultBullets0: (topic) => [
      `Lesson focus: ${topic}`,
      'Connect the text with the 3D model on the right',
      'Write conclusions in the workspace',
    ],
    defaultBullets3: (topic) => [
      `Key idea: ${topic}`,
      'Repeat the definition aloud',
      'Check yourself with the question below',
    ],
    defaultCallout0: 'On a classroom board, show the 3D panel large — enable Board mode.',
    defaultCallout3: 'The AI teacher on the right can help you recap and check understanding.',
    defaultDiagram: (topic) => [topic, 'Diagram and model complement each other'],
    slide1Title: 'Interesting fact',
    slide1Bullets: 'Observe the phenomenon|Formulate a question|Compare with the model',
    slide2Caption:
      'Interactive 3D model: rotate, zoom in, discuss structure on the board.',
    slide3Title: 'Experiment and observation',
    slide3Body: (topic) =>
      `Section summary: ${topic}. State the definition in your own words and practice in the workspace.`,
    slide5Title: 'Link to ATOMLAB laboratory',
  },
  uz: {
    slide0Body: () =>
      'Kimyo — moddalar, ularning tarkibi, tuzilishi va o\'zgarishlari haqidagi tajribaviy fan. Darsda darslik, ATOMLAB 3D modellari va yozuvlaringizga tayaning — shunda material yaxshi esda qoladi.',
    defaultBullets0: (topic) => [
      `Dars mavzusi: ${topic}`,
      'Matnni o\'ngdagi 3D model bilan bog\'lang',
      'Xulosalarni ish maydoniga yozing',
    ],
    defaultBullets3: (topic) => [
      `Asosiy g\'oya: ${topic}`,
      'Ta\'rifni ovoz chiqarib takrorlang',
      'Quyidagi savol bilan o\'zingizni tekshiring',
    ],
    defaultCallout0: 'Elektron doskada 3D panelni katta ko\'rsatish qulay — «Doska rejimi»ni yoqing.',
    defaultCallout3: 'O\'ngdagi SI-o\'qituvchi mavzuni qayta aytish va tushunishni tekshirishda yordam beradi.',
    defaultDiagram: (topic) => [topic, 'Sxema va model bir-birini to\'ldiradi'],
    slide1Title: 'Qiziqarli fakt',
    slide1Bullets: 'Hodisani kuzating|Savol tuzing|Model bilan solishtiring',
    slide2Caption:
      'Interaktiv 3D model: aylantiring, yaqinlashtiring, doskada tuzilishni muhokama qiling.',
    slide3Title: 'Tajriba va kuzatuv',
    slide3Body: (topic) =>
      `Paragraf yakuni: ${topic}. Ta\'rifni o\'z so\'zlaringiz bilan yozing va ish maydonida mustahkamlang.`,
    slide5Title: 'ATOMLAB laboratoriyasi bilan bog\'liqlik',
  },
}

/** Генератор строк слайдов для полного § — ru / en / uz. */
export function buildFullSectionSlides(
  locale: PilotSlideLocale,
  prefix: string,
  topic: string,
  example: string,
  checkpointQ: string,
  choices: [string, string, string, string],
  _correctIndex: number,
  labHint: string,
  extra?: {
    bullets0?: string[]
    callout0?: string
    diagram0?: [string, string]
    bullets3?: string[]
    callout3?: string
  },
): Record<string, string> {
  const ui = UI[locale]
  const b0 = extra?.bullets0 ?? ui.defaultBullets0(topic)
  const b3 = extra?.bullets3 ?? ui.defaultBullets3(topic)
  return {
    [`${prefix}.slide0.title`]: `${topic}`,
    [`${prefix}.slide0.body`]: ui.slide0Body(topic),
    [`${prefix}.slide0.bullets`]: b0.join('|'),
    [`${prefix}.slide0.callout`]: extra?.callout0 ?? ui.defaultCallout0,
    [`${prefix}.slide0.diagram`]: (extra?.diagram0 ?? ui.defaultDiagram(topic)).join('|'),
    [`${prefix}.slide1.title`]: ui.slide1Title,
    [`${prefix}.slide1.body`]: example,
    [`${prefix}.slide1.bullets`]: ui.slide1Bullets,
    [`${prefix}.slide2.caption`]: ui.slide2Caption,
    [`${prefix}.slide3.title`]: ui.slide3Title,
    [`${prefix}.slide3.body`]: ui.slide3Body(topic),
    [`${prefix}.slide3.bullets`]: b3.join('|'),
    [`${prefix}.slide3.callout`]: extra?.callout3 ?? ui.defaultCallout3,
    [`${prefix}.slide4.q`]: checkpointQ,
    [`${prefix}.slide4.c0`]: choices[0],
    [`${prefix}.slide4.c1`]: choices[1],
    [`${prefix}.slide4.c2`]: choices[2],
    [`${prefix}.slide4.c3`]: choices[3],
    [`${prefix}.slide5.title`]: ui.slide5Title,
    [`${prefix}.slide5.body`]: labHint,
  }
}
