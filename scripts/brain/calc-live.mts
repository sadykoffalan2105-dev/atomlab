/**
 * Живая проверка школьного калькулятора на сервере (ПК с видеокартой): 10 задач по Kimyo 8 §1, §25, §26 и
 * Kimyo 11 §16, §32 — ответ модели (done.text) обязан содержать число книги. Запросы идут по одному с паузой
 * (публичный сервер: 8 запросов в минуту на адрес).
 *
 *   npx tsx scripts/brain/calc-live.mts --url=http://<адрес-сервера>:8787 [--pause=8000] [--verbose]
 *
 * Код выхода 1 — если хоть одна задача без нужного числа. Ничего не пишет на сервер, кроме обычных вопросов /chat.
 */
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=')
const base = (arg('url') ?? `http://127.0.0.1:${process.env.BRAIN_PORT || 8787}`).replace(/\/$/, '')
const pause = Number(arg('pause') ?? 8000)
const verbose = process.argv.includes('--verbose')

type Task = { id: string; unit: string; q: string; want: number[]; tol?: number }
// ответы посчитаны вручную по школьным Ar (как в учебниках): Cl 35,5; Cu 64; Vm 22,4; F 96 500
const TASKS: Task[] = [
  { id: 'k8-1a', unit: 'Kimyo 8, §1', q: 'Вычислите относительную молекулярную массу сульфата меди CuSO4.', want: [160] },
  { id: 'k8-1b', unit: 'Kimyo 8, §1', q: 'Сколько моль составляют 49 г серной кислоты H2SO4?', want: [0.5] },
  { id: 'k8-25a', unit: 'Kimyo 8, §25', q: 'Какой объём (н.у.) займут 22 г углекислого газа CO2?', want: [11.2] },
  { id: 'k8-25b', unit: 'Kimyo 8, §25', q: 'Плотность газа по водороду равна 17. Найдите молярную массу газа.', want: [34] },
  { id: 'k8-26a', unit: 'Kimyo 8, §26', q: 'Вычислите молярную массу эквивалента серной кислоты H2SO4.', want: [49] },
  { id: 'k8-26b', unit: 'Kimyo 8, §26', q: '1,2 г металла вытеснили из кислоты 1,12 л водорода (н.у.). Вычислите молярную массу эквивалента металла.', want: [12] },
  { id: 'k11-16a', unit: 'Kimyo 11, §16', q: 'Сколько граммов соли и воды нужно для приготовления 300 г 15%-го раствора?', want: [45, 255] },
  { id: 'k11-16b', unit: 'Kimyo 11, §16', q: '100 г 20%-го раствора смешали с 300 г 10%-го раствора той же соли. Найдите массовую долю соли в новом растворе.', want: [12.5] },
  { id: 'k11-32a', unit: 'Kimyo 11, §32', q: 'Какая масса меди выделится на катоде при электролизе раствора CuSO4 током 5 А в течение 1930 с?', want: [3.2] },
  { id: 'k11-32b', unit: 'Kimyo 11, §32', q: 'Сколько граммов серебра выделится из раствора AgNO3 при силе тока 2 А за 965 с?', want: [2.16] },
]

const numbersIn = (t: string) => [...t.replace(/[−–]/g, '-').matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.')))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function ask(q: string, id: string): Promise<{ text: string; tools: string; ms: number; error?: string }> {
  const t0 = performance.now()
  const body = { sessionId: `calc-live-${id}`, studentId: 'calc-live', lang: 'auto', stream: true, messages: [{ role: 'user', content: q }], context: { gradeId: id.startsWith('k11') ? 'g11' : 'g8', mode: 'chat', detail: 'brief' } }
  try {
    const res = await fetch(`${base}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180_000) })
    if (!res.ok) return { text: '', tools: '', ms: 0, error: `HTTP ${res.status}` }
    const raw = await res.text()
    let text = ''
    let done: { text?: string; citations?: string[] } | null = null
    for (const block of raw.split(/\n\n/)) {
      const ev = block.match(/^event: ?(.+)$/m)?.[1]?.trim()
      const data = block.match(/^data: ?(.*)$/m)?.[1]
      if (!ev || data === undefined) continue
      const j = JSON.parse(data)
      if (ev === 'delta') text += j.text
      else if (ev === 'done') done = j
    }
    return { text: done?.text ?? text, tools: (done?.citations ?? []).join(' '), ms: Math.round(performance.now() - t0) }
  } catch (err) {
    return { text: '', tools: '', ms: 0, error: (err as Error).message }
  }
}

let ok = 0
console.log(`[calc-live] ${base} · ${TASKS.length} задач · пауза ${pause} мс`)
for (const [i, t] of TASKS.entries()) {
  if (i) await sleep(pause)
  const a = await ask(t.q, t.id)
  const nums = numbersIn(a.text)
  const miss = t.want.filter((w) => !nums.some((n) => Math.abs(n - w) <= (t.tol ?? Math.max(0.01, 0.005 * Math.abs(w)))))
  const pass = !a.error && !miss.length
  if (pass) ok++
  console.log(`${pass ? '✓' : '✗'} ${t.id} [${t.unit}] ${a.ms} мс${a.error ? ` ошибка: ${a.error}` : miss.length ? ` нет ${miss.join(', ')}` : ''}${a.tools ? ` · ${a.tools}` : ''}`)
  if (verbose || !pass) console.log(`   «${a.text.replace(/\s+/g, ' ').slice(0, 600)}»`)
}
console.log(`\n${ok}/${TASKS.length} ${ok === TASKS.length ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО'}`)
process.exit(ok === TASKS.length ? 0 : 1)
