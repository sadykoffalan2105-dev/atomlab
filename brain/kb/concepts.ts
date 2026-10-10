/**
 * Ядро понятий для запасного пути (без LLM): определение и «логика от законов» на трёх языках.
 * Учебники Kimyo — на русском, поэтому для вопросов на узбекском и английском запасной ответ строится
 * отсюда (и из qaBank), а учебник даёт ссылку-цитату. Термины ищутся по названиям (ru — по основе слова,
 * uz/en — по началу слова), длинные названия важнее коротких.
 */
export type Tri = { ru: string; uz: string; en: string }
export type Concept = { id: string; domain: string; names: { ru: string[]; uz: string[]; en: string[] }; def: Tri; law: Tri }

const C = (id: string, domain: string, ru: string, uz: string, en: string, def: [string, string, string], law: [string, string, string]): Concept => ({
  id,
  domain,
  names: { ru: ru.split('|'), uz: uz.split('|'), en: en.split('|') },
  def: { ru: def[0], uz: def[1], en: def[2] },
  law: { ru: law[0], uz: law[1], en: law[2] },
})

export const CONCEPTS: Concept[] = [
  C('atom', 'general', 'атом|строение атома', 'atom|atom tuzilishi', 'atom|atomic structure', [
    'Атом — мельчайшая химически неделимая частица элемента: положительно заряженное ядро из протонов и нейтронов и электроны вокруг него; в целом атом электронейтрален.',
    'Atom — elementning kimyoviy jihatdan boʻlinmaydigan eng kichik zarrachasi: proton va neytronlardan iborat musbat zaryadli yadro va uning atrofidagi elektronlar; atom umuman elektroneytral.',
    'An atom is the smallest chemically indivisible particle of an element: a positively charged nucleus of protons and neutrons with electrons around it; overall it is electrically neutral.',
  ], [
    'Число протонов равно числу электронов, поэтому заряды компенсируются; порядковый номер элемента равен заряду ядра.',
    'Protonlar soni elektronlar soniga teng, shuning uchun zaryadlar muvozanatlashadi; elementning tartib raqami yadro zaryadiga teng.',
    'The number of protons equals the number of electrons, so the charges cancel; the atomic number equals the nuclear charge.',
  ]),
  C('molecule', 'general', 'молекула', 'molekula', 'molecule', [
    'Молекула — наименьшая частица вещества, сохраняющая его химические свойства; состоит из атомов, соединённых ковалентными связями.',
    'Molekula — moddaning kimyoviy xossalarini saqlovchi eng kichik zarrachasi; kovalent bogʻlar bilan birikkan atomlardan tashkil topgan.',
    'A molecule is the smallest particle of a substance that keeps its chemical properties; it is made of atoms joined by covalent bonds.',
  ], [
    'Важно: у металлов и ионных солей (NaCl) молекул нет — там кристаллическая решётка из атомов или ионов.',
    'Muhim: metallar va ionli tuzlarda (NaCl) molekula yoʻq — u yerda atom yoki ionlardan iborat kristall panjara bor.',
    'Note: metals and ionic salts (NaCl) have no molecules — they form lattices of atoms or ions.',
  ]),
  C('ion', 'general', 'ион|катион|анион', 'ion|kation|anion', 'ion|cation|anion', [
    'Ион — заряженная частица, которая образуется, когда атом или группа атомов отдаёт или принимает электроны: катионы заряжены положительно (Na⁺), анионы — отрицательно (Cl⁻).',
    'Ion — atom yoki atomlar guruhi elektron berganda yoki qabul qilganda hosil boʻladigan zaryadli zarracha: kationlar musbat (Na⁺), anionlar manfiy (Cl⁻) zaryadlangan.',
    'An ion is a charged particle formed when an atom or a group of atoms loses or gains electrons: cations are positive (Na⁺), anions are negative (Cl⁻).',
  ], [
    'Заряд сохраняется: сколько электронов отдал один атом, столько принял другой.',
    'Zaryad saqlanadi: bir atom qancha elektron bersa, boshqasi shuncha qabul qiladi.',
    'Charge is conserved: the electrons lost by one atom are gained by another.',
  ]),
  C('element', 'general', 'химический элемент|элемент', 'kimyoviy element|element', 'chemical element|element', [
    'Химический элемент — вид атомов с одинаковым зарядом ядра, то есть с одинаковым числом протонов.',
    'Kimyoviy element — yadro zaryadi bir xil, yaʼni protonlar soni bir xil boʻlgan atomlar turi.',
    'A chemical element is a kind of atom with the same nuclear charge, i.e. the same number of protons.',
  ], [
    'Периодический закон: свойства элементов периодически зависят от заряда ядра их атомов.',
    'Davriy qonun: elementlarning xossalari ular atomlari yadrosi zaryadiga davriy bogʻliq.',
    'The periodic law: the properties of elements depend periodically on the nuclear charge of their atoms.',
  ]),
  C('isotope', 'general', 'изотоп|изотопы', 'izotop|izotoplar', 'isotope|isotopes', [
    'Изотопы — атомы одного элемента с одинаковым числом протонов, но разным числом нейтронов, а значит, с разной массой (¹²C и ¹⁴C).',
    'Izotoplar — bir elementning protonlar soni bir xil, ammo neytronlar soni turlicha, demak massasi har xil boʻlgan atomlari (¹²C va ¹⁴C).',
    'Isotopes are atoms of the same element with the same number of protons but different numbers of neutrons, hence different masses (¹²C and ¹⁴C).',
  ], [
    'Химию определяют электроны, а их число у изотопов одинаково — поэтому изотопы реагируют почти одинаково.',
    'Kimyoviy xossalarni elektronlar belgilaydi, izotoplarda esa ularning soni bir xil — shuning uchun izotoplar deyarli bir xil reaksiyaga kirishadi.',
    'Chemistry is governed by electrons, and isotopes have the same number of them — so isotopes react almost identically.',
  ]),
  C('valence', 'general', 'валентность|валентности', 'valentlik', 'valence|valency', [
    'Валентность — способность атома образовывать определённое число химических связей с другими атомами; её обозначают римскими цифрами (в H₂O кислород двухвалентен — II).',
    'Valentlik — atomning boshqa atomlar bilan maʼlum sondagi kimyoviy bogʻ hosil qilish qobiliyati; rim raqamlari bilan belgilanadi (H₂O da kislorod II valentli).',
    'Valence is the ability of an atom to form a certain number of chemical bonds with other atoms; it is written in Roman numerals (oxygen in H₂O has valence II).',
  ], [
    'Число связей задают неспаренные электроны внешнего слоя; в формуле бинарного соединения произведения валентности на индекс у двух элементов равны.',
    'Bogʻlar sonini tashqi qavatdagi juftlashmagan elektronlar belgilaydi; binar birikma formulasida ikkala element uchun valentlik va indeks koʻpaytmasi teng.',
    'The number of bonds comes from unpaired outer electrons; in a binary formula valence × subscript is the same for both elements.',
  ]),
  C('oxstate', 'general', 'степень окисления|степени окисления', 'oksidlanish darajasi', 'oxidation state|oxidation number', [
    'Степень окисления — условный заряд атома в соединении, если считать все связи ионными; бывает положительной, отрицательной и нулевой (в KMnO₄ у марганца +7).',
    'Oksidlanish darajasi — barcha bogʻlarni ionli deb hisoblaganda atomning birikmadagi shartli zaryadi; musbat, manfiy yoki nol boʻladi (KMnO₄ da marganes +7).',
    'The oxidation state is the formal charge an atom would have if all its bonds were ionic; it can be positive, negative or zero (manganese is +7 in KMnO₄).',
  ], [
    'Сумма степеней окисления в молекуле равна нулю, в ионе — его заряду; более электроотрицательный атом получает отрицательную степень.',
    'Molekulada oksidlanish darajalari yigʻindisi nolga, ionda — uning zaryadiga teng; elektromanfiyroq atom manfiy darajani oladi.',
    'Oxidation states add up to zero in a molecule and to the charge in an ion; the more electronegative atom gets the negative value.',
  ]),
  C('mole', 'general', 'моль|количество вещества|число авогадро|постоянная авогадро', 'mol|modda miqdori|avogadro soni', 'mole|amount of substance|avogadro constant|avogadro number', [
    'Моль — единица количества вещества: порция, содержащая 6,022·10²³ частиц (постоянная Авогадро).',
    'Mol — modda miqdori birligi: 6,022·10²³ ta zarracha (Avogadro doimiysi) boʻlgan modda porsiyasi.',
    'The mole is the unit of amount of substance: a portion containing 6.022·10²³ particles (the Avogadro constant).',
  ], [
    'Все величины связаны через число частиц: n = m/M = V/Vm = N/Nₐ.',
    'Barcha kattaliklar zarrachalar soni orqali bogʻlangan: n = m/M = V/Vm = N/Nₐ.',
    'Everything is linked through the number of particles: n = m/M = V/Vm = N/Nₐ.',
  ]),
  C('molarmass', 'general', 'молярная масса|молекулярная масса', 'molyar massa|molekulyar massa', 'molar mass|molecular mass|molecular weight', [
    'Молярная масса M — масса одного моля вещества в г/моль; численно равна относительной молекулярной массе (M(H₂O) ≈ 18 г/моль).',
    'Molyar massa M — bir mol moddaning g/mol dagi massasi; son jihatdan nisbiy molekulyar massaga teng (M(H₂O) ≈ 18 g/mol).',
    'Molar mass M is the mass of one mole of a substance in g/mol; numerically it equals the relative molecular mass (M(H₂O) ≈ 18 g/mol).',
  ], [
    'Масса молекулы складывается из масс атомов: M = Σ nᵢ·Arᵢ.',
    'Molekula massasi atomlar massalaridan yigʻiladi: M = Σ nᵢ·Arᵢ.',
    'A molecule’s mass is the sum of its atoms’ masses: M = Σ nᵢ·Arᵢ.',
  ]),
  C('avogadrolaw', 'general', 'закон авогадро|молярный объем', 'avogadro qonuni|molyar hajm', "avogadro's law|avogadro law|molar volume", [
    'Закон Авогадро: в равных объёмах разных газов при одинаковых температуре и давлении содержится одинаковое число молекул; при н. у. 1 моль любого газа занимает 22,4 л.',
    'Avogadro qonuni: bir xil harorat va bosimda turli gazlarning teng hajmlarida molekulalar soni bir xil; n. sh. da istalgan gazning 1 moli 22,4 l hajmni egallaydi.',
    "Avogadro's law: equal volumes of different gases at the same temperature and pressure contain the same number of molecules; at STP one mole of any gas occupies 22.4 L.",
  ], [
    'В газе молекулы далеко друг от друга, поэтому объём зависит от числа частиц, а не от их размера.',
    'Gazda molekulalar bir-biridan uzoqda, shuning uchun hajm zarrachalar soniga bogʻliq, ularning oʻlchamiga emas.',
    'In a gas the molecules are far apart, so the volume depends on how many particles there are, not on their size.',
  ]),
  C('massconservation', 'general', 'закон сохранения массы|сохранение массы', 'massaning saqlanish qonuni', 'conservation of mass|law of conservation of mass', [
    'Закон сохранения массы (М. В. Ломоносов, А. Лавуазье): масса веществ, вступивших в реакцию, равна массе образовавшихся веществ.',
    'Massaning saqlanish qonuni (M. V. Lomonosov, A. Lavuazye): reaksiyaga kirishgan moddalar massasi hosil boʻlgan moddalar massasiga teng.',
    'The law of conservation of mass (Lomonosov, Lavoisier): the mass of the reactants equals the mass of the products.',
  ], [
    'Атомы при реакции не исчезают и не появляются, а только перегруппировываются — поэтому уравнения уравнивают по атомам.',
    'Reaksiyada atomlar yoʻqolmaydi va paydo boʻlmaydi, faqat qayta guruhlanadi — shuning uchun tenglamalar atomlar boʻyicha tenglashtiriladi.',
    'Atoms are neither created nor destroyed in a reaction, only rearranged — that is why equations are balanced atom by atom.',
  ]),
  C('composition', 'general', 'закон постоянства состава|постоянство состава', 'tarkibning doimiylik qonuni', 'law of definite proportions|constant composition', [
    'Закон постоянства состава (Ж. Пруст): каждое чистое вещество молекулярного строения имеет постоянный состав независимо от способа получения.',
    'Tarkibning doimiylik qonuni (J. Prust): molekulyar tuzilishli har bir toza modda olinish usulidan qatʼi nazar doimiy tarkibga ega.',
    'The law of definite proportions (Proust): a pure molecular substance always has the same composition, however it is prepared.',
  ], [
    'Атомы соединяются в определённых целочисленных отношениях, которые задаёт их валентность.',
    'Atomlar valentligi belgilaydigan aniq butun sonli nisbatlarda birikadi.',
    'Atoms combine in fixed whole-number ratios set by their valences.',
  ]),
  C('reaction', 'general', 'химическая реакция|признаки реакции|химические реакции', 'kimyoviy reaksiya|reaksiya belgilari', 'chemical reaction|signs of a reaction', [
    'Химическая реакция — превращение одних веществ в другие, с новым составом и свойствами; её признаки — газ, осадок, изменение цвета, выделение тепла или света.',
    'Kimyoviy reaksiya — bir moddalarning yangi tarkib va xossali boshqa moddalarga aylanishi; belgilari — gaz, choʻkma, rang oʻzgarishi, issiqlik yoki yorugʻlik chiqishi.',
    'A chemical reaction turns some substances into others with a new composition and properties; signs are a gas, a precipitate, a colour change, heat or light.',
  ], [
    'При реакции рвутся одни связи и образуются другие; соотношение энергий этих связей решает, выделится тепло или поглотится.',
    'Reaksiyada baʼzi bogʻlar uziladi, boshqalari hosil boʻladi; bu bogʻlar energiyalari nisbati issiqlik ajralishi yoki yutilishini belgilaydi.',
    'Some bonds break and others form; the balance of their energies decides whether heat is released or absorbed.',
  ]),
  C('reactiontypes', 'general', 'типы реакций|реакция соединения|реакция разложения|реакция замещения|реакция обмена', 'reaksiya turlari|birikish reaksiyasi|parchalanish reaksiyasi|oʻrin olish reaksiyasi|almashinish reaksiyasi', 'types of reactions|combination reaction|decomposition reaction|substitution reaction|exchange reaction|displacement reaction', [
    'По числу и составу веществ реакции бывают: соединения (A + B → AB), разложения (AB → A + B), замещения (A + BC → AC + B) и обмена (AB + CD → AD + CB).',
    'Moddalar soni va tarkibiga koʻra reaksiyalar: birikish (A + B → AB), parchalanish (AB → A + B), oʻrin olish (A + BC → AC + B) va almashinish (AB + CD → AD + CB).',
    'By the number and type of substances, reactions are combination (A + B → AB), decomposition (AB → A + B), substitution (A + BC → AC + B) and exchange (AB + CD → AD + CB).',
  ], [
    'Во всех типах сохраняются атомы и заряд; реакция обмена идёт до конца, если образуется осадок, газ или вода (правило Бертолле).',
    'Barcha turlarda atomlar va zaryad saqlanadi; almashinish reaksiyasi choʻkma, gaz yoki suv hosil boʻlsa oxirigacha boradi (Bertolle qoidasi).',
    'Atoms and charge are conserved in every type; an exchange reaction goes to completion if a precipitate, a gas or water forms (Berthollet’s rule).',
  ]),
  C('oxide', 'inorganic', 'оксид|оксиды', 'oksid|oksidlar', 'oxide|oxides', [
    'Оксиды — сложные вещества из двух элементов, один из которых — кислород в степени окисления −2 (CO₂, CaO); они бывают основными, кислотными, амфотерными и несолеобразующими.',
    'Oksidlar — ikki elementdan iborat murakkab moddalar, ulardan biri −2 oksidlanish darajasidagi kislorod (CO₂, CaO); asosli, kislotali, amfoter va tuz hosil qilmaydigan boʻladi.',
    'Oxides are compounds of two elements, one of which is oxygen in the −2 state (CO₂, CaO); they can be basic, acidic, amphoteric or neutral.',
  ], [
    'Характер оксида задаёт второй элемент: металлы дают основные оксиды, неметаллы — кислотные; чем выше степень окисления, тем кислотнее оксид.',
    'Oksid xarakterini ikkinchi element belgilaydi: metallar asosli, metallmaslar kislotali oksid beradi; oksidlanish darajasi qancha yuqori boʻlsa, oksid shuncha kislotali.',
    'The other element sets the character: metals give basic oxides, non-metals acidic ones; the higher the oxidation state, the more acidic the oxide.',
  ]),
  C('acid', 'inorganic', 'кислота|кислоты', 'kislota|kislotalar', 'acid|acids', [
    'Кислоты — сложные вещества, которые в водном растворе отщепляют катионы водорода H⁺ (HCl, H₂SO₄); по Брёнстеду кислота — донор протона.',
    'Kislotalar — suvli eritmada vodorod kationlari H⁺ ni ajratadigan murakkab moddalar (HCl, H₂SO₄); Brensted boʻyicha kislota — proton donori.',
    'Acids are compounds that release hydrogen ions H⁺ in water (HCl, H₂SO₄); in Brønsted terms an acid is a proton donor.',
  ], [
    'Общие свойства кислот — кислый вкус, изменение цвета индикатора, реакции с металлами и основаниями — объясняются ионами H⁺ в растворе.',
    'Kislotalarning umumiy xossalari — nordon taʼm, indikator rangining oʻzgarishi, metallar va asoslar bilan reaksiyalar — eritmadagi H⁺ ionlari bilan tushuntiriladi.',
    'The shared properties of acids — sour taste, indicator colour change, reactions with metals and bases — all come from H⁺ ions in solution.',
  ]),
  C('base', 'inorganic', 'основание|основания|щелочь|щелочи', 'asos|asoslar|ishqor|ishqorlar', 'base|bases|alkali|alkalis', [
    'Основания — сложные вещества из катиона металла и гидроксид-ионов OH⁻ (NaOH, Ca(OH)₂); растворимые основания называют щелочами; по Брёнстеду основание — акцептор протона.',
    'Asoslar — metall kationi va gidroksid-ionlari OH⁻ dan iborat murakkab moddalar (NaOH, Ca(OH)₂); eriydigan asoslar ishqorlar deyiladi; Brensted boʻyicha asos — proton akseptori.',
    'Bases are compounds of a metal cation and hydroxide ions OH⁻ (NaOH, Ca(OH)₂); soluble bases are called alkalis; in Brønsted terms a base is a proton acceptor.',
  ], [
    'Щелочные свойства задаются ионами OH⁻; при нейтрализации H⁺ + OH⁻ → H₂O.',
    'Ishqoriy xossalarni OH⁻ ionlari belgilaydi; neytrallanishda H⁺ + OH⁻ → H₂O.',
    'Alkaline behaviour comes from OH⁻ ions; in neutralisation H⁺ + OH⁻ → H₂O.',
  ]),
  C('salt', 'inorganic', 'соль|соли', 'tuz|tuzlar', 'salt|salts', [
    'Соли — сложные вещества из катионов металла (или NH₄⁺) и анионов кислотного остатка (NaCl, CuSO₄).',
    'Tuzlar — metall kationlari (yoki NH₄⁺) va kislota qoldigʻi anionlaridan iborat murakkab moddalar (NaCl, CuSO₄).',
    'Salts are compounds of metal cations (or NH₄⁺) and acid-residue anions (NaCl, CuSO₄).',
  ], [
    'Соль — продукт нейтрализации: кислота отдаёт H⁺, основание — OH⁻, из них получается вода, а оставшиеся ионы образуют соль.',
    'Tuz — neytrallanish mahsuloti: kislota H⁺, asos OH⁻ beradi, ulardan suv hosil boʻladi, qolgan ionlar esa tuzni tashkil etadi.',
    'A salt is the product of neutralisation: the acid gives H⁺, the base gives OH⁻, they form water and the remaining ions form the salt.',
  ]),
  C('amphoteric', 'inorganic', 'амфотерность|амфотерные|амфотерный', 'amfoterlik|amfoter', 'amphoteric|amphoterism', [
    'Амфотерные соединения проявляют и основные, и кислотные свойства: реагируют и с кислотами, и со щелочами (Al(OH)₃, ZnO).',
    'Amfoter birikmalar ham asosli, ham kislotali xossalarni namoyon qiladi: kislotalar bilan ham, ishqorlar bilan ham reaksiyaga kirishadi (Al(OH)₃, ZnO).',
    'Amphoteric compounds behave both as bases and as acids: they react with acids and with alkalis (Al(OH)₃, ZnO).',
  ], [
    'Это промежуточный случай: связь Me–O–H может рваться и по Me–O (выход OH⁻), и по O–H (выход H⁺).',
    'Bu oraliq holat: Me–O–H bogʻi Me–O boʻyicha ham (OH⁻ chiqadi), O–H boʻyicha ham (H⁺ chiqadi) uzilishi mumkin.',
    'It is an in-between case: the Me–O–H unit can break at Me–O (releasing OH⁻) or at O–H (releasing H⁺).',
  ]),
  C('periodiclaw', 'general', 'периодический закон|периодическая система|периодическая таблица|таблица менделеева', 'davriy qonun|davriy jadval|davriy sistema|mendeleyev jadvali', 'periodic law|periodic table|periodic system', [
    'Периодический закон Д. И. Менделеева: свойства элементов и их соединений периодически зависят от заряда ядра их атомов.',
    'D. I. Mendeleyevning davriy qonuni: elementlar va ular birikmalarining xossalari atomlari yadrosi zaryadiga davriy bogʻliq.',
    'Mendeleev’s periodic law: the properties of elements and their compounds depend periodically on the nuclear charge of their atoms.',
  ], [
    'Периодичность возникает потому, что электронные слои заполняются по одним правилам: у элементов одной группы одинаково устроен внешний слой.',
    'Davriylik elektron qavatlar bir xil qoidalar boʻyicha toʻlishi tufayli yuzaga keladi: bir guruh elementlarining tashqi qavati bir xil tuzilgan.',
    'Periodicity appears because electron shells fill by the same rules: elements of one group have the same outer-shell arrangement.',
  ]),
  C('econfig', 'quantum', 'электронная конфигурация|электронная формула|электронная оболочка', 'elektron konfiguratsiya|elektron formula|elektron qobiq', 'electron configuration|electronic configuration|electron shell', [
    'Электронная конфигурация — распределение электронов атома по слоям и орбиталям (у кислорода 1s² 2s² 2p⁴).',
    'Elektron konfiguratsiya — atom elektronlarining qavatlar va orbitallar boʻyicha taqsimlanishi (kislorodda 1s² 2s² 2p⁴).',
    'An electron configuration is how an atom’s electrons are distributed over shells and orbitals (oxygen: 1s² 2s² 2p⁴).',
  ], [
    'Заполнение идёт от низшей энергии к высшей, не более двух электронов на орбиталь (принцип Паули) и сначала по одному на орбиталь (правило Хунда).',
    'Toʻlish past energiyadan yuqoriga qarab boradi, bir orbitalda ikkitadan ortiq elektron boʻlmaydi (Pauli prinsipi) va avval har bir orbitalga bittadan joylashadi (Xund qoidasi).',
    'Filling goes from lower to higher energy, no more than two electrons per orbital (Pauli principle), singly first (Hund’s rule).',
  ]),
  C('orbital', 'quantum', 'орбиталь|орбитали|квантовые числа|принцип паули|правило хунда', 'orbital|kvant sonlari|pauli prinsipi|xund qoidasi', 'orbital|orbitals|quantum numbers|pauli principle|hund', [
    'Орбиталь — область вокруг ядра, где вероятность найти электрон наибольшая; состояние электрона задают четыре квантовых числа: n, l, mₗ и mₛ.',
    'Orbital — yadro atrofida elektronni topish ehtimoli eng katta boʻlgan soha; elektron holatini toʻrtta kvant soni belgilaydi: n, l, mₗ va mₛ.',
    'An orbital is the region around the nucleus where an electron is most likely to be found; an electron’s state is set by four quantum numbers: n, l, mₗ and mₛ.',
  ], [
    'Электрон — квантовый объект: его энергия квантуется, а принцип Паули запрещает двум электронам иметь одинаковый набор квантовых чисел.',
    'Elektron — kvant obyekt: uning energiyasi kvantlangan, Pauli prinsipi esa ikki elektronning bir xil kvant sonlariga ega boʻlishini taqiqlaydi.',
    'The electron is a quantum object: its energy is quantised, and the Pauli principle forbids two electrons from sharing the same set of quantum numbers.',
  ]),
  C('electronegativity', 'general', 'электроотрицательность', 'elektromanfiylik', 'electronegativity', [
    'Электроотрицательность — способность атома в соединении притягивать к себе общие электроны; самый электроотрицательный элемент — фтор.',
    'Elektromanfiylik — birikmadagi atomning umumiy elektronlarni oʻziga tortish qobiliyati; eng elektromanfiy element — ftor.',
    'Electronegativity is an atom’s ability to pull shared electrons towards itself in a compound; fluorine is the most electronegative element.',
  ], [
    'Она растёт по периоду слева направо (растёт заряд ядра при том же числе слоёв) и падает вниз по группе (внешние электроны дальше от ядра).',
    'U davr boʻylab chapdan oʻngga oshadi (qavatlar soni bir xil, yadro zaryadi ortadi) va guruh boʻylab pastga kamayadi (tashqi elektronlar yadrodan uzoqroq).',
    'It rises across a period (more nuclear charge, same number of shells) and falls down a group (outer electrons are further from the nucleus).',
  ]),
  C('bond', 'general', 'химическая связь|виды химической связи|типы связи', 'kimyoviy bogʻ|kimyoviy bogʻlanish|bogʻ turlari', 'chemical bond|chemical bonding|types of bonds', [
    'Химическая связь — взаимодействие, которое удерживает атомы вместе за счёт общих или переданных электронов; основные виды — ковалентная, ионная, металлическая и водородная.',
    'Kimyoviy bogʻ — umumiy yoki berilgan elektronlar hisobiga atomlarni birga ushlab turadigan oʻzaro taʼsir; asosiy turlari — kovalent, ionli, metall va vodorod bogʻ.',
    'A chemical bond holds atoms together through shared or transferred electrons; the main types are covalent, ionic, metallic and hydrogen bonds.',
  ], [
    'Связь образуется, потому что так энергия системы становится ниже; тип связи определяется разностью электроотрицательностей атомов.',
    'Bogʻ hosil boʻladi, chunki shunda sistema energiyasi kamayadi; bogʻ turini atomlar elektromanfiyliklari farqi belgilaydi.',
    'Bonds form because the system’s energy goes down; the type of bond depends on the electronegativity difference.',
  ]),
  C('covalent', 'general', 'ковалентная связь|ковалентная полярная|ковалентная неполярная', 'kovalent bogʻ|kovalent qutbli|kovalent qutbsiz', 'covalent bond|polar covalent|nonpolar covalent', [
    'Ковалентная связь — связь через общие электронные пары: неполярная — между одинаковыми атомами (H₂, Cl₂), полярная — между атомами разных неметаллов (HCl, H₂O).',
    'Kovalent bogʻ — umumiy elektron juftlar orqali bogʻ: qutbsiz — bir xil atomlar orasida (H₂, Cl₂), qutbli — turli metallmaslar atomlari orasida (HCl, H₂O).',
    'A covalent bond is a shared electron pair: nonpolar between identical atoms (H₂, Cl₂), polar between different non-metals (HCl, H₂O).',
  ], [
    'Если разница электроотрицательностей мала, электроны обобществляются; чем она больше, тем сильнее смещена пара и тем полярнее связь.',
    'Elektromanfiylik farqi kichik boʻlsa, elektronlar umumlashadi; farq qancha katta boʻlsa, juft shuncha siljiydi va bogʻ shuncha qutbli boʻladi.',
    'With a small electronegativity difference the electrons are shared; the bigger the difference, the more the pair shifts and the more polar the bond.',
  ]),
  C('ionicbond', 'general', 'ионная связь', 'ionli bogʻ|ion bogʻ', 'ionic bond', [
    'Ионная связь — электростатическое притяжение катионов и анионов; она возникает между типичными металлами и неметаллами (NaCl).',
    'Ionli bogʻ — kationlar va anionlarning elektrostatik tortishuvi; tipik metallar va metallmaslar orasida yuzaga keladi (NaCl).',
    'An ionic bond is the electrostatic attraction between cations and anions; it forms between typical metals and non-metals (NaCl).',
  ], [
    'При большой разности электроотрицательностей (больше ~1,7) электрон практически переходит от металла к неметаллу, и ионы притягиваются по закону Кулона.',
    'Elektromanfiylik farqi katta boʻlsa (~1,7 dan ortiq), elektron metalldan metallmasga deyarli toʻliq oʻtadi va ionlar Kulon qonuni boʻyicha tortishadi.',
    'With a large electronegativity difference (above ~1.7) the electron essentially transfers from the metal to the non-metal, and the ions attract by Coulomb’s law.',
  ]),
  C('metallicbond', 'general', 'металлическая связь', 'metall bogʻ', 'metallic bond', [
    'Металлическая связь — связь между катионами металла и обобществлёнными «свободными» электронами (электронный газ).',
    'Metall bogʻ — metall kationlari va umumlashgan «erkin» elektronlar (elektron gaz) orasidagi bogʻ.',
    'A metallic bond holds metal cations together through a sea of shared “free” electrons.',
  ], [
    'Свободные электроны объясняют электро- и теплопроводность, металлический блеск и пластичность металлов.',
    'Erkin elektronlar metallarning elektr va issiqlik oʻtkazuvchanligi, metall yaltiroqligi va plastikligini tushuntiradi.',
    'The free electrons explain electrical and thermal conductivity, metallic lustre and malleability.',
  ]),
  C('hbond', 'general', 'водородная связь', 'vodorod bogʻ', 'hydrogen bond|hydrogen bonding', [
    'Водородная связь — притяжение атома водорода, связанного с сильно электроотрицательным атомом (F, O, N), к неподелённой паре другого такого атома.',
    'Vodorod bogʻ — kuchli elektromanfiy atom (F, O, N) bilan bogʻlangan vodorod atomining boshqa shunday atomning boʻlinmagan juftiga tortilishi.',
    'A hydrogen bond is the attraction of a hydrogen atom bonded to F, O or N towards a lone pair on another such atom.',
  ], [
    'Из-за неё у воды аномально высокая температура кипения, а лёд легче воды: его решётка рыхлая.',
    'Shu sababli suvning qaynash harorati gʻayritabiiy yuqori, muz esa suvdan yengil: uning panjarasi gʻovak.',
    'Because of it water boils unusually high and ice is lighter than water: its lattice is open.',
  ]),
  C('lattice', 'general', 'кристаллическая решетка|кристаллические решетки', 'kristall panjara|kristall panjaralar', 'crystal lattice|crystal structure', [
    'Кристаллическая решётка — упорядоченное расположение частиц в твёрдом веществе; она бывает ионной, атомной, молекулярной и металлической.',
    'Kristall panjara — qattiq moddada zarrachalarning tartibli joylashuvi; ionli, atomli, molekulyar va metall boʻladi.',
    'A crystal lattice is the ordered arrangement of particles in a solid; it can be ionic, atomic (covalent network), molecular or metallic.',
  ], [
    'Свойства задаёт прочность связей в узлах: атомные решётки (алмаз) очень твёрдые и тугоплавкие, молекулярные (лёд, йод) — легкоплавкие.',
    'Xossalarni tugunlardagi bogʻlar mustahkamligi belgilaydi: atomli panjaralar (olmos) juda qattiq va qiyin suyuqlanadi, molekulyar panjaralar (muz, yod) oson suyuqlanadi.',
    'Properties follow the strength of the bonds: covalent networks (diamond) are very hard and high-melting, molecular lattices (ice, iodine) melt easily.',
  ]),
  C('allotropy', 'inorganic', 'аллотропия|аллотропные модификации', 'allotropiya', 'allotropy|allotropes', [
    'Аллотропия — существование одного элемента в виде нескольких простых веществ (кислород O₂ и озон O₃; алмаз и графит).',
    'Allotropiya — bir elementning bir necha oddiy modda koʻrinishida mavjud boʻlishi (kislorod O₂ va ozon O₃; olmos va grafit).',
    'Allotropy is when one element exists as several simple substances (oxygen O₂ and ozone O₃; diamond and graphite).',
  ], [
    'Аллотропы различаются строением — числом атомов в молекуле или типом решётки, поэтому и свойствами.',
    'Allotroplar tuzilishi — molekuladagi atomlar soni yoki panjara turi bilan farq qiladi, shuning uchun xossalari ham har xil.',
    'Allotropes differ in structure — atoms per molecule or lattice type — and therefore in properties.',
  ]),
  C('hybridization', 'general', 'гибридизация|гибридизации|гибридные орбитали', 'gibridlanish|gibrid orbitallar', 'hybridization|hybridisation|hybrid orbitals', [
    'Гибридизация — смешение атомных орбиталей центрального атома с образованием одинаковых гибридных орбиталей: sp (линейно, 180°), sp² (плоский треугольник, 120°), sp³ (тетраэдр, 109,5°).',
    'Gibridlanish — markaziy atom orbitallarining aralashib, bir xil gibrid orbitallar hosil qilishi: sp (chiziqli, 180°), sp² (yassi uchburchak, 120°), sp³ (tetraedr, 109,5°).',
    'Hybridisation is the mixing of a central atom’s orbitals into equivalent hybrid orbitals: sp (linear, 180°), sp² (trigonal planar, 120°), sp³ (tetrahedral, 109.5°).',
  ], [
    'Гибридные орбитали дают более прочные и симметрично расположенные связи — так атом понижает энергию; число гибридных орбиталей равно числу σ-связей плюс неподелённые пары.',
    'Gibrid orbitallar mustahkamroq va simmetrik joylashgan bogʻlar beradi — atom shu yoʻl bilan energiyasini kamaytiradi; gibrid orbitallar soni σ-bogʻlar soni va boʻlinmagan juftlar yigʻindisiga teng.',
    'Hybrid orbitals give stronger, symmetrically arranged bonds, lowering the energy; the number of hybrid orbitals equals σ-bonds plus lone pairs.',
  ]),
  C('vsepr', 'general', 'теория отталкивания электронных пар|форма молекул|геометрия молекул|всэпр', 'molekulalar shakli|molekula geometriyasi|vsepr', 'vsepr|molecular shape|molecular geometry', [
    'Теория отталкивания электронных пар (ВСЭПР): пары вокруг центрального атома располагаются как можно дальше друг от друга, и это задаёт форму молекулы (CH₄ — тетраэдр, H₂O — угловая, CO₂ — линейная).',
    'Elektron juftlar itarilishi nazariyasi (VSEPR): markaziy atom atrofidagi juftlar bir-biridan imkon qadar uzoq joylashadi va bu molekula shaklini belgilaydi (CH₄ — tetraedr, H₂O — burchakli, CO₂ — chiziqli).',
    'VSEPR theory: electron pairs around the central atom get as far apart as possible, which sets the molecular shape (CH₄ tetrahedral, H₂O bent, CO₂ linear).',
  ], [
    'Неподелённые пары отталкивают сильнее связующих, поэтому угол в H₂O (104,5°) меньше тетраэдрического.',
    'Boʻlinmagan juftlar bogʻlovchi juftlardan kuchliroq itaradi, shuning uchun H₂O dagi burchak (104,5°) tetraedrikdan kichik.',
    'Lone pairs repel more than bonding pairs, so the angle in H₂O (104.5°) is smaller than tetrahedral.',
  ]),
  C('mo', 'quantum', 'метод молекулярных орбиталей|молекулярные орбитали|теория мо', 'molekulyar orbitallar usuli|molekulyar orbitallar', 'molecular orbital theory|mo theory|molecular orbitals', [
    'Метод молекулярных орбиталей: атомные орбитали объединяются в связывающие и разрыхляющие орбитали всей молекулы; порядок связи = (связывающие − разрыхляющие электроны) / 2.',
    'Molekulyar orbitallar usuli: atom orbitallari butun molekulaning bogʻlovchi va boʻshashtiruvchi orbitallariga birlashadi; bogʻ tartibi = (bogʻlovchi − boʻshashtiruvchi elektronlar) / 2.',
    'Molecular orbital theory: atomic orbitals combine into bonding and antibonding orbitals of the whole molecule; bond order = (bonding − antibonding electrons) / 2.',
  ], [
    'Он объясняет то, чего не объясняет схема электронных пар, — например, парамагнетизм O₂: два неспаренных электрона на разрыхляющих π*-орбиталях.',
    'U elektron juftlar sxemasi tushuntira olmaydigan narsalarni tushuntiradi — masalan, O₂ ning paramagnitligini: boʻshashtiruvchi π* orbitallardagi ikki juftlashmagan elektron.',
    'It explains what electron-pair pictures cannot — e.g. the paramagnetism of O₂: two unpaired electrons in antibonding π* orbitals.',
  ]),
  C('redox', 'general', 'окислительно-восстановительные реакции|окислительно восстановительные|овр|окисление|восстановление|окислитель|восстановитель|электронный баланс', 'oksidlanish-qaytarilish reaksiyalari|oksidlanish-qaytarilish|oksidlovchi|qaytaruvchi|elektron balans', 'redox reaction|redox|oxidation and reduction|oxidising agent|reducing agent|oxidizing agent', [
    'Окислительно-восстановительные реакции идут с изменением степеней окисления: восстановитель отдаёт электроны (окисляется), окислитель принимает их (восстанавливается).',
    'Oksidlanish-qaytarilish reaksiyalarida oksidlanish darajalari oʻzgaradi: qaytaruvchi elektron beradi (oksidlanadi), oksidlovchi elektron qabul qiladi (qaytariladi).',
    'Redox reactions change oxidation states: the reducing agent loses electrons (is oxidised), the oxidising agent gains them (is reduced).',
  ], [
    'Число отданных и принятых электронов одинаково (закон сохранения заряда) — на этом построен метод электронного баланса.',
    'Berilgan va qabul qilingan elektronlar soni teng (zaryadning saqlanish qonuni) — elektron balans usuli shunga asoslangan.',
    'Electrons lost equal electrons gained (conservation of charge) — the electron-balance method is built on this.',
  ]),
  C('electrolysis', 'physical', 'электролиз', 'elektroliz', 'electrolysis', [
    'Электролиз — окислительно-восстановительный процесс на электродах при пропускании постоянного тока через раствор или расплав электролита: на катоде идёт восстановление, на аноде — окисление.',
    'Elektroliz — elektrolit eritmasi yoki suyuqlanmasidan oʻzgarmas tok oʻtganda elektrodlarda boradigan oksidlanish-qaytarilish jarayoni: katodda qaytarilish, anodda oksidlanish boradi.',
    'Electrolysis is the redox process at the electrodes when direct current passes through a solution or melt of an electrolyte: reduction at the cathode, oxidation at the anode.',
  ], [
    'Масса выделившегося вещества пропорциональна прошедшему заряду (законы Фарадея: m = M·I·t / (z·F)).',
    'Ajralib chiqqan modda massasi oʻtgan zaryadga proporsional (Faradey qonunlari: m = M·I·t / (z·F)).',
    'The mass deposited is proportional to the charge passed (Faraday’s laws: m = M·I·t / (z·F)).',
  ]),
  C('dissociation', 'physical', 'электролитическая диссоциация|диссоциация|электролиты|электролит|неэлектролиты', 'elektrolitik dissotsilanish|dissotsilanish|elektrolitlar|elektrolit', 'electrolytic dissociation|dissociation|electrolytes|electrolyte', [
    'Электролитическая диссоциация — распад электролита на ионы при растворении или плавлении (NaCl → Na⁺ + Cl⁻); электролиты проводят ток, неэлектролиты (сахар) — нет.',
    'Elektrolitik dissotsilanish — elektrolitning eriganda yoki suyuqlanganda ionlarga parchalanishi (NaCl → Na⁺ + Cl⁻); elektrolitlar tok oʻtkazadi, noelektrolitlar (shakar) oʻtkazmaydi.',
    'Electrolytic dissociation is the break-up of an electrolyte into ions on dissolving or melting (NaCl → Na⁺ + Cl⁻); electrolytes conduct electricity, non-electrolytes (sugar) do not.',
  ], [
    'Полярные молекулы воды окружают ионы (гидратация) и ослабляют их притяжение — поэтому ионные и сильно полярные вещества распадаются на ионы.',
    'Qutbli suv molekulalari ionlarni oʻrab oladi (gidratlanish) va ularning tortishuvini susaytiradi — shuning uchun ionli va kuchli qutbli moddalar ionlarga ajraladi.',
    'Polar water molecules surround the ions (hydration) and weaken their attraction — so ionic and strongly polar substances split into ions.',
  ]),
  C('hydrolysis', 'physical', 'гидролиз|гидролиз солей', 'gidroliz|tuzlar gidrolizi', 'hydrolysis|salt hydrolysis', [
    'Гидролиз солей — обменное взаимодействие ионов соли с водой, которое меняет pH: соль сильного основания и слабой кислоты (Na₂CO₃) даёт щелочную среду, сильной кислоты и слабого основания (CuCl₂) — кислую.',
    'Tuzlar gidrolizi — tuz ionlarining suv bilan almashinish taʼsiri, u pH ni oʻzgartiradi: kuchli asos va kuchsiz kislota tuzi (Na₂CO₃) ishqoriy, kuchli kislota va kuchsiz asos tuzi (CuCl₂) kislotali muhit beradi.',
    'Salt hydrolysis is the reaction of a salt’s ions with water that shifts pH: a salt of a strong base and weak acid (Na₂CO₃) is alkaline, of a strong acid and weak base (CuCl₂) acidic.',
  ], [
    'Ион слабого электролита связывает H⁺ или OH⁻ воды в малодиссоциирующую частицу, и равновесие диссоциации воды смещается.',
    'Kuchsiz elektrolit ioni suvning H⁺ yoki OH⁻ ionini kam dissotsilanadigan zarrachaga bogʻlaydi va suv dissotsilanish muvozanati siljiydi.',
    'The ion of a weak electrolyte binds H⁺ or OH⁻ from water into a weakly dissociated species, shifting water’s equilibrium.',
  ]),
  C('ph', 'physical', 'водородный показатель|кислотность среды|среда раствора|ph', 'vodorod koʻrsatkich|ph', 'ph scale|acidity of a solution|ph', [
    'pH = −lg[H⁺] — мера кислотности раствора: pH < 7 — кислая среда, pH = 7 — нейтральная, pH > 7 — щелочная.',
    'pH = −lg[H⁺] — eritma kislotaliligi oʻlchovi: pH < 7 — kislotali muhit, pH = 7 — neytral, pH > 7 — ishqoriy.',
    'pH = −log[H⁺] measures acidity: pH < 7 acidic, pH = 7 neutral, pH > 7 alkaline.',
  ], [
    'В воде [H⁺]·[OH⁻] = 10⁻¹⁴ при 25 °C, поэтому pH + pOH = 14.',
    'Suvda 25 °C da [H⁺]·[OH⁻] = 10⁻¹⁴, shuning uchun pH + pOH = 14.',
    'In water [H⁺]·[OH⁻] = 10⁻¹⁴ at 25 °C, so pH + pOH = 14.',
  ]),
  C('indicator', 'analytical', 'индикатор|индикаторы|лакмус|фенолфталеин|метилоранж', 'indikator|indikatorlar|lakmus|fenolftalein', 'indicator|indicators|litmus|phenolphthalein', [
    'Индикаторы — вещества, меняющие цвет в зависимости от среды: лакмус краснеет в кислоте и синеет в щёлочи, фенолфталеин становится малиновым в щёлочи.',
    'Indikatorlar — muhitga qarab rangini oʻzgartiradigan moddalar: lakmus kislotada qizaradi, ishqorda koʻkaradi, fenolftalein ishqorda toʻq qizil rangga kiradi.',
    'Indicators change colour with the medium: litmus turns red in acid and blue in alkali, phenolphthalein turns pink in alkali.',
  ], [
    'Индикатор — слабая кислота или основание, у которых молекулярная и ионная формы окрашены по-разному.',
    'Indikator — molekulyar va ionli shakllari turlicha rangli boʻlgan kuchsiz kislota yoki asos.',
    'An indicator is a weak acid or base whose molecular and ionic forms have different colours.',
  ]),
  C('rate', 'physical', 'скорость реакции|скорость химической реакции|правило вант-гоффа', 'reaksiya tezligi|kimyoviy reaksiya tezligi', 'reaction rate|rate of reaction', [
    'Скорость химической реакции — изменение концентрации вещества в единицу времени; она зависит от природы веществ, концентрации, температуры, площади поверхности и катализатора.',
    'Kimyoviy reaksiya tezligi — vaqt birligida modda konsentratsiyasining oʻzgarishi; u moddalar tabiati, konsentratsiya, harorat, sirt yuzasi va katalizatorga bogʻliq.',
    'The reaction rate is the change in concentration per unit time; it depends on the nature of the reactants, concentration, temperature, surface area and catalysts.',
  ], [
    'Реагируют только столкновения частиц с энергией выше энергии активации; по правилу Вант-Гоффа нагрев на 10 °C ускоряет реакцию в 2–4 раза.',
    'Faqat energiyasi aktivlanish energiyasidan yuqori zarrachalar toʻqnashuvi reaksiyaga olib keladi; Vant-Goff qoidasiga koʻra 10 °C ga qizdirish reaksiyani 2–4 marta tezlashtiradi.',
    'Only collisions with energy above the activation energy react; by van ’t Hoff’s rule heating by 10 °C speeds a reaction up 2–4 times.',
  ]),
  C('catalyst', 'physical', 'катализатор|катализ|катализаторы|фермент', 'katalizator|kataliz|ferment', 'catalyst|catalysis|enzyme', [
    'Катализатор — вещество, которое ускоряет реакцию, но после неё остаётся неизменным (MnO₂ при разложении H₂O₂, ферменты в организме).',
    'Katalizator — reaksiyani tezlashtiradigan, ammo undan keyin oʻzgarmay qoladigan modda (H₂O₂ parchalanishida MnO₂, organizmdagi fermentlar).',
    'A catalyst speeds up a reaction and is unchanged at the end (MnO₂ in H₂O₂ decomposition, enzymes in the body).',
  ], [
    'Катализатор открывает другой путь реакции с меньшей энергией активации; положение равновесия он не меняет.',
    'Katalizator aktivlanish energiyasi kichikroq boʻlgan boshqa reaksiya yoʻlini ochadi; muvozanat holatini esa oʻzgartirmaydi.',
    'A catalyst opens a pathway with a lower activation energy; it does not shift the equilibrium.',
  ]),
  C('activation', 'physical', 'энергия активации|уравнение аррениуса', 'aktivlanish energiyasi|arrenius tenglamasi', 'activation energy|arrhenius equation', [
    'Энергия активации Ea — минимальная энергия, которой должны обладать сталкивающиеся частицы, чтобы реакция произошла.',
    'Aktivlanish energiyasi Ea — reaksiya sodir boʻlishi uchun toʻqnashayotgan zarrachalarda boʻlishi kerak boʻlgan eng kam energiya.',
    'Activation energy Ea is the minimum energy colliding particles need for the reaction to happen.',
  ], [
    'Уравнение Аррениуса: k = A·e^(−Ea/RT) — чем выше температура и ниже Ea, тем больше константа скорости.',
    'Arrenius tenglamasi: k = A·e^(−Ea/RT) — harorat qancha yuqori va Ea qancha past boʻlsa, tezlik konstantasi shuncha katta.',
    'The Arrhenius equation k = A·e^(−Ea/RT): higher temperature and lower Ea give a larger rate constant.',
  ]),
  C('kinetics', 'physical', 'порядок реакции|кинетика|химическая кинетика|константа скорости|второго порядка|первого порядка|период полупревращения', 'reaksiya tartibi|kinetika|kimyoviy kinetika|tezlik konstantasi', 'reaction order|kinetics|chemical kinetics|rate constant|second order|first order|rate law', [
    'Порядок реакции — показатель степени концентрации в кинетическом уравнении v = k·[A]ᵐ[B]ⁿ, его находят из опыта. Для реакции второго порядка 1/[A] = 1/[A]₀ + kt, а период полупревращения t½ = 1/(k[A]₀) зависит от начальной концентрации.',
    'Reaksiya tartibi — v = k·[A]ᵐ[B]ⁿ kinetik tenglamasidagi konsentratsiya darajasi koʻrsatkichi, u tajribadan topiladi. Ikkinchi tartibli reaksiya uchun 1/[A] = 1/[A]₀ + kt, yarim aylanish davri t½ = 1/(k[A]₀) boshlangʻich konsentratsiyaga bogʻliq.',
    'Reaction order is the exponent of concentration in the rate law v = k·[A]ᵐ[B]ⁿ, found by experiment. For a second-order reaction 1/[A] = 1/[A]₀ + kt, and the half-life t½ = 1/(k[A]₀) depends on the starting concentration.',
  ], [
    'Порядок отражает механизм — сколько частиц участвует в самой медленной (лимитирующей) стадии, поэтому его определяют экспериментально, а не по коэффициентам уравнения.',
    'Tartib mexanizmni aks ettiradi — eng sekin (cheklovchi) bosqichda nechta zarracha qatnashadi; shuning uchun u tenglama koeffitsiyentlaridan emas, tajribadan aniqlanadi.',
    'The order reflects the mechanism — how many particles take part in the slowest (rate-determining) step — so it is found experimentally, not from the equation’s coefficients.',
  ]),
  C('equilibrium', 'physical', 'химическое равновесие|константа равновесия|закон действующих масс|обратимые реакции', 'kimyoviy muvozanat|muvozanat konstantasi|massalar taʼsiri qonuni|qaytar reaksiyalar', 'chemical equilibrium|equilibrium constant|law of mass action|reversible reactions', [
    'Химическое равновесие — состояние обратимой реакции, при котором скорости прямой и обратной реакций равны и концентрации больше не меняются; его характеризует константа K = [C]ᶜ[D]ᵈ / ([A]ᵃ[B]ᵇ).',
    'Kimyoviy muvozanat — qaytar reaksiyaning toʻgʻri va teskari reaksiya tezliklari teng boʻlib, konsentratsiyalar oʻzgarmay qolgan holati; uni K = [C]ᶜ[D]ᵈ / ([A]ᵃ[B]ᵇ) konstantasi tavsiflaydi.',
    'Chemical equilibrium is the state of a reversible reaction where forward and reverse rates are equal and concentrations stop changing; it is described by K = [C]ᶜ[D]ᵈ / ([A]ᵃ[B]ᵇ).',
  ], [
    'Равновесие динамическое: обе реакции идут, но с одинаковой скоростью; константа связана с энергией Гиббса: ΔG° = −RT·lnK.',
    'Muvozanat dinamik: ikkala reaksiya ham boradi, lekin bir xil tezlikda; konstanta Gibbs energiyasi bilan bogʻliq: ΔG° = −RT·lnK.',
    'The equilibrium is dynamic: both reactions continue at equal rates; K is linked to Gibbs energy by ΔG° = −RT·lnK.',
  ]),
  C('lechatelier', 'physical', 'принцип ле шателье|смещение равновесия|ле шателье', 'le shatele prinsipi|muvozanatning siljishi', "le chatelier's principle|le chatelier|shift of equilibrium", [
    'Принцип Ле Шателье: если на систему в равновесии оказать воздействие (изменить концентрацию, давление или температуру), равновесие смещается в сторону, ослабляющую это воздействие.',
    'Le Shatele prinsipi: muvozanatdagi sistemaga taʼsir koʻrsatilsa (konsentratsiya, bosim yoki harorat oʻzgartirilsa), muvozanat shu taʼsirni susaytiradigan tomonga siljiydi.',
    'Le Chatelier’s principle: if a system at equilibrium is disturbed (concentration, pressure or temperature changes), the equilibrium shifts to counteract the change.',
  ], [
    'Нагрев смещает равновесие в сторону эндотермической реакции, а повышение давления — в сторону меньшего числа молей газа.',
    'Qizdirish muvozanatni endotermik reaksiya tomonga, bosimni oshirish esa gaz mollari kamroq tomonga siljitadi.',
    'Heating favours the endothermic direction; raising pressure favours the side with fewer moles of gas.',
  ]),
  C('enthalpy', 'physical', 'энтальпия|тепловой эффект|экзотермическая|эндотермическая|экзотермические|эндотермические', 'entalpiya|issiqlik effekti|ekzotermik|endotermik', 'enthalpy|heat of reaction|exothermic|endothermic', [
    'Энтальпия H — теплосодержание системы; её изменение ΔH — тепловой эффект реакции при постоянном давлении: ΔH < 0 — реакция экзотермическая (тепло выделяется), ΔH > 0 — эндотермическая.',
    'Entalpiya H — sistemaning issiqlik miqdori; uning oʻzgarishi ΔH — oʻzgarmas bosimdagi reaksiyaning issiqlik effekti: ΔH < 0 — ekzotermik (issiqlik ajraladi), ΔH > 0 — endotermik reaksiya.',
    'Enthalpy H is the heat content of a system; its change ΔH is the heat of reaction at constant pressure: ΔH < 0 exothermic (heat released), ΔH > 0 endothermic.',
  ], [
    'Тепло выделяется, когда новые связи прочнее разорванных; по закону Гесса ΔH = ΣΔfH(продуктов) − ΣΔfH(исходных).',
    'Yangi bogʻlar uzilganlaridan mustahkamroq boʻlsa, issiqlik ajraladi; Gess qonuniga koʻra ΔH = ΣΔfH(mahsulotlar) − ΣΔfH(boshlangʻich moddalar).',
    'Heat is released when the new bonds are stronger than the broken ones; by Hess’s law ΔH = ΣΔfH(products) − ΣΔfH(reactants).',
  ]),
  C('hess', 'physical', 'закон гесса', 'gess qonuni', "hess's law|hess law", [
    'Закон Гесса: тепловой эффект реакции зависит только от начального и конечного состояний веществ и не зависит от пути процесса.',
    'Gess qonuni: reaksiyaning issiqlik effekti faqat moddalarning boshlangʻich va oxirgi holatiga bogʻliq, jarayon yoʻliga bogʻliq emas.',
    'Hess’s law: the heat of reaction depends only on the initial and final states, not on the path.',
  ], [
    'Энтальпия — функция состояния (следствие закона сохранения энергии), поэтому термохимические уравнения можно складывать как алгебраические.',
    'Entalpiya — holat funksiyasi (energiyaning saqlanish qonuni natijasi), shuning uchun termokimyoviy tenglamalarni algebraik tenglamalar kabi qoʻshish mumkin.',
    'Enthalpy is a state function (a consequence of energy conservation), so thermochemical equations can be added like algebraic ones.',
  ]),
  C('entropy', 'physical', 'энтропия|второй закон термодинамики|второе начало термодинамики', 'entropiya|termodinamikaning ikkinchi qonuni', 'entropy|second law of thermodynamics', [
    'Энтропия S — мера неупорядоченности системы, точнее числа доступных ей микросостояний (S = k·lnW); она растёт при плавлении, испарении, растворении и увеличении числа молекул газа.',
    'Entropiya S — sistemaning tartibsizlik oʻlchovi, aniqrogʻi unga mavjud mikroholatlar soni (S = k·lnW); u suyuqlanish, bugʻlanish, erish va gaz molekulalari soni ortganda oshadi.',
    'Entropy S measures disorder — more precisely the number of accessible microstates (S = k·lnW); it rises on melting, evaporation, dissolving and when the number of gas molecules increases.',
  ], [
    'Второй закон термодинамики: в изолированной системе энтропия самопроизвольно не убывает.',
    'Termodinamikaning ikkinchi qonuni: izolyatsiyalangan sistemada entropiya oʻz-oʻzidan kamaymaydi.',
    'The second law of thermodynamics: the entropy of an isolated system never decreases spontaneously.',
  ]),
  C('gibbs', 'physical', 'энергия гиббса|свободная энергия|самопроизвольность реакции|самопроизвольный процесс', 'gibbs energiyasi|erkin energiya|oʻz-oʻzidan boradigan jarayon', 'gibbs free energy|gibbs energy|free energy|spontaneity', [
    'Энергия Гиббса G = H − TS; при постоянных температуре и давлении реакция идёт самопроизвольно, если ΔG = ΔH − TΔS < 0.',
    'Gibbs energiyasi G = H − TS; oʻzgarmas harorat va bosimda ΔG = ΔH − TΔS < 0 boʻlsa, reaksiya oʻz-oʻzidan boradi.',
    'Gibbs energy G = H − TS; at constant temperature and pressure a reaction is spontaneous when ΔG = ΔH − TΔS < 0.',
  ], [
    'Она объединяет два стремления — к минимуму энергии (ΔH < 0) и к максимуму беспорядка (ΔS > 0); при высокой температуре решает член TΔS, а связь с равновесием даёт ΔG° = −RT·lnK.',
    'U ikki intilishni birlashtiradi — energiya minimumiga (ΔH < 0) va tartibsizlik maksimumiga (ΔS > 0); yuqori haroratda TΔS hal qiladi, muvozanat bilan bogʻliqligi esa ΔG° = −RT·lnK.',
    'It combines two drives — towards minimum energy (ΔH < 0) and maximum disorder (ΔS > 0); at high temperature the TΔS term dominates, and ΔG° = −RT·lnK links it to equilibrium.',
  ]),
  C('firstlaw', 'physical', 'первый закон термодинамики|первое начало термодинамики|внутренняя энергия', 'termodinamikaning birinchi qonuni|ichki energiya', 'first law of thermodynamics|internal energy', [
    'Первый закон термодинамики: ΔU = Q − A — изменение внутренней энергии системы равно полученной теплоте минус совершённая системой работа.',
    'Termodinamikaning birinchi qonuni: ΔU = Q − A — sistema ichki energiyasining oʻzgarishi olingan issiqlikdan sistema bajargan ishni ayirganiga teng.',
    'The first law of thermodynamics: ΔU = Q − W — the change in internal energy equals heat absorbed minus work done by the system.',
  ], [
    'Это закон сохранения энергии: энергия не исчезает, а переходит из одной формы в другую.',
    'Bu energiyaning saqlanish qonuni: energiya yoʻqolmaydi, bir shakldan boshqasiga oʻtadi.',
    'It is energy conservation: energy is not lost, only converted from one form to another.',
  ]),
  C('solution', 'physical', 'раствор|растворы|растворимость|растворение', 'eritma|eritmalar|eruvchanlik|erish', 'solution|solutions|solubility|dissolving', [
    'Раствор — однородная смесь растворителя и растворённого вещества; растворимость — наибольшая масса вещества, которая растворяется в 100 г воды при данной температуре.',
    'Eritma — erituvchi va erigan moddaning bir jinsli aralashmasi; eruvchanlik — maʼlum haroratda 100 g suvda eriydigan moddaning eng katta massasi.',
    'A solution is a uniform mixture of solvent and solute; solubility is the largest mass of a substance that dissolves in 100 g of water at a given temperature.',
  ], [
    '«Подобное растворяется в подобном»: полярные и ионные вещества растворяются в полярной воде, неполярные — в неполярных растворителях.',
    '«Oʻxshash oʻxshashda eriydi»: qutbli va ionli moddalar qutbli suvda, qutbsiz moddalar qutbsiz erituvchilarda eriydi.',
    '“Like dissolves like”: polar and ionic substances dissolve in polar water, nonpolar ones in nonpolar solvents.',
  ]),
  C('massfraction', 'general', 'массовая доля', 'massa ulushi', 'mass fraction|mass percent', [
    'Массовая доля ω — отношение массы растворённого вещества (или элемента) к массе раствора (или вещества): ω = m(в-ва) / m(р-ра) · 100%.',
    'Massa ulushi ω — erigan modda (yoki element) massasining eritma (yoki modda) massasiga nisbati: ω = m(modda) / m(eritma) · 100%.',
    'Mass fraction ω is the mass of solute (or element) divided by the mass of solution (or compound): ω = m(solute) / m(solution) · 100%.',
  ], [
    'Это следствие сохранения массы: масса раствора равна массе вещества плюс масса растворителя.',
    'Bu massa saqlanishining natijasi: eritma massasi modda massasi va erituvchi massasi yigʻindisiga teng.',
    'It follows from mass conservation: the solution’s mass is the solute’s mass plus the solvent’s mass.',
  ]),
  C('molarity', 'physical', 'молярная концентрация|молярность|концентрация раствора', 'molyar konsentratsiya|eritma konsentratsiyasi', 'molar concentration|molarity|concentration', [
    'Молярная концентрация C = n/V — количество вещества (моль) в 1 л раствора; единица — моль/л (М).',
    'Molyar konsentratsiya C = n/V — 1 l eritmadagi modda miqdori (mol); birligi — mol/l (M).',
    'Molar concentration C = n/V is the amount of solute (mol) per litre of solution; unit mol/L (M).',
  ], [
    'При разбавлении количество вещества не меняется, поэтому C₁V₁ = C₂V₂.',
    'Suyultirishda modda miqdori oʻzgarmaydi, shuning uchun C₁V₁ = C₂V₂.',
    'Dilution does not change the amount of solute, so C₁V₁ = C₂V₂.',
  ]),
  C('buffer', 'physical', 'буферный раствор|буферные растворы|буфер|буферная система', 'bufer eritma|bufer eritmalar|bufer', 'buffer solution|buffer|buffers', [
    'Буферный раствор — смесь слабой кислоты и её соли (CH₃COOH/CH₃COONa) или слабого основания и его соли; он почти сохраняет pH при добавлении небольших количеств кислоты или щёлочи.',
    'Bufer eritma — kuchsiz kislota va uning tuzi (CH₃COOH/CH₃COONa) yoki kuchsiz asos va uning tuzi aralashmasi; oz miqdorda kislota yoki ishqor qoʻshilganda pH deyarli oʻzgarmaydi.',
    'A buffer is a mixture of a weak acid and its salt (CH₃COOH/CH₃COONa) or a weak base and its salt; it keeps pH nearly constant when small amounts of acid or alkali are added.',
  ], [
    'Уравнение Гендерсона–Хассельбаха: pH = pKa + lg([A⁻]/[HA]); добавленные H⁺ связывает A⁻, а OH⁻ — кислота HA. Пример — буфер крови H₂CO₃/HCO₃⁻ (pH ≈ 7,4).',
    'Genderson–Xasselbax tenglamasi: pH = pKa + lg([A⁻]/[HA]); qoʻshilgan H⁺ ni A⁻, OH⁻ ni esa HA kislota bogʻlaydi. Misol — qon buferi H₂CO₃/HCO₃⁻ (pH ≈ 7,4).',
    'The Henderson–Hasselbalch equation: pH = pKa + log([A⁻]/[HA]); added H⁺ is taken up by A⁻ and added OH⁻ by HA. Example: the blood buffer H₂CO₃/HCO₃⁻ (pH ≈ 7.4).',
  ]),
  C('complex', 'inorganic', 'комплексные соединения|координационные соединения|комплексообразователь|лиганды|лиганд|координационное число', 'kompleks birikmalar|koordinatsion birikmalar|ligand|ligandlar|kompleks hosil qiluvchi', 'coordination compounds|coordination compound|complex compounds|complex ion|ligand|ligands|coordination number', [
    'Комплексные (координационные) соединения содержат центральный атом-комплексообразователь (обычно ион d-металла), связанный с лигандами донорно-акцепторными связями: K₄[Fe(CN)₆], [Cu(NH₃)₄]SO₄.',
    'Kompleks (koordinatsion) birikmalarda markaziy atom — kompleks hosil qiluvchi (odatda d-metall ioni) ligandlar bilan donor-akseptor bogʻlar orqali bogʻlangan: K₄[Fe(CN)₆], [Cu(NH₃)₄]SO₄.',
    'Coordination compounds contain a central atom (usually a d-metal ion) bound to ligands by donor–acceptor bonds: K₄[Fe(CN)₆], [Cu(NH₃)₄]SO₄.',
  ], [
    'Лиганды отдают неподелённые пары на свободные орбитали металла; число таких связей — координационное число (чаще 4 или 6), а расщепление d-уровней в поле лигандов объясняет яркий цвет комплексов.',
    'Ligandlar boʻlinmagan juftlarini metallning boʻsh orbitallariga beradi; bunday bogʻlar soni — koordinatsion son (koʻpincha 4 yoki 6), ligandlar maydonida d-sathlarning ajralishi komplekslarning yorqin rangini tushuntiradi.',
    'Ligands donate lone pairs into empty metal orbitals; the number of such bonds is the coordination number (often 4 or 6), and d-level splitting in the ligand field explains the vivid colours.',
  ]),
  C('colloid', 'colloid', 'коллоидные растворы|коллоиды|коллоид|эффект тиндаля|дисперсные системы|золь|гель', 'kolloid eritmalar|kolloidlar|tindal effekti|dispers sistemalar', 'colloids|colloid|colloidal|tyndall effect|dispersed systems|sol|gel', [
    'Коллоидные системы — дисперсии с частицами размером 1–100 нм (молоко, туман, гели); их узнают по эффекту Тиндаля — светящемуся конусу луча света.',
    'Kolloid sistemalar — zarrachalari 1–100 nm boʻlgan dispersiyalar (sut, tuman, gellar); ularni Tindal effekti — yorugʻlik nurining yorugʻ konusi orqali aniqlanadi.',
    'Colloids are dispersions with particles of 1–100 nm (milk, fog, gels); they are recognised by the Tyndall effect — a visible cone of scattered light.',
  ], [
    'Частицы слишком малы, чтобы оседать, но достаточно велики, чтобы рассеивать свет; устойчивость дают одноимённые заряды и сольватные оболочки, а электролиты вызывают коагуляцию.',
    'Zarrachalar choʻkish uchun juda kichik, lekin yorugʻlikni sochish uchun yetarlicha katta; barqarorlikni bir xil zaryadlar va solvat qobiqlar beradi, elektrolitlar esa koagulyatsiyaga olib keladi.',
    'The particles are too small to settle but big enough to scatter light; like charges and solvation shells keep them stable, and electrolytes cause coagulation.',
  ]),
  C('adsorption', 'colloid', 'адсорбция|адсорбент|активированный уголь', 'adsorbsiya|adsorbent|faollashtirilgan koʻmir', 'adsorption|adsorbent|activated carbon', [
    'Адсорбция — поглощение вещества поверхностью другого вещества (активированный уголь поглощает газы и красители).',
    'Adsorbsiya — moddaning boshqa modda sirti tomonidan yutilishi (faollashtirilgan koʻmir gazlar va boʻyoqlarni yutadi).',
    'Adsorption is the uptake of a substance onto the surface of another (activated carbon adsorbs gases and dyes).',
  ], [
    'У атомов на поверхности есть нескомпенсированные связи (поверхностная энергия), поэтому они притягивают частицы; чем больше площадь поверхности, тем сильнее адсорбция.',
    'Sirtdagi atomlarda kompensatsiyalanmagan bogʻlar (sirt energiyasi) bor, shuning uchun ular zarrachalarni tortadi; sirt yuzasi qancha katta boʻlsa, adsorbsiya shuncha kuchli.',
    'Surface atoms have unsatisfied bonds (surface energy), so they attract particles; the larger the surface area, the stronger the adsorption.',
  ]),
  C('chromatography', 'analytical', 'хроматография', 'xromatografiya', 'chromatography', [
    'Хроматография — метод разделения смесей за счёт разного распределения компонентов между неподвижной и подвижной фазами (бумажная, тонкослойная, газовая).',
    'Xromatografiya — komponentlarning harakatsiz va harakatchan fazalar orasida turlicha taqsimlanishi hisobiga aralashmalarni ajratish usuli (qogʻoz, yupqa qatlam, gaz).',
    'Chromatography separates mixtures by the different distribution of components between a stationary and a mobile phase (paper, thin-layer, gas).',
  ], [
    'Компонент, который сильнее удерживается неподвижной фазой, движется медленнее — так смесь разделяется на зоны.',
    'Harakatsiz faza kuchliroq ushlab turadigan komponent sekinroq harakatlanadi — aralashma shunday zonalarga ajraladi.',
    'A component held more strongly by the stationary phase moves more slowly, so the mixture separates into bands.',
  ]),
  C('titration', 'analytical', 'титрование|точка эквивалентности|титриметрия', 'titrlash|ekvivalent nuqta', 'titration|equivalence point', [
    'Титрование — метод количественного анализа: к раствору понемногу добавляют реактив известной концентрации до точки эквивалентности, которую отмечает индикатор.',
    'Titrlash — miqdoriy tahlil usuli: eritmaga konsentratsiyasi maʼlum reaktiv ekvivalent nuqtagacha oz-ozdan qoʻshiladi, uni indikator koʻrsatadi.',
    'Titration is a quantitative method: a reagent of known concentration is added gradually until the equivalence point, shown by an indicator.',
  ], [
    'В точке эквивалентности вещества прореагировали в стехиометрическом отношении: для реакции 1 : 1 C₁V₁ = C₂V₂.',
    'Ekvivalent nuqtada moddalar stexiometrik nisbatda reaksiyaga kirishgan: 1 : 1 reaksiya uchun C₁V₁ = C₂V₂.',
    'At the equivalence point the reactants have reacted in stoichiometric ratio: for a 1 : 1 reaction C₁V₁ = C₂V₂.',
  ]),
  C('spectroscopy', 'analytical', 'спектроскопия|спектральный анализ|спектр|окраска пламени', 'spektroskopiya|spektral tahlil|spektr|alanga rangi', 'spectroscopy|spectral analysis|spectrum|flame test', [
    'Спектроскопия изучает вещества по поглощению или испусканию излучения; каждый элемент даёт свой линейчатый спектр (пламя: натрий — жёлтое, калий — фиолетовое).',
    'Spektroskopiya moddalarni nurlanishni yutish yoki chiqarishiga koʻra oʻrganadi; har bir element oʻz chiziqli spektrini beradi (alanga: natriy — sariq, kaliy — binafsha).',
    'Spectroscopy studies substances by the radiation they absorb or emit; each element has its own line spectrum (flame: sodium yellow, potassium violet).',
  ], [
    'Электроны переходят между квантованными уровнями, поглощая или испуская фотон с энергией E = hν, поэтому линии спектра уникальны для каждого атома.',
    'Elektronlar kvantlangan sathlar orasida oʻtib, E = hν energiyali foton yutadi yoki chiqaradi, shuning uchun spektr chiziqlari har bir atom uchun noyob.',
    'Electrons jump between quantised levels, absorbing or emitting photons of energy E = hν, so each atom’s spectral lines are unique.',
  ]),
  C('metals', 'inorganic', 'металлы|металл|свойства металлов', 'metallar|metall|metallar xossalari', 'metals|metal|properties of metals', [
    'Металлы — элементы, атомы которых легко отдают внешние электроны; их простые вещества блестят, проводят ток и тепло, пластичны.',
    'Metallar — atomlari tashqi elektronlarini oson beradigan elementlar; ularning oddiy moddalari yaltiraydi, tok va issiqlik oʻtkazadi, plastik.',
    'Metals are elements whose atoms easily give up outer electrons; as simple substances they are shiny, conduct electricity and heat, and are malleable.',
  ], [
    'Мало внешних электронов и большой радиус — низкая энергия ионизации; поэтому металлы — восстановители, а свободные электроны дают проводимость.',
    'Tashqi elektronlar kam va radius katta — ionlanish energiyasi past; shuning uchun metallar qaytaruvchi, erkin elektronlar esa oʻtkazuvchanlik beradi.',
    'Few outer electrons and a large radius mean low ionisation energy; so metals are reducing agents, and free electrons give conductivity.',
  ]),
  C('nonmetals', 'inorganic', 'неметаллы|неметалл', 'metallmaslar|metallmas', 'nonmetals|non-metals|nonmetal', [
    'Неметаллы — элементы, атомы которых стремятся принимать электроны (O, N, Cl, S); их простые вещества чаще газы или хрупкие твёрдые вещества и плохо проводят ток.',
    'Metallmaslar — atomlari elektron qabul qilishga intiladigan elementlar (O, N, Cl, S); ularning oddiy moddalari koʻpincha gaz yoki moʻrt qattiq modda boʻlib, tokni yomon oʻtkazadi.',
    'Non-metals are elements whose atoms tend to gain electrons (O, N, Cl, S); their simple substances are mostly gases or brittle solids and conduct poorly.',
  ], [
    'Много электронов на внешнем слое и высокая электроотрицательность — поэтому неметаллы обычно окислители.',
    'Tashqi qavatda elektronlar koʻp va elektromanfiylik yuqori — shuning uchun metallmaslar odatda oksidlovchi.',
    'Many outer electrons and high electronegativity make non-metals typical oxidising agents.',
  ]),
  C('alkali', 'inorganic', 'щелочные металлы', 'ishqoriy metallar', 'alkali metals', [
    'Щелочные металлы — элементы IA-группы (Li, Na, K, Rb, Cs, Fr): мягкие, очень активные, бурно реагируют с водой с образованием щёлочи и водорода.',
    'Ishqoriy metallar — IA-guruh elementlari (Li, Na, K, Rb, Cs, Fr): yumshoq, juda faol, suv bilan shiddatli reaksiyaga kirishib ishqor va vodorod hosil qiladi.',
    'Alkali metals are group IA elements (Li, Na, K, Rb, Cs, Fr): soft and very reactive, they react vigorously with water to give an alkali and hydrogen.',
  ], [
    'Единственный внешний электрон отдаётся легко; вниз по группе радиус растёт, энергия ионизации падает — активность растёт.',
    'Yagona tashqi elektron oson beriladi; guruh boʻylab pastga radius ortadi, ionlanish energiyasi kamayadi — faollik ortadi.',
    'The single outer electron is lost easily; down the group the radius grows and ionisation energy falls, so reactivity increases.',
  ]),
  C('halogens', 'inorganic', 'галогены', 'galogenlar', 'halogens', [
    'Галогены — элементы VIIA-группы (F, Cl, Br, I): сильные окислители, образуют двухатомные молекулы, с металлами дают соли.',
    'Galogenlar — VIIA-guruh elementlari (F, Cl, Br, I): kuchli oksidlovchilar, ikki atomli molekulalar hosil qiladi, metallar bilan tuzlar beradi.',
    'Halogens are group VIIA elements (F, Cl, Br, I): strong oxidising agents that form diatomic molecules and give salts with metals.',
  ], [
    'Им не хватает одного электрона до октета; вниз по группе радиус растёт, и окислительная сила падает: F₂ > Cl₂ > Br₂ > I₂.',
    'Ularga oktetgacha bitta elektron yetishmaydi; guruh boʻylab pastga radius ortadi va oksidlovchilik kuchi kamayadi: F₂ > Cl₂ > Br₂ > I₂.',
    'They are one electron short of an octet; down the group the radius grows and oxidising power falls: F₂ > Cl₂ > Br₂ > I₂.',
  ]),
  C('noblegases', 'inorganic', 'благородные газы|инертные газы', 'inert gazlar|nodir gazlar', 'noble gases|inert gases', [
    'Благородные (инертные) газы — элементы VIIIA-группы (He, Ne, Ar, Kr, Xe, Rn): одноатомные и химически очень малоактивные.',
    'Inert (nodir) gazlar — VIIIA-guruh elementlari (He, Ne, Ar, Kr, Xe, Rn): bir atomli va kimyoviy jihatdan juda kam faol.',
    'Noble gases are group VIIIA elements (He, Ne, Ar, Kr, Xe, Rn): monatomic and chemically very unreactive.',
  ], [
    'Внешний слой у них заполнен (октет, у гелия — дуплет), поэтому отдавать или принимать электроны энергетически невыгодно.',
    'Ularning tashqi qavati toʻla (oktet, geliyda — duplet), shuning uchun elektron berish yoki olish energetik jihatdan foydasiz.',
    'Their outer shell is full (an octet, a duet for helium), so gaining or losing electrons costs energy.',
  ]),
  C('corrosion', 'inorganic', 'коррозия|ржавление|ржавчина', 'korroziya|zanglash|zang', 'corrosion|rusting|rust', [
    'Коррозия — самопроизвольное разрушение металлов под действием окружающей среды; пример — ржавление железа: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃.',
    'Korroziya — metallarning atrof-muhit taʼsirida oʻz-oʻzidan yemirilishi; misol — temirning zanglashi: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃.',
    'Corrosion is the spontaneous destruction of metals by their environment; e.g. the rusting of iron: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃.',
  ], [
    'Это окислительно-восстановительный процесс: металл отдаёт электроны; защищают покрытиями, протектором из более активного металла и нержавеющими сплавами.',
    'Bu oksidlanish-qaytarilish jarayoni: metall elektron beradi; qoplamalar, faolroq metalldan protektor va zanglamaydigan qotishmalar bilan himoya qilinadi.',
    'It is a redox process — the metal loses electrons; protection uses coatings, a sacrificial more active metal and stainless alloys.',
  ]),
  C('alkanes', 'organic', 'алканы|предельные углеводороды|метан|парафины', 'alkanlar|toʻyingan uglevodorodlar|metan', 'alkanes|saturated hydrocarbons|methane|paraffins', [
    'Алканы — предельные углеводороды с общей формулой CₙH₂ₙ₊₂ (метан CH₄, этан C₂H₆); атомы углерода в них в sp³-гибридизации, все связи одинарные.',
    'Alkanlar — umumiy formulasi CₙH₂ₙ₊₂ boʻlgan toʻyingan uglevodorodlar (metan CH₄, etan C₂H₆); ulardagi uglerod atomlari sp³-gibridlangan, barcha bogʻlar oddiy.',
    'Alkanes are saturated hydrocarbons with the general formula CₙH₂ₙ₊₂ (methane CH₄, ethane C₂H₆); their carbons are sp³-hybridised and all bonds are single.',
  ], [
    'Одинарные связи C–C и C–H прочные и малополярные, поэтому алканы вступают в замещение (галогенирование на свету) и горят, но не присоединяют.',
    'C–C va C–H oddiy bogʻlari mustahkam va kam qutbli, shuning uchun alkanlar oʻrin olish (yorugʻlikda galogenlash) reaksiyasiga kirishadi va yonadi, lekin biriktirmaydi.',
    'Single C–C and C–H bonds are strong and nearly nonpolar, so alkanes undergo substitution (halogenation in light) and burn, but do not add.',
  ]),
  C('alkenes', 'organic', 'алкены|этилен|непредельные углеводороды', 'alkenlar|etilen|toʻyinmagan uglevodorodlar', 'alkenes|ethylene|ethene|unsaturated hydrocarbons', [
    'Алкены — непредельные углеводороды с одной двойной связью C=C и общей формулой CₙH₂ₙ (этилен C₂H₄); атомы при двойной связи в sp²-гибридизации.',
    'Alkenlar — bitta qoʻsh C=C bogʻli, umumiy formulasi CₙH₂ₙ boʻlgan toʻyinmagan uglevodorodlar (etilen C₂H₄); qoʻsh bogʻdagi atomlar sp²-gibridlangan.',
    'Alkenes are unsaturated hydrocarbons with one C=C double bond and the general formula CₙH₂ₙ (ethylene C₂H₄); the double-bond carbons are sp².',
  ], [
    'π-связь слабее σ-связи и доступна для атаки, поэтому типичны присоединение (обесцвечивание бромной воды) и полимеризация.',
    'π-bogʻ σ-bogʻdan kuchsizroq va hujum uchun ochiq, shuning uchun biriktirish (brom suvini rangsizlantirish) va polimerlanish xos.',
    'The π bond is weaker than the σ bond and exposed, so addition (decolourising bromine water) and polymerisation are typical.',
  ]),
  C('alkynes', 'organic', 'алкины|ацетилен', 'alkinlar|atsetilen', 'alkynes|acetylene|ethyne', [
    'Алкины — углеводороды с тройной связью C≡C и общей формулой CₙH₂ₙ₋₂ (ацетилен C₂H₂); атомы при тройной связи в sp-гибридизации, молекула линейна.',
    'Alkinlar — uch karrali C≡C bogʻli, umumiy formulasi CₙH₂ₙ₋₂ boʻlgan uglevodorodlar (atsetilen C₂H₂); bu bogʻdagi atomlar sp-gibridlangan, molekula chiziqli.',
    'Alkynes are hydrocarbons with a C≡C triple bond and the formula CₙH₂ₙ₋₂ (acetylene C₂H₂); the triple-bond carbons are sp and the molecule is linear.',
  ], [
    'Две π-связи делают алкины активными в присоединении; ацетилен горит очень горячим пламенем и используется для сварки.',
    'Ikkita π-bogʻ alkinlarni biriktirishda faol qiladi; atsetilen juda issiq alanga bilan yonadi va payvandlashda ishlatiladi.',
    'Two π bonds make alkynes reactive in addition; acetylene burns with a very hot flame and is used for welding.',
  ]),
  C('arenes', 'organic', 'арены|бензол|ароматические углеводороды|ароматичность', 'arenlar|benzol|aromatik uglevodorodlar', 'arenes|benzene|aromatic hydrocarbons|aromaticity', [
    'Арены — ароматические углеводороды с бензольным кольцом (бензол C₆H₆): шесть sp²-атомов углерода и единое π-облако из шести электронов.',
    'Arenlar — benzol halqali aromatik uglevodorodlar (benzol C₆H₆): oltita sp²-uglerod atomi va oltita elektrondan iborat yagona π-bulut.',
    'Arenes are aromatic hydrocarbons with a benzene ring (C₆H₆): six sp² carbons and one delocalised π cloud of six electrons.',
  ], [
    'Делокализация π-электронов делает кольцо особенно устойчивым, поэтому для бензола типично замещение, а не присоединение.',
    'π-elektronlarning delokalizatsiyasi halqani juda barqaror qiladi, shuning uchun benzol uchun biriktirish emas, oʻrin olish xos.',
    'Delocalisation makes the ring especially stable, so benzene prefers substitution to addition.',
  ]),
  C('alcohols', 'organic', 'спирты|спирт|этанол|метанол|гидроксильная группа', 'spirtlar|spirt|etanol|metanol', 'alcohols|alcohol|ethanol|methanol|hydroxyl group', [
    'Спирты — органические вещества с гидроксильной группой –OH при насыщенном атоме углерода (метанол CH₃OH, этанол C₂H₅OH).',
    'Spirtlar — toʻyingan uglerod atomida gidroksil guruh –OH boʻlgan organik moddalar (metanol CH₃OH, etanol C₂H₅OH).',
    'Alcohols are organic compounds with an –OH group on a saturated carbon (methanol CH₃OH, ethanol C₂H₅OH).',
  ], [
    'Полярная группа O–H образует водородные связи — поэтому у спиртов высокие температуры кипения, а низшие спирты смешиваются с водой.',
    'Qutbli O–H guruhi vodorod bogʻlar hosil qiladi — shuning uchun spirtlarning qaynash harorati yuqori, quyi spirtlar esa suv bilan aralashadi.',
    'The polar O–H group forms hydrogen bonds — so alcohols boil high and the small ones mix with water.',
  ]),
  C('carboxylic', 'organic', 'карбоновые кислоты|уксусная кислота|карбоксильная группа', 'karbon kislotalar|sirka kislota|karboksil guruh', 'carboxylic acids|carboxylic acid|acetic acid|carboxyl group', [
    'Карбоновые кислоты содержат карбоксильную группу –COOH (уксусная кислота CH₃COOH); это слабые кислоты.',
    'Karbon kislotalar karboksil guruh –COOH tutadi (sirka kislota CH₃COOH); ular kuchsiz kislotalar.',
    'Carboxylic acids contain the –COOH group (acetic acid CH₃COOH); they are weak acids.',
  ], [
    'Связь O–H в карбоксиле поляризована соседней группой C=O, а анион стабилизирован делокализацией заряда — отсюда кислотные свойства.',
    'Karboksildagi O–H bogʻi qoʻshni C=O guruhi taʼsirida qutblangan, anion esa zaryad delokalizatsiyasi bilan barqarorlashgan — kislotali xossalar shundan.',
    'The O–H bond is polarised by the adjacent C=O, and the anion is stabilised by charge delocalisation — hence the acidity.',
  ]),
  C('esters', 'organic', 'сложные эфиры|этерификация|эфиры', 'murakkab efirlar|eterifikatsiya', 'esters|esterification', [
    'Сложные эфиры — продукты реакции кислот со спиртами (этерификации): CH₃COOH + C₂H₅OH ⇄ CH₃COOC₂H₅ + H₂O; многие пахнут фруктами, а жиры — эфиры глицерина.',
    'Murakkab efirlar — kislotalarning spirtlar bilan reaksiyasi (eterifikatsiya) mahsulotlari: CH₃COOH + C₂H₅OH ⇄ CH₃COOC₂H₅ + H₂O; koʻplari meva hidli, yogʻlar esa glitserin efirlari.',
    'Esters are products of acids reacting with alcohols (esterification): CH₃COOH + C₂H₅OH ⇄ CH₃COOC₂H₅ + H₂O; many smell fruity, and fats are glycerol esters.',
  ], [
    'Реакция обратима и ускоряется кислотой; по принципу Ле Шателье выход эфира повышают, удаляя воду.',
    'Reaksiya qaytar va kislota bilan tezlashadi; Le Shatele prinsipiga koʻra suvni chiqarib, efir unumi oshiriladi.',
    'The reaction is reversible and acid-catalysed; by Le Chatelier, removing water raises the ester yield.',
  ]),
  C('carbonyl', 'organic', 'альдегиды|альдегид|кетоны|кетон|ацетон|формальдегид', 'aldegidlar|aldegid|ketonlar|aseton', 'aldehydes|aldehyde|ketones|ketone|acetone|formaldehyde', [
    'Альдегиды содержат группу –CHO (формальдегид HCHO, уксусный альдегид CH₃CHO), кетоны — карбонильную группу C=O между двумя атомами углерода (ацетон).',
    'Aldegidlar –CHO guruhini tutadi (formaldegid HCHO, sirka aldegidi CH₃CHO), ketonlarda esa karbonil guruh C=O ikki uglerod atomi orasida (aseton).',
    'Aldehydes contain –CHO (formaldehyde HCHO, acetaldehyde CH₃CHO); ketones have a C=O between two carbons (acetone).',
  ], [
    'Полярная связь C=O легко присоединяет нуклеофилы; альдегиды легко окисляются до кислот (реакция «серебряного зеркала»).',
    'Qutbli C=O bogʻi nukleofillarni oson biriktiradi; aldegidlar kislotalargacha oson oksidlanadi («kumush koʻzgu» reaksiyasi).',
    'The polar C=O readily adds nucleophiles; aldehydes are easily oxidised to acids (the silver-mirror test).',
  ]),
  C('carbohydrates', 'biochem', 'углеводы|глюкоза|сахароза|крахмал|целлюлоза|фотосинтез', 'uglevodlar|glyukoza|saxaroza|kraxmal|sellyuloza|fotosintez', 'carbohydrates|glucose|sucrose|starch|cellulose|photosynthesis', [
    'Углеводы — органические вещества состава Cₙ(H₂O)ₘ: моносахариды (глюкоза C₆H₁₂O₆), дисахариды (сахароза) и полисахариды (крахмал, целлюлоза).',
    'Uglevodlar — Cₙ(H₂O)ₘ tarkibli organik moddalar: monosaxaridlar (glyukoza C₆H₁₂O₆), disaxaridlar (saxaroza) va polisaxaridlar (kraxmal, sellyuloza).',
    'Carbohydrates have the composition Cₙ(H₂O)ₘ: monosaccharides (glucose C₆H₁₂O₆), disaccharides (sucrose) and polysaccharides (starch, cellulose).',
  ], [
    'Глюкоза образуется при фотосинтезе (6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂) и окисляется в клетках, отдавая энергию.',
    'Glyukoza fotosintezda hosil boʻladi (6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂) va hujayralarda oksidlanib, energiya beradi.',
    'Glucose is made in photosynthesis (6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂) and oxidised in cells to release energy.',
  ]),
  C('proteins', 'biochem', 'белки|белок|аминокислоты|аминокислота|пептидная связь', 'oqsillar|oqsil|aminokislotalar|aminokislota|peptid bogʻ', 'proteins|protein|amino acids|amino acid|peptide bond', [
    'Белки — природные полимеры из остатков α-аминокислот, соединённых пептидными связями –CO–NH–; аминокислоты содержат группы –NH₂ и –COOH.',
    'Oqsillar — peptid bogʻlar –CO–NH– bilan bogʻlangan α-aminokislota qoldiqlaridan iborat tabiiy polimerlar; aminokislotalar –NH₂ va –COOH guruhlarini tutadi.',
    'Proteins are natural polymers of α-amino acid residues joined by peptide bonds –CO–NH–; amino acids contain –NH₂ and –COOH groups.',
  ], [
    'Аминокислоты амфотерны (кислотная и основная группы в одной молекуле); форму белка держат водородные, ионные и дисульфидные связи, а нагрев её разрушает (денатурация).',
    'Aminokislotalar amfoter (bir molekulada kislotali va asosli guruh); oqsil shaklini vodorod, ionli va disulfid bogʻlar ushlab turadi, qizdirish esa uni buzadi (denaturatsiya).',
    'Amino acids are amphoteric (acidic and basic groups in one molecule); hydrogen, ionic and disulfide bonds hold a protein’s shape, and heat destroys it (denaturation).',
  ]),
  C('fats', 'biochem', 'жиры|жир|омыление|мыло', 'yogʻlar|yogʻ|sovunlanish|sovun', 'fats|fat|saponification|soap', [
    'Жиры — сложные эфиры глицерина и высших карбоновых кислот (триглицериды); твёрдые жиры богаты предельными кислотами, жидкие масла — непредельными.',
    'Yogʻlar — glitserin va yuqori karbon kislotalarning murakkab efirlari (trigliseridlar); qattiq yogʻlar toʻyingan, suyuq moylar toʻyinmagan kislotalarga boy.',
    'Fats are esters of glycerol and long-chain carboxylic acids (triglycerides); solid fats are rich in saturated acids, oils in unsaturated ones.',
  ], [
    'Щелочной гидролиз жиров (омыление) даёт глицерин и мыло — соли высших кислот.',
    'Yogʻlarning ishqoriy gidrolizi (sovunlanish) glitserin va sovun — yuqori kislotalar tuzlarini beradi.',
    'Alkaline hydrolysis of fats (saponification) gives glycerol and soap — salts of the long-chain acids.',
  ]),
  C('polymers', 'organic', 'полимеры|полимер|полимеризация|поликонденсация|пластмассы|полиэтилен', 'polimerlar|polimer|polimerlanish|polikondensatsiya|plastmassalar|polietilen', 'polymers|polymer|polymerization|polymerisation|polycondensation|plastics|polyethylene', [
    'Полимеры — вещества из очень длинных молекул-цепей, построенных из повторяющихся звеньев-мономеров (полиэтилен (–CH₂–CH₂–)ₙ).',
    'Polimerlar — takrorlanuvchi monomer boʻgʻinlaridan qurilgan juda uzun zanjir-molekulalardan iborat moddalar (polietilen (–CH₂–CH₂–)ₙ).',
    'Polymers are substances made of very long chain molecules built from repeating monomer units (polyethylene (–CH₂–CH₂–)ₙ).',
  ], [
    'Цепи растут полимеризацией (присоединение по кратным связям) или поликонденсацией (с отщеплением малых молекул); длина и переплетение цепей дают прочность и эластичность.',
    'Zanjirlar polimerlanish (karrali bogʻlar boʻyicha biriktirish) yoki polikondensatsiya (kichik molekulalar ajralishi bilan) orqali oʻsadi; zanjirlar uzunligi va chigallashuvi mustahkamlik va elastiklik beradi.',
    'Chains grow by addition polymerisation (across multiple bonds) or condensation (releasing small molecules); chain length and entanglement give strength and elasticity.',
  ]),
  C('isomerism', 'organic', 'изомерия|изомеры|изомер|теория строения бутлерова', 'izomeriya|izomerlar|butlerov nazariyasi', 'isomerism|isomers|isomer|structural isomers', [
    'Изомеры — вещества с одинаковым составом (молекулярной формулой), но разным строением и поэтому разными свойствами (бутан и изобутан C₄H₁₀; этанол и диметиловый эфир C₂H₆O).',
    'Izomerlar — tarkibi (molekulyar formulasi) bir xil, ammo tuzilishi va shuning uchun xossalari har xil boʻlgan moddalar (butan va izobutan C₄H₁₀; etanol va dimetil efir C₂H₆O).',
    'Isomers have the same composition (molecular formula) but different structures and therefore different properties (butane and isobutane C₄H₁₀; ethanol and dimethyl ether C₂H₆O).',
  ], [
    'Теория строения А. М. Бутлерова: свойства веществ зависят не только от состава, но и от порядка соединения атомов в молекуле.',
    'A. M. Butlerovning tuzilish nazariyasi: moddalar xossalari nafaqat tarkibga, balki molekuladagi atomlarning birikish tartibiga ham bogʻliq.',
    'Butlerov’s structural theory: properties depend not only on composition but on the order in which atoms are connected.',
  ]),
  C('homologs', 'organic', 'гомологи|гомологический ряд|гомологическая разность', 'gomologlar|gomologik qator', 'homologous series|homologues|homologs', [
    'Гомологи — вещества одного класса, сходные по строению и свойствам и отличающиеся на одну или несколько групп CH₂ (гомологическая разность).',
    'Gomologlar — bir sinfga mansub, tuzilishi va xossalari oʻxshash, bir yoki bir necha CH₂ guruhi (gomologik farq) bilan farqlanadigan moddalar.',
    'Homologues belong to one class, have similar structures and properties and differ by one or more CH₂ groups.',
  ], [
    'Одинаковая функциональная группа даёт сходные химические свойства, а рост цепи плавно меняет физические: температуры кипения растут.',
    'Bir xil funksional guruh oʻxshash kimyoviy xossalarni beradi, zanjirning oʻsishi esa fizik xossalarni silliq oʻzgartiradi: qaynash harorati ortadi.',
    'The same functional group gives similar chemistry, while a longer chain changes physical properties smoothly — boiling points rise.',
  ]),
  C('functional', 'organic', 'функциональная группа|функциональные группы|классы органических соединений', 'funksional guruh|funksional guruhlar|organik birikmalar sinflari', 'functional group|functional groups|classes of organic compounds', [
    'Функциональная группа — группа атомов, определяющая характерные свойства класса органических веществ: –OH у спиртов, –CHO у альдегидов, –COOH у кислот, –NH₂ у аминов.',
    'Funksional guruh — organik moddalar sinfining xarakterli xossalarini belgilaydigan atomlar guruhi: spirtlarda –OH, aldegidlarda –CHO, kislotalarda –COOH, aminlarda –NH₂.',
    'A functional group is the group of atoms that sets the typical properties of a class: –OH in alcohols, –CHO in aldehydes, –COOH in acids, –NH₂ in amines.',
  ], [
    'Реакционный центр молекулы — там, где связи наиболее полярны, поэтому свойства класса задаёт именно функциональная группа.',
    'Molekulaning reaksiya markazi bogʻlar eng qutbli boʻlgan joyda, shuning uchun sinf xossalarini aynan funksional guruh belgilaydi.',
    'The reactive centre is where bonds are most polar, so the functional group decides the class’s chemistry.',
  ]),
  C('petroleum', 'chemtech', 'нефть|крекинг|перегонка нефти|нефтепродукты|бензин', 'neft|kreking|neftni haydash|benzin', 'petroleum|crude oil|cracking|fractional distillation|gasoline', [
    'Нефть — природная смесь углеводородов; перегонкой её разделяют на фракции (бензин, керосин, дизельное топливо, мазут), а крекингом расщепляют длинные молекулы на более короткие.',
    'Neft — uglevodorodlarning tabiiy aralashmasi; haydash orqali fraksiyalarga (benzin, kerosin, dizel yoqilgʻisi, mazut) ajratiladi, kreking bilan uzun molekulalar qisqaroqlarga parchalanadi.',
    'Petroleum is a natural mixture of hydrocarbons; distillation separates it into fractions (gasoline, kerosene, diesel, fuel oil), and cracking breaks long molecules into shorter ones.',
  ], [
    'Фракции различаются температурами кипения, то есть длиной цепей; при крекинге рвутся связи C–C, и получаются более короткие алканы и алкены.',
    'Fraksiyalar qaynash harorati, yaʼni zanjir uzunligi bilan farq qiladi; krekingda C–C bogʻlari uziladi va qisqaroq alkanlar va alkenlar hosil boʻladi.',
    'Fractions differ in boiling point, i.e. chain length; cracking breaks C–C bonds, giving shorter alkanes and alkenes.',
  ]),
  C('haber', 'chemtech', 'синтез аммиака|процесс габера|производство аммиака', 'ammiak sintezi|gaber jarayoni', 'haber process|ammonia synthesis', [
    'Синтез аммиака: N₂ + 3H₂ ⇄ 2NH₃ + Q; в промышленности ведут при 400–500 °C, 200–300 атм и с железным катализатором (процесс Габера–Боша).',
    'Ammiak sintezi: N₂ + 3H₂ ⇄ 2NH₃ + Q; sanoatda 400–500 °C, 200–300 atm va temir katalizatori bilan olib boriladi (Gaber–Bosh jarayoni).',
    'Ammonia synthesis: N₂ + 3H₂ ⇄ 2NH₃ + heat; industrially at 400–500 °C, 200–300 atm with an iron catalyst (Haber–Bosch process).',
  ], [
    'По Ле Шателье давление смещает равновесие к NH₃ (меньше молей газа); низкая температура выгодна для выхода, но замедляет реакцию — поэтому выбирают компромисс и катализатор.',
    'Le Shatele boʻyicha bosim muvozanatni NH₃ tomon siljitadi (gaz mollari kam); past harorat unum uchun foydali, lekin reaksiyani sekinlashtiradi — shuning uchun murosaviy sharoit va katalizator tanlanadi.',
    'By Le Chatelier, pressure shifts the equilibrium to NH₃ (fewer gas moles); low temperature helps the yield but slows the reaction — hence a compromise plus a catalyst.',
  ]),
  C('contact', 'chemtech', 'производство серной кислоты|контактный способ|получение серной кислоты', 'sulfat kislota ishlab chiqarish|kontakt usuli', 'contact process|sulfuric acid production|manufacture of sulfuric acid', [
    'Контактный способ: обжиг серы или пирита даёт SO₂; затем 2SO₂ + O₂ ⇄ 2SO₃ на катализаторе V₂O₅ (около 450 °C); SO₃ поглощают концентрированной серной кислотой (олеум) и разбавляют.',
    'Kontakt usuli: oltingugurt yoki piritni kuydirish SO₂ beradi; soʻng V₂O₅ katalizatorida (taxminan 450 °C) 2SO₂ + O₂ ⇄ 2SO₃; SO₃ konsentrlangan sulfat kislota (oleum) bilan yutiladi va suyultiriladi.',
    'The contact process: burning sulfur or pyrite gives SO₂; then 2SO₂ + O₂ ⇄ 2SO₃ over V₂O₅ (about 450 °C); SO₃ is absorbed in concentrated sulfuric acid (oleum) and diluted.',
  ], [
    'SO₃ поглощают не водой, а кислотой, потому что с водой образуется устойчивый туман; окисление SO₂ экзотермично — снова компромисс по температуре.',
    'SO₃ suv bilan emas, kislota bilan yutiladi, chunki suv bilan barqaror tuman hosil boʻladi; SO₂ ning oksidlanishi ekzotermik — yana harorat boʻyicha murosaga kelinadi.',
    'SO₃ is absorbed in acid, not water, because water forms a persistent mist; SO₂ oxidation is exothermic — again a temperature compromise.',
  ]),
  C('radioactivity', 'physical', 'радиоактивность|радиоактивный распад|период полураспада|ядерные реакции', 'radioaktivlik|radioaktiv yemirilish|yarim yemirilish davri|yadro reaksiyalari', 'radioactivity|radioactive decay|half-life|nuclear reactions', [
    'Радиоактивность — самопроизвольный распад неустойчивых ядер с испусканием α- или β-частиц и γ-излучения; время, за которое распадается половина ядер, называют периодом полураспада.',
    'Radioaktivlik — beqaror yadrolarning α- yoki β-zarrachalar va γ-nurlanish chiqarib oʻz-oʻzidan yemirilishi; yadrolarning yarmi yemiriladigan vaqt yarim yemirilish davri deyiladi.',
    'Radioactivity is the spontaneous decay of unstable nuclei emitting α or β particles and γ rays; the time for half the nuclei to decay is the half-life.',
  ], [
    'В ядерных реакциях сохраняются массовое число и заряд: α-распад уменьшает массовое число на 4, а заряд ядра на 2.',
    'Yadro reaksiyalarida massa soni va zaryad saqlanadi: α-yemirilish massa sonini 4 ga, yadro zaryadini 2 ga kamaytiradi.',
    'Mass number and charge are conserved in nuclear reactions: α decay lowers the mass number by 4 and the charge by 2.',
  ]),
  C('quantumchem', 'quantum', 'квантовая химия|уравнение шредингера|волновая функция|квантовая механика', 'kvant kimyosi|shredinger tenglamasi|toʻlqin funksiyasi', 'quantum chemistry|schrodinger equation|schrödinger equation|wave function|quantum mechanics', [
    'Квантовая химия описывает электроны в атомах и молекулах волновой функцией ψ — решением уравнения Шрёдингера Ĥψ = Eψ; величина |ψ|² даёт вероятность найти электрон.',
    'Kvant kimyosi atom va molekulalardagi elektronlarni toʻlqin funksiyasi ψ — Shredinger tenglamasi Ĥψ = Eψ yechimi bilan tavsiflaydi; |ψ|² elektronni topish ehtimolini beradi.',
    'Quantum chemistry describes electrons in atoms and molecules by a wave function ψ, the solution of the Schrödinger equation Ĥψ = Eψ; |ψ|² gives the probability of finding the electron.',
  ], [
    'Квантование энергии следует из волновой природы электрона, как стоячие волны в струне; отсюда орбитали, правила их заполнения и сама химическая связь.',
    'Energiyaning kvantlanishi elektronning toʻlqin tabiatidan kelib chiqadi, xuddi tordagi turgʻun toʻlqinlar kabi; orbitallar, ularning toʻlish qoidalari va kimyoviy bogʻning oʻzi shundan.',
    'Energy quantisation follows from the electron’s wave nature, like standing waves on a string; orbitals, filling rules and bonding all follow.',
  ]),
  C('hardness', 'inorganic', 'жесткость воды', 'suvning qattiqligi', 'water hardness|hard water', [
    'Жёсткость воды — содержание в ней ионов Ca²⁺ и Mg²⁺; временную (гидрокарбонатную) жёсткость устраняют кипячением, постоянную — содой или ионным обменом.',
    'Suvning qattiqligi — undagi Ca²⁺ va Mg²⁺ ionlari miqdori; vaqtinchalik (gidrokarbonatli) qattiqlik qaynatish bilan, doimiysi — soda yoki ion almashinuvi bilan yoʻqotiladi.',
    'Water hardness is the content of Ca²⁺ and Mg²⁺ ions; temporary (bicarbonate) hardness is removed by boiling, permanent hardness by soda or ion exchange.',
  ], [
    'При кипячении Ca(HCO₃)₂ → CaCO₃↓ + CO₂ + H₂O — ионы уходят в осадок (накипь).',
    'Qaynatilganda Ca(HCO₃)₂ → CaCO₃↓ + CO₂ + H₂O — ionlar choʻkmaga oʻtadi (quyqa).',
    'On boiling Ca(HCO₃)₂ → CaCO₃↓ + CO₂ + H₂O — the ions precipitate as scale.',
  ]),
  C('mixtures', 'general', 'смеси|смесь|разделение смесей|чистые вещества|фильтрование|перегонка|выпаривание', 'aralashmalar|aralashma|aralashmalarni ajratish|toza moddalar|filtrlash|haydash', 'mixtures|mixture|separation of mixtures|pure substances|filtration|distillation|evaporation', [
    'Смесь — несколько веществ, сохраняющих свои свойства; её разделяют отстаиванием, фильтрованием, выпариванием, перегонкой или магнитом — по различию физических свойств.',
    'Aralashma — oʻz xossalarini saqlagan bir necha modda; u tindirish, filtrlash, bugʻlatish, haydash yoki magnit yordamida — fizik xossalar farqiga koʻra ajratiladi.',
    'A mixture is several substances that keep their own properties; it is separated by settling, filtration, evaporation, distillation or a magnet — using differences in physical properties.',
  ], [
    'При разделении смесей новых веществ не образуется — это физические процессы; чистое вещество имеет постоянные свойства (температуры плавления и кипения).',
    'Aralashmalarni ajratishda yangi moddalar hosil boʻlmaydi — bu fizik jarayonlar; toza modda doimiy xossalarga (suyuqlanish va qaynash haroratlariga) ega.',
    'No new substances form when separating mixtures — these are physical processes; a pure substance has fixed properties (melting and boiling points).',
  ]),
  C('phenomena', 'general', 'физические и химические явления|химические явления|физические явления', 'fizik va kimyoviy hodisalar|kimyoviy hodisalar|fizik hodisalar', 'physical and chemical changes|chemical change|physical change', [
    'Физические явления меняют форму или агрегатное состояние без образования новых веществ (таяние льда); химические — образуют новые вещества (горение, ржавление).',
    'Fizik hodisalar yangi moddalar hosil qilmasdan shakl yoki agregat holatni oʻzgartiradi (muzning erishi); kimyoviy hodisalar yangi moddalar hosil qiladi (yonish, zanglash).',
    'Physical changes alter shape or state without new substances (melting ice); chemical changes produce new substances (burning, rusting).',
  ], [
    'Критерий — изменение состава: при химическом явлении рвутся и образуются химические связи.',
    'Mezon — tarkibning oʻzgarishi: kimyoviy hodisada kimyoviy bogʻlar uziladi va hosil boʻladi.',
    'The test is a change in composition: in a chemical change chemical bonds break and form.',
  ]),
  C('combustion', 'general', 'горение|сгорание', 'yonish', 'combustion|burning', [
    'Горение — быстрая экзотермическая реакция окисления с пламенем; полное горение органики даёт CO₂ и H₂O (CH₄ + 2O₂ → CO₂ + 2H₂O).',
    'Yonish — alanga bilan boradigan tez ekzotermik oksidlanish reaksiyasi; organik moddalarning toʻliq yonishi CO₂ va H₂O beradi (CH₄ + 2O₂ → CO₂ + 2H₂O).',
    'Combustion is a fast exothermic oxidation with a flame; complete combustion of organics gives CO₂ and H₂O (CH₄ + 2O₂ → CO₂ + 2H₂O).',
  ], [
    'Нужны три условия: горючее, окислитель (кислород) и температура воспламенения — уберите одно, и горение прекратится.',
    'Uchta shart kerak: yonilgʻi, oksidlovchi (kislorod) va alangalanish harorati — bittasini olib tashlasangiz, yonish toʻxtaydi.',
    'Three things are needed: fuel, an oxidiser (oxygen) and the ignition temperature — remove one and burning stops.',
  ]),
  C('idealgas', 'physical', 'уравнение менделеева-клапейрона|идеальный газ|уравнение состояния газа|газовые законы', 'ideal gaz|mendeleyev-klapeyron tenglamasi|gaz qonunlari', 'ideal gas law|ideal gas|gas laws|equation of state', [
    'Уравнение состояния идеального газа (Менделеева–Клапейрона): pV = nRT, где R = 8,314 Дж/(моль·К).',
    'Ideal gaz holat tenglamasi (Mendeleyev–Klapeyron): pV = nRT, bunda R = 8,314 J/(mol·K).',
    'The ideal gas law (Clapeyron–Mendeleev): pV = nRT, with R = 8.314 J/(mol·K).',
  ], [
    'Молекулы идеального газа не притягиваются и не имеют объёма, поэтому давление создают только их удары о стенки — оно пропорционально n и T.',
    'Ideal gaz molekulalari tortishmaydi va hajmga ega emas, shuning uchun bosimni faqat ularning devorga urilishlari hosil qiladi — u n va T ga proporsional.',
    'Ideal-gas molecules do not attract and have no volume, so pressure comes only from collisions with the walls — it is proportional to n and T.',
  ]),
  C('galvanic', 'physical', 'гальванический элемент|ряд активности металлов|электрохимический ряд|электродный потенциал|уравнение нернста|ряд напряжений', 'galvanik element|metallar faollik qatori|elektrokimyoviy qator|elektrod potensiali|nernst tenglamasi', 'galvanic cell|reactivity series|electrochemical series|electrode potential|nernst equation|voltaic cell', [
    'Гальванический элемент превращает энергию окислительно-восстановительной реакции в электрическую (элемент Даниэля Zn | Zn²⁺ || Cu²⁺ | Cu); ряд активности упорядочивает металлы по стандартным электродным потенциалам.',
    'Galvanik element oksidlanish-qaytarilish reaksiyasi energiyasini elektr energiyasiga aylantiradi (Daniel elementi Zn | Zn²⁺ || Cu²⁺ | Cu); faollik qatori metallarni standart elektrod potensiallari boʻyicha tartiblaydi.',
    'A galvanic cell turns the energy of a redox reaction into electricity (the Daniell cell Zn | Zn²⁺ || Cu²⁺ | Cu); the reactivity series orders metals by standard electrode potential.',
  ], [
    'Более активный металл (с более отрицательным потенциалом) отдаёт электроны и вытесняет менее активный из растворов его солей; ЭДС = E(катода) − E(анода), а зависимость от концентраций даёт уравнение Нернста.',
    'Faolroq metall (manfiyroq potensialli) elektron beradi va kamroq faol metallni uning tuzlari eritmalaridan siqib chiqaradi; EYK = E(katod) − E(anod), konsentratsiyaga bogʻliqlikni Nernst tenglamasi beradi.',
    'The more active metal (more negative potential) gives up electrons and displaces the less active one from its salt solutions; EMF = E(cathode) − E(anode), and the Nernst equation gives the concentration dependence.',
  ]),
]

/** Общая «логика от основ», когда понятие не распознано (без чисел и без выдумок). */
export const FIRST_PRINCIPLES: Tri = {
  ru: 'Любое вещество состоит из частиц — атомов, ионов или молекул; его свойства задаются строением атомов и типом связей между ними, а любые превращения подчиняются сохранению массы и заряда и стремлению системы к минимуму энергии.',
  uz: 'Har qanday modda zarrachalardan — atomlar, ionlar yoki molekulalardan iborat; uning xossalarini atomlar tuzilishi va ular orasidagi bogʻ turi belgilaydi, har qanday oʻzgarish esa massa va zaryadning saqlanishiga hamda sistemaning energiya minimumiga intilishiga boʻysunadi.',
  en: 'Every substance is made of particles — atoms, ions or molecules; its properties come from atomic structure and the type of bonding, and every change obeys conservation of mass and charge and the drive towards minimum energy.',
}
