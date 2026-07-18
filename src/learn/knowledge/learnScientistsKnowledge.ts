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
  {
    id: 'berzelius',
    keywords: ['берцелиус', 'berzelius', 'символы элементов'],
    ru: 'Йёнс Якоб Берцелиус (1779–1848) — шведский химик. Ввёл современные **буквенные символы элементов** (H, O, Fe), точно определил атомные массы многих элементов, открыл церий, селен, торий.',
    en: 'Jöns Jacob Berzelius (1779–1848) — introduced letter symbols for elements; measured atomic masses.',
  },
  {
    id: 'gaylussac',
    keywords: ['гей-люссак', 'гей люссак', 'gay-lussac', 'объёмные отношения'],
    ru: 'Жозеф Гей-Люссак (1778–1850) — французский химик и физик. Открыл **закон объёмных отношений газов** и закон теплового расширения газов (закон Гей-Люссака).',
    en: 'Joseph Gay-Lussac (1778–1850) — law of combining gas volumes; gas expansion law.',
  },
  {
    id: 'proust',
    keywords: ['пруст', 'proust', 'постоянства состава'],
    ru: 'Жозеф Пруст (1754–1826) — французский химик. Сформулировал **закон постоянства состава**: любое чистое вещество имеет постоянный качественный и количественный состав.',
    en: 'Joseph Proust (1754–1826) — law of definite proportions (constant composition).',
  },
  {
    id: 'lechatelier',
    keywords: ['ле шателье', 'ле-шателье', 'chatelier', 'принцип равновес'],
    ru: 'Анри Ле Шателье (1850–1936) — французский химик. **Принцип Ле Шателье**: если на систему в равновесии подействовать (изменить t, p, концентрацию), равновесие смещается так, чтобы ослабить это воздействие.',
    en: 'Henri Le Chatelier (1850–1936) — Le Chatelier’s principle of equilibrium shift.',
  },
  {
    id: 'pauling',
    keywords: ['полинг', 'pauling', 'электроотрицательность', 'природа связи'],
    ru: 'Лайнус Полинг (1901–1994) — американский химик. Развил теорию **химической связи** и ввёл шкалу **электроотрицательности**. Дважды лауреат Нобелевской премии.',
    en: 'Linus Pauling (1901–1994) — nature of the chemical bond; electronegativity scale.',
  },
  {
    id: 'nobel',
    keywords: ['нобель', 'nobel', 'динамит', 'нобелевская премия'],
    ru: 'Альфред Нобель (1833–1896) — шведский химик и инженер, изобрёл **динамит**. Завещал состояние на учреждение Нобелевской премии.',
    en: 'Alfred Nobel (1833–1896) — invented dynamite; founded the Nobel Prize.',
  },
  {
    id: 'zelinsky',
    keywords: ['зелинский', 'zelinsky', 'противогаз', 'угольный'],
    ru: 'Николай Дмитриевич Зелинский (1861–1953) — русский химик-органик. Изобрёл **угольный противогаз** (1915), развивал органический катализ и нефтехимию.',
    en: 'Nikolai Zelinsky (1861–1953) — invented the activated-charcoal gas mask; organic catalysis.',
  },
  {
    id: 'markovnikov',
    keywords: ['марковников', 'markovnikov', 'правило марковникова'],
    ru: 'Владимир Марковников (1838–1904) — русский химик. **Правило Марковникова**: при присоединении к несимметричному алкену водород идёт к более гидрогенизированному атому углерода.',
    en: 'Vladimir Markovnikov (1838–1904) — Markovnikov’s rule of addition to alkenes.',
  },
  {
    id: 'kekule',
    keywords: ['кекуле', 'kekule', 'бензол', 'структура бензола'],
    ru: 'Фридрих Кекуле (1829–1896) — немецкий химик. Предложил **циклическую структуру бензола** (кольцо из шести атомов углерода) и идеи о валентности углерода.',
    en: 'Friedrich Kekulé (1829–1896) — proposed the ring structure of benzene.',
  },
  {
    id: 'wohler',
    keywords: ['вёлер', 'велер', 'wohler', 'мочевина', 'синтез органики'],
    ru: 'Фридрих Вёлер (1800–1882) — немецкий химик. В 1828 году синтезировал **мочевину** из неорганических веществ, опровергнув «витализм» и открыв органический синтез.',
    en: 'Friedrich Wöhler (1800–1882) — synthesized urea, founding organic synthesis.',
  },
  {
    id: 'priestley',
    keywords: ['пристли', 'priestley', 'открыл кислород'],
    ru: 'Джозеф Пристли (1733–1804) — английский химик, один из первооткрывателей **кислорода** (1774), исследовал газы (получил «дефлогистированный воздух»).',
    en: 'Joseph Priestley (1733–1804) — co-discoverer of oxygen; studied gases.',
  },
  {
    id: 'davy',
    keywords: ['дэви', 'дэйви', 'davy', 'электролиз металлов'],
    ru: 'Гемфри Дэви (1778–1829) — английский химик. Электролизом впервые получил **натрий, калий, кальций, магний, барий**, изучал электрохимию.',
    en: 'Humphry Davy (1778–1829) — isolated Na, K, Ca, Mg, Ba by electrolysis.',
  },
  {
    id: 'bunsen',
    keywords: ['бунзен', 'bunsen', 'горелка', 'спектральный анализ'],
    ru: 'Роберт Бунзен (1811–1899) — немецкий химик. Создал **горелку Бунзена** и вместе с Кирхгофом — спектральный анализ, открыл цезий и рубидий.',
    en: 'Robert Bunsen (1811–1899) — Bunsen burner; spectral analysis; discovered Cs and Rb.',
  },
  {
    id: 'moseley',
    keywords: ['мозли', 'moseley', 'заряд ядра', 'порядковый номер'],
    ru: 'Генри Мозли (1887–1915) — английский физик. Показал, что свойства элементов определяются **зарядом ядра (порядковым номером Z)**, а не атомной массой, уточнив Периодический закон.',
    en: 'Henry Moseley (1887–1915) — properties depend on nuclear charge (atomic number Z).',
  },
  {
    id: 'butlerov2',
    keywords: ['зинин', 'zinin', 'анилин'],
    ru: 'Николай Зинин (1812–1880) — русский химик-органик. Разработал **реакцию восстановления** нитробензола в анилин — основу анилинокрасочной промышленности.',
    en: 'Nikolai Zinin (1812–1880) — reduction of nitrobenzene to aniline (Zinin reaction).',
  },
  {
    id: 'berthollet',
    keywords: ['бертолле', 'berthollet', 'бертоллетова соль'],
    ru: 'Клод Бертолле (1748–1822) — французский химик. Исследовал влияние массы веществ на реакции; его именем названа бертоллетова соль KClO₃.',
    en: 'Claude Berthollet (1748–1822) — studied reaction affinity; KClO₃ is named after him.',
  },
  {
    id: 'kurchatov',
    keywords: ['курчатов', 'kurchatov', 'атомная'],
    ru: 'Игорь Курчатов (1903–1960) — советский физик, руководитель атомного проекта, исследователь ядерных реакций и деления ядер. Элемент №104 назван курчатовием.',
    en: 'Igor Kurchatov (1903–1960) — nuclear physicist; led the Soviet atomic project.',
  },
]

