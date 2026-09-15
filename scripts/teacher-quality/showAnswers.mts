/**
 * Print answers of a tag with their autoScore fails (and optionally a second tag for before → after).
 *   npx tsx scripts/teacher-quality/showAnswers.mts --tag r2 [--before r1s2] [--only g7-01,g9-04] [--failing]
 */
import fs from 'node:fs'
const argv = process.argv.slice(2)
const arg = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = arg('tag') ?? 'r2'
const before = arg('before')
const only = arg('only')?.split(',')
const failing = argv.includes('--failing')
const load = (t: string) => JSON.parse(fs.readFileSync(`.smoke/answer-quality/score-${t}.json`, 'utf8')).rows as Array<{ id: string; mode: string; score: number; fails: string[]; excerpt: string }>
const rows = load(tag)
const prev = before ? load(before) : []
for (const r of rows) {
  if (only && !only.some((o) => r.id.startsWith(o))) continue
  if (failing && r.fails.length === 0) continue
  const p = prev.find((x) => x.id === r.id && x.mode === r.mode)
  console.log(`\n${r.id} ${r.mode} ${p ? `${p.score} → ` : ''}${r.score}  ${r.fails.join(' | ')}`)
  if (p && p.excerpt !== r.excerpt) console.log(`  before: ${p.excerpt}`)
  console.log(`  ${p ? 'after : ' : ''}${r.excerpt}`)
}
