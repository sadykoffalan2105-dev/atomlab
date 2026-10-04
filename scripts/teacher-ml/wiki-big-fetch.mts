/**
 * Большая энциклопедия учителя (wf16): сбор вступлений статей русской Википедии (CC BY-SA 4.0) по категориям.
 *
 *   npx tsx scripts/teacher-ml/wiki-big-fetch.mts            — собрать .tmp/wiki-big/raw/*.jsonl (с докачкой)
 *   npx tsx scripts/teacher-ml/wiki-big-fetch.mts --only bio — только категории, где id содержит «bio»
 *
 * Вежливо: свой User-Agent, запросы строго последовательно, maxlag=5, повтор с паузой при 429/503/maxlag.
 * generator=categorymembers + prop=extracts (exintro, explaintext) — 20 статей на запрос.
 * Каждая категория пишется в свой .jsonl; готовая категория (есть файл .done) повторно не качается.
 * Затем: npx tsx scripts/teacher-ml/wiki-big-build.mts (шарды в public/kb/wiki/).
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const OUT = path.join(ROOT, '.tmp', 'wiki-big', 'raw')
fs.mkdirSync(OUT, { recursive: true })
const UA = 'ATOMLAB-edu-bot/1.0 (https://' + 'github.com/sadykoffalan2105-dev/atomlab; educational offline teacher)'
const HOST = 'ru.wikipedia.org'
const argv = process.argv.slice(2)
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let calls = 0
let failures = 0
/** Пауза между запросами; растёт при 429 (бережём API), медленно возвращается обратно. */
let pace = 200
async function api(params: Record<string, string>): Promise<Record<string, any>> {
  const url = `https://${HOST}/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', maxlag: '5', ...params })}`
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(pace)
    try {
      calls++
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })
      if (res.status === 429 || res.status === 503) {
        const ra = Number(res.headers.get('retry-after')) || 0
        pace = Math.min(3000, pace * 2)
        console.warn(`[wiki-big] ${res.status}, пауза ${Math.max(ra, 5 * (attempt + 1))} с, шаг ${pace} мс`)
        await sleep(1000 * Math.max(ra, 5 * (attempt + 1)))
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as Record<string, any>
      if (json.error?.code === 'maxlag') {
        await sleep(3000 * (attempt + 1))
        continue
      }
      pace = Math.max(200, Math.round(pace * 0.9))
      return json
    } catch (e) {
      await sleep(800 * (attempt + 1))
      if (attempt === 5) console.warn(`[wiki-big] сбой: ${String(e)}`)
    }
  }
  failures++
  return {}
}

/** id — короткое имя группы (для --only), cat — категория, depth — глубина подкатегорий, cap — максимум статей. */
type Spec = { id: string; tag: string; cat: string; depth: number; cap: number }
const S = (id: string, tag: string, cat: string, depth: number, cap: number): Spec => ({ id, tag, cat: `Категория:${cat}`, depth, cap })

