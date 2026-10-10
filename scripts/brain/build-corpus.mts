/**
 * npm run brain:corpus — собрать базу «мозга» в BRAIN_DATA_DIR (по умолчанию Desktop\atomlab-brain-data):
 * учебники Kimyo 7–11, карточки ATOMLAB, qaBank, учёные, megaPack, химические статьи Википедии →
 * journal/kb-journal.jsonl (ТОЛЬКО дописывание). Повторный запуск дописывает лишь новые тексты.
 * Затем строит индекс BM25 журнала в derived/ (чтобы сервер стартовал быстро).
 *
 *   --only=textbooks,qabank   — только эти источники (textbooks, book-index, common, kb-wiki, qabank, scientists, megapack, wiki)
 *   --skip=wiki               — без этих источников
 *   --dry                     — только посчитать, ничего не писать
 *   --no-index                — не строить индекс BM25
 */
import { DATA_DIR, FILES, ensureDataDirs } from '../../brain/config.ts'
import { buildCorpus, SOURCE_NAMES, type SourceName } from '../../brain/kb/corpusBuild.ts'
import { Journal } from '../../brain/kb/journal.ts'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => process.argv.includes(`--${name}`)
const list = (s: string | undefined) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : null)

const only = list(arg('only'))
const skip = new Set(list(arg('skip')) ?? [])
const bad = [...(only ?? []), ...skip].filter((s) => !(SOURCE_NAMES as readonly string[]).includes(s))
if (bad.length) {
  console.error(`Неизвестные источники: ${bad.join(', ')}. Есть: ${SOURCE_NAMES.join(', ')}`)
  process.exit(2)
}
const sources = (only ?? [...SOURCE_NAMES]).filter((s) => !skip.has(s)) as SourceName[]

ensureDataDirs()
const t0 = performance.now()
const journal = new Journal().load()
const before = journal.lines
console.log(`[brain:corpus] данные: ${DATA_DIR}`)
console.log(`[brain:corpus] журнал: ${FILES.kbJournal} — ${before} строк до сборки${flag('dry') ? ' (пробный прогон, без записи)' : ''}`)
const stats = buildCorpus(journal, { sources, dryRun: flag('dry'), log: (s) => console.log(s) })
const added = stats.reduce((s, x) => s + x.appended + x.nearDup, 0)
console.log(`[brain:corpus] дописано строк: ${flag('dry') ? 0 : added} (новых записей ${stats.reduce((s, x) => s + x.appended, 0)}, почти-дубликатов ${stats.reduce((s, x) => s + x.nearDup, 0)}); журнал теперь ${journal.lines} строк, ${(journal.bytes / 1e6).toFixed(1)} МБ`)
if (!flag('dry') && !flag('no-index')) {
  const idx = await journal.buildIndex({ yieldEvery: 5000 })
  console.log(`[brain:corpus] индекс BM25 журнала: из кеша ${idx.cached}, добавлено ${idx.added}, ${(idx.ms / 1000).toFixed(1)} с → ${FILES.bm25}`)
}
console.log(`[brain:corpus] готово за ${((performance.now() - t0) / 1000).toFixed(1)} с. Дальше: npm run brain:embed (нужна Ollama + bge-m3), затем npm run brain:start`)
