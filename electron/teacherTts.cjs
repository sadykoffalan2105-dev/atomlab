/**
 * ATOMLAB Teacher Voice — Edge Neural TTS в main-процессе Electron (msedge-tts).
 */
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts')

const VOICES = {
  ru: 'ru-RU-DmitryNeural',
  en: 'en-US-GuyNeural',
  uz: 'uz-UZ-SardorNeural',
}

const VOICE_LOCALE = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
}

/** @type {import('msedge-tts').MsEdgeTTS | null} */
let ttsInstance = null
/** @type {Promise<void> | null} */
let readyPromise = null
/** @type {'ru' | 'en' | 'uz' | null} */
let activeLocale = null

function normalizeLocale(locale) {
  if (locale === 'en') return 'en'
  if (locale === 'uz') return 'uz'
  return 'ru'
}

function voiceForLocale(locale) {
  const loc = normalizeLocale(locale)
  return VOICES[loc]
}

async function ensureReady(locale = 'ru') {
  const loc = normalizeLocale(locale)
  if (ttsInstance && activeLocale === loc) return
  if (!readyPromise || activeLocale !== loc) {
    readyPromise = (async () => {
      ttsInstance = new MsEdgeTTS()
      await ttsInstance.setMetadata(voiceForLocale(loc), OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        voiceLocale: VOICE_LOCALE[loc],
      })
      activeLocale = loc
    })()
  }
  await readyPromise
}

/**
 * @param {string} text
 * @param {'ru' | 'en' | 'uz'} locale
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
