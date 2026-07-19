// Аудит расстановки ударений: U+0301 (в исходнике — ${A}) должен стоять
// сразу ПОСЛЕ русской гласной. Иначе Edge/Dmitry искажает слово.
import { readFileSync } from 'node:fs'

const VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ'
const files = [
  'src/learn/learnRussianStress.ts',
  'src/learn/learnRussianStressCommon.ts',
]

let problems = 0
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // Ищем строки вида  ключ: `значение с ${A}`,
  const re = /(\p{L}[\p{L}\s'’-]*)\s*:\s*`([^`]*)`/gu
  let m
  while ((m = re.exec(src))) {
    const key = m[1].trim()
    const val = m[2]
    // Находим каждое ${A} и смотрим символ перед ним
    let idx = 0
    while ((idx = val.indexOf('${A}', idx)) !== -1) {
      const prev = val[idx - 1]
      if (!prev || !VOWELS.includes(prev)) {
        console.log(`[${file}] "${key}": ударение после «${prev ?? '∅'}» → ${val}`)
        problems++
      }
      idx += 4
    }
    // Слово без единого ${A} и длиной > 1 слога — только предупреждение
  }
}

console.log(problems === 0 ? 'OK: все ударения стоят после гласной' : `Найдено проблем: ${problems}`)
