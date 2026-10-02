/**
 * Фразы диалогового менеджера учителя (RU/EN/UZ). Здесь только речь учителя —
 * никаких химических фактов: вопросы и эталоны берутся из банков проекта.
 */
import type { StudentMood } from '../human/studentProfile'

export type DialogLang = 'ru' | 'en' | 'uz'

type Pool = Record<DialogLang, readonly string[]>

export const QUIZ_INTRO: Pool = {
  ru: ['Давай проверим. Первый вопрос:', 'Хорошо, потренируемся. Вопрос:', 'Отлично, начинаем. Слушай:', 'Поехали! Вопрос первый:'],
  en: ['Let us check. First question:', 'Good, let us practise. Question:', 'Great, here we go:', 'Ready? First question:'],
  uz: ['Keling, tekshiramiz. Birinchi savol:', 'Yaxshi, mashq qilamiz. Savol:', 'Zoʻr, boshlaymiz:', 'Ketdik! Birinchi savol:'],
}

export const QUIZ_NEXT: Pool = {
  ru: ['Следующий вопрос:', 'Идём дальше:', 'Ещё один:', 'Теперь такой:', 'Продолжаем:'],
  en: ['Next question:', 'Moving on:', 'One more:', 'Now this one:', 'Let us continue:'],
  uz: ['Keyingi savol:', 'Davom etamiz:', 'Yana bitta:', 'Endi bunisi:', 'Davom:'],
}

export const PRAISE: Pool = {
  ru: ['Верно!', 'Точно так!', 'Правильно, молодец!', 'Да, именно так.', 'Отлично, в точку!', 'Так и есть!'],
  en: ['Correct!', 'Exactly!', 'Right, well done!', 'Yes, that is it.', 'Excellent, spot on!', 'That is right!'],
  uz: ['Toʻgʻri!', 'Aynan shunday!', 'Toʻgʻri, barakalla!', 'Ha, xuddi shunday.', 'Zoʻr, nishonga tegdi!', 'Shunday!'],
}

export const STREAK: Pool = {
  ru: ['Уже {n} подряд — отличная серия!', '{n} верных подряд, так держать!', 'Серия из {n} — ты в ударе!'],
  en: ['{n} in a row — great streak!', '{n} correct in a row, keep it up!', 'A streak of {n} — you are on fire!'],
  uz: ['Ketma-ket {n} ta — ajoyib!', 'Ketma-ket {n} ta toʻgʻri, shunday davom et!', '{n} talik seriya — zoʻrsan!'],
}

export const PARTIAL: Pool = {
  ru: ['Частично верно. Ты упустил: {missing}.', 'Почти! Не хватает: {missing}.', 'В целом по делу, но добавь: {missing}.', 'Половина есть. Ещё важно: {missing}.'],
  en: ['Partly right. You missed: {missing}.', 'Almost! Missing: {missing}.', 'On track, but add: {missing}.', 'Half there. Also important: {missing}.'],
  uz: ['Qisman toʻgʻri. Oʻtkazib yubording: {missing}.', 'Deyarli! Yetishmayapti: {missing}.', 'Umuman toʻgʻri, lekin qoʻsh: {missing}.', 'Yarmi bor. Yana muhimi: {missing}.'],
}

export const WRONG: Pool = {
  ru: ['Не совсем. Правильный ответ: {answer}', 'Пока нет. Запомни: {answer}', 'Нет, смотри: {answer}', 'Ошибка, но это поправимо. Верно так: {answer}'],
  en: ['Not quite. The correct answer: {answer}', 'Not yet. Remember: {answer}', 'No, look: {answer}', 'A mistake, but fixable. Correct is: {answer}'],
  uz: ['Unchalik emas. Toʻgʻri javob: {answer}', 'Hali emas. Eslab qol: {answer}', 'Yoʻq, qara: {answer}', 'Xato, lekin tuzatsa boʻladi. Toʻgʻrisi: {answer}'],
}

