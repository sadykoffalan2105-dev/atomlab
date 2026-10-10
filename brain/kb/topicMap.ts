/**
 * Карта тем для разметки записей журнала (brain:corpus): по заголовку, ключевым словам и началу текста.
 *
 * Каждое правило: регекс (ru / uz / en корни) → domain (раздел химии), topic (slug), программы и класс.
 * Первое сработавшее правило задаёт domain/topic; программы всех сработавших правил объединяются.
 * Если ничего не сработало — domain:general, программа school-uz и класс из самого чанка.
 *
 * Как добавить правило: дописать строку в RULES (порядок важен — частные темы выше общих),
 * затем `npm run brain:corpus` — новые записи получат теги; старые строки журнала не переписываются
 * (append-only), а теги для поиска пересчитываются при чтении через tagRecord().
 */

export type Domain = 'general' | 'inorganic' | 'organic' | 'physical' | 'analytical' | 'colloid' | 'quantum' | 'chemtech' | 'biochem'
export type Program = 'school-uz' | 'school-ru' | 'a-level' | 'ib' | 'univ' | 'olympiad'

export type TopicRule = { re: RegExp; domain: Domain; topic: string; programs: Program[]; grade?: number }

type Raw = [string, Domain, string, string, number?]

const P: Record<string, Program[]> = {
  s: ['school-uz', 'school-ru'],
  sa: ['school-uz', 'school-ru', 'a-level', 'ib'],
  a: ['a-level', 'ib', 'univ'],
  u: ['univ'],
  uo: ['univ', 'olympiad'],
  o: ['olympiad'],
}

