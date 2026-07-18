import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Учёные химии и естествознания — для вопросов «кто такой Менделеев»,
 * «что открыл Лавуазье», «вклад Ибн Сины». Школьная программа 7–11 класс.
 */

type ScientistEntry = {
  id: string
  ru: string
  en: string
  keywords: string[]
}

const SCIENTISTS: ScientistEntry[] = [
  {
    id: 'mendeleev',
    keywords: ['менделеев', 'mendeleev', 'периодический закон', 'периодическая таблица', 'periodic law'],
    ru: 'Дмитрий Иванович Менделеев (1834–1907) — русский химик, автор **Периодического закона** (1869). Он расположил элементы по возрастанию атомной массы и открыл периодичность их свойств, оставив пустые клетки и предсказав свойства ещё не открытых элементов (галлий, скандий, германий). Его именем названа Периодическая таблица химических элементов.',
    en: 'Dmitri Mendeleev (1834–1907) — Russian chemist, author of the Periodic Law (1869) and the periodic table; predicted undiscovered elements.',
  },
  {
    id: 'lavoisier',
    keywords: ['лавуазье', 'lavoisier', 'закон сохранения массы', 'кислород назвал'],
    ru: 'Антуан Лавуазье (1743–1794) — французский химик, «отец современной химии». Сформулировал **закон сохранения массы** веществ, объяснил роль кислорода в горении и дыхании, ввёл понятие химического элемента и современную номенклатуру.',
    en: 'Antoine Lavoisier (1743–1794) — father of modern chemistry; law of conservation of mass; explained combustion and oxygen.',
  },
  {
    id: 'lomonosov',
    keywords: ['ломоносов', 'lomonosov'],
    ru: 'Михаил Васильевич Ломоносов (1711–1765) — русский учёный-энциклопедист. Независимо сформулировал **закон сохранения массы вещества** и заложил основы атомно-молекулярного учения в России.',
    en: 'Mikhail Lomonosov (1711–1765) — Russian polymath; conservation of mass; atomic-molecular theory.',
  },
  {
    id: 'dalton',
    keywords: ['дальтон', 'dalton', 'атомная теория', 'atomic theory'],
    ru: 'Джон Дальтон (1766–1844) — английский химик и физик, создатель **атомной теории**. Утверждал, что вещества состоят из атомов, у каждого элемента свои атомы с определённой массой; ввёл относительные атомные массы.',
    en: 'John Dalton (1766–1844) — atomic theory; each element has atoms of a characteristic mass.',
  },
  {
    id: 'avogadro',
    keywords: ['авогадро', 'avogadro', 'число авогадро', 'моль'],
    ru: 'Амедео Авогадро (1776–1856) — итальянский учёный. **Закон Авогадро**: в равных объёмах газов при одинаковых условиях содержится одинаковое число молекул. Его именем названо число Авогадро Nₐ ≈ 6,02·10²³ частиц в 1 моль.',
    en: 'Amedeo Avogadro (1776–1856) — equal volumes of gases contain equal numbers of molecules; Avogadro number ≈ 6.02·10²³.',
  },
  {
    id: 'rutherford',
    keywords: ['резерфорд', 'rutherford', 'ядро атома', 'nucleus'],
    ru: 'Эрнест Резерфорд (1871–1937) — британский физик. Опытом с рассеянием α-частиц доказал существование **атомного ядра** и предложил планетарную модель атома. Открыл протон.',
    en: 'Ernest Rutherford (1871–1937) — discovered the atomic nucleus (gold foil experiment); planetary model; proton.',
  },
  {
    id: 'bohr',
    keywords: ['бор', 'нильс бор', 'niels bohr', 'модель бора', 'орбит'],
    ru: 'Нильс Бор (1885–1962) — датский физик. Предложил **планетарную (боровскую) модель атома**: электроны движутся по разрешённым орбитам (энергетическим уровням) и излучают/поглощают энергию при переходах.',
    en: 'Niels Bohr (1885–1962) — Bohr model of the atom; electrons on quantized orbits.',
  },
  {
    id: 'curie',
    keywords: ['кюри', 'мария кюри', 'curie', 'радиоактивность', 'полоний', 'радий'],
    ru: 'Мария Склодовская-Кюри (1867–1934) — учёный, дважды лауреат Нобелевской премии. Исследовала **радиоактивность**, открыла элементы полоний и радий (вместе с Пьером Кюри).',
    en: 'Marie Curie (1867–1934) — radioactivity research; discovered polonium and radium; two Nobel Prizes.',
  },
  {
    id: 'boyle',
    keywords: ['бойль', 'boyle', 'закон бойля'],
    ru: 'Роберт Бойль (1627–1691) — англо-ирландский химик, один из основателей научной химии. Дал определение химического элемента, открыл **закон Бойля–Мариотта** (p·V = const при постоянной температуре).',
    en: 'Robert Boyle (1627–1691) — defined chemical element; Boyle’s law (pV = const at constant T).',
  },
  {
    id: 'arrhenius',
    keywords: ['аррениус', 'arrhenius', 'электролитическая диссоциация', 'ионы'],
    ru: 'Сванте Аррениус (1859–1927) — шведский химик. Создал **теорию электролитической диссоциации**: при растворении электролиты распадаются на ионы, поэтому растворы проводят ток.',
    en: 'Svante Arrhenius (1859–1927) — theory of electrolytic dissociation into ions.',
  },
  {
    id: 'ibn-sina',
    keywords: ['ибн сина', 'авиценна', 'ibn sina', 'avicenna'],
    ru: 'Ибн Сина (Авиценна, 980–1037) — великий учёный Востока родом из Средней Азии. Внёс вклад в медицину, естествознание и химию (перегонка, получение эфирных масел). Автор «Канона врачебной науки».',
    en: 'Ibn Sina (Avicenna, 980–1037) — Central Asian scholar; medicine, distillation, natural sciences.',
  },
  {
    id: 'al-biruni',
    keywords: ['беруни', 'аль-беруни', 'biruni', 'al-biruni'],
    ru: 'Абу Райхан Беруни (973–1048) — среднеазиатский учёный-энциклопедист. Точно определял плотность (удельный вес) металлов и минералов, развивал минералогию и естественные науки.',
    en: 'Abu Rayhan al-Biruni (973–1048) — measured densities of metals and minerals; mineralogy.',
  },
  {
    id: 'jabir',
    keywords: ['джабир', 'гебер', 'jabir', 'geber'],
    ru: 'Джабир ибн Хайян (Гебер, ~721–815) — один из основоположников практической химии (алхимии). Описал перегонку, кристаллизацию, получение кислот, ввёл лабораторные методы.',
    en: 'Jabir ibn Hayyan (Geber, c.721–815) — founder of practical chemistry; distillation, crystallization, acids.',
  },
  {
    id: 'ar-razi',
    keywords: ['ар-рази', 'разес', 'razi', 'rhazes'],
    ru: 'Ар-Рази (Разес, 865–925) — учёный и врач. Систематизировал вещества, описал химическую посуду и опыты, применил химию в медицине.',
    en: 'Al-Razi (Rhazes, 865–925) — classified substances; chemical apparatus; applied chemistry in medicine.',
  },
  {
    id: 'al-kindi',
    keywords: ['аль-кинди', 'кинди', 'al-kindi', 'kindi'],
    ru: 'Аль-Кинди (801–873) — арабский философ и учёный. Один из первых критиковал алхимические заблуждения, занимался перегонкой и получением ароматических веществ.',
    en: 'Al-Kindi (801–873) — early scholar; distillation and perfumery; critiqued alchemy.',
  },
  {
    id: 'butlerov',
    keywords: ['бутлеров', 'butlerov', 'теория строения', 'строение органических'],
    ru: 'Александр Михайлович Бутлеров (1828–1886) — русский химик, создатель **теории химического строения органических веществ**: свойства зависят от порядка соединения атомов в молекуле (структуры).',
    en: 'Alexander Butlerov (1828–1886) — theory of chemical structure of organic compounds.',
  },
  {
    id: 'faraday',
    keywords: ['фарадей', 'faraday', 'электролиз'],
    ru: 'Майкл Фарадей (1791–1867) — английский учёный. Открыл законы **электролиза**, ввёл термины «ион», «электрод», «электролит».',
    en: 'Michael Faraday (1791–1867) — laws of electrolysis; terms ion, electrode, electrolyte.',
  },
  {
    id: 'thomson',
    keywords: ['томсон', 'thomson', 'электрон открыл'],
    ru: 'Джозеф Джон Томсон (1856–1940) — английский физик, открыл **электрон** (1897) и предложил модель атома «пудинг с изюмом».',
    en: 'J. J. Thomson (1856–1940) — discovered the electron; plum-pudding model.',
  },
  {
    id: 'chadwick',
    keywords: ['чедвик', 'chadwick', 'нейтрон открыл'],
    ru: 'Джеймс Чедвик (1891–1974) — английский физик, открыл **нейтрон** (1932) — незаряженную частицу ядра.',
    en: 'James Chadwick (1891–1974) — discovered the neutron (1932).',
  },
]

export const SCIENTISTS_KNOWLEDGE: ChemistryKnowledgeChunk[] = SCIENTISTS.map((s) => ({
  id: `sci-${s.id}`,
  topic: `Учёный: ${s.keywords[0]}`,
  grades: [7, 8, 9, 10, 11],
  keywords: [...s.keywords, 'учёный', 'химик', 'кто такой', 'вклад', 'открыл', 'scientist'],
  ru: s.ru,
  en: s.en,
}))