export const WRONG_HINT: Pool = {
  ru: ['Подсказка на будущее: опорные слова — {keys}.', 'Чтобы запомнить, держи в голове: {keys}.', 'Ключ к ответу — слова {keys}.'],
  en: ['Hint for next time: key words — {keys}.', 'To remember it, keep in mind: {keys}.', 'The key to the answer — {keys}.'],
  uz: ['Kelgusiga maslahat: tayanch soʻzlar — {keys}.', 'Eslab qolish uchun: {keys}.', 'Javobning kaliti — {keys}.'],
}

export const ADDITION: Pool = {
  ru: ['Добавлю: {sample}', 'Полный ответ звучит так: {sample}', 'Для полноты: {sample}'],
  en: ['I will add: {sample}', 'The full answer sounds like this: {sample}', 'For completeness: {sample}'],
  uz: ['Qoʻshimcha: {sample}', 'Toʻliq javob shunday: {sample}', 'Toʻliqlik uchun: {sample}'],
}

export const ASK_MORE: Pool = {
  ru: ['Ещё вопрос?', 'Продолжим?', 'Ещё один?', 'Дальше?', 'Готов к следующему?'],
  en: ['Another question?', 'Shall we continue?', 'One more?', 'Next?', 'Ready for the next one?'],
  uz: ['Yana savol?', 'Davom etamizmi?', 'Yana bitta?', 'Keyingisi?', 'Keyingisiga tayyormisan?'],
}

export const HINT: Pool = {
  ru: ['Подсказка: ответ начинается так — «{start}…». Попробуй продолжить.', 'Наводка: вспомни слова {keys}. Как бы ты ответил?', 'Начало ответа: «{start}…» — договори сам.'],
  en: ['Hint: the answer starts like this — "{start}…". Try to continue.', 'A clue: recall the words {keys}. How would you answer?', 'The answer begins: "{start}…" — finish it yourself.'],
  uz: ['Maslahat: javob shunday boshlanadi — «{start}…». Davom ettirib koʻr.', 'Yoʻl-yoʻriq: {keys} soʻzlarini eslа. Qanday javob berarding?', 'Javob boshi: «{start}…» — oʻzing tugat.'],
}

export const SUMMARY: Pool = {
  ru: ['Итог: {correct} из {asked} верно{partial}.', 'Подведём итог: {correct} из {asked}{partial}.', 'Закончили. Счёт: {correct} из {asked}{partial}.'],
  en: ['Result: {correct} of {asked} correct{partial}.', 'Summary: {correct} of {asked}{partial}.', 'Done. Score: {correct} of {asked}{partial}.'],
  uz: ['Natija: {asked} tadan {correct} tasi toʻgʻri{partial}.', 'Yakun: {asked} tadan {correct} tasi{partial}.', 'Tugatdik. Hisob: {asked} tadan {correct}{partial}.'],
}

export const SUMMARY_REVIEW: Pool = {
  ru: ['Стоит повторить: {topics}.', 'На повторение: {topics}.', 'Загляни ещё раз в темы: {topics}.'],
  en: ['Worth reviewing: {topics}.', 'To revise: {topics}.', 'Look again at: {topics}.'],
  uz: ['Takrorlash kerak: {topics}.', 'Takrorlashga: {topics}.', 'Yana bir koʻrib chiq: {topics}.'],
}

export const SUMMARY_PERFECT: Pool = {
  ru: ['Ни одной ошибки — отлично!', 'Всё верно, так держать!', 'Чисто, без ошибок. Молодец!'],
  en: ['No mistakes — excellent!', 'All correct, keep it up!', 'Clean, no mistakes. Well done!'],
  uz: ['Birorta xato yoʻq — aʼlo!', 'Hammasi toʻgʻri, shunday davom et!', 'Toza, xatosiz. Barakalla!'],
}

