/**
 * Генерирует src/data/elementRealLife/elementRealLifeProfiles.json (118 элементов).
 * npm run learn:generate-element-profiles
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const raw = JSON.parse(
  fs.readFileSync(path.join(root, 'src/data/periodicTableRaw.json'), 'utf8'),
)
const namesRu = fs
  .readFileSync(path.join(root, 'src/data/elementNamesRu.ts'), 'utf8')
  .match(/'([^']+)'/g)
  .map((s) => s.slice(1, -1))
const namesEn = fs
  .readFileSync(path.join(root, 'src/data/elementNamesEn.ts'), 'utf8')
  .match(/'([^']+)'/g)
  .map((s) => s.slice(1, -1))

/** Реальные подписи к фото и расширенные тексты для ключевых элементов */
const RICH = {
  1: {
    captionRu: 'Бесцветный газ — топливные элементы и звёзды',
    captionEn: 'Colorless gas — fuel cells and stars',
    appearanceRu:
      'Водород — самый лёгкий газ. В быту его не видят отдельно: он входит в состав воды, нефти и всех органических веществ. В лаборатории — прозрачные пузыри, в космосе — главное «топливо» звёзд.',
    usesRu: ['Ракетное топливо', 'Производство аммиака', 'Топливные элементы', 'Гидрирование масел'],
    extractionRu: 'Из природного газа и воды (электролиз), а также как побочный продукт химических производств.',
  },
  2: {
    captionRu: 'Гелий в воздушных шарах',
    captionEn: 'Helium in party balloons',
    appearanceRu: 'Бесцветный, без запаха одноатомный газ — легче воздуха. В шарах поднимает оболочку вверх; в жидком виде — сверххолодная жидкость для науки.',
    usesRu: ['Дыхательные смеси для водолазов', 'Охлаждение МРТ-сканеров', 'Сварка и контроль среды', 'Шары и дирижабли'],
    extractionRu: 'Из природного газа, где гелий накапливается при распаде радиоактивных элементов.',
  },
  6: {
    captionRu: 'Уголь, графит и алмаз — формы углерода',
    captionEn: 'Coal, graphite and diamond — forms of carbon',
    appearanceRu: 'Углерод встречается и как чёрный уголь, и как блестящий графит в карандаше, и как прозрачный алмаз. Основа всей органической жизни и пластмасс.',
    usesRu: ['Сталь и металлургия', 'Пластмассы и резина', 'Аккумуляторы', 'Фильтры (активированный уголь)'],
    extractionRu: 'Уголь — из недр; графит и алмазы — из месторождений; в промышленности — из нефти и природного газа.',
  },
  7: {
    captionRu: 'Азот — 78 % воздуха вокруг нас',
    captionEn: 'Nitrogen — 78% of the air we breathe',
    appearanceRu: 'Бесцветный газ, главная часть атмосферы. Жидкий азот — белый «туман» при кипении (−196 °C), используют для заморозки.',
    usesRu: ['Удобрения (аммиак, селитра)', 'Инертная среда в химии', 'Пищевые упаковки', 'Криогенные технологии'],
    extractionRu: 'Разделением воздуха: сначала сжижают, затем фракционно перегоняют.',
  },
  8: {
    captionRu: 'Кислород — дыхание и поддержка горения',
    captionEn: 'Oxygen — breathing and combustion',
    appearanceRu: 'Бесцветный газ, без которого невозможно дыхание и горение. В баллонах — для медицины и сварки; жидкий — светло-голубой.',
    usesRu: ['Медицинские баллоны', 'Металлургия (домны)', 'Очистка сточных вод', 'Сварка и резка металла'],
    extractionRu: 'Из воздуха фракционной перегонкой на кислородных станциях.',
  },
  13: {
    captionRu: 'Алюминиевая фольга и детали',
    captionEn: 'Aluminium foil and parts',
    appearanceRu: 'Лёгкий серебристый металл с характерным блеском. Фольга на кухне, корпуса телефонов и самолётов — всё из алюминия.',
    usesRu: ['Упаковка и фольга', 'Авиация и транспорт', 'Строительные профили', 'Электропроводка'],
    extractionRu: 'Из бокситов: сплавляют, получают оксид Al₂O₃, затем электролизом восстанавливают металл.',
  },
  26: {
    captionRu: 'Железо — гвозди, арматура, сталь',
    captionEn: 'Iron — nails, rebar, steel',
    appearanceRu: 'Тёмно-серый блестящий металл. Без покрытия быстро ржавеет. Основа строительства и машиностроения.',
    usesRu: ['Сталь и строительство', 'Автомобили и мосты', 'Бытовая техника', 'Магниты и трансформаторы'],
    extractionRu: 'Из железной руды в доменных печах: восстановление оксидов коксом, затем выплавка стали.',
  },
  29: {
    captionRu: 'Медь — провода и монеты',
    captionEn: 'Copper — wires and coins',
    appearanceRu: 'Красноватый блестящий металл. Провода, трубы, крыши — медь узнаётся по характерному цвету и патине.',
    usesRu: ['Электропроводка', 'Трубы и отопление', 'Электроника', 'Монеты и сплавы (латунь, бронза)'],
    extractionRu: 'Из медных руд: флотация, плавка, электролитическое рафинирование.',
  },
  47: {
    captionRu: 'Серебро — украшения и зеркала',
    captionEn: 'Silver — jewelry and mirrors',
    appearanceRu: 'Блестящий белый металл, лучший проводник электричества. Тускнеет от сероводорода в воздухе.',
    usesRu: ['Ювелирные изделия', 'Контакты и пайка', 'Зеркала и посуда', 'Фотография (исторически)'],
    extractionRu: 'Как попутный металл при добыче свинца, цинка и меди; также из самородной руды.',
  },
  79: {
    captionRu: 'Золото — монеты и украшения',
    captionEn: 'Gold — coins and jewelry',
    appearanceRu: 'Жёлтый благородный металл, не ржавеет и не тускнеет. Самородки и слитки — символ ценности.',
    usesRu: ['Ювелирные изделия', 'Электроника (контакты)', 'Стоматология', 'Резервы центробанков'],
    extractionRu: 'Из россыпей и руд: цианидное или гравитационное обогащение, плавка.',
  },
}

