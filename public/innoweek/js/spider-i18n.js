/* ATOMLAB · InnoWeek — тексты визитки (spider/): один экран, ничего не нажимать, языки сменяются сами. ru / uz / en.
 * Цифры — из репозитория ATOMLAB; «*» — оценка стоимости из плана (свой сервер RTX 5080: электричество + амортизация).
 * vc.chat — пример диалога с ИИ-учителем (водород по учебнику, расчёт, голос, задача по фото). */
(function () {
  var add = {
    ru: {
      "sp.kicker": "InnoWeek · Узбекистан",
      "sp.tag": "Химия, которую видно",
      "sp.sub": "Виртуальная химическая лаборатория и ИИ-учитель для школ Узбекистана",
      "sp.i1": "Для кого: ученики 7–11 классов и учителя",
      "sp.i2": "Где: компьютер и телефон, без установки",
      "sp.i4": "Нет реактивов? Опыты — в 3D",

      "sp.ai.t": "ИИ-учитель",
      "sp.ai.sub": "Спросите голосом, текстом или фото — ответит по учебнику",
      "sp.ai.live": "Пример диалога",
      "sp.ai.f1": "Учебник + ссылка на §",
      "sp.ai.f2": "Расчёты верны: 201/201",
      "sp.ai.f3": "Голос: oʻz · рус · eng",
      "sp.ai.f4": "Фото задачи из тетради",

      "sp.c.lab.t": "3D-лаборатория",
      "sp.c.lab.m": "10 опытов по физике",
      "sp.c.lab.1": "Опыт без реактивов и риска",
      "sp.c.lab.2": "Пламя, пар, газ и осадок",
      "sp.c.lab.3": "15 задач — как настоящий опыт",

      "sp.c.vr.t": "VR-лаборатория",
      "sp.c.vr.m": "в очках VR (WebXR)",
      "sp.c.vr.1": "Кабинет химии как настоящий",
      "sp.c.vr.2": "Доска учителя прямо в VR",
      "sp.c.vr.3": "Шкафы, посуда, перчатки",

      "sp.c.org.t": "Органика в 3D",
      "sp.c.org.m": "329 молекул (RDKit)",
      "sp.c.org.1": "535 синтезов — атом за атомом",
      "sp.c.org.2": "Конструктор: собери сам",
      "sp.c.org.3": "Точные связи и углы",

      "sp.c.form.t": "Как образуется",
      "sp.c.form.m": "200 веществ",
      "sp.c.form.1": "Электрон переходит на глазах",
      "sp.c.form.2": "Кристаллические решётки",
      "sp.c.form.3": "Облака электронов и энергия",

      "sp.c.book.t": "Учебники Kimyo 7–11",
      "sp.c.book.m": "1 443 реакции в 3D",
      "sp.c.book.1": "448 веществ — у каждого 3D",
      "sp.c.book.2": "Панель всех уравнений темы",
      "sp.c.book.3": "Вся программа 7–11 классов",

      "sp.c.pt.t": "Таблица Менделеева",
      "sp.c.pt.m": "118 элементов",
      "sp.c.pt.1": "Настоящие фото 95 элементов",
      "sp.c.pt.2": "Применение в жизни",
      "sp.c.pt.3": "Масса и электроны",

      "sp.p.method.t": "Методы обучения",
      "sp.p.method.1": "Опыт → расчёт → проверка",
      "sp.p.method.2": "Тест и конспект по пробелам",
      "sp.p.method.3": "Ответ на уровне своего класса",

      "sp.p.teacher.t": "Учителю",
      "sp.p.teacher.1": "План урока и тест — за минуту",
      "sp.p.teacher.2": "Проверка работ по фото",
      "sp.p.teacher.3": "СОР/СОЧ из eMaktab — в Excel",

      "sp.p.state.t": "Государству",
      "sp.p.state.1": "≈ $0,05 на ученика в месяц*",
      "sp.p.state.2": "Без закупки реактивов",
      "sp.p.state.3": "Свой ИИ — без зарубежных API",

      "sp.p.better.t": "Лучше других",
      "sp.p.better.1": "ChatGPT не знает Kimyo 7–11",
      "sp.p.better.2": "Лаборатория + учебник + ИИ",
      "sp.p.better.3": "Три языка, голос и фото",

      "sp.foot": "* оценка: свой сервер RTX 5080 — электричество и амортизация",
      "sp.back": "Визитка",
      "sp.video": "Видео из ATOMLAB",

      "vc.chat": [
        { "me": ["Как получить водород в лаборатории?"] },
        { "ai": ["Цинк + соляная кислота:", "Zn + 2HCl → ZnCl₂ + H₂↑", "Газ собирают в перевёрнутую пробирку — он легче воздуха."], "cite": "Kimyo 7, гл. 5, тема 2" },
        { "me": ["Сколько литров водорода (н. у.) даст 13 г цинка?"] },
        { "ai": ["n(Zn) = 13 : 65 = 0,2 моль", "V(H₂) = 0,2 · 22,4 = 4,48 л"], "badge": "Сверено калькулятором" },
        { "me": ["Natriy xlor bilan qanday birikadi?"], "voice": true },
        { "ai": ["Natriy tashqi elektronini xlorga beradi: Na⁺ va Cl⁻ ionlari tortishadi — ion bogʻ."] },
        { "me": ["Реши задачу из тетради"], "photo": true },
        { "ai": ["Дано: m(р-ра) = 200 г, ω(соли) = 10 %", "m(соли) = 200 · 0,1 = 20 г", "Ответ: 20 г"], "badge": "Решено по фото" }
      ]
    },
    uz: {
      "sp.kicker": "InnoWeek · Oʻzbekiston",
      "sp.tag": "Koʻrinadigan kimyo",
      "sp.sub": "Oʻzbekiston maktablari uchun virtual kimyo laboratoriyasi va SI-oʻqituvchi",
      "sp.i1": "Kimga: 7–11-sinf oʻquvchilari va oʻqituvchilar",
      "sp.i2": "Qayerda: kompyuter va telefon, oʻrnatishsiz",
      "sp.i4": "Reaktiv yoʻqmi? Tajriba — 3D’da",

      "sp.ai.t": "SI-oʻqituvchi",
      "sp.ai.sub": "Ovoz, matn yoki foto bilan soʻrang — darslik boʻyicha javob beradi",
      "sp.ai.live": "Suhbat namunasi",
      "sp.ai.f1": "Darslik + mavzuga havola",
      "sp.ai.f2": "Hisoblar toʻgʻri: 201/201",
      "sp.ai.f3": "Ovoz: oʻz · rus · eng",
      "sp.ai.f4": "Daftardagi masala fotosi",

      "sp.c.lab.t": "3D laboratoriya",
      "sp.c.lab.m": "fizika boʻyicha 10 tajriba",
      "sp.c.lab.1": "Reaktivsiz va xavfsiz tajriba",
      "sp.c.lab.2": "Olov, bugʻ, gaz va choʻkma",
      "sp.c.lab.3": "15 ta masala — haqiqiy tajriba",

      "sp.c.vr.t": "VR laboratoriya",
      "sp.c.vr.m": "VR koʻzoynakda (WebXR)",
      "sp.c.vr.1": "Haqiqiydek kimyo xonasi",
      "sp.c.vr.2": "VR ichida oʻqituvchi doskasi",
      "sp.c.vr.3": "Shkaflar, idishlar, qoʻlqoplar",

      "sp.c.org.t": "Organika 3D’da",
      "sp.c.org.m": "329 molekula (RDKit)",
      "sp.c.org.1": "535 sintez — atomma-atom",
      "sp.c.org.2": "Konstruktor: oʻzing yigʻ",
      "sp.c.org.3": "Aniq bogʻlar va burchaklar",

      "sp.c.form.t": "Qanday hosil boʻladi",
      "sp.c.form.m": "200 ta modda",
      "sp.c.form.1": "Elektron koʻz oldida oʻtadi",
      "sp.c.form.2": "Kristall panjaralar",
      "sp.c.form.3": "Elektron bulutlari va energiya",

      "sp.c.book.t": "Darsliklar Kimyo 7–11",
      "sp.c.book.m": "1 443 reaksiya 3D’da",
      "sp.c.book.1": "448 modda — har biri 3D’da",
      "sp.c.book.2": "Mavzuning barcha tenglamalari",
      "sp.c.book.3": "7–11-sinf dasturi toʻliq",

      "sp.c.pt.t": "Mendeleyev jadvali",
      "sp.c.pt.m": "118 ta element",
      "sp.c.pt.1": "95 ta element haqiqiy fotosi",
      "sp.c.pt.2": "Hayotda qoʻllanilishi",
      "sp.c.pt.3": "Massa va elektronlar",

      "sp.p.method.t": "Oʻqitish usullari",
      "sp.p.method.1": "Tajriba → hisob → tekshiruv",
      "sp.p.method.2": "Test va boʻshliqlar konspekti",
      "sp.p.method.3": "Oʻz sinfi darajasida javob",

      "sp.p.teacher.t": "Oʻqituvchiga",
      "sp.p.teacher.1": "Reja va test — bir daqiqada",
      "sp.p.teacher.2": "Ishlarni foto orqali tekshirish",
      "sp.p.teacher.3": "eMaktab’dan BSB/ChSB — Excel’da",

      "sp.p.state.t": "Davlatga",
      "sp.p.state.1": "≈ $0,05 / oʻquvchi / oy*",
      "sp.p.state.2": "Reaktiv sotib olish shart emas",
      "sp.p.state.3": "Oʻz SI — xorijiy API’larsiz",

      "sp.p.better.t": "Boshqalardan yaxshi",
      "sp.p.better.1": "ChatGPT Kimyo 7–11 ni bilmaydi",
      "sp.p.better.2": "Laboratoriya + darslik + SI",
      "sp.p.better.3": "Uch til, ovoz va foto",

      "sp.foot": "* baho: RTX 5080 li oʻz serverimiz — elektr va amortizatsiya",
      "sp.back": "Vizitka",
      "sp.video": "ATOMLAB’dan video",

      "vc.chat": [
        { "me": ["Laboratoriyada vodorod qanday olinadi?"] },
        { "ai": ["Rux + xlorid kislota:", "Zn + 2HCl → ZnCl₂ + H₂↑", "Gaz toʻntarilgan probirkaga yigʻiladi — u havodan yengil."], "cite": "Kimyo 7, 5-bob, 2-mavzu" },
        { "me": ["13 g ruxdan necha litr vodorod (n. sh.) ajraladi?"] },
        { "ai": ["n(Zn) = 13 : 65 = 0,2 mol", "V(H₂) = 0,2 · 22,4 = 4,48 l"], "badge": "Kalkulyator bilan tekshirildi" },
        { "me": ["Как натрий соединяется с хлором?"], "voice": true },
        { "ai": ["Натрий отдаёт внешний электрон хлору: ионы Na⁺ и Cl⁻ притягиваются — ионная связь."] },
        { "me": ["Daftardagi masalani yech"], "photo": true },
        { "ai": ["Berilgan: m(eritma) = 200 g, ω(tuz) = 10 %", "m(tuz) = 200 · 0,1 = 20 g", "Javob: 20 g"], "badge": "Foto boʻyicha yechildi" }
      ]
    },
    en: {
      "sp.kicker": "InnoWeek · Uzbekistan",
      "sp.tag": "Chemistry you can see",
      "sp.sub": "A virtual chemistry lab and an AI teacher for the schools of Uzbekistan",
      "sp.i1": "For: grade 7–11 students and teachers",
      "sp.i2": "Where: any PC or phone, no install",
      "sp.i4": "No reagents? Experiments in 3D",

      "sp.ai.t": "AI teacher",
      "sp.ai.sub": "Ask by voice, text or photo — it answers from the textbook",
      "sp.ai.live": "Example dialogue",
      "sp.ai.f1": "Textbook + topic citation",
      "sp.ai.f2": "Math checked: 201/201",
      "sp.ai.f3": "Voice: uz · ru · en",
      "sp.ai.f4": "Photo of a homework task",

      "sp.c.lab.t": "3D laboratory",
      "sp.c.lab.m": "10 physics-true experiments",
      "sp.c.lab.1": "Safe, with no reagents",
      "sp.c.lab.2": "Flame, steam, gas, precipitate",
      "sp.c.lab.3": "15 problems as real experiments",

      "sp.c.vr.t": "VR laboratory",
      "sp.c.vr.m": "in a VR headset (WebXR)",
      "sp.c.vr.1": "A lab that feels real",
      "sp.c.vr.2": "Teacher’s board inside VR",
      "sp.c.vr.3": "Cabinets, glassware, gloves",

      "sp.c.org.t": "Organic in 3D",
      "sp.c.org.m": "329 molecules (RDKit)",
      "sp.c.org.1": "535 syntheses, atom by atom",
      "sp.c.org.2": "Builder: make your own",
      "sp.c.org.3": "Exact bonds and angles",

      "sp.c.form.t": "How substances form",
      "sp.c.form.m": "200 substances",
      "sp.c.form.1": "Watch the electron jump",
      "sp.c.form.2": "Crystal lattices",
      "sp.c.form.3": "Electron clouds and energy",

      "sp.c.book.t": "Kimyo 7–11 textbooks",
      "sp.c.book.m": "1,443 reactions in 3D",
      "sp.c.book.1": "448 substances, each in 3D",
      "sp.c.book.2": "Every equation of the topic",
      "sp.c.book.3": "The full grade 7–11 course",

      "sp.c.pt.t": "Periodic table",
      "sp.c.pt.m": "118 elements",
      "sp.c.pt.1": "Real photos of 95 elements",
      "sp.c.pt.2": "Everyday uses",
      "sp.c.pt.3": "Mass and electrons",

      "sp.p.method.t": "Teaching methods",
      "sp.p.method.1": "Experiment → math → check",
      "sp.p.method.2": "Tests and notes on your gaps",
      "sp.p.method.3": "Answers at your grade level",

      "sp.p.teacher.t": "For teachers",
      "sp.p.teacher.1": "Lesson plan and test in a minute",
      "sp.p.teacher.2": "Checks work from a photo",
      "sp.p.teacher.3": "eMaktab reports → Excel",

      "sp.p.state.t": "For the state",
      "sp.p.state.1": "≈ $0.05 per student a month*",
      "sp.p.state.2": "No reagents to buy",
      "sp.p.state.3": "Own AI — no foreign APIs",

      "sp.p.better.t": "Better than others",
      "sp.p.better.1": "ChatGPT doesn’t know Kimyo 7–11",
      "sp.p.better.2": "Lab + textbook + AI together",
      "sp.p.better.3": "Three languages, voice, photo",

      "sp.foot": "* estimate: own RTX 5080 server — electricity and depreciation",
      "sp.back": "Card",
      "sp.video": "Live from ATOMLAB",

      "vc.chat": [
        { "me": ["How do you make hydrogen in the lab?"] },
        { "ai": ["Zinc + hydrochloric acid:", "Zn + 2HCl → ZnCl₂ + H₂↑", "Collect it in an upside-down test tube — it’s lighter than air."], "cite": "Kimyo 7, ch. 5, topic 2" },
        { "me": ["How many litres of H₂ (STP) from 13 g of zinc?"] },
        { "ai": ["n(Zn) = 13 : 65 = 0.2 mol", "V(H₂) = 0.2 · 22.4 = 4.48 L"], "badge": "Checked by the calculator" },
        { "me": ["Natriy xlor bilan qanday birikadi?"], "voice": true },
        { "ai": ["Natriy tashqi elektronini xlorga beradi: Na⁺ va Cl⁻ ionlari tortishadi — ion bogʻ."] },
        { "me": ["Solve the problem from my notebook"], "photo": true },
        { "ai": ["Given: m(solution) = 200 g, w(salt) = 10%", "m(salt) = 200 · 0.1 = 20 g", "Answer: 20 g"], "badge": "Solved from a photo" }
      ]
    }
  };
  Object.keys(add).forEach(function (l) {
    window.I18N[l] = window.I18N[l] || {};
    Object.keys(add[l]).forEach(function (k) { window.I18N[l][k] = add[l][k]; });
  });
})();

