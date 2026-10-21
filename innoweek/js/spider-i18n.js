/* ATOMLAB · InnoWeek — тексты «паука» (схема-кластер на одном экране), ru / uz / en. */
(function () {
  var add = {
    ru: {
      "sp.kicker": "InnoWeek · Узбекистан",
      "sp.sub": "Виртуальная химическая лаборатория и ИИ-учитель для школ Узбекистана",
      "sp.prob": "Проблема",
      "sp.p1": "Нет реактивов и лаборатории",
      "sp.p2": "Опыты опасны и дороги",
      "sp.p3": "Атомов и электронов не видно",
      "sp.p4": "Один учитель на 30 учеников",
      "sp.hubTag": "Химия, которую видно",
      "sp.hubSub": "Kimyo 7–11 · oʻz · рус · eng",

      "sp.lab.t": "3D-лаборатория",
      "sp.lab.m": "10 опытов · VR",
      "sp.lab.1": "Пламя, пар, газ и осадок",
      "sp.lab.2": "15 задач как настоящий опыт",
      "sp.lab.3": "VR-очки (WebXR), мышь и пальцы",

      "sp.form.t": "Как образуется",
      "sp.form.m": "200 веществ",
      "sp.form.1": "Электроны переходят и делятся",
      "sp.form.2": "Электронные облака и энергия",
      "sp.form.3": "Кристаллические решётки",

      "sp.org.t": "Органика в 3D",
      "sp.org.m": "329 молекул",
      "sp.org.1": "Точная 3D-геометрия (RDKit)",
      "sp.org.2": "535 реакций синтеза по атомам",
      "sp.org.3": "Конструктор: собери молекулу",

      "sp.pt.t": "Таблица Менделеева",
      "sp.pt.m": "118 элементов",
      "sp.pt.1": "Настоящие фото 95 элементов",
      "sp.pt.2": "Применение в жизни",
      "sp.pt.3": "Масса и электроны в карточке",

      "sp.book.t": "Учебники Kimyo 7–11",
      "sp.book.m": "1 443 реакции в 3D",
      "sp.book.1": "99,7 % реакций учебников",
      "sp.book.2": "448 / 448 веществ в каталоге",
      "sp.book.3": "Учебник с панелью уравнений",

      "sp.ai.t": "ИИ-учитель",
      "sp.ai.m": "201/201 задача — верно",
      "sp.ai.1": "Ссылка на тему учебника",
      "sp.ai.2": "Голос: oʻzbek · рус · eng",
      "sp.ai.3": "Разбор фото задачи из тетради",

      "sp.art.t": "ИИ-художник",
      "sp.art.m": "картинка за 15 секунд",
      "sp.art.1": "Рисует по любому описанию",
      "sp.art.2": "Без ключа — для всех",
      "sp.art.3": "Проверка безопасности для детей",

      "sp.tools.t": "Учителю",
      "sp.tools.m": "план · тест · проверка",
      "sp.tools.1": "План урока по теме за минуту",
      "sp.tools.2": "Тест с ключами ответов",
      "sp.tools.3": "СОР/СОЧ из eMaktab — в Excel",

      "sp.tech.t": "Технологии",
      "sp.tech.m": "свой сервер RTX 5080",
      "sp.tech.1": "Gemma 4 · 12B + поиск bge-m3",
      "sp.tech.2": "Слух: GigaAM + Whisper",
      "sp.tech.3": "React · Three.js · WebXR",

      "sp.diff.t": "Чего нет у других",
      "sp.diff.m": "всё в одном",
      "sp.diff.1": "Строго по программе Kimyo",
      "sp.diff.2": "Числа сверяет калькулятор",
      "sp.diff.3": "ИИ говорит по-узбекски",

      "sp.road": "Дальше",
      "sp.r0": "Работает сейчас",
      "sp.r1": "0–3 мес · пилот в 5 школах",
      "sp.r2": "3–6 мес · ATOMLAB Box без интернета",
      "sp.r3": "6–12 мес · физика, биология, вся страна",
      "sp.hint": "Нажмите на ветку — откроется подробно",
      "sp.back": "Схема",
      "sp.qr": "Открыть ATOMLAB",
      "ui.mode": "Схема / слайды (M)",
      "pres.map": "Схема ATOMLAB («паук»)",
    },
    uz: {
      "sp.kicker": "InnoWeek · Oʻzbekiston",
      "sp.sub": "Oʻzbekiston maktablari uchun virtual kimyo laboratoriyasi va SI-oʻqituvchi",
      "sp.prob": "Muammo",
      "sp.p1": "Reaktiv va laboratoriya yoʻq",
      "sp.p2": "Tajribalar xavfli va qimmat",
      "sp.p3": "Atom va elektronlar koʻrinmaydi",
      "sp.p4": "30 oʻquvchiga bitta oʻqituvchi",
      "sp.hubTag": "Koʻrinadigan kimyo",
      "sp.hubSub": "Kimyo 7–11 · oʻz · рус · eng",

      "sp.lab.t": "3D laboratoriya",
      "sp.lab.m": "10 tajriba · VR",
      "sp.lab.1": "Olov, bugʻ, gaz va choʻkma",
      "sp.lab.2": "15 ta masala — haqiqiy tajriba",
      "sp.lab.3": "VR koʻzoynak (WebXR) va barmoq",

      "sp.form.t": "Qanday hosil boʻladi",
      "sp.form.m": "200 ta modda",
      "sp.form.1": "Elektronlar oʻtadi va juftlashadi",
      "sp.form.2": "Elektron bulutlari va energiya",
      "sp.form.3": "Kristall panjaralar",

      "sp.org.t": "Organika 3D’da",
      "sp.org.m": "329 ta molekula",
      "sp.org.1": "Aniq 3D geometriya (RDKit)",
      "sp.org.2": "535 ta sintez — atomma-atom",
      "sp.org.3": "Konstruktor: molekulani yigʻ",

      "sp.pt.t": "Mendeleyev jadvali",
      "sp.pt.m": "118 ta element",
      "sp.pt.1": "95 ta elementning haqiqiy fotosi",
      "sp.pt.2": "Hayotda qoʻllanilishi",
      "sp.pt.3": "Massa va elektronlar kartochkada",

      "sp.book.t": "Darsliklar Kimyo 7–11",
      "sp.book.m": "1 443 reaksiya 3D’da",
      "sp.book.1": "Darslik reaksiyalarining 99,7 %",
      "sp.book.2": "448 / 448 modda katalogda",
      "sp.book.3": "Tenglamalar paneli bilan darslik",

      "sp.ai.t": "SI-oʻqituvchi",
      "sp.ai.m": "201/201 masala — toʻgʻri",
      "sp.ai.1": "Darslik mavzusiga havola",
      "sp.ai.2": "Ovoz: oʻzbek · rus · ingliz",
      "sp.ai.3": "Masala fotosini tahlil qiladi",

      "sp.art.t": "SI-rassom",
      "sp.art.m": "15 soniyada rasm",
      "sp.art.1": "Istalgan tavsif boʻyicha chizadi",
      "sp.art.2": "Kalitsiz — hamma uchun",
      "sp.art.3": "Bolalar uchun xavfsiz",

      "sp.tools.t": "Oʻqituvchiga",
      "sp.tools.m": "reja · test · tekshiruv",
      "sp.tools.1": "Bir daqiqada dars rejasi",
      "sp.tools.2": "Javob kalitli test",
      "sp.tools.3": "eMaktab’dan BSB/ChSB — Excel’da",

      "sp.tech.t": "Texnologiyalar",
      "sp.tech.m": "oʻz serverimiz RTX 5080",
      "sp.tech.1": "Gemma 4 · 12B + bge-m3 qidiruv",
      "sp.tech.2": "Eshitish: GigaAM + Whisper",
      "sp.tech.3": "React · Three.js · WebXR",

      "sp.diff.t": "Boshqalarda yoʻq",
      "sp.diff.m": "hammasi bittada",
      "sp.diff.1": "Aynan Kimyo dasturi boʻyicha",
      "sp.diff.2": "Raqamlarni kalkulyator tekshiradi",
      "sp.diff.3": "SI oʻzbekcha gapiradi",

      "sp.road": "Keyin",
      "sp.r0": "Hozir ishlaydi",
      "sp.r1": "0–3 oy · 5 ta maktabda pilot",
      "sp.r2": "3–6 oy · internetsiz ATOMLAB Box",
      "sp.r3": "6–12 oy · fizika, biologiya, butun mamlakat",
      "sp.hint": "Shoxchani bosing — batafsil ochiladi",
      "sp.back": "Sxema",
      "sp.qr": "ATOMLAB’ni ochish",
      "ui.mode": "Sxema / slaydlar (M)",
      "pres.map": "ATOMLAB sxemasi («oʻrgimchak»)",
    },
    en: {
      "sp.kicker": "InnoWeek · Uzbekistan",
      "sp.sub": "A virtual chemistry lab and an AI teacher for the schools of Uzbekistan",
      "sp.prob": "The problem",
      "sp.p1": "No reagents, no lab",
      "sp.p2": "Experiments are risky and costly",
      "sp.p3": "Atoms and electrons are invisible",
      "sp.p4": "One teacher for 30 students",
      "sp.hubTag": "Chemistry you can see",
      "sp.hubSub": "Kimyo 7–11 · oʻz · рус · eng",

      "sp.lab.t": "3D laboratory",
      "sp.lab.m": "10 experiments · VR",
      "sp.lab.1": "Flame, steam, gas, precipitate",
      "sp.lab.2": "15 problems as real experiments",
      "sp.lab.3": "VR (WebXR), mouse and touch",

      "sp.form.t": "How substances form",
      "sp.form.m": "200 substances",
      "sp.form.1": "Electrons jump and pair up",
      "sp.form.2": "Electron clouds and energy",
      "sp.form.3": "Crystal lattices",

      "sp.org.t": "Organic in 3D",
      "sp.org.m": "329 molecules",
      "sp.org.1": "Exact 3D geometry (RDKit)",
      "sp.org.2": "535 syntheses, atom by atom",
      "sp.org.3": "Builder: assemble a molecule",

      "sp.pt.t": "Periodic table",
      "sp.pt.m": "118 elements",
      "sp.pt.1": "Real photos of 95 elements",
      "sp.pt.2": "Everyday uses",
      "sp.pt.3": "Mass and electrons on each card",

      "sp.book.t": "Kimyo 7–11 textbooks",
      "sp.book.m": "1,443 reactions in 3D",
      "sp.book.1": "99.7% of textbook reactions",
      "sp.book.2": "448 / 448 substances in catalog",
      "sp.book.3": "Textbook with an equations panel",

      "sp.ai.t": "AI teacher",
      "sp.ai.m": "201/201 problems correct",
      "sp.ai.1": "Cites the textbook topic",
      "sp.ai.2": "Voice: Uzbek · Russian · English",
      "sp.ai.3": "Reads a photo of a problem",

      "sp.art.t": "AI artist",
      "sp.art.m": "an image in 15 seconds",
      "sp.art.1": "Draws any description",
      "sp.art.2": "No key — open to everyone",
      "sp.art.3": "Child-safety check",

      "sp.tools.t": "For teachers",
      "sp.tools.m": "plan · test · check",
      "sp.tools.1": "A lesson plan in a minute",
      "sp.tools.2": "Tests with answer keys",
      "sp.tools.3": "eMaktab reports → Excel",

      "sp.tech.t": "Technology",
      "sp.tech.m": "own RTX 5080 server",
      "sp.tech.1": "Gemma 4 · 12B + bge-m3 search",
      "sp.tech.2": "Hearing: GigaAM + Whisper",
      "sp.tech.3": "React · Three.js · WebXR",

      "sp.diff.t": "What others lack",
      "sp.diff.m": "all in one",
      "sp.diff.1": "Strictly the Kimyo curriculum",
      "sp.diff.2": "Numbers verified by a calculator",
      "sp.diff.3": "The AI speaks Uzbek",

      "sp.road": "Next",
      "sp.r0": "Working today",
      "sp.r1": "0–3 mo · pilot in 5 schools",
      "sp.r2": "3–6 mo · ATOMLAB Box, no internet",
      "sp.r3": "6–12 mo · physics, biology, nationwide",
      "sp.hint": "Tap a branch to open the details",
      "sp.back": "Map",
      "sp.qr": "Open ATOMLAB",
      "ui.mode": "Map / slides (M)",
      "pres.map": "ATOMLAB map (“spider”)",
    },
  };
  Object.keys(add).forEach(function (l) {
    window.I18N[l] = window.I18N[l] || {};
    Object.keys(add[l]).forEach(function (k) { window.I18N[l][k] = add[l][k]; });
  });
  window.NOTES = window.NOTES || {};
  window.NOTES.map =
    "Это весь ATOMLAB на одном листе. В центре — платформа. Слева — то, что видит ученик: 3D-лаборатория, анимации того, как образуется вещество, органика в 3D, таблица Менделеева и учебники Kimyo 7–11. Справа — искусственный интеллект: ИИ-учитель, ИИ-художник, инструменты для учителя, наши технологии и то, чего нет у других. Сверху — проблема, снизу — наш план. Нажмите на любую ветку — откроется подробно, Esc — вернуться к схеме.";
})();