export const SPECS: Spec[] = [
  // ---------- химия
  S('chem-el', 'chemistry', 'Химические элементы', 1, 200),
  S('chem-inorg', 'chemistry', 'Неорганические вещества', 2, 1500),
  S('chem-org', 'chemistry', 'Органические вещества', 2, 1500),
  S('chem-react', 'chemistry', 'Химические реакции', 2, 900),
  S('chem-proc', 'chemistry', 'Химические процессы', 2, 500),
  S('chem-lab', 'chemistry', 'Лабораторное оборудование', 2, 400),
  S('chem-lab2', 'chemistry', 'Лабораторная посуда', 1, 200),
  S('chem-ind', 'chemistry', 'Химическая промышленность', 2, 700),
  S('chem-tech', 'chemistry', 'Химическая технология', 2, 600),
  S('chem-hist', 'chemistry', 'История химии', 2, 500),
  S('chem-people', 'scientist', 'Химики по алфавиту', 0, 1500),
  S('chem-nobel', 'scientist', 'Лауреаты Нобелевской премии по химии', 0, 250),
  S('chem-anal', 'chemistry', 'Аналитическая химия', 2, 500),
  S('chem-phys', 'chemistry', 'Физическая химия', 2, 600),
  S('chem-bio', 'chemistry', 'Биохимия', 2, 700),
  S('chem-poly', 'chemistry', 'Полимеры', 2, 400),
  S('chem-electro', 'chemistry', 'Электрохимия', 2, 300),
  S('chem-mineral', 'earth', 'Минералы по алфавиту', 0, 800),
  S('chem-fert', 'chemistry', 'Удобрения', 1, 150),
  S('chem-food', 'everyday', 'Пищевые добавки', 2, 600),
  S('chem-drug', 'medicine', 'Лекарственные средства по алфавиту', 0, 800),
  S('chem-alloy', 'chemistry', 'Сплавы', 1, 300),
  S('chem-mat', 'chemistry', 'Материалы', 1, 400),
  // ---------- биология и человек
  S('bio-anat', 'biology', 'Анатомия человека', 2, 900),
  S('bio-phys', 'biology', 'Физиология человека', 2, 900),
  S('bio-cell', 'biology', 'Цитология', 2, 500),
  S('bio-gen', 'biology', 'Генетика', 2, 700),
  S('bio-vit', 'biology', 'Витамины', 1, 150),
  S('bio-horm', 'biology', 'Гормоны', 1, 300),
  S('bio-enz', 'biology', 'Ферменты', 1, 400),
  S('bio-eco', 'earth', 'Экология', 2, 900),
  S('bio-bot', 'biology', 'Ботаника', 1, 500),
  S('bio-zoo', 'biology', 'Зоология', 1, 400),
  S('bio-micro', 'biology', 'Микробиология', 2, 500),
  S('bio-evo', 'biology', 'Эволюционная биология', 1, 300),
  S('bio-people', 'scientist', 'Биологи по алфавиту', 0, 600),
  S('bio-nobel', 'scientist', 'Лауреаты Нобелевской премии по физиологии и медицине', 0, 230),
  // ---------- медицина, здоровье, питание
  S('med-dis', 'medicine', 'Болезни по алфавиту', 0, 1400),
  S('med-vacc', 'medicine', 'Вакцинация', 1, 200),
  S('med-hyg', 'medicine', 'Гигиена', 1, 300),
  S('med-nutr', 'medicine', 'Питание', 1, 500),
  S('med-diet', 'medicine', 'Диетология', 1, 300),
  S('med-first', 'safety', 'Первая помощь', 1, 200),
  S('med-people', 'scientist', 'Медики по алфавиту', 0, 400),
  // ---------- физика
  S('phys-q', 'physics', 'Физические величины', 1, 500),
  S('phys-law', 'physics', 'Физические законы', 1, 300),
  S('phys-phen', 'physics', 'Физические явления', 2, 700),
  S('phys-opt', 'physics', 'Оптика', 1, 400),
  S('phys-thermo', 'physics', 'Термодинамика', 1, 300),
  S('phys-el', 'physics', 'Электричество', 1, 300),
  S('phys-mech', 'physics', 'Классическая механика', 1, 300),
  S('phys-atom', 'physics', 'Атомная физика', 1, 300),
  S('phys-nucl', 'physics', 'Ядерная физика', 1, 400),
  S('phys-units', 'physics', 'Единицы измерения', 1, 400),
  S('phys-people', 'scientist', 'Физики по алфавиту', 0, 800),
  S('phys-nobel', 'scientist', 'Лауреаты Нобелевской премии по физике', 0, 230),
  // ---------- Земля, экология, астрономия
  S('earth-geo', 'earth', 'Геология', 1, 500),
  S('earth-met', 'earth', 'Метеорология', 1, 500),
  S('earth-atm', 'earth', 'Атмосфера Земли', 1, 300),
  S('earth-clim', 'earth', 'Климат', 1, 300),
  S('earth-rock', 'earth', 'Горные породы', 1, 400),
  S('earth-hydro', 'earth', 'Гидрология', 1, 300),
  S('earth-poll', 'earth', 'Загрязнение окружающей среды', 1, 300),
  S('astro', 'astronomy', 'Астрономия', 1, 500),
  S('astro-sol', 'astronomy', 'Солнечная система', 2, 700),
  S('astro-stars', 'astronomy', 'Звёзды', 1, 300),
  S('astro-space', 'astronomy', 'Космонавтика', 1, 400),
  // ---------- быт и безопасность
  S('life-safety', 'safety', 'Безопасность жизнедеятельности', 1, 300),
  S('life-fire', 'safety', 'Пожарная безопасность', 1, 200),
  S('life-house', 'everyday', 'Бытовая химия', 1, 200),
  S('life-cook', 'everyday', 'Кулинария', 1, 400),
  S('life-energy', 'everyday', 'Энергетика', 1, 400),
  // ---------- история науки, учёные мира и Узбекистана
  S('hist-sci', 'history', 'История науки', 1, 500),
  S('hist-math', 'scientist', 'Математики по алфавиту', 0, 400),
  S('uz-sci', 'uzbekistan', 'Учёные Узбекистана', 2, 700),
  S('uz-chem', 'uzbekistan', 'Химики Узбекистана', 1, 200),
  S('uz-medieval', 'uzbekistan', 'Учёные Средней Азии', 1, 300),
  S('uz-geo', 'uzbekistan', 'География Узбекистана', 1, 400),
  S('uz-cities', 'uzbekistan', 'Города Узбекистана', 0, 200),
  S('uz-hist', 'uzbekistan', 'История Узбекистана', 1, 400),
  S('islam-sci', 'scientist', 'Учёные исламского Золотого века', 1, 300),
  // — расширение 04.10: «про химию, про жизнь, про всё» —
  S('chem-acid', 'chemistry', 'Кислоты', 1, 400),
  S('chem-salt', 'chemistry', 'Соли', 1, 600),
  S('chem-oxide', 'chemistry', 'Оксиды', 1, 400),
  S('chem-gas', 'chemistry', 'Газы', 1, 300),
  S('chem-solv', 'chemistry', 'Растворители', 1, 200),
  S('chem-dye', 'chemistry', 'Красители', 1, 300),
  S('chem-petro', 'chemistry', 'Нефтехимия', 1, 300),
  S('chem-nano', 'chemistry', 'Нанотехнологии', 1, 200),
  S('chem-cryst', 'chemistry', 'Кристаллография', 1, 300),
  S('chem-quant', 'chemistry', 'Квантовая химия', 1, 200),
  S('chem-iso', 'chemistry', 'Изотопы', 1, 600),
  S('chem-glass', 'chemistry', 'Стекло', 1, 200),
  S('chem-metal', 'chemistry', 'Металлургия', 1, 400),
  S('bio-imm', 'biology', 'Иммунология', 2, 500),
  S('bio-neuro', 'biology', 'Нейробиология', 1, 400),
  S('bio-blood', 'biology', 'Кровь', 1, 200),
  S('bio-mol', 'biology', 'Молекулярная биология', 1, 500),
  S('bio-virus', 'biology', 'Вирусы', 1, 500),
  S('bio-bact', 'biology', 'Бактерии', 1, 400),
  S('bio-plants', 'biology', 'Культурные растения', 1, 600),
  S('bio-fungi', 'biology', 'Грибы', 1, 300),
  S('med-pharm', 'medicine', 'Фармакология', 1, 500),
  S('med-inf', 'medicine', 'Инфекционные заболевания', 1, 600),
  S('med-sport', 'medicine', 'Спортивная медицина', 1, 200),
  S('med-psy', 'medicine', 'Психология', 1, 500),
  S('med-sleep', 'medicine', 'Сон', 1, 150),
  S('phys-wave', 'physics', 'Волны', 1, 300),
  S('phys-elm', 'physics', 'Электромагнетизм', 1, 400),
  S('phys-quant', 'physics', 'Квантовая механика', 1, 400),
  S('phys-sound', 'physics', 'Акустика', 1, 300),
  S('phys-rel', 'physics', 'Теория относительности', 1, 200),
  S('tech-inv', 'history', 'Изобретения', 1, 600),
  S('tech-build', 'everyday', 'Строительные материалы', 1, 400),
  S('life-food', 'everyday', 'Продукты питания', 1, 600),
  S('life-drink', 'everyday', 'Напитки', 1, 300),
  S('life-cosm', 'everyday', 'Косметика', 1, 200),
  S('life-text', 'everyday', 'Ткани', 1, 300),
  S('life-agri', 'everyday', 'Сельское хозяйство', 1, 500),
  S('earth-ocean', 'earth', 'Океанология', 1, 300),
  S('earth-volc', 'earth', 'Вулканология', 1, 300),
  S('earth-soil', 'earth', 'Почвоведение', 1, 300),
  S('earth-water', 'earth', 'Вода', 1, 300),
  S('astro-gal', 'astronomy', 'Галактики', 1, 300),
  S('astro-planets', 'astronomy', 'Планеты', 1, 300),
  S('astro-cosmo', 'astronomy', 'Космология', 1, 300),
  S('sci-inv', 'scientist', 'Изобретатели по алфавиту', 0, 500),
  S('sci-astro', 'scientist', 'Астрономы по алфавиту', 0, 500),
  S('sci-geo', 'scientist', 'Геологи по алфавиту', 0, 300),
  S('uz-nature', 'uzbekistan', 'Природа Узбекистана', 1, 300),
  S('uz-culture', 'uzbekistan', 'Культура Узбекистана', 1, 300),
  S('uz-people', 'uzbekistan', 'Персоналии:Узбекистан', 1, 500),
]