export const REVIEW_OFFER: Pool = {
  ru: ['Три ошибки подряд по теме «{topic}» — давай разберём её заново, спокойно, с самого начала? Напиши «объясни {topic}».', 'Вижу, тема «{topic}» пока даётся трудно. Предлагаю разобрать её заново — спроси «что такое {topic}», и пойдём по шагам.'],
  en: ['Three mistakes in a row on "{topic}" — shall we go through it again from the start? Type "explain {topic}".', 'I see "{topic}" is hard for now. Let us go over it again — ask "what is {topic}" and we will take it step by step.'],
  uz: ['«{topic}» mavzusida ketma-ket uchta xato — keling, uni boshidan qayta koʻramizmi? «{topic} tushuntir» deb yoz.', '«{topic}» mavzusi hozircha qiyin ekan. Qaytadan koʻrishni taklif qilaman — «{topic} nima» deb soʻra, bosqichma-bosqich boramiz.'],
}

export const NO_POOL: Pool = {
  ru: ['Для этой темы у меня пока нет готовых вопросов. Спроси меня что-нибудь по параграфу — отвечу и проверю понимание.'],
  en: ['I have no ready questions for this topic yet. Ask me something from the section — I will answer and check your understanding.'],
  uz: ['Bu mavzu boʻyicha hali tayyor savollarim yoʻq. Paragraf boʻyicha biror narsa soʻra — javob beraman va tushunishni tekshiraman.'],
}

export const QUIZ_EXIT_QUESTION: Pool = {
  ru: ['Хорошо, отвечу на вопрос, а викторину продолжим, когда скажешь «проверь меня».'],
  en: ['Sure, I will answer that; we will continue the quiz when you say "quiz me".'],
  uz: ['Yaxshi, savolga javob beraman; «meni tekshir» desang, viktorinani davom ettiramiz.'],
}

/* ---------------------------------------------------------------- поддержка */

