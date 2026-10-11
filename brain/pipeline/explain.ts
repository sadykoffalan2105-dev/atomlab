/**
 * Мозг v2, ANSWERS: выверенные пояснения для запасного пути и блока «СПРАВОЧНИК ATOMLAB» (три языка).
 *   DETAILS — подробности ключевых понятий (для «подробнее», длинного и обычного класса длины): только факты
 *     школьного курса Kimyo 7–11, числа и уравнения проверены (уравнения уравнены, массы — по таблице);
 *   USES — применение («зачем нужен электролиз»);
 *   EXPLAINS — точечные объяснения частых вопросов («почему медь растворяется в азотной кислоте»);
 *   TRAPS — логические ловушки «если …, значит …» с короткой поправкой («катализатор смещает равновесие» — нет);
 *   VALENCE — типичные валентности элементов (римскими цифрами, как в учебнике).
 * Ключи DETAILS/USES — id понятий из brain/kb/concepts.ts.
 */
import type { Lang } from './normalize.ts'

type Tri = Record<Lang, string>
type TriList = Record<Lang, string[]>

export const DETAILS: Record<string, TriList> = {
  mole: {
    ru: [
      'Число 6,02·10²³ называют постоянной Авогадро (Nₐ): примерно столько атомов содержится в 12 г углерода-12.',
      'Масса одного моля — молярная масса M (г/моль); численно она равна относительной молекулярной массе Mr: M(H₂O) = 18 г/моль, M(CO₂) = 44 г/моль.',
      'Поэтому 1 моль воды — это 18 г, а 2 моль — 36 г; 1 моль любого газа при н. у. занимает 22,4 л.',
      'Через моль химик «считает» частицы взвешиванием: n = m/M, а коэффициенты в уравнении реакции показывают соотношение молей — в 2H₂ + O₂ → 2H₂O на 2 моль водорода идёт 1 моль кислорода.',
    ],
    uz: [
      '6,02·10²³ soni Avogadro doimiysi (Nₐ) deyiladi: 12 g uglerod-12 da taxminan shuncha atom bor.',
      'Bir mol moddaning massasi — molyar massa M (g/mol); son jihatdan u nisbiy molekulyar massa Mr ga teng: M(H₂O) = 18 g/mol, M(CO₂) = 44 g/mol.',
      'Shuning uchun 1 mol suv — 18 g, 2 mol esa 36 g; normal sharoitda istalgan gazning 1 moli 22,4 l hajmni egallaydi.',
      'Mol orqali kimyogar zarrachalarni tortib «sanaydi»: n = m/M, reaksiya tenglamasidagi koeffitsiyentlar esa mollar nisbatini koʻrsatadi — 2H₂ + O₂ → 2H₂O da 2 mol vodorodga 1 mol kislorod sarflanadi.',
    ],
    en: [
      'The number 6.02·10²³ is the Avogadro constant (Nₐ): roughly that many atoms are in 12 g of carbon-12.',
      'The mass of one mole is the molar mass M (g/mol); numerically it equals the relative molecular mass Mr: M(H₂O) = 18 g/mol, M(CO₂) = 44 g/mol.',
      'So 1 mol of water is 18 g and 2 mol is 36 g; 1 mol of any gas at STP occupies 22.4 L.',
      'With the mole a chemist “counts” particles by weighing: n = m/M, and the coefficients of an equation give the mole ratio — in 2H₂ + O₂ → 2H₂O, 2 mol of hydrogen react with 1 mol of oxygen.',
    ],
  },
  valence: {
    ru: [
      'Валентность находят по формуле: в бинарном соединении валентность × индекс одного элемента равна валентности × индексу другого — в Al₂O₃: III·2 = II·3 = 6.',
      'Постоянная валентность у водорода (I), кислорода (II), щелочных металлов (I), магния и кальция (II), алюминия (III); переменная — у серы (II, IV, VI), азота (III, IV), железа (II, III), меди (I, II).',
      'Число связей задают неспаренные электроны внешнего слоя: у кислорода их два, поэтому он двухвалентен; у углерода в возбуждённом состоянии — четыре (CH₄, CO₂).',
      'Валентность — число связей, без знака; степень окисления — условный заряд со знаком: в HNO₃ у азота валентность IV, а степень окисления +5.',
    ],
    uz: [
      'Valentlik formula boʻyicha topiladi: binar birikmada bir elementning valentligi × indeksi ikkinchisining valentligi × indeksiga teng — Al₂O₃ da III·2 = II·3 = 6.',
      'Doimiy valentlik vodorodda (I), kislorodda (II), ishqoriy metallarda (I), magniy va kalsiyda (II), alyuminiyda (III); oʻzgaruvchan valentlik oltingugurtda (II, IV, VI), azotda (III, IV), temirda (II, III), misda (I, II).',
      'Bogʻlar sonini tashqi qavatdagi juftlashmagan elektronlar belgilaydi: kislorodda ular ikkita, shuning uchun u ikki valentli; uglerodda qoʻzgʻalgan holatda — toʻrtta (CH₄, CO₂).',
      'Valentlik — bogʻlar soni, ishorasiz; oksidlanish darajasi — ishorali shartli zaryad: HNO₃ da azotning valentligi IV, oksidlanish darajasi esa +5.',
    ],
    en: [
      'Valence can be read from a formula: in a binary compound valence × subscript of one element equals that of the other — in Al₂O₃, III·2 = II·3 = 6.',
      'Hydrogen (I), oxygen (II), the alkali metals (I), magnesium and calcium (II) and aluminium (III) have a constant valence; sulfur (II, IV, VI), nitrogen (III, IV), iron (II, III) and copper (I, II) have a variable one.',
      'The number of bonds comes from the unpaired outer electrons: oxygen has two, so it is divalent; carbon in the excited state has four (CH₄, CO₂).',
      'Valence is a number of bonds without a sign, while the oxidation state is a signed formal charge: in HNO₃ nitrogen has valence IV but oxidation state +5.',
    ],
  },
  periodiclaw: {
    ru: [
      'Д. И. Менделеев открыл закон в 1869 году, расположив элементы по возрастанию атомной массы; позже выяснилось, что истинная основа — заряд ядра (порядковый номер Z).',
      'Период — горизонтальный ряд: у его атомов одинаковое число электронных слоёв; слева направо радиус атома уменьшается, металлические свойства ослабевают, неметаллические усиливаются.',
      'Группа — вертикальный столбец: у элементов главной подгруппы одинаковое число внешних электронов, поэтому свойства похожи — щелочные металлы Li, Na, K бурно реагируют с водой, а сверху вниз металлические свойства усиливаются.',
      'Менделеев оставил в таблице пустые клетки и предсказал свойства ещё не открытых галлия, скандия и германия; их открытие подтвердило закон.',
    ],
    uz: [
      'D. I. Mendeleyev qonunni 1869-yilda elementlarni atom massasi ortib borishi tartibida joylashtirib kashf etgan; keyinroq asl asos yadro zaryadi (tartib raqami Z) ekani aniqlandi.',
      'Davr — gorizontal qator: uning atomlarida elektron qavatlar soni bir xil; chapdan oʻngga atom radiusi kichrayadi, metallik xossalar susayadi, metallmaslik xossalar kuchayadi.',
      'Guruh — vertikal ustun: bosh guruhcha elementlarida tashqi elektronlar soni bir xil, shuning uchun xossalari oʻxshash — Li, Na, K ishqoriy metallari suv bilan shiddatli reaksiyaga kirishadi, yuqoridan pastga metallik xossalar kuchayadi.',
      'Mendeleyev jadvalda boʻsh kataklar qoldirib, hali ochilmagan galliy, skandiy va germaniy xossalarini oldindan aytgan; ularning kashf etilishi qonunni tasdiqladi.',
    ],
    en: [
      'D. I. Mendeleev discovered the law in 1869 by arranging the elements by increasing atomic mass; later it turned out that the true basis is the nuclear charge (atomic number Z).',
      'A period is a horizontal row whose atoms have the same number of electron shells; from left to right the atomic radius shrinks, metallic character weakens and non-metallic character grows.',
      'A group is a vertical column: main-group elements share the same number of outer electrons, so their properties are alike — the alkali metals Li, Na and K react vigorously with water, and metallic character grows down the group.',
      'Mendeleev left gaps in the table and predicted the properties of the then unknown gallium, scandium and germanium; their discovery confirmed the law.',
    ],
  },
  electrolysis: {
    ru: [
      'На катоде (−) частицы принимают электроны и восстанавливаются, на аноде (+) отдают электроны и окисляются.',
      'Расплав хлорида натрия даёт натрий и хлор: 2NaCl →(электролиз) 2Na + Cl₂↑, а его раствор — водород, хлор и щёлочь: 2NaCl + 2H₂O →(электролиз) H₂↑ + Cl₂↑ + 2NaOH.',
    ],
    uz: [
      'Katodda (−) zarrachalar elektron qabul qilib qaytariladi, anodda (+) elektron berib oksidlanadi.',
      'Natriy xlorid suyuqlanmasidan natriy va xlor olinadi: 2NaCl →(elektroliz) 2Na + Cl₂↑, uning eritmasidan esa vodorod, xlor va ishqor: 2NaCl + 2H₂O →(elektroliz) H₂↑ + Cl₂↑ + 2NaOH.',
    ],
    en: [
      'At the cathode (−) particles gain electrons and are reduced; at the anode (+) they lose electrons and are oxidised.',
      'Molten sodium chloride gives sodium and chlorine: 2NaCl →(electrolysis) 2Na + Cl₂↑, while its solution gives hydrogen, chlorine and alkali: 2NaCl + 2H₂O →(electrolysis) H₂↑ + Cl₂↑ + 2NaOH.',
    ],
  },
  catalyst: {
    ru: [
      'Катализатор открывает другой путь реакции с меньшей энергией активации, поэтому успешных столкновений частиц становится больше.',
      'Прямую и обратную реакции он ускоряет одинаково, поэтому равновесие устанавливается быстрее, но не смещается.',
      'Примеры: MnO₂ при разложении пероксида водорода 2H₂O₂ → 2H₂O + O₂↑, V₂O₅ в производстве серной кислоты, железо в синтезе аммиака, ферменты в организме.',
    ],
    uz: [
      'Katalizator aktivlanish energiyasi kichikroq boʻlgan boshqa reaksiya yoʻlini ochadi, shuning uchun zarrachalarning muvaffaqiyatli toʻqnashuvlari koʻpayadi.',
      'U toʻgʻri va teskari reaksiyalarni bir xil tezlashtiradi, shuning uchun muvozanat tezroq qaror topadi, lekin siljimaydi.',
      'Misollar: vodorod peroksid parchalanishida MnO₂ — 2H₂O₂ → 2H₂O + O₂↑, sulfat kislota ishlab chiqarishda V₂O₅, ammiak sintezida temir, organizmdagi fermentlar.',
    ],
    en: [
      'A catalyst opens another reaction pathway with a lower activation energy, so more particle collisions succeed.',
      'It speeds up the forward and reverse reactions equally, so equilibrium is reached faster but is not shifted.',
      'Examples: MnO₂ in the decomposition of hydrogen peroxide 2H₂O₂ → 2H₂O + O₂↑, V₂O₅ in sulfuric acid production, iron in ammonia synthesis, enzymes in the body.',
    ],
  },
  acid: {
    ru: [
      'Кислоты бывают кислородсодержащие (H₂SO₄, HNO₃, H₃PO₄) и бескислородные (HCl, H₂S), одноосновные (HCl, HNO₃) и многоосновные (H₂SO₄ — двухосновная, H₃PO₄ — трёхосновная).',
      'Типичные реакции кислот: с металлами, стоящими в ряду активности до водорода, — Zn + 2HCl → ZnCl₂ + H₂↑; с основными оксидами и основаниями — соль и вода; с солями более слабых кислот — CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑.',
      'Лакмус в растворе кислоты краснеет, метилоранж становится розовым.',
    ],
    uz: [
      'Kislotalar kislorodli (H₂SO₄, HNO₃, H₃PO₄) va kislorodsiz (HCl, H₂S), bir asosli (HCl, HNO₃) va koʻp asosli (H₂SO₄ — ikki asosli, H₃PO₄ — uch asosli) boʻladi.',
      'Kislotalarning odatiy reaksiyalari: faollik qatorida vodoroddan oldin turgan metallar bilan — Zn + 2HCl → ZnCl₂ + H₂↑; asosli oksidlar va asoslar bilan — tuz va suv; kuchsizroq kislotalar tuzlari bilan — CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑.',
      'Lakmus kislota eritmasida qizaradi, metiloranj pushti rangga kiradi.',
    ],
    en: [
      'Acids are oxygen-containing (H₂SO₄, HNO₃, H₃PO₄) or oxygen-free (HCl, H₂S), monobasic (HCl, HNO₃) or polybasic (H₂SO₄ is dibasic, H₃PO₄ tribasic).',
      'Typical reactions of acids: with metals above hydrogen in the activity series — Zn + 2HCl → ZnCl₂ + H₂↑; with basic oxides and bases — a salt and water; with salts of weaker acids — CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑.',
      'Litmus turns red in an acid solution and methyl orange turns pink.',
    ],
  },
  equilibrium: {
    ru: [
      'При равновесии скорости прямой и обратной реакций равны, поэтому концентрации веществ больше не меняются.',
      'По принципу Ле Шателье равновесие смещается в сторону, ослабляющую внешнее воздействие: при нагревании — в сторону эндотермической реакции, при росте давления — в сторону меньшего числа молекул газа.',
      'Катализатор равновесие не смещает: он лишь ускоряет его установление.',
    ],
    uz: [
      'Muvozanatda toʻgʻri va teskari reaksiyalar tezligi teng, shuning uchun moddalar konsentratsiyasi boshqa oʻzgarmaydi.',
      'Le Shatelye prinsipiga koʻra muvozanat tashqi taʼsirni susaytiradigan tomonga siljiydi: qizdirilganda — endotermik reaksiya tomonga, bosim oshganda — gaz molekulalari kamroq tomonga.',
      'Katalizator muvozanatni siljitmaydi: u faqat muvozanat qaror topishini tezlashtiradi.',
    ],
    en: [
      'At equilibrium the forward and reverse rates are equal, so the concentrations stop changing.',
      'By Le Chatelier’s principle equilibrium shifts to oppose an outside change: on heating — towards the endothermic reaction, on raising the pressure — towards fewer gas molecules.',
      'A catalyst does not shift equilibrium: it only makes it set in faster.',
    ],
  },
}