/** Ключевые статьи «по названию» — то, о чём ученики спрашивают чаще всего. */
export const KEY_TITLES: string[] = [
  'Гемоглобин', 'Ибн Сина', 'Рэлеевское рассеяние', 'Фотосинтез', 'Вакцина', 'Озоновый слой', 'Кислород', 'Пристли, Джозеф', 'Шееле, Карл Вильгельм',
  'ДНК', 'РНК', 'Белки', 'Жиры', 'Углеводы', 'Глюкоза', 'Клетка', 'Митохондрия', 'Хлоропласт', 'Хлорофилл', 'Иммунитет (медицина)', 'Антитела', 'Антибиотики',
  'Пенициллин', 'Вирус', 'Бактерии', 'Грипп', 'COVID-19', 'Кровь', 'Эритроциты', 'Лейкоциты', 'Тромбоциты', 'Сердце', 'Лёгкие', 'Печень', 'Почки', 'Мозг',
  'Головной мозг человека', 'Нервная система', 'Нейрон', 'Желудок', 'Пищеварение', 'Инсулин', 'Сахарный диабет', 'Адреналин', 'Гормоны', 'Витамин C',
  'Витамин D', 'Кальций', 'Железо', 'Йод', 'Холестерин', 'Метаболизм', 'Дыхание', 'Клеточное дыхание', 'АТФ', 'Фермент', 'Эволюция', 'Естественный отбор',
  'Дарвин, Чарлз', 'Мендель, Грегор', 'Пастер, Луи', 'Кох, Роберт', 'Флеминг, Александр', 'Павлов, Иван Петрович', 'Мечников, Илья Ильич', 'Гарвей, Уильям',
  'Атмосфера Земли', 'Парниковый эффект', 'Глобальное потепление', 'Кислотный дождь', 'Смог', 'Озон', 'Углекислый газ', 'Круговорот воды в природе',
  'Круговорот углерода', 'Азотный цикл', 'Аральское море', 'Землетрясение', 'Вулкан', 'Тектоника плит', 'Радуга', 'Молния', 'Гром', 'Облака', 'Дождь', 'Снег',
  'Ветер', 'Солнце', 'Луна', 'Земля', 'Марс', 'Венера', 'Юпитер', 'Сатурн', 'Меркурий (планета)', 'Уран (планета)', 'Нептун', 'Плутон (карликовая планета)', 'Чёрная дыра',
  'Галактика', 'Млечный Путь', 'Большой взрыв', 'Звезда', 'Комета', 'Метеорит', 'Гравитация', 'Закон всемирного тяготения', 'Ньютон, Исаак', 'Эйнштейн, Альберт',
  'Теория относительности', 'Галилей, Галилео', 'Коперник, Николай', 'Кеплер, Иоганн', 'Улугбек', 'Обсерватория Улугбека', 'Хорезми, Мухаммад ибн Муса', 'Бируни, Абу Рейхан',
  'Аль-Фараби', 'Авиценна', 'Митохондрии', 'Вакцинация', 'Иммунная система', 'Канон врачебной науки', 'Джабир ибн Хайян', 'Ар-Рази, Абу Бакр Мухаммад', 'Алхимия', 'Атом', 'Молекула', 'Электрон', 'Протон', 'Нейтрон',
  'Изотопы', 'Радиоактивность', 'Ядерная реакция', 'Атомная электростанция', 'Электричество', 'Электрический ток', 'Магнетизм', 'Свет', 'Звук', 'Температура', 'Теплота',
  'Энергия', 'Сила', 'Скорость света', 'Давление', 'Плотность', 'Масса', 'Вес', 'Трение', 'Инерция', 'Агрегатное состояние', 'Плазма (физика)', 'Испарение', 'Кипение',
  'Плавление', 'Кристаллизация', 'Диффузия', 'Осмос', 'Броуновское движение', 'Поверхностное натяжение', 'Капиллярность', 'Вода', 'Лёд', 'Пар', 'Соль', 'Сахар',
  'Хлорид натрия', 'Пищевая сода', 'Уксусная кислота', 'Мыло', 'Стиральный порошок', 'Отбеливатель', 'Зубная паста', 'Фтор', 'Хлор', 'Аммиак', 'Серная кислота',
  'Соляная кислота', 'Азотная кислота', 'Нефть', 'Бензин', 'Природный газ', 'Метан', 'Пластмассы', 'Полиэтилен', 'Стекло', 'Бетон', 'Цемент', 'Сталь', 'Алюминий',
  'Золото', 'Серебро', 'Медь', 'Ртуть', 'Свинец', 'Уран (элемент)', 'Водород', 'Гелий', 'Азот', 'Углерод', 'Алмаз', 'Графит', 'Графен', 'Фуллерены', 'Нанотехнологии',
  'Катализ', 'Фермент', 'Химическая реакция', 'Горение', 'Пламя', 'Огнетушитель', 'Пожар', 'Угарный газ', 'Отравление угарным газом', 'Первая помощь', 'Ожог',
  'Химический ожог', 'Электролиз', 'Аккумулятор', 'Литий-ионный аккумулятор', 'Гальванический элемент', 'Батарейка', 'Коррозия', 'Ржавчина', 'pH', 'Индикатор (химия)',
  'Лакмус', 'Фенолфталеин', 'Титрование', 'Хроматография', 'Спектроскопия', 'Масс-спектрометрия', 'Микроскоп', 'Бунзеновская горелка', 'Пробирка', 'Колба', 'Бюретка',
  'Пипетка', 'Мензурка', 'Химический стакан', 'Чашка Петри', 'Вытяжной шкаф', 'Эксикатор', 'Тигель', 'Аппарат Киппа', 'Делительная воронка', 'Холодильник (лабораторный)',
  'Менделеев, Дмитрий Иванович', 'Периодическая система химических элементов', 'Ломоносов, Михаил Васильевич', 'Лавуазье, Антуан Лоран', 'Склодовская-Кюри, Мария',
  'Нобель, Альфред', 'Нобелевская премия', 'Дальтон, Джон', 'Бойль, Роберт', 'Авогадро, Амедео', 'Резерфорд, Эрнест', 'Бор, Нильс', 'Фарадей, Майкл', 'Тесла, Никола',
  'Эдисон, Томас', 'Архимед', 'Аристотель', 'Демокрит', 'Пифагор', 'Евклид', 'Гиппократ', 'Гален', 'Улугбек', 'Амир Темур', 'Навои, Алишер', 'Бабур',
  'Ташкент', 'Самарканд', 'Бухара', 'Хива', 'Узбекистан', 'Хлопчатник', 'Шёлк', 'Плов', 'Сон', 'Стресс', 'Память (психология)', 'Мышление', 'Эмоции', 'Психология',
  'Здоровый образ жизни', 'Физические упражнения', 'Курение', 'Алкоголь', 'Калория', 'Белки (питание)', 'Пищевые волокна', 'Минеральные вещества', 'Обезвоживание',
  'Аллергия', 'Ангина', 'Простуда', 'Температура тела человека', 'Лихорадка', 'Кариес', 'Зрение', 'Слух', 'Глаз', 'Ухо', 'Кожа', 'Скелет человека', 'Мышцы', 'Кость',
  'Зуб', 'Волосы', 'Беременность', 'Наследственность', 'Ген', 'Хромосома', 'Мутация', 'Клонирование', 'Генная инженерия', 'CRISPR', 'Стволовые клетки', 'Рак (болезнь)',
  'Интернет', 'Компьютер', 'Искусственный интеллект', 'Робот', 'Полупроводник', 'Транзистор', 'Солнечная батарея', 'Ветроэнергетика', 'Гидроэлектростанция',
  'Возобновляемая энергия', 'Переработка отходов', 'Пластиковое загрязнение', 'Микропластик', 'Опустынивание', 'Биоразнообразие', 'Экосистема', 'Пищевая цепь',
  'Фотосинтез', 'Хемосинтез', 'Брожение', 'Дрожжи', 'Плесень', 'Грибы', 'Растения', 'Животные', 'Насекомые', 'Пчёлы', 'Мёд', 'Молоко', 'Хлеб', 'Чай', 'Кофе', 'Кофеин',
  'Шоколад', 'Крахмал', 'Целлюлоза', 'Бумага', 'Хлопок', 'Нейлон', 'Резина', 'Каучук', 'Клей', 'Краска', 'Духи', 'Косметика', 'Парацетамол', 'Аспирин', 'Ибупрофен',
]

