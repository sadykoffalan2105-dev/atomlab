/**
 * Энциклопедия химии для офлайн ИИ-учителя: свободные тексты Википедии (лицензия CC BY-SA 4.0) → шард базы знаний.
 *
 *   npm run teacher:encyclopedia            — собрать src/data/kb/corpus/kb-corpus-wiki-{a,b}.json и
 *                                             src/data/teacher/scientistsIndex.json (затем npm run kb:index)
 *   npx tsx scripts/teacher-ml/build-encyclopedia.mts --max 1800   — меньше статей (быстрее)
 *
 * Источник: API Википедии (ru / en / uz), только вступления статей, обрезка до ~2500 символов по границе
 * предложения. Все ответы API кешируются в .tmp/wiki-cache/, повторный запуск почти не ходит в сеть.
 * Каждый фрагмент подписан источником и лицензией: «Википедия (CC BY-SA 4.0)». Статьи с инструкциями
 * синтеза (взрывчатка, яды, наркотики) отбрасываются по ключевым словам.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { KbChunk } from '../../src/learn/kb/types.ts'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const CACHE = path.join(ROOT, '.tmp', 'wiki-cache')
const CORPUS_DIR = path.join(ROOT, 'src', 'data', 'kb', 'corpus')
const TEACHER_DIR = path.join(ROOT, 'src', 'data', 'teacher')
fs.mkdirSync(CACHE, { recursive: true })
fs.mkdirSync(TEACHER_DIR, { recursive: true })

const UA = 'ATOMLAB-school-chemistry/1.0 (education; sadykoffalan2105@gmail.com)'
const argv = process.argv.slice(2)
const argNum = (name: string, def: number) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : def
}
const MAX_ARTICLES = argNum('--max', 3600)
/** --prefetch k n: параллельный «разогрев» кеша — только каждая n-я пачка (k-я по счёту), без записи выходных файлов. */
const PREFETCH = argv.includes('--prefetch') ? { k: argNum('--prefetch', 0), n: Number(argv[argv.indexOf('--prefetch') + 2] ?? 1) } : null
const DELAY_MS = 180
const RU_CHARS = 2500
const EN_CHARS = 1500
const UZ_CHARS = 1200

export type WikiTag = 'scientist' | 'history' | 'industry' | 'everyday' | 'method' | 'element' | 'compound' | 'concept' | 'uzbekistan'
export type WikiChunk = KbChunk & { tags: WikiTag[]; keywords?: string[] }

// ------------------------------------------------------------------ HTTP с кешем
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let netCalls = 0
async function apiGet(host: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  const key = crypto.createHash('sha1').update(url).digest('hex')
  const file = path.join(CACHE, `${key}.json`)
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
    } catch {
      /* битый кеш — перекачиваем */
    }
  }
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      netCalls += 1
      const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as Record<string, unknown>
      fs.writeFileSync(file, JSON.stringify(json))
      await sleep(DELAY_MS)
      return json
    } catch (e) {
      lastErr = e
      await sleep(600 * (attempt + 1))
    }
  }
  console.warn(`[wiki] сбой ${url.slice(0, 120)}…: ${String(lastErr)}`)
  return {}
}

// ------------------------------------------------------------------ категории
type CatSpec = { title: string; tag: WikiTag; depth?: number; cap?: number }
const CATEGORIES: CatSpec[] = [
  { title: 'Категория:Лауреаты Нобелевской премии по химии', tag: 'scientist', cap: 220 },
  { title: 'Категория:Химики России', tag: 'scientist', depth: 2, cap: 300 },
  { title: 'Категория:Химики Узбекистана', tag: 'uzbekistan', depth: 2, cap: 120 },
  { title: 'Категория:Химики по алфавиту', tag: 'scientist', cap: 400 },
  { title: 'Категория:История химии', tag: 'history', depth: 2, cap: 220 },
  { title: 'Категория:Разделы химии', tag: 'concept', cap: 120 },
  { title: 'Категория:Химические элементы', tag: 'element', cap: 160 },
  { title: 'Категория:Химические процессы', tag: 'concept', depth: 2, cap: 220 },
  { title: 'Категория:Химическая технология', tag: 'industry', depth: 2, cap: 220 },
  { title: 'Категория:Химическая промышленность', tag: 'industry', depth: 2, cap: 200 },
  { title: 'Категория:Аналитическая химия', tag: 'method', depth: 2, cap: 200 },
  { title: 'Категория:Физическая химия', tag: 'concept', depth: 2, cap: 220 },
  { title: 'Категория:Биохимия', tag: 'concept', depth: 2, cap: 220 },
  { title: 'Категория:Органическая химия', tag: 'concept', depth: 2, cap: 220 },
  { title: 'Категория:Неорганическая химия', tag: 'concept', depth: 2, cap: 220 },
  { title: 'Категория:Полимеры', tag: 'compound', depth: 2, cap: 160 },
  { title: 'Категория:Химия окружающей среды', tag: 'everyday', depth: 2, cap: 150 },
  { title: 'Категория:Нанотехнология', tag: 'concept', cap: 100 },
  { title: 'Категория:Электрохимия', tag: 'concept', depth: 2, cap: 160 },
  { title: 'Категория:Химические законы', tag: 'concept', cap: 80 },
  { title: 'Категория:Химические теории', tag: 'concept', cap: 80 },
  { title: 'Категория:Лабораторное оборудование', tag: 'method', depth: 2, cap: 160 },
  { title: 'Категория:Классы химических соединений', tag: 'compound', depth: 2, cap: 220 },
  { title: 'Категория:Моющие средства', tag: 'everyday', cap: 60 },
  { title: 'Категория:Удобрения', tag: 'industry', cap: 80 },
  { title: 'Категория:Взрывчатые вещества', tag: 'industry', cap: 40 },
]

