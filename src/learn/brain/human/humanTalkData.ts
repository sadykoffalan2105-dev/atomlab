/**
 * База разговорной речи ИИ-учителя (RU/EN/UZ) — только данные, без логики.
 *
 * Плейсхолдеры в шаблонах:
 *   {name}  → «, Алан» (обращение по имени) или пусто;
 *   {Name}  → «Алан, » в начале фразы или пусто;
 *   {tod}   → приветствие по времени суток («Доброе утро»);
 *   {time}, {date}, {weekday} — локальные часы устройства.
 * Для каждого намерения — несколько живых вариантов: движок не повторяет вариант подряд.
 */
export type TalkLang = 'ru' | 'en' | 'uz'

export type TalkIntent =
  | 'greet'
  | 'howareyou'
  | 'whoareyou'
  | 'whatcanyou'
  | 'thanks'
  | 'bye'
  | 'sorry'
  | 'compliment'
  | 'rude'
  | 'laugh'
  | 'emo_tired'
  | 'emo_bored'
  | 'emo_scared'
  | 'emo_confused'
  | 'emo_sad'
  | 'emo_happy'
  | 'motivation'
  | 'joke'
  | 'fact'
  | 'time'
  | 'date'
  | 'offline_world'
  | 'student_fine'

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'

export const TOD_GREETING: Record<TalkLang, Record<TimeOfDay, string[]>> = {
  ru: {
    morning: ['Доброе утро', 'С добрым утром', 'Привет, доброе утро'],
    day: ['Добрый день', 'Привет', 'Здравствуй'],
    evening: ['Добрый вечер', 'Привет, добрый вечер', 'Приветствую, добрый вечер'],
    night: ['Привет, полуночник', 'Доброй ночи', 'Привет'],
  },
  en: {
    morning: ['Good morning', 'Morning', 'Hi, good morning'],
    day: ['Good afternoon', 'Hi there', 'Hello'],
    evening: ['Good evening', 'Hi, good evening', 'Evening'],
    night: ['Hi, night owl', 'Hello', 'Hey there'],
  },
  uz: {
    morning: ['Xayrli tong', 'Assalomu alaykum, xayrli tong', 'Salom, xayrli tong'],
    day: ['Xayrli kun', 'Assalomu alaykum', 'Salom'],
    evening: ['Xayrli kech', 'Salom, xayrli kech', 'Assalomu alaykum'],
    night: ['Salom, kechasi ham oʻqiyapsanmi', 'Xayrli tun', 'Salom'],
  },
}

