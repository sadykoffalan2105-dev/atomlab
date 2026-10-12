/**
 * «Почему …?» по программе: частые школьные причины (тема карты → причина на ru/uz/en) и § класса ученика с этой темой.
 * Зачем: определения учебников русские, а у uz/en вопроса «почему» запасной путь отвечал карточкой вещества («Suv (H₂O) —
 * oksid…») и чужим § — причины в ответе не было. Причина здесь — короткое объяснение через строение и законы (то, что
 * написано в § этой темы), на языке вопроса; § — единица класса, где тема размечена в карте (topics).
 * Правила срабатывают по смыслу вопроса на любом из трёх языков (корни, не готовые фразы), только для вопросов «почему».
 */
import type { Lang } from '../pipeline/normalize.ts'
import type { CurriculumMap } from './map.ts'
import type { Unit } from './types.ts'

export type WhyRule = { topic: string; re: RegExp; text: Record<Lang, string> }

/** Текст для правил: нижний регистр, ё → е, апострофы узбекской латиницы → «'». */
export const whyForm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, ' ')

export const WHY_RULES: WhyRule[] = [
  {
    topic: 'periodic-law',
    re: /(периодическ\w* (повтор|измен)|повторя\w* периодич|davriy (ravishda )?(takror|o'zgar)|repeat\w* periodic|periodic\w* repeat)/u,
    text: {
      ru: 'Свойства элементов повторяются потому, что периодически повторяется строение внешнего электронного слоя: с ростом заряда ядра заполняется новая электронная оболочка, и у элементов одной группы снова одинаковое число внешних электронов.',
      uz: 'Elementlar xossalari takrorlanadi, chunki tashqi elektron qavat tuzilishi davriy takrorlanadi: yadro zaryadi ortgan sari yangi elektron qobiq toʻladi va bir guruh elementlarida tashqi elektronlar soni yana bir xil boʻladi.',
      en: 'Properties repeat because the structure of the outer electron shell repeats: as the nuclear charge grows, a new electron shell fills, and elements of one group again have the same number of outer electrons.',
    },
  },
  {
    topic: 'isotopes',
    re: /(атомн\w* масс\w* .{0,30}дробн|дробн\w* .{0,30}атомн\w* масс|atom massasi kasr|kasr son|atomic mass .{0,40}(not a whole|fraction))/u,
    text: {
      ru: 'Относительная атомная масса — среднее значение по природным изотопам элемента: у хлора это ³⁵Cl (около 75 %) и ³⁷Cl (около 25 %), поэтому Ar(Cl) ≈ 35,5 — дробное число.',
      uz: 'Nisbiy atom massa — elementning tabiiy izotoplari boʻyicha oʻrtacha qiymat: xlorda bular ³⁵Cl (taxminan 75 %) va ³⁷Cl (taxminan 25 %), shuning uchun Ar(Cl) ≈ 35,5 — kasr son.',
      en: 'Relative atomic mass is the average over the natural isotopes of an element: chlorine has ³⁵Cl (about 75 %) and ³⁷Cl (about 25 %), so Ar(Cl) ≈ 35.5 — not a whole number.',
    },
  },
  {
    topic: 'ionic-bond',
    re: /((хлорид натрия|поваренн\w* сол|nacl|natriy xlorid|sodium chloride|ионн\w* (кристал|соедин|вещест)|ionli|ionic (compound|crystal)).{0,40}(температур\w* плавлен|плав|suyuqlanish|melting))/u,
    text: {
      ru: 'В кристалле хлорида натрия ионы Na⁺ и Cl⁻ связаны сильным электростатическим притяжением (ионная связь) по всей ионной решётке; чтобы расплавить кристалл, нужно разорвать множество таких связей, поэтому температура плавления высокая (801 °C).',
      uz: 'Natriy xlorid kristalida Na⁺ va Cl⁻ ionlari butun ion panjara boʻylab kuchli elektrostatik tortishish (ion bogʻ) bilan bogʻlangan; kristalni suyuqlantirish uchun koʻp bogʻlarni uzish kerak, shuning uchun suyuqlanish harorati yuqori (801 °C).',
      en: 'In a sodium chloride crystal the Na⁺ and Cl⁻ ions are held by strong electrostatic attraction (ionic bonds) throughout the ionic lattice; melting requires breaking many of these bonds, so the melting point is high (801 °C).',
    },
  },
  {
    topic: 'crystal-lattice',
    re: /(алмаз\w* .{0,20}тверд|тверд\w* .{0,20}алмаз|olmos .{0,20}qattiq|diamond .{0,20}hard)/u,
    text: {
      ru: 'Алмаз имеет атомную кристаллическую решётку: каждый атом углерода прочно связан ковалентными связями с четырьмя соседями, и вся решётка — одна огромная сетка таких связей, поэтому алмаз очень твёрдый.',
      uz: 'Olmosda atom kristall panjara bor: har bir uglerod atomi toʻrtta qoʻshnisi bilan mustahkam kovalent bogʻlar orqali bogʻlangan, butun panjara shunday bogʻlarning yagona toʻri, shuning uchun olmos juda qattiq.',
      en: 'Diamond has an atomic (covalent) crystal lattice: each carbon atom is held by strong covalent bonds to four neighbours, and the whole lattice is one giant network of such bonds, so diamond is very hard.',
    },
  },
  {
    topic: 'valence',
    re: /(валентн\w* водород|водород\w* .{0,20}валентн|vodorodning valentlig|valentlig\w* .{0,20}vodorod|valen\w* of hydrogen|hydrogen\w* valen)/u,
    text: {
      ru: 'У атома водорода один электрон, и он может образовать только одну общую электронную пару — одну химическую связь, поэтому валентность водорода всегда равна I.',
      uz: 'Vodorod atomida bitta elektron bor va u faqat bitta umumiy elektron juft — bitta kimyoviy bogʻ hosil qila oladi, shuning uchun vodorodning valentligi doim I ga teng.',
      en: 'A hydrogen atom has one electron, so it can form only one shared electron pair — one chemical bond; that is why the valence of hydrogen is always I.',
    },
  },
  {
    topic: 'mass-conservation',
    re: /(масс\w* .{0,40}до реакци.{0,40}после|massasi reaksiyadan keyingi|reaksiyagacha .{0,30}massa|mass .{0,40}before .{0,30}reaction .{0,30}after|сохранени\w* масс)/u,
    text: {
      ru: 'При химической реакции атомы не исчезают и не появляются — они только перегруппировываются в новые молекулы; число атомов каждого элемента и их массы не меняются, поэтому масса веществ до реакции равна массе после (закон сохранения массы).',
      uz: 'Kimyoviy reaksiyada atomlar yoʻqolmaydi va paydo boʻlmaydi — ular faqat yangi molekulalarga qayta guruhlanadi; har bir element atomlari soni va massasi oʻzgarmaydi, shuning uchun reaksiyagacha massa reaksiyadan keyingi massaga teng (massaning saqlanish qonuni).',
      en: 'In a chemical reaction atoms are neither created nor destroyed — they only regroup into new molecules; the number of atoms of each element and their masses stay the same, so the mass before the reaction equals the mass after (conservation of mass).',
    },
  },
  {
    topic: 'chemical-phenomena',
    re: /((горени|сгоран|yonish|burning|combustion).{0,40}(химическ\w* явлен|kimyoviy hodisa|chemical (phenomen|change)))/u,
    text: {
      ru: 'При горении свечи образуются новые вещества — углекислый газ и вода, выделяются тепло и свет; признак химического явления — образование новых веществ с другими свойствами.',
      uz: 'Sham yonganda yangi moddalar — karbonat angidrid va suv hosil boʻladi, issiqlik va yorugʻlik ajraladi; kimyoviy hodisaning belgisi — boshqa xossali yangi moddalar hosil boʻlishi.',
      en: 'When a candle burns, new substances form — carbon dioxide and water — and heat and light are released; the sign of a chemical phenomenon is the formation of new substances with different properties.',
    },
  },
  {
    topic: 'simple-complex',
    re: /((прост\w* вещест.{0,40}сложн)|(oddiy modda.{0,40}murakkab)|(simple substance.{0,40}compound))/u,
    text: {
      ru: 'Простое вещество состоит из атомов одного химического элемента (O₂ — только кислород), а сложное — из атомов разных элементов (H₂O — водород и кислород).',
      uz: 'Oddiy modda bitta kimyoviy element atomlaridan iborat (O₂ — faqat kislorod), murakkab modda esa turli elementlar atomlaridan tashkil topgan (H₂O — vodorod va kislorod).',
      en: 'A simple substance consists of atoms of one chemical element (O₂ — only oxygen), while a compound consists of atoms of different elements (H₂O — hydrogen and oxygen).',
    },
  },
  {
    topic: 'amphoteric',
    re: /((гидроксид\w* алюмин|al\(oh\)3|alyuminiy gidroksid|aluminium hydroxide|aluminum hydroxide).{0,60}(кислот.{0,20}щелоч|kislota.{0,30}ishqor|acid.{0,20}alkal)|амфотерн\w* .{0,20}почему)/u,
    text: {
      ru: 'Гидроксид алюминия Al(OH)₃ амфотерный: с кислотами он реагирует как основание (Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O), а со щелочами — как кислота (Al(OH)₃ + NaOH → Na[Al(OH)₄]).',
      uz: 'Alyuminiy gidroksid Al(OH)₃ amfoter: kislotalar bilan asos kabi (Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O), ishqorlar bilan esa kislota kabi reaksiyaga kirishadi (Al(OH)₃ + NaOH → Na[Al(OH)₄]).',
      en: 'Aluminium hydroxide Al(OH)₃ is amphoteric: with acids it reacts as a base (Al(OH)₃ + 3HCl → AlCl₃ + 3H₂O), and with alkalis as an acid (Al(OH)₃ + NaOH → Na[Al(OH)₄]).',
    },
  },
  {
    topic: 'water',
    re: /(универсальн\w* растворител|universal erituvchi|universal solvent)/u,
    text: {
      ru: 'Молекула воды полярная: на кислороде частичный отрицательный заряд, на водородах — положительный; полярные молекулы воды окружают ионы и полярные молекулы и отрывают их друг от друга, поэтому в воде растворяется очень много веществ.',
      uz: 'Suv molekulasi qutbli: kislorodda qisman manfiy, vodorodlarda musbat zaryad bor; qutbli suv molekulalari ionlar va qutbli molekulalarni oʻrab, ularni bir-biridan ajratadi, shuning uchun suvda juda koʻp moddalar eriydi.',
      en: 'A water molecule is polar: oxygen carries a partial negative charge and the hydrogens a partial positive one; polar water molecules surround ions and polar molecules and pull them apart, so a great many substances dissolve in water.',
    },
  },
  {
    topic: 'aluminium',
    re: /((алюмини|alyuminiy|alumini?um).{0,60}(не разруша|воздух|havoda|yemirilma|corrod|in air))/u,
    text: {
      ru: 'Алюминий на воздухе сразу покрывается тонкой прочной оксидной плёнкой Al₂O₃ (4Al + 3O₂ → 2Al₂O₃); плёнка не пропускает кислород и воду к металлу и защищает его от разрушения.',
      uz: 'Alyuminiy havoda darhol yupqa mustahkam oksid parda Al₂O₃ bilan qoplanadi (4Al + 3O₂ → 2Al₂O₃); bu parda kislorod va suvni metallga oʻtkazmaydi va uni yemirilishdan himoya qiladi.',
      en: 'In air aluminium is immediately covered by a thin, strong oxide film Al₂O₃ (4Al + 3O₂ → 2Al₂O₃); the film keeps oxygen and water away from the metal and protects it from corrosion.',
    },
  },
  {
    topic: 'corrosion',
    re: /(оцинкова|ruxlangan|galvani[sz]ed)/u,
    text: {
      ru: 'Цинк активнее железа: на оцинкованном железе цинк окисляется первым и отдаёт электроны, защищая железо (протекторная защита), а его оксидная плёнка закрывает поверхность от воды и кислорода.',
      uz: 'Rux temirdan faolroq: ruxlangan temirda birinchi boʻlib rux oksidlanadi va elektron berib, temirni himoya qiladi (protektor himoya), uning oksid pardasi esa sirtni suv va kisloroddan yopadi.',
      en: 'Zinc is more reactive than iron: on galvanized iron the zinc is oxidised first and gives up electrons, protecting the iron (sacrificial protection), and its oxide film shields the surface from water and oxygen.',
    },
  },
  {
    topic: 'iron',
    re: /((желез|temir|iron).{0,40}(ржаве|zangla|rust))/u,
    text: {
      ru: 'Железо ржавеет, потому что окисляется кислородом воздуха в присутствии воды (влаги): 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃; вода — электролит, без влаги и кислорода ржавчина почти не образуется.',
      uz: 'Temir zanglaydi, chunki havo kislorodi bilan suv (namlik) ishtirokida oksidlanadi: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃; suv — elektrolit, namlik va kislorodsiz zang deyarli hosil boʻlmaydi.',
      en: 'Iron rusts because it is oxidised by oxygen in the presence of water (moisture): 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃; water acts as an electrolyte, and without moisture and oxygen rust hardly forms.',
    },
  },
  {
    topic: 'nitrogen',
    re: /((азот|azot|nitrogen).{0,40}(малоактив|инертн|kam faol|unreactive|inert))/u,
    text: {
      ru: 'В молекуле N₂ атомы связаны очень прочной тройной связью N≡N (энергия около 946 кДж/моль); чтобы азот вступил в реакцию, её нужно разорвать, поэтому азот химически малоактивен.',
      uz: 'N₂ molekulasida atomlar juda mustahkam uchlamchi bogʻ N≡N bilan bogʻlangan (energiyasi taxminan 946 kJ/mol); azot reaksiyaga kirishishi uchun bu bogʻni uzish kerak, shuning uchun azot kimyoviy jihatdan kam faol.',
      en: 'In the N₂ molecule the atoms are joined by a very strong triple bond N≡N (about 946 kJ/mol); it must be broken for nitrogen to react, so nitrogen is chemically unreactive.',
    },
  },
  {
    topic: 'equilibrium',
    re: /((давлени|bosim|pressure).{0,60}(равновеси|muvozanat|equilibri))|((равновеси|muvozanat|equilibri).{0,60}(давлени|bosim|pressure))/u,
    text: {
      ru: 'По принципу Ле Шателье при повышении давления равновесие смещается в сторону, где меньше молей газов: так система уменьшает свой объём и ослабляет внешнее воздействие (N₂ + 3H₂ ⇄ 2NH₃: 4 моль газа → 2 моль).',
      uz: 'Le Shatelye prinsipiga koʻra bosim oshirilganda muvozanat gaz mollari kam tomonga siljiydi: shunda sistema hajmini kamaytiradi va tashqi taʼsirni susaytiradi (N₂ + 3H₂ ⇄ 2NH₃: 4 mol gaz → 2 mol).',
      en: 'By Le Chatelier’s principle, raising the pressure shifts the equilibrium towards fewer moles of gas: this lowers the volume of the system and weakens the outside change (N₂ + 3H₂ ⇄ 2NH₃: 4 mol of gas → 2 mol).',
    },
  },
  {
    topic: 'solutions',
    re: /((растворимост\w* газ|gazlarning .{0,20}eruvchanlig|solubility of gases|gas solubility).{0,60}(нагрев|qizdir|heat|температур|harorat))|((нагрев|qizdir|heat).{0,60}(растворимост\w* газ|gazlarning .{0,20}eruvchanlig|solubility of gases))/u,
    text: {
      ru: 'При нагревании молекулы газа движутся быстрее и легче покидают раствор, а растворение газов в воде идёт с выделением тепла — поэтому с ростом температуры растворимость газов уменьшается (тёплая вода содержит меньше кислорода).',
      uz: 'Qizdirilganda gaz molekulalari tezroq harakatlanadi va eritmani osonroq tark etadi, gazlarning suvda erishi esa issiqlik ajralishi bilan boradi — shuning uchun harorat ortishi bilan gazlarning eruvchanligi kamayadi (iliq suvda kislorod kamroq).',
      en: 'On heating, gas molecules move faster and escape from the solution more easily, and dissolving a gas in water releases heat — so the solubility of gases falls as the temperature rises (warm water holds less oxygen).',
    },
  },
  {
    topic: 'concentration',
    re: /((разбавл|suyultiril|dilut).{0,80}(масс|massa|mass))|((масс|massa|mass).{0,80}(разбавл|suyultiril|dilut))/u,
    text: {
      ru: 'При разбавлении к раствору добавляют только воду (растворитель): растворённое вещество не добавляется и не убирается, поэтому его масса не меняется, а массовая доля уменьшается, потому что растёт масса раствора.',
      uz: 'Suyultirishda eritmaga faqat suv (erituvchi) qoʻshiladi: erigan modda qoʻshilmaydi ham, olinmaydi ham, shuning uchun uning massasi oʻzgarmaydi, eritma massasi ortgani uchun esa massa ulushi kamayadi.',
      en: 'When a solution is diluted, only water (the solvent) is added: no solute is added or removed, so its mass stays the same, while the mass fraction falls because the mass of the solution grows.',
    },
  },
  {
    topic: 'gas-laws',
    re: /((объем\w* газ|gaz hajmi|volume of a gas|gas volume).{0,40}(нагрев|qizdir|heat))|((нагрев|qizdir|heat).{0,40}(объем\w* газ|gaz hajmi|volume of a gas|gas volume))/u,
    text: {
      ru: 'При нагревании растёт температура, молекулы газа движутся быстрее и сильнее ударяют о стенки, расстояния между ними увеличиваются — поэтому при постоянном давлении объём газа увеличивается (закон Гей-Люссака: V/T = const).',
      uz: 'Qizdirilganda harorat ortadi, gaz molekulalari tezroq harakatlanadi va devorlarga kuchliroq uriladi, ular orasidagi masofa ortadi — shuning uchun oʻzgarmas bosimda gaz hajmi ortadi (Gey-Lyussak qonuni: V/T = const).',
      en: 'On heating the temperature rises, gas molecules move faster and hit the walls harder, and the distances between them grow — so at constant pressure the volume of a gas increases (Gay-Lussac’s law: V/T = const).',
    },
  },
  {
    topic: 'organic-general',
    re: /((органическ\w* вещест.{0,40}больше)|(organik moddalar .{0,40}ko'p)|(more organic compounds|organic compounds than inorganic))/u,
    text: {
      ru: 'Атомы углерода четырёхвалентны и прочно соединяются друг с другом в длинные цепи — прямые, разветвлённые и кольца, с одинарными, двойными и тройными связями; к тому же одинаковый состав даёт разные изомеры — поэтому органических веществ так много.',
      uz: 'Uglerod atomlari toʻrt valentli va bir-biri bilan mustahkam bogʻlanib uzun zanjirlar — toʻgʻri, tarmoqlangan va halqali, oddiy, qoʻsh va uchlamchi bogʻli zanjirlar hosil qiladi; buning ustiga bir xil tarkib turli izomerlarni beradi — shuning uchun organik moddalar juda koʻp.',
      en: 'Carbon atoms are tetravalent and bond strongly to each other into long chains — straight, branched and rings, with single, double and triple bonds; besides, one composition can give different isomers — that is why there are so many organic compounds.',
    },
  },
  {
    topic: 'structure-theory',
    re: /((одинаков\w* состав.{0,40}разн\w* свойств)|(tarkibi bir xil .{0,40}har xil xossa)|(same composition .{0,40}different properties))/u,
    text: {
      ru: 'По теории химического строения Бутлерова свойства вещества зависят не только от состава, но и от строения — порядка соединения атомов в молекуле; вещества с одинаковым составом и разным строением — изомеры, и свойства у них разные.',
      uz: 'Butlerovning kimyoviy tuzilish nazariyasiga koʻra moddaning xossalari faqat tarkibiga emas, balki tuzilishiga — molekulada atomlarning birikish tartibiga ham bogʻliq; tarkibi bir xil, tuzilishi har xil moddalar — izomerlar, ularning xossalari ham har xil.',
      en: 'According to Butlerov’s theory of chemical structure, properties depend not only on composition but also on structure — the order in which atoms are joined; substances with the same composition and different structure are isomers, and their properties differ.',
    },
  },
  {
    topic: 'isomerism',
    re: /((бутан.{0,10}изобутан)|(butan va izobutan)|(butane and isobutane)|изомер\w* .{0,20}разн)/u,
    text: {
      ru: 'Бутан и изобутан — изомеры: состав одинаковый (C₄H₁₀), а строение разное — у бутана прямая цепь из четырёх атомов углерода, у изобутана цепь разветвлённая; разное строение даёт разные свойства (tкип −0,5 °C и −11,7 °C).',
      uz: 'Butan va izobutan — izomerlar: tarkibi bir xil (C₄H₁₀), tuzilishi esa har xil — butanda toʻrtta uglerod atomidan toʻgʻri zanjir, izobutanda tarmoqlangan zanjir; tuzilish har xil boʻlgani uchun xossalari ham har xil (qaynash harorati −0,5 °C va −11,7 °C).',
      en: 'Butane and isobutane are isomers: the composition is the same (C₄H₁₀) but the structure differs — butane has a straight chain of four carbon atoms, isobutane a branched one; different structure gives different properties (b.p. −0.5 °C and −11.7 °C).',
    },
  },
  {
    topic: 'alkanes',
    re: /((алкан\w* .{0,30}предельн)|(alkanlar .{0,30}to'yingan)|(alkanes .{0,30}saturated))/u,
    text: {
      ru: 'В молекулах алканов все связи между атомами углерода одинарные, и каждый атом углерода насыщен атомами водорода до предела (CₙH₂ₙ₊₂) — присоединять больше нечего, поэтому их называют предельными (насыщенными).',
      uz: 'Alkanlar molekulalarida uglerod atomlari orasidagi barcha bogʻlar oddiy bogʻlar, har bir uglerod atomi vodorod atomlari bilan toʻla toʻyingan (CₙH₂ₙ₊₂) — boshqa biriktiradigan narsa yoʻq, shuning uchun ular toʻyingan uglevodorodlar deyiladi.',
      en: 'In alkane molecules all carbon–carbon bonds are single, and each carbon atom holds the maximum number of hydrogen atoms (CₙH₂ₙ₊₂) — nothing more can be added, so they are called saturated hydrocarbons.',
    },
  },
  {
    topic: 'alkenes',
    re: /((этилен|алкен|etilen|alken|ethene|ethylene|alkene).{0,40}(бромн\w* вод|brom suv|bromine water))/u,
    text: {
      ru: 'В молекуле этилена есть двойная связь C=C; бром присоединяется по месту её разрыва (CH₂=CH₂ + Br₂ → CH₂Br–CH₂Br), бурый бром расходуется — бромная вода обесцвечивается. Это качественная реакция на кратную связь.',
      uz: 'Etilen molekulasida qoʻsh bogʻ C=C bor; brom uning uzilish joyiga birikadi (CH₂=CH₂ + Br₂ → CH₂Br–CH₂Br), qoʻngʻir brom sarflanadi — brom suvi rangsizlanadi. Bu karrali bogʻga sifat reaksiyasi.',
      en: 'Ethene has a C=C double bond; bromine adds across it (CH₂=CH₂ + Br₂ → CH₂Br–CH₂Br), the brown bromine is used up and the bromine water is decolourised — an addition reaction that tests for a multiple bond.',
    },
  },
  {
    topic: 'alkynes',
    re: /((ацетилен|atsetilen|acetylene).{0,40}(копт|qurum|soot|smok))/u,
    text: {
      ru: 'В ацетилене C₂H₂ очень высокая массовая доля углерода (около 92 %); кислорода воздуха не хватает, чтобы сжечь весь углерод до CO₂, и часть его выделяется в виде сажи — пламя коптящее.',
      uz: 'Atsetilen C₂H₂ da uglerodning massa ulushi juda yuqori (taxminan 92 %); havo kislorodi butun uglerodni CO₂ gacha yoqishga yetmaydi va uning bir qismi qurum boʻlib ajraladi — alanga qurumli boʻladi.',
      en: 'Acetylene C₂H₂ has a very high mass fraction of carbon (about 92 %); the oxygen of the air is not enough to burn all the carbon to CO₂, and part of it is released as soot — the flame is sooty.',
    },
  },
  {
    topic: 'carboxylic-acids',
    re: /((уксусн\w* кислот|sirka kislota|acetic acid).{0,30}(слаб|kuchsiz|weak))/u,
    text: {
      ru: 'Уксусная кислота в воде диссоциирует частично: лишь малая часть молекул CH₃COOH отдаёт ион H⁺ (CH₃COOH ⇄ CH₃COO⁻ + H⁺), равновесие сильно смещено влево — поэтому она слабая кислота.',
      uz: 'Sirka kislota suvda qisman dissotsilanadi: CH₃COOH molekulalarining faqat kichik qismi H⁺ ionini beradi (CH₃COOH ⇄ CH₃COO⁻ + H⁺), muvozanat chapga kuchli siljigan — shuning uchun u kuchsiz kislota.',
      en: 'Acetic acid dissociates only partially in water: just a small fraction of CH₃COOH molecules release H⁺ (CH₃COOH ⇄ CH₃COO⁻ + H⁺), the equilibrium lies far to the left — so it is a weak acid.',
    },
  },
  {
    topic: 'esters-fats',
    re: /((жидк\w* .{0,30}масл.{0,40}тверд)|(suyuq .{0,30}moy.{0,40}qattiq)|(liquid .{0,30}oils? .{0,40}solid))/u,
    text: {
      ru: 'Жидкие растительные масла содержат остатки непредельных кислот с двойными связями C=C; при гидрировании (присоединении водорода H₂ на никелевом катализаторе) двойные связи становятся одинарными, и масло превращается в твёрдый жир (маргарин).',
      uz: 'Suyuq oʻsimlik moylarida qoʻsh bogʻli C=C toʻyinmagan kislotalar qoldiqlari bor; gidrogenlashda (nikel katalizatorida vodorod H₂ biriktirilganda) qoʻsh bogʻlar oddiy bogʻga aylanadi va moy qattiq yogʻga (margarin) aylanadi.',
      en: 'Liquid vegetable oils contain residues of unsaturated acids with C=C double bonds; on hydrogenation (adding hydrogen H₂ over a nickel catalyst) the double bonds become single and the oil turns into a solid fat (margarine).',
    },
  },
  {
    topic: 'carbohydrates',
    re: /(альдегидоспирт|aldegidospirt|aldehyde alcohol)/u,
    text: {
      ru: 'В молекуле глюкозы C₆H₁₂O₆ есть альдегидная группа –CHO и пять гидроксильных групп –OH: она даёт реакции и альдегидов (серебряное зеркало), и многоатомных спиртов (синий раствор с Cu(OH)₂) — поэтому её называют альдегидоспиртом.',
      uz: 'Glyukoza C₆H₁₂O₆ molekulasida aldegid guruhi –CHO va beshta gidroksil guruhi –OH bor: u aldegidlar (kumush koʻzgu) va koʻp atomli spirtlar (Cu(OH)₂ bilan koʻk eritma) reaksiyalarini beradi — shuning uchun aldegidospirt deyiladi.',
      en: 'A glucose molecule C₆H₁₂O₆ has an aldehyde group –CHO and five hydroxyl groups –OH: it gives the reactions of both aldehydes (silver mirror) and polyhydric alcohols (blue solution with Cu(OH)₂) — so it is called an aldehyde alcohol.',
    },
  },
  {
    topic: 'salts',
    re: /((поваренн\w* сол|osh tuzi|table salt).{0,40}(ток|tok|electric))/u,
    text: {
      ru: 'В воде поваренная соль диссоциирует на ионы: NaCl → Na⁺ + Cl⁻; заряженные ионы свободно движутся в растворе и переносят электрический заряд, поэтому раствор проводит ток.',
      uz: 'Suvda osh tuzi ionlarga dissotsilanadi: NaCl → Na⁺ + Cl⁻; zaryadlangan ionlar eritmada erkin harakatlanib, elektr zaryadini tashiydi, shuning uchun eritma tok oʻtkazadi.',
      en: 'In water table salt dissociates into ions: NaCl → Na⁺ + Cl⁻; the charged ions move freely in the solution and carry electric charge, so the solution conducts electricity.',
    },
  },
  {
    topic: 'electrolytic-dissociation',
    re: /((сахар|shakar|sugar).{0,60}(ток|tok|conduct|electric))/u,
    text: {
      ru: 'Соль — электролит: в воде она распадается на ионы (NaCl → Na⁺ + Cl⁻), и ионы переносят заряд; сахар — неэлектролит: его молекулы с ковалентными связями в растворе остаются целыми и ионов не образуют, поэтому ток не проводят.',
      uz: 'Tuz — elektrolit: suvda ionlarga ajraladi (NaCl → Na⁺ + Cl⁻) va ionlar zaryadni tashiydi; shakar — noelektrolit: kovalent bogʻli molekulalari eritmada butunligicha qoladi va ion hosil qilmaydi, shuning uchun tok oʻtkazmaydi.',
      en: 'Salt is an electrolyte: in water it splits into ions (NaCl → Na⁺ + Cl⁻), and the ions carry charge; sugar is a non-electrolyte: its covalent molecules stay whole in solution and form no ions, so it does not conduct.',
    },
  },
  {
    topic: 'redox',
    re: /((окислител\w* .{0,30}восстанавлива)|(oksidlovchi .{0,30}qaytariladi)|(oxidi[sz]ing agent .{0,30}reduced))/u,
    text: {
      ru: 'Окислитель принимает электроны от восстановителя; принятие электронов — это восстановление (степень окисления понижается), поэтому окислитель в реакции восстанавливается, а восстановитель окисляется.',
      uz: 'Oksidlovchi qaytaruvchidan elektron qabul qiladi; elektron qabul qilish — qaytarilish (oksidlanish darajasi pasayadi), shuning uchun reaksiyada oksidlovchi qaytariladi, qaytaruvchi esa oksidlanadi.',
      en: 'The oxidizing agent accepts electrons from the reducing agent; gaining electrons is reduction (the oxidation state falls), so the oxidizing agent is reduced while the reducing agent is oxidised.',
    },
  },
]

/** Причина «почему» по правилам (вопрос на любом из трёх языков); null — правила нет. */
export function whyRuleFor(text: string): WhyRule | null {
  const t = whyForm(text)
  return WHY_RULES.find((r) => r.re.test(t)) ?? null
}

/**
 * § класса ученика с темой правила (topics карты); несколько — лучший по термам вопроса, затем раньше в книге.
 * null — темы нет в книге этого класса (тогда § выбирают как раньше).
 */
export function whyUnitFor(map: CurriculumMap, rule: WhyRule, terms: Set<string>, grade: number | null): Unit | null {
  if (grade == null) return null
  const units = (map.byGrade.get(grade) ?? []).filter((u) => u.kind !== 'review' && u.topics.includes(rule.topic))
  if (!units.length) return null
  const score = new Map(map.unitsForQuery(terms, grade).map((x) => [x.unit.id, x.score]))
  return [...units].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))[0] ?? null
}
