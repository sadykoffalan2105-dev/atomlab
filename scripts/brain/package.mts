/**
 * npm run brain:package — архив установки сервера мозга для ПК друга: dist-brain/ATOMLAB-brain.zip.
 *
 * Внутри (папка ATOMLAB-brain/): УСТАНОВИТЬ.bat, УДАЛИТЬ.bat, ИНСТРУКЦИЯ.txt, ключ.txt, скрипты deploy/brain-pc/* (+ comfy/** — картинки)
 * и data/ — снимок базы знаний из atomlab-brain-data (ТОЛЬКО чтение, папка владельца не меняется):
 *   journal/kb-journal.jsonl            — без записей dialog/feedback, их dup и записей с данными учеников;
 *   derived/bm25-journal.json           — кеш индекса (если все его id остались в снимке; иначе мозг пересоберёт);
 *   derived/embeddings/<model>/*        — векторы только оставшихся записей (недостающие досчитает установщик);
 *   SNAPSHOT.json                       — что взято, сколько отброшено, контрольные суммы.
 * Не берётся: journal/dialogs.jsonl, students/, logs/, start-brain.ps1, config.json.
 *
 *   --data=путь   — папка данных (по умолчанию BRAIN_DATA_DIR или %USERPROFILE%\Desktop\atomlab-brain-data)
 *   --no-data     — без снимка (быстрая сборка для проверки установщика)
 *   --key=tskey-… — положить ключ Tailscale в ключ.txt (иначе ключ.txt с подсказкой)
 *   --out=путь    — куда положить zip (по умолчанию dist-brain/ATOMLAB-brain.zip)
 */
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const SRC = path.join(ROOT, 'deploy', 'brain-pc')
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => process.argv.includes(`--${name}`)

const home = process.env.USERPROFILE || process.env.HOME || '.'
const dataDir = path.resolve(arg('data') ?? process.env.BRAIN_DATA_DIR ?? path.join(home, 'Desktop', 'atomlab-brain-data'))
const outFile = path.resolve(arg('out') ?? path.join(ROOT, 'dist-brain', 'ATOMLAB-brain.zip'))
const TOP = 'ATOMLAB-brain/'