export const SUPPORT: Record<StudentMood, Pool> = {
  confused: {
    ru: [
      'Понимаю, бывает. Это не значит, что ты не можешь — просто нужен другой заход.',
      'Ничего страшного: запутаться — нормальная часть учёбы.',
      'Спокойно. Если непонятно — значит, я объяснил не так, попробуем иначе.',
      'Это нормально. Химия с первого раза мало кому даётся.',
      'Не переживай, разберёмся вместе — по одному маленькому шагу.',
      'Хорошо, что сказал. Давай найдём место, где потерялась нить.',
    ],
    en: [
      'I understand, it happens. It does not mean you cannot — we just need another way in.',
      'No worries: getting confused is a normal part of learning.',
      'Easy. If it is unclear, I explained it wrong — let us try differently.',
      'That is normal. Few people get chemistry on the first try.',
      'Do not worry, we will sort it out together — one small step at a time.',
      'Good that you said so. Let us find where the thread got lost.',
    ],
    uz: [
      'Tushunaman, boʻladi. Bu qila olmaysan degani emas — boshqacha yoʻl kerak, xolos.',
      'Hechqisi yoʻq: chalkashish — oʻqishning oddiy qismi.',
      'Xotirjam boʻl. Tushunarsiz boʻlsa, demak men boshqacha tushuntirishim kerak.',
      'Bu normal. Kimyo birinchi urinishda kam kishiga oson boʻladi.',
      'Xavotir olma, birga hal qilamiz — kichik qadamlar bilan.',
      'Aytganing yaxshi boʻldi. Qayerda ip uzilganini topamiz.',
    ],
  },
  tired: {
    ru: [
      'Усталость — сигнал, а не слабость. Пять минут отдыха сделают голову яснее.',
      'Понимаю. Давай не будем гнаться — сделаем совсем маленький шаг и остановимся.',
      'Нормально уставать. Выпей воды, посмотри в окно — я подожду.',
      'Хорошо, что заметил. Короткая пауза — и вернёмся с силами.',
      'Тогда без длинных объяснений: одна мысль — и отдыхать.',
    ],
    en: [
      'Tiredness is a signal, not a weakness. Five minutes of rest will clear your head.',
      'I understand. Let us not rush — one tiny step and we stop.',
      'It is normal to get tired. Drink some water, look out of the window — I will wait.',
      'Good that you noticed. A short pause, then we come back stronger.',
      'Then no long explanations: one idea — and rest.',
    ],
    uz: [
      'Charchoq — bu belgi, zaiflik emas. Besh daqiqa dam — bosh tiniqlashadi.',
      'Tushunaman. Shoshilmaymiz — bitta kichik qadam va toʻxtaymiz.',
      'Charchash normal. Suv ich, derazaga qara — kutaman.',
      'Sezganing yaxshi. Qisqa tanaffus — va kuch bilan qaytamiz.',
      'Unda uzun tushuntirishlarsiz: bitta fikr — va dam.',
    ],
  },
  bored: {
    ru: [
      'Скучно обычно тогда, когда либо слишком легко, либо непонятно зачем. Давай добавим азарта.',
      'Понял, меняем темп.',
      'Ок, без длинных текстов — только живое.',
      'Скука лечится вызовом. Готов проверить себя?',
      'Давай сделаем интереснее: вопросы на скорость или факт, который удивляет.',
    ],
    en: [
      'Boredom usually means it is either too easy or unclear why it matters. Let us add some spark.',
      'Got it, changing pace.',
      'Ok, no long texts — only the lively parts.',
      'Boredom is cured by a challenge. Ready to test yourself?',
      'Let us make it more interesting: quick-fire questions or a surprising fact.',
    ],
    uz: [
      'Zerikish odatda juda oson yoki nega kerakligi noaniq boʻlganda boʻladi. Qiziqish qoʻshamiz.',
      'Tushundim, surʼatni oʻzgartiramiz.',
      'Xoʻp, uzun matnlarsiz — faqat jonli qismi.',
      'Zerikishni chaqiriq davolaydi. Oʻzingni sinab koʻrasanmi?',
      'Qiziqroq qilamiz: tez savollar yoki hayratlantiradigan fakt.',
    ],
  },
  scared: {
    ru: [
      'Волноваться перед контрольной — нормально, это значит, что тебе не всё равно.',
      'Страх уходит, когда есть план. Давай его сделаем.',
      'Спокойно: до контрольной можно успеть закрыть главное.',
      'Понимаю. Лучшее лекарство от тревоги — пара решённых вопросов прямо сейчас.',
      'Ты не один — я рядом, разберём то, что пугает больше всего.',
    ],
    en: [
      'Being nervous before a test is normal — it means you care.',
      'Fear fades when there is a plan. Let us make one.',
      'Easy: there is still time to cover the essentials before the test.',
      'I understand. The best cure for anxiety is a couple of solved questions right now.',
      'You are not alone — I am here, let us tackle what scares you most.',
    ],
    uz: [
      'Nazoratdan oldin hayajonlanish normal — bu befarq emasligingni bildiradi.',
      'Reja boʻlsa, qoʻrquv ketadi. Keling, tuzamiz.',
      'Xotirjam boʻl: nazoratgacha asosiysini ulgurish mumkin.',
      'Tushunaman. Tashvishga eng yaxshi dori — hozir ikkita savolni yechish.',
      'Yolgʻiz emassan — men yoningdaman, eng qoʻrqitganini koʻramiz.',
    ],
  },
  down: {
    ru: [
      'Стоп. «Тупой» — неправильное слово. Ты просто ещё не разобрался, а это лечится.',
      'Не говори так о себе. Ошибки — это как ты учишься, а не кто ты.',
      'Поверь, у всех химиков были такие дни. Это не про способности.',
      'Ты уже здесь и пробуешь — это главное. Остальное наработаем.',
      'Мозгу нужно время, а не оценки. Давай дадим ему маленькую победу.',
    ],
    en: [
      'Stop. "Stupid" is the wrong word. You just have not figured it out yet, and that is fixable.',
      'Do not talk about yourself like that. Mistakes are how you learn, not who you are.',
      'Believe me, every chemist had days like this. It is not about ability.',
      'You are here and trying — that is what matters. The rest we will build.',
      'The brain needs time, not grades. Let us give it a small win.',
    ],
    uz: [
      'Toʻxta. «Ahmoq» — notoʻgʻri soʻz. Sen shunchaki hali tushunmagansan, bu tuzatiladi.',
      'Oʻzing haqingda bunday dema. Xatolar — qanday oʻrganishing, kimligng emas.',
      'Ishon, barcha kimyogarlarda shunday kunlar boʻlgan. Bu qobiliyat haqida emas.',
      'Sen shu yerdasan va harakat qilyapsan — asosiysi shu. Qolganini qilamiz.',
      'Miyaga baho emas, vaqt kerak. Unga kichik gʻalaba beramiz.',
    ],
  },
  easy: {
    ru: ['Отлично, значит можно усложнить.', 'Легко? Тогда поднимаем планку.', 'Хорошо. Проверим на вопросах посложнее?', 'Раз легко — попробуем применить на задаче.', 'Супер, двигаемся быстрее.'],
    en: ['Great, so we can make it harder.', 'Easy? Then let us raise the bar.', 'Good. Shall we check with harder questions?', 'If it is easy — let us apply it to a problem.', 'Super, moving faster.'],
    uz: ['Zoʻr, demak qiyinlashtirsa boʻladi.', 'Osonmi? Unda darajani koʻtaramiz.', 'Yaxshi. Qiyinroq savollar bilan tekshiramizmi?', 'Oson boʻlsa — masalada qoʻllab koʻramiz.', 'Super, tezroq boramiz.'],
  },
  happy: {
    ru: ['Рад за тебя! Хорошее настроение — лучшее время учиться.', 'Класс! Поймаем волну?', 'Отлично, тогда вперёд.'],
    en: ['Happy for you! A good mood is the best time to learn.', 'Great! Shall we ride the wave?', 'Excellent, then onward.'],
    uz: ['Sen uchun xursandman! Yaxshi kayfiyat — oʻrganish uchun eng yaxshi vaqt.', 'Zoʻr! Toʻlqinni tutamizmi?', 'Aʼlo, unda olgʻa.'],
  },
}