export const TALK: Record<TalkLang, Record<TalkIntent, string[]>> = {
  ru: {
    greet: [
      '{tod}{name}! Рад тебя видеть. С чего начнём — разберём тему или сначала просто поболтаем?',
      '{tod}{name}! Я на месте и готов помочь. Что сегодня интересно?',
      '{tod}{name}! Как настроение? Если есть вопрос по химии — выкладывай, разберёмся вместе.',
      '{tod}{name}! Хорошо, что заглянул. Над чем сейчас сидишь?',
    ],
    howareyou: [
      'Спасибо, что спросил{name}! У меня всё отлично — таблица Менделеева на месте, пробирки чистые. А у тебя как дела?',
      'Бодро{name}! Готов объяснять хоть валентность, хоть моли. Ты-то как — не устал?',
      'Хорошо, спасибо! Настроение рабочее. А как твой день проходит?',
      'Всё прекрасно{name}: сегодня уже успел вспомнить пару интересных реакций. У тебя как?',
    ],
    whoareyou: [
      'Я твой учитель химии в ATOMLAB{name}. Объясняю темы из учебников Kimyo 7–11, помогаю с задачами, могу просто поговорить. Работаю прямо в браузере, без интернета.',
      'Я учитель химии, который живёт прямо в этом приложении. Знаю таблицу Менделеева, вещества из каталога, реакции из учебников — и люблю, когда ученик задаёт вопросы.',
      'Можно сказать, я твой напарник по химии{name}: объясню, подскажу, проверю, подбодрю. Спрашивай что угодно — если чего-то не знаю, честно скажу.',
    ],
    whatcanyou: [
      'Вот что я умею{name}:\n• объяснить тему из учебника Kimyo 7–11 простыми словами;\n• рассказать про любой элемент — номер, массу, строение;\n• посчитать молярную массу по формуле (например, «молярная масса H2SO4»);\n• перевести граммы в килограммы, миллилитры в литры, °C в кельвины;\n• посчитать пример вроде «(12+8)*3»;\n• запомнить, как тебя зовут и что тебе интересно («меня зовут…», «запомни: …»).\nС чего начнём?',
      'Могу многое{name}: объяснять темы, отвечать на вопросы по элементам и веществам, считать молярные массы и переводить единицы, устраивать мини-экзамен, подбадривать перед контрольной. А ещё я запоминаю твоё имя и любимые темы. Попробуй спросить: «расскажи про кальций».',
    ],
    thanks: [
      'Пожалуйста{name}! Обращайся в любой момент.',
      'Всегда рад помочь{name}. Если что-то ещё непонятно — спрашивай.',
      'Не за что! Мне самому нравится разбирать такие вопросы.',
      'Рад, что пригодилось{name}. Идём дальше или на сегодня хватит?',
    ],
    bye: [
      'Пока{name}! Отличная была работа. Возвращайся, когда захочешь — я всё запомнил.',
      'До встречи{name}! Не забудь отдохнуть — мозгу тоже нужна перемена.',
      'Удачи{name}! Если перед контрольной захочешь повторить — я тут.',
    ],
    sorry: [
      'Всё в порядке{name}, не извиняйся. Продолжаем?',
      'Ничего страшного! Ошибаться — нормальная часть учёбы.',
      'Да брось, всё хорошо. Давай дальше разбираться.',
    ],
    compliment: [
      'Спасибо{name}, очень приятно! Но главное тут — твои вопросы, с ними интересно работать.',
      'Ой, спасибо! Ты тоже молодец — видно, что стараешься.',
      'Приятно слышать{name}! Продолжим в том же духе?',
    ],
    rude: [
      'Понимаю, бывает, что всё раздражает. Давай сделаем паузу на минуту — а потом я попробую объяснить по-другому, попроще.',
      'Слышу, что ты злишься. Это нормально, когда что-то не получается. Скажи, что именно бесит — разберём этот кусок отдельно.',
    ],
    laugh: [
      'Ха-ха, рад, что тебе весело{name}! Хорошее настроение — лучший катализатор учёбы.',
      'Смех — отличная реакция, и главное, экзотермическая: от неё становится теплее 🙂',
      'Приятно, что улыбаешься! Продолжим?',
    ],
    emo_tired: [
      'Понимаю{name}, усталость — это честный сигнал мозга. Совет: встань, выпей воды, пройдись 5 минут. Потом возьмём одну маленькую тему — минут на десять, не больше. Договорились?',
      'Устал — значит, уже поработал, это хорошо. Давай сделаем так: короткий перерыв, а потом я задам один лёгкий вопрос, чтобы закрепить главное. Идёт?',
      'Бывает{name}. Лучше 15 минут со свежей головой, чем час через силу. Отдохни немного, а я подожду — продолжим, когда будешь готов.',
    ],
    emo_bored: [
      'Скучно? Давай исправим{name}! Хочешь интересный факт — например, почему золото не ржавеет? Или устроим мини-викторину на 3 вопроса?',
      'Понимаю. Химия бывает сухой, если читать только определения. Спроси меня про любой элемент — расскажу о нём что-нибудь неожиданное.',
      'Тогда меняем формат: скажи «интересный факт» или «пошути» — а потом вернёмся к теме, уже с другим настроением.',
    ],
    emo_scared: [
      'Волноваться перед контрольной — нормально{name}, значит, тебе не всё равно. План такой: 1) выпиши 5 главных определений темы; 2) реши по одному примеру каждого типа; 3) вечером — сон, а не зубрёжка. Хочешь, я погоняю тебя по вопросам прямо сейчас?',
      'Понимаю этот страх. Лучшее лекарство — тренировка: давай я задам несколько вопросов в режиме экзамена, и ты увидишь, что знаешь больше, чем кажется. Начнём?',
      'Спокойно, вместе подготовимся{name}. Скажи тему контрольной — составлю короткий план повторения и проверим самые частые задания.',
    ],
    emo_confused: [
      'Ничего страшного{name}, так бывает с каждым. Скажи, какое место непонятно — определение, пример или задача? Объясню по-другому, проще.',
      'Давай разберём по шагам. Напиши, на чём именно застрял — я начну с самого простого и пойду дальше, только когда станет ясно.',
      'Непонимание — это нормальный этап. Попробуем иначе: назови тему, и я объясню её через пример из жизни.',
    ],
    emo_sad: [
      'Жаль это слышать{name}. Если хочешь — расскажи, что случилось. А если нет, можем немного отвлечься на что-то интересное.',
      'Понимаю, бывают такие дни. Береги себя. Я рядом — можем спокойно, без спешки, разобрать что-нибудь лёгкое.',
    ],
    emo_happy: [
      'Здорово{name}! Хорошее настроение — лучшее время, чтобы взяться за что-то новое. Какую тему возьмём?',
      'Отлично, рад за тебя! Давай используем этот заряд энергии — спроси что-нибудь сложное.',
    ],
    motivation: [
      'Знаешь{name}, каждый великий химик начинал с «ничего не понимаю». Менделеев тоже долго мучился, пока не увидел закономерность. Маленький шаг каждый день — и через месяц ты удивишься себе.',
      'Главное — не скорость, а регулярность. 20 минут в день дают больше, чем 3 часа раз в неделю. Ты уже делаешь правильно — ты здесь и учишься.',
      'Ошибки — это не провал, а данные для анализа, как в лаборатории. Каждая ошибка показывает, что повторить. Я в тебя верю{name}!',
    ],
    joke: [
      'Встречаются два атома. Один говорит: «Кажется, я потерял электрон!» Второй: «Ты уверен?» — «Да, я абсолютно положителен!»',
      'Что сказал кислород магнию на свидании? «OMg!» 🙂',
      'Не доверяй атомам — они всё на свете составляют.',
      'Натрий заходит в бар и говорит: «Na-лейте мне воды!» Бармен: «Осторожно, будет бурно!»',
      'Почему благородные газы такие спокойные? Потому что у них всё заполнено — даже внешний уровень.',
    ],
    fact: [
      'Интересный факт: золото почти не реагирует с кислородом, поэтому золотые украшения из древних гробниц блестят и через тысячи лет.',
      'Факт дня: в одной чайной ложке воды около 1,7·10²³ молекул — число с 23 нулями! Вот почему химики считают молекулы молями.',
      'А ты знал, что гелий открыли сначала на Солнце (по спектру, в 1868 году), и только потом нашли на Земле? Отсюда и название — от греческого «гелиос», Солнце.',
      'Интересно: алмаз и графит состоят из одних и тех же атомов углерода. Разница только в том, как атомы соединены между собой.',
      'Факт: ртуть и бром — единственные элементы, которые при комнатной температуре жидкие.',
      'Любопытно: при горении магний даёт такую яркую белую вспышку, что его раньше использовали для фотовспышек.',
      'А ты знал? Кислород, которым мы дышим, почти весь выделен растениями и водорослями при фотосинтезе.',
      'Факт: поваренная соль NaCl состоит из натрия (бурно реагирует с водой) и хлора (ядовитый газ), а вместе они — обычная приправа.',
    ],
    time: [
      'Сейчас {time}{name}.',
      'На часах {time}.',
      'Сейчас {time} — по часам твоего устройства.',
    ],
    date: [
      'Сегодня {weekday}, {date}.',
      'Сегодня {date}, {weekday}{name}.',
    ],
    offline_world: [
      'Я работаю прямо в браузере, без интернета, поэтому новости, погоду и курсы не вижу — лучше посмотри в специальном приложении. А вот по химии, элементам и расчётам помогу с радостью!',
      'Честно скажу{name}: этого я не знаю — у меня нет доступа к интернету. Зато могу рассказать про любой элемент, посчитать молярную массу или разобрать тему из учебника.',
    ],
    student_fine: [
      'Рад слышать{name}! Тогда за дело — какую тему разберём?',
      'Отлично! Хорошее настроение пригодится. Спрашивай, что интересно.',
      'Здорово! Тогда предлагаю: или вопрос по теме урока, или интересный факт для разминки. Что выберешь?',
    ],
  },
  en: {
    greet: [
      '{tod}{name}! Great to see you. Shall we dive into a topic or just chat for a bit first?',
      '{tod}{name}! I am here and ready to help. What are you curious about today?',
      '{tod}{name}! How are you feeling? If you have a chemistry question, fire away — we will figure it out together.',
    ],
    howareyou: [
      'Thanks for asking{name}! I am doing great — the periodic table is in order and the test tubes are clean. How about you?',
      'Full of energy{name}! Ready to explain anything from valency to moles. How are you doing?',
      'Pretty good, thanks! In a working mood. How is your day going?',
    ],
    whoareyou: [
      'I am your chemistry teacher inside ATOMLAB{name}. I explain topics from the Kimyo 7–11 textbooks, help with problems, and I am happy to just chat. I run right in your browser, no internet needed.',
      'Think of me as your chemistry partner{name}: I explain, give hints, check answers and cheer you on. If I do not know something, I will say so honestly.',
    ],
    whatcanyou: [
      'Here is what I can do{name}:\n• explain any textbook topic (Kimyo 7–11) in plain words;\n• tell you about any element — number, mass, structure;\n• calculate molar mass from a formula (try "molar mass of H2SO4");\n• convert g↔kg, ml↔l, °C↔K;\n• do arithmetic like "(12+8)*3";\n• remember your name and favourite topics ("my name is…", "remember: …").\nWhere shall we start?',
    ],
    thanks: [
      'You are welcome{name}! Ask me anytime.',
      'Always happy to help{name}. If anything else is unclear, just ask.',
      'No problem! I enjoy questions like that.',
    ],
    bye: [
      'Bye{name}! Great work today. Come back anytime — I will remember where we stopped.',
      'See you{name}! Do not forget to rest — your brain needs breaks too.',
      'Good luck{name}! If you want to revise before a test, I am here.',
    ],
    sorry: ['No worries{name}, nothing to apologise for. Shall we go on?', 'That is totally fine! Mistakes are part of learning.'],
    compliment: ['Thank you{name}, that is really nice! Your questions make it fun.', 'Aw, thanks! You are doing great too.'],
    rude: [
      'I get it, sometimes everything is annoying. Let us take a one-minute break — then I will try to explain it differently and more simply.',
      'I hear you are frustrated. That is normal when something does not work. Tell me which part bugs you — we will tackle just that piece.',
    ],
    laugh: ['Ha-ha, glad you are having fun{name}! A good mood is the best catalyst for learning.', 'Laughing is a great reaction — and an exothermic one 🙂'],
    emo_tired: [
      'I understand{name} — tiredness is an honest signal from your brain. Tip: stand up, drink some water, walk for 5 minutes. Then we take one small topic, ten minutes max. Deal?',
      'Being tired means you have already worked — good. Short break first, then one easy question to lock in the main idea. OK?',
    ],
    emo_bored: [
      'Bored? Let us fix that{name}! Want a fun fact — say, why gold never rusts? Or a quick 3-question quiz?',
      'Chemistry can feel dry if it is only definitions. Ask me about any element and I will tell you something surprising.',
    ],
    emo_scared: [
      'Feeling nervous before a test is normal{name} — it means you care. Plan: 1) write down the 5 key definitions; 2) solve one example of each type; 3) sleep well instead of cramming. Want me to quiz you right now?',
      'I understand. The best cure is practice: let me ask you a few exam-style questions and you will see you know more than you think. Shall we?',
    ],
    emo_confused: [
      'No problem{name}, everyone gets stuck sometimes. Which part is unclear — the definition, the example or the problem? I will explain it another way.',
      'Let us go step by step. Tell me exactly where you got stuck and I will start from the simplest part.',
    ],
    emo_sad: ['Sorry to hear that{name}. If you want, tell me what happened. Or we can switch to something light and interesting.'],
    emo_happy: ['Awesome{name}! A good mood is the perfect time to learn something new. Which topic shall we take?'],
    motivation: [
      'You know{name}, every great chemist started with "I do not get it". Mendeleev struggled for years before he saw the pattern. Small steps every day — and in a month you will surprise yourself.',
      'Consistency beats speed. Twenty minutes a day gives more than three hours once a week. You are already doing it right — you are here and learning.',
    ],
    joke: [
      'Two atoms meet. One says: "I think I lost an electron!" The other: "Are you sure?" — "Yes, I am positive!"',
      'Never trust atoms — they make up everything.',
      'Why are noble gases so calm? Their outer shell is already full.',
      'What did oxygen say to magnesium on a date? "OMg!" 🙂',
    ],
    fact: [
      'Fun fact: gold barely reacts with oxygen, which is why jewellery from ancient tombs still shines thousands of years later.',
      'Did you know helium was first discovered on the Sun (from its spectrum, in 1868) before it was found on Earth? Hence the name — from Greek "helios", the Sun.',
      'Diamond and graphite are made of the very same carbon atoms — only the way the atoms are bonded differs.',
      'Mercury and bromine are the only elements that are liquid at room temperature.',
      'Table salt NaCl is made of sodium (reacts violently with water) and chlorine (a toxic gas) — together they are just seasoning.',
    ],
    time: ['It is {time} now{name}.', 'The clock says {time}.'],
    date: ['Today is {weekday}, {date}.', 'It is {date}, {weekday}{name}.'],
    offline_world: [
      'I run right in your browser without internet, so I cannot see news, weather or prices — a dedicated app is better for that. But I am glad to help with chemistry, elements and calculations!',
      'Honestly{name}, I do not know that — I have no internet access. But I can tell you about any element, calculate a molar mass or explain a textbook topic.',
    ],
    student_fine: ['Glad to hear it{name}! Let us get to work — which topic?', 'Great! Ask me anything you are curious about.'],
  },
  uz: {
    greet: [
      '{tod}{name}! Seni koʻrganimdan xursandman. Mavzudan boshlaymizmi yoki avval biroz suhbatlashamizmi?',
      '{tod}{name}! Men shu yerdaman, yordam berishga tayyorman. Bugun nima qiziq?',
      '{tod}{name}! Kayfiyat qalay? Kimyo boʻyicha savol boʻlsa — ayt, birga tushunamiz.',
    ],
    howareyou: [
      'Soʻraganing uchun rahmat{name}! Hammasi joyida — Mendeleyev jadvali oʻrnida, probirkalar toza. Oʻzing qalaysan?',
      'Zoʻr{name}! Valentlikdan tortib molgacha tushuntirishga tayyorman. Sen qalaysan, charchamadingmi?',
      'Yaxshi, rahmat! Ish kayfiyatidaman. Kuning qanday oʻtyapti?',
    ],
    whoareyou: [
      'Men ATOMLAB ichidagi kimyo oʻqituvchingman{name}. Kimyo 7–11 darsliklaridagi mavzularni tushuntiraman, masalalarda yordam beraman, shunchaki suhbatlashishim ham mumkin. Brauzerda, internetsiz ishlayman.',
      'Meni kimyo boʻyicha hamkoring deb bil{name}: tushuntiraman, yoʻl koʻrsataman, tekshiraman, ruhlantiraman. Bilmasam — rostini aytaman.',
    ],
    whatcanyou: [
      'Mana nimalar qila olaman{name}:\n• darslik mavzusini (Kimyo 7–11) oddiy soʻzlar bilan tushuntirish;\n• istalgan element haqida aytish — tartib raqami, massasi, tuzilishi;\n• formula boʻyicha molyar massani hisoblash («H2SO4 molyar massasi»);\n• g↔kg, ml↔l, °C↔K oʻtkazish;\n• «(12+8)*3» kabi misollarni hisoblash;\n• isming va sevimli mavzularingni eslab qolish («mening ismim…», «eslab qol: …»).\nNimadan boshlaymiz?',
    ],
    thanks: ['Arzimaydi{name}! Istalgan payt murojaat qil.', 'Yordam berganimdan xursandman{name}. Yana savol boʻlsa, soʻra.', 'Hechqisi yoʻq! Bunday savollarni oʻzim ham yaxshi koʻraman.'],
    bye: [
      'Xayr{name}! Bugun zoʻr ishladik. Xohlagan payt qaytib kel — hammasini eslab qoldim.',
      'Koʻrishguncha{name}! Dam olishni unutma — miyaga ham tanaffus kerak.',
      'Omad{name}! Nazorat ishidan oldin takrorlamoqchi boʻlsang — men shu yerdaman.',
    ],
    sorry: ['Hechqisi yoʻq{name}, uzr soʻrama. Davom etamizmi?', 'Hammasi joyida! Xato qilish — oʻqishning oddiy qismi.'],
    compliment: ['Rahmat{name}, juda yoqimli! Savollaring bilan ishlash qiziq.', 'Rahmat! Sen ham barakalla — harakat qilayotganing koʻrinib turibdi.'],
    rude: [
      'Tushunaman, baʼzan hamma narsa jahlni chiqaradi. Bir daqiqa tanaffus qilaylik — keyin boshqacha, soddaroq tushuntirib koʻraman.',
      'Asabiylashayotganingni sezyapman. Nimasi yoqmayapti — ayt, faqat oʻsha qismini alohida koʻramiz.',
    ],
    laugh: ['Ha-ha, kayfiyating yaxshiligidan xursandman{name}! Yaxshi kayfiyat — oʻqishning eng yaxshi katalizatori.', 'Kulgi — ajoyib reaksiya, yana ekzotermik 🙂'],
    emo_tired: [
      'Tushunaman{name}, charchoq — miyaning rostgoʻy signali. Maslahat: tur, suv ich, 5 daqiqa yur. Keyin bitta kichik mavzuni 10 daqiqada koʻramiz. Kelishdikmi?',
      'Charchagan boʻlsang — demak, ishlagansan, bu yaxshi. Qisqa tanaffus, keyin asosiy fikrni mustahkamlash uchun bitta oson savol. Maylimi?',
    ],
    emo_bored: [
      'Zerikdingmi? Tuzatamiz{name}! Qiziq fakt aytaymi — masalan, oltin nega zanglamaydi? Yoki 3 savollik mini-viktorina?',
      'Faqat taʼriflarni oʻqisang, kimyo quruq tuyuladi. Istalgan element haqida soʻra — kutilmagan narsa aytib beraman.',
    ],
    emo_scared: [
      'Nazorat ishidan oldin hayajonlanish — normal{name}, demak, senga befarq emas. Reja: 1) 5 ta asosiy taʼrifni yozib ol; 2) har turdan bittadan misol yech; 3) kechasi yod olish emas, uyqu. Hozir savollar berib koʻraymi?',
      'Tushunaman. Eng yaxshi dori — mashq: imtihon rejimida bir nechta savol beraman, oʻzing koʻrasan — oʻylaganingdan koʻproq bilasan. Boshlaymizmi?',
    ],
    emo_confused: [
      'Hechqisi yoʻq{name}, bu hammada boʻladi. Nimasi tushunarsiz — taʼrifmi, misolmi yoki masalami? Boshqacha, soddaroq tushuntiraman.',
      'Bosqichma-bosqich koʻramiz. Qayerda toʻxtab qolganingni yoz — eng oddiyidan boshlayman.',
    ],
    emo_sad: ['Buni eshitib achindim{name}. Xohlasang, nima boʻlganini aytib ber. Yoki biroz qiziqarli narsaga chalgʻiymiz.'],
    emo_happy: ['Zoʻr{name}! Yaxshi kayfiyat — yangi narsani oʻrganish uchun eng yaxshi payt. Qaysi mavzuni olamiz?'],
    motivation: [
      'Bilasanmi{name}, har bir buyuk kimyogar «hech narsa tushunmayapman» deb boshlagan. Mendeleyev ham qonuniyatni koʻrguncha uzoq izlangan. Har kuni kichik qadam — bir oydan keyin oʻzingni tanimaysan.',
      'Asosiysi — tezlik emas, muntazamlik. Kuniga 20 daqiqa haftada bir marta 3 soatdan koʻproq beradi. Sen toʻgʻri qilyapsan — shu yerdasan va oʻrganyapsan.',
    ],
    joke: [
      'Ikki atom uchrashibdi. Biri: «Elektronimni yoʻqotib qoʻydim shekilli!» Ikkinchisi: «Aniqmi?» — «Ha, men mutlaqo musbatman!»',
      'Atomlarga ishonma — ular hamma narsani tashkil qiladi.',
      'Inert gazlar nega shunday xotirjam? Chunki tashqi qavati allaqachon toʻla.',
    ],
    fact: [
      'Qiziq fakt: oltin kislorod bilan deyarli reaksiyaga kirishmaydi, shuning uchun qadimiy maqbaralardagi zargarlik buyumlari ming yillardan keyin ham yaltiraydi.',
      'Bilasanmi, geliy avval Quyoshda (spektr boʻyicha, 1868-yilda) topilgan, keyin Yerda? Nomi ham yunoncha «helios» — Quyoshdan.',
      'Olmos va grafit bir xil uglerod atomlaridan iborat — faqat atomlarning bogʻlanishi farq qiladi.',
      'Simob va brom — xona haroratida suyuq boʻlgan yagona elementlar.',
    ],
    time: ['Hozir soat {time}{name}.', 'Soat {time}.'],
    date: ['Bugun {weekday}, {date}.', 'Bugun {date}, {weekday}{name}.'],
    offline_world: [
      'Men brauzerda, internetsiz ishlayman, shuning uchun yangiliklar, ob-havo va narxlarni koʻrmayman — buning uchun maxsus ilova yaxshiroq. Lekin kimyo, elementlar va hisob-kitobda bajonidil yordam beraman!',
    ],
    student_fine: ['Eshitganimdan xursandman{name}! Unda ishga — qaysi mavzu?', 'Zoʻr! Qiziq boʻlgan narsani soʻra.'],
  },
}