export const USES: Record<string, Tri> = {
  electrolysis: {
    ru: 'Где нужен электролиз: получение алюминия (электролиз Al₂O₃ в расплаве криолита), натрия, магния, хлора и гидроксида натрия (электролиз раствора NaCl); очистка (рафинирование) меди; гальванические покрытия — хромирование, никелирование, золочение; получение водорода и кислорода электролизом воды.',
    uz: 'Elektroliz qayerda kerak: alyuminiy olish (Al₂O₃ ni kriolit suyuqlanmasida elektroliz qilish), natriy, magniy, xlor va natriy gidroksid olish (NaCl eritmasi elektrolizi); misni tozalash (rafinatsiya); galvanik qoplamalar — xromlash, nikellash, zarhallash; suv elektrolizi bilan vodorod va kislorod olish.',
    en: 'Where electrolysis is used: producing aluminium (electrolysis of Al₂O₃ in molten cryolite), sodium, magnesium, chlorine and sodium hydroxide (electrolysis of NaCl solution); refining copper; electroplating — chrome, nickel and gold coatings; making hydrogen and oxygen by electrolysis of water.',
  },
  catalyst: {
    ru: 'Где нужны катализаторы: производство серной кислоты (V₂O₅) и аммиака (Fe), очистка выхлопных газов автомобилей (платина, палладий), переработка нефти; в живых клетках реакции ускоряют ферменты.',
    uz: 'Katalizatorlar qayerda kerak: sulfat kislota (V₂O₅) va ammiak (Fe) ishlab chiqarish, avtomobil chiqindi gazlarini tozalash (platina, palladiy), neftni qayta ishlash; tirik hujayralarda reaksiyalarni fermentlar tezlashtiradi.',
    en: 'Where catalysts are used: making sulfuric acid (V₂O₅) and ammonia (Fe), cleaning car exhaust (platinum, palladium), oil refining; in living cells enzymes speed up reactions.',
  },
}