/** Конкретный следующий шаг после поддержки. */
export const OFFER_STEP: Record<StudentMood, Pool> = {
  confused: {
    ru: ['Что выберешь: объяснить проще, разобрать пример или мини-викторина из 3 вопросов? Напиши «проще», «пример» или «викторина».'],
    en: ['Your pick: explain simpler, work through an example, or a 3-question mini-quiz? Type "simpler", "example" or "quiz".'],
    uz: ['Tanla: soddaroq tushuntiraymi, misol koʻramizmi yoki 3 savollik mini-viktorina? «Soddaroq», «misol» yoki «viktorina» deb yoz.'],
  },
  tired: {
    ru: ['Предлагаю: одна короткая мысль по теме или мини-викторина из 3 вопросов — и на сегодня всё. Что выберешь: «проще» или «викторина»?'],
    en: ['Suggestion: one short idea on the topic or a 3-question mini-quiz — and that is it for today. "Simpler" or "quiz"?'],
    uz: ['Taklif: mavzu boʻyicha bitta qisqa fikr yoki 3 savollik mini-viktorina — va bugunga shu. «Soddaroq» yoki «viktorina»?'],
  },
  bored: {
    ru: ['Мини-викторина из 3 вопросов на скорость или пример из жизни? Напиши «викторина» или «пример».'],
    en: ['A quick 3-question mini-quiz or a real-life example? Type "quiz" or "example".'],
    uz: ['Tez 3 savollik mini-viktorina yoki hayotiy misol? «Viktorina» yoki «misol» deb yoz.'],
  },
  scared: {
    ru: ['План такой: мини-викторина из 3 вопросов покажет, где пробелы, а потом разберём их проще. Начнём? Напиши «викторина» или «проще».'],
    en: ['The plan: a 3-question mini-quiz shows the gaps, then we go through them simply. Start? Type "quiz" or "simpler".'],
    uz: ['Reja: 3 savollik mini-viktorina kamchiliklarni koʻrsatadi, keyin ularni soddaroq koʻramiz. Boshlaymizmi? «Viktorina» yoki «soddaroq» deb yoz.'],
  },
  down: {
    ru: ['Давай так: я объясню проще, или разберём один пример, или 3 лёгких вопроса. Выбирай: «проще», «пример», «викторина».'],
    en: ['Here is the deal: I explain simpler, or we do one example, or 3 easy questions. Choose: "simpler", "example", "quiz".'],
    uz: ['Kelishdik: soddaroq tushuntiraman, yoki bitta misol, yoki 3 ta oson savol. Tanla: «soddaroq», «misol», «viktorina».'],
  },
  easy: {
    ru: ['Хочешь мини-викторину из 3 вопросов посложнее? Напиши «викторина».'],
    en: ['Want a harder 3-question mini-quiz? Type "quiz".'],
    uz: ['Qiyinroq 3 savollik mini-viktorina xohlaysanmi? «Viktorina» deb yoz.'],
  },
  happy: {
    ru: ['Спрашивай про тему или скажи «проверь меня».'],
    en: ['Ask about the topic or say "quiz me".'],
    uz: ['Mavzu haqida soʻra yoki «meni tekshir» de.'],
  },
}

