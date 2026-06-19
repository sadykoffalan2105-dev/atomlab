/** Тексты VR 3D лаборатории. */
export const vrLabRu = {
  'nav.vrLab': 'VR лаборатория',

  'vrLab.title': 'VR 3D лаборатория',
  'vrLab.lead':
    'Колбы на полке — перетаскивайте на стол, наливайте вещества из каталога и смешивайте в реакторе: первый реагент в чан, второй запускает реакцию.',
  'vrLab.backLab': 'К реактору',

  'vrLab.picker.title': 'Каталог веществ',
  'vrLab.picker.search': 'Формула или название…',
  'vrLab.picker.starterOnly': 'Только для опытов (реагируют)',
  'vrLab.picker.selected': 'Выбрано: {formula}',

  'vrLab.tube.selected': 'Пробирка {n}',
  'vrLab.shelf.selected': 'Колба {n}',
  'vrLab.vat.selected': 'Реактор смешивания',
  'vrLab.section.shelf': 'Колбы (1–10)',
  'vrLab.shelf.dragHint': 'Перетащите колбу на стол или верните на полку.',
  'vrLab.shelf.onWall': 'На полке',
  'vrLab.shelf.onBench': 'На столе',
  'vrLab.vat.waitSecond': 'В чане {formula} — влейте второй реагент.',
  'vrLab.action.pourShelf': 'Налить в колбу',
  'vrLab.action.pourVat': 'Влить в чан',
  'vrLab.action.selectVat': 'Выбрать чан',
  'vrLab.action.emptyVat': 'Очистить чан',
  'vrLab.action.emptyShelf': 'Опустошить колбу',
  'vrLab.action.empty': 'Сбросить всё',

  'vrLab.result.title': 'Результат',
  'vrLab.result.equation': 'Уравнение',
  'vrLab.result.none': 'Налейте два разных реагента в чан — выберите колбу и нажмите «Влить в чан».',

  'vrLab.reaction.neutralization': 'Нейтрализация — образовалась соль и вода, выделилось тепло.',
  'vrLab.reaction.hydration': 'Гидратация оксида — образовалось основание или кислота.',
  'vrLab.reaction.gas': 'Растворение газа — пузырьки и смена цвета.',
  'vrLab.reaction.co2': 'Выделение CO₂ — бурное вскипание!',
  'vrLab.reaction.catalysis': 'Кatalитическое разложение — активное выделение газа.',
  'vrLab.reaction.dissolve': 'Растворение осадка — смена цвета раствора.',
  'vrLab.reaction.blueSolution': 'Образовался синий раствор сульфата меди.',
  'vrLab.reaction.yellowSolution': 'Образовался желтоватый раствор хлорида железа(III).',
  'vrLab.reaction.whiteFume': 'Образование белого дыма NH₄Cl.',
  'vrLab.reaction.precipitate': 'Выпал осадок.',
  'vrLab.reaction.noReaction': 'Видимой реакции нет — смесь осталась без изменений.',
  'vrLab.reaction.unlistedAcidBase': 'Кислота и основание смешаны — возможна нейтрализация (реакция не в базе опытов).',
  'vrLab.reaction.same': 'Одинаковые вещества — смесь без новой реакции.',
  'vrLab.reaction.empty': 'Колбы пусты — налейте реагенты из каталога.',

  'vrLab.stats.reactions': '{n} реакций в базе',
  'vrLab.stats.colors': '{n} цветов растворов',
} as const