const DISPLAY_NAME: Record<string, string> = {
  mendeleev: 'Д. И. Менделеев',
  lavoisier: 'Антуан Лавуазье',
  lomonosov: 'М. В. Ломоносов',
  dalton: 'Джон Дальтон',
  avogadro: 'Амедео Авогадро',
  rutherford: 'Эрнест Резерфорд',
  bohr: 'Нильс Бор',
  curie: 'Мария Кюри',
  boyle: 'Роберт Бойль',
  arrhenius: 'Сванте Аррениус',
  'ibn-sina': 'Ибн Сина (Авиценна)',
  'al-biruni': 'Абу Райхан Беруни',
  jabir: 'Джабир ибн Хайян',
  'ar-razi': 'Ар-Рази',
  'al-kindi': 'Аль-Кинди',
  butlerov: 'А. М. Бутлеров',
  faraday: 'Майкл Фарадей',
  thomson: 'Дж. Дж. Томсон',
  chadwick: 'Джеймс Чедвик',
  berzelius: 'Йёнс Якоб Берцелиус',
  gaylussac: 'Жозеф Гей-Люссак',
  proust: 'Жозеф Пруст',
  lechatelier: 'Анри Ле Шателье',
  pauling: 'Лайнус Полинг',
  nobel: 'Альфред Нобель',
  zelinsky: 'Н. Д. Зелинский',
  markovnikov: 'Владимир Марковников',
  kekule: 'Фридрих Кекуле',
  wohler: 'Фридрих Вёлер',
  priestley: 'Джозеф Пристли',
  davy: 'Гемфри Дэви',
  bunsen: 'Роберт Бунзен',
  moseley: 'Генри Мозли',
  butlerov2: 'Николай Зинин',
  berthollet: 'Клод Бертолле',
  kurchatov: 'Игорь Курчатов',
}

export const SCIENTISTS_KNOWLEDGE: ChemistryKnowledgeChunk[] = SCIENTISTS.map((s) => ({
  id: `sci-${s.id}`,
  topic: DISPLAY_NAME[s.id] ?? `Учёный: ${s.keywords[0]}`,
  grades: [7, 8, 9, 10, 11],
  keywords: [...s.keywords, 'учёный', 'химик', 'кто такой', 'вклад', 'открыл', 'scientist'],
  ru: s.ru,
  en: s.en,
}))
