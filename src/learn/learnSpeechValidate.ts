/** Минимальная проверка MP3 — только отсекаем пустой/битый ответ. */
export function isPlausibleSpeechAudio(audioBase64: string, text: string): boolean {
  if (!audioBase64 || audioBase64.length < 80) return false
  const byteLen = Math.floor((audioBase64.length * 3) / 4)
  const chars = text.trim().length
  if (chars < 2) return false
  // Совсем крошечный файл при длинной фразе — пропускаем
  if (chars > 80 && byteLen < 800) return false
  return byteLen >= 200
}