/* ------------------------------------------------------------ обучение учителя */

export const TEACH_STYLE: Record<'brief' | 'more' | 'examples', Pool> = {
  brief: {
    ru: ['Понял: отвечаю короче. Если захочешь глубже — скажи «подробнее».', 'Хорошо, буду кратким.', 'Запомнил: коротко и по делу.'],
    en: ['Got it: shorter answers. Say "more detail" whenever you want depth.', 'Fine, I will keep it brief.', 'Noted: short and to the point.'],
    uz: ['Tushundim: qisqaroq javob beraman. Chuqurroq kerak boʻlsa, «batafsil» de.', 'Yaxshi, qisqa boʻlaman.', 'Eslab qoldim: qisqa va aniq.'],
  },
  more: {
    ru: ['Понял: объясняю подробнее, с причинами.', 'Хорошо, буду раскрывать темы глубже.', 'Запомнил: тебе нужны детали.'],
    en: ['Got it: more detail, with reasons.', 'Fine, I will go deeper into topics.', 'Noted: you want the details.'],
    uz: ['Tushundim: batafsilroq, sabablari bilan tushuntiraman.', 'Yaxshi, mavzularni chuqurroq ochaman.', 'Eslab qoldim: senga tafsilotlar kerak.'],
  },
  examples: {
    ru: ['Понял: больше примеров.', 'Хорошо, к каждой теме — пример.', 'Запомнил: без примера не объясняю.'],
    en: ['Got it: more examples.', 'Fine, an example for every topic.', 'Noted: no explanation without an example.'],
    uz: ['Tushundim: koʻproq misol.', 'Yaxshi, har mavzuga — misol.', 'Eslab qoldim: misolsiz tushuntirmayman.'],
  },
}

export const TEACH_WEAK: Pool = {
  ru: ['Записал: «{topic}» даётся трудно. Буду чаще спрашивать по ней в викторине и объяснять проще. Хочешь начать прямо сейчас — спроси «что такое {topic}».', 'Понял, «{topic}» — слабое место. Поставлю её первой в тренировках. Разберём?'],
  en: ['Noted: "{topic}" is hard for you. I will ask it more often in quizzes and explain it simpler. To start now, ask "what is {topic}".', 'Got it, "{topic}" is a weak spot. I will put it first in practice. Shall we go through it?'],
  uz: ['Yozib qoʻydim: «{topic}» qiyin ekan. Viktorinada koʻproq soʻrayman va soddaroq tushuntiraman. Hozir boshlash uchun «{topic} nima» deb soʻra.', 'Tushundim, «{topic}» — zaif joy. Mashqlarda birinchi qoʻyaman. Koʻramizmi?'],
}

export const TEACH_NAME: Pool = {
  ru: ['Договорились, {name}! Так и буду называть.', 'Хорошо, {name}. Запомнил.'],
  en: ['Deal, {name}! That is what I will call you.', 'Alright, {name}. Noted.'],
  uz: ['Kelishdik, {name}! Shunday deb chaqiraman.', 'Yaxshi, {name}. Eslab qoldim.'],
}

/* ------------------------------------------------------------------ домашка */

