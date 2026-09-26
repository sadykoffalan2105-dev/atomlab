/**
 * Квизы режима «Название» для Kimyo 10, гл. II § 2.7–2.23 (с. 57–102): задания учебника, опечатки и
 * исправленная таблица с. 100. Подключается одной строкой-спредом в NOMENCLATURE_QUIZZES.
 */
import type { NomenclatureOption, NomenclatureQuestion, NomenclatureQuiz } from './organicNomenclatureQuizzes'

type Tri = readonly [ru: string, en: string, uz: string]
type Opt = readonly [label: Tri | string, correct?: true]

function Q(id: string, prompt: Tri, formula: string | undefined, opts: readonly Opt[]): NomenclatureQuestion {
  const letters = 'abcdef'
  const options: NomenclatureOption[] = opts.map(([label, correct], i) => {
    const t = typeof label === 'string' ? ([label, label, label] as const) : label
    return { id: letters[i]!, labelRu: t[0], labelEn: t[1], labelUz: t[2], correct: Boolean(correct) }
  })
  return { id, promptRu: prompt[0], promptEn: prompt[1], promptUz: prompt[2], ...(formula ? { formula } : {}), options }
}

export const G10_CH2_QUIZZES: readonly NomenclatureQuiz[] = [
  {
    id: 'g10-alkenes-p59',
    titleRu: 'Алкены: задания с. 59–62',
    titleEn: 'Alkenes: tasks pp. 59–62',
    titleUz: 'Alkenlar: 59–62-betlar topshiriqlari',
    questions: [
      Q('ale-t1', [
        'Задание 1 (с. 59): какие формулы из C₂H₂, C₆H₆, C₃H₈, C₅H₁₀, C₃H₄, C₉H₁₂, C₄H₈, CH₄ отвечают алкенам CₙH₂ₙ? (Такую же формулу имеют и циклоалканы.)',
        'Task 1 (p. 59): which of C₂H₂, C₆H₆, C₃H₈, C₅H₁₀, C₃H₄, C₉H₁₂, C₄H₈, CH₄ fit the alkene formula CₙH₂ₙ? (Cycloalkanes share this formula.)',
        '1-topshiriq (59-bet): C₂H₂, C₆H₆, C₃H₈, C₅H₁₀, C₃H₄, C₉H₁₂, C₄H₈, CH₄ dan qaysilari alkenlar CₙH₂ₙ formulasiga mos? (Tsikloalkanlarning formulasi ham shunday.)',
      ], 'CₙH₂ₙ', [
        [['C₅H₁₀ и C₄H₈', 'C₅H₁₀ and C₄H₈', 'C₅H₁₀ va C₄H₈'], true],
        [['C₂H₂ и C₃H₄', 'C₂H₂ and C₃H₄', 'C₂H₂ va C₃H₄']],
        [['C₃H₈ и CH₄', 'C₃H₈ and CH₄', 'C₃H₈ va CH₄']],
        [['C₆H₆ и C₉H₁₂', 'C₆H₆ and C₉H₁₂', 'C₆H₆ va C₉H₁₂']],
      ]),
      Q('ale-t2', [
        'Задание 2 (с. 59): какое вещество из C₃H₆, C₉H₁₈, C₄H₁₀, C₂H₄ — не алкен?',
        'Task 2 (p. 59): which of C₃H₆, C₉H₁₈, C₄H₁₀, C₂H₄ is not an alkene?',
        '2-topshiriq (59-bet): C₃H₆, C₉H₁₈, C₄H₁₀, C₂H₄ dan qaysi biri alken emas?',
      ], undefined, [['C₃H₆'], ['C₉H₁₈'], ['C₄H₁₀', true], ['C₂H₄']]),
      Q('ale-t3a', [
        'Задание 3 (с. 59): формула пентена-2 (пент-2-ена)?',
        'Task 3 (p. 59): the formula of pent-2-ene?',
        '3-topshiriq (59-bet): penten-2 (pent-2-en) formulasi?',
      ], 'C₅H₁₀', [
        ['CH₃–CH=CH–CH₂–CH₃', true],
        ['CH₂=CH–CH₂–CH₂–CH₃'],
        ['CH₃–C(CH₃)=CH–CH₃'],
        ['CH₃–CH₂–CH₂–CH₂–CH₃'],
      ]),
      Q('ale-t3b', [
        'Задание 3 (с. 59): формула 2-метилбутена-2 (2-метилбут-2-ена)?',
        'Task 3 (p. 59): the formula of 2-methylbut-2-ene?',
        '3-topshiriq (59-bet): 2-metilbuten-2 (2-metilbut-2-en) formulasi?',
      ], 'C₅H₁₀', [
        ['CH₂=C(CH₃)–CH₂–CH₃'],
        ['CH₃–C(CH₃)=CH–CH₃', true],
        ['CH₃–CH(CH₃)–CH=CH₂'],
        ['CH₃–CH=CH–CH₂–CH₃'],
      ]),
      Q('ale-t3c', [
        'Задание 3 (с. 59): формула 2,2-диметилгептена-3 (2,2-диметилгепт-3-ена)?',
        'Task 3 (p. 59): the formula of 2,2-dimethylhept-3-ene?',
        '3-topshiriq (59-bet): 2,2-dimetilgepten-3 (2,2-dimetilgept-3-en) formulasi?',
      ], 'C₉H₁₈', [
        ['CH₂=CH–C(CH₃)₂–CH₂–CH₂–CH₂–CH₃'],
        ['CH₃–CH(CH₃)–CH=CH–CH₂–CH₂–CH₃'],
        ['CH₃–C(CH₃)₂–CH=CH–CH₂–CH₂–CH₃', true],
        ['CH₃–C(CH₃)₂–CH₂–CH₂–CH=CH–CH₃'],
      ]),
      Q('ale-t4', [
        'Задание 4 (с. 59): молярная масса алкена 84 г/моль. Его формула? (M(CₙH₂ₙ) = 14n)',
        'Task 4 (p. 59): an alkene has M = 84 g/mol. Its formula? (M(CₙH₂ₙ) = 14n)',
        '4-topshiriq (59-bet): alkenning molyar massasi 84 g/mol. Formulasi? (M(CₙH₂ₙ) = 14n)',
      ], '14n = 84', [['C₅H₁₀'], ['C₆H₁₂', true], ['C₆H₁₄'], ['C₇H₁₄']]),
      Q('ale-t5', [
        'Как отличить этилен от этана (с. 62)?',
        'How do you tell ethylene from ethane (p. 62)?',
        'Etilenni etandan qanday ajratish mumkin (62-bet)?',
      ], undefined, [
        [['Только этилен обесцвечивает бромную воду и раствор KMnO₄', 'Only ethylene decolourises bromine water and KMnO₄ solution', 'Faqat etilen bromli suv va KMnO₄ eritmasini rangsizlantiradi'], true],
        [['Только этан обесцвечивает бромную воду', 'Only ethane decolourises bromine water', 'Faqat etan bromli suvni rangsizlantiradi']],
        [['Оба горят — отличить нельзя', 'Both burn — they cannot be told apart', 'Ikkalasi ham yonadi — ajratib boʻlmaydi']],
        [['Этан обесцвечивает KMnO₄, этилен — нет', 'Ethane decolourises KMnO₄, ethylene does not', 'Etan KMnO₄ ni rangsizlantiradi, etilen — yoʻq']],
      ]),
      Q('ale-markov', [
        'Правило Марковникова (с. 59): что получается из CH₂=CH–CH₃ и HBr?',
        'Markovnikov’s rule (p. 59): what do CH₂=CH–CH₃ and HBr give?',
        'Markovnikov qoidasi (59-bet): CH₂=CH–CH₃ va HBr dan nima hosil boʻladi?',
      ], 'CH₂=CH–CH₃ + HBr', [
        [['1-Бромпропан CH₂Br–CH₂–CH₃', '1-Bromopropane CH₂Br–CH₂–CH₃', '1-Brompropan CH₂Br–CH₂–CH₃']],
        [['2-Бромпропан CH₃–CH(Br)–CH₃', '2-Bromopropane CH₃–CH(Br)–CH₃', '2-Brompropan CH₃–CH(Br)–CH₃'], true],
        [['1,2-Дибромпропан', '1,2-Dibromopropane', '1,2-Dibrompropan']],
        [['Бромэтан и метан', 'Bromoethane and methane', 'Brometan va metan']],
      ]),
      Q('ale-cistrans', [
        'Почему цис- и транс-бутен-2 — разные вещества (с. 59)?',
        'Why are cis- and trans-but-2-ene different substances (p. 59)?',
        'Nega sis- va trans-buten-2 — turli moddalar (59-bet)?',
      ], 'CH₃–CH=CH–CH₃', [
        [['π-связь не даёт вращаться вокруг C=C', 'The π bond prevents rotation about C=C', 'π-bogʻ C=C atrofida aylanishga yoʻl qoʻymaydi'], true],
        [['У них разные брутто-формулы', 'Their molecular formulas differ', 'Ularning molekulyar formulalari har xil']],
        [['В транс-изомере тройная связь', 'The trans isomer has a triple bond', 'Trans-izomerda uchli bogʻ bor']],
        [['У них разное число атомов C', 'They have different numbers of C atoms', 'Ularda C atomlari soni har xil']],
      ]),
      Q('ale-typo57', [
        'С. 57: 3-метилбутен-1 напечатан как «H₃C=CH–CH(CH₃)–CH₃». Как правильно?',
        'P. 57: 3-methylbut-1-ene is printed as “H₃C=CH–CH(CH₃)–CH₃”. What is correct?',
        '57-bet: 3-metilbuten-1 «H₃C=CH–CH(CH₃)–CH₃» deb bosilgan. Toʻgʻrisi qanday?',
      ], undefined, [
        [['Запись верна', 'The formula is correct', 'Yozuv toʻgʻri']],
        [['H₃C–CH=C(CH₃)–CH₃', 'H₃C–CH=C(CH₃)–CH₃', 'H₃C–CH=C(CH₃)–CH₃']],
        [['H₂C=CH–CH(CH₃)–CH₃: у атома C с двойной связью только два H', 'H₂C=CH–CH(CH₃)–CH₃: a doubly bonded C carries only two H', 'H₂C=CH–CH(CH₃)–CH₃: qoʻsh bogʻli C da faqat ikki H'], true],
        [['HC≡C–CH(CH₃)–CH₃', 'HC≡C–CH(CH₃)–CH₃', 'HC≡C–CH(CH₃)–CH₃']],
      ]),
    ],
  },
  {
    id: 'g10-alkadienes',
    titleRu: 'Алкадиены и каучук (с. 63–70)',
    titleEn: 'Alkadienes and rubber (pp. 63–70)',
    titleUz: 'Alkadiyenlar va kauchuk (63–70-betlar)',
    questions: [
      Q('dien-allene', [
        'Какие двойные связи в пропадиене (аллене) CH₂=C=CH₂?',
        'What kind of double bonds does propadiene (allene) CH₂=C=CH₂ have?',
        'Propadiyen (allen) CH₂=C=CH₂ da qanday qoʻsh bogʻlar?',
      ], 'CH₂=C=CH₂', [
        [['Кумулированные (у одного атома C)', 'Cumulated (on one carbon)', 'Kumulyatsiyalangan (bitta C da)'], true],
        [['Сопряжённые', 'Conjugated', 'Tutash']],
        [['Изолированные', 'Isolated', 'Izolyatsiyalangan']],
        [['Это тройная связь', 'It is a triple bond', 'Bu uchli bogʻ']],
      ]),
      Q('dien-conj', [
        'Какие двойные связи в бутадиене-1,3 CH₂=CH–CH=CH₂?',
        'What kind of double bonds does buta-1,3-diene CH₂=CH–CH=CH₂ have?',
        'Butadiyen-1,3 CH₂=CH–CH=CH₂ da qanday qoʻsh bogʻlar?',
      ], 'CH₂=CH–CH=CH₂', [
        [['Изолированные', 'Isolated', 'Izolyatsiyalangan']],
        [['Сопряжённые — разделены одной одинарной связью', 'Conjugated — separated by one single bond', 'Tutash — bitta oddiy bogʻ bilan ajralgan'], true],
        [['Кумулированные', 'Cumulated', 'Kumulyatsiyalangan']],
        [['Ароматические', 'Aromatic', 'Aromatik']],
      ]),
      Q('dien-isolated', [
        'Какие двойные связи в гексадиене-1,5 H₂C=CH–CH₂–CH₂–CH=CH₂?',
        'What kind of double bonds does hexa-1,5-diene H₂C=CH–CH₂–CH₂–CH=CH₂ have?',
        'Geksadiyen-1,5 H₂C=CH–CH₂–CH₂–CH=CH₂ da qanday qoʻsh bogʻlar?',
      ], 'C₆H₁₀', [
        [['Сопряжённые', 'Conjugated', 'Tutash']],
        [['Кумулированные', 'Cumulated', 'Kumulyatsiyalangan']],
        [['Изолированные — между ними две одинарные связи и больше', 'Isolated — two or more single bonds between them', 'Izolyatsiyalangan — ular orasida ikki va undan koʻp oddiy bogʻ'], true],
        [['Это не диен', 'It is not a diene', 'Bu diyen emas']],
      ]),
      Q('dien-hyb', [
        'Гибридизация среднего атома C в аллене (с. 63)?',
        'Hybridization of the middle carbon in allene (p. 63)?',
        'Allendagi oʻrta C atomining gibridlanishi (63-bet)?',
      ], 'CH₂=C=CH₂', [
        ['sp³'],
        ['sp²'],
        [['sp (угол 180°)', 'sp (180°)', 'sp (180°)'], true],
        [['без гибридизации', 'none', 'gibridlanmagan']],
      ]),
      Q('dien-typo-c7', [
        'С. 64: у 3-метилгексадиена-1,5 CH₂=CH–CH(CH₃)–CH₂–CH=CH₂ подписано «C₇H₁₄». Какая формула верна?',
        'P. 64: 3-methylhexa-1,5-diene CH₂=CH–CH(CH₃)–CH₂–CH=CH₂ is labelled “C₇H₁₄”. Which formula is right?',
        '64-bet: 3-metilgeksadiyen-1,5 CH₂=CH–CH(CH₃)–CH₂–CH=CH₂ «C₇H₁₄» deb yozilgan. Qaysi formula toʻgʻri?',
      ], 'CₙH₂ₙ₋₂', [
        [['C₇H₁₄ — верно', 'C₇H₁₄ is right', 'C₇H₁₄ — toʻgʻri']],
        [['C₇H₁₂: у диенов CₙH₂ₙ₋₂', 'C₇H₁₂: dienes are CₙH₂ₙ₋₂', 'C₇H₁₂: diyenlar CₙH₂ₙ₋₂'], true],
        ['C₇H₁₆'],
        ['C₆H₁₀'],
      ]),
      Q('dien-typo-label', [
        'С. 65: у формулы CH₂=CH–CH=CH₂ стоит подпись «бутадиен-1,2». Как правильно?',
        'P. 65: the formula CH₂=CH–CH=CH₂ is labelled “buta-1,2-diene”. What is correct?',
        '65-bet: CH₂=CH–CH=CH₂ formulasi «butadiyen-1,2» deb yozilgan. Toʻgʻrisi qanday?',
      ], 'CH₂=CH–CH=CH₂', [
        [['Бутадиен-1,2 — верно', 'Buta-1,2-diene is right', 'Butadiyen-1,2 — toʻgʻri']],
        [['Бутин-2', 'But-2-yne', 'Butin-2']],
        [['Бутадиен-1,3 (бута-1,3-диен)', 'Buta-1,3-diene', 'Butadiyen-1,3 (buta-1,3-diyen)'], true],
        [['Бутен-1', 'But-1-ene', 'Buten-1']],
      ]),
      Q('dien-14', [
        'Продукт 1,4-присоединения брома к бутадиену-1,3 (с. 66)?',
        'The 1,4-addition product of bromine and buta-1,3-diene (p. 66)?',
        'Butadiyen-1,3 ga bromning 1,4-birikish mahsuloti (66-bet)?',
      ], 'CH₂=CH–CH=CH₂ + Br₂', [
        [['1,4-Дибромбутен-2 CH₂Br–CH=CH–CH₂Br', '1,4-Dibromobut-2-ene CH₂Br–CH=CH–CH₂Br', '1,4-Dibrombuten-2 CH₂Br–CH=CH–CH₂Br'], true],
        [['3,4-Дибромбутен-1 CH₂Br–CHBr–CH=CH₂', '3,4-Dibromobut-1-ene CH₂Br–CHBr–CH=CH₂', '3,4-Dibrombuten-1 CH₂Br–CHBr–CH=CH₂']],
        [['1,4-Дибромбутан', '1,4-Dibromobutane', '1,4-Dibrombutan']],
        [['1,2,3,4-Тетрабромбутан', '1,2,3,4-Tetrabromobutane', '1,2,3,4-Tetrabrombutan']],
      ]),
      Q('dien-h2', [
        'Мольное соотношение бутадиен : H₂ при полном гидрировании (с. 67)?',
        'Mole ratio butadiene : H₂ for complete hydrogenation (p. 67)?',
        'Toʻliq gidrogenlashda butadiyen : H₂ mol nisbati (67-bet)?',
      ], undefined, [['1 : 1'], ['1 : 2', true], ['2 : 1'], ['1 : 3']]),
      Q('dien-natural', [
        'Какой мономер соответствует натуральному каучуку (полиизопрену)?',
        'Which monomer corresponds to natural rubber (polyisoprene)?',
        'Tabiiy kauchukka (poliizopren) qaysi monomer mos keladi?',
      ], undefined, [
        [['Изопрен — 2-метилбутадиен-1,3', 'Isoprene — 2-methylbuta-1,3-diene', 'Izopren — 2-metilbutadiyen-1,3'], true],
        [['Хлоропрен', 'Chloroprene', 'Xloropren']],
        [['Стирол', 'Styrene', 'Stirol']],
        [['Этилен', 'Ethylene', 'Etilen']],
      ]),
      Q('dien-vulc', [
        'Что происходит при вулканизации каучука (с. 69)?',
        'What happens when rubber is vulcanized (p. 69)?',
        'Kauchuk vulkanizatsiyalanganda nima sodir boʻladi (69-bet)?',
      ], undefined, [
        [['Каучук разлагается на мономеры', 'The rubber breaks down into monomers', 'Kauchuk monomerlarga parchalanadi']],
        [['Двойные связи гидрируются водородом', 'The double bonds are hydrogenated', 'Qoʻsh bogʻlar vodorod bilan gidrogenlanadi']],
        [['Сера сшивает цепи мостиками по двойным связям', 'Sulfur cross-links the chains with bridges at the double bonds', 'Oltingugurt zanjirlarni qoʻsh bogʻlar boʻyicha koʻpriklar bilan tikadi'], true],
        [['Цепи окисляются до CO₂', 'The chains are oxidised to CO₂', 'Zanjirlar CO₂ gacha oksidlanadi']],
      ]),
    ],
  },
  {
    id: 'g10-alkynes',
    titleRu: 'Алкины (с. 72–75)',
    titleEn: 'Alkynes (pp. 72–75)',
    titleUz: 'Alkinlar (72–75-betlar)',
    questions: [
      Q('yne-formula', [
        'Общая формула алкинов?',
        'The general formula of alkynes?',
        'Alkinlarning umumiy formulasi?',
      ], 'C≡C', [['CₙH₂ₙ₊₂'], ['CₙH₂ₙ'], ['CₙH₂ₙ₋₂', true], ['CₙH₂ₙ₋₆']]),
      Q('yne-no-cistrans', [
        'Почему у алкинов нет цис/транс-изомеров (с. 73)?',
        'Why do alkynes have no cis/trans isomers (p. 73)?',
        'Nega alkinlarda sis/trans-izomerlar yoʻq (73-bet)?',
      ], 'CH₃–C≡C–CH₃', [
        [['Фрагмент C–C≡C–C линейный (180°)', 'The C–C≡C–C unit is linear (180°)', 'C–C≡C–C fragmenti chiziqli (180°)'], true],
        [['Вокруг тройной связи свободное вращение', 'There is free rotation about the triple bond', 'Uchli bogʻ atrofida erkin aylanish bor']],
        [['Атомы C тройной связи — sp³', 'The triple-bond carbons are sp³', 'Uchli bogʻ C atomlari — sp³']],
        [['У алкинов вообще нет изомеров', 'Alkynes have no isomers at all', 'Alkinlarda umuman izomer yoʻq']],
      ]),
      Q('yne-label-typo', [
        'С. 73: изомеры C₄H₆ HC≡C–CH₂–CH₃ и CH₃–C≡C–CH₃ подписаны «бутен-1» и «бутен-2». Как правильно?',
        'P. 73: the C₄H₆ isomers HC≡C–CH₂–CH₃ and CH₃–C≡C–CH₃ are labelled “butene-1” and “butene-2”. What is correct?',
        '73-bet: C₄H₆ izomerlari HC≡C–CH₂–CH₃ va CH₃–C≡C–CH₃ «buten-1» va «buten-2» deb yozilgan. Toʻgʻrisi qanday?',
      ], 'C₄H₆', [
        [['Бутен-1 и бутен-2 — верно', 'Butene-1 and butene-2 are right', 'Buten-1 va buten-2 — toʻgʻri']],
        [['Бутин-1 и бутин-2 (бут-1-ин, бут-2-ин)', 'But-1-yne and but-2-yne', 'Butin-1 va butin-2 (but-1-in, but-2-in)'], true],
        [['Бутадиен-1,2 и бутадиен-1,3', 'Buta-1,2-diene and buta-1,3-diene', 'Butadiyen-1,2 va butadiyen-1,3']],
        [['Бутан и изобутан', 'Butane and isobutane', 'Butan va izobutan']],
      ]),
      Q('yne-name', [
        'Как называется HC≡C–CH(CH₃)–CH₃ (с. 73)?',
        'What is HC≡C–CH(CH₃)–CH₃ called (p. 73)?',
        'HC≡C–CH(CH₃)–CH₃ qanday nomlanadi (73-bet)?',
      ], 'C₅H₈', [
        [['2-Метилбутин-3', '2-Methylbut-3-yne', '2-Metilbutin-3']],
        [['3-Метилбутен-1', '3-Methylbut-1-ene', '3-Metilbuten-1']],
        [['Пентин-1', 'Pent-1-yne', 'Pentin-1']],
        [['3-Метилбутин-1 (3-метилбут-1-ин)', '3-Methylbut-1-yne', '3-Metilbutin-1 (3-metilbut-1-in)'], true],
      ]),
      Q('yne-interclass', [
        'Межклассовый изомер пропина HC≡C–CH₃ (с. 73)?',
        'An interclass isomer of propyne HC≡C–CH₃ (p. 73)?',
        'Propin HC≡C–CH₃ ning sinflararo izomeri (73-bet)?',
      ], 'C₃H₄', [
        [['Пропадиен CH₂=C=CH₂', 'Propadiene CH₂=C=CH₂', 'Propadiyen CH₂=C=CH₂'], true],
        [['Пропен CH₂=CH–CH₃', 'Propene CH₂=CH–CH₃', 'Propen CH₂=CH–CH₃']],
        [['Циклопропан', 'Cyclopropane', 'Tsiklopropan']],
        [['Пропан', 'Propane', 'Propan']],
      ]),
      Q('yne-kucherov', [
        'Реакция Кучерова (с. 74): HC≡CH + H₂O (Hg²⁺) даёт…',
        'The Kucherov reaction (p. 74): HC≡CH + H₂O (Hg²⁺) gives…',
        'Kucherov reaksiyasi (74-bet): HC≡CH + H₂O (Hg²⁺) … beradi',
      ], undefined, [
        [['Этанол', 'Ethanol', 'Etanol']],
        [['Уксусный альдегид CH₃–CHO', 'Acetaldehyde CH₃–CHO', 'Sirka aldegidi CH₃–CHO'], true],
        [['Уксусную кислоту', 'Acetic acid', 'Sirka kislota']],
        [['Этилен', 'Ethylene', 'Etilen']],
      ]),
      Q('yne-zelinsky', [
        'Что получается из трёх молекул ацетилена на активированном угле (с. 75)?',
        'What do three acetylene molecules give over activated carbon (p. 75)?',
        'Faollashtirilgan koʻmirda uchta atsetilen molekulasidan nima olinadi (75-bet)?',
      ], '3HC≡CH', [
        [['Бензол C₆H₆', 'Benzene C₆H₆', 'Benzol C₆H₆'], true],
        [['Циклогексан', 'Cyclohexane', 'Tsiklogeksan']],
        [['Гексин-1', 'Hex-1-yne', 'Geksin-1']],
        [['Бутадиен', 'Butadiene', 'Butadiyen']],
      ]),
      Q('yne-kmno4-typo', [
        'С. 75: «3CH≡CH + 8KMnO₄ → 3KOOC–COOK + 8MnO₂ + 2KOH + 2H₂». Что верно вместо «2H₂»?',
        'P. 75: “3CH≡CH + 8KMnO₄ → 3KOOC–COOK + 8MnO₂ + 2KOH + 2H₂”. What is right instead of “2H₂”?',
        '75-bet: «3CH≡CH + 8KMnO₄ → 3KOOC–COOK + 8MnO₂ + 2KOH + 2H₂». «2H₂» oʻrniga nima toʻgʻri?',
      ], undefined, [
        [['2H₂ — верно', '2H₂ is right', '2H₂ — toʻgʻri']],
        ['4H₂O'],
        [['2H₂O — иначе не сходится кислород', '2H₂O — otherwise oxygen does not balance', '2H₂O — aks holda kislorod tenglashmaydi'], true],
        ['H₂O₂'],
      ]),
    ],
  },
  {
    id: 'g10-arenes',
    titleRu: 'Арены и стирол (с. 77–83)',
    titleEn: 'Arenes and styrene (pp. 77–83)',
    titleUz: 'Arenlar va stirol (77–83-betlar)',
    questions: [
      Q('ar-hyb', [
        'Гибридизация атомов C в бензоле?',
        'Hybridization of the carbons in benzene?',
        'Benzoldagi C atomlarining gibridlanishi?',
      ], 'C₆H₆', [
        ['sp³'],
        [['sp², единая 6π-система, углы 120°', 'sp², one 6π system, 120° angles', 'sp², yagona 6π-tizim, 120° burchak'], true],
        ['sp'],
        [['чередуются sp² и sp³', 'alternating sp² and sp³', 'sp² va sp³ navbatlashadi']],
      ]),
      Q('ar-xylene-m', [
        'Как называется 1,3-диметилбензол (с. 78)?',
        'What is 1,3-dimethylbenzene called (p. 78)?',
        '1,3-dimetilbenzol qanday nomlanadi (78-bet)?',
      ], 'C₆H₄(CH₃)₂', [
        [['о-Ксилол', 'o-Xylene', 'o-Ksilol']],
        [['м-Ксилол', 'm-Xylene', 'm-Ksilol'], true],
        [['п-Ксилол', 'p-Xylene', 'p-Ksilol']],
        [['Этилбензол', 'Ethylbenzene', 'Etilbenzol']],
      ]),
      Q('ar-br2', [
        'Бензол + Br₂ (FeBr₃, t) — какая это реакция (с. 79)?',
        'Benzene + Br₂ (FeBr₃, t) — what type of reaction (p. 79)?',
        'Benzol + Br₂ (FeBr₃, t) — bu qanday reaksiya (79-bet)?',
      ], undefined, [
        [['Замещение: C₆H₅Br + HBr', 'Substitution: C₆H₅Br + HBr', 'Oʻrin olish: C₆H₅Br + HBr'], true],
        [['Присоединение: C₆H₆Br₂', 'Addition: C₆H₆Br₂', 'Birikish: C₆H₆Br₂']],
        [['Бензол с бромом не реагирует', 'Benzene does not react with bromine', 'Benzol brom bilan reaksiyaga kirishmaydi']],
        [['Окисление до CO₂', 'Oxidation to CO₂', 'CO₂ gacha oksidlanish']],
      ]),
      Q('ar-toluene-ox', [
        'Что даёт толуол с KMnO₄ в кислой среде (с. 80)?',
        'What does toluene give with acidic KMnO₄ (p. 80)?',
        'Toluol kislotali muhitda KMnO₄ bilan nima beradi (80-bet)?',
      ], 'C₆H₅–CH₃', [
        [['Бензойную кислоту: окисляется только боковая цепь', 'Benzoic acid: only the side chain is oxidised', 'Benzoy kislota: faqat yon zanjir oksidlanadi'], true],
        [['Кольцо разрушается до CO₂ и H₂O', 'The ring is destroyed to CO₂ and H₂O', 'Halqa CO₂ va H₂O gacha parchalanadi']],
        [['Бензол и метанол', 'Benzene and methanol', 'Benzol va metanol']],
        [['Не реагирует', 'No reaction', 'Reaksiyaga kirishmaydi']],
      ]),
      Q('ar-tnt', [
        'Толуол + 3HNO₃ (H₂SO₄) — продукт (с. 80)?',
        'Toluene + 3HNO₃ (H₂SO₄) — the product (p. 80)?',
        'Toluol + 3HNO₃ (H₂SO₄) — mahsulot (80-bet)?',
      ], undefined, [
        [['Нитробензол', 'Nitrobenzene', 'Nitrobenzol']],
        [['3-Нитротолуол', '3-Nitrotoluene', '3-Nitrotoluol']],
        [['2,4,6-Тринитротолуол (тротил)', '2,4,6-Trinitrotoluene (TNT)', '2,4,6-Trinitrotoluol (trotil)'], true],
        [['Бензойная кислота', 'Benzoic acid', 'Benzoy kislota']],
      ]),
      Q('ar-cl2-uv', [
        'C₆H₆ + 3Cl₂ на УФ-свету (с. 80) — продукт?',
        'C₆H₆ + 3Cl₂ under UV light (p. 80) — the product?',
        'UB-nurda C₆H₆ + 3Cl₂ (80-bet) — mahsulot?',
      ], undefined, [
        [['Хлорбензол', 'Chlorobenzene', 'Xlorbenzol']],
        [['Гексахлорбензол C₆Cl₆', 'Hexachlorobenzene C₆Cl₆', 'Geksaxlorbenzol C₆Cl₆']],
        [['Гексахлорциклогексан C₆H₆Cl₆ — присоединение', 'Hexachlorocyclohexane C₆H₆Cl₆ — addition', 'Geksaxlortsiklogeksan C₆H₆Cl₆ — birikish'], true],
        [['Не реагирует', 'No reaction', 'Reaksiyaga kirishmaydi']],
      ]),
      Q('ar-styrene-typo', [
        'С. 83: стирол получают «гидрированием этилбензола». Как правильно?',
        'P. 83: styrene is made “by hydrogenation of ethylbenzene”. What is correct?',
        '83-bet: stirol «etilbenzolni gidrogenlab» olinadi. Toʻgʻrisi qanday?',
      ], 'C₆H₅–CH₂–CH₃ → C₆H₅–CH=CH₂ + H₂', [
        [['Гидрированием — верно', 'Hydrogenation is right', 'Gidrogenlash — toʻgʻri']],
        [['Дегидрированием: водород выделяется', 'Dehydrogenation: hydrogen is released', 'Degidrogenlash: vodorod ajraladi'], true],
        [['Гидратацией', 'Hydration', 'Gidratlash']],
        [['Хлорированием', 'Chlorination', 'Xlorlash']],
      ]),
      Q('ar-styrene-hcl', [
        'Стирол + HCl (с. 82) — продукт по правилу Марковникова?',
        'Styrene + HCl (p. 82) — the Markovnikov product?',
        'Stirol + HCl (82-bet) — Markovnikov qoidasi boʻyicha mahsulot?',
      ], 'C₆H₅–CH=CH₂ + HCl', [
        [['(2-Хлорэтил)бензол C₆H₅–CH₂–CH₂Cl', '(2-Chloroethyl)benzene C₆H₅–CH₂–CH₂Cl', '(2-Xloretil)benzol C₆H₅–CH₂–CH₂Cl']],
        [['(1-Хлорэтил)бензол C₆H₅–CHCl–CH₃', '(1-Chloroethyl)benzene C₆H₅–CHCl–CH₃', '(1-Xloretil)benzol C₆H₅–CHCl–CH₃'], true],
        [['Хлорбензол и этилен', 'Chlorobenzene and ethylene', 'Xlorbenzol va etilen']],
        [['(1,2-Дихлорэтил)бензол', '(1,2-Dichloroethyl)benzene', '(1,2-Dixloretil)benzol']],
      ]),
      Q('ar-styrene-cold', [
        'Стирол + KMnO₄ + H₂O при 0 °C (с. 83) — продукт?',
        'Styrene + KMnO₄ + H₂O at 0 °C (p. 83) — the product?',
        '0 °C da stirol + KMnO₄ + H₂O (83-bet) — mahsulot?',
      ], undefined, [
        [['Бензойная кислота и CO₂', 'Benzoic acid and CO₂', 'Benzoy kislota va CO₂']],
        [['Этилбензол', 'Ethylbenzene', 'Etilbenzol']],
        [['Полистирол', 'Polystyrene', 'Polistirol']],
        [['1-Фенилэтан-1,2-диол C₆H₅–CH(OH)–CH₂OH', '1-Phenylethane-1,2-diol C₆H₅–CH(OH)–CH₂OH', '1-Feniletan-1,2-diol C₆H₅–CH(OH)–CH₂OH'], true],
      ]),
    ],
  },
  {
    id: 'g10-sources-tasks',
    titleRu: 'Природные источники: задачи с. 87 и 95',
    titleEn: 'Natural sources: tasks pp. 87 and 95',
    titleUz: 'Tabiiy manbalar: 87 va 95-betlar masalalari',
    questions: [
      Q('src-t1', [
        'Задача 1 (с. 87): на сжигание метана ушло 67,2 л O₂ (н. у.). Какова масса CO₂? (CH₄ + 2O₂ → CO₂ + 2H₂O)',
        'Task 1 (p. 87): burning methane used 67.2 L of O₂ (STP). What mass of CO₂ forms? (CH₄ + 2O₂ → CO₂ + 2H₂O)',
        '1-masala (87-bet): metanni yoqishga 67,2 l O₂ (n. sh.) sarflandi. CO₂ massasi qancha? (CH₄ + 2O₂ → CO₂ + 2H₂O)',
      ], 'n(O₂) = 67,2 : 22,4', [[['33 г', '33 g', '33 g']], [['44 г', '44 g', '44 g']], [['66 г', '66 g', '66 g'], true], [['132 г', '132 g', '132 g']]]),
      Q('src-t2', [
        'Задача 2 (с. 87): сколько моль ацетилена получится из 6 моль метана? (2CH₄ → C₂H₂ + 3H₂)',
        'Task 2 (p. 87): how many moles of acetylene come from 6 mol of methane? (2CH₄ → C₂H₂ + 3H₂)',
        '2-masala (87-bet): 6 mol metandan necha mol atsetilen olinadi? (2CH₄ → C₂H₂ + 3H₂)',
      ], undefined, [[['2 моль', '2 mol', '2 mol']], [['3 моль', '3 mol', '3 mol'], true], [['6 моль', '6 mol', '6 mol']], [['12 моль', '12 mol', '12 mol']]]),
      Q('src-m-isobutane', [
        'Практическое занятие (с. 95): молярная масса 2-метилпропана?',
        'Practical (p. 95): the molar mass of 2-methylpropane?',
        'Amaliy mashgʻulot (95-bet): 2-metilpropanning molyar massasi?',
      ], 'C₄H₁₀', [[['56 г/моль', '56 g/mol', '56 g/mol']], [['58 г/моль', '58 g/mol', '58 g/mol'], true], [['72 г/моль', '72 g/mol', '72 g/mol']], [['44 г/моль', '44 g/mol', '44 g/mol']]]),
      Q('src-m-cyclobutane', [
        'Практическое занятие (с. 95): молярная масса циклобутана?',
        'Practical (p. 95): the molar mass of cyclobutane?',
        'Amaliy mashgʻulot (95-bet): tsiklobutanning molyar massasi?',
      ], 'C₄H₈', [[['56 г/моль', '56 g/mol', '56 g/mol'], true], [['58 г/моль', '58 g/mol', '58 g/mol']], [['54 г/моль', '54 g/mol', '54 g/mol']], [['70 г/моль', '70 g/mol', '70 g/mol']]]),
      Q('src-air', [
        'Практическое занятие (с. 95): во сколько раз 1,2-дихлорэтан тяжелее воздуха?',
        'Practical (p. 95): how many times heavier than air is 1,2-dichloroethane?',
        'Amaliy mashgʻulot (95-bet): 1,2-dixloretan havodan necha marta ogʻir?',
      ], 'M(C₂H₄Cl₂) : M(возд.)', [[['≈ 1,7', '≈ 1.7', '≈ 1,7']], [['≈ 2,4', '≈ 2.4', '≈ 2,4']], [['≈ 3,4 (99 : 29)', '≈ 3.4 (99 : 29)', '≈ 3,4 (99 : 29)'], true], [['≈ 4,5', '≈ 4.5', '≈ 4,5']]]),
      Q('src-name', [
        'Практическое занятие (с. 95): как называется HC≡C–C(CH₃)₂–CH₃?',
        'Practical (p. 95): what is HC≡C–C(CH₃)₂–CH₃ called?',
        'Amaliy mashgʻulot (95-bet): HC≡C–C(CH₃)₂–CH₃ qanday nomlanadi?',
      ], 'C₆H₁₀', [
        [['2,2-Диметилбутин-3', '2,2-Dimethylbut-3-yne', '2,2-Dimetilbutin-3']],
        [['3,3-Диметилбутин-1 (3,3-диметилбут-1-ин)', '3,3-Dimethylbut-1-yne', '3,3-Dimetilbutin-1 (3,3-dimetilbut-1-in)'], true],
        [['Гексин-1', 'Hex-1-yne', 'Geksin-1']],
        [['3,3-Диметилбутен-1', '3,3-Dimethylbut-1-ene', '3,3-Dimetilbuten-1']],
      ]),
    ],
  },
  {
    id: 'g10-ch2-summary',
    titleRu: 'Итог главы II: таблица с. 100 и цепочки с. 101–102',
    titleEn: 'Chapter II summary: table p. 100 and chains pp. 101–102',
    titleUz: 'II bob yakuni: 100-bet jadvali va 101–102-betlar zanjirlari',
    questions: [
      Q('sum-row-alkene', [
        'Таблица с. 100: строка «CₙH₂ₙ, sp², 120°, C=C 0,134 нм» подписана в учебнике «Алкины». Какой это класс на самом деле?',
        'Table p. 100: the row “CₙH₂ₙ, sp², 120°, C=C 0.134 nm” is labelled “Alkynes” in the textbook. Which class is it really?',
        '100-bet jadvali: «CₙH₂ₙ, sp², 120°, C=C 0,134 nm» qatori darslikda «Alkinlar» deb yozilgan. Aslida qaysi sinf?',
      ], 'CₙH₂ₙ · sp² · 120°', [[['Алкины', 'Alkynes', 'Alkinlar']], [['Алкены', 'Alkenes', 'Alkenlar'], true], [['Арены', 'Arenes', 'Arenlar']], [['Алканы', 'Alkanes', 'Alkanlar']]]),
      Q('sum-row-alkyne', [
        'Строка «H–C≡C–H, sp, 180°, C≡C 0,120 нм» подписана «Арены CₙH₂ₙ₋₂». Какой это класс?',
        'The row “H–C≡C–H, sp, 180°, C≡C 0.120 nm” is labelled “Arenes CₙH₂ₙ₋₂”. Which class is it?',
        '«H–C≡C–H, sp, 180°, C≡C 0,120 nm» qatori «Arenlar CₙH₂ₙ₋₂» deb yozilgan. Bu qaysi sinf?',
      ], 'sp · 180°', [[['Арены', 'Arenes', 'Arenlar']], [['Алкены', 'Alkenes', 'Alkenlar']], [['Алкины CₙH₂ₙ₋₂', 'Alkynes CₙH₂ₙ₋₂', 'Alkinlar CₙH₂ₙ₋₂'], true], [['Циклоалканы', 'Cycloalkanes', 'Tsikloalkanlar']]]),
      Q('sum-arene-hyb', [
        'Гибридизация атомов C у аренов (в таблице с. 100 указана неверно)?',
        'Hybridization of arene carbons (wrong in the p. 100 table)?',
        'Arenlardagi C atomlarining gibridlanishi (100-bet jadvalida xato)?',
      ], 'C₆H₆', [['sp³'], ['sp'], [['sp², единая 6π-система', 'sp², one 6π system', 'sp², yagona 6π-tizim'], true], [['sp³ и sp', 'sp³ and sp', 'sp³ va sp']]]),
      Q('sum-cyclo-bonds', [
        'Какие связи в молекулах циклоалканов (в таблице «σC–H, σC–H»)?',
        'Which bonds do cycloalkane molecules have (the table says “σC–H, σC–H”)?',
        'Tsikloalkan molekulalarida qanday bogʻlar bor (jadvalda «σC–H, σC–H»)?',
      ], 'CₙH₂ₙ', [[['Только σC–H', 'Only σC–H', 'Faqat σC–H']], [['σC–C и σC–H', 'σC–C and σC–H', 'σC–C va σC–H'], true], [['σC–C и πC=C', 'σC–C and πC=C', 'σC–C va πC=C']], [['Только π-связи', 'Only π bonds', 'Faqat π-bogʻlar']]]),
      Q('sum-cyclo-angle', [
        'Угол C–C–C в циклопропане (с. 100)?',
        'The C–C–C angle in cyclopropane (p. 100)?',
        'Tsiklopropandagi C–C–C burchagi (100-bet)?',
      ], 'C₃H₆', [['60°', true], ['90°'], ['109,5°'], ['120°']]),
      Q('sum-benzene-length', [
        'Длина связи C–C в бензоле (с. 100)?',
        'The C–C bond length in benzene (p. 100)?',
        'Benzoldagi C–C bogʻ uzunligi (100-bet)?',
      ], undefined, [
        [['0,154 нм', '0.154 nm', '0,154 nm']],
        [['0,140 нм — между одинарной (0,154) и двойной (0,134)', '0.140 nm — between single (0.154) and double (0.134)', '0,140 nm — oddiy (0,154) va qoʻsh (0,134) orasida'], true],
        [['0,134 нм', '0.134 nm', '0,134 nm']],
        [['0,120 нм', '0.120 nm', '0,120 nm']],
      ]),
      Q('sum-reactions', [
        'Характерные реакции алкенов, алкинов и диенов (с. 100)?',
        'The typical reactions of alkenes, alkynes and dienes (p. 100)?',
        'Alken, alkin va diyenlarning xarakterli reaksiyalari (100-bet)?',
      ], undefined, [
        [['Радикальное замещение', 'Radical substitution', 'Radikal oʻrin olish']],
        [['Замещение в кольце', 'Ring substitution', 'Halqada oʻrin olish']],
        [['Присоединение', 'Addition', 'Birikish'], true],
        [['Только горение', 'Combustion only', 'Faqat yonish']],
      ]),
      Q('sum-chain-carbide', [
        'С. 101: «карбид кальция → этен → бензол…». Что должно стоять вместо «этен»?',
        'P. 101: “calcium carbide → ethene → benzene…”. What should replace “ethene”?',
        '101-bet: «kalsiy karbid → eten → benzol…». «Eten» oʻrnida nima boʻlishi kerak?',
      ], 'CaC₂ → ? → C₆H₆', [
        [['Этен — верно', 'Ethene is right', 'Eten — toʻgʻri']],
        [['Этин (ацетилен) C₂H₂ — он тримеризуется в бензол', 'Ethyne (acetylene) C₂H₂ — it trimerizes to benzene', 'Etin (atsetilen) C₂H₂ — u benzolga trimerlanadi'], true],
        [['Этан', 'Ethane', 'Etan']],
        [['Метан', 'Methane', 'Metan']],
      ]),
      Q('sum-chain-al4c3', [
        'С. 101: «карбид алюминия → метан → этен → этен → этан → хлорэтан». Где ошибка?',
        'P. 101: “aluminium carbide → methane → ethene → ethene → ethane → chloroethane”. Where is the error?',
        '101-bet: «alyuminiy karbid → metan → eten → eten → etan → xloretan». Xato qayerda?',
      ], undefined, [
        [['Ошибки нет', 'There is no error', 'Xato yoʻq']],
        [['Из карбида алюминия получается этин', 'Aluminium carbide gives ethyne', 'Alyuminiy karbiddan etin olinadi']],
        [['Этан не превращается в хлорэтан', 'Ethane cannot become chloroethane', 'Etan xloretanga aylanmaydi']],
        [['Повтор «этен → этен»: по смыслу метан → этин → этен → этан', 'The repeat “ethene → ethene”: it should be methane → ethyne → ethene → ethane', '«Eten → eten» takrori: mazmunan metan → etin → eten → etan'], true],
      ]),
      Q('sum-x3', [
        'Цепочка с. 101: пропан → X₁ → X₂ → X₃. Что такое X₃ (X₂ + C₆H₆, AlCl₃)?',
        'Chain p. 101: propane → X₁ → X₂ → X₃. What is X₃ (X₂ + C₆H₆, AlCl₃)?',
        '101-bet zanjiri: propan → X₁ → X₂ → X₃. X₃ nima (X₂ + C₆H₆, AlCl₃)?',
      ], undefined, [
        [['Изопропилбензол (кумол)', 'Isopropylbenzene (cumene)', 'Izopropilbenzol (kumol)'], true],
        [['Пропилбензол', 'Propylbenzene', 'Propilbenzol']],
        [['Толуол', 'Toluene', 'Toluol']],
        [['2-Бромпропан', '2-Bromopropane', '2-Brompropan']],
      ]),
      Q('sum-x5', [
        'С. 102: C₆H₅–COOH + C₂H₅OH → C₆H₅–COO–C₂H₅ + H₂O учебник называет «реакцией разложения». Какой это тип на самом деле?',
        'P. 102: the textbook calls C₆H₅–COOH + C₂H₅OH → C₆H₅–COO–C₂H₅ + H₂O a “decomposition”. What type is it really?',
        '102-bet: C₆H₅–COOH + C₂H₅OH → C₆H₅–COO–C₂H₅ + H₂O ni darslik «parchalanish reaksiyasi» deydi. Aslida bu qanday reaksiya?',
      ], undefined, [
        [['Разложение', 'Decomposition', 'Parchalanish']],
        [['Гидратация', 'Hydration', 'Gidratlanish']],
        [['Этерификация (кислота + спирт → сложный эфир + вода)', 'Esterification (acid + alcohol → ester + water)', 'Eterifikatsiya (kislota + spirt → murakkab efir + suv)'], true],
        [['Полимеризация', 'Polymerization', 'Polimerlanish']],
      ]),
    ],
  },
]
