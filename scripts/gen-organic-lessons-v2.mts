/**
 * Органика v2: реакции уроков #/organic → src/data/organicLab/organicLessonReactions.gen.ts
 *
 * Урок получает реакцию, если:
 *  1) на неё ведёт кнопка учебника (altHref /organic?lesson=<урок>&mode=equation&src=…unit=…&rx=…) — 310 ссылок;
 *  2) её параграф Kimyo 10 (source.section «гл.пар») по resolveOrganicLessonFromLearn попадает в урок;
 *  3) для уроков без своих параграфов (строение, галогенпроизводные, азот, промышленность) — реакции учебника,
 *     где молекулы урока исходные или продукты (не больше 14).
 * Запуск: npx tsx scripts/gen-organic-lessons-v2.mts
 */
import { writeFileSync } from 'node:fs'
import { ORGANIC_CURRICULUM, resolveOrganicLessonFromLearn } from '../src/data/organicLab/organicCurriculum'
import { lessonMoleculeIds } from '../src/data/organicLab/organicLessonsV2'
import g10 from '../src/data/textbook/equations-g10.json' with { type: 'json' }
import g11 from '../src/data/textbook/equations-g11.json' with { type: 'json' }
import rxFile from '../src/data/organicV2/reactions.json' with { type: 'json' }
import type { OV2ReactionsFile } from '../src/data/organicV2/types'

const file = rxFile as unknown as OV2ReactionsFile
const byId = new Map(file.reactions.map((r) => [r.id, r]))
const lessons = new Map<string, string[]>(ORGANIC_CURRICULUM.map((l) => [l.id, []]))
const add = (lesson: string, id: string) => {
  const list = lessons.get(lesson)
  if (list && byId.has(id) && !list.includes(id)) list.push(id)
}

/** Ссылки учебника: v2-id реакции = g{класс}-{unit}-{rx} из параметра src. */
export function reactionIdFromBookHref(href: string): { lesson: string | null; rx: string | null } {
  const u = new URL('http://x' + href)
  const src = u.searchParams.get('src') ?? ''
  const s = new URL('http://x' + src)
  const grade = /\/learn\/g\/(g1[01])\//.exec(s.pathname)?.[1]
  const unit = s.searchParams.get('unit')
  const rx = s.searchParams.get('rx')
  return { lesson: u.searchParams.get('lesson'), rx: grade && unit && rx ? `${grade}-${unit}-${rx}` : null }
}

let links = 0
const walk = (o: unknown) => {
  if (!o || typeof o !== 'object') return
  for (const v of Object.values(o as Record<string, unknown>)) {
    if (typeof v === 'string' && v.startsWith('/organic?')) {
      links++
      const { lesson, rx } = reactionIdFromBookHref(v)
      if (lesson && rx) add(lesson, rx)
    } else walk(v)
  }
}
walk(g10)
walk(g11)

for (const r of file.reactions) {
  const sec = r.source.section
  if (r.source.grade !== 10 || typeof sec !== 'string' || !r.source.bookId) continue
  const [ch, s] = sec.split('.').map(Number)
  if (!ch || !Number.isFinite(s)) continue
  add(resolveOrganicLessonFromLearn(ch, s).id, r.id)
}

for (const l of ORGANIC_CURRICULUM) {
  const list = lessons.get(l.id)!
  if (list.length >= 6) continue
  const mols = lessonMoleculeIds(l)
  for (const m of mols) {
    for (const id of [...(file.uses[m] ?? []), ...(file.routes[m] ?? [])]) {
      if (list.length >= 14) break
      if (byId.get(id)?.source.bookId) add(l.id, id)
    }
  }
}

const pageOf = (id: string) => {
  const r = byId.get(id)!
  return r.source.grade * 1000 + (r.source.page ?? 999)
}
const used = new Set<string>()
const out: Record<string, string[]> = {}
for (const [k, v] of lessons) {
  out[k] = [...v].sort((a, b) => pageOf(a) - pageOf(b))
  v.forEach((id) => used.add(id))
}
const labels: Record<string, [string, string, number]> = {}
for (const id of [...used].sort()) {
  const r = byId.get(id)!
  labels[id] = [r.equation, r.typeRu ?? '', r.source.page ?? 0]
}

const body = `/* Сгенерировано scripts/gen-organic-lessons-v2.mts — не править руками. */
/** Реакции уроков #/organic (id реакций органики v2, по страницам учебника). */
export const ORGANIC_LESSON_REACTIONS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(out, null, 1)}

/** Подписи реакций для списка до загрузки reactions.json: [уравнение, тип словами учебника, страница]. */
export const ORGANIC_REACTION_LABELS: Readonly<Record<string, readonly [string, string, number]>> = ${JSON.stringify(labels)}
`
writeFileSync(new URL('../src/data/organicLab/organicLessonReactions.gen.ts', import.meta.url), body)
console.log('links', links, 'reactions', used.size, Object.entries(out).map(([k, v]) => `${k}:${v.length}`).join(' '))
