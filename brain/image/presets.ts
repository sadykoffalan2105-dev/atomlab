/**
 * 48 готовых тем картинок по учебникам Kimyo 7–11 (ученикам — только они, своего класса ±1). Подсказки модели —
 * английские, без людей, без текста и надписей: правильные формулы и подписи накладывает сайт поверх картинки.
 *
 * Как добавить тему: новая запись в PRESETS (id «gN-тема», уникальный; grades из g7..g11; prompt_en — ASCII,
 * без слов фильтра brain/image/filter.ts) → npm run brain:image-selftest проверит целостность.
 */
import type { ImageLang, ImageSize, ImageStyle } from './types.ts'

export type GradeId = 'g7' | 'g8' | 'g9' | 'g10' | 'g11'
export type ImagePreset = {
  id: string
  grades: GradeId[]
  titles: Record<ImageLang, string>
  topic: string
  style: ImageStyle
  size: ImageSize
  /** раздел учебника (если тема совпадает с оглавлением) */
  chapter?: { grade: GradeId; ch: number; sec: number }
  prompt_en: string
}

type Row = [id: string, grades: GradeId[], ru: string, uz: string, en: string, topic: string, style: ImageStyle, size: ImageSize, prompt: string]

const ROWS: Row[] = [
  // ——— 7 класс: посуда, приборы, разделение смесей, газы, строение вещества
  ['g7-lab-stand', ['g7', 'g8'], 'Лабораторный штатив с кольцом и лапкой', 'Halqa va qisqichli laboratoriya shtativi', 'Retort stand with ring and clamp', 'lab-equipment', 'illustration', 'tall', 'laboratory retort stand with iron ring, clamp and a round-bottom flask'],
  ['g7-spirit-lamp', ['g7', 'g8'], 'Спиртовка и нагревание пробирки', 'Spirt lampasi va probirkani qizdirish', 'Spirit lamp heating a test tube', 'lab-equipment', 'illustration', 'square', 'spirit lamp with blue flame heating a test tube in a wooden holder'],
  ['g7-glassware-set', ['g7', 'g8'], 'Химическая посуда', 'Kimyoviy idishlar', 'Chemistry glassware', 'lab-equipment', 'illustration', 'wide', 'set of chemistry glassware: test tube, conical flask, beaker, glass funnel, graduated cylinder'],
  ['g7-filtration', ['g7'], 'Фильтрование смеси', 'Aralashmani filtrlash', 'Filtering a mixture', 'separation', 'illustration', 'tall', 'filtration setup: glass funnel with folded filter paper on a ring stand, liquid dripping into a beaker'],
  ['g7-evaporation', ['g7'], 'Выпаривание раствора соли', 'Tuz eritmasini bugʻlatish', 'Evaporating a salt solution', 'separation', 'illustration', 'square', 'evaporating dish on a tripod with wire gauze over a spirit lamp, white salt crystals forming'],
  ['g7-distillation', ['g7', 'g8'], 'Перегонка воды', 'Suvni haydash (distillyatsiya)', 'Distillation of water', 'separation', 'illustration', 'wide', 'simple distillation apparatus: round-bottom flask, Liebig condenser with water hoses, receiving flask'],
  ['g7-mixture-separation', ['g7'], 'Разделение смеси магнитом и отстаиванием', 'Aralashmani magnit va tindirish bilan ajratish', 'Separating a mixture with a magnet and settling', 'separation', 'illustration', 'wide', 'magnet lifting iron filings from sand, and a beaker with settled sand and clear water'],
  ['g7-oxygen-apparatus', ['g7', 'g8'], 'Получение кислорода из KMnO₄', 'KMnO₄ dan kislorod olish', 'Preparing oxygen from KMnO₄', 'gases', 'illustration', 'wide', 'lab apparatus for preparing oxygen: test tube with dark purple crystals heated by a burner, delivery tube collecting gas over water in a trough'],
  ['g7-hydrogen-kipp', ['g7', 'g8'], 'Аппарат Киппа', 'Kipp apparati', "Kipp's apparatus", 'gases', 'illustration', 'tall', "Kipp's apparatus, three-bulb glass gas generator with zinc granules and acid, stopcock, delivery tube"],
  ['g7-water-molecule', ['g7', 'g8'], 'Модель молекулы воды', 'Suv molekulasi modeli', 'Water molecule model', 'structure', 'illustration', 'square', 'ball-and-stick model of a water molecule, one red oxygen sphere and two small white hydrogen spheres, bent shape'],
  ['g7-atom-model', ['g7', 'g8'], 'Модель строения атома', 'Atom tuzilishi modeli', 'Model of an atom', 'structure', 'illustration', 'square', 'educational model of an atom: nucleus of red protons and grey neutrons with small blue electrons on orbits'],
  ['g7-states-of-matter', ['g7'], 'Три агрегатных состояния', 'Moddaning uch agregat holati', 'Three states of matter', 'structure', 'illustration', 'wide', 'three beakers with ice cubes, liquid water and rising vapour, particle insets of ordered, loose and scattered spheres'],
  ['g7-candle-bell-jar', ['g7'], 'Горение свечи под колоколом', 'Qalpoq ostida shamning yonishi', 'Candle burning under a bell jar', 'air', 'photo', 'square', 'burning candle under a glass bell jar standing in water, water level rising inside'],
  ['g7-safety-gear', ['g7', 'g8'], 'Защитные очки, перчатки и халат', 'Himoya koʻzoynagi, qoʻlqop va xalat', 'Safety goggles, gloves and lab coat', 'safety', 'illustration', 'square', 'chemistry lab safety equipment: safety goggles, nitrile gloves, white lab coat on a bench'],
  // ——— 8 класс: законы, растворы, кислоты и основания, кристаллы
  ['g8-balance', ['g7', 'g8'], 'Лабораторные весы с разновесами', 'Toshlari bilan laboratoriya tarozisi', 'Lab balance with weights', 'lab-equipment', 'illustration', 'square', 'two-pan laboratory balance with brass weights, small beaker on one pan'],
  ['g8-conservation-mass', ['g8'], 'Закон сохранения массы', 'Massaning saqlanish qonuni', 'Conservation of mass', 'laws', 'illustration', 'square', 'sealed flask with reacting liquids on a digital balance, reading unchanged'],
  ['g8-dissolving-sugar', ['g7', 'g8'], 'Растворение сахара в воде', 'Shakarning suvda erishi', 'Sugar dissolving in water', 'solutions', 'photo', 'square', 'sugar cube dissolving in a glass of water, swirling streaks, particle-level inset'],
  ['g8-indicators', ['g8', 'g9'], 'Индикаторы в кислоте и щёлочи', 'Kislota va ishqordagi indikatorlar', 'Indicators in acid and alkali', 'acids-bases', 'photo', 'wide', 'three test tubes with litmus, phenolphthalein and methyl orange showing colour changes in acid and alkali'],
  ['g8-titration', ['g8', 'g9'], 'Титрование: бюретка и колба', 'Titrlash: byuretka va kolba', 'Titration: burette and flask', 'acids-bases', 'illustration', 'tall', 'glass burette on a stand dripping into a conical flask with pale pink solution'],
  ['g8-zinc-acid', ['g8'], 'Цинк в соляной кислоте', 'Xlorid kislotadagi rux', 'Zinc in hydrochloric acid', 'acids-bases', 'photo', 'square', 'test tube with zinc granules in clear hydrochloric acid, streams of small gas bubbles rising'],
  ['g8-magnesium-burning', ['g8'], 'Горение магния', 'Magniyning yonishi', 'Burning magnesium', 'oxidation', 'photo', 'square', 'magnesium ribbon burning with dazzling white flame in crucible tongs, white smoke'],
  ['g8-copper-sulfate-crystals', ['g8'], 'Кристаллы медного купороса', 'Mis kuporosi kristallari', 'Copper sulfate crystals', 'solutions', 'photo', 'square', 'bright blue copper sulfate crystals growing on a thread in a beaker of blue solution'],
  ['g8-electrolysis-water', ['g8', 'g9'], 'Электролиз воды (прибор Гофмана)', 'Suvning elektrolizi (Gofman asbobi)', 'Electrolysis of water (Hofmann voltameter)', 'electrochemistry', 'illustration', 'tall', 'Hoffman voltameter: two graduated tubes with electrodes, gases collecting in 2:1 volume ratio'],
  ['g8-nacl-lattice', ['g8', 'g9'], 'Кристаллическая решётка NaCl', 'NaCl kristall panjarasi', 'NaCl crystal lattice', 'structure', 'illustration', 'square', 'ball-and-stick cubic lattice of sodium chloride, alternating green and purple spheres'],
  ['g8-periodic-wall', ['g8', 'g9'], 'Таблица Менделеева в классе', 'Sinfdagi Mendeleyev jadvali', 'Periodic table in the classroom', 'periodic-law', 'illustration', 'wide', 'chemistry classroom with a large periodic table poster with blank cells, desks in front'],
  ['g8-gas-collection', ['g7', 'g8'], 'Собирание газа над водой и воздухом', 'Gazni suv va havo ustida yigʻish', 'Collecting gas over water and by air displacement', 'gases', 'diagram', 'wide', 'two methods of gas collection: inverted jar over a water trough and upright jar with delivery tube'],
  // ——— 9 класс: металлы, неметаллы, производство
  ['g9-sodium-water', ['g9'], 'Натрий на воде', 'Suvdagi natriy', 'Sodium on water', 'metals', 'photo', 'square', 'small piece of sodium skimming on water in a glass trough, fizzing, tiny flame, pink phenolphthalein trail'],
  ['g9-iron-rusting', ['g8', 'g9'], 'Ржавление железа', 'Temirning zanglashi', 'Rusting of iron', 'metals', 'photo', 'wide', 'three test tubes with iron nails: dry air, boiled water under oil, tap water with rust forming'],
  ['g9-blast-furnace', ['g9'], 'Доменная печь (схема)', 'Domna pechi (sxema)', 'Blast furnace (diagram)', 'industry', 'diagram', 'tall', 'cutaway schematic of a blast furnace with layered ore, coke and limestone, hot air inlets, molten iron and slag'],
  ['g9-sulfuric-acid-plant', ['g9'], 'Производство серной кислоты', 'Sulfat kislota ishlab chiqarish', 'Sulfuric acid production', 'industry', 'diagram', 'wide', 'schematic of a sulfuric acid plant: pyrite roaster, contact converter with catalyst shelves, absorption tower'],
  ['g9-ammonia-synthesis', ['g9'], 'Синтез аммиака (установка)', 'Ammiak sintezi (qurilma)', 'Ammonia synthesis plant', 'industry', 'diagram', 'wide', 'schematic of an ammonia synthesis loop: compressor, catalytic reactor column, cooler, separator, recycle pipes'],
  ['g9-aluminium-electrolysis', ['g9'], 'Электролиз глинозёма', 'Glinozyom (alyuminiy oksidi) elektrolizi', 'Electrolysis of alumina', 'industry', 'diagram', 'wide', 'cutaway of an aluminium electrolysis cell: carbon anodes in molten cryolite bath, molten aluminium layer at the bottom'],
  ['g9-flame-colors', ['g9'], 'Окраска пламени солями', 'Tuzlar bilan alanga rangi', 'Flame colours of salts', 'metals', 'photo', 'wide', 'row of burner flames coloured yellow, violet, brick red and green by metal salts on wire loops'],
  ['g9-daniell-cell', ['g9', 'g10'], 'Гальванический элемент Даниэля', 'Daniel galvanik elementi', 'Daniell cell', 'electrochemistry', 'illustration', 'wide', 'zinc and copper electrodes in two beakers joined by a salt bridge, wire with a small lamp'],
  ['g9-halogens', ['g8', 'g9'], 'Галогены: хлор, бром, иод', 'Galogenlar: xlor, brom, yod', 'Halogens: chlorine, bromine, iodine', 'nonmetals', 'photo', 'wide', 'three sealed flasks with yellow-green chlorine gas, red-brown bromine liquid and violet iodine vapour'],
  ['g9-lime-kiln', ['g9'], 'Обжиг известняка', 'Ohaktoshni kuydirish', 'Lime kiln', 'industry', 'diagram', 'tall', 'schematic of a lime kiln with limestone charge, fuel inlet and gas outlet'],
  // ——— 10 класс: органика — модели, нефть, синтез
  ['g10-methane-model', ['g9', 'g10'], 'Модель молекулы метана', 'Metan molekulasi modeli', 'Methane molecule model', 'organic-structure', 'illustration', 'square', 'ball-and-stick model of methane: black carbon sphere with four white hydrogen spheres in a tetrahedron'],
  ['g10-ethene-model', ['g10'], 'Модель этилена с двойной связью', 'Qoʻsh bogʻli etilen modeli', 'Ethene model with a double bond', 'organic-structure', 'illustration', 'square', 'ball-and-stick model of ethene, two carbons joined by a double bond, four hydrogens, flat'],
  ['g10-benzene-ring', ['g10', 'g11'], 'Модель бензольного кольца', 'Benzol halqasi modeli', 'Benzene ring model', 'organic-structure', 'illustration', 'square', 'ball-and-stick benzene ring, six carbons in a flat hexagon with alternating bonds'],
  ['g10-oil-tower', ['g10'], 'Ректификационная колонна нефти', 'Neftni haydash (rektifikatsiya) kolonnasi', 'Crude oil fractionating column', 'industry', 'diagram', 'tall', 'cutaway schematic of a crude oil fractionating tower with trays, hot bottom to cool top, side outlets'],
  ['g10-fermentation', ['g10', 'g11'], 'Брожение глюкозы', 'Glyukozaning bijgʻishi', 'Fermentation of glucose', 'organic-reactions', 'photo', 'square', 'glass fermentation flask with bubbling airlock, cloudy liquid'],
  ['g10-reflux', ['g10', 'g11'], 'Установка с обратным холодильником', 'Qaytar sovutkichli qurilma', 'Reflux apparatus', 'lab-equipment', 'illustration', 'tall', 'reflux apparatus: round-bottom flask over a heating mantle with a vertical reflux condenser'],
  // ——— 11 класс: полимеры, биомолекулы, методы, производство
  ['g11-polyethylene-chain', ['g10', 'g11'], 'Цепь полиэтилена', 'Polietilen zanjiri', 'Polyethylene chain', 'polymers', 'illustration', 'wide', 'long zig-zag chain of repeating carbon units with hydrogen spheres, ball-and-stick'],
  ['g11-soap-micelle', ['g10', 'g11'], 'Мицелла мыла', 'Sovun mitsellasi', 'Soap micelle', 'organic-structure', 'diagram', 'square', 'cross-section of a soap micelle: hydrophilic heads outside, tails inside around an oil droplet'],
  ['g11-protein-helix', ['g11'], 'Спираль белка', 'Oqsil spirali', 'Protein helix', 'biomolecules', 'illustration', 'tall', 'ribbon model of an alpha-helix protein segment with ball-and-stick side chains'],
  ['g11-cellulose-starch', ['g10', 'g11'], 'Волокна целлюлозы и зёрна крахмала', 'Sellyuloza tolalari va kraxmal donachalari', 'Cellulose fibres and starch granules', 'biomolecules', 'photo', 'wide', 'macro view of cotton cellulose fibres and potato starch granules side by side'],
  ['g11-paper-chromatography', ['g10', 'g11'], 'Бумажная хроматография', 'Qogʻoz xromatografiyasi', 'Paper chromatography', 'methods', 'photo', 'tall', 'paper chromatography strip in a beaker with solvent, separated coloured spots'],
  ['g11-chemical-plant', ['g10', 'g11'], 'Химический завод', 'Kimyo zavodi', 'Chemical plant', 'industry', 'diagram', 'wide', 'wide view of a modern chemical plant with distillation columns, pipes and storage tanks'],
]

