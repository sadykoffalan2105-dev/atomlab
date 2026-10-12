/**
 * Задачи, напечатанные в учебниках Kimyo 7–11 (brain/calc/fixtures/textbook.jsonl — выписаны из книг
 * npm run brain:calc-mine и проверены): условие → единица карты «g<класс>:<§>». Нужна для подписи расчёта
 * «§, где напечатана эта задача» (tools.ts textbookTaskUnit). Файла нет — пустой список.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

export type TextbookTaskRef = { statement: string; unitId: string; page?: number }

let cache: TextbookTaskRef[] | null = null

export function textbookTaskRefs(): TextbookTaskRef[] {
  if (cache) return cache
  cache = []
  try {
    const file = fileURLToPath(new URL('./fixtures/textbook.jsonl', import.meta.url))
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue
      const r = JSON.parse(line) as { grade?: number; kp?: string; statement?: string; page?: number }
      if (r.grade && r.kp && r.statement) cache.push({ statement: r.statement, unitId: `g${r.grade}:${r.kp}`, page: r.page })
    }
  } catch {
    /* фикстур нет — подпись по типу задачи */
  }
  return cache
}
