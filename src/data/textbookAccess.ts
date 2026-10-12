/**
 * Учебники Kimyo 7–11: как сайт отдаёт PDF (docs/COMPLIANCE.md, раздел «Учебники и авторские права»).
 *
 *   mode 'site-pdf'      — как сейчас (умолчание): PDF лежат на сайте (public/textbooks) и открываются во встроенном
 *                          просмотре; если для класса задан officialUrl — рядом ссылка «Официальная электронная копия».
 *   mode 'official-link' — PDF с сайта не открываются: вместо просмотра и ссылки на файл — ссылка на официальную
 *                          электронную копию (officialUrl класса, иначе officialPortalUrl). Файлы из public/ при этом
 *                          владелец убирает сам (флаг только переключает интерфейс).
 *
 * Решение — за владельцем (письменное разрешение РЦО / издательства). Переключение: VITE_TEXTBOOK_PDF=official
 * при сборке или правка TEXTBOOK_ACCESS ниже; адреса официальных копий владелец вписывает сюда (пусто — ссылки нет).
 */
export type TextbookAccessMode = 'site-pdf' | 'official-link'
type Grade = 'g7' | 'g8' | 'g9' | 'g10' | 'g11'

function envMode(): TextbookAccessMode | null {
  try {
    const v = String((import.meta as { env?: Record<string, unknown> }).env?.VITE_TEXTBOOK_PDF ?? '').trim().toLowerCase()
    if (v === 'official' || v === 'official-link') return 'official-link'
    if (v === 'site' || v === 'site-pdf') return 'site-pdf'
  } catch {
    /* вне Vite (selftest) — умолчание */
  }
  return null
}

export const TEXTBOOK_ACCESS: {
  mode: TextbookAccessMode
  /** общий портал официальных электронных учебников (если для класса нет своей ссылки) */
  officialPortalUrl: string
  /** ссылка на официальную электронную копию учебника класса */
  officialUrl: Record<Grade, string>
} = {
  mode: envMode() ?? 'site-pdf',
  officialPortalUrl: '',
  officialUrl: { g7: '', g8: '', g9: '', g10: '', g11: '' },
}

/** PDF учебника можно открывать с сайта (умолчание — да, пока владелец не переключил флаг). */
export function textbookPdfAllowed(): boolean {
  return TEXTBOOK_ACCESS.mode !== 'official-link'
}

/** Официальная электронная копия учебника класса (null — не задана). */
export function textbookOfficialUrl(gradeId: string): string | null {
  const own = (TEXTBOOK_ACCESS.officialUrl as Record<string, string | undefined>)[gradeId]
  const url = (own || TEXTBOOK_ACCESS.officialPortalUrl || '').trim()
  return /^https:\/\//.test(url) ? url : null
}

const LABELS = {
  ru: { official: 'Официальная электронная копия', unavailable: 'Учебник открывается на официальном ресурсе.', none: 'Ссылка на официальную копию учебника появится позже.' },
  uz: { official: 'Rasmiy elektron nusxa', unavailable: 'Darslik rasmiy manbada ochiladi.', none: 'Darslikning rasmiy nusxasiga havola keyinroq paydo boʻladi.' },
  en: { official: 'Official electronic copy', unavailable: 'The textbook opens on the official website.', none: 'A link to the official copy of the textbook will appear later.' },
}

export function textbookAccessLabel(locale: string, key: keyof (typeof LABELS)['ru']): string {
  return (locale === 'uz' ? LABELS.uz : locale === 'en' ? LABELS.en : LABELS.ru)[key]
}
