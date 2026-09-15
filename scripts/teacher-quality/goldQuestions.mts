/**
 * GOLD SET for the local AI teacher answers (no LLM): what a correct answer MUST contain.
 *
 * Every expectation is grounded in the textbook corpus (src/data/kb/corpus/kb-corpus-g*.json);
 * `source` names the paragraph/page where the fact is printed, `lesson` is the app section
 * ("c1-s03") of that grade where a student would ask it (used as the chat/voice context).
 *
 * Matching rules (scripts/teacher-quality/autoScore.mts):
 *   • mustMention — each entry is one required fact; "a|b|c" are alternatives; a multi-word
 *     alternative matches when all its words occur (stem level, any order).
 *   • mustNotMention — typical wrong / off-topic content; same syntax, or "re:<regex>" (case-insensitive)
 *     for wording-level errors ("Смесь – вещество…").
 *   • unanswerable — not in the base: the right behaviour is an honest "нет в базе" + a suggestion.
 *
 * Run: npx tsx scripts/teacher-quality/runAnswers.mts --tag baseline && npx tsx scripts/teacher-quality/autoScore.mts --tag baseline
 */

export type GoldType = 'definition' | 'why' | 'how' | 'example' | 'calc' | 'compare'
export type GoldLocale = 'ru' | 'en' | 'uz'

export interface GoldQuestion {
  id: string
  grade: 7 | 8 | 9 | 10 | 11
  locale: GoldLocale
  question: string
  /** Id of the previous question in the same dialog (follow-up turn). */
  followUpOf?: string
  mustMention: string[]
  mustNotMention?: string[]
  type: GoldType
  /** App section of `grade` where the topic is taught: "c1-s03". */
  lesson?: string
  /** Where the fact is printed (for humans). */
  source?: string
  /** The student asked for more detail («подробнее»): the longer length budget applies. */
  detail?: 'more'
  /** Not in the knowledge base: correct = honest "no answer" + suggestion. */
  unanswerable?: boolean
}

