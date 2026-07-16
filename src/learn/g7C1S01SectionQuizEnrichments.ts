/** §1 «Химия и её задачи» — развёрнутые описания и визуалы к каждому вопросу (Kimyo 7). */
export type SectionQuizEnrichment = {
  visualId: string
  description: string
  explanation: string
  caption: string
  alt: string
  imagePrompt: string
  descriptionEn?: string
  descriptionUz?: string
  explanationEn?: string
  explanationUz?: string
  captionEn?: string
  captionUz?: string
}

const PHOTO =
  'Photorealistic educational photograph for Russian school chemistry textbook grade 7, 16:9 landscape, bright modern classroom or museum exhibit, sharp focus, soft natural lighting, no text overlay, no watermark, scientifically accurate'

const PHOTO_SCHOLAR =
  'Photorealistic historical portrait for Russian school chemistry textbook grade 7, 16:9 landscape, Islamic Golden Age scholar in traditional robes and turban, warm candlelit library laboratory, sharp focus on face, detailed realistic facial features clearly visible (eyes nose mouth beard), dignified expression, no text overlay, no watermark, scientifically accurate setting with alembic manuscripts and instruments'

export const G7_C1_S01_SECTION_ENRICHMENTS: Record<string, SectionQuizEnrichment> = {
  'g7-c1-s01-q01': {
    visualId: 'g7-c1-s01-q01',
    explanation: 'Химия изучает состав, строение, свойства и изменения веществ.',
    explanationEn: 'Chemistry studies the composition, structure, properties, and changes of substances.',
    explanationUz: 'Kimyo moddalarning tarkibi, tuzilishi, xossalari va o‘zgarishlarini o‘rganadi.',
    caption: 'Химия как наука о веществах',
    captionEn: 'Chemistry as the science of substances',
    captionUz: 'Kimyo — moddalar haqidagi fan',
    alt: 'Лаборатория: модели молекул и периодическая таблица',
    imagePrompt: `${PHOTO}. Topic: chemistry as science studying substances. Show periodic table fragment, molecular ball-and-stick models (H2O, CO2), laboratory glassware on desk, open textbook, symbolic study of matter composition and properties.`,
    description:
      'Что изучает химия?\n\n' +
      'По учебнику Kimyo (7 класс), наука химия исследует состав, строение, свойства и изменения веществ, а также явления и процессы, которые происходят при этих изменениях. Химия отвечает не только на вопрос «из чего состоит?», но и «как устроены частицы?», «какие свойства у вещества?» и «во что оно может превратиться?».\n\n' +
      'Примеры из жизни: горение дров, ржавление железа, фотосинтез у растений, приготовление лекарств, получение пластмасс и стекла — всё это химические процессы или их результаты. Химия не сводится к запоминанию названий приборов или описанию цвета и запаха: важны формула, состав и уравнение реакции.\n\n' +
      'Запомните: химия — экспериментальная наука. Утверждения проверяются опытом: наблюдением, измерением, лабораторной работой. Без опытов нельзя понять, почему одни вещества реагируют, а другие — нет.\n\n' +
      'Связь с курсом: дальше вы изучите, что вещество состоит из атомов и молекул (118 типов атомов — столько элементов в таблице Менделеева), и научитесь различать физические и химические явления.',
    descriptionEn:
      'What does chemistry study?\n\n' +
      'According to the Kimyo textbook (grade 7), chemistry investigates the composition, structure, properties, and changes of substances, as well as the phenomena and processes that occur during those changes. Chemistry answers not only “what is it made of?” but also “how are the particles arranged?”, “what properties does the substance have?”, and “what can it turn into?”.\n\n' +
      'Everyday examples: burning wood, rusting iron, photosynthesis in plants, making medicines, producing plastics and glass — all are chemical processes or their results. Chemistry is not just memorizing apparatus names or describing color and smell: formula, composition, and reaction equations matter.\n\n' +
      'Remember: chemistry is an experimental science. Claims are checked by observation, measurement, and lab work. Without experiments you cannot understand why some substances react and others do not.\n\n' +
      'Next in the course: substances are made of atoms and molecules (118 atom types — the elements of the periodic table), and you will learn to tell physical from chemical changes.',
    descriptionUz:
      'Kimyo nimani o‘rganadi?\n\n' +
      'Kimyo darsligi (7-sinf) bo‘yicha kimyo fani moddalarning tarkibi, tuzilishi, xossalari va o‘zgarishlarini, shuningdek bu o‘zgarishlarda sodir bo‘ladigan hodisa va jarayonlarni o‘rganadi. Kimyo nafaqat «nimadan iborat?» savoliga, balki «zarralar qanday tuzilgan?», «moddaning qanday xossalari bor?» va «u nimaga aylanishi mumkin?» savollariga ham javob beradi.\n\n' +
      'Hayotdan misollar: o‘tin yonishi, temir zanglashi, o‘simliklarda fotosintez, dori tayyorlash, plastmassa va shisha olish — bularning hammasi kimyoviy jarayonlar yoki ularning natijasi. Kimyo faqat asbob nomlarini yodlash yoki rang va hidni tasvirlash emas: formula, tarkib va reaksiya tenglamasi muhim.\n\n' +
      'Eslab qoling: kimyo — tajribaviy fan. Gaplar kuzatish, o‘lchash va laboratoriya ishi bilan tekshiriladi. Tajribasiz ba’zi moddalar nima uchun reaksiyaga kirishadi, boshqalari esa yo‘qligini tushunib bo‘lmaydi.\n\n' +
      'Kursda keyin: modda atom va molekulalardan iborat (118 xil atom — Mendeleyev jadvalidagi elementlar), fizik va kimyoviy hodisalarni ajratishni o‘rganasiz.',
  },
  'g7-c1-s01-q02': {
    visualId: 'g7-c1-s01-q02',
    explanation: 'Задача химии — полезные вещества и энергия химических превращений.',
    explanationEn: 'Chemistry’s task is useful substances and the energy of chemical changes.',
    explanationUz: 'Kimyoning vazifasi — foydali moddalar va kimyoviy o‘zgarishlar energiyasi.',
    caption: 'Задачи химии: материалы и энергия',
    captionEn: 'Goals of chemistry: materials and energy',
    captionUz: 'Kimyo vazifalari: materiallar va energiya',
    alt: 'Химическая промышленность и источники энергии',
    imagePrompt: `${PHOTO}. Topic: goals of chemistry — useful materials and chemical energy. Show modern chemical plant pipes safely stylized, batteries, pharmaceutical pills, polymer pellets, solar panel and fuel concept, no logos.`,
    description:
      'Главная задача химии — по учебнику — получение веществ или материалов с полезными свойствами и использование энергии, запасаемой химическими веществами и высвобождаемой в процессе химических превращений.\n\n' +
      'Полезные вещества и материалы: лекарства, удобрения, краски, клеи, топливо, пластмассы, стекло, металлы, моющие средства — всё это продукты химии и химической промышленности. Химики подбирают состав так, чтобы материал был прочным, безопасным, долговечным или, наоборот, быстро разлагался (например, биоразлагаемая упаковка).\n\n' +
      'Энергия превращений: при реакциях может выделяться тепло (горение газа на плите, работа мышц) или поглощаться (некоторые растворения). Батарейки и аккумуляторы хранят химическую энергию и превращают её в электрическую.\n\n' +
      'Важно: химия — не «золотая алхимия» и не простое запоминание формул. Это наука, которая создаёт то, что нужно человеку, и объясняет, откуда берётся энергия в природе и технике.',
    descriptionEn:
      'According to the textbook, the main task of chemistry is to obtain substances or materials with useful properties and to use the energy stored in chemicals and released in chemical transformations.\n\n' +
      'Useful substances and materials: medicines, fertilizers, paints, glues, fuels, plastics, glass, metals, detergents — all products of chemistry and the chemical industry. Chemists design composition so a material is strong, safe, durable — or, conversely, breaks down quickly (e.g. biodegradable packaging).\n\n' +
      'Energy of changes: reactions may release heat (gas burning on a stove, muscle work) or absorb it (some dissolutions). Batteries store chemical energy and convert it to electricity.\n\n' +
      'Important: chemistry is not “gold alchemy” and not mere formula memorization. It creates what people need and explains where energy comes from in nature and technology.',
    descriptionUz:
      'Darslikka ko‘ra, kimyoning asosiy vazifasi — foydali xossalarga ega modda yoki materiallar olish va kimyoviy moddalarda saqlangan, kimyoviy o‘zgarishlarda ajraladigan energiyadan foydalanish.\n\n' +
      'Foydali modda va materiallar: dorilar, o‘g‘itlar, bo‘yoqlar, yelimlar, yoqilg‘i, plastmassalar, shisha, metallar, yuvish vositalari — bularning hammasi kimyo va kimyo sanoati mahsuloti. Kimyogarlar tarkibni material mustahkam, xavfsiz, chidamli yoki aksincha tez parchalanadigan qilib tanlaydi (masalan, biologik parchalanadigan qadoq).\n\n' +
      'O‘zgarishlar energiyasi: reaksiyalarda issiqlik ajralishi (gaz plitada yonishi, mushak ishi) yoki yutilishi mumkin (ba’zi erishlar). Batareyalar kimyoviy energiyani saqlaydi va elektrga aylantiradi.\n\n' +
      'Muhim: kimyo «oltin alkimyosi» emas va faqat formulalarni yodlash emas. Bu inson uchun kerakli narsalarni yaratadigan va tabiatda hamda texnikada energiya qayerdan kelishini tushuntiradigan fan.',
  },
  'g7-c1-s01-q03': {
    visualId: 'g7-c1-s01-q03',
    explanation: 'Вещество — частицы с определённым химическим составом.',
    explanationEn: 'A substance is particles with a definite chemical composition.',
    explanationUz: 'Modda — aniq kimyoviy tarkibga ega zarralar birikmasi.',
    caption: 'Понятие «вещество»',
    captionEn: 'The idea of a “substance”',
    captionUz: '«Modda» tushunchasi',
    alt: 'Модели атомов и молекул чистого вещества',
    imagePrompt: `${PHOTO}. Topic: pure substance definition. Macroscopic pure water in beaker and salt crystals beside molecular model of H2O and ionic lattice hint, clean educational setup.`,
    description:
      'Вещество — это объединение частиц с определённым химическим составом. Частицы могут быть атомами, молекулами или ионами — об этом вы узнаете на уроках физики и дальше в курсе химии.\n\n' +
      'Ключ: состав постоянен. Чистая вода всегда H₂O; поваренная соль — NaCl. Если доли компонентов можно менять произвольно — это смесь, а не одно вещество.\n\n' +
      'Не путайте вещество с предметом: стакан — предмет определённой формы; стекло, из которого он сделан — вещество. Цвет и размер сами по себе не определяют химический состав.\n\n' +
      'Для теста выбирайте формулировку про частицы и определённый состав — так пишет учебник.',
    descriptionEn:
      'A substance is a collection of particles with a definite chemical composition. Particles may be atoms, molecules, or ions — you will learn more in physics and later chemistry lessons.\n\n' +
      'Key point: composition is constant. Pure water is always H₂O; table salt is NaCl. If component ratios can change freely, it is a mixture, not one substance.\n\n' +
      'Do not confuse a substance with an object: a glass is an object of a certain shape; the glass material is the substance. Color and size alone do not define chemical composition.\n\n' +
      'For the test, pick the wording about particles and definite composition — that is how the textbook puts it.',
    descriptionUz:
      'Modda — aniq kimyoviy tarkibga ega zarralar birikmasi. Zarralar atom, molekula yoki ion bo‘lishi mumkin — buni fizika va keyingi kimyo darslarida o‘rganasiz.\n\n' +
      'Asosiy: tarkib doimiy. Sof suv har doim H₂O; osh tuzi — NaCl. Agar komponentlar ulushi erkin o‘zgarsa — bu aralashma, bitta modda emas.\n\n' +
      'Moddani buyum bilan aralashtirmang: stakan — ma’lum shakldagi buyum; undan yasalgan shisha — modda. Rang va o‘lchamning o‘zi kimyoviy tarkibni belgilamaydi.\n\n' +
      'Testda zarralar va aniq tarkib haqidagi ifodani tanlang — darslik shunday yozadi.',
  },
  'g7-c1-s01-q04': {
    visualId: 'g7-c1-s01-q04',
    explanation: 'Эпоха алхимии — с III в. до н.э. по XVII в.',
    explanationEn: 'The alchemy era is from the 3rd century BCE to the 17th century CE.',
    explanationUz: 'Alkimyo davri — miloddan avvalgi III asrdan milodiy XVII asrgacha.',
    caption: 'Эпоха алхимии',
    captionEn: 'The age of alchemy',
    captionUz: 'Alkimyo davri',
    alt: 'Историческая алхимическая лаборатория',
    imagePrompt: `${PHOTO}. Topic: alchemy historical period III century BC to XVII century AD. Medieval alchemy workshop with alembic distillation apparatus, old manuscripts, crucible, dim warm candlelight, museum diorama style, no people.`,
    description:
      'Эпохи развития химии (по учебнику):\n\n' +
      '1. Доалхимическая — до III века до н.э.: ремесло и практические навыки (стеклоделие, выплавка металлов) развивались отдельно от теории.\n\n' +
      '2. Алхимия — с III века до н.э. по XVII век н.э. Алхимики искали философский камень, эликсир долголетия, универсальный растворитель (алкагест) и пытались превратить дешёвые металлы в золото. Многие опыты дали полезные приёмы (перегонка, тигли, реактивы), но цели «философского камня» наука не подтвердила.\n\n' +
      '3. Зарождение научной химии (XVI–XVIII вв.) — Бойль, Лавуазье и др.\n\n' +
      '4. Открытие законов (1789–1860) — Дальтон, Авогадро, Берцелиус.\n\n' +
      '5. Классическая химия (1860 — конец XIX в.) — периодическая таблица, валентность, термодинамика.\n\n' +
      '6. Современная эпоха (XX–XXI вв.) — белки, ДНК, наноматериалы.\n\n' +
      'Критика алхимии: Ибн Сина и другие учёные указывали, что нельзя превратить один металл в другой простым «заклинанием» рецепта — нужны реальные химические процессы, которые тогда были неизвестны.',
    descriptionEn:
      'Stages of chemistry (textbook):\n\n' +
      '1. Pre-alchemy — before the 3rd century BCE: crafts (glassmaking, metal smelting) grew apart from theory.\n\n' +
      '2. Alchemy — from the 3rd century BCE to the 17th century CE. Alchemists sought the philosopher’s stone, an elixir of longevity, a universal solvent (alkahest), and tried to turn cheap metals into gold. Many experiments produced useful techniques (distillation, crucibles, reagents), but science did not confirm the “philosopher’s stone” goals.\n\n' +
      '3. Birth of scientific chemistry (16th–18th centuries) — Boyle, Lavoisier, and others.\n\n' +
      '4. Discovery of laws (1789–1860) — Dalton, Avogadro, Berzelius.\n\n' +
      '5. Classical chemistry (1860–late 19th century) — periodic table, valence, thermodynamics.\n\n' +
      '6. Modern era (20th–21st centuries) — proteins, DNA, nanomaterials.\n\n' +
      'Critique of alchemy: Ibn Sina and others noted you cannot turn one metal into another with a mere recipe “spell” — real chemical processes were needed, and they were unknown then.',
    descriptionUz:
      'Kimyo rivojlanish davrlari (darslik bo‘yicha):\n\n' +
      '1. Alkimyodan oldin — miloddan avvalgi III asrgacha: hunarmandchilik (shisha, metall eritish) nazariyadan alohida rivojlandi.\n\n' +
      '2. Alkimyo — miloddan avvalgi III asrdan milodiy XVII asrgacha. Alkimyogarlar falsafiy tosh, uzoq umr eliksiri, universal erituvchi (alkagest) izladilar va arzon metallarni oltinga aylantirishga urindilar. Ko‘p tajribalar foydali usullar berdi (haydash, tigel, reaktivlar), lekin «falsafiy tosh» maqsadlarini fan tasdiqlamadi.\n\n' +
      '3. Ilmiy kimyoning paydo bo‘lishi (XVI–XVIII asrlar) — Boyl, Lavuazye va boshqalar.\n\n' +
      '4. Qonunlar ochilishi (1789–1860) — Dalton, Avogadro, Berselius.\n\n' +
      '5. Klassik kimyo (1860 — XIX asr oxiri) — davriy jadval, valentlik, termodinamika.\n\n' +
      '6. Zamonaviy davr (XX–XXI asrlar) — oqsillar, DNK, nanomateriallar.\n\n' +
      'Alkimyoga tanqid: Ibn Sino va boshqa olimlar bir metallni boshqasiga oddiy «retsept sehr» bilan aylantirib bo‘lmasligini aytgan — haqiqiy kimyoviy jarayonlar kerak edi, ular esa o‘sha paytda noma’lum edi.',
  },
  'g7-c1-s01-q05': {
    visualId: 'g7-c1-s01-q05',
    explanation: 'Аль-Кинди — первый критик алхимии среди учёных.',
    explanationEn: 'Al-Kindi was the first scholar to criticize alchemy.',
    explanationUz: 'Al-Kindiy — alkimyoni tanqid qilgan birinchi olim.',
    caption: 'Абу Юсуф аль-Кинди (800–870)',
    captionEn: 'Abu Yusuf al-Kindi (800–870)',
    captionUz: 'Abu Yusuf al-Kindiy (800–870)',
    alt: 'Восточный учёный и рукописи',
    imagePrompt: `${PHOTO_SCHOLAR}. Topic: Al-Kindi Arab philosopher scholar 9th century Baghdad. Middle-aged Arab scholar with white turban and brown robe studying Arabic manuscripts and alembic distillation apparatus, face in three-quarter view fully rendered with beard and thoughtful eyes, House of Wisdom library background.`,
    description:
      'Абу Юсуф ибн Исхак аль-Кинди (800–870) — арабский философ, математик, астроном и врач. Родился в Басре, работал в Багдаде при дворе халифов. Один из первых арабов-аристотеликов, основоположник восточного аристотелизма.\n\n' +
      'Вклад в химию: написал более 40 трактатов и комментариев к трудам Аристотеля, Евклида, Птолемея. В книгах «О фармакопее», «О химии благовоний и перегонки», «О различных видах мечей…» есть сведения о веществах, перегонке, сплавах. Труды переводились в Европе в Средние века.\n\n' +
      'Главное для теста: аль-Кинди — первый учёный, подвергший критике алхимию. Он требовал проверяемых доказательств, а не мистических рецептов превращения металлов в золото.\n\n' +
      'Академия Мамуна (Дом мудрости в Багдаде) — центр перевода и исследований, где восточные учёные сохранили и развили античную науку. Это наследие важно и сегодня: многие термины и методы пришли к нам через арабскую науку Средневековья.',
    descriptionEn:
      'Abu Yusuf ibn Ishaq al-Kindi (800–870) was an Arab philosopher, mathematician, astronomer, and physician. He was born in Basra and worked in Baghdad at the caliphs’ court. He was one of the first Arab Aristotelians and a founder of Eastern Aristotelianism.\n\n' +
      'Contribution to chemistry: he wrote more than 40 treatises and commentaries on Aristotle, Euclid, and Ptolemy. Books such as On Pharmacopoeia, On the Chemistry of Perfumes and Distillation, and On Various Kinds of Swords… contain information on substances, distillation, and alloys. His works were translated in Europe in the Middle Ages.\n\n' +
      'Key point for the test: al-Kindi was the first scientist to criticize alchemy. He demanded verifiable evidence, not mystical recipes for turning metals into gold.\n\n' +
      'The Academy of al-Ma’mun (the House of Wisdom in Baghdad) was a center of translation and research where Eastern scholars preserved and advanced ancient science. That heritage still matters: many terms and methods reached us through Arabic science of the Middle Ages.',
    descriptionUz:
      'Abu Yusuf ibn Ishoq al-Kindiy (800–870) — arab faylasufi, matematik, astronom va tabib. Basrada tug‘ilgan, Bag‘dodda xalifalar saroyida ishlagan. Birinchi arab-aristotelchilardan biri, sharq aristotelizmining asoschisi.\n\n' +
      'Kimyoga hissasi: Aristotel, Evklid, Ptolemey asarlariga 40 dan ortiq risolalar va sharhlar yozgan. «Farmakopeya haqida», «Xushbo‘y moddalar kimyosi va haydash haqida», «Qilichlarning turli turlari haqida…» kitoblarida moddalar, haydash, qotishmalar haqida ma’lumot bor. Asarlari O‘rta asrlarda Yevropada tarjima qilingan.\n\n' +
      'Test uchun asosiysi: al-Kindiy — alkimyoni tanqid qilgan birinchi olim. U metallarni oltinga aylantirishning mistik retseptlari emas, tekshiriladigan dalillarni talab qilgan.\n\n' +
      'Ma’mun akademiyasi (Bag‘doddagi Donishmandlik uyi) — tarjima va tadqiqot markazi bo‘lib, sharq olimlari antik fanni saqlagan va rivojlantirgan. Bu meros bugun ham muhim: ko‘p atama va usullar bizga O‘rta asr arab fani orqali kelgan.',
  },
  'g7-c1-s01-q06': {
    visualId: 'g7-c1-s01-q06',
    explanation: 'Ар-Рази разделил вещества на минеральные, растительные и животные.',
    explanationEn: 'Al-Razi classified substances as mineral, plant, and animal.',
    explanationUz: 'Ar-Roziy moddalarni mineral, o‘simlik va hayvon guruhlariga ajratgan.',
    caption: 'Ар-Рази и классификация веществ',
    captionEn: 'Al-Razi and substance classification',
    captionUz: 'Ar-Roziy va moddalar tasnifi',
    alt: 'Минералы, растения и образцы веществ',
    imagePrompt: `${PHOTO_SCHOLAR}. Topic: Al-Razi Persian physician chemist 10th century. Elderly bearded scholar in medieval Islamic attire examining mineral crystals dried herbs and animal specimens on laboratory table, face clearly visible with wise expression, classification of substances scene.`,
    description:
      'Абу Бакр Мухаммад ибн Закария ар-Рази (865–925), в Европе — Разес. Крупный врач и натуралист; всего написал 182 произведения, из них 22 по химии.\n\n' +
      'Главное достижение для школьного курса: ар-Рази впервые в истории химии разделил вещества на три группы:\n' +
      '• минеральные (камни, соли, металлы из недр);\n' +
      '• растительные (экстракты трав, смолы);\n' +
      '• животные (продукты организмов).\n\n' +
      'Эта классификация помогала систематизировать лекарства и реактивы. Позже появятся деления на неорганические и органические вещества, кислоты, основания, соли — но первый шаг к систематике сделан ар-Рази.\n\n' +
      'Не путайте: деление на твёрдое/жидкое/газ — это агрегатные состояния, а не классификация ар-Рази. Деление на металлы и неметаллы — по таблице элементов, это другой уровень.',
    descriptionEn:
      'Abu Bakr Muhammad ibn Zakariya al-Razi (865–925), known in Europe as Rhazes, was a major physician and naturalist; he wrote 182 works, 22 of them on chemistry.\n\n' +
      'Key achievement for school chemistry: al-Razi was the first in the history of chemistry to divide substances into three groups:\n' +
      '• mineral (rocks, salts, metals from the earth);\n' +
      '• plant (herb extracts, resins);\n' +
      '• animal (products of living organisms).\n\n' +
      'This classification helped organize medicines and reagents. Later came inorganic vs organic, acids, bases, and salts — but al-Razi took the first step toward systematics.\n\n' +
      'Do not confuse: solid/liquid/gas are states of matter, not al-Razi’s classes. Metals vs nonmetals come from the periodic table — another level.',
    descriptionUz:
      'Abu Bakr Muhammad ibn Zakariyo ar-Roziy (865–925), Yevropada — Razes. Yirik tabib va tabiatshunos; jami 182 asar yozgan, shundan 22 tasi kimyoga oid.\n\n' +
      'Maktab kursi uchun asosiy yutuq: ar-Roziy kimyo tarixida birinchi bo‘lib moddalarni uch guruhga ajratgan:\n' +
      '• mineral (toshlar, tuzlar, yer osti metallari);\n' +
      '• o‘simlik (o‘t ekstraktlari, smolalar);\n' +
      '• hayvon (organizmlar mahsulotlari).\n\n' +
      'Bu tasnif dorilar va reaktivlarni tartibga solishga yordam bergan. Keyinroq noorganik va organik, kislotalar, asoslar, tuzlar paydo bo‘ladi — lekin tizimlilikka birinchi qadamni ar-Roziy qo‘ygan.\n\n' +
      'Adashtirmang: qattiq/suyuq/gaz — agregat holatlar, ar-Roziy tasnifi emas. Metall va nommetall — elementlar jadvali bo‘yicha, bu boshqa daraja.',
  },
  'g7-c1-s01-q07': {
    visualId: 'g7-c1-s01-q07',
    explanation: 'Ибн Сина отрицал превращение одного металла в другой.',
    explanationEn: 'Ibn Sina rejected turning one metal into another.',
    explanationUz: 'Ibn Sino bir metallni boshqasiga aylantirishni inkor etgan.',
    caption: 'Ибн Сина (Авиценна) о металлах',
    captionEn: 'Ibn Sina (Avicenna) on metals',
    captionUz: 'Ibn Sino (Avisenna) metallar haqida',
    alt: 'Металлы и средневековая медицинская химия',
    imagePrompt: `${PHOTO_SCHOLAR}. Topic: Ibn Sina Avicenna 11th century physician philosopher. Distinguished Persian scholar with turban and robes holding copper and iron metal samples, mortar and scales on desk, face fully detailed with beard and calm intelligent expression, rejecting alchemy transmutation.`,
    description:
      'Абу Али ибн Сина (980–1037) — великий врач и философ, в Европе Авиценна. Использовал для лекарств многие неорганические вещества (серу, соль, медь, олово, железо и др.), а также растения.\n\n' +
      'Позиция по алхимии: Ибн Сина считал невозможным превращение одного металла в другой — он прямо говорил: «Я считаю это невозможным, потому что нет способов превратить один металл в другой». Это научная критика алхимических мифов о «философском камне».\n\n' +
      'Почему это важно: настоящая химия изучает реакции при известных условиях (температура, катализаторы, электролиз). Превращение свинца в золото «по рецепту» — псевдонаука. Современные ядерные реакции теоретически могут менять элементы, но это совсем другие процессы, недоступные средневековым алхимикам.\n\n' +
      'Запомните: критика алхимии со стороны Ибн Сины и аль-Кинди — шаг к научной химии, где утверждения проверяются опытом.',
    descriptionEn:
      'Abu Ali ibn Sina (980–1037) — a great physician and philosopher, known in Europe as Avicenna. He used many inorganic substances in medicines (sulfur, salt, copper, tin, iron, and others), as well as plants.\n\n' +
      'On alchemy: Ibn Sina considered it impossible to turn one metal into another — he said plainly: “I consider this impossible because there are no ways to transform one metal into another.” That is a scientific critique of alchemical myths about the “philosopher’s stone.”\n\n' +
      'Why it matters: real chemistry studies reactions under known conditions (temperature, catalysts, electrolysis). Turning lead into gold “by recipe” is pseudoscience. Modern nuclear reactions can in theory change elements, but those are totally different processes, unavailable to medieval alchemists.\n\n' +
      'Remember: criticism of alchemy by Ibn Sina and al-Kindi is a step toward scientific chemistry, where claims are tested by experiment.',
    descriptionUz:
      'Abu Ali ibn Sino (980–1037) — buyuk tabib va faylasuf, Yevropada Avisenna. Dorilar uchun ko‘p noorganik moddalardan (oltingugurt, tuz, mis, qalay, temir va boshqalar), shuningdek o‘simliklardan foydalangan.\n\n' +
      'Alkimyoga munosabat: Ibn Sino bir metallni boshqasiga aylantirishni imkonsiz deb bilgan — u to‘g‘ridan-to‘g‘ri aytgan: «Men buni imkonsiz deb bilaman, chunki bir metallni boshqasiga aylantirish usullari yo‘q». Bu «falsafiy tosh» haqidagi alkimyoviy afsonalarga ilmiy tanqid.\n\n' +
      'Nima uchun muhim: haqiqiy kimyo ma’lum sharoitlardagi (harorat, katalizatorlar, elektroliz) reaksiyalarni o‘rganadi. Qo‘rg‘oshinni «retsept bo‘yicha» oltinga aylantirish — soxta fan. Zamonaviy yadro reaksiyalari nazariy jihatdan elementlarni o‘zgartirishi mumkin, lekin bu o‘rta asr alkimyogarlariga ochiq bo‘lmagan butunlay boshqa jarayonlar.\n\n' +
      'Eslab qoling: Ibn Sino va al-Kindiyning alkimyoga tanqidi — gaplar tajriba bilan tekshiriladigan ilmiy kimyoga qadam.',
  },
  'g7-c1-s01-q08': {
    visualId: 'g7-c1-s01-q08',
    explanation: 'Две функции химии — полезные вещества и энергия превращений.',
    explanationEn: 'Two roles of chemistry: useful substances and energy of changes.',
    explanationUz: 'Kimyoning ikki vazifasi — foydali moddalar va o‘zgarishlar energiyasi.',
    caption: 'Роль химии в жизни',
    captionEn: 'Chemistry in everyday life',
    captionUz: 'Hayotda kimyoning o‘rni',
    alt: 'Химия в быту и природе',
    imagePrompt: `${PHOTO}. Topic: two functions of chemistry in daily life. Collage-style still life: clothing fiber, medicine bottle, plant growing, fireworks spark safely in glass jar, food and water, showing chemistry everywhere.`,
    description:
      'Химия выполняет две основные функции (учебник, §1):\n\n' +
      '1. Получение веществ и материалов с полезными свойствами — лекарства, ткани, краски, топливо, удобрения, строительные материалы, косметика, пищевые добавки (при ответственном использовании).\n\n' +
      '2. Использование энергии химических превращений — тепло при горении, работа батареек, питание организма (обмен веществ), рост растений (фотосинтез поглощает CO₂ и воду, выделяет кислород и накапливает энергию).\n\n' +
      'Химия вокруг нас: салюты — быстрые реакции; счастье и усталость — процессы в организме; дыхание — обмен газов; промышленность района — выпуск химической продукции. Без химии невозможно представить современную жизнь.\n\n' +
      'Направления науки (для ориентира): общая, неорганическая, органическая, физическая, аналитическая химия — у каждой свои задачи, но общая цель та же: понимать вещества и применять их на благо человека.\n\n' +
      'Итог: химия важна не только в лаборатории, но и в природе, медицине, технике и быту.',
    descriptionEn:
      'Chemistry has two main functions (textbook, §1):\n\n' +
      '1. Obtaining substances and materials with useful properties — medicines, fabrics, paints, fuels, fertilizers, building materials, cosmetics, food additives (when used responsibly).\n\n' +
      '2. Using the energy of chemical changes — heat from burning, battery work, body nutrition (metabolism), plant growth (photosynthesis takes in CO₂ and water, releases oxygen, and stores energy).\n\n' +
      'Chemistry around us: fireworks are fast reactions; mood and tiredness are body processes; breathing is gas exchange; local industry may produce chemical goods. Modern life is hard to imagine without chemistry.\n\n' +
      'Branches of the science (for orientation): general, inorganic, organic, physical, analytical chemistry — each has its own tasks, but the shared goal is to understand substances and use them for human good.\n\n' +
      'Bottom line: chemistry matters not only in the lab, but in nature, medicine, technology, and daily life.',
    descriptionUz:
      'Kimyo ikki asosiy vazifani bajaradi (darslik, §1):\n\n' +
      '1. Foydali xossalarga ega modda va materiallar olish — dorilar, matolar, bo‘yoqlar, yoqilg‘i, o‘g‘itlar, qurilish materiallari, kosmetika, oziq-ovqat qo‘shimchalari (mas’uliyatli foydalanishda).\n\n' +
      '2. Kimyoviy o‘zgarishlar energiyasidan foydalanish — yonishdagi issiqlik, batareya ishi, organizm ovqatlanishi (moddalar almashinuvi), o‘simlik o‘sishi (fotosintez CO₂ va suvni yutadi, kislorod chiqaradi va energiya to‘playdi).\n\n' +
      'Atrofimizdagi kimyo: salonlar — tez reaksiyalar; baxt va charchoq — organizmdagi jarayonlar; nafas olish — gazlar almashinuvi; tuman sanoati — kimyo mahsulotlari. Zamonaviy hayotni kimyosiz tasavvur qilib bo‘lmaydi.\n\n' +
      'Fan yo‘nalishlari (orientir uchun): umumiy, noorganik, organik, fizik, analitik kimyo — har birining o‘z vazifasi bor, lekin umumiy maqsad bir: moddalarni tushunish va inson manfaati uchun qo‘llash.\n\n' +
      'Xulosa: kimyo nafaqat laboratoriya, balki tabiat, tibbiyot, texnika va kundalik hayotda ham muhim.',
  },
}

export function getG7C1S01SectionEnrichment(key: string): SectionQuizEnrichment | null {
  return G7_C1_S01_SECTION_ENRICHMENTS[key] ?? null
}
