import type { AppLocale } from '../i18n/types'

/**
 * Текст страницы «Об ИИ-учителе» (#/about-ai) на ru/uz/en. Каждое утверждение о хранении данных опирается на код —
 * карта «пункт → код» в docs/COMPLIANCE.md (при изменении поведения мозга правьте и этот текст, и документ).
 */
export type AboutAiSection = { id: string; title: string; items?: string[]; text?: string }
export type AboutAiStorageRow = { what: string; where: string; howLong: string }
export type AboutAiContent = {
  title: string
  lead: string
  sections: AboutAiSection[]
  storageTitle: string
  storageHead: [string, string, string]
  storage: AboutAiStorageRow[]
  contactTitle: string
  contact: string[]
  contactLink: string
  lawsTitle: string
  laws: string[]
  back: string
  updated: string
}

/** Куда писать о проблеме (пока нет юрлица и почты проекта — страница задач на GitHub). */
export const AI_CONTACT_URL = 'https://github.com/sadykoffalan2105-dev/atomlab/issues'

const RU: AboutAiContent = {
  title: 'Об ИИ-учителе',
  lead: 'ИИ-учитель ATOMLAB — помощник по химии для 7–11 классов по учебникам «Kimyo». Он объясняет и подсказывает, но не заменяет учителя: ответ ИИ носит рекомендательный характер.',
  sections: [
    {
      id: 'can',
      title: 'Что умеет',
      items: [
        'Отвечает на вопросы по химии на русском, узбекском и английском и указывает параграф учебника, на который опирается.',
        'Решает расчётные задачи: числа считает отдельный калькулятор, уравнения реакций уравниваются автоматически.',
        'Объясняет тему урока, подбирает вопросы для самопроверки, помогает разобрать домашнее задание.',
        'Понимает голос и фото задачи; рисует иллюстрации к темам (ученикам — только по готовым темам своего класса).',
      ],
    },
    {
      id: 'errs',
      title: 'Где может ошибаться',
      items: [
        'ИИ может уверенно сказать неверный факт или неправильно понять условие задачи.',
        'На узбекском языке ошибается чаще, чем на русском; почерк на фото распознаёт не всегда.',
        'Вопросы вне школьной программы он знает хуже.',
        'Проверяйте ответ по учебнику (параграф указан под ответом) и спрашивайте учителя. Нашли ошибку — нажмите «Сообщить об ошибке» под ответом.',
      ],
    },
    {
      id: 'human',
      title: 'Решения принимает человек',
      items: [
        'Проверка домашней работы, баллы и оценки от ИИ — только рекомендация. Итоговую оценку ставит учитель.',
        'ИИ не принимает решений о ученике и не передаёт оценки в журнал сам.',
      ],
    },
    {
      id: 'children',
      title: 'Дети и безопасность',
      items: [
        'Регистрация и имя не нужны. Не пишите в чат имя, телефон, адрес и другие личные данные.',
        'Грубые слова в вопросе фильтруются, ответ даётся по сути без грубости.',
        'Картинки ученикам — только по готовым учебным темам своего класса; каждая картинка проходит проверку безопасности.',
        'На сайте нет рекламы и нет передачи данных рекламным сетям.',
      ],
    },
    {
      id: 'books',
      title: 'Учебники',
      text: 'Основа знаний — школьные учебники «Kimyo» 7–11 классов. Как только появятся адреса официальных электронных копий, рядом с учебником будет ссылка на них.',
    },
  ],
  storageTitle: 'Что хранится и как долго',
  storageHead: ['Что', 'Где', 'Сколько'],
  storage: [
    { what: 'История чата по теме', where: 'Только в этой вкладке браузера', howLong: 'До закрытия вкладки или кнопки «Очистить»' },
    { what: 'Уровень и темп ученика (для подстройки ответов)', where: 'На этом устройстве', howLong: 'Пока не нажата кнопка «Забыть всё»' },
    { what: 'Тексты вопросов и ответов', where: 'На сервере ИИ-учителя не сохраняются (по умолчанию журнал ведётся только для проверок на компьютере владельца)', howLong: 'Записи из диалогов старше 90 дней не используются; логи раз в месяц архивируются, архивы старше 90 дней удаляются' },
    { what: 'Адрес IP и номер сессии', where: 'Не сохраняются. Для защиты от перегрузки в памяти сервера — только зашифрованный отпечаток', howLong: 'Сбрасывается при перезапуске сервера' },
    { what: 'Фото задачи и голос', where: 'Обрабатываются в памяти сервера на время ответа', howLong: 'Не сохраняются' },
    { what: 'Нарисованные картинки', where: 'Временная папка генератора; в журнале — только отпечаток запроса без текста', howLong: 'Файлы удаляются примерно через час' },
    { what: '«Сообщить об ошибке»', where: 'Журнал исправлений: вопрос, ответ и ваш комментарий — без имени, адреса и сессии; телефоны и почта скрываются автоматически', howLong: 'Хранится для исправления ошибок, в ответах ученикам не используется' },
    { what: 'Технические журналы сервера', where: 'Компьютер сервера', howLong: '14 дней' },
  ],
  contactTitle: 'Куда обращаться',
  contact: [
    'Ошибка в ответе — кнопка «Сообщить об ошибке» под ответом.',
    'Вопросы о данных и о работе ИИ-учителя — учителю вашей школы или команде проекта ATOMLAB:',
  ],
  contactLink: 'страница обращений проекта',
  lawsTitle: 'На чём основаны правила',
  laws: [
    'Закон РУз «О персональных данных» (ЗРУ-547) и изменения (ЗРУ-1125)',
    'Закон РУз об использовании искусственного интеллекта (ЗРУ-1115): решения — за человеком',
    'Правила этики применения искусственного интеллекта (№ 3787): пользователь знает, что говорит с ИИ',
    'Закон РУз «О гарантиях прав ребёнка» (ЗРУ-444)',
  ],
  back: 'Назад к обучению',
  updated: 'Обновлено: октябрь 2026',
}

