/**
 * Kimyo 10, глава III (§ 3.1–3.21): квизы «Название» уроков органической лаборатории —
 * номенклатура по учебнику (с исправлением ошибок учебника) и задачи параграфов с готовым ответом.
 * Источник — docs/textbook/g10-ch3-*.md.
 */
import type { NomenclatureOption, NomenclatureQuestion, NomenclatureQuiz } from './organicNomenclatureQuizzes'

type Tri = readonly [ru: string, en: string, uz: string]

function o(id: string, correct: boolean, label: Tri): NomenclatureOption {
  return { id, labelRu: label[0], labelEn: label[1], labelUz: label[2], correct }
}

function q(id: string, prompt: Tri, formula: string | undefined, options: readonly NomenclatureOption[]): NomenclatureQuestion {
  return { id, promptRu: prompt[0], promptEn: prompt[1], promptUz: prompt[2], formula, options }
}

const same = (s: string): Tri => [s, s, s]

export const G10_CH3_QUIZZES: readonly NomenclatureQuiz[] = [
  {
    id: 'g10-ch3-alcohols',
    titleRu: 'Спирты: названия и задачи (с. 107–113)',
    titleEn: 'Alcohols: names and tasks (pp. 107–113)',
    titleUz: 'Spirtlar: nomlar va masalalar (107–113-betlar)',
    questions: [
      q('c3-alc-tertiary',
        ['Какой спирт третичный (с. 107)?', 'Which alcohol is tertiary (p. 107)?', 'Qaysi spirt uchlamchi (107-bet)?'],
        undefined,
        [
          o('a', false, ['Этанол CH₃–CH₂–OH', 'Ethanol CH₃–CH₂–OH', 'Etanol CH₃–CH₂–OH']),
          o('b', false, ['Пропан-2-ол CH₃–CH(OH)–CH₃', 'Propan-2-ol CH₃–CH(OH)–CH₃', 'Propan-2-ol CH₃–CH(OH)–CH₃']),
          o('c', true, ['2-Метилпропан-2-ол (CH₃)₃C–OH', '2-Methylpropan-2-ol (CH₃)₃C–OH', '2-Metilpropan-2-ol (CH₃)₃C–OH']),
          o('d', false, ['Пропан-1-ол CH₃–CH₂–CH₂–OH', 'Propan-1-ol CH₃–CH₂–CH₂–OH', 'Propan-1-ol CH₃–CH₂–CH₂–OH']),
        ]),
      q('c3-alc-allyl',
        ['В учебнике (с. 107) эта формула подписана «виниловый спирт». Как она называется правильно?', 'The textbook (p. 107) labels this formula “vinyl alcohol”. What is its correct name?', 'Darslikda (107-bet) bu formula «vinil spirti» deb yozilgan. Toʻgʻri nomi qanday?'],
        'CH₂=CH–CH₂–OH',
        [
          o('a', false, ['Виниловый спирт (этенол)', 'Vinyl alcohol (ethenol)', 'Vinil spirti (etenol)']),
          o('b', true, ['Проп-2-ен-1-ол (аллиловый спирт)', 'Prop-2-en-1-ol (allyl alcohol)', 'Prop-2-en-1-ol (allil spirti)']),
          o('c', false, ['Пропан-1-ол', 'Propan-1-ol', 'Propan-1-ol']),
          o('d', false, ['Пропаналь', 'Propanal', 'Propanal']),
        ]),
      q('c3-alc-nonanol',
        ['Задача с. 108–109: назовите спирт, перечислив заместители по алфавиту.', 'Task pp. 108–109: name the alcohol, listing substituents alphabetically.', '108–109-betlar masalasi: oʻrinbosarlarni alifbo tartibida sanab, spirtni nomlang.'],
        'CH₃CH₂–CHCl–C(CH₃)(OH)–CH₂–CH(C₂H₅)–CH₂CH₂CH₃',
        [
          o('a', true, ['4-Метил-3-хлор-6-этилнонан-4-ол', '3-Chloro-6-ethyl-4-methylnonan-4-ol', '4-Metil-3-xlor-6-etilnonan-4-ol']),
          o('b', false, ['6-Этил-4-метил-3-хлорнонан-4-ол (порядок учебника — не по алфавиту)', '6-Ethyl-4-methyl-3-chlorononan-4-ol (textbook order — not alphabetical)', '6-Etil-4-metil-3-xlornonan-4-ol (darslik tartibi — alifbo boʻyicha emas)']),
          o('c', false, ['4-Этил-6-метил-7-хлорнонан-6-ол', '7-Chloro-4-ethyl-6-methylnonan-6-ol', '4-Etil-6-metil-7-xlornonan-6-ol']),
          o('d', false, ['3-Хлор-4-метилундекан-4-ол', '3-Chloro-4-methylundecan-4-ol', '3-Xlor-4-metilundekan-4-ol']),
        ]),
      q('c3-alc-isomer-position',
        ['Пропанол-1 и пропанол-2 (с. 109) — это изомеры…', 'Propan-1-ol and propan-2-ol (p. 109) are isomers of…', 'Propanol-1 va propanol-2 (109-bet) — bu … izomerlari'],
        'C₃H₇OH',
        [
          o('a', true, ['положения группы OH', 'the OH group position', 'OH guruhi holati']),
          o('b', false, ['углеродного скелета', 'the carbon skeleton', 'uglerod skeleti']),
          o('c', false, ['межклассовые', 'different classes', 'sinflararo']),
          o('d', false, ['геометрические (цис/транс)', 'geometric (cis/trans)', 'geometrik (sis/trans)']),
        ]),
      q('c3-alc-interclass',
        ['Этанол и диметиловый эфир (C₂H₆O, с. 109) — какой вид изомерии?', 'Ethanol and dimethyl ether (C₂H₆O, p. 109) — which kind of isomerism?', 'Etanol va dimetil efiri (C₂H₆O, 109-bet) — izomeriyaning qaysi turi?'],
        'CH₃–CH₂–OH / CH₃–O–CH₃',
        [
          o('a', false, ['изомерия положения OH', 'OH position isomerism', 'OH holati izomeriyasi']),
          o('b', true, ['межклассовая изомерия', 'interclass isomerism', 'sinflararo izomeriya']),
          o('c', false, ['изомерия углеродного скелета', 'skeletal isomerism', 'skelet izomeriyasi']),
          o('d', false, ['это одно и то же вещество', 'they are the same substance', 'bu bitta modda']),
        ]),
      q('c3-alc-hcl-balance',
        ['Какая запись реакции этанола с HCl (с. 110) уравнена?', 'Which equation of ethanol with HCl (p. 110) is balanced?', 'Etanolning HCl bilan reaksiyasining (110-bet) qaysi yozuvi tenglangan?'],
        undefined,
        [
          o('a', false, ['2C₂H₅OH + HCl → 2C₂H₅Cl + H₂O (как в учебнике)', '2C₂H₅OH + HCl → 2C₂H₅Cl + H₂O (as in the textbook)', '2C₂H₅OH + HCl → 2C₂H₅Cl + H₂O (darslikdagidek)']),
          o('b', true, same('C₂H₅OH + HCl → C₂H₅Cl + H₂O')),
          o('c', false, same('C₂H₅OH + 2HCl → C₂H₅Cl + H₂O')),
          o('d', false, same('C₂H₅OH + HCl → C₂H₄Cl + H₂O')),
        ]),
      q('c3-alc-iodoform',
        ['Иодоформная проба (с. 112): что наблюдают?', 'Iodoform test (p. 112): what is observed?', 'Yodoform sinovi (112-bet): nima kuzatiladi?'],
        'C₂H₅OH + 6NaOH + 4I₂ → CHI₃ + HCOONa + 5NaI + 5H₂O',
        [
          o('a', true, ['жёлтый осадок иодоформа CHI₃ (в учебнике иод — «J»)', 'a yellow precipitate of iodoform CHI₃ (the textbook writes iodine as “J”)', 'sariq yodoform CHI₃ choʻkmasi (darslikda yod — «J»)']),
          o('b', false, ['ярко-синий раствор', 'a bright blue solution', 'yorqin koʻk eritma']),
          o('c', false, ['«серебряное зеркало»', 'a “silver mirror”', '«kumush koʻzgu»']),
          o('d', false, ['выделение водорода', 'hydrogen gas', 'vodorod ajralishi']),
        ]),
    ],
  },
  {
    id: 'g10-ch3-polyols',
    titleRu: 'Многоатомные спирты: названия и задачи (с. 115–121)',
    titleEn: 'Polyols: names and tasks (pp. 115–121)',
    titleUz: 'Koʻp atomli spirtlar: nomlar va masalalar (115–121-betlar)',
    questions: [
      q('c3-pol-table-2',
        ['Таблица с. 117, строка 2: в учебнике подпись «1,2-бутиленгликоль». Верное название?', 'Table p. 117, row 2: the textbook label is “1,2-butylene glycol”. The correct name?', '117-bet jadvali, 2-qator: darslikda «1,2-butilenglikol». Toʻgʻri nomi?'],
        'HO–CH₂–CH₂–CH(OH)–CH₃',
        [
          o('a', false, ['Бутан-1,2-диол', 'Butane-1,2-diol', 'Butan-1,2-diol']),
          o('b', true, ['Бутан-1,3-диол', 'Butane-1,3-diol', 'Butan-1,3-diol']),
          o('c', false, ['Бутан-1,4-диол', 'Butane-1,4-diol', 'Butan-1,4-diol']),
          o('d', false, ['Бутан-2,4-диол', 'Butane-2,4-diol', 'Butan-2,4-diol']),
        ]),
      q('c3-pol-table-4',
        ['Таблица с. 117, строка 4: в учебнике «бутандиол-1,4». Верное название?', 'Table p. 117, row 4: the textbook says “butane-1,4-diol”. The correct name?', '117-bet jadvali, 4-qator: darslikda «butandiol-1,4». Toʻgʻri nomi?'],
        'CH₃–CH(OH)–CH(OH)–CH₃',
        [
          o('a', false, ['Бутан-1,4-диол', 'Butane-1,4-diol', 'Butan-1,4-diol']),
          o('b', false, ['Бутан-1,2-диол', 'Butane-1,2-diol', 'Butan-1,2-diol']),
          o('c', true, ['Бутан-2,3-диол', 'Butane-2,3-diol', 'Butan-2,3-diol']),
          o('d', false, ['2-Метилпропан-1,2-диол', '2-Methylpropane-1,2-diol', '2-Metilpropan-1,2-diol']),
        ]),
      q('c3-pol-table-5',
        ['Таблица с. 117, строка 5: в учебнике «бутандиол-2,3». Верное название?', 'Table p. 117, row 5: the textbook says “butane-2,3-diol”. The correct name?', '117-bet jadvali, 5-qator: darslikda «butandiol-2,3». Toʻgʻri nomi?'],
        'HO–CH₂–C(OH)(CH₃)–CH₃',
        [
          o('a', false, ['Бутан-2,3-диол', 'Butane-2,3-diol', 'Butan-2,3-diol']),
          o('b', true, ['2-Метилпропан-1,2-диол', '2-Methylpropane-1,2-diol', '2-Metilpropan-1,2-diol']),
          o('c', false, ['2-Метилпропан-1,3-диол', '2-Methylpropane-1,3-diol', '2-Metilpropan-1,3-diol']),
          o('d', false, ['Бутан-1,2-диол', 'Butane-1,2-diol', 'Butan-1,2-diol']),
        ]),
      q('c3-pol-xylitol',
        ['Учебник (с. 115) называет ксилит «пятиатомный спирт пентанол». Как правильно?', 'The textbook (p. 115) calls xylitol “the pentahydric alcohol pentanol”. What is right?', 'Darslik (115-bet) ksilitni «besh atomli spirt pentanol» deydi. Toʻgʻrisi qanday?'],
        'HOCH₂–(CHOH)₃–CH₂OH',
        [
          o('a', false, ['Пентанол', 'Pentanol', 'Pentanol']),
          o('b', false, ['Пентан-1,5-диол', 'Pentane-1,5-diol', 'Pentan-1,5-diol']),
          o('c', true, ['Пентан-1,2,3,4,5-пентол', 'Pentane-1,2,3,4,5-pentol', 'Pentan-1,2,3,4,5-pentol']),
          o('d', false, ['Гексан-1,2,3,4,5,6-гексол', 'Hexane-1,2,3,4,5,6-hexol', 'Geksan-1,2,3,4,5,6-geksol']),
        ]),
      q('c3-pol-sigma',
        ['Задание с. 118: сколько σ- и π-связей в молекуле глицерина C₃H₈O₃?', 'Task p. 118: how many σ and π bonds are in glycerol C₃H₈O₃?', '118-bet topshirigʻi: glitserin C₃H₈O₃ molekulasida nechta σ va π bogʻ bor?'],
        'HO–CH₂–CH(OH)–CH₂–OH',
        [
          o('a', true, ['13 σ, 0 π (у этиленгликоля — 9 σ, 0 π)', '13 σ, 0 π (ethylene glycol: 9 σ, 0 π)', '13 σ, 0 π (etilenglikolda — 9 σ, 0 π)']),
          o('b', false, same('11 σ, 0 π')),
          o('c', false, same('13 σ, 3 π')),
          o('d', false, same('14 σ, 0 π')),
        ]),
      q('c3-pol-homologs',
        ['Задание с. 121: этиленгликоль и глицерин — гомологи?', 'Task p. 121: are ethylene glycol and glycerol homologues?', '121-bet topshirigʻi: etilenglikol va glitserin gomologmi?'],
        'C₂H₄(OH)₂ / C₃H₅(OH)₃',
        [
          o('a', false, ['Да, отличаются на CH₂', 'Yes, they differ by CH₂', 'Ha, CH₂ ga farq qiladi']),
          o('b', true, ['Нет: отличаются на CH(OH) — разное число групп OH', 'No: they differ by CH(OH) — a different number of OH groups', 'Yoʻq: CH(OH) ga farq qiladi — OH guruhlari soni har xil']),
          o('c', false, ['Да, оба — многоатомные спирты', 'Yes, both are polyols', 'Ha, ikkalasi koʻp atomli spirt']),
          o('d', false, ['Нет, это изомеры', 'No, they are isomers', 'Yoʻq, ular izomerlar']),
        ]),
      q('c3-pol-reagent',
        ['Задание с. 121: каким реактивом отличить этиленгликоль от этанола?', 'Task p. 121: which reagent tells ethylene glycol from ethanol?', '121-bet topshirigʻi: etilenglikolni etanoldan qaysi reaktiv bilan farqlash mumkin?'],
        undefined,
        [
          o('a', false, ['Металлический натрий', 'Sodium metal', 'Metall natriy']),
          o('b', true, ['Cu(OH)₂ — ярко-синий раствор только с гликолем', 'Cu(OH)₂ — a bright blue solution only with the glycol', 'Cu(OH)₂ — yorqin koʻk eritma faqat glikol bilan']),
          o('c', false, ['Бромная вода', 'Bromine water', 'Bromli suv']),
          o('d', false, ['Лакмус', 'Litmus', 'Lakmus']),
        ]),
      q('c3-pol-task-na',
        ['Задача с. 121: 6,2 г этиленгликоля и 3,45 г Na. Объём H₂ (н. у.)?', 'Task p. 121: 6.2 g of ethylene glycol and 3.45 g of Na. Volume of H₂ (STP)?', '121-bet masalasi: 6,2 g etilenglikol va 3,45 g Na. H₂ hajmi (n. sh.)?'],
        'HO–CH₂–CH₂–OH + 2Na → NaO–CH₂–CH₂–ONa + H₂',
        [
          o('a', false, ['2,24 л (расчёт по гликолю — ошибка: Na в недостатке)', '2.24 L (counting by glycol — wrong: Na is limiting)', '2,24 l (glikol boʻyicha — xato: Na yetishmaydi)']),
          o('b', true, ['1,68 л: n(Na) = 0,15 моль в недостатке → n(H₂) = 0,075 моль', '1.68 L: n(Na) = 0.15 mol is limiting → n(H₂) = 0.075 mol', '1,68 l: n(Na) = 0,15 mol yetishmaydi → n(H₂) = 0,075 mol']),
          o('c', false, ['3,36 л', '3.36 L', '3,36 l']),
          o('d', false, ['1,12 л', '1.12 L', '1,12 l']),
        ]),
      q('c3-pol-triol-formula',
        ['Задание с. 118: формула бутан-1,2,4-триола?', 'Task p. 118: the formula of butane-1,2,4-triol?', '118-bet topshirigʻi: butan-1,2,4-triol formulasi?'],
        undefined,
        [
          o('a', true, same('HO–CH₂–CH(OH)–CH₂–CH₂–OH')),
          o('b', false, same('HO–CH₂–CH(OH)–CH(OH)–CH₃')),
          o('c', false, same('HO–CH₂–CH₂–CH₂–CH₂–OH')),
          o('d', false, same('CH₃–CH(OH)–CH(OH)–CH₂–OH')),
        ]),
    ],
  },
]