/** [регекс-корни, домен, slug, программы (ключ P), класс]. ≥ 120 правил. */
const RAW: Raw[] = [
  // — органика (g10–g11)
  ['алкан|метан\\b|этан\\b|пропан|бутан|парафин|alkan|alkane', 'organic', 'alkanes', 'sa', 10],
  ['циклоалкан|циклопроп|циклогекс|sikloalkan|cycloalkane', 'organic', 'cycloalkanes', 'sa', 10],
  ['алкен|этилен|пропилен|alken|alkene|ethene', 'organic', 'alkenes', 'sa', 10],
  ['алкин|ацетилен|alkin|alkyne|ethyne', 'organic', 'alkynes', 'sa', 10],
  ['диен|бутадиен|каучук|изопрен|kauchuk|diene|rubber', 'organic', 'dienes-rubber', 'sa', 10],
  ['арен|бензол|толуол|ароматическ|aren|benzol|benzene|aromatic', 'organic', 'arenes', 'sa', 10],
  ['галогеналкан|галогенопроизвод|хлорметан|haloalkane|halogenoalkane', 'organic', 'haloalkanes', 'a', 10],
  ['спирт|этанол|метанол|глицерин|spirt|alcohol|ethanol', 'organic', 'alcohols', 'sa', 10],
  ['фенол|fenol|phenol', 'organic', 'phenols', 'sa', 10],
  ['альдегид|формальдегид|кетон|ацетон|aldegid|aldehyde|ketone', 'organic', 'carbonyls', 'sa', 10],
  ['карбоновы|уксусн(ая|ой) кислот|муравьин|karbon kislota|carboxylic', 'organic', 'carboxylic-acids', 'sa', 10],
  ['сложн(ый|ые|ых) эфир|этерификац|мыл[оа]|efir|ester|soap', 'organic', 'esters-fats', 'sa', 10],
  ['жир[ыаов]?\\b|триглицерид|lipid|fats?\\b', 'biochem', 'lipids', 'sa', 10],
  ['углевод|глюкоз|сахароз|крахмал|целлюлоз|uglevod|glyukoza|carbohydrate|glucose|starch', 'biochem', 'carbohydrates', 'sa', 10],
  ['амин[ыо]?\\b|анилин|amin|aniline', 'organic', 'amines', 'sa', 11],
  ['аминокислот|белк|белок|пептид|aminokislota|oqsil|amino acid|protein|peptide', 'biochem', 'proteins', 'sa', 11],
  ['нуклеинов|днк|рнк|нуклеотид|nuklein|dna\\b|rna\\b|nucleic', 'biochem', 'nucleic-acids', 'u', 11],
  ['фермент|энзим|ferment|enzyme', 'biochem', 'enzymes', 'u', 11],
  ['витамин|гормон|vitamin|hormone', 'biochem', 'vitamins-hormones', 'u', 11],
  ['полимер|полиэтилен|пластмасс|волокн|polimer|polymer|plastic', 'organic', 'polymers', 'sa', 11],
  ['изомер|изомерия|izomer|isomer', 'organic', 'isomerism', 'sa', 10],
  ['гомолог|гомологическ|gomolog|homolog', 'organic', 'homologous-series', 'sa', 10],
  ['номенклатур|iupac|nomenklatura', 'organic', 'nomenclature', 'sa', 10],
  ['функциональн(ая|ые|ой) групп|functional group', 'organic', 'functional-groups', 'sa', 10],
  ['хиральн|энантиомер|оптическ(ая|ой) изомер|chiral|enantiomer|stereo', 'organic', 'stereochemistry', 'a'],
  ['механизм реакци|нуклеофил|электрофил|радикальн(ое|ая) замещ|sn1|sn2|nucleophil|electrophil|mechanism', 'organic', 'mechanisms', 'uo'],
  ['бутлеров|теори[яи] химического строения|butlerov', 'organic', 'structure-theory', 's', 10],
  ['нефт|крекинг|риформинг|бензин|neft|petroleum|crude oil|cracking', 'chemtech', 'petroleum', 'sa', 10],
  ['природный газ|каменный уголь|коксован|tabiiy gaz|natural gas|coal', 'chemtech', 'fossil-fuels', 's', 10],
  ['органическ|organik|organic', 'organic', 'organic-general', 's', 10],
  // — общая химия и строение
  ['гибридизац|sp3|sp2|gibridlan|hybridi[sz]', 'general', 'hybridization', 'sa', 10],
  ['орбитал|электронн(ая|ой|ые) конфигурац|квантов(ое|ые) числ|orbital|configuration|quantum number', 'quantum', 'electron-configuration', 'sa', 8],
  ['принцип паули|правило хунда|клечковск|aufbau|hund|pauli', 'quantum', 'aufbau', 'a', 8],
  ['строени[ея] атома|ядро атома|протон|нейтрон|электрон(ы|ов)? |atom tuzilishi|atomic structure|nucleus', 'general', 'atomic-structure', 's', 8],
  ['изотоп|izotop|isotope', 'general', 'isotopes', 's', 8],
  ['радиоактивн|распад ядра|период полураспада|radioaktiv|radioactiv|half-life', 'physical', 'radioactivity', 'sa', 8],
  ['периодическ(ий|ого) закон|периодическ(ая|ой) систем|таблиц[аы] менделеева|davriy qonun|davriy jadval|periodic (law|table)', 'general', 'periodic-law', 's', 8],
  ['электроотрицательн|elektromanfiy|electronegativ', 'general', 'electronegativity', 'sa', 8],
  ['энерги[яи] ионизации|сродств[оа] к электрону|ionization energy|electron affinity', 'general', 'ionization-energy', 'a', 8],
  ['атомн(ый|ого) радиус|радиус атома|atomic radius', 'general', 'atomic-radius', 'sa', 8],
  ['ковалентн|kovalent|covalent', 'general', 'covalent-bond', 's', 8],
  ['ионн(ая|ой) связ|ion bog|ionic bond', 'general', 'ionic-bond', 's', 8],
  ['металлическ(ая|ой) связ|metallic bond', 'general', 'metallic-bond', 's', 8],
  ['водородн(ая|ой) связ|vodorod bog|hydrogen bond', 'general', 'hydrogen-bond', 'sa', 8],
  ['межмолекуляр|ван-дер-ваальс|van der waals|intermolecular|london', 'physical', 'intermolecular-forces', 'a'],
  ['кристаллическ(ая|ие|ой) решетк|кристалл|kristall panjara|crystal lattice|lattice', 'general', 'crystal-lattice', 's', 8],
  ['химическ(ая|ой) связ|kimyoviy bog|chemical bond', 'general', 'chemical-bond', 's', 8],
  ['vsepr|отталкивани[ея] электронных пар|геометри[яи] молекул|форма молекул|molecular geometry|molecular shape', 'general', 'vsepr', 'a'],
  ['молекулярн(ых|ые) орбитал|ммо|molecular orbital|mo theory|bond order|порядок связи', 'quantum', 'mo-theory', 'uo'],
  ['валентност|valentlik|valency|valence', 'general', 'valence', 's', 7],
  ['степен[ьи] окислени|oksidlanish darajasi|oxidation (state|number)', 'general', 'oxidation-state', 's', 8],
  ['окислительно-восстановит|окислител|восстановител|овр\\b|oksidlanish-qaytarilish|redox|oxidi[sz]ing agent|reducing agent', 'general', 'redox', 'sa', 9],
  ['моль\\b|количеств[оа] веществ|авогадро|mol\\b|modda miqdori|avogadro|amount of substance', 'general', 'mole', 's', 8],
  ['молярн(ая|ой) масс|molyar massa|molar mass', 'general', 'molar-mass', 's', 8],
  ['молярн(ый|ого) объ[её]м|н\\.\\s?у\\.|molar volume|stp', 'general', 'molar-volume', 's', 8],
  ['закон сохранения массы|ломоносов|лавуазье|massa saqlanish|conservation of mass', 'general', 'mass-conservation', 's', 7],
  ['закон постоянства состава|пруст|law of definite proportions', 'general', 'definite-proportions', 's', 7],
  ['стехиометр|расчет по уравнени|массов(ая|ой) дол|stoichiometr|mass fraction', 'general', 'stoichiometry', 'sa', 8],
  ['выход продукта|практическ(ий|ого) выход|percentage yield', 'general', 'yield', 'sa', 9],
  ['избыт(ок|ке)|недостат(ок|ке)|limiting reagent|excess', 'general', 'limiting-reagent', 'sa', 9],
  ['химическ(ий|ого) элемент|kimyoviy element|chemical element', 'general', 'elements', 's', 7],
  ['прост(ые|ое) и сложн|простое вещество|сложное вещество|oddiy va murakkab|simple and complex', 'general', 'simple-complex', 's', 7],
  ['смес[ьи]|разделени[ея] смес|фильтрован|дистилляц|aralashma|mixture|filtration|distillation', 'general', 'mixtures', 's', 7],
  ['физическ(ие|ое) и химическ|химическ(ое|ие) явлени|признаки реакц|kimyoviy hodisa|chemical change', 'general', 'chemical-phenomena', 's', 7],
  ['типы реакций|реакци[яи] соединения|разложения|замещения|обмена|reaksiya turlari|types of reaction', 'general', 'reaction-types', 's', 8],
  ['коэффициент|уравнивани|уравнени[ея] реакц|tenglama|balanc|equation', 'general', 'equations', 's', 8],
  ['техник[аи] безопасност|xavfsizlik|safety|лабораторн(ая|ое|ые) (посуда|оборудован)', 'general', 'lab-safety', 's', 7],
  // — неорганика
  ['оксид|oksid|oxide', 'inorganic', 'oxides', 's', 8],
  ['основани[ея]|щелоч|гидроксид|asos|ishqor|hydroxide|alkali|bases?\\b', 'inorganic', 'bases', 's', 8],
  ['кислот|kislota|acid', 'inorganic', 'acids', 's', 8],
  ['сол[ьи]\\b|соле[йв]|tuz(lar)?\\b|salts?\\b', 'inorganic', 'salts', 's', 8],
  ['амфотерн|amfoter|amphoter', 'inorganic', 'amphoteric', 's', 9],
  ['генетическ(ая|ой) связ|классы неорганическ|genetic link', 'inorganic', 'classes-link', 's', 8],
  ['водород\\b|водорода|vodorod|hydrogen', 'inorganic', 'hydrogen', 's', 8],
  ['кислород|озон|kislorod|oxygen|ozone', 'inorganic', 'oxygen', 's', 7],
  ['вода\\b|воды\\b|водн|suv\\b|water', 'inorganic', 'water', 's', 7],
  ['галоген|хлор|бром|йод|фтор|galogen|halogen|chlorine', 'inorganic', 'halogens', 's', 9],
  ['сера\\b|серы|сероводород|сернист|серн(ая|ой) кислот|oltingugurt|sulfur|sulphur', 'inorganic', 'sulfur', 's', 9],
  ['азот|аммиак|азотн(ая|ой) кислот|нитрат|azot|ammiak|nitrogen|ammonia|nitric', 'inorganic', 'nitrogen', 's', 9],
  ['фосфор|фосфат|fosfor|phosphor', 'inorganic', 'phosphorus', 's', 9],
  ['углерод|алмаз|графит|угарн|углекисл|карбонат|uglerod|carbon\\b|carbonate|graphite|diamond', 'inorganic', 'carbon', 's', 9],
  ['кремни|силикат|стекл|цемент|kremniy|silicon|silicate|glass', 'inorganic', 'silicon', 's', 9],
  ['благородн(ые|ых) газ|инертн(ые|ых) газ|гелий|неон|аргон|nodir gaz|noble gas', 'inorganic', 'noble-gases', 's', 9],
  ['щелочн(ые|ых) металл|натри|кали[йя]|литий|ishqoriy metall|alkali metal|sodium|potassium', 'inorganic', 'alkali-metals', 's', 9],
  ['щелочноземельн|кальци|магни|бари[йя]|ishqoriy-yer|alkaline earth|calcium|magnesium', 'inorganic', 'alkaline-earth', 's', 9],
  ['жесткост[ьи] вод|suv qattiqligi|water hardness', 'inorganic', 'water-hardness', 's', 9],
  ['алюмини|alyuminiy|alumin', 'inorganic', 'aluminium', 's', 9],
  ['железо|железа|чугун|сталь|ржавлен|temir|iron\\b|steel|rust', 'inorganic', 'iron', 's', 9],
  ['мед[ьи]\\b|цинк|серебр|золот|ртут|mis\\b|rux|copper|zinc|silver|gold|mercury', 'inorganic', 'd-metals', 's', 9],
  ['переходн(ые|ых) металл|d-элемент|хром|марганц|transition metal|d-block|chromium|manganese', 'inorganic', 'transition-metals', 'a', 11],
  ['металл(ы|ов)?\\b|metall(ar)?\\b|metals?\\b', 'inorganic', 'metals', 's', 9],
  ['неметалл|nometall|non-?metal', 'inorganic', 'nonmetals', 's', 9],
  ['ряд активности|электрохимическ(ий|ого) ряд|ряд напряжени|activity series|reactivity series', 'inorganic', 'activity-series', 's', 9],
  ['коррози|korroziya|corrosion', 'inorganic', 'corrosion', 's', 9],
  ['комплексн(ые|ых|ое) соединени|координационн|лиганд|kompleks birikma|coordination compound|ligand|complex ion', 'inorganic', 'coordination', 'a', 11],
  ['удобрени|o[ʻ‘\']?g[ʻ‘\']?it|fertili[sz]er', 'chemtech', 'fertilizers', 's', 9],
  ['металлурги|доменн|выплавк|metallurgiya|metallurgy|blast furnace', 'chemtech', 'metallurgy', 's', 9],
  ['производств[оа] (серной|аммиака|азотной)|контактн(ый|ого) способ|габер|haber|contact process', 'chemtech', 'industrial-synthesis', 'sa', 9],
  ['химическ(ая|ой) технологи|химическ(ое|ого) производств|kimyoviy texnologiya|chemical engineering|industrial', 'chemtech', 'chemtech-general', 'u'],
  ['экологи|загрязнени|кислотн(ые|ый) дожд|парников|ekologiya|pollution|acid rain|greenhouse', 'chemtech', 'environment', 's', 9],
  // — растворы, электролиты
  ['раствор|растворимост|eritma|eruvchanlik|solution|solubility', 'physical', 'solutions', 's', 8],
  ['концентрац|молярност|моляльн|konsentratsiya|concentration|molarity', 'physical', 'concentration', 'sa', 9],
  ['электролитическ(ая|ой) диссоциац|диссоциац|электролит|elektrolitik dissotsilanish|dissociation|electrolyte', 'physical', 'electrolytic-dissociation', 's', 9],
  ['ионн(ые|ое|ых) уравнени|сокращенн(ое|ые) ионн|ionic equation', 'physical', 'ionic-equations', 's', 9],
  ['гидролиз|gidroliz|hydrolysis', 'physical', 'hydrolysis', 'sa', 9],
  ['водородн(ый|ого) показател|\\bph\\b|рн\\b|индикатор|лакмус|фенолфталеин|indikator|indicator', 'physical', 'ph', 'sa', 9],
  ['буфер|bufer|buffer', 'physical', 'buffers', 'a'],
  ['произведени[ея] растворимост|solubility product|ksp', 'physical', 'ksp', 'a'],
  ['кислот(ы|а) и основани[яй] (по )?(бренстед|льюис)|бренстед|льюис|bronsted|brønsted|lewis acid|conjugate', 'physical', 'acid-base-theories', 'a'],
  ['электролиз|elektroliz|electrolysis', 'physical', 'electrolysis', 's', 9],
  ['гальваническ|электродн(ый|ого) потенциал|эдс|нернст|galvanic|electrode potential|nernst|electrochemical cell', 'physical', 'electrochemistry', 'a'],
  // — физическая химия
  ['энтропи|entropiya|entropy', 'physical', 'entropy', 'a'],
  ['энерги[яи] гиббса|свободн(ая|ой) энерги|gibbs|free energy', 'physical', 'gibbs', 'a'],
  ['энтальпи|тепловой эффект|термохими|экзотерм|эндотерм|закон гесса|issiqlik effekti|enthalpy|thermochem|exothermic|endothermic|hess', 'physical', 'thermochemistry', 'sa', 9],
  ['термодинамик|termodinamika|thermodynamic', 'physical', 'thermodynamics', 'u'],
  ['скорост[ьи] (химической )?реакци|кинетик|reaksiya tezligi|reaction rate|kinetic', 'physical', 'kinetics', 'sa', 9],
  ['порядок реакции|констант[аы] скорости|второго порядка|первого порядка|rate constant|order of reaction|half-life', 'physical', 'rate-laws', 'a'],
  ['энерги[яи] активации|аррениус|activation energy|arrhenius', 'physical', 'activation-energy', 'a'],
  ['катализ|катализатор|ингибитор|katalizator|catalys|inhibitor', 'physical', 'catalysis', 's', 9],
  ['химическ(ое|ого) равновеси|ле шателье|константа равновеси|kimyoviy muvozanat|equilibrium|le chatelier', 'physical', 'equilibrium', 'sa', 9],
  ['газов(ые|ых) закон|менделеева.клапейрона|идеальн(ый|ого) газ|бойл|шарл|gas laws|ideal gas|boyle|charles', 'physical', 'gas-laws', 'sa', 8],
  ['агрегатн(ое|ые) состояни|фазов(ый|ая) переход|кипени|плавлени|agregat holat|phase|boiling|melting', 'physical', 'states-of-matter', 's', 7],
  ['спектроскоп|спектр|ямр|ик-спектр|масс-спектр|spectroscop|nmr|infrared|mass spectr', 'analytical', 'spectroscopy', 'a'],
  ['титрован|титр|titrlash|titration', 'analytical', 'titration', 'a'],
  ['качественн(ые|ая|ых) реакци|качественный анализ|qualitative analysis|test for ions', 'analytical', 'qualitative-analysis', 's', 9],
  ['хроматограф|chromatograph', 'analytical', 'chromatography', 'a'],
  ['аналитическ|analitik|analytical', 'analytical', 'analytical-general', 'u'],
  ['коллоид|золь|гель|эмульси|суспензи|аэрозол|kolloid|colloid|emulsion|aerosol|sol\\b|gel\\b', 'colloid', 'colloids', 'u'],
  ['адсорбц|поверхностн(ое|ого) натяжени|пав\\b|adsorption|surfactant|surface tension', 'colloid', 'surface-chemistry', 'u'],
  ['квантов(ая|ой) хими|уравнени[ея] шредингера|волнов(ая|ой) функци|kvant|schr[oö]dinger|wave function', 'quantum', 'quantum-chemistry', 'uo'],
  ['фотохими|photochem', 'physical', 'photochemistry', 'u'],
  ['лекарств|фармакол|медицин|dori|drug|pharma', 'biochem', 'medicinal-chemistry', 'u'],
  ['метаболизм|гликолиз|кребс|атф|metabol|glycolysis|krebs|atp\\b', 'biochem', 'metabolism', 'u'],
  ['олимпиад|olimpiada|olympiad', 'general', 'olympiad', 'o'],
  ['учен(ый|ого)|биограф|открыл|olim|scientist|discovered', 'general', 'history', 's'],
]

