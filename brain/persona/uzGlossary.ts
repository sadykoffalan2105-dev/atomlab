/**
 * Узбекско-русско-английский словарь школьных терминов (учебник Kimyo 7–11 и понятия brain/kb/concepts.ts).
 * Зачем: учебники в базе русские, поэтому тема самодостаточного вопроса (StandaloneQuery.topic) всегда по-русски —
 * «valentlik nima?» → тема «валентность», и поиск SOURCES ищет по русскому учебнику.
 * Узбекский — латиницей с oʻ/gʻ (ʻ — U+02BB); при сравнении апострофы нормализуются.
 */

/**
 * forms — русские словоформы термина, как он напечатан в определении учебника («называется винильным радикалом»), когда
 * их стемы не совпадают со стемами именительного падежа (Snowball: «радикал» → «радика», «радикалом» → «радикал»):
 * по ним карта программы (scripts/brain/build-curriculum-map.mts) находит узбекский/английский термин определения.
 */
export type GlossaryPair = { uz: string; ru: string; en: string; forms?: string[] }

export const UZ_GLOSSARY: GlossaryPair[] = [
  // вещество и его виды
  { uz: 'modda', ru: 'вещество', en: 'substance' },
  { uz: 'oddiy modda', ru: 'простое вещество', en: 'simple substance' },
  { uz: 'murakkab modda', ru: 'сложное вещество', en: 'compound' },
  { uz: 'toza modda', ru: 'чистое вещество', en: 'pure substance' },
  { uz: 'aralashma', ru: 'смесь', en: 'mixture' },
  { uz: 'eritma', ru: 'раствор', en: 'solution' },
  { uz: 'erituvchi', ru: 'растворитель', en: 'solvent' },
  { uz: 'eruvchanlik', ru: 'растворимость', en: 'solubility' },
  { uz: 'toʻyingan eritma', ru: 'насыщенный раствор', en: 'saturated solution' },
  { uz: 'massa ulushi', ru: 'массовая доля', en: 'mass fraction' },
  { uz: 'konsentratsiya', ru: 'концентрация', en: 'concentration' },
  // классы неорганических веществ
  { uz: 'kislota', ru: 'кислота', en: 'acid' },
  { uz: 'asos', ru: 'основание', en: 'base' },
  { uz: 'ishqor', ru: 'щёлочь', en: 'alkali' },
  { uz: 'tuz', ru: 'соль', en: 'salt' },
  { uz: 'oksid', ru: 'оксид', en: 'oxide' },
  { uz: 'asosli oksid', ru: 'основный оксид', en: 'basic oxide' },
  { uz: 'kislotali oksid', ru: 'кислотный оксид', en: 'acidic oxide' },
  { uz: 'amfoter', ru: 'амфотерность', en: 'amphoterism' },
  { uz: 'gidroksid', ru: 'гидроксид', en: 'hydroxide' },
  { uz: 'metall', ru: 'металл', en: 'metal' },
  { uz: 'metallmas', ru: 'неметалл', en: 'non-metal' },
  { uz: 'galogen', ru: 'галоген', en: 'halogen' },
  { uz: 'inert gaz', ru: 'благородный газ', en: 'noble gas' },
  // строение вещества
  { uz: 'atom', ru: 'атом', en: 'atom' },
  { uz: 'molekula', ru: 'молекула', en: 'molecule' },
  { uz: 'ion', ru: 'ион', en: 'ion' },
  { uz: 'kation', ru: 'катион', en: 'cation' },
  { uz: 'anion', ru: 'анион', en: 'anion' },
  { uz: 'yadro', ru: 'ядро атома', en: 'nucleus' },
  { uz: 'proton', ru: 'протон', en: 'proton' },
  { uz: 'neytron', ru: 'нейтрон', en: 'neutron' },
  { uz: 'elektron', ru: 'электрон', en: 'electron' },
  { uz: 'elektron qavat', ru: 'электронный слой', en: 'electron shell' },
  { uz: 'elektron konfiguratsiya', ru: 'электронная конфигурация', en: 'electron configuration' },
  { uz: 'orbital', ru: 'орбиталь', en: 'orbital' },
  { uz: 'izotop', ru: 'изотопы', en: 'isotopes' },
  { uz: 'kimyoviy element', ru: 'химический элемент', en: 'chemical element' },
  { uz: 'element', ru: 'химический элемент', en: 'element' },
  { uz: 'tartib raqami', ru: 'порядковый номер', en: 'atomic number' },
  { uz: 'nisbiy atom massa', ru: 'относительная атомная масса', en: 'relative atomic mass' },
  // периодический закон
  { uz: 'davriy qonun', ru: 'периодический закон', en: 'periodic law' },
  { uz: 'davriy jadval', ru: 'периодическая система', en: 'periodic table' },
  { uz: 'davr', ru: 'период', en: 'period' },
  { uz: 'guruh', ru: 'группа', en: 'group' },
  { uz: 'elektromanfiylik', ru: 'электроотрицательность', en: 'electronegativity' },
  // валентность, степень окисления, количество вещества
  { uz: 'valentlik', ru: 'валентность', en: 'valence' },
  { uz: 'oksidlanish darajasi', ru: 'степень окисления', en: 'oxidation state' },
  { uz: 'molyar massa', ru: 'молярная масса', en: 'molar mass' },
  { uz: 'molekulyar massa', ru: 'молекулярная масса', en: 'molecular mass' },
  { uz: 'modda miqdori', ru: 'количество вещества', en: 'amount of substance' },
  { uz: 'mol', ru: 'моль', en: 'mole' },
  { uz: 'avogadro soni', ru: 'число Авогадро', en: 'Avogadro number' },
  { uz: 'avogadro qonuni', ru: 'закон Авогадро', en: "Avogadro's law" },
  { uz: 'molyar hajm', ru: 'молярный объём', en: 'molar volume', forms: ['молярным объёмом'] },
  { uz: 'massaning saqlanish qonuni', ru: 'закон сохранения массы', en: 'law of conservation of mass' },
  { uz: 'tarkibning doimiylik qonuni', ru: 'закон постоянства состава', en: 'law of definite proportions' },
  // химическая связь
  { uz: 'kimyoviy bogʻ', ru: 'химическая связь', en: 'chemical bond' },
  { uz: 'kovalent bogʻ', ru: 'ковалентная связь', en: 'covalent bond' },
  { uz: 'kovalent qutbli', ru: 'ковалентная полярная связь', en: 'polar covalent bond' },
  { uz: 'kovalent qutbsiz', ru: 'ковалентная неполярная связь', en: 'non-polar covalent bond' },
  { uz: 'ion bogʻ', ru: 'ионная связь', en: 'ionic bond' },
  { uz: 'ionli bogʻ', ru: 'ионная связь', en: 'ionic bond' },
  { uz: 'metall bogʻ', ru: 'металлическая связь', en: 'metallic bond' },
  { uz: 'vodorod bogʻ', ru: 'водородная связь', en: 'hydrogen bond' },
  { uz: 'kristall panjara', ru: 'кристаллическая решётка', en: 'crystal lattice' },
  { uz: 'allotropiya', ru: 'аллотропия', en: 'allotropy' },
  { uz: 'gibridlanish', ru: 'гибридизация', en: 'hybridization' },
  // реакции
  { uz: 'kimyoviy reaksiya', ru: 'химическая реакция', en: 'chemical reaction' },
  { uz: 'reaksiya belgilari', ru: 'признаки реакции', en: 'signs of a reaction' },
  { uz: 'reaksiya turlari', ru: 'типы реакций', en: 'types of reactions' },
  { uz: 'birikish', ru: 'реакция соединения', en: 'combination reaction' },
  { uz: 'parchalanish', ru: 'реакция разложения', en: 'decomposition reaction' },
  { uz: 'oʻrin olish', ru: 'реакция замещения', en: 'substitution reaction' },
  { uz: 'almashinish', ru: 'реакция обмена', en: 'exchange reaction' },
  { uz: 'ekzotermik', ru: 'экзотермическая реакция', en: 'exothermic reaction' },
  { uz: 'endotermik', ru: 'эндотермическая реакция', en: 'endothermic reaction' },
  { uz: 'issiqlik effekti', ru: 'тепловой эффект', en: 'heat effect' },
  { uz: 'katalizator', ru: 'катализатор', en: 'catalyst' },
  { uz: 'reaksiya tezligi', ru: 'скорость реакции', en: 'reaction rate' },
  { uz: 'kimyoviy muvozanat', ru: 'химическое равновесие', en: 'chemical equilibrium' },
  { uz: 'oksidlanish-qaytarilish', ru: 'окислительно-восстановительные реакции', en: 'redox reactions' },
  { uz: 'oksidlovchi', ru: 'окислитель', en: 'oxidizing agent' },
  { uz: 'qaytaruvchi', ru: 'восстановитель', en: 'reducing agent' },
  { uz: 'oksidlanish', ru: 'окисление', en: 'oxidation' },
  { uz: 'qaytarilish', ru: 'восстановление', en: 'reduction' },
  { uz: 'elektron balans', ru: 'электронный баланс', en: 'electron balance' },
  // растворы и электролиты
  { uz: 'gidroliz', ru: 'гидролиз', en: 'hydrolysis' },
  { uz: 'elektroliz', ru: 'электролиз', en: 'electrolysis' },
  { uz: 'dissotsilanish', ru: 'электролитическая диссоциация', en: 'electrolytic dissociation' },
  { uz: 'elektrolit', ru: 'электролит', en: 'electrolyte', forms: ['электролитами'] },
  { uz: 'indikator', ru: 'индикатор', en: 'indicator' },
  { uz: 'lakmus', ru: 'лакмус', en: 'litmus' },
  { uz: 'fenolftalein', ru: 'фенолфталеин', en: 'phenolphthalein' },
  { uz: 'metiloranj', ru: 'метилоранж', en: 'methyl orange' },
  { uz: 'vodorod koʻrsatkich', ru: 'водородный показатель', en: 'pH' },
  { uz: 'neytrallanish', ru: 'реакция нейтрализации', en: 'neutralization' },
  { uz: 'choʻkma', ru: 'осадок', en: 'precipitate' },
  { uz: 'gaz ajralishi', ru: 'выделение газа', en: 'gas evolution' },
  // запись реакций
  { uz: 'tenglama', ru: 'уравнение реакции', en: 'equation' },
  { uz: 'koeffitsiyent', ru: 'коэффициент', en: 'coefficient' },
  { uz: 'koeffitsient', ru: 'коэффициент', en: 'coefficient' },
  { uz: 'indeks', ru: 'индекс', en: 'subscript' },
  { uz: 'kimyoviy formula', ru: 'химическая формула', en: 'chemical formula' },
  // вещества-«герои» школьного курса
  { uz: 'vodorod', ru: 'водород', en: 'hydrogen' },
  { uz: 'kislorod', ru: 'кислород', en: 'oxygen' },
  { uz: 'azot', ru: 'азот', en: 'nitrogen' },
  { uz: 'uglerod', ru: 'углерод', en: 'carbon' },
  { uz: 'oltingugurt', ru: 'сера', en: 'sulfur' },
  { uz: 'fosfor', ru: 'фосфор', en: 'phosphorus' },
  { uz: 'xlor', ru: 'хлор', en: 'chlorine' },
  { uz: 'natriy', ru: 'натрий', en: 'sodium' },
  { uz: 'kaliy', ru: 'калий', en: 'potassium' },
  { uz: 'kalsiy', ru: 'кальций', en: 'calcium' },
  { uz: 'temir', ru: 'железо', en: 'iron' },
  { uz: 'mis', ru: 'медь', en: 'copper' },
  { uz: 'alyuminiy', ru: 'алюминий', en: 'aluminium' },
  { uz: 'suv', ru: 'вода', en: 'water' },
  { uz: 'ozon', ru: 'озон', en: 'ozone' },
  { uz: 'ammiak', ru: 'аммиак', en: 'ammonia' },
  // органика (10–11 класс)
  { uz: 'organik birikma', ru: 'органическое вещество', en: 'organic compound' },
  { uz: 'uglevodorod', ru: 'углеводороды', en: 'hydrocarbons' },
  { uz: 'alkan', ru: 'алканы', en: 'alkanes' },
  { uz: 'alken', ru: 'алкены', en: 'alkenes' },
  { uz: 'alkin', ru: 'алкины', en: 'alkynes' },
  { uz: 'spirt', ru: 'спирты', en: 'alcohols' },
  { uz: 'izomeriya', ru: 'изомерия', en: 'isomerism' },
  { uz: 'polimer', ru: 'полимеры', en: 'polymers' },
  { uz: 'oqsil', ru: 'белки', en: 'proteins' },
  { uz: 'uglevod', ru: 'углеводы', en: 'carbohydrates' },
  { uz: 'funksional guruh', ru: 'функциональная группа', en: 'functional group' },
  { uz: 'gomolog', ru: 'гомологи', en: 'homologues' },
  { uz: 'etilenglikol', ru: 'этиленгликоль', en: 'ethylene glycol' },
  { uz: 'chumoli kislota', ru: 'муравьиная кислота', en: 'formic acid' },
  { uz: 'sirka kislota', ru: 'уксусная кислота', en: 'acetic acid' },
  // термины программы 7–11, которых не хватало для поиска § по uz/en-вопросу «… nima?» (аудит покрытия 12.10)
  { uz: 'kimyo', ru: 'химия', en: 'chemistry' },
  { uz: 'yonish', ru: 'горение', en: 'combustion' },
  { uz: 'osh tuzi', ru: 'поваренная соль', en: 'table salt' },
  { uz: 'xlorid kislota', ru: 'соляная кислота', en: 'hydrochloric acid' },
  { uz: 'fosfor kislota', ru: 'фосфорная кислота', en: 'phosphoric acid' },
  { uz: 'karbonat kislota', ru: 'угольная кислота', en: 'carbonic acid' },
  { uz: 'ishqoriy metall', ru: 'щелочные металлы', en: 'alkali metals' },
  { uz: 'ishqoriy-yer metall', ru: 'щелочноземельные металлы', en: 'alkaline earth metals' },
  { uz: 'metallurgiya', ru: 'металлургия', en: 'metallurgy' },
  { uz: 'ideal gaz', ru: 'идеальный газ', en: 'ideal gas' },
  { uz: 'molyar konsentratsiya', ru: 'молярная концентрация', en: 'molar concentration' },
  { uz: 'ftor', ru: 'фтор', en: 'fluorine' },
  { uz: 'kremniy', ru: 'кремний', en: 'silicon' },
  // термины определений Kimyo 7–11, которых не было в словаре (аудит вопросов-определений 12.10): без них
  // «Kondensatsiya deb nimaga aytiladi?» не находил § и уходил в ответ «от основ»
  { uz: 'kondensatsiya', ru: 'конденсация', en: 'condensation' },
  { uz: 'fizik hodisa', ru: 'физические явления', en: 'physical phenomena' },
  { uz: 'kimyoviy hodisa', ru: 'химические явления', en: 'chemical phenomena' },
  { uz: 'fizik xossa', ru: 'физические свойства', en: 'physical properties' },
  { uz: 'kimyoviy xossa', ru: 'химические свойства', en: 'chemical properties' },
  { uz: 'kimyoviy belgi', ru: 'химический знак', en: 'chemical symbol' },
  { uz: 'izobar', ru: 'изобары', en: 'isobars' },
  { uz: 'izoton', ru: 'изотоны', en: 'isotones' },
  { uz: 'zichlik', ru: 'плотность', en: 'density' },
  { uz: 'shtativ', ru: 'штатив', en: 'stand' },
  { uz: 'erigan modda', ru: 'растворённое вещество', en: 'solute' },
  { uz: 'normal konsentratsiya', ru: 'нормальная концентрация', en: 'normal concentration' },
  { uz: 'aktivlanish energiyasi', ru: 'энергия активации', en: 'activation energy' },
  { uz: 'ingibitor', ru: 'ингибитор', en: 'inhibitor' },
  { uz: 'adsorbsiya', ru: 'адсорбция', en: 'adsorption' },
  { uz: 'katod', ru: 'катод', en: 'cathode' },
  { uz: 'korroziya', ru: 'коррозия', en: 'corrosion' },
  { uz: 'qotishma', ru: 'сплав', en: 'alloy' },
  { uz: 'choʻyan', ru: 'чугун', en: 'cast iron' },
  { uz: 'poʻlat', ru: 'сталь', en: 'steel' },
  { uz: 'shisha', ru: 'стекло', en: 'glass' },
  { uz: 'tellur', ru: 'теллур', en: 'tellurium' },
  { uz: 'marganets', ru: 'марганец', en: 'manganese' },
  { uz: 'alyuminiy oksidi', ru: 'оксид алюминия', en: 'aluminium oxide' },
  { uz: 'alyuminiy gidroksidi', ru: 'гидроксид алюминия', en: 'aluminium hydroxide' },
  { uz: 'kumush nitrat', ru: 'нитрат серебра', en: 'silver nitrate' },
  { uz: 'natriy xlorid', ru: 'хлорид натрия', en: 'sodium chloride' },
  { uz: 'neft', ru: 'нефть', en: 'petroleum' },
  { uz: 'tabiiy gaz', ru: 'природный газ', en: 'natural gas' },
  { uz: 'toshkoʻmir', ru: 'каменный уголь', en: 'coal' },
  { uz: 'kauchuk', ru: 'каучук', en: 'rubber' },
  { uz: 'arenlar', ru: 'арены', en: 'arenes' },
  { uz: 'stirol', ru: 'стирол', en: 'styrene' },
  { uz: 'glitserin', ru: 'глицерин', en: 'glycerol' },
  { uz: 'fenol', ru: 'фенол', en: 'phenol' },
  { uz: 'aldegid', ru: 'альдегиды', en: 'aldehydes' },
  { uz: 'karbon kislota', ru: 'карбоновые кислоты', en: 'carboxylic acids' },
  // термины определений карты Kimyo 7–11 (definitions[].term), у которых не было узбекского названия (nextBuild #3,
  // 12.10): карта переводит термин по стемам (scripts/brain/build-curriculum-map.mts → translate), поэтому «Синтезом»
  // находит «синтез»; вопрос «Sintez nima?» мозг сводит к тому же определению § (brain/curriculum/answer.ts).
  // Обрывки предложений («Итак, ядро», «Например, …») и одни прилагательные («Сложными», «Малыми») — не термины, без перевода.
  // 7 класс
  { uz: 'jism', ru: 'тело', en: 'body' },
  { uz: 'kuzatish', ru: 'наблюдение', en: 'observation' },
  { uz: 'xavfsizlik qoidalari', ru: 'правила безопасности', en: 'safety rules' },
  { uz: 'probirkalar shtativi', ru: 'штатив для пробирок', en: 'test tube rack' },
  { uz: 'filtrat', ru: 'фильтрат', en: 'filtrate' },
  { uz: 'filtrlash', ru: 'фильтрация', en: 'filtration' },
  { uz: 'sublimatsiya', ru: 'сублимация', en: 'sublimation' },
  { uz: 'holat oʻzgarishi', ru: 'изменение состояния', en: 'change of state' },
  { uz: 'dogʻlarni ketkazish', ru: 'выведение пятен', en: 'stain removal' },
  { uz: 'temir mixlarning zanglashi', ru: 'ржавчина железных гвоздей', en: 'rusting of iron nails' },
  { uz: 'gipoteza', ru: 'гипотеза', en: 'hypothesis' },
  { uz: 'elementning nisbiy atom massasi', ru: 'относительная атомная масса элемента', en: 'relative atomic mass of an element' },
  { uz: 'atom raqami', ru: 'атомный номер', en: 'atomic number' },
  { uz: 'deyteriy', ru: 'дейтерий', en: 'deuterium' },
  { uz: 'moddaning nisbiy molekulyar massasi', ru: 'относительная молекулярная масса вещества', en: 'relative molecular mass of a substance' },
  { uz: 'analiz', ru: 'анализ', en: 'analysis' },
  { uz: 'sintez', ru: 'синтез', en: 'synthesis' },
  { uz: 'binar birikmalar', ru: 'бинарные соединения', en: 'binary compounds' },
  { uz: 'kimyoviy elementlar oilasi', ru: 'семейство химических элементов', en: 'family of chemical elements' },
  { uz: 'tabiiy oilalar', ru: 'природные семейства', en: 'natural families' },
  { uz: 'elementlar oilasi', ru: 'семейство элементов', en: 'family of elements' },
  { uz: 'kichik davrlar', ru: 'малые периоды', en: 'short periods' },
  { uz: 'katta davrlar', ru: 'большие периоды', en: 'long periods' },
  { uz: 'atmosfera', ru: 'атмосфера', en: 'atmosphere' },
  { uz: 'katalitik reaksiyalar', ru: 'каталитические реакции', en: 'catalytic reactions' },
  { uz: 'sekin oksidlanish', ru: 'медленное окисление', en: 'slow oxidation' },
  { uz: 'oʻz-oʻzidan alangalanish', ru: 'самовозгорание', en: 'spontaneous combustion' },
  { uz: 'yongʻin', ru: 'пожар', en: 'fire' },
  { uz: 'alanga', ru: 'пламя', en: 'flame' },
  { uz: 'qaldiroq gaz', ru: 'гремучий газ', en: 'detonating gas' },
  { uz: 'organik kislotalar', ru: 'органические кислоты', en: 'organic acids' },
  { uz: 'tabiatda suvning aylanishi', ru: 'круговорот воды в природе', en: 'water cycle' },
  { uz: 'gidrologik aylanish', ru: 'гидрологический круговорот', en: 'hydrological cycle' },
  { uz: 'gidratlar', ru: 'гидраты', en: 'hydrates' },
  { uz: 'kristallogidrat', ru: 'кристаллогидрат', en: 'crystal hydrate' },
  { uz: 'suvni maxsus ishlash', ru: 'специальная обработка воды', en: 'special water treatment' },
  { uz: 'biogen elementlar', ru: 'биогенные элементы', en: 'biogenic elements' },
  { uz: 'gipovitaminoz', ru: 'гиповитаминоз', en: 'hypovitaminosis' },
  { uz: 'avitaminoz', ru: 'авитаминоз', en: 'avitaminosis' },
  { uz: 'makroelementlar', ru: 'макроэлементы', en: 'macroelements' },
  { uz: 'mikroelementlar', ru: 'микроэлементы', en: 'microelements' },
  { uz: 'minerallar', ru: 'минералы', en: 'minerals' },
  { uz: 'geokimyo', ru: 'геохимия', en: 'geochemistry' },
  { uz: 'litosfera', ru: 'литосфера', en: 'lithosphere' },
  { uz: 'mineral xomashyo', ru: 'минеральное сырьё', en: 'mineral raw materials' },
  { uz: 'ekologik jihatlar', ru: 'экологические аспекты', en: 'ecological aspects' },
  // 8 класс
  { uz: 'galogenlarning suvdagi eritmalari', ru: 'водные растворы галогенов', en: 'aqueous solutions of halogens' },
  { uz: 'kimyoviy elementlar davriy qonuni', ru: 'периодический закон химических элементов', en: 'periodic law of chemical elements' },
  { uz: 'p-elektronlar', ru: 'p электроны', en: 'p-electrons' },
  { uz: 's-orbital', ru: 's орбиталь', en: 's-orbital' },
  { uz: 'donor', ru: 'донор', en: 'donor' },
  { uz: 'ion birikmalar', ru: 'ионные соединения', en: 'ionic compounds' },
  { uz: 'vodorod xlorid', ru: 'хлорид водорода', en: 'hydrogen chloride' },
  { uz: 'ekvivalent massa', ru: 'эквивалентная масса', en: 'equivalent mass' },
  { uz: 'ekvivalent hajm', ru: 'эквивалентный объём', en: 'equivalent volume' },
  { uz: 'xloridlar', ru: 'хлориды', en: 'chlorides' },
  { uz: 'bromli suv', ru: 'бромная вода', en: 'bromine water' },
  { uz: 'flotatsiya', ru: 'флотация', en: 'flotation' },
  { uz: 'sulfid kislota', ru: 'сероводородная кислота', en: 'hydrosulfuric acid' },
  { uz: 'glauber tuzi', ru: 'глауберова соль', en: 'Glauber salt' },
  { uz: 'qaynar qatlam', ru: 'кипящий слой', en: 'fluidized bed' },
  { uz: 'chili selitrasi', ru: 'чилийская селитра', en: 'Chile saltpetre' },
  { uz: 'nitridlar', ru: 'нитриды', en: 'nitrides' },
  { uz: 'ammoniy tuzlari', ru: 'соли аммония', en: 'ammonium salts' },
  { uz: 'zar suvi', ru: 'царская водка', en: 'aqua regia' },
  { uz: 'nitratlar', ru: 'нитраты', en: 'nitrates' },
  { uz: 'fosforitlar', ru: 'фосфориты', en: 'phosphorites' },
  { uz: 'apatitlar', ru: 'апатиты', en: 'apatites' },
  { uz: 'oq fosfor', ru: 'белый фосфор', en: 'white phosphorus' },
  { uz: 'tuproq', ru: 'почва', en: 'soil' },
  { uz: 'ammofos', ru: 'аммофос', en: 'ammophos' },
  { uz: 'makrobiogen elementlar', ru: 'макробиогенные элементы', en: 'macrobiogenic elements' },
  { uz: 'mikrobiogen elementlar', ru: 'микробиогенные элементы', en: 'microbiogenic elements' },
  // 9 класс
  { uz: 'bogʻ uzunligi', ru: 'длина связи', en: 'bond length' },
  { uz: 'elektrolitik dissotsilanish darajasi', ru: 'степень электролитической диссоциации', en: 'degree of electrolytic dissociation' },
  { uz: 'kuchsiz elektrolitlar', ru: 'слабые электролиты', en: 'weak electrolytes' },
  { uz: 'sorbsiya', ru: 'сорбция', en: 'sorption' },
  { uz: 'togʻ billuri', ru: 'горный хрусталь', en: 'rock crystal' },
  { uz: 'suyuq shisha', ru: 'жидкое стекло', en: 'water glass' },
  { uz: 'temirbeton', ru: 'железобетон', en: 'reinforced concrete' },
  { uz: 'qora metallar', ru: 'чёрные металлы', en: 'ferrous metals' },
  { uz: 'rangli metallar', ru: 'цветные металлы', en: 'non-ferrous metals' },
  { uz: 'geterogen qotishmalar', ru: 'гетерогенные сплавы', en: 'heterogeneous alloys' },
  { uz: 'bolgʻalanuvchanlik', ru: 'ковкость', en: 'malleability' },
  { uz: 'eriydigan anodlar', ru: 'растворимые аноды', en: 'soluble anodes' },
  { uz: 'ichimlik sodasi', ru: 'пищевая сода', en: 'baking soda' },
  { uz: 'ohakli suv', ru: 'известковая вода', en: 'limewater' },
  { uz: 'alebastr', ru: 'алебастр', en: 'alabaster' },
  { uz: 'qattiq suv', ru: 'жёсткая вода', en: 'hard water' },
  { uz: 'yumshoq suv', ru: 'мягкая вода', en: 'soft water' },
  { uz: 'amalgama', ru: 'амальгама', en: 'amalgam' },
  { uz: 'alyuminotermiya', ru: 'алюминотермия', en: 'aluminothermy' },
  { uz: 'zanglamaydigan poʻlat', ru: 'нержавеющая сталь', en: 'stainless steel' },
  // 10 класс (органика)
  { uz: 'kimyoviy tuzilish', ru: 'химическая структура', en: 'chemical structure' },
  { uz: 'uglerod skeleti', ru: 'углеродный скелет', en: 'carbon skeleton' },
  { uz: 'yoyilgan formulalar', ru: 'развёрнутые формулы', en: 'expanded formulas' },
  { uz: 'konformatsiyalar', ru: 'конформации', en: 'conformations' },
  { uz: 'substrat', ru: 'субстрат', en: 'substrate' },
  { uz: 'polikondensatsiya reaksiyasi', ru: 'реакция поликонденсации', en: 'polycondensation reaction' },
  { uz: 'kimyoviy nomenklatura', ru: 'химическая номенклатура', en: 'chemical nomenclature' },
  { uz: 'siklik birikmalar', ru: 'циклические соединения', en: 'cyclic compounds' },
  { uz: 'radikallar', ru: 'радикалы', en: 'radicals' },
  { uz: 'izobirikmalar', ru: 'изосоединения', en: 'iso compounds' },
  { uz: 'vinil radikali', ru: 'винильный радикал', en: 'vinyl radical', forms: ['винильным радикалом'] },
  { uz: 'izolyatsiyalangan diyenlar', ru: 'изолированные диены', en: 'isolated dienes', forms: ['изолированными диенами'] },
  { uz: 'butadiyen', ru: 'бутадиен', en: 'butadiene', forms: ['бутадиеном'] },
  { uz: 'divinil', ru: 'дивинил', en: 'divinyl', forms: ['дивинилом'] },
  { uz: 'alkinlarga sifat reaksiyasi', ru: 'качественная реакция на алкины', en: 'qualitative test for alkynes' },
  { uz: 'bir yadroli arenlar', ru: 'одноядерные арены', en: 'mononuclear arenes' },
  { uz: 'odorizatsiya', ru: 'одоризация', en: 'odorization' },
  { uz: 'yashil yoqilgʻi', ru: 'зелёное топливо', en: 'green fuel' },
  { uz: 'detonatsiya', ru: 'детонация', en: 'detonation' },
  { uz: 'kokslash', ru: 'коксование', en: 'coking' },
  { uz: 'yodoform sinamasi', ru: 'йодоформная проба', en: 'iodoform test' },
  { uz: 'glikollar', ru: 'гликоли', en: 'glycols' },
  { uz: 'koʻp atomli spirtlar', ru: 'многоатомные спирты', en: 'polyhydric alcohols' },
  { uz: 'bir atomli aromatik spirtlar', ru: 'одноатомные ароматические спирты', en: 'monohydric aromatic alcohols' },
  { uz: 'fenil radikali', ru: 'фенильный радикал', en: 'phenyl radical', forms: ['фенильным радикалом'] },
  { uz: 'fenilmetanol', ru: 'фенилметанол', en: 'phenylmethanol' },
  { uz: 'simmetrik oddiy efirlar', ru: 'симметричные простые эфиры', en: 'symmetrical ethers' },
  { uz: 'aralash efirlar', ru: 'смешанные эфиры', en: 'mixed ethers' },
  { uz: 'okson birikmalar', ru: 'оксонные соединения', en: 'oxonium compounds' },
  { uz: 'oksobirikmalar', ru: 'оксосоединения', en: 'oxo compounds' },
  { uz: 'eterifikatsiya reaksiyasi', ru: 'реакция этерификации', en: 'esterification reaction' },
  { uz: 'tabiiy yogʻlar', ru: 'природные жиры', en: 'natural fats' },
  { uz: 'moy', ru: 'масло', en: 'oil' },
  { uz: 'triatsilglitserinlar', ru: 'триацилглицерины', en: 'triacylglycerols' },
  { uz: 'murakkab uglevodlar', ru: 'сложные углеводы', en: 'complex carbohydrates' },
  { uz: 'polisaxaridlar', ru: 'полисахариды', en: 'polysaccharides' },
  { uz: 'poliozalar', ru: 'полиозы', en: 'polyoses' },
  { uz: 'invert shakar', ru: 'инвертный сахар', en: 'invert sugar' },
  { uz: 'xom shakar', ru: 'сахар-сырец', en: 'raw sugar', forms: ['сахаром-сырцом'] },
  { uz: 'rafinadlangan shakar', ru: 'рафинированный сахар', en: 'refined sugar' },
  { uz: 'uzum shakari', ru: 'виноградный сахар', en: 'grape sugar' },
  { uz: 'tabiiy tolalar', ru: 'натуральные волокна', en: 'natural fibres' },
  { uz: 'ipak', ru: 'шёлк', en: 'silk' },
  { uz: 'insektitsidlar', ru: 'инсектициды', en: 'insecticides' },
  { uz: 'fungitsidlar', ru: 'фунгициды', en: 'fungicides' },
  { uz: 'chiqindilarni utilizatsiya qilish', ru: 'утилизация отходов', en: 'waste disposal' },
  { uz: 'mexanik ishlov berish', ru: 'механическая обработка', en: 'mechanical processing' },
  { uz: 'qogʻoz massasi', ru: 'бумажная масса', en: 'paper pulp' },
  // 11 класс
  { uz: 'atomning planetar modeli', ru: 'планетарная модель атома', en: 'planetary model of the atom' },
  { uz: 'atom orbitali', ru: 'атомная орбиталь', en: 'atomic orbital' },
  { uz: 'bogʻ energiyasi', ru: 'энергия связи', en: 'bond energy' },
  { uz: 'kimyoviy bogʻlar orasidagi burchak', ru: 'угол между химическими связями', en: 'angle between chemical bonds' },
  { uz: 'gazlarning molyar hajmi', ru: 'молярный объём газов', en: 'molar volume of gases', forms: ['молярным объёмом газов'] },
  { uz: 'assotsiatsiya', ru: 'ассоциация', en: 'association' },
  { uz: 'eruvchanlik koeffitsiyenti', ru: 'коэффициент растворимости', en: 'solubility coefficient' },
  { uz: 'reaksiyaning oʻrtacha tezligi', ru: 'средняя скорость реакции', en: 'average reaction rate' },
  { uz: 'toʻgʻri reaksiya', ru: 'прямая реакция', en: 'forward reaction' },
  { uz: 'harorat koeffitsiyenti', ru: 'температурный коэффициент', en: 'temperature coefficient' },
  { uz: 'kimyoviy muvozanatning siljishi', ru: 'смещение химического равновесия', en: 'shift of chemical equilibrium' },
  { uz: 'suyuqlanmalar elektrolizi', ru: 'электролиз расплавов', en: 'electrolysis of melts' },
  // неверные переводы терминов карты из глоссария базы (kb-glossary: «Ацетилен» → «Alkinlar», «Кетонами» → «Aldegidlar»,
  // «Крахмал» → «Uglevodlar»): этот словарь читается картой первым, так что точный перевод здесь их перекрывает
  { uz: 'bugʻlatish', ru: 'выпаривание', en: 'evaporation' },
  { uz: 'metan', ru: 'метан', en: 'methane' },
  { uz: 'etilen', ru: 'этилен', en: 'ethylene' },
  { uz: 'atsetilen', ru: 'ацетилен', en: 'acetylene' },
  { uz: 'benzol', ru: 'бензол', en: 'benzene' },
  { uz: 'kraxmal', ru: 'крахмал', en: 'starch' },
  { uz: 'kreking', ru: 'крекинг', en: 'cracking' },
  { uz: 'polimerlanish', ru: 'полимеризация', en: 'polymerization' },
  { uz: 'ketonlar', ru: 'кетоны', en: 'ketones' },
  { uz: 'toʻyingan uglevodorodlar', ru: 'предельные углеводороды', en: 'saturated hydrocarbons' },
  { uz: 'gomologik qator', ru: 'гомологический ряд', en: 'homologous series' },
  { uz: 'yadro reaksiyalari', ru: 'ядерные реакции', en: 'nuclear reactions' },
  { uz: 'fermentlar', ru: 'ферменты', en: 'enzymes' },
  { uz: 'noelektrolitlar', ru: 'неэлектролиты', en: 'non-electrolytes' },
  { uz: 'izomerlar', ru: 'изомеры', en: 'isomers' },
  { uz: 'elektron qobiq', ru: 'электронная оболочка', en: 'electron shell' },
  { uz: 'eritma konsentratsiyasi', ru: 'концентрация раствора', en: 'solution concentration' },
  { uz: 'mis birikmalari', ru: 'соединения меди', en: 'copper compounds' },
  { uz: 'mis guruhchasi elementlari', ru: 'элементы подгруппы меди', en: 'copper subgroup elements', forms: ['элементами подгруппы меди'] },
  { uz: 'vodorod atomining yadrosi', ru: 'ядро атома водорода', en: 'hydrogen nucleus' },
]

