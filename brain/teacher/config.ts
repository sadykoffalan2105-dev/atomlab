/**
 * Автоматизация учителя v1 (brain/teacher/**) — блок конфига `teacher` в config.json владельца.
 *   enabled      — выключатель всех /teacher/*;
 *   tokens       — ключи учителей (≥ 16 символов; поле teacherKey в теле запроса). Ключи картинок
 *                  image.teacherTokens тоже подходят (useImageTokens) — одному учителю не нужно два ключа;
 *   rate         — отдельные лимиты на ключ учителя: план/тест (дёшево, без LLM) и проверка работ (модель со зрением);
 *   grade        — фото работ: сколько, какого размера, сколько ждать модель;
 *   polish       — LLM только шлифует формулировки плана (числа, формулы и уравнения не трогает); нет LLM — без шлифовки;
 *   scale        — пороги школьной оценки «5/4/3/2» в процентах (разбаловка СОР/СОЧ).
 */
export type TeacherConfig = {
  enabled: boolean
  tokens: string[]
  useImageTokens: boolean
  rate: { perMin: number; perDay: number; gradePerMin: number; gradePerDay: number }
  grade: { maxImages: number; maxImageBytes: number; bodyLimitBytes: number; timeoutMs: number }
  polish: { enabled: boolean; timeoutMs: number }
  scale: { five: number; four: number; three: number }
}

export const DEFAULT_TEACHER_CONFIG: TeacherConfig = {
  enabled: true,
  tokens: [],
  useImageTokens: true,
  rate: { perMin: 20, perDay: 400, gradePerMin: 4, gradePerDay: 120 },
  grade: { maxImages: 4, maxImageBytes: 1_572_864, bodyLimitBytes: 8 * 1024 * 1024, timeoutMs: 60_000 },
  polish: { enabled: true, timeoutMs: 12_000 },
  // принятая в школах шкала: 86–100 % — «5», 71–85 % — «4», 56–70 % — «3», ниже — «2»
  scale: { five: 86, four: 71, three: 56 },
}

/** Слить блок из config.json с умолчаниями (старый конфиг без блока — умолчания). */
export function teacherConfig(cfg: { teacher?: Partial<TeacherConfig> }): TeacherConfig {
  const t = cfg.teacher ?? {}
  return {
    ...DEFAULT_TEACHER_CONFIG,
    ...t,
    tokens: Array.isArray(t.tokens) ? t.tokens.filter((x) => typeof x === 'string') : [],
    rate: { ...DEFAULT_TEACHER_CONFIG.rate, ...(t.rate ?? {}) },
    grade: { ...DEFAULT_TEACHER_CONFIG.grade, ...(t.grade ?? {}) },
    polish: { ...DEFAULT_TEACHER_CONFIG.polish, ...(t.polish ?? {}) },
    scale: { ...DEFAULT_TEACHER_CONFIG.scale, ...(t.scale ?? {}) },
  }
}