// ---------------------------------------------------------------- zip (UTF-8 имена, deflate), без зависимостей
type Entry = { name: string; data: Buffer; level?: number }
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Buffer): number {
  const z = zlib as unknown as { crc32?: (b: Buffer) => number }
  if (typeof z.crc32 === 'function') return z.crc32(buf) >>> 0
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}
function writeZip(file: string, entries: Entry[]): void {
  const now = dosTime(new Date())
  const fd = fs.openSync(file, 'w')
  const central: Buffer[] = []
  let offset = 0
  const put = (b: Buffer) => {
    fs.writeSync(fd, b)
    offset += b.length
  }
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const crc = crc32(e.data)
    let comp: Buffer = zlib.deflateRawSync(e.data, { level: e.level ?? 6 })
    let method = 8
    if (comp.length >= e.data.length) {
      comp = e.data
      method = 0
    }
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // бит 11: имена в UTF-8 (Проводник Windows покажет кириллицу)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(now.time, 10)
    local.writeUInt16LE(now.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(comp.length, 18)
    local.writeUInt32LE(e.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    const at = offset
    put(local)
    put(name)
    put(comp)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(20, 4)
    c.writeUInt16LE(20, 6)
    c.writeUInt16LE(0x0800, 8)
    c.writeUInt16LE(method, 10)
    c.writeUInt16LE(now.time, 12)
    c.writeUInt16LE(now.date, 14)
    c.writeUInt32LE(crc, 16)
    c.writeUInt32LE(comp.length, 20)
    c.writeUInt32LE(e.data.length, 24)
    c.writeUInt16LE(name.length, 28)
    c.writeUInt32LE(at, 42)
    central.push(c, name)
  }
  const cdStart = offset
  for (const b of central) put(b)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(offset - cdStart, 12)
  end.writeUInt32LE(cdStart, 16)
  put(end)
  fs.closeSync(fd)
  if (offset > 0xffffffff) throw new Error('архив больше 4 ГБ — нужен zip64')
}

// ---------------------------------------------------------------- файлы установщика
const BOM = Buffer.from([0xef, 0xbb, 0xbf])
const toCrlf = (b: Buffer) => Buffer.from(b.toString('utf8').replace(/\r?\n/g, '\r\n'), 'utf8')
const withBom = (b: Buffer) => (b.subarray(0, 3).equals(BOM) ? b : Buffer.concat([BOM, b]))

const entries: Entry[] = []
for (const name of fs.readdirSync(SRC).sort()) {
  const full = path.join(SRC, name)
  if (!fs.statSync(full).isFile()) continue
  let data: Buffer = fs.readFileSync(full)
  const ext = path.extname(name).toLowerCase()
  if (ext === '.bat') {
    if (/[^\x00-\x7f]/.test(data.toString('latin1'))) throw new Error(`${name}: в .bat только ASCII`)
    data = toCrlf(data) // cmd.exe надёжнее с CRLF (в репозитории — LF)
  } else if (ext === '.ps1') {
    data = withBom(data) // Windows PowerShell 5.1 читает UTF-8 только с BOM
  } else if (ext === '.txt') {
    data = withBom(toCrlf(data))
  }
  entries.push({ name: TOP + name, data })
}
// картинки: подпапка comfy/ целиком (image-install, run-comfy, manifest.json, узел atomlab_safety/__init__.py, README);
// моделей и ComfyUI в архиве нет — их качает сам сервер со сверкой SHA-256
const COMFY_EXT = new Set(['.ps1', '.json', '.py', '.md'])
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]))
const comfyDir = path.join(SRC, 'comfy')
if (fs.existsSync(comfyDir)) {
  for (const full of walk(comfyDir)) {
    const ext = path.extname(full).toLowerCase()
    if (!COMFY_EXT.has(ext)) continue
    let data: Buffer = fs.readFileSync(full)
    if (ext === '.ps1') data = withBom(data)
    entries.push({ name: TOP + path.relative(SRC, full).split(path.sep).join('/'), data })
  }
}
const key = arg('key')
if (key && !/^tskey-[A-Za-z0-9_-]+$/.test(key)) throw new Error('--key: ожидается tskey-…')
entries.push({
  name: TOP + 'ключ.txt',
  data: withBom(toCrlf(Buffer.from(key ? `${key}\n` : 'Вставьте сюда ключ Tailscale от владельца (одна строка, начинается с tskey-), сохраните файл.\n', 'utf8'))),
})

// ---------------------------------------------------------------- снимок данных
const sha1 = (b: Buffer) => crypto.createHash('sha1').update(b).digest('hex')
type Rec = { id?: string; kind?: string; meta?: Record<string, unknown> }
const PERSONAL_KINDS = new Set(['dialog', 'feedback'])
const PERSONAL_META = ['studentId', 'sessionId', 'turnId']

let gitHead = ''
try {
  gitHead = execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  /* без git — не страшно */
}
const snapshot: Record<string, unknown> = { builtAt: new Date().toISOString(), gitHead, source: 'atomlab-brain-data (только чтение)' }