const UZ: AboutAiContent = {
  title: 'SI-oʻqituvchi haqida',
  lead: 'ATOMLAB SI-oʻqituvchisi — «Kimyo» darsliklari boʻyicha 7–11-sinflar uchun kimyo yordamchisi. U tushuntiradi va maslahat beradi, lekin oʻqituvchining oʻrnini bosmaydi: SI javobi tavsiyaviy xarakterga ega.',
  sections: [
    {
      id: 'can',
      title: 'Nimalar qila oladi',
      items: [
        'Kimyo boʻyicha savollarga oʻzbek, rus va ingliz tillarida javob beradi va tayangan darslik paragrafini koʻrsatadi.',
        'Hisoblash masalalarini yechadi: sonlarni alohida kalkulyator hisoblaydi, reaksiya tenglamalari avtomatik tenglashtiriladi.',
        'Dars mavzusini tushuntiradi, oʻzini tekshirish uchun savollar tanlaydi, uy vazifasini tahlil qilishga yordam beradi.',
        'Ovoz va masala rasmini tushunadi; mavzularga rasm chizadi (oʻquvchilarga — faqat oʻz sinfining tayyor mavzulari boʻyicha).',
      ],
    },
    {
      id: 'errs',
      title: 'Qayerda xato qilishi mumkin',
      items: [
        'SI notoʻgʻri faktni ishonch bilan aytishi yoki masala shartini notoʻgʻri tushunishi mumkin.',
        'Oʻzbek tilida rus tiliga qaraganda koʻproq xato qiladi; rasmdagi qoʻl yozuvini har doim ham tanimaydi.',
        'Maktab dasturidan tashqari savollarni yomonroq biladi.',
        'Javobni darslik boʻyicha tekshiring (paragraf javob ostida koʻrsatilgan) va oʻqituvchidan soʻrang. Xato topsangiz — javob ostidagi «Xato haqida xabar berish» tugmasini bosing.',
      ],
    },
    {
      id: 'human',
      title: 'Qarorni inson qabul qiladi',
      items: [
        'Uy vazifasini tekshirish, SI bergan ballar va baholar — faqat tavsiya. Yakuniy bahoni oʻqituvchi qoʻyadi.',
        'SI oʻquvchi haqida qaror qabul qilmaydi va baholarni jurnalga oʻzi yubormaydi.',
      ],
    },
    {
      id: 'children',
      title: 'Bolalar va xavfsizlik',
      items: [
        'Roʻyxatdan oʻtish va ism kerak emas. Chatga ism, telefon, manzil va boshqa shaxsiy maʼlumotlarni yozmang.',
        'Savoldagi qoʻpol soʻzlar filtrlanadi, javob qoʻpolliksiz mazmunan beriladi.',
        'Oʻquvchilarga rasmlar — faqat oʻz sinfining tayyor oʻquv mavzulari boʻyicha; har bir rasm xavfsizlik tekshiruvidan oʻtadi.',
        'Saytda reklama yoʻq va maʼlumotlar reklama tarmoqlariga berilmaydi.',
      ],
    },
    {
      id: 'books',
      title: 'Darsliklar',
      text: 'Bilimlar asosi — 7–11-sinflar uchun «Kimyo» maktab darsliklari. Rasmiy elektron nusxalar manzillari paydo boʻlishi bilan darslik yonida ularga havola boʻladi.',
    },
  ],
  storageTitle: 'Nima saqlanadi va qancha muddat',
  storageHead: ['Nima', 'Qayerda', 'Qancha'],
  storage: [
    { what: 'Mavzu boʻyicha chat tarixi', where: 'Faqat shu brauzer oynasida', howLong: 'Oyna yopilguncha yoki «Tozalash» tugmasigacha' },
    { what: 'Oʻquvchining darajasi va sur’ati (javoblarni moslash uchun)', where: 'Shu qurilmada', howLong: '«Hammasini unutish» tugmasi bosilguncha' },
    { what: 'Savol va javob matnlari', where: 'SI-oʻqituvchi serverida saqlanmaydi (sukut boʻyicha jurnal faqat egasining kompyuterida tekshiruv uchun yuritiladi)', howLong: '90 kundan eski dialog yozuvlari ishlatilmaydi; loglar oyiga bir marta arxivlanadi, 90 kundan eski arxivlar oʻchiriladi' },
    { what: 'IP manzil va sessiya raqami', where: 'Saqlanmaydi. Ortiqcha yuklamadan himoya uchun server xotirasida — faqat shifrlangan iz', howLong: 'Server qayta ishga tushganda yoʻqoladi' },
    { what: 'Masala rasmi va ovoz', where: 'Javob davomida server xotirasida qayta ishlanadi', howLong: 'Saqlanmaydi' },
    { what: 'Chizilgan rasmlar', where: 'Generatorning vaqtinchalik papkasi; jurnalda — matnsiz soʻrov izi', howLong: 'Fayllar taxminan bir soatdan keyin oʻchiriladi' },
    { what: '«Xato haqida xabar berish»', where: 'Tuzatishlar jurnali: savol, javob va izohingiz — ism, manzil va sessiyasiz; telefon va pochta avtomatik yashiriladi', howLong: 'Xatolarni tuzatish uchun saqlanadi, oʻquvchilarga javoblarda ishlatilmaydi' },
    { what: 'Serverning texnik jurnallari', where: 'Server kompyuteri', howLong: '14 kun' },
  ],
  contactTitle: 'Qayerga murojaat qilish',
  contact: ['Javobdagi xato — javob ostidagi «Xato haqida xabar berish» tugmasi.', 'Maʼlumotlar va SI-oʻqituvchi ishi haqidagi savollar — maktabingiz oʻqituvchisiga yoki ATOMLAB loyihasi jamoasiga:'],
  contactLink: 'loyiha murojaatlar sahifasi',
  lawsTitle: 'Qoidalar nimaga asoslangan',
  laws: [
    'OʻzR «Shaxsga doir maʼlumotlar toʻgʻrisida»gi Qonuni (OʻRQ-547) va oʻzgartirishlar (OʻRQ-1125)',
    'Sunʼiy intellektdan foydalanish toʻgʻrisidagi OʻzR Qonuni (OʻRQ-1115): qaror — inson zimmasida',
    'Sunʼiy intellektni qoʻllash etikasi qoidalari (№ 3787): foydalanuvchi SI bilan gaplashayotganini biladi',
    'OʻzR «Bola huquqlarining kafolatlari toʻgʻrisida»gi Qonuni (OʻRQ-444)',
  ],
  back: 'Taʼlimga qaytish',
  updated: 'Yangilangan: 2026-yil oktyabr',
}