export const PRESETS: readonly ImagePreset[] = ROWS.map(([id, grades, ru, uz, en, topic, style, size, prompt_en]) => ({ id, grades, titles: { ru, uz, en }, topic, style, size, prompt_en }))

const BY_ID = new Map(PRESETS.map((p) => [p.id, p]))

export function presetById(id: string | undefined): ImagePreset | undefined {
  return id ? BY_ID.get(id) : undefined
}

export const GRADES: readonly GradeId[] = ['g7', 'g8', 'g9', 'g10', 'g11']

/** Класс ученика «g8» (или «8») → номер 8; непонятно — null (тогда допускается любой). */
export function gradeNumber(g: string | undefined): number | null {
  const m = String(g ?? '').match(/^g?(\d{1,2})$/i)
  if (!m) return null
  const n = Number(m[1])
  return n >= 7 && n <= 11 ? n : null
}

/** Подходит ли тема классу ученика: её классы пересекаются с gradeId ± window (класс не задан — любой). */
export function presetFitsGrade(p: ImagePreset, gradeId: string | undefined, window: number): boolean {
  const n = gradeNumber(gradeId)
  if (n === null) return true
  const w = Math.max(0, Math.floor(window))
  return p.grades.some((g) => Math.abs(Number(g.slice(1)) - n) <= w)
}