if (!flag('no-data')) {
  const jf = path.join(dataDir, 'journal', 'kb-journal.jsonl')
  if (!fs.existsSync(jf)) throw new Error(`нет журнала ${jf} (укажите --data=… или --no-data)`)
  const raw = fs.readFileSync(jf, 'utf8')
  const kept: string[] = []
  const keptIds = new Set<string>()
  const dropped = { dialog: 0, feedback: 0, dupOfPersonal: 0, personalMeta: 0, broken: 0 }
  let lines = 0
  for (const line of raw.split('\n')) {
    const s = line.trim()
    if (!s) continue
    lines++
    let r: Rec
    try {
      r = JSON.parse(s) as Rec
    } catch {
      dropped.broken++
      continue
    }
    const meta = r.meta && typeof r.meta === 'object' ? r.meta : {}
    if (r.kind && PERSONAL_KINDS.has(r.kind)) {
      dropped[r.kind as 'dialog' | 'feedback']++
      continue
    }
    if (r.kind === 'dup' && typeof meta.origKind === 'string' && PERSONAL_KINDS.has(meta.origKind)) {
      dropped.dupOfPersonal++
      continue
    }
    if (PERSONAL_META.some((k) => k in meta)) {
      dropped.personalMeta++
      continue
    }
    kept.push(s)
    if (typeof r.id === 'string') keptIds.add(r.id)
  }
  const journalBuf = Buffer.from(kept.join('\n') + '\n', 'utf8')
  entries.push({ name: TOP + 'data/journal/kb-journal.jsonl', data: journalBuf })
  snapshot.journal = { lines, kept: kept.length, dropped, sha1: sha1(journalBuf) }
  console.log(`[brain:package] журнал: ${lines} строк → в снимке ${kept.length}; отброшено ${JSON.stringify(dropped)}`)

  // кеш BM25: годен, только если все его id остались (иначе мозг пересоберёт индекс сам за минуту-две)
  const bm = path.join(dataDir, 'derived', 'bm25-journal.json')
  if (fs.existsSync(bm)) {
    const buf = fs.readFileSync(bm)
    const ids = (JSON.parse(buf.toString('utf8')) as { ids?: string[] }).ids ?? []
    const ok = ids.every((id) => keptIds.has(id))
    if (ok) entries.push({ name: TOP + 'data/derived/bm25-journal.json', data: buf })
    snapshot.bm25 = { included: ok, ids: ids.length }
    console.log(`[brain:package] BM25-кеш: ${ok ? 'в снимке' : 'НЕ взят (есть отброшенные id) — пересоберётся'} (${ids.length} id)`)
  }

  // векторы: только записи снимка, в том же порядке
  const embRoot = path.join(dataDir, 'derived', 'embeddings')
  const vecInfo: Record<string, unknown>[] = []
  if (fs.existsSync(embRoot)) {
    for (const dir of fs.readdirSync(embRoot)) {
      const mf = path.join(embRoot, dir, 'manifest.json')
      const vf = path.join(embRoot, dir, 'vectors.f32')
      if (!fs.existsSync(mf) || !fs.existsSync(vf)) continue
      const m = JSON.parse(fs.readFileSync(mf, 'utf8')) as { model: string; dim: number; count: number; ids: string[] }
      const vbuf = fs.readFileSync(vf)
      const rowBytes = m.dim * 4
      const n = Math.min(m.ids.length, Math.floor(vbuf.length / rowBytes))
      const keepIdx: number[] = []
      for (let i = 0; i < n; i++) if (keptIds.has(m.ids[i]!)) keepIdx.push(i)
      const out = Buffer.alloc(keepIdx.length * rowBytes)
      keepIdx.forEach((i, k) => vbuf.copy(out, k * rowBytes, i * rowBytes, (i + 1) * rowBytes))
      const ids = keepIdx.map((i) => m.ids[i]!)
      const manifest = Buffer.from(JSON.stringify({ model: m.model, dim: m.dim, count: ids.length, ids }), 'utf8')
      entries.push({ name: `${TOP}data/derived/embeddings/${dir}/vectors.f32`, data: out, level: 1 })
      entries.push({ name: `${TOP}data/derived/embeddings/${dir}/manifest.json`, data: manifest })
      vecInfo.push({ dir, model: m.model, dim: m.dim, count: ids.length, dropped: n - ids.length, sha1: sha1(out) })
      console.log(`[brain:package] векторы ${dir}: ${n} → ${ids.length} (dim ${m.dim})`)
    }
  }
  snapshot.vectors = vecInfo.length === 1 ? vecInfo[0] : vecInfo
} else {
  console.log('[brain:package] --no-data: без снимка базы')
}
entries.push({ name: TOP + 'data/SNAPSHOT.json', data: Buffer.from(JSON.stringify(snapshot, null, 2) + '\n', 'utf8') })
if (flag('no-data')) entries.pop() // без данных папки data/ нет — установщик честно предупредит

fs.mkdirSync(path.dirname(outFile), { recursive: true })
writeZip(outFile, entries)
const size = fs.statSync(outFile).size
console.log(`[brain:package] ${entries.length} файлов → ${outFile} (${(size / 1024 / 1024).toFixed(1)} МБ)`)
for (const e of entries) console.log(`  ${(e.data.length / 1024).toFixed(0).padStart(8)} КБ  ${e.name}`)
