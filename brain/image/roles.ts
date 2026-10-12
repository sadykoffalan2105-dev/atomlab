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
    if (ic.students.presetsOnly && req.prompt) return { ok: false, code: 'bad_request', detail: 'presets_only' }
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
