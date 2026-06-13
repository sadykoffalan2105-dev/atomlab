/**
 * Копирует образец голоса Articulate Tutor в стабильный путь для клонирования.
 * Usage: npm run prepare:teacher-voice
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const VIDEO = join(ROOT, 'video')
const OUT_MP3 = join(VIDEO, 'articulate-tutor-natural.mp3')
const PUBLIC_REF = join(ROOT, 'public', 'learn', 'audio', 'teacher-voice-reference.mp3')

function findArticulateSample() {
  if (!existsSync(VIDEO)) return null
  for (const name of readdirSync(VIDEO)) {
    if (/articulate.*tutor.*natural/i.test(name) && !name.includes('.')) {
      return join(VIDEO, name)
    }
    if (/articulate.*tutor/i.test(name) && /\.(mp3|wav|m4a)$/i.test(name)) {
      return join(VIDEO, name)
    }
  }
  if (existsSync(OUT_MP3)) return OUT_MP3
  const legacy = join(VIDEO, 'male-voice-for-answering-machine.mp3')
  if (existsSync(legacy)) return legacy
  return null
}

const src = findArticulateSample()
if (!src) {
  console.error('Не найден образец в video/ (Articulate Tutor Natural)')
  process.exit(1)
}

copyFileSync(src, OUT_MP3)
mkdirSync(join(ROOT, 'public', 'learn', 'audio'), { recursive: true })
copyFileSync(src, PUBLIC_REF)

const meta = {
  source: 'video/articulate-tutor-natural.mp3',
  original: src.replace(ROOT + '\\', '').replace(ROOT + '/', ''),
  preparedAt: new Date().toISOString(),
  note: 'Голос Articulate Tutor Natural — образец для ElevenLabs clone',
}

writeFileSync(join(ROOT, 'src', 'data', 'teacherVoiceReference.json'), JSON.stringify(meta, null, 2))

console.log('✓ Образец голоса подготовлен:')
console.log(' ', OUT_MP3)
console.log(' ', PUBLIC_REF)
console.log('\nДальше (один раз, нужен ключ ElevenLabs):')
console.log('  ELEVENLABS_API_KEY=sk_... npm run clone:teacher-voice')
console.log('  LEARN_TTS_PROVIDER=clone')