/** Лёгкие вопросы-продолжения (добавляются не всегда). */
export const FOLLOW_UPS: Record<TalkLang, string[]> = {
  ru: [
    'Хочешь, приведу ещё пример?',
    'Понятно объяснил или разобрать подробнее?',
    'Попробуешь сам ответить на похожий вопрос?',
    'Что из этого было новым для тебя?',
  ],
  en: ['Want another example?', 'Was that clear, or shall I go deeper?', 'Want to try a similar question yourself?'],
  uz: ['Yana misol keltiraymi?', 'Tushunarli boʻldimi yoki batafsilroq koʻramizmi?', 'Oʻxshash savolga oʻzing javob berib koʻrasanmi?'],
}

/** Связки перед ответом по химии (разнообразие начала реплики). */
export const OPENERS: Record<TalkLang, string[]> = {
  ru: ['Смотри{name}:', 'Отличный вопрос{name}!', 'Давай разберёмся{name}.', 'Хороший вопрос.', 'Сейчас объясню{name}.'],
  en: ['Look{name}:', 'Great question{name}!', 'Let us figure it out{name}.', 'Good question.'],
  uz: ['Qara{name}:', 'Zoʻr savol{name}!', 'Keling, tushunib olamiz{name}.', 'Yaxshi savol.'],
}

export const WEEKDAYS: Record<TalkLang, string[]> = {
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
}

export const MONTHS: Record<TalkLang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
}
