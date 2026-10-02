/**
 * Банк реплик учителя для разговорных намерений (RU/EN/UZ): тёплый человеческий тон,
 * 6+ вариантов на намерение, без повтора подряд. Химических фактов здесь нет —
 * только разговор; offtopic мягко возвращает к химии с конкретным предложением.
 */
import type { Intent } from './intentFeatures'

export type ReplyLang = 'ru' | 'en' | 'uz'
type TalkIntent = 'greet' | 'bye' | 'thanks' | 'how_are_you' | 'joke' | 'about_teacher' | 'offtopic' | 'gibberish' | 'encourage' | 'feedback_pos' | 'feedback_neg'

const BANK: Record<ReplyLang, Record<TalkIntent, string[]>> = {
  ru: {
    greet: [
      'Привет! Рад тебя видеть. С чего начнём — вопрос по теме или задача?',
      'Здравствуй! Я здесь. Спрашивай про любую тему из учебника — разберём вместе.',
      'Привет-привет! Готов помочь с химией. Что сегодня разбираем?',
      'Здравствуй! Хорошо, что заглянул. Есть вопрос или хочешь, чтобы я тебя проверил?',
      'Привет! Устраивайся. Можем повторить тему, решить задачу или просто поболтать о химии.',
      'Рад встрече! Скажи, что сейчас проходите в школе — подстроюсь.',
      'Привет! Если не знаешь с чего начать — спроси «что такое моль» или «проверь меня».',
    ],
    bye: [
      'Пока! Хорошо поработали. Возвращайся, когда захочешь.',
      'До встречи! Если что-то не понятно останется — я тут.',
      'Удачи! Отдохни как следует — мозгу нужна пауза, чтобы всё уложилось.',
      'Пока-пока. Горжусь тем, что ты сегодня занимался.',
      'До свидания! Завтра продолжим с того места, где остановились.',
      'Счастливо! Запомни главное из сегодняшнего — и до скорого.',
    ],
    thanks: [
      'Пожалуйста! Мне правда приятно, когда становится понятно.',
      'Всегда рад помочь. Будут вопросы — спрашивай без стеснения.',
      'Не за что! Ты сам хорошо поработал.',
      'Обращайся! Для этого я и здесь.',
      'Рад, что пригодилось. Хочешь закрепить — попроси «проверь меня».',
      'Пожалуйста. Если захочешь разобрать что-то ещё — я рядом.',
    ],
    how_are_you: [
      'У меня отлично — особенно когда кто-то спрашивает про химию. А у тебя как?',
      'Всё хорошо, спасибо! Сегодня уже разобрали пару интересных тем. Как твои дела?',
      'Нормально, работаю. А ты как настроен — учиться или сначала поболтать?',
      'Хорошо! Как твоё настроение? Если устал — давай начнём с чего-нибудь лёгкого.',
      'Прекрасно. А у тебя как школа? Что проходите?',
      'Бодро! Кофе мне не нужен, а вот хороший вопрос — очень. Есть такой?',
    ],
    joke: [
      'Два атома столкнулись. Один: «Кажется, я потерял электрон». — «Ты уверен?» — «Да, я положительно уверен!»',
      'Почему химики любят нитраты? Потому что они дешевле, чем дневные тарифы.',
      'Учитель: «Назови формулу воды». Ученик: «H, I, J, K, L, M, N, O». — «Что?» — «Вы же сами сказали: от H до O!»',
      'Что сказал один ион другому? «У меня на тебя глаз положен — отрицательный».',
      'Химик заходит в аптеку: «Дайте ацетилсалициловую кислоту». — «Аспирин?» — «Да, всё время забываю это слово».',
      'Хелий заходит в бар. Бармен: «Мы инертные газы не обслуживаем». Хелий не реагирует.',
      'Почему нельзя доверять атомам? Они составляют всё.',
    ],
    about_teacher: [
      'Я — учитель химии ATOMLAB. Работаю прямо у тебя в браузере, без интернета, и отвечаю только по учебникам Kimyo 7–11 и данным проекта. Выдумывать не стану.',
      'Я твой помощник по химии: объясняю темы из учебника, считаю молярные массы, задаю вопросы на проверку, помню, что тебе трудно. Всё офлайн и бесплатно.',
      'Меня можно назвать электронным репетитором. Знания — из школьных учебников 7–11 классов и каталога веществ; если чего-то в них нет — честно скажу.',
      'Я учитель-программа. Умею: объяснить тему, привести пример из учебника, посчитать массу и моли, устроить опрос. Не умею: читать интернет и придумывать факты.',
      'Я здесь, чтобы химия стала понятной. Спроси «что такое…», «почему…», «посчитай…» — и увидишь, что я умею.',
      'Я — ATOMLAB-учитель. Учусь на твоих поправках: если я не так понял вопрос, скажи — запомню.',
    ],
    offtopic: [
      'Это уже не по химии, а я в ней живу. Зато могу рассказать, {topic}. Хочешь?',
      'Про это я не знаю — у меня в голове только учебники химии. Давай вернёмся к ним: {topic}?',
      'Интересный вопрос, но вне моей темы. Предлагаю взамен: {topic}. Или задай свой вопрос по химии.',
      'Я учитель химии и честно не разбираюсь в этом. Зато здесь есть что разобрать — например, {topic}.',
      'Тут я бессилен: интернета у меня нет, а в учебниках этого не пишут. Давай про химию — {topic}?',
      'Давай вернёмся к нашей теме. Могу предложить: {topic}. Или скажи, что проходите в школе.',
    ],
    gibberish: [
      'Кажется, что-то не напечаталось. Напиши вопрос словами — например, «что такое оксиды».',
      'Не разобрал. Попробуй ещё раз: тема, вещество или формула — и я подхвачу.',
      'Хм, похоже на случайные буквы. Если это была проверка — я тут! Задай вопрос по химии.',
      'Не понял сообщение. Можно словами или формулой, например «H2SO4».',
      'Это я не расшифровал. Спроси как есть — даже с опечатками пойму.',
      'Похоже на опечатку. Хочешь — предложу тему: «проверь меня» или «молярная масса воды».',
    ],
    encourage: [
      'Понимаю, бывает тяжело. Сделай паузу на пару минут, а потом возьмём одну маленькую задачу — и получится.',
      'Трудно — значит, ты учишься по-настоящему. Давай разберём медленно, по одному шагу.',
      'Ты не один: эту тему все проходят с трудом. Скажи, где именно застрял, — начнём оттуда.',
      'Не сдавайся. Я объясню проще и столько раз, сколько нужно — без оценок и упрёков.',
      'Устал — это нормально. Отдохни, попей воды, а потом попроси меня объяснить «проще».',
      'Ошибки — часть пути. Давай найдём, что именно не сходится, и починим.',
      'Ты уже сделал самое сложное — не бросил и спросил. Дальше вместе.',
    ],
    feedback_pos: [
      'Отлично! Рад, что сложилось. Хочешь закрепить — скажи «проверь меня».',
      'Здорово! Значит, идём верным путём. Что дальше?',
      'Класс, спасибо за обратную связь. Продолжаем?',
      'Ура! Люблю, когда щёлкает. Следующая тема или ещё вопрос?',
      'Супер. Запомню, что такой стиль тебе подходит.',
      'Приятно слышать! Если захочешь глубже — скажи «подробнее».',
    ],
    feedback_neg: [
      'Понял, спасибо, что сказал. Переформулируй вопрос — я отвечу иначе и запомню поправку.',
      'Жаль, что не попал. Скажи, что именно ты хотел узнать, — попробую ещё раз.',
      'Принято. Давай уточним: тебе нужно определение, пример или решение?',
      'Спасибо за честность. Напиши вопрос чуть иначе — подстроюсь.',
      'Хорошо, учту. Если ответ был длинным — скажи «проще», если коротким — «подробнее».',
      'Исправлюсь. Уточни тему одним словом — и я отвечу точнее.',
    ],
  },
  en: {
    greet: [
      'Hi! Good to see you. What shall we start with — a topic or a problem?',
      'Hello! I’m here. Ask about any topic from the textbook and we’ll work it out together.',
      'Hey there! Ready to help with chemistry. What are we covering today?',
      'Hello! Glad you dropped by. Got a question, or want me to quiz you?',
      'Hi! Make yourself comfortable. We can review a topic, solve a problem or just talk chemistry.',
      'Nice to meet you! Tell me what you are studying at school and I’ll adjust.',
    ],
    bye: ['Bye! Good work today. Come back any time.', 'See you! If anything stays unclear, I’m here.', 'Good luck! Take a proper rest — the brain needs a pause to settle things.', 'Bye-bye. Proud of you for studying today.', 'Goodbye! Tomorrow we continue where we stopped.', 'Take care! Keep the main idea of today in mind — see you soon.'],
    thanks: ['You’re welcome! It really makes me happy when things click.', 'Always glad to help. Ask away whenever you like.', 'No problem! You did the hard work.', 'Any time! That’s what I’m here for.', 'Glad it helped. Want to lock it in? Say “quiz me”.', 'You’re welcome. If you want to go through something else, I’m right here.'],
    how_are_you: ['I’m great — especially when someone asks about chemistry. How about you?', 'All good, thanks! Already went through a couple of nice topics today. How are you?', 'Doing fine, working away. Are you in the mood to study or chat first?', 'Good! How’s your mood? If you’re tired, let’s start with something light.', 'Wonderful. How is school? What are you covering?', 'Energetic! I don’t need coffee, but a good question — very much. Got one?'],
    joke: ['Two atoms bump into each other. “I think I lost an electron.” — “Are you sure?” — “Yes, I’m positive!”', 'Why do chemists like nitrates? They’re cheaper than day rates.', 'Helium walks into a bar. The bartender says: “We don’t serve noble gases.” Helium doesn’t react.', 'Never trust atoms — they make up everything.', 'What did one ion say to the other? “I’ve got my ion you.”', 'A chemist walks into a pharmacy: “Acetylsalicylic acid, please.” — “Aspirin?” — “Yes, I keep forgetting that word.”'],
    about_teacher: ['I’m the ATOMLAB chemistry teacher. I run right in your browser, offline, and answer only from the Kimyo 7–11 textbooks and the project data. I never make things up.', 'I’m your chemistry helper: I explain textbook topics, calculate molar masses, quiz you and remember what you find hard. Offline and free.', 'Think of me as an electronic tutor. My knowledge comes from the school textbooks for grades 7–11 and the substance catalog; if something isn’t there, I’ll say so.', 'I’m a teacher program. I can explain a topic, give a textbook example, calculate masses and moles, run a quiz. I can’t browse the internet or invent facts.', 'I’m here to make chemistry clear. Ask “what is…”, “why…”, “calculate…” and see what I can do.', 'I’m the ATOMLAB teacher. I learn from your corrections: if I misread a question, tell me and I’ll remember.'],
    offtopic: ['That’s outside chemistry, and chemistry is where I live. But I can tell you about {topic}. Want that?', 'I don’t know about that — only chemistry textbooks in my head. Shall we get back to them: {topic}?', 'Interesting, but not my subject. Instead I can offer {topic}, or ask your own chemistry question.', 'I’m a chemistry teacher and honestly not familiar with that. Here’s something we can explore: {topic}.', 'No internet here, and the textbooks don’t cover it. Let’s talk chemistry — {topic}?', 'Let’s get back to our topic. I suggest {topic}, or tell me what you’re studying at school.'],
    gibberish: ['Looks like something didn’t type right. Write your question in words, e.g. “what are oxides”.', 'I couldn’t parse that. Try again: a topic, a substance or a formula — I’ll pick it up.', 'Hmm, looks like random letters. If that was a test — I’m here! Ask a chemistry question.', 'I didn’t get the message. Words or a formula, like “H2SO4”, work fine.', 'Couldn’t decode that. Just ask as you can — typos are fine.', 'Looks like a typo. Want a suggestion: “quiz me” or “molar mass of water”.'],
    encourage: ['I get it, it can be hard. Take a two-minute break, then we’ll take one small problem — and it’ll work.', 'Hard means you are really learning. Let’s go slowly, one step at a time.', 'You’re not alone: everyone struggles with this one. Tell me exactly where you’re stuck and we start there.', 'Don’t give up. I’ll explain more simply, as many times as needed — no grades, no judgment.', 'Being tired is normal. Rest, drink some water, then ask me to explain “simpler”.', 'Mistakes are part of the path. Let’s find what doesn’t add up and fix it.', 'You already did the hardest thing — you didn’t quit and you asked. The rest we do together.'],
    feedback_pos: ['Great! Glad it clicked. Want to lock it in? Say “quiz me”.', 'Awesome! We’re on the right track. What’s next?', 'Nice, thanks for the feedback. Shall we go on?', 'Yay! I love when it clicks. Next topic or another question?', 'Super. I’ll remember this style suits you.', 'Good to hear! If you want to go deeper, say “more detail”.'],
    feedback_neg: ['Got it, thanks for telling me. Rephrase the question — I’ll answer differently and remember the correction.', 'Sorry I missed. Tell me what exactly you wanted to know and I’ll try again.', 'Noted. Let’s clarify: do you need a definition, an example or a solution?', 'Thanks for being honest. Write the question a bit differently and I’ll adjust.', 'Okay, noted. If the answer was long, say “simpler”; if short, say “more detail”.', 'I’ll do better. Name the topic in one word and I’ll answer more precisely.'],
  },
  uz: {
    greet: ['Salom! Sizni ko‘rganimdan xursandman. Nimadan boshlaymiz — mavzu yoki masala?', 'Assalomu alaykum! Men shu yerdaman. Darslikdagi istalgan mavzuni so‘rang — birga ko‘ramiz.', 'Salom-salom! Kimyoda yordam berishga tayyorman. Bugun nimani o‘rganamiz?', 'Salom! Kelganingiz yaxshi. Savolingiz bormi yoki sizni tekshirib ko‘raymi?', 'Salom! Mavzuni takrorlashimiz, masala yechishimiz yoki shunchaki kimyo haqida suhbatlashishimiz mumkin.', 'Ko‘rishganimizdan xursandman! Maktabda nimani o‘tayotganingizni ayting — moslashaman.'],
    bye: ['Xayr! Yaxshi ishladik. Istagan vaqt qayting.', 'Ko‘rishguncha! Tushunarsiz narsa qolsa — men shu yerdaman.', 'Omad! Yaxshi dam oling — miyaga tanaffus kerak.', 'Xayr-xayr. Bugun o‘qiganingiz bilan faxrlanaman.', 'Xayr! Ertaga to‘xtagan joyimizdan davom etamiz.', 'Yaxshi qoling! Bugungi asosiy fikrni eslab qoling — tez orada ko‘rishamiz.'],
    thanks: ['Arzimaydi! Tushunarli bo‘lsa — men ham xursandman.', 'Har doim yordam berishga tayyorman. Savollar bo‘lsa — so‘rang.', 'Hech qisi yo‘q! Asosiy ishni o‘zingiz qildingiz.', 'Marhamat! Men shuning uchun shu yerdaman.', 'Foydali bo‘lganidan xursandman. Mustahkamlash uchun «meni tekshiring» deng.', 'Arzimaydi. Yana nimanidir ko‘rmoqchi bo‘lsangiz — men yoningizdaman.'],
    how_are_you: ['Menda a‘lo — ayniqsa kimyo haqida so‘rashsa. Sizda-chi?', 'Hammasi yaxshi, rahmat! Bugun bir nechta qiziqarli mavzuni ko‘rdik. Ishlaringiz qalay?', 'Yaxshi, ishlayapman. Siz o‘qishga tayyormisiz yoki avval suhbatlashamizmi?', 'Yaxshi! Kayfiyatingiz qanday? Charchagan bo‘lsangiz — osonroq narsadan boshlaymiz.', 'A‘lo. Maktab qalay? Nimani o‘tayapsizlar?', 'Tetikman! Menga kofe kerak emas, lekin yaxshi savol — juda kerak. Bormi?'],
    joke: ['Ikki atom to‘qnashdi. Biri: «Elektronimni yo‘qotdim shekilli». — «Ishonchingiz komilmi?» — «Ha, musbat ishonaman!»', 'Geliy barga kiradi. Barmen: «Biz inert gazlarga xizmat qilmaymiz». Geliy reaksiyaga kirishmaydi.', 'Atomlarga ishonmang — ular hamma narsani tashkil qiladi.', 'Nega kimyogarlar nitratlarni yaxshi ko‘radi? Chunki ular kunduzgi tariflardan arzon.', 'Kimyogar dorixonaga kiradi: «Atsetilsalitsil kislota bering». — «Aspirinmi?» — «Ha, shu so‘zni doim unutaman».', 'Bir ion ikkinchisiga nima dedi? «Senga ko‘zim tushdi — manfiy».'],
    about_teacher: ['Men ATOMLAB kimyo o‘qituvchisiman. Brauzeringizda, internetsiz ishlayman va faqat Kimyo 7–11 darsliklari hamda loyiha ma‘lumotlari asosida javob beraman. O‘ylab topmayman.', 'Men kimyo bo‘yicha yordamchingizman: darslik mavzularini tushuntiraman, molyar massani hisoblayman, savollar beraman, nima qiyin bo‘lganini eslab qolaman. Oflayn va bepul.', 'Meni elektron repetitor deyish mumkin. Bilimlarim — 7–11 sinf darsliklari va moddalar katalogidan; u yerda bo‘lmasa — rostini aytaman.', 'Men o‘qituvchi-dasturman. Mavzuni tushuntira olaman, darslikdan misol keltira olaman, massa va molni hisoblayman, so‘rov o‘tkazaman. Internetni o‘qiy olmayman va faktlarni o‘ylab topmayman.', 'Men kimyoni tushunarli qilish uchun shu yerdaman. «… nima», «nega …», «hisoblang …» deb so‘rang.', 'Men ATOMLAB o‘qituvchisiman. Tuzatishlaringizdan o‘rganaman: savolni noto‘g‘ri tushunsam — ayting, eslab qolaman.'],
    offtopic: ['Bu kimyo emas, men esa kimyoda yashayman. Lekin {topic} haqida gapirib bera olaman. Xohlaysizmi?', 'Bu haqda bilmayman — boshimda faqat kimyo darsliklari. Ularga qaytaylik: {topic}?', 'Qiziq savol, lekin mavzuimdan tashqarida. O‘rniga {topic} ni taklif qilaman, yoki o‘z kimyo savolingizni bering.', 'Men kimyo o‘qituvchisiman va bunda rostdan ham bilimdon emasman. Lekin mana buni ko‘rishimiz mumkin: {topic}.', 'Bu yerda internet yo‘q, darsliklarda ham yozilmagan. Kimyo haqida gaplashaylik — {topic}?', 'Mavzuimizga qaytaylik. {topic} ni taklif qilaman, yoki maktabda nimani o‘tayotganingizni ayting.'],
    gibberish: ['Nimadir noto‘g‘ri yozilgan shekilli. Savolni so‘zlar bilan yozing, masalan «oksidlar nima».', 'Tushunmadim. Yana urinib ko‘ring: mavzu, modda yoki formula — men ilib olaman.', 'Hm, tasodifiy harflarga o‘xshaydi. Agar bu tekshiruv bo‘lsa — men shu yerdaman! Kimyodan savol bering.', 'Xabarni tushunmadim. So‘zlar yoki formula bilan, masalan «H2SO4».', 'Buni o‘qiy olmadim. Qanday bo‘lsa shunday so‘rang — xatolar bilan ham tushunaman.', 'Xatoga o‘xshaydi. Taklif: «meni tekshiring» yoki «suvning molyar massasi».'],
    encourage: ['Tushunaman, qiyin bo‘ladi. Ikki daqiqa tanaffus qiling, keyin bitta kichik masala olamiz — chiqadi.', 'Qiyin — demak, siz rostdan o‘rganayapsiz. Sekin, bir qadamdan boraylik.', 'Siz yolg‘iz emassiz: bu mavzu hammaga qiyin. Qayerda qolganingizni ayting — shundan boshlaymiz.', 'Taslim bo‘lmang. Soddaroq, kerak bo‘lsa qayta-qayta tushuntiraman — baholarsiz.', 'Charchash — tabiiy. Dam oling, suv iching, keyin «soddaroq» deb so‘rang.', 'Xatolar — yo‘lning bir qismi. Nima to‘g‘ri kelmayotganini topib, tuzatamiz.', 'Siz eng qiyinini qildingiz — tashlab ketmadingiz va so‘radingiz. Qolganini birga qilamiz.'],
    feedback_pos: ['A‘lo! Tushunarli bo‘lganidan xursandman. Mustahkamlash uchun «meni tekshiring» deng.', 'Zo‘r! To‘g‘ri yo‘ldamiz. Keyingi nima?', 'Yaxshi, fikr uchun rahmat. Davom etamizmi?', 'Ura! Tushunganingiz yoqadi. Keyingi mavzu yoki yana savol?', 'Zo‘r. Bu uslub sizga mos ekanini eslab qolaman.', 'Eshitish yoqimli! Chuqurroq istasangiz — «batafsil» deng.'],
    feedback_neg: ['Tushundim, aytganingiz uchun rahmat. Savolni boshqacha yozing — boshqacha javob beraman va tuzatishni eslab qolaman.', 'Afsus, to‘g‘ri kelmadi. Aynan nimani bilmoqchi edingiz — yana urinib ko‘raman.', 'Qabul qilindi. Aniqlashtiraylik: ta‘rif, misol yoki yechim kerakmi?', 'Rostgo‘yligingiz uchun rahmat. Savolni biroz boshqacha yozing — moslashaman.', 'Xo‘p, hisobga olaman. Javob uzun bo‘lsa — «soddaroq», qisqa bo‘lsa — «batafsil» deng.', 'Tuzataman. Mavzuni bir so‘z bilan ayting — aniqroq javob beraman.'],
  },
}