type Explain = { re: RegExp; text: Tri }

export const EXPLAINS: Explain[] = [
  {
    // медь/серебро + азотная кислота: окислитель — нитрат-ион, водород не выделяется
    re: /((мед|медн|серебр|ртут|\bCu\b|\bAg\b|copper|silver|\bmis\b|misn|kumush)[^?.!]{0,60}(азотн|HNO₃|HNO3|nitric|nitrat kislota)|(азотн|HNO₃|HNO3|nitric|nitrat kislota)[^?.!]{0,60}(мед|медь|серебр|\bCu\b|\bAg\b|copper|silver|\bmis\b|kumush))/iu,
    text: {
      ru: 'Азотная кислота окисляет металлы не ионами H⁺, а нитрат-ионом NO₃⁻ (азот в степени окисления +5) — это сильный окислитель, поэтому она растворяет даже медь и серебро, стоящие после водорода, а водород при этом не выделяется: восстанавливается азот до NO или NO₂. С разбавленной кислотой: 3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O; с концентрированной: Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O. Соляная кислота окисляет только ионами H⁺, а их силы на медь и серебро не хватает.',
      uz: 'Nitrat kislota metallarni H⁺ ionlari bilan emas, nitrat-ion NO₃⁻ (azot +5 oksidlanish darajasida) bilan oksidlaydi — bu kuchli oksidlovchi, shuning uchun u vodoroddan keyin turgan mis va kumushni ham eritadi, vodorod esa ajralmaydi: azot NO yoki NO₂ gacha qaytariladi. Suyultirilgan kislota bilan: 3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O; konsentrlangan bilan: Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O. Xlorid kislota faqat H⁺ ionlari bilan oksidlaydi, ularning kuchi mis va kumushga yetmaydi.',
      en: 'Nitric acid oxidises metals not with H⁺ ions but with the nitrate ion NO₃⁻ (nitrogen in the +5 state), a strong oxidiser, so it dissolves even copper and silver, which lie below hydrogen, and no hydrogen is released: nitrogen is reduced to NO or NO₂. Dilute acid: 3Cu + 8HNO₃ → 3Cu(NO₃)₂ + 2NO↑ + 4H₂O; concentrated: Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O. Hydrochloric acid oxidises only with H⁺ ions, which are too weak for copper and silver.',
    },
  },
  {
    // медь + серная кислота: разбавленная — нет, концентрированная — да (окислитель — сера +6)
    re: /((мед|медн|\bCu\b|copper|\bmis\b|misn)[^?.!]{0,60}(серн|H₂SO₄|H2SO4|sulfuric|sulphuric|sulfat kislota)|(серн|H₂SO₄|H2SO4|sulfuric|sulphuric|sulfat kislota)[^?.!]{0,60}(мед|медь|\bCu\b|copper|\bmis\b))/iu,
    text: {
      ru: 'С разбавленной серной кислотой медь не реагирует: она стоит в ряду активности после водорода. Концентрированная H₂SO₄ — окислитель за счёт серы (+6) и при нагревании растворяет медь, выделяя не водород, а сернистый газ: Cu + 2H₂SO₄(конц.) → CuSO₄ + SO₂↑ + 2H₂O.',
      uz: 'Suyultirilgan sulfat kislota bilan mis reaksiyaga kirishmaydi: u faollik qatorida vodoroddan keyin turadi. Konsentrlangan H₂SO₄ oltingugurt (+6) hisobiga oksidlovchi va qizdirilganda misni eritadi, vodorod emas, sulfit angidrid ajraladi: Cu + 2H₂SO₄(kons.) → CuSO₄ + SO₂↑ + 2H₂O.',
      en: 'Copper does not react with dilute sulfuric acid because it lies below hydrogen in the activity series. Concentrated H₂SO₄ is an oxidiser thanks to sulfur (+6) and, when heated, dissolves copper, releasing sulfur dioxide rather than hydrogen: Cu + 2H₂SO₄(conc.) → CuSO₄ + SO₂↑ + 2H₂O.',
    },
  },
  {
    // алюминий и коррозия: защитная оксидная плёнка Al₂O₃ (а железо ржавеет — рыхлая ржавчина не защищает)
    re: /((алюмини|\bAl\b|alumin|alyumin)[^?.!]{0,60}(ржав|корроз|окисл|rust|corro|zang|korroziya)|(ржав|корроз|rust|corro|zang|korroziya)[^?.!]{0,60}(алюмини|\bAl\b|alumin|alyumin))/iu,
    text: {
      ru: 'Алюминий — активный металл, но на воздухе он сразу покрывается тонкой плотной плёнкой оксида Al₂O₃: 4Al + 3O₂ → 2Al₂O₃. Плёнка не пропускает кислород и воду к металлу, поэтому дальше алюминий не разрушается. У железа ржавчина (Fe₂O₃·nH₂O, Fe(OH)₃) рыхлая и пористая, она не защищает, и коррозия идёт вглубь.',
      uz: 'Alyuminiy faol metall, lekin havoda darhol yupqa zich Al₂O₃ oksid pardasi bilan qoplanadi: 4Al + 3O₂ → 2Al₂O₃. Bu parda kislorod va suvni metallga oʻtkazmaydi, shuning uchun alyuminiy boshqa yemirilmaydi. Temirda esa zang (Fe₂O₃·nH₂O, Fe(OH)₃) gʻovak va boʻsh, u himoya qilmaydi, korroziya ichkariga ketadi.',
      en: 'Aluminium is an active metal, but in air it is at once covered with a thin dense film of the oxide Al₂O₃: 4Al + 3O₂ → 2Al₂O₃. The film keeps oxygen and water away from the metal, so the aluminium is not destroyed further. Rust on iron (Fe₂O₃·nH₂O, Fe(OH)₃) is loose and porous, it does not protect, and corrosion goes deeper.',
    },
  },
]

