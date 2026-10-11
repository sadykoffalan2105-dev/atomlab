/**
 * npm run brain:selftest (часть) — фильтр выходного потока: пересказ служебного плана в начале ответа
 * (gemma4: «Qaror: … 7-sinf darajasida … Soʻz soni: 40-90.») вырезается, обычный текст и расчёты — нет.
 */
import { isPlanLeak, StreamGate } from '../../brain/pipeline/postcheck.ts'

let pass = 0
let fail = 0
function ok(cond: boolean, name: string, detail = ''): void {
  if (cond) pass++
  else fail++
  console.log(`${cond ? '  ok ' : '  FAIL'}  ${name}${!cond && detail ? ` — ${detail}` : ''}`)
}

console.log('утечка плана:')
for (const s of [
  'Qaror: Valentlik tushunchasini 7-sinf darajasida tushuntirish, kundalik hayotdan misol keltirish.',
  'Soʻz soni: 40-90.',
  'Qaror: Savol kislorod olish usullari haqida. 8-sinf kimyo darsligi darajasida.',
  'Решение: объяснить на уровне 8 класса, 90–160 слов.',
  'Decision: explain at grade 7 level, 40-90 words.',
]) ok(isPlanLeak(s), `режется: «${s.slice(0, 50)}»`)
for (const s of [
  'Решение: M(H₂SO₄) = 2·1 + 32 + 4·16 = 98 г/моль.',
  'Valentlik — bu atomning boshqa atomlar bilan bogʻ hosil qilish qobiliyati.',
  'Валентность — способность атома образовывать химические связи.',
  'Plan: 100 - 20 = 80 g.',
]) ok(!isPlanLeak(s), `не режется: «${s.slice(0, 50)}»`)

{
  let out = ''
  const g = new StreamGate('uz', 200, (p) => (out += p))
  const src = 'Qaror: Valentlik tushunchasini 7-sinf darajasida tushuntirish va misol keltirish. Soʻz soni: 40-90. Valentlik — bu atomning boshqa atomlar bilan maʼlum sondagi kimyoviy bogʻ hosil qilish qobiliyatidir. Masalan, suvda kislorod II valentli.'
  for (const tok of src.match(/.{1,6}/gs)!) g.push(tok)
  g.end()
  ok(out.startsWith('Valentlik — bu') && !/Qaror|Soʻz soni/.test(out), 'поток uz: план вырезан, ответ цел', out.slice(0, 120))
}
{
  let out = ''
  const g = new StreamGate('ru', 200, (p) => (out += p))
  const src = 'Валентность — способность атома образовывать связи. Решение: так считают в 8 классе.'
  for (const tok of src.match(/.{1,6}/gs)!) g.push(tok)
  g.end()
  ok(out.includes('Решение: так считают в 8 классе.'), 'середина ответа не трогается', out)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