/** Конкретные предложения по химии для «вернуться к теме» (названия школьных тем из учебников). */
const TOPIC_OFFERS: Record<ReplyLang, string[]> = {
  ru: ['что такое моль и как считать молярную массу', 'почему кислоты меняют цвет индикатора', 'как получают кислород в лаборатории', 'чем отличаются оксиды, кислоты, основания и соли', 'как расставить коэффициенты в уравнении', 'как устроена периодическая таблица'],
  en: ['what a mole is and how to find molar mass', 'why acids change the indicator colour', 'how oxygen is obtained in the lab', 'how oxides, acids, bases and salts differ', 'how to balance an equation', 'how the periodic table is organised'],
  uz: ['mol nima va molyar massa qanday hisoblanadi', 'nega kislotalar indikator rangini o‘zgartiradi', 'laboratoriyada kislorod qanday olinadi', 'oksidlar, kislotalar, asoslar va tuzlar qanday farqlanadi', 'tenglamada koeffitsiyentlar qanday qo‘yiladi', 'davriy jadval qanday tuzilgan'],
}

const lastPick = new Map<string, number>()
let rng: () => number = Math.random
/** Для тестов: детерминированный генератор. */
export function setReplyRandom(fn: () => number): void {
  rng = fn
}

function pickNoRepeat(key: string, list: string[]): string {
  if (list.length === 1) return list[0]!
  const prev = lastPick.get(key)
  let idx = Math.floor(rng() * list.length)
  if (idx === prev) idx = (idx + 1 + Math.floor(rng() * (list.length - 1))) % list.length
  lastPick.set(key, idx)
  return list[idx]!
}

export function isTalkReplyIntent(intent: Intent | string): intent is TalkIntent {
  return intent in BANK.ru
}

/**
 * Реплика учителя для разговорного намерения. `topic` — тема урока (для offtopic);
 * без неё берём конкретное предложение из списка школьных тем.
 */
export function replyForIntent(intent: Intent | string, lang: ReplyLang, opts: { topic?: string } = {}): string | null {
  if (!isTalkReplyIntent(intent)) return null
  const l: ReplyLang = BANK[lang] ? lang : 'ru'
  let text = pickNoRepeat(`${l}:${intent}`, BANK[l][intent])
  if (text.includes('{topic}')) {
    const offer = opts.topic?.trim()
      ? l === 'ru'
        ? `тема урока — «${opts.topic.trim()}»`
        : l === 'en'
          ? `the lesson topic — “${opts.topic.trim()}”`
          : `dars mavzusi — «${opts.topic.trim()}»`
      : pickNoRepeat(`${l}:offer`, TOPIC_OFFERS[l])
    text = text.replace('{topic}', offer)
  }
  return text
}
