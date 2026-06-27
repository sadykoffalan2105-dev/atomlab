/**
 * ATOMLAB Teacher Voice — Edge Neural TTS в main-процессе Electron (msedge-tts).
 */
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts')

const VOICES = {
  ru: 'ru-RU-DmitryNeural',
  en: 'en-US-GuyNeural',
}

/** @type {import('msedge-tts').MsEdgeTTS | null} */
let ttsInstance = null
/** @type {Promise<void> | null} */
let readyPromise = null
/** @type {'ru' | 'en' | null} */
let activeLocale = null

function voiceForLocale(locale) {
  return locale === 'en' ? VOICES.en : VOICES.ru
}

async function ensureReady(locale = 'ru') {
  const voice = voiceForLocale(locale)
  const voiceLocale = locale === 'en' ? 'en-US' : 'ru-RU'
  if (ttsInstance && activeLocale === locale) return
  if (!readyPromise || activeLocale !== locale) {
    readyPromise = (async () => {
      ttsInstance = new MsEdgeTTS()
      await ttsInstance.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        voiceLocale,
      })
      activeLocale = locale
    })()
  }
  await readyPromise
}

/**
 * @param {string} text
 * @param {'ru' | 'en'} locale
 * @returns {Promise<{ audioBase64: string, mimeType: string } | null>}
 */
async function synthesizeTeacherSpeech(text, locale = 'ru') {
  const chunk = String(text ?? '').trim()
  if (!chunk) return null

  try {
    await ensureReady(locale)
    const { audioStream } = ttsInstance.toStream(chunk)
    /** @type {Buffer[]} */
    const parts = []
    for await (const data of audioStream) {
      parts.push(Buffer.from(data))
    }
    if (parts.length === 0) return null
    const merged = Buffer.concat(parts)
    if (merged.length < 200) return null
    return { audioBase64: merged.toString('base64'), mimeType: 'audio/mpeg' }
  } catch (err) {
    console.warn('[teacher-tts]', err?.message || err)
    ttsInstance = null
    readyPromise = null
    activeLocale = null
    return null
  }
}

async function warmupTeacherTts() {
  return synthesizeTeacherSpeech('Готов к уроку.', 'ru')
}

module.exports = { synthesizeTeacherSpeech, warmupTeacherTts }