type Raw = { id: number; title: string; text: string; tag: string; cat: string }

function clean(text: string): string {
  return text
    .replace(/́/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\(\s*[;,]?\s*\)/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Подкатегории — крупные первыми (prop=categoryinfo): мелкие (< 4 статей) не стоят отдельного запроса. */
async function listSubcats(cat: string): Promise<string[]> {
  const out: { title: string; pages: number }[] = []
  let cont: Record<string, string> = {}
  for (let guard = 0; guard < 3; guard++) {
    const j = await api({ generator: 'categorymembers', gcmtitle: cat, gcmtype: 'subcat', gcmlimit: '500', prop: 'categoryinfo', ...cont })
    for (const p of j.query?.pages ?? []) out.push({ title: p.title as string, pages: Number(p.categoryinfo?.pages ?? 0) })
    if (!j.continue) break
    cont = j.continue
  }
  return out
    .filter((c) => c.pages >= 4)
    .sort((a, b) => b.pages - a.pages)
    .map((c) => c.title)
}

async function pagesWithExtracts(cat: string, budget: number, emit: (r: Omit<Raw, 'tag' | 'cat'>) => void): Promise<number> {
  let got = 0
  let cont: Record<string, string> = {}
  for (let guard = 0; guard < 400 && got < budget; guard++) {
    // prop=cirrusdoc (поле opening_text поискового индекса) — вступление статьи без разбора вики-разметки:
    // в 5–6 раз быстрее prop=extracts и бережнее к серверам (50 статей за запрос)
    const j = await api({
      generator: 'categorymembers',
      gcmtitle: cat,
      gcmtype: 'page',
      gcmnamespace: '0',
      gcmlimit: '50',
      prop: 'cirrusdoc|pageprops',
      cdincludes: 'opening_text',
      ppprop: 'disambiguation',
      ...cont,
    })
    for (const p of j.query?.pages ?? []) {
      if (p.pageprops && 'disambiguation' in p.pageprops) continue
      const text = p.cirrusdoc?.[0]?.source?.opening_text
      if (!text || typeof text !== 'string') continue
      emit({ id: p.pageid, title: p.title, text: clean(text) })
      got++
    }
    if (!j.continue) break
    cont = j.continue
  }
  return got
}

async function fetchTitles(titles: string[], emit: (r: Omit<Raw, 'tag' | 'cat'>) => void) {
  for (let i = 0; i < titles.length; i += 20) {
    // TextExtracts отдаёт вступления не всех 20 страниц сразу — догружаем по continue (excontinue)
    let cont: Record<string, string> = {}
    const done = new Set<number>()
    for (let guard = 0; guard < 20; guard++) {
      const j = await api({ titles: titles.slice(i, i + 20).join('|'), redirects: '1', prop: 'extracts|pageprops', ppprop: 'disambiguation', exintro: '1', explaintext: '1', exlimit: '20', ...cont })
      for (const p of j.query?.pages ?? []) {
        if (p.missing || !p.extract || done.has(p.pageid)) continue
        if (p.pageprops && 'disambiguation' in p.pageprops) continue
        done.add(p.pageid)
        emit({ id: p.pageid, title: p.title, text: clean(p.extract) })
      }
      if (!j.continue) break
      cont = j.continue
    }
  }
}

const t0 = Date.now()
let total = 0
// ключевые статьи — первыми
{
  const file = path.join(OUT, '00-key.jsonl')
  if (!fs.existsSync(`${file}.done`) && (!ONLY || 'key'.includes(ONLY))) {
    const lines: string[] = []
    await fetchTitles([...new Set(KEY_TITLES)], (r) => lines.push(JSON.stringify({ ...r, tag: 'key', cat: 'key' })))
    fs.writeFileSync(file, lines.join('\n'))
    fs.writeFileSync(`${file}.done`, String(lines.length))
    total += lines.length
    console.log(`[wiki-big] key: ${lines.length} статей, ${calls} запросов, ${((Date.now() - t0) / 1000).toFixed(0)} с`)
  }
}
// по кругу между областями (химия → биология → медицина → физика → …): при остановке по времени каждая область уже есть
const groups = new Map<string, Spec[]>()
for (const s of SPECS) {
  const g = s.id.split('-')[0]!
  groups.set(g, [...(groups.get(g) ?? []), s])
}
const ORDER: Spec[] = []
for (let i = 0; ORDER.length < SPECS.length; i++) for (const arr of groups.values()) if (arr[i]) ORDER.push(arr[i]!)
for (const spec of ORDER) {
  if (ONLY && !spec.id.includes(ONLY)) continue
  const file = path.join(OUT, `${spec.id}.jsonl`)
  if (fs.existsSync(`${file}.done`)) continue
  const lines: string[] = []
  const seenCats = new Set<string>()
  const queue: { cat: string; d: number }[] = [{ cat: spec.cat, d: 0 }]
  while (queue.length && lines.length < spec.cap) {
    const { cat, d } = queue.shift()!
    if (seenCats.has(cat)) continue
    seenCats.add(cat)
    await pagesWithExtracts(cat, spec.cap - lines.length, (r) => lines.push(JSON.stringify({ ...r, tag: spec.tag, cat: spec.id })))
    // промежуточная запись: при остановке собранное не теряется (без .done — категория докачается заново)
    if (seenCats.size % 8 === 0) {
      fs.writeFileSync(file, lines.join('\n'))
      console.log(`[wiki-big]   ${spec.id}: ${lines.length} статей, кат. ${seenCats.size}, запросов ${calls}, ${((Date.now() - t0) / 1000).toFixed(0)} с`)
    }
    if (d < spec.depth && lines.length < spec.cap) for (const sc of (await listSubcats(cat)).slice(0, 60)) queue.push({ cat: sc, d: d + 1 })
  }
  fs.writeFileSync(file, lines.join('\n'))
  fs.writeFileSync(`${file}.done`, String(lines.length))
  total += lines.length
  console.log(`[wiki-big] ${spec.id}: ${lines.length} статей (кат. ${seenCats.size}); всего ${total}, запросов ${calls}, ${((Date.now() - t0) / 1000).toFixed(0)} с`)
}
console.log(`[wiki-big] готово: ${total} статей, ${calls} запросов, ${((Date.now() - t0) / 1000).toFixed(0)} с`)