type Trap = { re: RegExp; trap: RegExp; text: Tri }

/** Ловушки: re — о чём речь, trap — утверждение ошибки (без отрицания); text — короткая поправка. */
export const TRAPS: Trap[] = [
  {
    re: /(катализ\p{L}*[^?.!]{0,60}равновес|равновес\p{L}*[^?.!]{0,60}катализ|catalyst[^?.!]{0,60}equilibri|equilibri\p{L}*[^?.!]{0,60}catalyst|katalizator[^?.!]{0,60}muvozanat|muvozanat\p{L}*[^?.!]{0,60}katalizator)/iu,
    trap: /((?<!не\s)(смещ|сдвиг|сдвин|влия)\p{L}*|(?<!not\s|n't\s)(shift|move|change)s?\b|(?<!not\s)affects?\b|siljit(adi|ami|ar)?\b|siljiyd|oʻzgartir)/iu,
    text: {
      ru: 'Нет, катализатор не смещает равновесие: он одинаково ускоряет и прямую, и обратную реакцию (снижает энергию активации для обеих), поэтому равновесие лишь быстрее устанавливается, а состав равновесной смеси остаётся тем же.',
      uz: 'Yoʻq, katalizator muvozanatni siljitmaydi: u toʻgʻri va teskari reaksiyani bir xil tezlashtiradi (ikkalasi uchun aktivlanish energiyasini pasaytiradi), shuning uchun muvozanat faqat tezroq qaror topadi, muvozanat aralashmasi tarkibi esa oʻzgarmaydi.',
      en: 'No, a catalyst does not shift equilibrium: it speeds up the forward and reverse reactions equally (lowering the activation energy of both), so equilibrium is only reached faster and the equilibrium mixture stays the same.',
    },
  },
]

/** Вопрос с отрицанием («почему катализатор НЕ смещает…») — не ловушка, а просьба объяснить. */
const NEGATED = /(\bне\s+(смещ|сдвиг|влия)|does\s*n[o']t|do\s*n[o']t|\bnot\s+(shift|affect|change)|siljitmay|siljimay)/iu

/** Поправка к ловушке «если …, значит …» (или к прямому вопросу с ошибкой); null — ловушки нет. */
export function trapFor(cmp: string, lang: Lang): string | null {
  for (const t of TRAPS) if (t.re.test(cmp) && t.trap.test(cmp) && !NEGATED.test(cmp)) return t.text[lang]
  return null
}

/** Точечное объяснение («почему медь растворяется в азотной кислоте»); null — нет. */
export function explainFor(cmp: string, lang: Lang): string | null {
  for (const e of EXPLAINS) if (e.re.test(cmp)) return e.text[lang]
  return null
}

export function detailsFor(conceptId: string | undefined, lang: Lang): string[] {
  return conceptId ? (DETAILS[conceptId]?.[lang] ?? []) : []
}

export function usesFor(conceptId: string | undefined, lang: Lang): string | null {
  return conceptId ? (USES[conceptId]?.[lang] ?? null) : null
}

/** Типичные валентности (школьный курс): у азота максимум IV (в HNO₃ степень окисления +5, но валентность IV). */
export const VALENCE: Record<string, string> = {
  H: 'I', Li: 'I', Na: 'I', K: 'I', Rb: 'I', Cs: 'I', Ag: 'I', F: 'I',
  Be: 'II', Mg: 'II', Ca: 'II', Sr: 'II', Ba: 'II', Zn: 'II', O: 'II', Ni: 'II',
  B: 'III', Al: 'III',
  C: 'IV, II', Si: 'IV', N: 'III, IV', P: 'III, V', S: 'II, IV, VI',
  Cl: 'I, III, V, VII', Br: 'I, V', I: 'I, V, VII',
  Fe: 'II, III', Cu: 'I, II', Hg: 'I, II', Pb: 'II, IV', Sn: 'II, IV', Cr: 'II, III, VI', Mn: 'II, IV, VI, VII', Co: 'II, III', Au: 'I, III',
}

export function valenceClause(symbol: string, lang: Lang): string {
  const v = VALENCE[symbol]
  if (!v) return ''
  return lang === 'ru' ? `; валентность: ${v}` : lang === 'uz' ? `; valentligi: ${v}` : `; valence: ${v}`
}