/* Подробности ветки — в карточке, которая открывается кликом по ветке. */
(function () {
  var D = {
    ru: {
      "sp.lab.d": "Ученик сам ставит опыт: наливает, нагревает, взвешивает — без реактивов и без риска. Установки ведут себя по законам физики.",
      "sp.form.d": "Видно, как электрон переходит от натрия к хлору и как атомы делят электронные пары. Так показаны все 200 веществ каталога.",
      "sp.org.d": "Каждая молекула посчитана научной библиотекой RDKit — длины связей и углы как в жизни. Её можно повертеть и собрать самому.",
      "sp.pt.d": "У каждого элемента — карточка: масса, электроны, где он встречается в жизни, и настоящее фото образца.",
      "sp.book.d": "Из 1 448 реакций учебников Kimyo 7–11 в 3D-реакторе запускаются 1 443. Учебник открыт рядом — с панелью всех уравнений темы.",
      "sp.ai.d": "Отвечает по учебнику своего класса и даёт ссылку на тему. Числа считает калькулятор, а не «на глаз». Понимает голос и фото.",
      "sp.art.d": "Ученик пишет, что нарисовать, — через 15 секунд картинка готова. Всё работает на нашем сервере, каждую картинку проверяет фильтр безопасности.",
      "sp.tools.d": "План урока, тест с ключами и проверка работы по фото — за минуты. Оценку всегда ставит учитель.",
      "sp.tech.d": "Свой сервер с видеокартой RTX 5080 и открытые модели — без платных зарубежных сервисов. Сервер обновляется сам через GitHub.",
      "sp.diff.d": "ChatGPT не знает наших учебников, зарубежные лаборатории не говорят по-узбекски. ATOMLAB объединяет лабораторию, учебник и ИИ.",
      "sp.close": "Закрыть (Esc)",
      "sp.keys": "→ следующая ветка  ·  Esc — к схеме"
    },
    uz: {
      "sp.lab.d": "Oʻquvchi tajribani oʻzi oʻtkazadi: quyadi, qizdiradi, tortadi — reaktivsiz va xavfsiz. Qurilmalar fizika qonunlariga boʻysunadi.",
      "sp.form.d": "Elektron natriydan xlorga qanday oʻtishi va atomlar elektron juftlarini qanday boʻlishishi koʻrinadi. Katalogdagi 200 ta modda shunday koʻrsatilgan.",
      "sp.org.d": "Har bir molekula RDKit ilmiy kutubxonasida hisoblangan — bogʻ uzunliklari va burchaklar haqiqiydek. Uni aylantirish va oʻzing yigʻish mumkin.",
      "sp.pt.d": "Har bir elementning kartochkasi bor: massa, elektronlar, hayotda qayerda uchrashi va namunaning haqiqiy fotosi.",
      "sp.book.d": "Kimyo 7–11 darsliklaridagi 1 448 ta reaksiyadan 1 443 tasi 3D reaktorda ishga tushadi. Darslik yonida — mavzuning barcha tenglamalari bilan.",
      "sp.ai.d": "Oʻz sinfi darsligi boʻyicha javob beradi va mavzuga havola beradi. Raqamlarni kalkulyator hisoblaydi. Ovoz va fotoni tushunadi.",
      "sp.art.d": "Oʻquvchi nimani chizishni yozadi — 15 soniyada rasm tayyor. Hammasi bizning serverimizda ishlaydi, har bir rasmni xavfsizlik filtri tekshiradi.",
      "sp.tools.d": "Dars rejasi, javob kalitli test va ishni foto orqali tekshirish — bir necha daqiqada. Bahoni doim oʻqituvchi qoʻyadi.",
      "sp.tech.d": "RTX 5080 videokartali oʻz serverimiz va ochiq modellar — pullik xorijiy xizmatlarsiz. Server GitHub orqali oʻzi yangilanadi.",
      "sp.diff.d": "ChatGPT bizning darsliklarni bilmaydi, xorijiy laboratoriyalar oʻzbekcha gapirmaydi. ATOMLAB laboratoriya, darslik va SIni birlashtiradi.",
      "sp.close": "Yopish (Esc)",
      "sp.keys": "→ keyingi shoxcha  ·  Esc — sxemaga"
    },
    en: {
      "sp.lab.d": "Students run the experiment themselves — pour, heat, weigh — with no reagents and no risk. The rigs obey real physics.",
      "sp.form.d": "Watch the electron jump from sodium to chlorine and atoms share electron pairs. All 200 catalog substances are shown this way.",
      "sp.org.d": "Every molecule is computed with the RDKit science library — real bond lengths and angles. Spin it or build it yourself.",
      "sp.pt.d": "Every element has a card: mass, electrons, where it appears in everyday life, and a real photo of a sample.",
      "sp.book.d": "1,443 of the 1,448 reactions in the Kimyo 7–11 textbooks run in the 3D reactor. The textbook sits alongside with every equation of the topic.",
      "sp.ai.d": "Answers from the student’s own textbook and cites the topic. Numbers come from a calculator, not a guess. Understands voice and photos.",
      "sp.art.d": "A student types what to draw — the image is ready in 15 seconds. It all runs on our own server, and a safety filter checks every image.",
      "sp.tools.d": "A lesson plan, a test with answer keys and photo-based checking — in minutes. The teacher always sets the grade.",
      "sp.tech.d": "Our own RTX 5080 server and open models — no paid foreign services. The server updates itself from GitHub.",
      "sp.diff.d": "ChatGPT doesn’t know our textbooks; foreign labs don’t speak Uzbek. ATOMLAB brings the lab, the textbook and AI together.",
      "sp.close": "Close (Esc)",
      "sp.keys": "→ next branch  ·  Esc — back to the map"
    }
  };
  Object.keys(D).forEach(function (l) { Object.keys(D[l]).forEach(function (k) { window.I18N[l][k] = D[l][k]; }); });
})();