/** Явный список ключевых тем: сюда же добавляются EN-версии (langlinks). */
const KEY_TOPICS: { title: string; tag: WikiTag }[] = [
  ...[
    'Ломоносов, Михаил Васильевич', 'Менделеев, Дмитрий Иванович', 'Бутлеров, Александр Михайлович', 'Лавуазье, Антуан Лоран',
    'Дальтон, Джон', 'Авогадро, Амедео', 'Берцелиус, Йёнс Якоб', 'Аррениус, Сванте Август', 'Склодовская-Кюри, Мария', 'Кюри, Пьер',
    'Резерфорд, Эрнест', 'Бор, Нильс', 'Полинг, Лайнус', 'Габер, Фриц', 'Бош, Карл', 'Нернст, Вальтер', 'Фарадей, Майкл', 'Дэви, Гемфри',
    'Пристли, Джозеф', 'Шееле, Карл Вильгельм', 'Бойль, Роберт', 'Гей-Люссак, Жозеф Луи', 'Либих, Юстус фон', 'Вёлер, Фридрих',
    'Кекуле, Фридрих Август', 'Зинин, Николай Николаевич', 'Марковников, Владимир Васильевич', 'Зелинский, Николай Дмитриевич',
    'Семёнов, Николай Николаевич', 'Лебедев, Сергей Васильевич', 'Курнаков, Николай Семёнович', 'Ипатьев, Владимир Николаевич',
    'Чугаев, Лев Александрович', 'Вернадский, Владимир Иванович', 'Ферсман, Александр Евгеньевич', 'Садыков, Абид Садыкович',
    'Юнусов, Сабир Юнусович', 'Ибн Сина', 'Бируни, Абу Рейхан', 'Джабир ибн Хайян', 'Ар-Рази, Абу Бакр Мухаммад', 'Пруст, Жозеф Луи',
    'Рамзай, Уильям', 'Муассан, Анри', 'Оствальд, Вильгельм', 'Гиббс, Джозайя Уиллард', 'Ле Шателье, Анри Луи', 'Вант-Гофф, Якоб Хендрик',
    'Фишер, Эмиль Герман', 'Содди, Фредерик', 'Мозли, Генри', 'Чедвик, Джеймс', 'Томсон, Джозеф Джон', 'Беккерель, Антуан Анри',
    'Сиборг, Гленн Теодор', 'Флёров, Георгий Николаевич', 'Оганесян, Юрий Цолакович', 'Бертолле, Клод Луи', 'Кавендиш, Генри',
    'Гесс, Герман Иванович', 'Каблуков, Иван Алексеевич', 'Несмеянов, Александр Николаевич', 'Арбузов, Александр Ерминингельдович',
    'Фаворский, Алексей Евграфович', 'Коновалов, Дмитрий Петрович', 'Бородин, Александр Порфирьевич', 'Клапрот, Мартин Генрих',
    'Велер, Фридрих', 'Санжер, Фредерик', 'Уотсон, Джеймс Дьюи', 'Крик, Фрэнсис', 'Франклин, Розалинд', 'Флеминг, Александр',
    'Нобель, Альфред', 'Гудьир, Чарльз', 'Бакеланд, Лео', 'Карозерс, Уоллес', 'Циглер, Карл', 'Натта, Джулио', 'Мидгли, Томас',
    'Молина, Марио', 'Крутцен, Пауль', 'Гуденаф, Джон', 'Ёсино, Акира', 'Уиттингем, Стэнли', 'Бертоцци, Каролин', 'Шарплесс, Барри',
    'Мельдаль, Мортен', 'Бавенди, Мунги', 'Брюс, Луис', 'Екимов, Алексей Иванович', 'Бейкер, Дэвид (биохимик)', 'Хассабис, Демис',
    'Джампер, Джон', 'Лист, Бенджамин', 'Макмиллан, Дэвид', 'Шарпантье, Эмманюэль', 'Даудна, Дженнифер', 'Арнольд, Фрэнсис',
  ].map((title) => ({ title, tag: 'scientist' as WikiTag })),
  ...[
    'Ташкентский химико-технологический институт', 'Институт химии растительных веществ', 'Навоиазот', 'Алмалыкский горно-металлургический комбинат',
    'Максам-Чирчик', 'Шуртанский газохимический комплекс', 'Устюртский газохимический комплекс', 'Национальный университет Узбекистана',
    'Академия наук Республики Узбекистан', 'Мубарекский газоперерабатывающий завод', 'Ферганский нефтеперерабатывающий завод',
    'Навоийский горно-металлургический комбинат', 'Институт общей и неорганической химии АН РУз', 'Институт биоорганической химии имени А. С. Садыкова',
    'Химическая промышленность Узбекистана', 'Экономика Узбекистана', 'Аральское море', 'Кызылкум', 'Газовая промышленность Узбекистана',
  ].map((title) => ({ title, tag: 'uzbekistan' as WikiTag })),
  ...[
    'Процесс Габера', 'Динамит', 'Контактный метод производства серной кислоты', 'Производство серной кислоты', 'Процесс Сольве', 'Процесс Холла — Эру',
    'Крекинг', 'Нефтепереработка', 'Доменный процесс', 'Доменная печь', 'Цемент', 'Стекло', 'Производство бумаги', 'Бумага', 'Аммиачная селитра',
    'Пластмассы', 'Каучук', 'Синтетический каучук', 'Процесс Оствальда', 'Чугун', 'Сталь', 'Кислородно-конвертерный процесс', 'Металлургия',
    'Электролиз', 'Гальванотехника', 'Гальваностегия', 'Коррозия', 'Нефть', 'Природный газ', 'Уголь', 'Кокс', 'Полиэтилен', 'Полипропилен',
    'Поливинилхлорид', 'Полистирол', 'Полиэтилентерефталат', 'Нейлон', 'Капрон', 'Лавсан', 'Тефлон', 'Силикон', 'Керамика', 'Фарфор',
    'Кирпич', 'Бетон', 'Железобетон', 'Минеральные удобрения', 'Азотные удобрения', 'Фосфорные удобрения', 'Калийные удобрения',
    'Суперфосфат', 'Карбамид', 'Хлорная промышленность', 'Содовая промышленность', 'Нефтехимия', 'Газохимия', 'Химическая промышленность',
    'Фармацевтическая промышленность', 'Переработка отходов', 'Переработка пластика', 'Зелёная химия', 'Катализ', 'Катализатор',
    'Гидрирование', 'Пиролиз', 'Риформинг', 'Перегонка нефти', 'Ректификация', 'Обогащение полезных ископаемых', 'Флотация',
    'Выщелачивание', 'Пирометаллургия', 'Гидрометаллургия', 'Электрометаллургия', 'Алюминий', 'Медь', 'Золото', 'Серебро', 'Уран',
  ].map((title) => ({ title, tag: 'industry' as WikiTag })),
  ...[
    'Мыло', 'Стиральный порошок', 'Гидрокарбонат натрия', 'Уксусная кислота', 'Уксус', 'Ацетилсалициловая кислота', 'Пенициллин',
    'Кофеин', 'Глюкоза', 'Крахмал', 'Целлюлоза', 'Белки', 'Дезоксирибонуклеиновая кислота', 'Витамины', 'Электрический аккумулятор',
    'Литий-ионный аккумулятор', 'Топливный элемент', 'Гальванический элемент', 'Косметика', 'Пищевые добавки', 'Парниковый эффект',
    'Озоновый слой', 'Озоновая дыра', 'Кислотный дождь', 'Глобальное потепление', 'Смог', 'Загрязнение воздуха', 'Загрязнение воды',
    'Жёсткость воды', 'Водоподготовка', 'Хлорирование воды', 'Поваренная соль', 'Сахароза', 'Жиры', 'Углеводы', 'Ферменты', 'Гемоглобин',
    'Хлорофилл', 'Фотосинтез', 'Дыхание (физиология)', 'Инсулин', 'Холестерин', 'Адреналин', 'Аминокислоты', 'Нуклеиновые кислоты',
    'Аденозинтрифосфат', 'Этанол', 'Метанол', 'Ацетон', 'Бензин', 'Дизельное топливо', 'Керосин', 'Парафин', 'Вазелин', 'Зубная паста',
    'Шампунь', 'Дезодорант', 'Отбеливатель', 'Гипохлорит натрия', 'Пероксид водорода', 'Йод', 'Активированный уголь', 'Антибиотики',
    'Парацетамол', 'Ибупрофен', 'Анальгин', 'Нитроглицерин', 'Хлорид кальция', 'Карбонат кальция', 'Известь', 'Гипс', 'Мел', 'Мрамор',
    'Соль (пищевая)', 'Сода', 'Кислород', 'Озон', 'Углекислый газ', 'Угарный газ', 'Вода', 'Тяжёлая вода', 'Лёд', 'Снег', 'Радон',
    'Фтор', 'Хлор', 'Бром', 'Азот', 'Фосфор', 'Сера', 'Углерод', 'Кремний', 'Алмаз', 'Графит', 'Графен', 'Фуллерены', 'Углеродные нанотрубки',
    'Железо', 'Цинк', 'Натрий', 'Калий', 'Кальций', 'Магний', 'Литий', 'Водород', 'Гелий', 'Неон', 'Аргон', 'Ртуть', 'Свинец', 'Олово',
    'Титан', 'Хром', 'Марганец', 'Никель', 'Кобальт', 'Платина', 'Вольфрам', 'Молибден', 'Ванадий', 'Бор (элемент)', 'Мышьяк', 'Селен',
    'Кремнезём', 'Песок', 'Глина', 'Полевые шпаты', 'Пищевая промышленность', 'Консерванты', 'Красители', 'Ароматизаторы',
    'Вкусовые добавки', 'Глутамат натрия', 'Нитрат натрия', 'Карамель', 'Шоколад', 'Хлеб', 'Брожение', 'Квашение', 'Сыр', 'Йогурт',
  ].map((title) => ({ title, tag: 'everyday' as WikiTag })),
  ...[
    'Хроматография', 'Спектроскопия', 'Ядерный магнитный резонанс', 'Спектроскопия ядерного магнитного резонанса', 'Масс-спектрометрия',
    'Титриметрический анализ', 'Титрование', 'Рентгеноструктурный анализ', 'Электронный микроскоп', 'Сканирующий туннельный микроскоп',
    'Атомно-силовой микроскоп', 'Инфракрасная спектроскопия', 'Ультрафиолетовая спектроскопия', 'Атомно-абсорбционная спектрометрия',
    'Эмиссионный спектральный анализ', 'Качественный анализ', 'Количественный анализ (химия)', 'Гравиметрический анализ',
    'Газовая хроматография', 'Жидкостная хроматография', 'Электрофорез', 'Полимеразная цепная реакция', 'Индикатор (химия)', 'Лакмус',
    'Фенолфталеин', 'Метилоранж', 'Водородный показатель', 'pH-метр', 'Калориметрия', 'Дифракция рентгеновских лучей', 'Кристаллография',
    'Пробирка', 'Колба', 'Бюретка', 'Пипетка', 'Спиртовка', 'Горелка Бунзена', 'Вытяжной шкаф', 'Центрифуга', 'Дистилляция',
    'Фильтрование', 'Кристаллизация', 'Экстракция', 'Выпаривание', 'Возгонка', 'Перекристаллизация', 'Техника безопасности в химической лаборатории',
  ].map((title) => ({ title, tag: 'method' as WikiTag })),
  ...[
    'Алхимия', 'Флогистон', 'Теория флогистона', 'История открытия кислорода', 'Периодический закон', 'Периодическая система химических элементов',
    'Атомно-молекулярное учение', 'Атомизм', 'Радиоактивность', 'Открытие радиоактивности', 'Нобелевская премия по химии', 'История химии',
    'Химия', 'Философский камень', 'Ятрохимия', 'Закон сохранения массы', 'Закон постоянства состава', 'Закон кратных отношений',
    'Закон Авогадро', 'Закон Гесса', 'Теория химического строения', 'Теория электролитической диссоциации', 'Планетарная модель атома',
    'Модель атома Бора', 'Квантовая химия', 'Открытие химических элементов', 'История открытия химических элементов', 'Хронология открытия химических элементов',
    'Трансурановые элементы', 'Синтез трансурановых элементов', 'Объединённый институт ядерных исследований', 'Манхэттенский проект',
    'Ядерная реакция', 'Деление ядра', 'Термоядерный синтез', 'Атомная энергетика', 'Чернобыльская авария', 'Международный год химии',
    'ИЮПАК', 'Химическая номенклатура', 'Номенклатура ИЮПАК', 'Химическая формула', 'Химическое уравнение', 'Химическая реакция',
    'Химический элемент', 'Атом', 'Молекула', 'Ион', 'Химическая связь', 'Ковалентная связь', 'Ионная связь', 'Металлическая связь',
    'Водородная связь', 'Валентность', 'Степень окисления', 'Электроотрицательность', 'Моль (единица измерения)', 'Молярная масса',
    'Постоянная Авогадро', 'Относительная атомная масса', 'Изотопы', 'Окислительно-восстановительные реакции', 'Кислоты', 'Основания',
    'Соли', 'Оксиды', 'Раствор', 'Растворимость', 'Электролит', 'Электролитическая диссоциация', 'Гидролиз', 'Химическое равновесие',
    'Скорость химической реакции', 'Энергия активации', 'Термохимия', 'Энтальпия', 'Энтропия', 'Органическая химия', 'Неорганическая химия',
    'Аналитическая химия', 'Физическая химия', 'Биохимия', 'Коллоидная химия', 'Химия полимеров', 'Супрамолекулярная химия',
    'Медицинская химия', 'Космохимия', 'Геохимия', 'Агрохимия', 'Радиохимия', 'Фотохимия', 'Электрохимия', 'Нанотехнология',
    'Наноматериалы', 'Углеводороды', 'Алканы', 'Алкены', 'Алкины', 'Арены', 'Бензол', 'Спирты', 'Альдегиды', 'Карбоновые кислоты',
    'Сложные эфиры', 'Амины', 'Полимеры', 'Полимеризация', 'Поликонденсация', 'Изомерия', 'Гомологический ряд', 'Функциональная группа',
    'Металлы', 'Неметаллы', 'Благородные газы', 'Галогены', 'Щелочные металлы', 'Щёлочноземельные металлы', 'Лантаноиды', 'Актиноиды',
    'Сплав', 'Бронза', 'Латунь', 'Дюралюминий', 'Нержавеющая сталь', 'Кристаллическая решётка', 'Аллотропия', 'Аморфные вещества',
  ].map((title) => ({ title, tag: 'history' as WikiTag })),
]