export const HW_START: Pool = {
  ru: ['Помогу, но решать будем вместе — так оно и запомнится. Пришли условие задачи целиком (что дано и что найти).', 'Давай. Напиши условие полностью — числа, вещества, что нужно найти. Решение подскажу по шагам.'],
  en: ['I will help, but we solve it together — that is how it sticks. Send the full problem (what is given and what to find).', 'Sure. Write the full statement — numbers, substances, what to find. I will guide you step by step.'],
  uz: ['Yordam beraman, lekin birga yechamiz — shunda esda qoladi. Masala shartini toʻliq yubor (nima berilgan, nimani topish kerak).', 'Keling. Shartni toʻliq yoz — sonlar, moddalar, nimani topish kerak. Bosqichma-bosqich yoʻl koʻrsataman.'],
}

export const HW_STEPS: Record<DialogLang, readonly string[]> = {
  ru: [
    'Шаг 1. Выпиши «дано» и «найти»: какие величины известны (с единицами) и какую ищем? Напиши своими словами.',
    'Шаг 2. Какая формула связывает известное и искомое? {formulaHint}Запиши её.',
    'Шаг 3. Подставь числа в формулу и посчитай. Напиши, что получилось — проверю. Если застрял, скажи «покажи решение».',
  ],
  en: [
    'Step 1. Write down "given" and "find": which quantities are known (with units) and which one are we looking for? In your own words.',
    'Step 2. Which formula links the known and the unknown? {formulaHint}Write it down.',
    'Step 3. Plug the numbers into the formula and calculate. Tell me the result — I will check. If stuck, say "show the solution".',
  ],
  uz: [
    '1-qadam. «Berilgan» va «topish kerak»ni yoz: qaysi kattaliklar maʼlum (birliklari bilan) va qaysini izlayapmiz? Oʻz soʻzlaring bilan.',
    '2-qadam. Maʼlum va nomaʼlumni qaysi formula bogʻlaydi? {formulaHint}Uni yoz.',
    '3-qadam. Sonlarni formulaga qoʻyib hisobla. Natijani yoz — tekshiraman. Qiynalsang, «yechimni koʻrsat» de.',
  ],
}

export const HW_STEP_ACK: Pool = {
  ru: ['Хорошо.', 'Так.', 'Принято.', 'Отлично, дальше.'],
  en: ['Good.', 'Right.', 'Noted.', 'Great, next.'],
  uz: ['Yaxshi.', 'Shunday.', 'Qabul.', 'Zoʻr, davom.'],
}

export const HW_DONE: Pool = {
  ru: ['Шаги пройдены. Сверь ответ с условием: единицы и порядок величины разумны? Если хочешь, пришли ответ — проверю, или скажи «покажи решение».'],
  en: ['Steps done. Check the answer against the statement: are units and magnitude reasonable? Send me the answer to check, or say "show the solution".'],
  uz: ['Qadamlar oʻtildi. Javobni shart bilan solishtir: birliklar va kattalik oqilonami? Javobni yubor — tekshiraman, yoki «yechimni koʻrsat» de.'],
}

export const HW_REVEAL_NO_DATA: Pool = {
  ru: ['Готовое решение я не выдумываю: мне нужно условие с числами и формулами веществ. Пришли его — и я проведу расчёт по формуле {formula} с молярными массами из таблицы.'],
  en: ['I will not invent a ready solution: I need the statement with numbers and substance formulas. Send it, and I will do the calculation with {formula} and molar masses from the table.'],
  uz: ['Tayyor yechimni oʻylab topmayman: menga sonlar va modda formulalari bilan shart kerak. Yubor — {formula} formulasi va jadvaldagi molyar massalar bilan hisoblayman.'],
}

export const HW_EXIT: Pool = {
  ru: ['Хорошо, домашку отложим. Возвращайся с условием, когда будешь готов.'],
  en: ['Alright, we pause the homework. Come back with the statement when ready.'],
  uz: ['Yaxshi, uy vazifasini keyinga qoldiramiz. Tayyor boʻlganda shart bilan qayt.'],
}

export function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : ''))
}
