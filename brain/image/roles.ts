/**
 * Кто просит картинку и что ему можно.
 *   owner   — админ мозга (заголовок X-Brain-Admin; пустой ключ — только с этого ПК), см. brain/http/guard.ts;
 *   teacher — поле teacherKey в теле (новый заголовок не вводим: guard.ts и CORS не меняются), ключи — config.image.teacherTokens;
 *   student — все остальные: по умолчанию выключены; включены — только готовые темы своего класса ±gradeWindow.
 */
import crypto from 'node:crypto'
import type { ImageConfig } from '../config.ts'
import { presetById, presetFitsGrade, type ImagePreset } from './presets.ts'
import type { ImageErrorCode, ImageRequest, ImageRole } from './types.ts'

function sameSecret(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest()
  const hb = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

/** Ключ учителя подходит? (ключи короче 16 символов не считаются — защита от «1234»). */
export function isTeacherKey(key: unknown, tokens: readonly string[]): boolean {
  if (typeof key !== 'string' || key.length < 16 || key.length > 256) return false
  let hit = false
  // сравниваем со всеми ключами (время не зависит от того, какой совпал)
  for (const t of tokens) if (typeof t === 'string' && t.trim().length >= 16 && sameSecret(key.trim(), t.trim())) hit = true
  return hit
}

export function resolveRole(admin: boolean, teacherKey: unknown, ic: ImageConfig): ImageRole {
  if (admin) return 'owner'
  if (isTeacherKey(teacherKey, ic.teacherTokens ?? [])) return 'teacher'
  return 'student'
}

export type Permit = { ok: true; preset?: ImagePreset; nsfwThreshold: number; freeText: boolean } | { ok: false; code: ImageErrorCode; detail: string }

/** Правила роли для уже проверенного запроса. */
export function permit(role: ImageRole, req: ImageRequest, ic: ImageConfig): Permit {
  if (!ic.enabled) return { ok: false, code: 'disabled', detail: 'image.enabled=false' }
  const preset = presetById(req.presetId)
  if (req.presetId && !preset) return { ok: false, code: 'bad_request', detail: 'unknown_preset' }
  if (role === 'student') {
    if (!ic.students.enabled) return { ok: false, code: 'forbidden', detail: 'students_disabled' }
    // решение владельца: ученик рисует ТОЛЬКО готовые темы — свой текст отклоняется всегда (даже при presetsOnly=false)
    if (req.prompt) return { ok: false, code: 'bad_request', detail: 'presets_only' }
    if (!preset) return { ok: false, code: 'bad_request', detail: 'preset_required' }
    if (!presetFitsGrade(preset, req.context?.gradeId, ic.students.gradeWindow)) return { ok: false, code: 'bad_request', detail: 'preset_grade' }
    return { ok: true, preset, nsfwThreshold: ic.students.nsfwThreshold, freeText: false }
  }
  const freeAllowed = role === 'owner' ? ic.freeText.owner : ic.freeText.teacher
  if (req.prompt && !preset) {
    if (!freeAllowed) return { ok: false, code: 'bad_request', detail: 'free_text_off' }
    return { ok: true, nsfwThreshold: ic.safety.nsfwThreshold, freeText: true }
  }
  if (!preset) return { ok: false, code: 'bad_request', detail: 'preset_or_prompt' }
  return { ok: true, preset, nsfwThreshold: ic.safety.nsfwThreshold, freeText: false }
}

const HOUR = 60 * 60_000
const DAY = 24 * HOUR

/**
 * Свои лимиты картинок ученика (config.image.students.perHour / perDay) — сверх общих rate.perMin/perDay сервера:
 * считаются начатые задания (принятые после permit), ключ — ученик (адрес + сессия X-Brain-Session).
 * Память ограничена: старые отметки чистятся, ключей не больше maxKeys (самые давние выбрасываются).
 */
export class StudentQuota {
  private hits = new Map<string, number[]>()
  constructor(private readonly maxKeys = 5000) {}

  /** Проверить и сразу засчитать попытку; отказ — правило и через сколько секунд можно снова. */
  take(
    key: string,
    limits: { perHour?: number; perDay?: number },
    now = Date.now(),
  ): { ok: true } | { ok: false; rule: 'image_student_hour' | 'image_student_day'; retryAfterSec: number } {
    const perHour = Math.max(0, Math.floor(limits.perHour ?? 0))
    const perDay = Math.max(0, Math.floor(limits.perDay ?? 0))
    if (!perHour && !perDay) return { ok: true }
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < DAY)
    const inHour = list.filter((t) => now - t < HOUR)
    const wait = (from: number, span: number) => Math.max(1, Math.ceil((from + span - now) / 1000))
    if (perDay && list.length >= perDay) {
      this.hits.set(key, list)
      return { ok: false, rule: 'image_student_day', retryAfterSec: wait(list[list.length - perDay]!, DAY) }
    }
    if (perHour && inHour.length >= perHour) {
      this.hits.set(key, list)
      return { ok: false, rule: 'image_student_hour', retryAfterSec: wait(inHour[inHour.length - perHour]!, HOUR) }
    }
    list.push(now)
    this.hits.delete(key) // в конец Map — «самые давние» ключи впереди
    this.hits.set(key, list)
    while (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value as string)
    return { ok: true }
  }

  /** Сколько учеников сейчас в счётчике (самопроверка / статус). */
  get size(): number {
    return this.hits.size
  }
}
