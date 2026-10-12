/**
 * npm run brain:logs-retention — сроки хранения логов мозга (docs/COMPLIANCE.md, brain/kb/retention.ts).
 *
 * Мозг сам раз в месяц переименовывает journal/dialogs.jsonl и journal/images.jsonl в journal/archive/<имя>-<ГГГГ-ММ>.jsonl
 * (в brain/** удалений нет). Этот скрипт — для владельца: показывает архивы старше срока (config.server.retention.dialogDays,
 * по умолчанию 90 дней, считается по последней записи) и с --apply удаляет ИМЕННО их.
 * Журнал знаний (kb-journal.jsonl), события учеников и всё вне journal/archive/ не трогаются никогда.
 *
 *   --data=путь   папка данных (по умолчанию BRAIN_DATA_DIR или %USERPROFILE%\Desktop\atomlab-brain-data)
 *   --days=N      срок вместо config.json
 *   --rotate      сначала выполнить месячную ротацию (как мозг при старте)
 *   --apply       удалить найденные архивы (без флага — только список)
 */
import fs from 'node:fs'
import path from 'node:path'
import { expiredArchives, retentionOf, rotateLogs } from '../../brain/kb/retention.ts'

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const flag = (name: string) => process.argv.includes(`--${name}`)

const home = process.env.USERPROFILE || process.env.HOME || '.'
const dataDir = path.resolve(arg('data') ?? process.env.BRAIN_DATA_DIR ?? path.join(home, 'Desktop', 'atomlab-brain-data'))
const journalDir = path.join(dataDir, 'journal')
let cfg: unknown = null
try {
  // только чтение: config.json не создаётся и не меняется
  cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'))
} catch {
  cfg = null
}
const ret = retentionOf(cfg as Parameters<typeof retentionOf>[0])
const days = arg('days') !== undefined ? Number(arg('days')) : ret.dialogDays
console.log(`[logs-retention] данные: ${dataDir} · срок: ${days} дн. · ${flag('apply') ? 'УДАЛЕНИЕ' : 'только список (--apply — удалить)'}`)
if (!fs.existsSync(journalDir)) {
  console.log('[logs-retention] папки journal/ нет — нечего делать')
  process.exit(0)
}
if (flag('rotate')) {
  for (const r of rotateLogs(journalDir)) console.log(`  ротация: ${path.basename(r.from)} → archive/${path.basename(r.to)}`)
}
const expired = expiredArchives(journalDir, days)
if (!expired.length) console.log('  архивов старше срока нет')
for (const f of expired) {
  // двойная защита: только файлы внутри journal/archive/ с именем лога
  const rel = path.relative(path.join(journalDir, 'archive'), f)
  if (rel.startsWith('..') || path.isAbsolute(rel) || !/^(dialogs|images)-\d{4}-\d{2}(-\d+)?\.jsonl$/.test(rel)) continue
  const kb = Math.round(fs.statSync(f).size / 1024)
  if (flag('apply')) {
    fs.rmSync(f)
    console.log(`  удалён: archive/${rel} (${kb} КБ)`)
  } else console.log(`  старше срока: archive/${rel} (${kb} КБ)`)
}
