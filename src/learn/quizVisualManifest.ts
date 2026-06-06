/** Фотореалистичные иллюстрации к вопросам (public/learn/quiz-visuals). */
export type QuizVisualSpec = {
  /** Путь от public, напр. /learn/quiz-visuals/c1-t03.png */
  src: string
  caption: string
  alt: string
}

export const QUIZ_VISUAL_MANIFEST: Record<string, QuizVisualSpec> = {
  'c1-t01': {
    src: '/learn/quiz-visuals/c1-t01.png',
    caption: 'Химия изучает вещества, их состав и превращения',
    alt: 'Лаборатория: пробирки, модели молекул, опыты с веществами',
  },
  'c1-t02': {
    src: '/learn/quiz-visuals/c1-t02.png',
    caption: 'Чистое вещество — постоянный состав (вода, медь, кислород)',
    alt: 'Дистиллированная вода, медная проволока и кристаллы — чистые вещества',
  },
  'c1-t03': {
    src: '/learn/quiz-visuals/c1-t03.png',
    caption: 'Гомогенная и гетерогенная смеси: соль в воде и песок в воде',
    alt: 'Сравнение однородного раствора соли и неоднородной смеси песка с водой',
  },
  'c1-t04': {
    src: '/learn/quiz-visuals/c1-t04.png',
    caption: 'Физическое явление: лёд тает — остаётся H₂O',
    alt: 'Плавление льда в стакане — физическое явление',
  },
  'c1-t05': {
    src: '/learn/quiz-visuals/c1-t05.png',
    caption: 'Химическое явление: горение — новые вещества',
    alt: 'Горение — образование новых веществ',
  },
  'c1-t06': {
    src: '/learn/quiz-visuals/c1-t06.png',
    caption: 'Правило ТБ: кислоту наливают в воду',
    alt: 'Безопасное разбавление кислоты в лаборатории',
  },
  'c1-t07': {
    src: '/learn/quiz-visuals/c1-t07.png',
    caption: 'Фильтрование: осадок остаётся на фильтре',
    alt: 'Воронка Бюхнера и фильтрование осадка',
  },
  'c1-t08': {
    src: '/learn/quiz-visuals/c1-t08.png',
    caption: 'Плавление льда при 0 °C — физическое явление',
    alt: 'Кубики льда плавят в воде',
  },
  'c1-t09': {
    src: '/learn/quiz-visuals/c1-t09.png',
    caption: 'Спиртовая лампа — нагрев небольших объёмов',
    alt: 'Спиртовка и пробирка в школьной лаборатории',
  },
  'c1-t10': {
    src: '/learn/quiz-visuals/c1-t10.png',
    caption: 'Разделение смеси песка и соли',
    alt: 'Растворение, фильтрование и выпаривание соли',
  },
  'c1-t11': {
    src: '/learn/quiz-visuals/c1-t11.png',
    caption: 'Твёрдое, жидкое и газообразное состояние',
    alt: 'Лёд, вода и пар — агрегатные состояния',
  },
  'c1-t12': {
    src: '/learn/quiz-visuals/c1-t12.png',
    caption: 'Горение газа — химическое явление в быту',
    alt: 'Газовая плита — химическая реакция горения',
  },
}

export function getQuizVisualSpec(visualId?: string): QuizVisualSpec | null {
  if (!visualId) return null
  return QUIZ_VISUAL_MANIFEST[visualId] ?? null
}

export function hasQuizVisualAsset(visualId?: string): boolean {
  return !!visualId && visualId in QUIZ_VISUAL_MANIFEST
}
