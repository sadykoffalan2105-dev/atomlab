import type { AppLocale } from '../../../i18n/types'

/**
 * Подписи «честности ИИ» в чате учителя: рекомендательный характер ответа, «Сообщить об ошибке», ссылка на #/about-ai.
 * Отдельный маленький словарь RU/UZ/EN (как bentoHubI18n), чтобы не раздувать общие messages*.ts.
 */
const RU = {
  advisory: 'Ответ ИИ носит рекомендательный характер.',
  aboutLink: 'Об ИИ-учителе',
  report: 'Сообщить об ошибке',
  reportTitle: 'Что не так в ответе?',
  reasonWrong: 'Ошибка в фактах или расчёте',
  reasonUnclear: 'Непонятно объяснено',
  reasonUnsafe: 'Небезопасно или неуместно',
  reasonLanguage: 'Не тот язык',
  reasonOther: 'Другое',
  commentLabel: 'Комментарий (необязательно)',
  commentHint: 'Не пишите имя, телефон и другие личные данные. Отправятся только вопрос, ответ и ваш комментарий.',
  send: 'Отправить',
  cancel: 'Отмена',
  sending: 'Отправляю…',
  sent: 'Спасибо! Сообщение получено — ответ проверят.',
  offline: 'Сервер ИИ-учителя сейчас недоступен — расскажите об ошибке учителю в классе.',
  rate: 'Сообщений слишком много подряд — попробуйте через минуту.',
  error: 'Не удалось отправить. Попробуйте позже.',
}

type Dict = typeof RU

const UZ: Dict = {
  advisory: 'SI javobi tavsiyaviy xarakterga ega.',
  aboutLink: 'SI-oʻqituvchi haqida',
  report: 'Xato haqida xabar berish',
  reportTitle: 'Javobda nima notoʻgʻri?',
  reasonWrong: 'Fakt yoki hisobda xato',
  reasonUnclear: 'Tushunarsiz tushuntirilgan',
  reasonUnsafe: 'Xavfli yoki oʻrinsiz',
  reasonLanguage: 'Boshqa tilda',
  reasonOther: 'Boshqa',
  commentLabel: 'Izoh (ixtiyoriy)',
  commentHint: 'Ism, telefon va boshqa shaxsiy maʼlumotlarni yozmang. Faqat savol, javob va izohingiz yuboriladi.',
  send: 'Yuborish',
  cancel: 'Bekor qilish',
  sending: 'Yuborilmoqda…',
  sent: 'Rahmat! Xabar qabul qilindi — javob tekshiriladi.',
  offline: 'SI-oʻqituvchi serveri hozir ishlamayapti — xato haqida sinfda oʻqituvchiga ayting.',
  rate: 'Xabarlar juda koʻp — bir daqiqadan keyin urinib koʻring.',
  error: 'Yuborib boʻlmadi. Keyinroq urinib koʻring.',
}

const EN: Dict = {
  advisory: 'AI answers are advisory only.',
  aboutLink: 'About the AI teacher',
  report: 'Report a mistake',
  reportTitle: 'What is wrong with the answer?',
  reasonWrong: 'Wrong fact or calculation',
  reasonUnclear: 'Unclear explanation',
  reasonUnsafe: 'Unsafe or inappropriate',
  reasonLanguage: 'Wrong language',
  reasonOther: 'Other',
  commentLabel: 'Comment (optional)',
  commentHint: 'Do not write your name, phone or other personal data. Only the question, the answer and your comment are sent.',
  send: 'Send',
  cancel: 'Cancel',
  sending: 'Sending…',
  sent: 'Thank you! Report received — the answer will be checked.',
  offline: 'The AI teacher server is offline right now — tell your teacher about the mistake in class.',
  rate: 'Too many reports in a row — try again in a minute.',
  error: 'Could not send. Please try later.',
}

export type AiNoticeKey = keyof Dict

export function aiNoticeText(locale: AppLocale | string, key: AiNoticeKey): string {
  const d = locale === 'uz' ? UZ : locale === 'en' ? EN : RU
  return d[key]
}