/* Факты визитки (22.10, вечер): учебники Kimyo — 4 пункта, панели — по 4 пункта. */
(function () {
  var F = {
  "ru": {
    "sp.c.book.m": "1 443 из 1 448 реакций — в 3D",
    "sp.c.book.1": "448 / 448 веществ — у каждого 3D",
    "sp.c.book.2": "247 тем программы — на карте ИИ",
    "sp.c.book.3": "Учебник с панелью уравнений",
    "sp.c.book.4": "Ссылка на § в каждом ответе ИИ",
    "sp.p.method.1": "Опыт → расчёт → проверка",
    "sp.p.method.2": "Тест и конспект по пробелам",
    "sp.p.method.3": "Ответ на уровне своего класса",
    "sp.p.method.4": "Живой голосовой урок с ИИ",
    "sp.p.teacher.1": "План урока по теме — за минуту",
    "sp.p.teacher.2": "Тест с ключами ответов",
    "sp.p.teacher.3": "Проверка работ по фото",
    "sp.p.teacher.4": "СОР/СОЧ из eMaktab — в Excel",
    "sp.p.state.1": "≈ $0,05 на ученика в месяц*",
    "sp.p.state.2": "Без закупки реактивов и посуды",
    "sp.p.state.3": "Свой ИИ — без зарубежных API",
    "sp.p.state.4": "Можно разместить в ЦОД страны",
    "sp.p.better.1": "ChatGPT не знает учебники Kimyo",
    "sp.p.better.2": "Лаборатория + учебник + ИИ",
    "sp.p.better.3": "Числа сверяет калькулятор: 201/201",
    "sp.p.better.4": "Узбекский, русский, английский"
  },
  "uz": {
    "sp.c.book.m": "1 448 tadan 1 443 reaksiya — 3D’da",
    "sp.c.book.1": "448 / 448 modda — har biri 3D’da",
    "sp.c.book.2": "247 dastur mavzusi — SI xaritasida",
    "sp.c.book.3": "Tenglamalar paneli bilan darslik",
    "sp.c.book.4": "SI har javobda § ga havola beradi",
    "sp.p.method.1": "Tajriba → hisob → tekshiruv",
    "sp.p.method.2": "Test va boʻshliqlar konspekti",
    "sp.p.method.3": "Oʻz sinfi darajasida javob",
    "sp.p.method.4": "SI bilan jonli ovozli dars",
    "sp.p.teacher.1": "Mavzu boʻyicha reja — bir daqiqada",
    "sp.p.teacher.2": "Javob kalitli test",
    "sp.p.teacher.3": "Ishlarni foto orqali tekshirish",
    "sp.p.teacher.4": "eMaktab’dan BSB/ChSB — Excel’da",
    "sp.p.state.1": "≈ $0,05 / oʻquvchi / oy*",
    "sp.p.state.2": "Reaktiv va idish sotib olinmaydi",
    "sp.p.state.3": "Oʻz SI — xorijiy API’larsiz",
    "sp.p.state.4": "Mamlakat data-markaziga mos",
    "sp.p.better.1": "ChatGPT Kimyo darsliklarini bilmaydi",
    "sp.p.better.2": "Laboratoriya + darslik + SI",
    "sp.p.better.3": "Kalkulyator tekshiradi: 201/201",
    "sp.p.better.4": "Oʻzbek, rus va ingliz tillarida"
  },
  "en": {
    "sp.c.book.m": "1,443 of 1,448 reactions in 3D",
    "sp.c.book.1": "448 / 448 substances, each in 3D",
    "sp.c.book.2": "247 curriculum topics for the AI",
    "sp.c.book.3": "Textbook with an equations panel",
    "sp.c.book.4": "Every AI answer cites the §",
    "sp.p.method.1": "Experiment → math → check",
    "sp.p.method.2": "Tests and notes on your gaps",
    "sp.p.method.3": "Answers at your grade level",
    "sp.p.method.4": "Live voice lesson with the AI",
    "sp.p.teacher.1": "A lesson plan in a minute",
    "sp.p.teacher.2": "Tests with answer keys",
    "sp.p.teacher.3": "Checks work from a photo",
    "sp.p.teacher.4": "eMaktab reports → Excel",
    "sp.p.state.1": "≈ $0.05 per student a month*",
    "sp.p.state.2": "No reagents or glassware to buy",
    "sp.p.state.3": "Own AI — no foreign APIs",
    "sp.p.state.4": "Can run in a local data center",
    "sp.p.better.1": "ChatGPT doesn’t know Kimyo books",
    "sp.p.better.2": "Lab + textbook + AI together",
    "sp.p.better.3": "Calculator-checked: 201/201",
    "sp.p.better.4": "Uzbek, Russian and English"
  }
};
  Object.keys(F).forEach(function (l) { Object.keys(F[l]).forEach(function (k) { window.I18N[l][k] = F[l][k]; }); });
})();