const STATE_RU = {
  gas: 'Бесцветный газ при обычных условиях.',
  liquid: 'Жидкость при комнатной температуре или в баллоне.',
  solid: 'Твёрдое вещество при комнатной температуре.',
  unknown: 'Вещество с характерным внешним видом в лабораторных образцах.',
}

const BLOCK_USES = {
  's-block': ['Соли и минералы', 'Строительные материалы', 'Металлургия'],
  'p-block': ['Полупроводники', 'Пластмассы', 'Химическая промышленность'],
  'd-block': ['Конструкционные сплавы', 'Кatalizators', 'Покрытия и инструменты'],
  'f-block': ['Ядерная энергетика', 'Научные исследования', 'Специальные сплавы'],
  unknown: ['Научные исследования', 'Специальные технологии', 'Медицина'],
}

function pickUses(block, z) {
  const base = BLOCK_USES[block] ?? BLOCK_USES.unknown
  return base.map((u, i) => (i === 0 ? `${u} (Z=${z})` : u).replace('(Z=' + z + ')', ''))
}

function stateKey(s) {
  const l = (s || '').toLowerCase()
  if (l.includes('gas')) return 'gas'
  if (l.includes('liquid')) return 'liquid'
  if (l.includes('solid')) return 'solid'
  return 'unknown'
}

const profiles = raw
  .filter((e) => e.atomicNumber >= 1 && e.atomicNumber <= 118)
  .map((e) => {
    const z = e.atomicNumber
    const sym = e.symbol
    const ru = namesRu[z - 1] ?? sym
    const en = namesEn[z - 1] ?? sym
    const rich = RICH[z]
    const sk = stateKey(e.standardState)
    const block = e.groupBlock ?? 'unknown'

    const captionRu = rich?.captionRu ?? `${ru} — элемент № ${z} (${sym})`
    const captionEn = rich?.captionEn ?? `${en} — element ${z} (${sym})`
    const appearanceRu =
      rich?.appearanceRu ??
      `${ru} (${sym}): ${STATE_RU[sk]} Атомный номер ${z}, масса ${e.atomicMass} а. е. м.`
    const appearanceEn =
      rich?.appearanceEn ??
      `${en} (${sym}): typical ${e.standardState || 'substance'}. Atomic number ${z}, mass ${e.atomicMass} u.`
    const usesRu = rich?.usesRu ?? [
      `Соединения ${ru.toLowerCase()}`,
      'Лабораторная химия',
      'Промышленные материалы',
      'Научные исследования',
    ]
    const usesEn = rich?.usesEn ??
      rich?.usesRu ?? [
        `${en} compounds`,
        'Laboratory chemistry',
        'Industrial materials',
        'Scientific research',
      ]
    const extractionRu =
      rich?.extractionRu ??
      (sk === 'gas'
        ? 'Из воздуха или природного газа разделением и очисткой.'
        : 'Из руд и минералов: обогащение, плавка или электролиз — в зависимости от элемента.')
    const extractionEn =
      rich?.extractionEn ??
      rich?.extractionRu ??
      (sk === 'gas'
        ? 'From air or natural gas by separation and purification.'
        : 'From ores and minerals: enrichment, smelting or electrolysis.')

    return {
      z,
      symbol: sym,
      captionRu,
      captionEn,
      appearanceRu,
      appearanceEn,
      usesRu,
      usesEn,
      extractionRu,
      extractionEn,
    }
  })

const outDir = path.join(root, 'src/data/elementRealLife')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(
  path.join(outDir, 'elementRealLifeProfiles.json'),
  JSON.stringify(profiles, null, 2),
  'utf8',
)
console.log(`Wrote ${profiles.length} element profiles.`)
