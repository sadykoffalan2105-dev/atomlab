/* ATOMLAB · InnoWeek — тексты визитки (spider/): один экран, крупные фото, ничего не нажимать. ru / uz / en.
 * Цифры — из репозитория ATOMLAB; «*» — оценка стоимости из плана (свой сервер RTX 5080: электричество + амортизация). */
(function () {
  var add = {
    ru: {
      "sp.kicker": "InnoWeek · Узбекистан",
      "sp.tag": "Химия, которую видно",
      "sp.sub": "Виртуальная химическая лаборатория и ИИ-учитель для школ Узбекистана",

      "sp.c.ai.t": "ИИ-учитель",
      "sp.c.ai.m": "201 из 201 задачи — верно",
      "sp.c.ai.1": "Отвечает по учебнику класса",
      "sp.c.ai.2": "Голос: oʻzbek · рус · eng",

      "sp.c.lab.t": "3D-лаборатория",
      "sp.c.lab.m": "10 опытов по физике",
      "sp.c.lab.1": "Опыт без реактивов и риска",
      "sp.c.lab.2": "Пламя, пар, газ и осадок",

      "sp.c.vr.t": "VR-лаборатория",
      "sp.c.vr.m": "в очках VR (WebXR)",
      "sp.c.vr.1": "Кабинет химии как настоящий",
      "sp.c.vr.2": "Доска учителя прямо в VR",

      "sp.c.org.t": "Органика в 3D",
      "sp.c.org.m": "329 молекул (RDKit)",
      "sp.c.org.1": "535 синтезов — атом за атомом",
      "sp.c.org.2": "Конструктор: собери сам",

      "sp.c.form.t": "Как образуется",
      "sp.c.form.m": "200 веществ",
      "sp.c.form.1": "Электрон переходит на глазах",
      "sp.c.form.2": "Кристаллические решётки",

      "sp.c.book.t": "Учебники Kimyo 7–11",
      "sp.c.book.m": "1 443 реакции в 3D",
      "sp.c.book.1": "448 веществ — у каждого 3D",
      "sp.c.book.2": "Учебник с панелью уравнений",

      "sp.c.pt.t": "Таблица Менделеева",
      "sp.c.pt.m": "118 элементов",
      "sp.c.pt.1": "Настоящие фото 95 элементов",
      "sp.c.pt.2": "Применение в жизни",

      "sp.c.method.t": "Методы обучения",
      "sp.c.method.m": "учимся через опыт",
      "sp.c.method.1": "Опыт → расчёт → проверка",
      "sp.c.method.2": "Тест и конспект по пробелам",

      "sp.p.teacher.t": "Учителю",
      "sp.p.teacher.1": "План урока и тест — за минуту",
      "sp.p.teacher.2": "Проверка работ по фото",
      "sp.p.teacher.3": "СОР/СОЧ из eMaktab — сразу в Excel",

      "sp.p.state.t": "Государству",
      "sp.p.state.1": "≈ $0,05 на ученика в месяц*",
      "sp.p.state.2": "Без закупки реактивов и оборудования",
      "sp.p.state.3": "Свой ИИ — без зарубежных платных API",

      "sp.p.better.t": "Лучше других",
      "sp.p.better.1": "ChatGPT не знает учебники Kimyo 7–11",
      "sp.p.better.2": "Лаборатория + учебник + ИИ — в одном",
      "sp.p.better.3": "Узбекский, русский, английский",

      "sp.foot": "* оценка: свой сервер RTX 5080 — электричество и амортизация",
      "sp.back": "Визитка",
    },
    uz: {
      "sp.kicker": "InnoWeek · Oʻzbekiston",
      "sp.tag": "Koʻrinadigan kimyo",
      "sp.sub": "Oʻzbekiston maktablari uchun virtual kimyo laboratoriyasi va SI-oʻqituvchi",

      "sp.c.ai.t": "SI-oʻqituvchi",
      "sp.c.ai.m": "201 masaladan 201 tasi toʻgʻri",
      "sp.c.ai.1": "Sinf darsligi boʻyicha javob",
      "sp.c.ai.2": "Ovoz: oʻzbek · rus · ingliz",

      "sp.c.lab.t": "3D laboratoriya",
      "sp.c.lab.m": "fizika boʻyicha 10 tajriba",
      "sp.c.lab.1": "Reaktivsiz va xavfsiz tajriba",
      "sp.c.lab.2": "Olov, bugʻ, gaz va choʻkma",

      "sp.c.vr.t": "VR laboratoriya",
      "sp.c.vr.m": "VR koʻzoynakda (WebXR)",
      "sp.c.vr.1": "Haqiqiydek kimyo xonasi",
      "sp.c.vr.2": "VR ichida oʻqituvchi doskasi",

      "sp.c.org.t": "Organika 3D’da",
      "sp.c.org.m": "329 molekula (RDKit)",
      "sp.c.org.1": "535 sintez — atomma-atom",
      "sp.c.org.2": "Konstruktor: oʻzing yigʻ",

      "sp.c.form.t": "Qanday hosil boʻladi",
      "sp.c.form.m": "200 ta modda",
      "sp.c.form.1": "Elektron koʻz oldida oʻtadi",
      "sp.c.form.2": "Kristall panjaralar",

      "sp.c.book.t": "Darsliklar Kimyo 7–11",
      "sp.c.book.m": "1 443 reaksiya 3D’da",
      "sp.c.book.1": "448 modda — har biri 3D’da",
      "sp.c.book.2": "Tenglamalar paneli bilan darslik",

      "sp.c.pt.t": "Mendeleyev jadvali",
      "sp.c.pt.m": "118 ta element",
      "sp.c.pt.1": "95 ta elementning haqiqiy fotosi",
      "sp.c.pt.2": "Hayotda qoʻllanilishi",

      "sp.c.method.t": "Oʻqitish usullari",
      "sp.c.method.m": "tajriba orqali oʻrganamiz",
      "sp.c.method.1": "Tajriba → hisob → tekshiruv",
      "sp.c.method.2": "Test va boʻshliqlar konspekti",

      "sp.p.teacher.t": "Oʻqituvchiga",
      "sp.p.teacher.1": "Dars rejasi va test — bir daqiqada",
      "sp.p.teacher.2": "Ishlarni foto orqali tekshirish",
      "sp.p.teacher.3": "eMaktab’dan BSB/ChSB — darhol Excel’da",

      "sp.p.state.t": "Davlatga",
      "sp.p.state.1": "≈ $0,05 / oʻquvchi / oy*",
      "sp.p.state.2": "Reaktiv va jihoz sotib olish shart emas",
      "sp.p.state.3": "Oʻz SI — pullik xorijiy API’larsiz",

      "sp.p.better.t": "Boshqalardan yaxshi",
      "sp.p.better.1": "ChatGPT Kimyo 7–11 darsliklarini bilmaydi",
      "sp.p.better.2": "Laboratoriya + darslik + SI — bittada",
      "sp.p.better.3": "Oʻzbek, rus va ingliz tillarida",

      "sp.foot": "* baho: RTX 5080 li oʻz serverimiz — elektr va amortizatsiya",
      "sp.back": "Vizitka",
    },
    en: {
      "sp.kicker": "InnoWeek · Uzbekistan",
      "sp.tag": "Chemistry you can see",
      "sp.sub": "A virtual chemistry lab and an AI teacher for the schools of Uzbekistan",

      "sp.c.ai.t": "AI teacher",
      "sp.c.ai.m": "201 of 201 problems correct",
      "sp.c.ai.1": "Answers from the class textbook",
      "sp.c.ai.2": "Voice: Uzbek · Russian · English",

      "sp.c.lab.t": "3D laboratory",
      "sp.c.lab.m": "10 physics-true experiments",
      "sp.c.lab.1": "Safe, with no reagents",
      "sp.c.lab.2": "Flame, steam, gas, precipitate",

      "sp.c.vr.t": "VR laboratory",
      "sp.c.vr.m": "in a VR headset (WebXR)",
      "sp.c.vr.1": "A lab that feels real",
      "sp.c.vr.2": "Teacher’s board inside VR",

      "sp.c.org.t": "Organic in 3D",
      "sp.c.org.m": "329 molecules (RDKit)",
      "sp.c.org.1": "535 syntheses, atom by atom",
      "sp.c.org.2": "Builder: make your own",

      "sp.c.form.t": "How substances form",
      "sp.c.form.m": "200 substances",
      "sp.c.form.1": "Watch the electron jump",
      "sp.c.form.2": "Crystal lattices",

      "sp.c.book.t": "Kimyo 7–11 textbooks",
      "sp.c.book.m": "1,443 reactions in 3D",
      "sp.c.book.1": "448 substances, each in 3D",
      "sp.c.book.2": "Textbook with an equations panel",

      "sp.c.pt.t": "Periodic table",
      "sp.c.pt.m": "118 elements",
      "sp.c.pt.1": "Real photos of 95 elements",
      "sp.c.pt.2": "Everyday uses",

      "sp.c.method.t": "Teaching methods",
      "sp.c.method.m": "learning by doing",
      "sp.c.method.1": "Experiment → math → check",
      "sp.c.method.2": "Tests and notes on your gaps",

      "sp.p.teacher.t": "For teachers",
      "sp.p.teacher.1": "Lesson plan and test in a minute",
      "sp.p.teacher.2": "Checks work from a photo",
      "sp.p.teacher.3": "eMaktab assessment reports → Excel",

      "sp.p.state.t": "For the state",
      "sp.p.state.1": "≈ $0.05 per student a month*",
      "sp.p.state.2": "No reagents or lab equipment to buy",
      "sp.p.state.3": "Own AI — no paid foreign APIs",

      "sp.p.better.t": "Better than others",
      "sp.p.better.1": "ChatGPT doesn’t know the Kimyo 7–11 books",
      "sp.p.better.2": "Lab + textbook + AI in one place",
      "sp.p.better.3": "Uzbek, Russian and English",

      "sp.foot": "* estimate: own RTX 5080 server — electricity and depreciation",
      "sp.back": "Card",
    },
  };
  Object.keys(add).forEach(function (l) {
    window.I18N[l] = window.I18N[l] || {};
    Object.keys(add[l]).forEach(function (k) { window.I18N[l][k] = add[l][k]; });
  });
})();