// ------------------------------------------------------------------ фильтры заголовков и текста
const BAD_TITLE = /^(Список|Списки|Категория:|Шаблон:|Портал:|Проект:|Файл:|Википедия:|Хронология|Таблица|Сравнение|Глоссарий|Указатель|\d{3,4}(\s|$)|Премия|Медаль|Конкурс|Олимпиада|Журнал|Издательство|Факультет|Кафедра)/i
const BAD_TITLE_IN = /\(значения\)|\(фильм\)|\(альбом\)|\(песня\)|\(игра\)|\(роман\)|\(книга\)|\(телесериал\)|\(футболист\)|\(компания\)|\(группа\)|\(музыкант\)|\(актёр\)|\(актриса\)|\(политик\)|\(писатель\)|\(поэт\)|\(художник\)|\(улица\)|\(станция|\(посёлок\)|\(село\)|\(деревня\)|\(река\)|\(озеро\)|\(город\)|^Год |^Международный день|в \d{4} году$|по годам$/i
/** Статьи-инструкции (взрывчатка, яды, наркотики): такие тексты в школьный шард не попадают. */
const UNSAFE_TEXT = /рецепт(ур)?\w*\s+(изготовлен|получен|приготовлен)|в домашних условиях|кустарн\w+ (изготов|производ|синтез)|самодельн\w+ взрыв|изготовить (дома|самостоятельно|своими руками)|смеша(ть|йте|в)\s[^.]{0,60}(в соотношении|в пропорции)\s*\d|пошагов\w+ (инструкци|синтез)|инструкци\w+ по (изготовлению|синтезу|приготовлению)/i
const UNSAFE_TITLE = /наркот|психотроп|психоактив|боевое отравляющее|отравляющ\w+ вещество|нервно-паралитич|зарин|зоман|иприт|люизит|VX|новичок \(|фосген|синильн|цианид калия|цианистый калий|рицин|стрихнин|террор|самодельн|бомба|граната|мина \(|снаряд|детонатор|капсюль|взрыватель|пороховой заряд|боеприпас|оружие/i

function okTitle(t: string): boolean {
  if (!t || t.length > 90) return false
  if (BAD_TITLE.test(t) || BAD_TITLE_IN.test(t) || UNSAFE_TITLE.test(t)) return false
  if (/^\d+$/.test(t)) return false
  return true
}

const COMBINING_ACCENT = /[́̀҄̑]/g
const LANG_IN_PAREN = /(^|[\s(;,])(англ|нем|фр|лат|греч|др\.-греч|итал|исп|швед|дат|нидерл|польск|укр|узб|араб|перс|кит|яп|лит|латыш|эст|фин|венг|чеш|словац|рум|тур|порт|норв|тадж|казах|кирг|туркм|азерб|груз|арм|ивр|хинди|МФА|произносится|устар|сокр|сокращённо|от лат|от греч)\.?\s/
function cleanText(raw: string): string {
  let t = raw.replace(COMBINING_ACCENT, '')
  t = t.replace(/\[\d+\]|\[\w{1,3}\.?\s?\d*\]/g, '') // сноски [1], [прим. 2]
  t = t.replace(/\n=+[^=\n]+=+\s*/g, '\n') // заголовки разделов «== История ==»
  // транскрипции и переводы в скобках: «(фр. Antoine Lavoisier; 26 августа 1743 — …)» → «(26 августа 1743 — …)»,
  // «(от др.-греч. χρῶμα — «цвет»)» → убираем целиком (внутри нет дат)
  t = t.replace(/\(((?:[^;()]*?(?:англ|нем|фр|лат|греч|др\.-греч|итал|исп|швед|дат|нидерл|польск|укр|узб|араб|перс|кит|яп|лит|латыш|эст|фин|венг|чеш|словац|рум|тур|порт|норв|тадж|казах|кирг|туркм|азерб|груз|арм|ивр|хинди|МФА)\.?\s[^;()]*;\s*)+)/g, '(')
  t = t.replace(/\s*\(([^()]*)\)/g, (m, inner: string) => (LANG_IN_PAREN.test(inner) && !/\d{3,4}/.test(inner) ? '' : m))
  t = t.replace(/\s*\(\s*\)/g, '')
  t = t.replace(/[ \t]+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/\n{3,}/g, '\n\n').trim()
  return t
}

function cutSentences(text: string, max: number): string {
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (stop > max * 0.45) return slice.slice(0, stop + 1)
  return slice.slice(0, slice.lastIndexOf(' ')).trim() + '…'
}

// ------------------------------------------------------------------ сбор заголовков
type Plan = { title: string; tag: WikiTag; key: boolean }
const plan = new Map<string, Plan>()
function addTitle(title: string, tag: WikiTag, key = false) {
  const t = title.replace(/_/g, ' ').trim()
  if (!okTitle(t)) return
  const prev = plan.get(t)
  if (prev) {
    if (key) prev.key = true
    // учёный Узбекистана важнее общего «scientist»
    if (tag === 'uzbekistan' && prev.tag === 'scientist') prev.tag = 'uzbekistan'
    return
  }
  plan.set(t, { title: t, tag, key })
}

async function categoryMembers(cat: string, type: 'page' | 'subcat', cap: number): Promise<string[]> {
  const out: string[] = []
  let cont: string | undefined
  for (let i = 0; i < 6 && out.length < cap; i++) {
    const res = await apiGet('ru.wikipedia.org', {
      action: 'query',
      list: 'categorymembers',
      cmtitle: cat,
      cmtype: type,
      cmlimit: '500',
      cmnamespace: type === 'page' ? '0' : '14',
      ...(cont ? { cmcontinue: cont } : {}),
    })
    const q = res.query as { categorymembers?: { title: string }[] } | undefined
    for (const m of q?.categorymembers ?? []) out.push(m.title)
    cont = (res.continue as { cmcontinue?: string } | undefined)?.cmcontinue
    if (!cont) break
  }
  return out.slice(0, cap)
}

/** Подкатегории, где могут оказаться не химики: пропускаем по названию. */
const BAD_SUBCAT = /футбол|музык|кино|политик|спорт|военн|религи|литератур|искусств|шахмат|депутат|эпоним|награ|премии|медали|улиц|памятник|похоронен|умерш|родивш|персонал|по годам|по алфавиту|по странам$|члены|почётные|выпускники|преподаватели/i

async function collectTitles() {
  for (const k of KEY_TOPICS) addTitle(k.title, k.tag, true)
  for (const cat of CATEGORIES) {
    const before = plan.size
    const cap = cat.cap ?? 200
    const pages = await categoryMembers(cat.title, 'page', cap)
    for (const t of pages) addTitle(t, cat.tag)
    if ((cat.depth ?? 1) >= 2) {
      const subcats = (await categoryMembers(cat.title, 'subcat', 40)).filter((s) => !BAD_SUBCAT.test(s))
      let budget = cap
      for (const sub of subcats.slice(0, 24)) {
        if (budget <= 0) break
        const sp = await categoryMembers(sub, 'page', Math.min(120, budget))
        for (const t of sp) addTitle(t, cat.tag)
        budget -= sp.length
      }
    }
    console.log(`[wiki] ${cat.title}: +${plan.size - before} (всего ${plan.size})`)
    if (plan.size >= MAX_ARTICLES) break
  }
}

// ------------------------------------------------------------------ тексты
type Extract = { title: string; text: string; pageid?: number }
async function fetchExtracts(host: string, titles: string[], chars: number, intro = true): Promise<Map<string, Extract>> {
  const out = new Map<string, Extract>()
  for (let i = 0; i < titles.length; i += 20) {
    if (PREFETCH && (i / 20) % PREFETCH.n !== PREFETCH.k) continue
    const batch = titles.slice(i, i + 20)
    const res = await apiGet(host, {
      action: 'query',
      prop: 'extracts',
      explaintext: '1',
      exintro: intro ? '1' : '0',
      exlimit: '20',
      exchars: String(chars),
      redirects: '1',
      titles: batch.join('|'),
    })
    const q = res.query as { pages?: { title: string; extract?: string; pageid?: number; missing?: boolean }[]; redirects?: { from: string; to: string }[] } | undefined
    const back = new Map<string, string>()
    for (const r of q?.redirects ?? []) back.set(r.to, r.from)
    for (const p of q?.pages ?? []) {
      if (!p.extract || p.missing) continue
      const requested = back.get(p.title) ?? p.title
      const e = { title: p.title, text: p.extract, pageid: p.pageid }
      out.set(requested, e)
      out.set(p.title, e)
    }
    if ((i / 20) % 25 === 0) console.log(`[wiki] ${host}: ${Math.min(i + 20, titles.length)}/${titles.length}`)
  }
  return out
}

async function langlinks(titles: string[], lang: 'en' | 'uz'): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const res = await apiGet('ru.wikipedia.org', {
      action: 'query',
      prop: 'langlinks',
      lllang: lang,
      lllimit: '500',
      redirects: '1',
      titles: batch.join('|'),
    })
    const q = res.query as { pages?: { title: string; langlinks?: { lang: string; title: string }[] }[]; redirects?: { from: string; to: string }[] } | undefined
    const back = new Map<string, string>()
    for (const r of q?.redirects ?? []) back.set(r.to, r.from)
    for (const p of q?.pages ?? []) {
      const ll = p.langlinks?.find((l) => l.lang === lang)
      if (ll) {
        out.set(p.title, ll.title)
        const from = back.get(p.title)
        if (from) out.set(from, ll.title)
      }
    }
  }
  return out
}

// ------------------------------------------------------------------ учёные: распознавание и индекс
const PERSON_RE = /^([А-ЯЁ][а-яёА-ЯЁ'’-]+(?:\s[А-ЯЁ][а-яёА-ЯЁ'’-]+){0,2}),\s[А-ЯЁ]/ // «Менделеев, Дмитрий Иванович»
const SCIENTIST_TEXT_RE = /(хими[кч]|физико-?хими|биохими|учён|естествоиспытател|алхими|фармацевт|металлург|минералог|технолог|физик|врач|изобретател|инженер|академик|профессор|лауреат)/i

export type ScientistEntry = {
  id: string
  title: string
  surname: string
  variants: string[]
  years?: string
  where?: string
  known?: string
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}
const translit = (s: string) => s.toLowerCase().split('').map((c) => TRANSLIT[c] ?? c).join('')

function scientistEntry(chunk: WikiChunk, enTitle?: string): ScientistEntry | null {
  const m = chunk.title.match(PERSON_RE)
  const surnameRaw = m ? m[1] : chunk.title.split(/[\s(]/)[0]
  const surname = surnameRaw.replace(/-$/, '')
  if (!surname || surname.length < 3) return null
  const first = chunk.text.split(/(?<=[.!?])\s/)[0] ?? ''
  const years = first.match(/\b(1[5-9]\d\d|20[0-2]\d)\b[^)]{0,80}?[—–-][^)]{0,80}?\b(1[5-9]\d\d|20[0-2]\d)\b/)
  const yearsBorn = !years ? first.match(/\b(род\.|родился|родилась)[^)]{0,40}?\b(1[89]\d\d|20[0-2]\d)\b/) : null
  // «за что известен» — после закрывающей скобки дат: «(1834 — 1907) — русский химик…»
  const close = first.indexOf(') — ')
  const dash = close >= 0 ? close + 1 : first.indexOf(' — ')
  let known = dash >= 0 ? first.slice(dash + 3).trim() : ''
  known = known.replace(/^[,.;:\s]+/, '')
  if (known.length > 180) known = `${known.slice(0, 177).replace(/[,;:\s]+\S*$/, '')}…`
  const where = known.match(/^([а-яё-]+(?:\s[а-яё-]+)?)\s+(?:учён|хими|физ|биохим|естеств|алхим|врач|фармац|инжен|изобр|метал|минер|технол|акад|проф)/i)?.[1]
  const variants = new Set<string>([surname.toLowerCase(), surname.toLowerCase().replace(/ё/g, 'е'), translit(surname)])
  if (enTitle) {
    const enSur = enTitle.replace(/\s*\(.*\)$/, '').split(' ').pop()
    if (enSur && enSur.length >= 3) variants.add(enSur.toLowerCase())
  }
  return {
    id: chunk.id,
    title: chunk.title,
    surname,
    variants: [...variants],
    years: years ? `${years[1]}–${years[2]}` : yearsBorn ? `род. ${yearsBorn[2]}` : undefined,
    where,
    known: known || undefined,
  }
}

