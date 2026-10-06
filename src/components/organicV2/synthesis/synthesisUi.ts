/** Органика v2 · синтез — подписи интерфейса проигрывателя и выбора маршрута (RU/EN/UZ), свой словарь рядом с компонентом. */
export type SynthUiLang = 'ru' | 'en' | 'uz'

export interface SynthUi {
  aria: string
  loading: string
  prev: string
  next: string
  play: string
  pause: string
  slider: string
  speed: string
  stage: string
  teacher: string
  type: string
  conditions: string
  book: string
  example: string
  polymer: string
  chainGoesOn: string
  /** «одна копия + ×N» */
  copiesNote: string
  radicalHint: string
  pairHint: string
  routes: string
  routeFrom: (names: string) => string
  routeGeneric: string
  /** маршрут по общей схеме учебника (не уравнение учебника): подпись под названием */
  routeScheme: (page?: number) => string
  /** кнопка «ещё N маршрутов» */
  routeMore: (n: number) => string
  noRoutes: string
  loadingRoutes: string
  generic: (page?: number) => string
  source: (grade: number, section?: string, page?: number) => string
}

export const SYNTH_UI: Readonly<Record<SynthUiLang, SynthUi>> = {
  ru: {
    aria: 'Как образуется: синтез по шагам',
    loading: 'Загружаем 3D…',
    prev: 'Предыдущий этап (←)',
    next: 'Следующий этап (→)',
    play: 'Смотреть',
    pause: 'Пауза',
    slider: 'Время показа',
    speed: 'Скорость',
    stage: 'Этап',
    teacher: 'Учитель',
    type: 'Тип реакции',
    conditions: 'Условия',
    book: 'Где в учебнике',
    example: 'Пример',
    polymer: 'полимер (3 звена)',
    chainGoesOn: 'цепь продолжается',
    copiesNote: 'В 3D — по одной молекуле каждого вещества; ×N — сколько их в уравнении.',
    radicalHint: 'неспаренный электрон — радикал',
    pairHint: 'электронная пара уходит к более электроотрицательному атому',
    routes: 'Способ получения',
    routeFrom: (n) => n,
    routeGeneric: 'общая схема',
    routeScheme: (p) => `по общей схеме учебника${p ? `, с. ${p}` : ''}`,
    routeMore: (n) => `ещё ${n}`,
    noRoutes: 'Для этого вещества в учебнике нет способа получения.',
    loadingRoutes: 'Загружаем реакции учебника…',
    generic: (p) => `Общая схема (R — углеводородный радикал), показана на конкретном примере${p ? `; в учебнике — с. ${p}` : ''}.`,
    source: (g, s, p) => `Kimyo ${g} кл.${s ? `, § ${s}` : ''}${p ? `, с. ${p}` : ''}`,
  },
  en: {
    aria: 'How it forms: step-by-step synthesis',
    loading: 'Loading 3D…',
    prev: 'Previous stage (←)',
    next: 'Next stage (→)',
    play: 'Play',
    pause: 'Pause',
    slider: 'Playback time',
    speed: 'Speed',
    stage: 'Stage',
    teacher: 'Teacher',
    type: 'Reaction type',
    conditions: 'Conditions',
    book: 'In the textbook',
    example: 'Example',
    polymer: 'polymer (3 units)',
    chainGoesOn: 'the chain goes on',
    copiesNote: 'The 3D view shows one molecule of each substance; ×N is how many there are in the equation.',
    radicalHint: 'unpaired electron — a radical',
    pairHint: 'the electron pair goes to the more electronegative atom',
    routes: 'How to obtain',
    routeFrom: (n) => n,
    routeGeneric: 'general scheme',
    routeScheme: (p) => `by the textbook general scheme${p ? `, p. ${p}` : ''}`,
    routeMore: (n) => `${n} more`,
    noRoutes: 'The textbook gives no way to obtain this substance.',
    loadingRoutes: 'Loading textbook reactions…',
    generic: (p) => `General scheme (R — hydrocarbon radical) shown on a concrete example${p ? `; textbook p. ${p}` : ''}.`,
    source: (g, s, p) => `Kimyo grade ${g}${s ? `, § ${s}` : ''}${p ? `, p. ${p}` : ''}`,
  },
  uz: {
    aria: 'Qanday hosil bo‘ladi: bosqichma-bosqich sintez',
    loading: '3D yuklanmoqda…',
    prev: 'Oldingi bosqich (←)',
    next: 'Keyingi bosqich (→)',
    play: 'Ko‘rish',
    pause: 'Pauza',
    slider: 'Ko‘rsatish vaqti',
    speed: 'Tezlik',
    stage: 'Bosqich',
    teacher: 'O‘qituvchi',
    type: 'Reaksiya turi',
    conditions: 'Sharoit',
    book: 'Darslikda',
    example: 'Misol',
    polymer: 'polimer (3 bo‘g‘in)',
    chainGoesOn: 'zanjir davom etadi',
    copiesNote: '3D da har bir moddadan bitta molekula ko‘rsatilgan; ×N — tenglamada nechta ekanligi.',
    radicalHint: 'juftlashmagan elektron — radikal',
    pairHint: 'elektron jufti elektromanfiyroq atomga o‘tadi',
    routes: 'Olinish usuli',
    routeFrom: (n) => n,
    routeGeneric: 'umumiy sxema',
    routeScheme: (p) => `darslikdagi umumiy sxema bo‘yicha${p ? `, ${p}-bet` : ''}`,
    routeMore: (n) => `yana ${n} ta`,
    noRoutes: 'Darslikda bu moddaning olinish usuli berilmagan.',
    loadingRoutes: 'Darslik reaksiyalari yuklanmoqda…',
    generic: (p) => `Umumiy sxema (R — uglevodorod radikali) aniq misolda ko‘rsatilgan${p ? `; darslikda — ${p}-bet` : ''}.`,
    source: (g, s, p) => `Kimyo ${g}-sinf${s ? `, § ${s}` : ''}${p ? `, ${p}-bet` : ''}`,
  },
}
