/**
 * Клонирует голос Articulate Tutor Natural через ElevenLabs.
 * 1) npm run prepare:teacher-voice
 * 2) ELEVENLABS_API_KEY=sk_... npm run clone:teacher-voice
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const API_KEY = process.env.ELEVENLABS_API_KEY?.trim()

const REFS = [
  join(ROOT, 'video', 'articulate-tutor-natural.mp3'),
  join(ROOT, 'public', 'learn', 'audio', 'teacher-voice-reference.mp3'),
  join(ROOT, 'video', 'male-voice-for-answering-machine.mp3'),
]

function findArticulateInVideo() {
  const video = join(ROOT, 'video')
  if (!existsSync(video)) return null
  for (const name of readdirSync(video)) {
    if (/articulate.*tutor/i.test(name)) {
      try {
        const p = join(video, name)
        const buf = readFileSync(p)
        if (buf.length > 500) return { path: p, buf }
      } catch {
        /* next */
      }
    }
  }
  return null
}

function findReference() {
  for (const p of REFS) {
    try {
      const buf = readFileSync(p)
      if (buf.length > 500) return { path: p, buf }
    } catch {
      /* next */
    }
  }
  return findArticulateInVideo()
}

async function main() {
  if (!API_KEY) {
    console.error('Нужен ELEVENLABS_API_KEY в окружении.')
    console.error('Получите ключ: https://elevenlabs.io → Profile → API Key')
    process.exit(1)
  }

  const ref = findReference()
  if (!ref) {
    console.error('Сначала: npm run prepare:teacher-voice')
    console.error('Нужен образец Articulate Tutor в папке video/')
    process.exit(1)
  }

  console.log('Образец:', ref.path, `(${ref.buf.length} bytes)`)
  console.log('Клонирую голос Articulate Tutor Natural…')

  const form = new FormData()
  form.append('name', 'ATOMLAB Articulate Tutor')
  form.append(
    'description',
    'Articulate Tutor Natural voice clone for chemistry AI teacher',
  )
  form.append('files', new Blob([ref.buf], { type: 'audio/mpeg' }), 'articulate-tutor-natural.mp3')

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY },
    body: form,
  })

  const body = await res.text()
  if (!res.ok) {
    console.error('ElevenLabs error:', res.status, body)
    process.exit(1)
  }

  const data = JSON.parse(body)
  const voiceId = data.voice_id
  if (!voiceId) {
    console.error('Нет voice_id в ответе:', body)
    process.exit(1)
  }

  const out = {
    voiceId,
    clonedAt: new Date().toISOString(),
    source: 'video/articulate-tutor-natural.mp3',
    profile: 'Articulate Tutor Natural',
    model: 'eleven_multilingual_v2',
  }

  const jsonPath = join(ROOT, 'src', 'data', 'teacherElevenLabsVoice.json')
  writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8')

  console.log('\n✓ Голос Articulate Tutor склонирован!')
  console.log('voice_id:', voiceId)
  console.log('Сохранено:', jsonPath)
  console.log('\nДобавьте в .env:')
  console.log(`ELEVENLABS_API_KEY=${API_KEY.slice(0, 8)}...`)
  console.log(`ELEVENLABS_VOICE_ID=${voiceId}`)
  console.log('LEARN_TTS_PROVIDER=clone')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