/** Апострофы узбекской латиницы к одному виду (oʻ, gʻ — U+02BB), нижний регистр. */
export function foldUz(s: string): string {
  return s
    .toLowerCase()
    .replace(/(?<=[og])['’‘`ʼ]/g, 'ʻ')
    .replace(/['’‘`ʼ]/g, 'ʼ')
    .replace(/\s+/g, ' ')
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Основа термина с чередованием перед гласным аффиксом: valentlik → valentligi, toʻliq → toʻligʻi. */
function termRe(term: string): string {
  if (/k$/.test(term)) return `(?:${esc(term)}|${esc(term.slice(0, -1))}g)`
  if (/q$/.test(term)) return `(?:${esc(term)}|${esc(term.slice(0, -1))}gʻ)`
  return esc(term)
}

/** Совпадение основы: узбекские окончания (-ning, -ni, -da, -dan, -lar, -ga, -chi…) — до 8 букв хвоста. */
function uzHas(text: string, term: string): boolean {
  return new RegExp(`(^|[^\\p{L}ʻʼ])${termRe(term)}[\\p{L}ʻʼ-]{0,8}(?![\\p{L}ʻʼ])`, 'u').test(text)
}

let SORTED: GlossaryPair[] | null = null

/**
 * Русские термины из узбекского текста — длинные сочетания первыми («kovalent bogʻ» раньше «bogʻ»),
 * уже совпавшие слова не учитываются повторно. Порядок — как в тексте.
 */
export function uzToRuTerms(text: string): string[] {
  SORTED ??= [...UZ_GLOSSARY].sort((a, b) => b.uz.length - a.uz.length)
  let t = ` ${foldUz(text)} `
  const hits: { at: number; ru: string }[] = []
  for (const p of SORTED) {
    const term = foldUz(p.uz)
    if (!uzHas(t, term)) continue
    const at = t.search(new RegExp(`(^|[^\\p{L}ʻʼ])${termRe(term)}`, 'u'))
    hits.push({ at, ru: p.ru })
    // вырезаем совпавшее, чтобы «bogʻ» не нашёлся второй раз внутри «kovalent bogʻ»
    t = t.replace(new RegExp(`${termRe(term)}[\\p{L}ʻʼ-]{0,8}`, 'u'), (m) => ' '.repeat(m.length))
  }
  return hits
    .sort((a, b) => a.at - b.at)
    .map((h) => h.ru)
    .filter((x, i, a) => a.indexOf(x) === i)
}

let SORTED_EN: GlossaryPair[] | null = null

/**
 * Русские термины из английского текста (для поиска § по русской карте): длинные сочетания первыми, окончания
 * -s/-es/-ies и -ic/-al не мешают («isotopes» → «изотоп», «oxidation states» → «степень окисления»).
 */
export function enToRuTerms(text: string): string[] {
  SORTED_EN ??= [...UZ_GLOSSARY].sort((a, b) => b.en.length - a.en.length)
  let t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\d' -]+/gu, ' ').replace(/\s+/g, ' ')} `
  const hits: { at: number; ru: string }[] = []
  for (const p of SORTED_EN) {
    const words = p.en.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) continue
    const re = new RegExp(`(^|[^\\p{L}])${words.map((w) => `${esc(w.replace(/(y|e|s)$/u, ''))}[\\p{L}]{0,4}`).join(' ')}(?![\\p{L}])`, 'u')
    const m = re.exec(t)
    if (!m) continue
    hits.push({ at: m.index, ru: p.ru })
    t = t.slice(0, m.index) + ' '.repeat(m[0].length) + t.slice(m.index + m[0].length)
  }
  return hits
    .sort((a, b) => a.at - b.at)
    .map((h) => h.ru)
    .filter((x, i, a) => a.indexOf(x) === i)
}

/** Русские термины вопроса на uz/en (для uz — узбекский словарь, для en — английский столбец того же словаря). */
export function toRuTerms(text: string, lang: 'ru' | 'uz' | 'en'): string[] {
  return lang === 'uz' ? uzToRuTerms(text) : lang === 'en' ? enToRuTerms(text) : []
}

/**
 * Термин вопроса («nisbiy atom massa», «isotopes») целиком через словарь: русские термины, если каждое слово термина
 * (кроме коротких связок) покрыто найденными словарными формами; иначе null — неполный перевод («atom» из «nisbiy atom
 * massa») увёл бы к чужому определению.
 */
export function termToRu(term: string, lang: 'uz' | 'en'): string[] | null {
  const ru = toRuTerms(term, lang)
  if (!ru.length) return null
  const forms = ru.flatMap((r) => (lang === 'uz' ? ruToUz(r) : ruToEn(r)) ?? '').join(' ')
  const fw = (lang === 'uz' ? foldUz(forms) : forms.toLowerCase()).split(/[\s-]+/).filter(Boolean)
  const tw = (lang === 'uz' ? foldUz(term) : term.toLowerCase()).split(/[^\p{L}ʻʼ']+/u).filter((w) => w.length >= 3 && !/^(the|and|of|an?|va|bilan)$/.test(w))
  // слово термина = словарная форма + окончание до 5 букв (valentlik → valentligi: k/q чередуются с g/gʻ)
  const covered = (w: string) =>
    fw.some((f) => f.length >= 2 && (f.startsWith(w) || ((w.startsWith(f) || (/[kq]$/.test(f) && w.startsWith(f.slice(0, -1)))) && w.length - f.length <= 5)))
  if (!tw.length || !tw.every(covered)) return null
  // «valence of sodium», «natriyning valentligi» — свойство вещества/элемента, а не термин: определение не ищем
  if (ru.length > 1 && ru.some((r) => ENTITY_RU.has(r))) return null
  return ru
}

/** Вещества и элементы словаря — это сущности, а не тема («kislorodning valentligi» → тема «валентность»). */
const ENTITY_RU = new Set(['водород', 'кислород', 'азот', 'углерод', 'сера', 'фосфор', 'хлор', 'натрий', 'калий', 'кальций', 'железо', 'медь', 'алюминий', 'вода', 'озон', 'аммиак', 'фтор', 'кремний', 'поваренная соль', 'соляная кислота', 'фосфорная кислота', 'угольная кислота', 'муравьиная кислота', 'уксусная кислота', 'этиленгликоль', 'теллур', 'марганец', 'оксид алюминия', 'гидроксид алюминия', 'нитрат серебра', 'хлорид натрия', 'стирол', 'глицерин', 'фенол',
  // вещества из терминов определений карты (12.10)
  'дейтерий', 'хлорид водорода', 'сероводородная кислота', 'глауберова соль', 'чилийская селитра', 'белый фосфор', 'аммофос', 'пищевая сода', 'известковая вода', 'алебастр', 'бутадиен', 'дивинил', 'фенилметанол', 'метан', 'этилен', 'ацетилен', 'бензол', 'крахмал'])

/** Термины-темы (без веществ и элементов) из узбекского текста. */
export function uzTopicTerms(text: string): string[] {
  return uzToRuTerms(text).filter((t) => !ENTITY_RU.has(t))
}

/** Русский термин → узбекский (для шаблонов standalone на uz: «Soddaroq tushuntir: valentlik»). */
export function ruToUz(ru: string): string | null {
  const k = ru.toLowerCase().replace(/ё/g, 'е')
  return UZ_GLOSSARY.find((p) => p.ru.toLowerCase().replace(/ё/g, 'е') === k)?.uz ?? null
}

/** Русский термин → английский. */
export function ruToEn(ru: string): string | null {
  const k = ru.toLowerCase().replace(/ё/g, 'е')
  return UZ_GLOSSARY.find((p) => p.ru.toLowerCase().replace(/ё/g, 'е') === k)?.en ?? null
}

// ---------------------------------------------------------------- аффиксы для шаблонов standalone

/** Сочетание → [начало с пробелом, последнее слово] (аффикс получает последнее слово). */
function splitLast(term: string): [string, string] {
  const t = term.trim()
  const i = t.lastIndexOf(' ')
  return [t.slice(0, i + 1), t.slice(i + 1)]
}

/**
 * Притяжательная форма 3-го лица: valentlik → valentligi, mol → moli, molyar massa → molyar massasi;
 * изафет уже с аффиксом («oksidlanish darajasi», «massa ulushi», «reaksiya tezligi») — как есть.
 */
export function uzPossessive(term: string): string {
  const [head, w] = splitLast(term)
  if (head && /[^aeiouʻʼ']i$/i.test(w)) return head + w
  if (/[aeiou]$/i.test(w)) return `${head}${w}si`
  if (/k$/i.test(w) && w.length > 3) return `${head}${w.slice(0, -1)}gi`
  if (/q$/i.test(w) && w.length > 3) return `${head}${w.slice(0, -1)}gʻi`
  return `${head}${w}i`
}

/** Дательный падеж: valentlik → valentlikka, toʻliq → toʻliqqa, mol → molga. */
export function uzDative(term: string): string {
  const [head, w] = splitLast(term)
  if (/k$/i.test(w)) return `${head}${w}ka`
  if (/q$/i.test(w)) return `${head}${w}qa`
  return `${head}${w}ga`
}

/** Винительный падеж: valentlik → valentlikni. */
export function uzAccusative(term: string): string {
  return `${term.trim()}ni`
}

/** Родительный падеж: natriy → natriyning. */
export function uzGenitive(term: string): string {
  return `${term.trim()}ning`
}