export const RULES: TopicRule[] = RAW.map(([src, domain, topic, prog, grade]) => ({
  re: new RegExp(src.replace(/\\b/g, '(?![\\p{L}\\p{N}])'), 'iu'),
  domain,
  topic,
  programs: P[prog] ?? P.s!,
  grade,
}))

export type TopicTags = { domain: Domain; topic: string; programs: Program[]; grade: number | null }

/** Разметить текст: первое сработавшее правило — domain/topic; программы — объединение всех сработавших. */
export function classifyTopic(title: string, keywords: string, text: string, grade: number | null): TopicTags {
  const hay = `${title}\n${keywords}\n${text.slice(0, 400)}`.toLowerCase().replace(/ё/g, 'е')
  const titleHay = `${title}\n${keywords}`.toLowerCase().replace(/ё/g, 'е')
  let first: TopicRule | null = null
  const programs = new Set<Program>()
  // сначала по заголовку и ключевым словам — они точнее; потом по началу текста
  for (const r of RULES) if (r.re.test(titleHay)) (first ??= r, r.programs.forEach((p) => programs.add(p)))
  if (!first) for (const r of RULES) if (r.re.test(hay)) (first ??= r, r.programs.forEach((p) => programs.add(p)))
  if (!programs.size || grade != null) programs.add('school-uz')
  return { domain: first?.domain ?? 'general', topic: first?.topic ?? 'general', programs: [...programs], grade: grade ?? first?.grade ?? null }
}

/** Теги журнала в формате «program:…», «domain:…», «topic:…», «grade:N». */
export function topicTags(t: TopicTags): string[] {
  return [...t.programs.map((p) => `program:${p}`), `domain:${t.domain}`, `topic:${t.topic}`, ...(t.grade ? [`grade:${t.grade}`] : [])]
}
