/**
 * Анти-эхо: распознанный текст, который совпадает с речью учителя, — это
 * колонки, попавшие в микрофон, а не ученик. Чистый модуль.
 */

/** Нормализация для сравнения «эхо учителя» vs реплика ученика. */
export function normalizeEcho(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeEcho(text).split(' ').filter((t) => t.length >= 3))
}

/** Высокое пересечение токенов / подстрока → это эхо озвучки учителя. */
export function looksLikeTeacherEcho(userText: string, teacherText: string): boolean {
  const u = normalizeEcho(userText)
  const t = normalizeEcho(teacherText)
  if (!u || u.length < 4) return false
  if (!t) return false
  // Короткая самостоятельная реплика («да», «понял», «оксид») — не эхо.
  if (u.split(' ').length <= 3 && u.length <= 24 && !t.startsWith(u)) return false
  if (t.includes(u)) return true
  // Реплика ученика содержит начало фразы учителя — только для достаточно длинной фразы
  // (короткое «Смотри.» внутри «смотри я не понял» — не эхо).
  if (t.length >= 16 && u.includes(t.slice(0, Math.min(t.length, 80)))) return true
  const ut = tokenSet(u)
  const tt = tokenSet(t)
  if (ut.size === 0) return false
  let hit = 0
  for (const tok of ut) if (tt.has(tok)) hit++
  const overlap = hit / ut.size
  // Строже: меньше ложных «эхо» на нормальные ответы ученика.
  return ut.size <= 4 ? overlap >= 0.85 : overlap >= 0.7
}

/** Эхо против любого из недавних текстов учителя. */
export function looksLikeAnyTeacherEcho(userText: string, teacherTexts: readonly string[]): boolean {
  return teacherTexts.some((t) => t && looksLikeTeacherEcho(userText, t))
}

/** Похожи ли два распознавания одной и той же фразы (дедупликация interim→final). */
export function sameUtterance(a: string, b: string): boolean {
  const x = normalizeEcho(a)
  const y = normalizeEcho(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const xt = tokenSet(x)
  const yt = tokenSet(y)
  if (xt.size === 0 || yt.size === 0) return false
  let hit = 0
  for (const tok of xt) if (yt.has(tok)) hit++
  return hit / Math.min(xt.size, yt.size) >= 0.6
}
