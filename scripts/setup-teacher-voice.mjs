/**
 * Одноразовая настройка голоса ATOMLAB Teacher (бесплатно, без API-ключей).
 * Usage: npm run setup:teacher-voice
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const REQ = join(ROOT, 'scripts', 'teacher-tts-requirements.txt')
const SYNTH = join(ROOT, 'scripts', 'teacher-tts-synth.py')
const py = process.platform === 'win32' ? 'python' : 'python3'

console.log('ATOMLAB Teacher Voice — настройка...\n')

const pip = spawnSync(py, ['-m', 'pip', 'install', '-r', REQ], {
  stdio: 'inherit',
  cwd: ROOT,
})
if (pip.status !== 0) {
  console.error('\nНе удалось установить edge-tts. Проверьте Python и pip.')
  process.exit(1)
}

if (!existsSync(SYNTH)) {
  console.error('Не найден scripts/teacher-tts-synth.py')
  process.exit(1)
}

console.log('\nПробую синтез (прогрев голоса)...')
const warm = spawnSync(
  py,
  [SYNTH],
  {
    input: JSON.stringify({
      text: 'Здравствуйте. Я ваш учитель химии. Готов объяснить любую тему.',
      locale: 'ru',
    }),
    encoding: 'utf8',
    cwd: ROOT,
  },
)

if (warm.status !== 0) {
  console.error('\nСинтез не прошёл:', warm.stderr || warm.stdout)
  process.exit(1)
}

try {
  const data = JSON.parse(warm.stdout)
  if (data.audioBase64?.length > 200) {
    console.log('\n✓ Голос ATOMLAB Teacher готов!')
    console.log('  Движок: Microsoft Neural (Dmitry)')
    console.log('  Размер теста:', Math.round(data.audioBase64.length / 1024), 'KB base64')
    console.log('\nЗапуск: npm run dev')
  } else {
    console.error('\nСинтез вернул пустой результат:', warm.stdout)
    process.exit(1)
  }
} catch (e) {
  console.error('\nОшибка разбора ответа:', warm.stdout)
  process.exit(1)
}