const EN: AboutAiContent = {
  title: 'About the AI teacher',
  lead: 'The ATOMLAB AI teacher is a chemistry helper for grades 7–11 built on the «Kimyo» textbooks. It explains and gives hints but does not replace the teacher: AI answers are advisory only.',
  sections: [
    {
      id: 'can',
      title: 'What it can do',
      items: [
        'Answers chemistry questions in Russian, Uzbek and English and names the textbook section it relies on.',
        'Solves calculation problems: a separate calculator computes the numbers, reaction equations are balanced automatically.',
        'Explains the lesson topic, picks self-check questions, helps to go through homework.',
        'Understands voice and a photo of a problem; draws topic illustrations (students — only ready-made topics of their grade).',
      ],
    },
    {
      id: 'errs',
      title: 'Where it can be wrong',
      items: [
        'The AI may state a wrong fact confidently or misread the problem.',
        'It makes more mistakes in Uzbek than in Russian; handwriting on photos is not always recognised.',
        'It knows questions outside the school curriculum less well.',
        'Check the answer against the textbook (the section is shown under the answer) and ask your teacher. Found a mistake? Press «Report a mistake» under the answer.',
      ],
    },
    {
      id: 'human',
      title: 'A human makes the decisions',
      items: ['Homework checks, points and grades from the AI are recommendations only. The final grade is set by the teacher.', 'The AI makes no decisions about a student and never sends grades to the school register by itself.'],
    },
    {
      id: 'children',
      title: 'Children and safety',
      items: [
        'No registration and no name needed. Do not write your name, phone, address or other personal data in the chat.',
        'Rude words in a question are filtered; the answer stays on topic and polite.',
        'Students can draw pictures only for ready-made topics of their grade; every picture passes a safety check.',
        'There are no ads on the site and no data goes to ad networks.',
      ],
    },
    {
      id: 'books',
      title: 'Textbooks',
      text: 'The knowledge base is the school textbooks «Kimyo» for grades 7–11. As soon as the addresses of official electronic copies are available, a link to them will appear next to the textbook.',
    },
  ],
  storageTitle: 'What is stored and for how long',
  storageHead: ['What', 'Where', 'How long'],
  storage: [
    { what: 'Chat history of a topic', where: 'Only in this browser tab', howLong: 'Until the tab is closed or «Clear» is pressed' },
    { what: 'Student level and pace (to adapt answers)', where: 'On this device', howLong: 'Until «Forget everything» is pressed' },
    { what: 'Question and answer texts', where: 'Not stored on the AI teacher server (by default the log is kept only for tests on the owner’s computer)', howLong: 'Dialog records older than 90 days are not used; logs are archived monthly, archives older than 90 days are deleted' },
    { what: 'IP address and session number', where: 'Not stored. For overload protection the server memory keeps only an encrypted fingerprint', howLong: 'Reset when the server restarts' },
    { what: 'Problem photos and voice', where: 'Processed in server memory while answering', howLong: 'Not stored' },
    { what: 'Drawn pictures', where: 'Temporary folder of the generator; the log keeps only a fingerprint of the request, no text', howLong: 'Files are deleted after about an hour' },
    { what: '«Report a mistake»', where: 'Corrections log: question, answer and your comment — no name, address or session; phones and e-mails are hidden automatically', howLong: 'Kept to fix mistakes, never used in answers to students' },
    { what: 'Technical server logs', where: 'Server computer', howLong: '14 days' },
  ],
  contactTitle: 'Contact',
  contact: ['A mistake in an answer — the «Report a mistake» button under the answer.', 'Questions about data and how the AI teacher works — your school teacher or the ATOMLAB project team:'],
  contactLink: 'project issue page',
  lawsTitle: 'What the rules are based on',
  laws: [
    'Law of Uzbekistan «On personal data» (ZRU-547) and amendments (ZRU-1125)',
    'Law of Uzbekistan on the use of artificial intelligence (ZRU-1115): decisions stay with a human',
    'Rules of ethics for the use of artificial intelligence (No. 3787): users know they talk to an AI',
    'Law of Uzbekistan «On guarantees of the rights of the child» (ZRU-444)',
  ],
  back: 'Back to learning',
  updated: 'Updated: October 2026',
}

export function aboutAiContent(locale: AppLocale | string): AboutAiContent {
  return locale === 'uz' ? UZ : locale === 'en' ? EN : RU
}