// ------------------------------------------------------------------ main
async function main() {
  const t0 = Date.now()
  await collectTitles()
  const titles = [...plan.values()].slice(0, MAX_ARTICLES)
  console.log(`[wiki] заголовков к загрузке: ${titles.length} (сеть: ${netCalls} запросов)`)

  const ru = await fetchExtracts('ru.wikipedia.org', titles.map((p) => p.title), 3000, true)
  if (PREFETCH) {
    console.log(`[wiki] prefetch ${PREFETCH.k}/${PREFETCH.n} готов (${netCalls} запросов)`)
    return
  }
  // ключевые темы с коротким вступлением: берём начало статьи целиком (по одной, без exintro)
  const shortKeys = titles.filter((p) => p.key && (ru.get(p.title)?.text.length ?? 0) < 1100).map((p) => p.title)
  for (const t of shortKeys) {
    const more = await fetchExtracts('ru.wikipedia.org', [t], 3000, false)
    const e = more.get(t)
    if (e && e.text.length > (ru.get(t)?.text.length ?? 0)) ru.set(t, e)
  }

  const chunks: WikiChunk[] = []
  const seen = new Set<string>()
  const skipped = { unsafe: 0, short: 0, dup: 0, missing: 0, notChem: 0 }
  let n = 0
  for (const p of titles) {
    const e = ru.get(p.title)
    if (!e) {
      skipped.missing++
      continue
    }
    if (seen.has(e.title)) {
      skipped.dup++
      continue
    }
    const text = cutSentences(cleanText(e.text), RU_CHARS)
    if (text.length < 180) {
      skipped.short++
      continue
    }
    if (UNSAFE_TEXT.test(text) || UNSAFE_TITLE.test(e.title)) {
      skipped.unsafe++
      continue
    }
    const isPerson = PERSON_RE.test(e.title) || /^(Ибн|Абу|Джабир|Ар-|Аль-)/.test(e.title)
    let tag = p.tag
    if (isPerson) {
      // персоналии вне химии (попали из широких категорий) — пропускаем
      if (!SCIENTIST_TEXT_RE.test(text.slice(0, 400))) {
        skipped.notChem++
        continue
      }
      if (tag !== 'uzbekistan') tag = 'scientist'
      if (/узбек|Ташкент|Самарканд|Бухар|Узбекистан/i.test(text.slice(0, 600)) && tag === 'scientist') tag = 'uzbekistan'
    } else if (tag === 'scientist') {
      tag = 'history'
    }
    seen.add(e.title)
    n += 1
    const keywords = isPerson ? [e.title.split(',')[0]] : []
    chunks.push({
      id: `wiki-${n}`,
      grade: null,
      title: e.title,
      type: 'encyclopedia',
      lang: 'ru',
      text,
      source: 'Википедия (CC BY-SA 4.0)',
      tags: [tag],
      ...(keywords.length ? { keywords } : {}),
    })
  }
  console.log(`[wiki] ru: ${chunks.length} статей; пропущено`, skipped)

  // EN-версии ключевых тем (+ учёные), UZ — элементы и классики
  const ruByTitle = new Map(chunks.map((c) => [c.title, c]))
  const keyTitles = [...new Set(titles.filter((p) => p.key).map((p) => ru.get(p.title)?.title ?? p.title))].filter((t) => ruByTitle.has(t)).slice(0, 420)
  const enLinks = await langlinks(keyTitles, 'en')
  const enMap = await fetchExtracts('en.wikipedia.org', [...new Set(enLinks.values())], EN_CHARS, true)
  let enCount = 0
  const enTitleOf = new Map<string, string>()
  for (const [ruTitle, enTitle] of enLinks) {
    const base = ruByTitle.get(ruTitle)
    const e = enMap.get(enTitle)
    if (!base || !e) continue
    const text = cutSentences(cleanText(e.text), EN_CHARS)
    if (text.length < 150 || UNSAFE_TEXT.test(text)) continue
    enTitleOf.set(ruTitle, e.title)
    enCount += 1
    chunks.push({ id: `${base.id}-en`, grade: null, title: e.title, type: 'encyclopedia', lang: 'en', text, source: 'Wikipedia (CC BY-SA 4.0)', tags: base.tags })
  }
  const uzCandidates = keyTitles.filter((t) => {
    const c = ruByTitle.get(t)
    return c && (c.tags.includes('scientist') || c.tags.includes('uzbekistan') || c.tags.includes('element') || c.tags.includes('everyday'))
  })
  const uzLinks = await langlinks(uzCandidates.slice(0, 200), 'uz')
  const uzMap = await fetchExtracts('uz.wikipedia.org', [...new Set(uzLinks.values())], UZ_CHARS, true)
  let uzCount = 0
  for (const [ruTitle, uzTitle] of uzLinks) {
    const base = ruByTitle.get(ruTitle)
    const e = uzMap.get(uzTitle)
    if (!base || !e) continue
    const text = cutSentences(cleanText(e.text), UZ_CHARS)
    if (text.length < 120) continue
    uzCount += 1
    chunks.push({ id: `${base.id}-uz`, grade: null, title: e.title, type: 'encyclopedia', lang: 'uz', text, source: 'Vikipediya (CC BY-SA 4.0)', tags: base.tags })
  }
  console.log(`[wiki] en: ${enCount}, uz: ${uzCount}`)

  // индекс учёных: фамилия → статья, годы, страна, за что известен (только из первых предложений)
  const scientists: ScientistEntry[] = []
  for (const c of chunks) {
    if (c.lang !== 'ru' || !(c.tags.includes('scientist') || c.tags.includes('uzbekistan'))) continue
    if (!(PERSON_RE.test(c.title) || /^(Ибн|Абу|Джабир|Ар-|Аль-)/.test(c.title))) continue
    const s = scientistEntry(c, enTitleOf.get(c.title))
    if (s) scientists.push(s)
  }
  const sciFile = { version: 1, generatedAt: new Date().toISOString(), source: 'Википедия (CC BY-SA 4.0)', count: scientists.length, scientists }
  fs.writeFileSync(path.join(TEACHER_DIR, 'scientistsIndex.json'), JSON.stringify(sciFile))

  // корпус: при > 6 МБ делим на wiki-a / wiki-b
  const stamp = new Date().toISOString()
  const write = (name: string, list: WikiChunk[]) => {
    const body = { version: 1, shard: name, generatedAt: stamp, license: 'CC BY-SA 4.0', count: list.length, chunks: list }
    const json = JSON.stringify(body)
    fs.writeFileSync(path.join(CORPUS_DIR, `kb-corpus-${name}.json`), json)
    console.log(`[wiki] ${name}: ${list.length} фрагментов, ${(Buffer.byteLength(json) / 1024 / 1024).toFixed(2)} МБ`)
  }
  for (const old of ['kb-corpus-wiki.json', 'kb-corpus-wiki-a.json', 'kb-corpus-wiki-b.json']) {
    const f = path.join(CORPUS_DIR, old)
    if (fs.existsSync(f)) fs.unlinkSync(f)
  }
  const total = Buffer.byteLength(JSON.stringify(chunks))
  if (total > 6 * 1024 * 1024) {
    const half = Math.ceil(chunks.length / 2)
    write('wiki-a', chunks.slice(0, half))
    write('wiki-b', chunks.slice(half))
  } else {
    write('wiki', chunks)
  }
  const chars = chunks.reduce((s, c) => s + c.text.length, 0)
  console.log(
    `[wiki] готово: ${chunks.length} фрагментов (${chunks.filter((c) => c.lang === 'ru').length} ru), учёных ${scientists.length}, ${(chars / 1e6).toFixed(2)} млн символов, ${netCalls} сетевых запросов, ${((Date.now() - t0) / 1000).toFixed(0)} с`,
  )
}

await main()