export const GOLD_QUESTIONS: GoldQuestion[] = [
  /* ------------------------------------------------------------------ grade 7 */
  {
    id: 'g7-01', grade: 7, locale: 'ru', type: 'definition', lesson: 'c1-s01', source: 'Kimyo 7 §1.1 p7',
    question: 'Что такое химия?',
    mustMention: ['наука|изучает', 'состав|строение', 'свойства', 'изменения|превращения'],
    mustNotMention: ['IUPAC|номенклатура', 'органическая химия'],
  },
  {
    id: 'g7-02', grade: 7, locale: 'ru', type: 'definition', lesson: 'c1-s05', source: 'Kimyo 7 §1.5 p20',
    question: 'Что такое смесь?',
    mustMention: ['двух веществ|нескольких веществ|более веществ|два вещества|компоненты', 'физическими методами|разделяется|разделить'],
    mustNotMention: ['re:смесь\\s*[–—-]\\s*вещество'],
  },
  {
    id: 'g7-03', grade: 7, locale: 'ru', type: 'compare', lesson: 'c1-s08', source: 'Kimyo 7 §1.8 p28',
    question: 'Чем физические явления отличаются от химических?',
    mustMention: ['новые вещества|новое вещество', 'физическ', 'химическ'],
    mustNotMention: ['IUPAC|номенклатура'],
  },
  {
    id: 'g7-04', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s06', source: 'Kimyo 7 §2.6 p51',
    question: 'Что такое валентность?',
    mustMention: ['способность', 'атома|атомов', 'присоединять|присоединяет'],
    mustNotMention: ['re:индекс\\s*[–—-]'],
  },
  {
    id: 'g7-05', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s05', source: 'Kimyo 7 §2.5 p50',
    question: 'Что такое изотопы?',
    mustMention: ['атомы|атомов', 'протонов|заряд ядра|зарядами ядер|одного элемента', 'массой|нейтронов|массовыми числами'],
    mustNotMention: ['re:изобары\\s*[–—-]', 're:изотоны\\s*[–—-]', 're:—\\s*это\\s+(поскольку|так как|если)'],
  },
  {
    id: 'g7-06', grade: 7, locale: 'ru', type: 'compare', lesson: 'c2-s08', source: 'Kimyo 7 §2.8 p56',
    question: 'Чем простые вещества отличаются от сложных?',
    mustMention: ['одного элемента|одного типа', 'различных элементов|разных элементов', 'простые', 'сложные'],
    mustNotMention: ['аллотроп'],
  },
  {
    id: 'g7-07', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s02', source: 'Kimyo 7 §2.2 p41',
    question: 'Из чего состоит атом?',
    mustMention: ['ядро|ядра', 'электрон', 'протон|нейтрон'],
    mustNotMention: ['Демокрит'],
  },
  {
    id: 'g7-08', grade: 7, locale: 'ru', type: 'how', lesson: 'c4-s04', source: 'Kimyo 7 §4.4 p92',
    question: 'Как получают кислород в лаборатории?',
    mustMention: ['перманганат калия|KMnO4|пероксид водорода|перекись водорода|хлорат калия|KClO3', 'нагрева|разложени'],
    mustNotMention: ['озон'],
  },
  {
    id: 'g7-09', grade: 7, locale: 'ru', type: 'why', lesson: 'c5-s07', source: 'Kimyo 7 §5.7 p126',
    question: 'Почему выпадают кислотные дожди?',
    mustMention: ['оксид азота|NO2|оксиды азота', 'оксид серы|SO2|оксиды серы', 'кислоты|кислот'],
    mustNotMention: ['Роберт Ангус Смит', 'Соренсен'],
  },
  {
    id: 'g7-10', grade: 7, locale: 'ru', type: 'calc', lesson: 'c2-s07', source: 'Kimyo 7 §2.7 p54',
    question: 'Как рассчитать относительную молекулярную массу воды?',
    mustMention: ['18', '16', 'сумме|сумма|складыва'],
    mustNotMention: ['H2SO4', 'CO2'],
  },
  {
    id: 'g7-11', grade: 7, locale: 'ru', type: 'definition', lesson: 'c5-s04', source: 'Kimyo 7 §6.4 p138',
    question: 'Что такое кислоты?',
    mustMention: ['сложные вещества', 'водорода', 'кислотного остатка|кислотных остатков'],
    mustNotMention: ['Аррениус', 'алхимики'],
  },
  {
    id: 'g7-12', grade: 7, locale: 'ru', type: 'definition', lesson: 'c4-s04', source: 'Kimyo 7 §4.4 p93',
    question: 'Что такое катализатор?',
    mustMention: ['скорость|ускоряют|ускоряет', 'реакции|реакций'],
    mustNotMention: ['re:21\\s*%\\s*воздуха'],
  },

  /* ------------------------------------------------------------------ grade 8 */
  {
    id: 'g8-01', grade: 8, locale: 'ru', type: 'definition', lesson: 'c1-s03', source: 'Kimyo 8 §2 p10',
    question: 'Что такое оксиды?',
    mustMention: ['сложные вещества', 'двух элементов', 'кислород'],
    mustNotMention: ['ядовит|токсичн', 'хром', 'Mn2O7'],
  },
  {
    id: 'g8-02', grade: 8, locale: 'ru', type: 'compare', lesson: 'c1-s03', source: 'Kimyo 8 §2 p10',
    question: 'Какие бывают оксиды?',
    mustMention: ['основные', 'кислотные', 'амфотерные'],
    mustNotMention: ['ядовит|токсичн'],
  },
  {
    id: 'g8-03', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s01', source: 'Kimyo 8 §14 p63',
    question: 'Что такое электроотрицательность?',
    mustMention: ['свойство|способность', 'атома', 'электрон'],
    mustNotMention: ['металлические свойства'],
  },
  {
    id: 'g8-04', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s03', source: 'Kimyo 8 §16 p72',
    question: 'Что такое ионная связь?',
    mustMention: ['ионами|ионов|ионы', 'связь', 'заряженные|притягиваются|притяжение'],
    mustNotMention: ['re:ковалентн\\S*\\s+связ\\S*\\s*(—|–|-|называ)'],
  },
  {
    id: 'g8-05', grade: 8, locale: 'ru', type: 'compare', lesson: 'c3-s01', source: 'Kimyo 8 §15 p67–68',
    question: 'Чем полярная ковалентная связь отличается от неполярной?',
    mustMention: ['электроотрицательност', 'одинаков', 'различн|разн'],
    mustNotMention: ['ионная связь'],
  },
  {
    id: 'g8-06', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s06', source: 'Kimyo 8 §18 p76',
    question: 'Что такое степень окисления?',
    mustMention: ['число электронов|количество электронов|заряд', 'отданных|присоединенных|отдает|присоединяет'],
    mustNotMention: ['фосфорной кислоты'],
  },
  {
    id: 'g8-07', grade: 8, locale: 'ru', type: 'definition', lesson: 'c3-s06', source: 'Kimyo 8 §19 p81',
    question: 'Что такое окислитель?',
    mustMention: ['присоединивший|присоединяет|принимает', 'электрон'],
    mustNotMention: ['re:окислител\\S*[^.]{0,30}отда(ет|вший)\\s+электрон'],
  },
  {
    id: 'g8-08', grade: 8, locale: 'ru', type: 'why', lesson: 'c4-s02', source: 'Kimyo 8 §22 p91–92',
    question: 'Почему галогены не встречаются в природе в свободном виде?',
    mustMention: ['сильными окислителями|активн', 'соединений|соединения'],
    mustNotMention: ['Таблица 17'],
  },
  {
    id: 'g8-09', grade: 8, locale: 'ru', type: 'how', lesson: 'c5-s01', source: 'Kimyo 8 §33 p142',
    question: 'Как температура влияет на скорость реакции?',
    mustMention: ['повышении температуры|нагревании|температура повышается', '10', '2 4|в 2', 'увеличивается|возрастает|растет'],
    mustNotMention: ['ингибитор'],
  },
  {
    id: 'g8-10', grade: 8, locale: 'ru', type: 'how', lesson: 'c4-s04', source: 'Kimyo 8 §24 p99',
    question: 'Как получают хлороводород в лаборатории?',
    mustMention: ['хлорид натрия|поваренной соли|NaCl', 'серной кислоты|серная кислота|H2SO4'],
    mustNotMention: ['292,5', 're:H2SO(?![3-4₃₄])'],
  },
  {
    id: 'g8-11', grade: 8, locale: 'ru', type: 'example', lesson: 'c1-s03', source: 'Kimyo 8 §2 p10',
    question: 'Приведи пример амфотерного оксида',
    mustMention: ['ZnO|Al2O3|Sb2O3|оксид цинка|оксид алюминия'],
    mustNotMention: ['Na2O2|H2O2|пероксид'],
  },
  {
    id: 'g8-12', grade: 8, locale: 'ru', type: 'calc', lesson: 'c4-s05', source: 'Kimyo 8 §25 p102',
    question: 'Какой объём занимает 1 моль газа при нормальных условиях?',
    mustMention: ['22,4', 'л|литр|литра'],
    mustNotMention: ['292,5|1006,34', 're:10(23|₂₃)\\b'],
  },

  /* ------------------------------------------------------------------ grade 9 */
  {
    id: 'g9-01', grade: 9, locale: 'ru', type: 'definition', lesson: 'c3-s01', source: 'Kimyo 9 §3 p20',
    question: 'Что такое электролиты?',
    mustMention: ['растворы|расплавы|растворах|расплавах', 'проводят электрический ток|проводят ток'],
    mustNotMention: ['re:неэлектролит\\S*\\s+(—|–|-|называ)', 're:электролит\\S*\\s*—\\s*это[^.]*не\\s+проводят'],
  },
  {
    id: 'g9-02', grade: 9, locale: 'ru', type: 'definition', lesson: 'c3-s01', source: 'Kimyo 9 §3 p21',
    question: 'Что такое электролитическая диссоциация?',
    mustMention: ['распад|распада|распадается', 'ионы|ионов', 'растворении|воде|расплав'],
    mustNotMention: ['Al2(SO4)3'],
  },
  {
    id: 'g9-03', grade: 9, locale: 'ru', type: 'definition', lesson: 'c6-s04', source: 'Kimyo 9 §7 p34',
    question: 'Что такое гидролиз солей?',
    mustMention: ['взаимодейств', 'водой|воды', 'ионов|ионы', 'слабого электролита|слабый электролит'],
    mustNotMention: ['FeCl3|Fe(OH)Cl2'],
  },
  {
    id: 'g9-04', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s01', source: 'Kimyo 9 §17 p77',
    question: 'Почему металлы хорошо проводят электрический ток?',
    mustMention: ['свободные электроны|свободных электронов', 'металлическ|кристаллической решетки'],
    mustNotMention: ['re:электролит', 'индий'],
  },
  {
    id: 'g9-05', grade: 9, locale: 'ru', type: 'definition', lesson: 'c1-s04', source: 'Kimyo 9 §18 p80',
    question: 'Что такое коррозия металлов?',
    mustMention: ['разрушение', 'металла|металлов', 'окружающей среды|окружающ'],
    mustNotMention: ['Бекабад'],
  },
  {
    id: 'g9-06', grade: 9, locale: 'ru', type: 'how', lesson: 'c1-s04', source: 'Kimyo 9 §18 p82',
    question: 'Как защитить металлы от коррозии?',
    mustMention: ['покрытия|покрытие|защитного слоя', 'лаков|красок|эмалей|краской'],
    mustNotMention: ['Бекабад'],
  },
  {
    id: 'g9-07', grade: 9, locale: 'ru', type: 'definition', lesson: 'c1-s05', source: 'Kimyo 9 §16 p74',
    question: 'Что такое сплав?',
    mustMention: ['материал|вещество', 'расплавленных металлах|расплав|сплавлен', 'металлов|металлы'],
    mustNotMention: ['re:интерметаллические[^.]{0,20}(—|–)'],
  },
  {
    id: 'g9-08', grade: 9, locale: 'ru', type: 'how', lesson: 'c1-s02', source: 'Kimyo 9 §24 p117',
    question: 'Как устранить временную жёсткость воды?',
    mustMention: ['кипячения|кипячение|кипятить', 'Ca(HCO3)2|гидрокарбонат|кальци|магни'],
    mustNotMention: ['фосфата натрия|Na3PO4'],
  },
  {
    id: 'g9-09', grade: 9, locale: 'ru', type: 'how', lesson: 'c6-s03', source: 'Kimyo 9 §6 p29–30',
    question: 'Когда реакции ионного обмена идут до конца?',
    mustMention: ['осадок|осадка|нерастворим', 'газ|газообразным', 'вода|воды|слабого электролита|малодиссоциир'],
    mustNotMention: ['Желтый осадок'],
  },
  {
    id: 'g9-10', grade: 9, locale: 'ru', type: 'compare', lesson: 'c3-s01', source: 'Kimyo 9 §5 p26',
    question: 'Чем сильные электролиты отличаются от слабых?',
    mustMention: ['степенью диссоциации|степень диссоциации', 'высокой|полностью|большой', 'низкой|частично|малой'],
    mustNotMention: ['неэлектролит'],
  },
  {
    id: 'g9-11', grade: 9, locale: 'ru', type: 'compare', lesson: 'c3-s07', source: 'Kimyo 9 §36 p164',
    question: 'Чем чугун отличается от стали?',
    mustMention: ['углерода|углерод', '2,14|2 %|2%', 'более|больше', 'менее|меньше|до 2'],
    mustNotMention: ['доменных печах', 're:содержащий\\s+(более|менее)\\s*\\.'],
  },
  {
    id: 'g9-12', grade: 9, locale: 'ru', type: 'definition', lesson: 'c3-s03', source: 'Kimyo 9 §19 p85',
    question: 'Что такое электролиз?',
    mustMention: ['окислительно-восстановительный|окисление|восстановление', 'электрического тока|электрический ток', 'раствор|расплав'],
    mustNotMention: ['напряжением распада'],
  },

  /* ----------------------------------------------------------------- grade 10 */
  {
    id: 'g10-01', grade: 10, locale: 'ru', type: 'definition', lesson: 'c1-s04', source: 'Kimyo 10 §1.4 p18',
    question: 'Что такое изомеры?',
    mustMention: ['одинаковой молекулярной формулой|одинаковый состав|одинаковую молекулярную формулу', 'разными свойствами|разное строение|разными физическими|строением'],
    mustNotMention: ['re:гомолог\\S*\\s*[–—-]', 're:—\\s*это\\s+(и|а|но|или)\\s'],
  },
  {
    id: 'g10-02', grade: 10, locale: 'ru', type: 'definition', lesson: 'c2-s01', source: 'Kimyo 10 §2.1 p39',
    question: 'Что такое алканы?',
    mustMention: ['CnH2n+2|предельн|насыщенн', 'углеводород', 'одинарн|простые связи|σ-связ'],
    mustNotMention: ['re:CnH2n(?![+₊]\\s*2)'],
  },
  {
    id: 'g10-03', grade: 10, locale: 'ru', type: 'why', lesson: 'c2-s08', source: 'Kimyo 10 §2.7 p56',
    question: 'Почему алкены вступают в реакции присоединения?',
    mustMention: ['двойной связи|двойная связь|двойную связь', 'π-связь|пи-связь|π-связи'],
    mustNotMention: ['re:алкен\\S*[^.]{0,40}реакци\\S*\\s+замещени'],
  },
  {
    id: 'g10-04', grade: 10, locale: 'ru', type: 'definition', lesson: 'c1-s05', source: 'Kimyo 10 §1.5 p25',
    question: 'Что такое гомологи?',
    mustMention: ['одному классу|одного класса', 'сходные свойства|сходными свойствами', 'CH2'],
    mustNotMention: ['re:изомер\\S*\\s*[–—-]'],
  },
  {
    id: 'g10-05', grade: 10, locale: 'ru', type: 'how', lesson: 'c3-s14', source: 'Kimyo 10 §3.12 p141, §3.14 p146',
    question: 'Как получают сложные эфиры?',
    mustMention: ['спирт|спиртами|спирта', 'кислот', 'этерификаци|нагревание'],
    mustNotMention: ['простые эфиры'],
  },
  {
    id: 'g10-06', grade: 10, locale: 'ru', type: 'definition', lesson: 'c3-s16', source: 'Kimyo 10 §3.16 p152',
    question: 'Что такое жиры?',
    mustMention: ['глицерин', 'карбоновыми кислотами|карбоновых кислот|жирных кислот', 'сложные эфиры|триглицерид'],
    mustNotMention: ['70 kg|11 kg'],
  },

  /* ----------------------------------------------------------------- grade 11 */
  {
    id: 'g11-01', grade: 11, locale: 'ru', type: 'how', lesson: 'c8-s01', source: 'Kimyo 11 §31 p140–143; Kimyo 9 §19 p85',
    question: 'Что происходит при электролизе раствора хлорида натрия?',
    mustMention: ['катод|катоде', 'водород|H2', 'хлор|Cl2', 'щелочь|NaOH|гидроксид натрия'],
    mustNotMention: ['re:на\\s+катоде\\s+выделяется\\s+(металлический\\s+)?натрий', 'хлорида меди|CuCl2'],
  },
  {
    id: 'g11-02', grade: 11, locale: 'ru', type: 'how', lesson: 'c5-s02', source: 'Kimyo 11 §23 p107',
    question: 'От чего зависит скорость химической реакции?',
    mustMention: ['природы', 'концентрац', 'температур', 'катализатор'],
    mustNotMention: ['ферментами'],
  },
  {
    id: 'g11-03', grade: 11, locale: 'ru', type: 'definition', lesson: 'c6-s01', source: 'Kimyo 11 §25 p113',
    question: 'Что такое химическое равновесие?',
    mustMention: ['скорости', 'прямой', 'обратной', 'равны'],
    mustNotMention: ['константа равновесия останется'],
  },
  {
    id: 'g11-04', grade: 11, locale: 'ru', type: 'how', lesson: 'c6-s02', source: 'Kimyo 11 §26 p116–117',
    question: 'Как давление влияет на химическое равновесие?',
    mustMention: ['давлени', 'смещ', 'газ|объем|молекул'],
    mustNotMention: ['re:(^|\\s)[A-DА-Г]\\)\\s'],
  },
  {
    id: 'g11-05', grade: 11, locale: 'ru', type: 'definition', lesson: 'c4-s07', source: 'Kimyo 11 §22 p98, §18 p86',
    question: 'Что такое молярная концентрация?',
    mustMention: ['количества вещества|число молей|моль', 'объем|литр|1 л', 'раствора'],
    mustNotMention: ['эквивалентов'],
  },
  {
    id: 'g11-06', grade: 11, locale: 'ru', type: 'calc', lesson: 'c4-s04', source: 'Kimyo 11 §15 p74',
    question: 'Сколько граммов соли нужно, чтобы приготовить 200 г 10%-го раствора?',
    mustMention: ['20 г', 'масса раствора|массы раствора|процентная концентрация|массовая доля|m(р-ра)|m(раствора)'],
    mustNotMention: ['нормальная концентрация'],
  },

  /* ------------------------------------------------------------------ English */
  {
    id: 'en-01', grade: 11, locale: 'en', type: 'definition', lesson: 'c5-s02', source: 'Kimyo 11 §23 p106',
    question: 'What is a catalyst?',
    mustMention: ['speed|rate|accelerat|faster', 'reaction', 'not consumed|unchanged|not used up|remains'],
  },
  {
    id: 'en-02', grade: 8, locale: 'en', type: 'definition', lesson: 'c1-s03', source: 'Kimyo 8 §2 p10',
    question: 'What are oxides?',
    mustMention: ['compound|substance', 'two elements', 'oxygen'],
    mustNotMention: ['toxic|poisonous', 'chromium'],
  },
  {
    id: 'en-03', grade: 7, locale: 'en', type: 'definition', lesson: 'c2-s05', source: 'Kimyo 7 §2.5 p50',
    question: 'What are isotopes?',
    mustMention: ['atoms', 'same number of protons|same element|same atomic number|same nuclear charge', 'neutrons|mass'],
    mustNotMention: ['isobar'],
  },
  {
    id: 'en-04', grade: 9, locale: 'en', type: 'why', lesson: 'c1-s01', source: 'Kimyo 9 §17 p77',
    question: 'Why do metals conduct electricity?',
    mustMention: ['free electrons|delocalized electrons|mobile electrons', 'metal'],
    mustNotMention: ['electrolyte'],
  },
  {
    id: 'en-05', grade: 11, locale: 'en', type: 'definition', lesson: 'c8-s01', source: 'Kimyo 11 §31 p139',
    question: 'What is electrolysis?',
    mustMention: ['electric current', 'redox|oxidation|reduction', 'solution|melt|molten'],
    mustNotMention: ['decomposition voltage'],
  },
  {
    id: 'en-06', grade: 7, locale: 'en', type: 'definition', lesson: 'c5-s04', source: 'Kimyo 7 §6.4 p138',
    question: 'What is an acid?',
    mustMention: ['hydrogen', 'acid residue|acidic residue|anion'],
    mustNotMention: ['Arrhenius'],
  },

  /* ------------------------------------------------------------------- Uzbek */
  {
    id: 'uz-01', grade: 7, locale: 'uz', type: 'definition', lesson: 'c5-s04', source: 'Kimyo 7 §6.4 p138',
    question: 'Kislota nima?',
    mustMention: ['vodorod', "kislota qoldig'i|kislotali qoldiq|kislota qoldiq"],
  },
  {
    id: 'uz-02', grade: 8, locale: 'uz', type: 'definition', lesson: 'c1-s03', source: 'Kimyo 8 §2 p10',
    question: 'Oksidlar nima?',
    mustMention: ['murakkab modda', 'ikki element', 'kislorod'],
  },
  {
    id: 'uz-03', grade: 11, locale: 'uz', type: 'definition', lesson: 'c5-s02', source: 'Kimyo 11 §23 p106',
    question: 'Katalizator nima?',
    mustMention: ['tezlig|tezlashtir', 'reaksiya'],
  },
  {
    id: 'uz-04', grade: 9, locale: 'uz', type: 'definition', lesson: 'c3-s03', source: 'Kimyo 9 §19 p85',
    question: 'Elektroliz nima?',
    mustMention: ['elektr tok', 'eritma|suyuqlanma', 'oksidlanish|qaytarilish'],
  },
  {
    id: 'uz-05', grade: 7, locale: 'uz', type: 'definition', lesson: 'c2-s05', source: 'Kimyo 7 §2.5 p50',
    question: 'Izotoplar nima?',
    mustMention: ['atom', 'proton', 'neytron|massa'],
  },
  {
    id: 'uz-06', grade: 9, locale: 'uz', type: 'why', lesson: 'c1-s01', source: 'Kimyo 9 §17 p77',
    question: "Nega metallar elektr tokini o'tkazadi?",
    mustMention: ['erkin elektron', 'metall'],
  },

  /* ---------------------------------------------------------------- follow-ups */
  {
    id: 'fu-01', grade: 8, locale: 'ru', type: 'example', lesson: 'c1-s03', followUpOf: 'g8-01', source: 'Kimyo 8 §2 p10',
    question: 'Приведи пример',
    mustMention: ['Na2O|BaO|CuO|CO2|SO3|P2O5|ZnO|Al2O3|CaO|MgO|Fe2O3|CO|NO|N2O|оксид кальция|углекислый газ|оксид натрия|оксид меди'],
    mustNotMention: ['ядовит|токсичн', 'Mn2O7'],
  },
  {
    id: 'fu-02', grade: 9, locale: 'ru', type: 'why', lesson: 'c1-s04', followUpOf: 'g9-05', source: 'Kimyo 9 §18 p80',
    question: 'А почему она происходит?',
    mustMention: ['окружающей среды|кислород|влаг|вод|электролит', 'окисля|окисление|оксиды|гидроксиды'],
    mustNotMention: ['Бекабад'],
  },
  {
    id: 'fu-03', grade: 7, locale: 'ru', type: 'definition', lesson: 'c2-s05', followUpOf: 'g7-05', source: 'Kimyo 7 §2.5 p50',
    question: 'Объясни проще',
    mustMention: ['протон|заряд', 'нейтрон|масс'],
    mustNotMention: ['re:изобары\\s*[–—-]', 're:изотоны\\s*[–—-]'],
  },
  {
    id: 'fu-04', grade: 7, locale: 'ru', type: 'example', lesson: 'c4-s04', followUpOf: 'g7-12', source: 'Kimyo 7 §4.4 p92',
    question: 'Приведи пример',
    mustMention: ['MnO2|оксид марганца|V2O5|оксид ванадия|платин|фермент|никел'],
    mustNotMention: ['re:21\\s*%\\s*воздуха'],
  },
  {
    id: 'fu-05', grade: 7, locale: 'ru', type: 'definition', lesson: 'c5-s04', followUpOf: 'g7-11', detail: 'more', source: 'Kimyo 7 §5.4 p119, §6.4 p138',
    question: 'Расскажи подробнее',
    mustMention: ['водорода', 'кислотного остатка|кислотных остатков', 'кислот'],
    mustNotMention: ['Аррениус'],
  },
  {
    id: 'fu-06', grade: 11, locale: 'en', type: 'example', lesson: 'c5-s02', followUpOf: 'en-01', source: 'Kimyo 11 §23; Kimyo 7 §4.4',
    question: 'Give an example',
    mustMention: ['MnO2|manganese|enzyme|platinum|nickel|vanadium|iron'],
  },

  /* ----------------------------------------------------- unanswerable (not in the base) */
  {
    id: 'un-01', grade: 9, locale: 'ru', type: 'how', lesson: 'c3-s03', unanswerable: true,
    question: 'Как устроен литий-ионный аккумулятор?',
    mustMention: [],
    mustNotMention: ['никель-металлогидридные', 'серная кислота и дистиллированная'],
  },
  {
    id: 'un-02', grade: 11, locale: 'ru', type: 'definition', lesson: 'c1-s01', unanswerable: true,
    question: 'Что такое правило Хунда?',
    mustMention: [],
    mustNotMention: ['Паули', 'Клечковского'],
  },
  {
    id: 'un-03', grade: 10, locale: 'ru', type: 'definition', lesson: 'c2-s20', unanswerable: true,
    question: 'Что такое графен?',
    mustMention: [],
    mustNotMention: ['фуллерен', 'карбин'],
  },
  {
    id: 'un-04', grade: 8, locale: 'ru', type: 'how', lesson: 'c1-s01', unanswerable: true,
    question: 'Кто выиграл чемпионат мира по футболу в 2022 году?',
    mustMention: [],
    mustNotMention: ['Аргентина|Франция|Месси'],
  },
]

export function goldById(id: string): GoldQuestion | undefined {
  return GOLD_QUESTIONS.find((q) => q.id === id)
}
