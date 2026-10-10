/**
 * npm run brain:embed — эмбеддинги записей журнала через Ollama (bge-m3, 1024-мерные) для гибридного поиска.
 * Пишет только в derived/embeddings/<model>/ (vectors.f32 + manifest.json) — эту папку можно удалить и пересобрать.
 * Возобновляемо: уже посчитанные id пропускаются, прервать (Ctrl+C) можно в любой момент.
 * Без Ollama или без модели bge-m3 честно сообщает и выходит с кодом 0 — поиск работает на BM25.
 *
 *   --limit=N        — не больше N новых записей за запуск
 *   --batch=32       — строк в одном запросе /api/embed
 *   --only=school    — только учебники и карточки (school), без megaPack и Википедии
 *
 * Порядок: учебники/определения/карточки → megaPack → энциклопедия (самое нужное — раньше).
 * Оценка на ПК владельца (CPU, 12 ядер): учебники + карточки ≈ 5–10 тыс. записей ≈ 10–20 мин, Википедия ≈ 1–2 ч.
 */
import { DATA_DIR, loadConfig } from '../../brain/config.ts'
import { EmbedStore } from '../../brain/kb/embedStore.ts'
import { Journal, searchableKind, type JournalRecord } from '../../brain/kb/journal.ts'
import { OllamaClient } from '../../brain/llm/ollama.ts'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const config = loadConfig()
const client = new OllamaClient(config)
const st = await client.refresh()
if (!st.embedModel) {
  console.log(
    st.available
      ? `[brain:embed] Ollama работает (${config.ollamaUrl}), но модели «${config.embedModel}» нет. Установите: ollama pull ${config.embedModel} — и запустите снова. Пока поиск работает на BM25.`
      : `[brain:embed] Ollama не найдена по адресу ${config.ollamaUrl} (${st.error ?? 'нет ответа'}). Эмбеддинги пропущены — поиск работает на BM25. Установка: brain/README.md.`,
  )
  process.exit(0)
}

const journal = new Journal().load()
const store = new EmbedStore(config.embedModel).load()
const tier = (r: JournalRecord): number => {
  const type = typeof r.meta.type === 'string' ? r.meta.type : ''
  if (r.kind === 'correction') return 0
  if (type === 'encyclopedia') return 3
  if (type === 'megapack') return 2
  return 1
}
let todo = journal.records.filter((r) => searchableKind(r.kind) && !store.has(r.id))
if (arg('only') === 'school') todo = todo.filter((r) => tier(r) <= 1)
todo.sort((a, b) => tier(a) - tier(b))
const limit = Number(arg('limit') || 0)
if (limit > 0) todo = todo.slice(0, limit)
const batch = Math.max(1, Math.min(128, Number(arg('batch') || 32)))

console.log(`[brain:embed] модель ${st.embedModel} · данные ${DATA_DIR} · уже посчитано ${store.size} · к расчёту ${todo.length} (пачки по ${batch})`)
if (!todo.length) {
  console.log('[brain:embed] всё уже посчитано.')
  process.exit(0)
}

let stopping = false
process.on('SIGINT', () => {
  if (stopping) process.exit(130)
  stopping = true
  console.log('\n[brain:embed] остановка после текущей пачки (прогресс сохранится)…')
})

const t0 = performance.now()
let done = 0
let pendIds: string[] = []
let pendVecs: number[][] = []
const flush = () => {
  if (pendIds.length) store.append(pendIds, pendVecs)
  pendIds = []
  pendVecs = []
}
for (let i = 0; i < todo.length && !stopping; i += batch) {
  const part = todo.slice(i, i + batch)
  const input = part.map((r) => `${r.title}\n${r.text}`.slice(0, 2000))
  let vecs = await client.embed(input, 120_000)
  if (!vecs) vecs = await client.embed(input, 180_000)
  if (!vecs) {
    console.log(`\n[brain:embed] Ollama не ответила на пачку ${i / batch + 1} — сохраняю сделанное; запустите снова, чтобы продолжить.`)
    break
  }
  part.forEach((r, k) => {
    pendIds.push(r.id)
    pendVecs.push(vecs![k]!)
  })
  done += part.length
  if (pendIds.length >= 256) flush()
  const sec = (performance.now() - t0) / 1000
  const rate = done / Math.max(sec, 0.001)
  const eta = (todo.length - done) / Math.max(rate, 1e-6)
  if ((i / batch) % 5 === 0 || done === todo.length) {
    process.stdout.write(`\r[brain:embed] ${done}/${todo.length} (${((done / todo.length) * 100).toFixed(1)} %) · ${rate.toFixed(1)} зап/с · осталось ≈ ${eta < 90 ? Math.round(eta) + ' с' : Math.round(eta / 60) + ' мин'}   `)
  }
}
flush()
console.log(`\n[brain:embed] готово: +${done} векторов за ${((performance.now() - t0) / 1000).toFixed(1)} с; всего ${store.size} (dim ${store.dim}) → ${store.dir}`)
