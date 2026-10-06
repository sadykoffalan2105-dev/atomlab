/**
 * Органика v2: состояние страницы #/organic живёт только в URL (одна правда; перезагрузка и «назад» его сохраняют).
 * Совместимость: lesson, chapter/section, challenge, mol, src, mode (view|build|equation|isomer|name — старые
 * и molecule|constructor|isomers|synthesis|reactions|name — новые), rx (id реакции v2 или из src учебника).
 */
import {
  lessonForMoleculeV2,
  lessonForReaction,
  lessonMoleculeIds,
  LESSON_MOLECULE_ORDER,
  ORGANIC_CURRICULUM,
  ORGANIC_CURRICULUM_BY_ID,
  OV2_MODES,
  type OV2Mode,
} from '../../../data/organicLab/organicLessonsV2'
import { lessonForChallengeId, resolveOrganicLessonFromLearn, defaultMolForLesson, type OrganicLesson } from '../../../data/organicLab/organicCurriculum'
import { organicMoleculeById } from '../../../data/organicLab/organicMoleculeRegistry'

const LEGACY_MODE: Readonly<Record<string, OV2Mode>> = {
  view: 'molecule',
  build: 'constructor',
  equation: 'reactions',
  isomer: 'isomers',
  name: 'name',
}

export function parseModeParam(raw: string | null): OV2Mode | null {
  if (!raw) return null
  if ((OV2_MODES as readonly string[]).includes(raw)) return raw as OV2Mode
  return LEGACY_MODE[raw] ?? null
}

/** v2-id реакции из ссылки учебника в src: /learn/g/g10/book?…&unit=c1-s06&rx=r2 → g10-c1-s06-r2. */
export function reactionIdFromSrc(src: string | null): string | null {
  if (!src) return null
  try {
    const s = new URL(src, 'http://x')
    const grade = /\/learn\/g\/(g1[01])\//.exec(s.pathname)?.[1]
    const unit = s.searchParams.get('unit')
    const rx = s.searchParams.get('rx')
    return grade && unit && rx ? `${grade}-${unit}-${rx}` : null
  } catch {
    return null
  }
}

export interface OrganicUrlState {
  readonly lesson: OrganicLesson
  /** запрошенный режим (оболочка заменит недоступный в уроке на «Молекулу») */
  readonly mode: OV2Mode
  readonly molId: string
  /** запрошенная реакция (rx или из src учебника) */
  readonly rxId: string | null
  /** задание Конструктора: free | build:<id> | iso:<формула> */
  readonly task: string | null
  /** формула галереи изомеров (ASCII Хилла) */
  readonly formula: string | null
  readonly challenge: string | null
}

export function resolveOrganicUrl(params: URLSearchParams): OrganicUrlState {
  const lessonParam = params.get('lesson')
  const molParam = params.get('mol')
  const challenge = params.get('challenge')
  const rxId = params.get('rx') || reactionIdFromSrc(params.get('src'))
  const validMol = (id: string | null) => (id && organicMoleculeById[id] ? id : null)

  let lesson: OrganicLesson | undefined = lessonParam ? ORGANIC_CURRICULUM_BY_ID[lessonParam] : undefined
  if (!lesson) {
    const ch = Number(params.get('chapter'))
    if (params.get('chapter') && Number.isFinite(ch) && ch >= 1) {
      const secRaw = params.get('section')
      lesson = resolveOrganicLessonFromLearn(ch, secRaw != null && secRaw !== '' ? Number(secRaw) : undefined)
    }
  }
  if (!lesson && challenge) lesson = lessonForChallengeId(challenge) ?? lessonForMoleculeV2(challenge)
  if (!lesson && validMol(molParam)) lesson = lessonForMoleculeV2(molParam!)
  if (!lesson && rxId) lesson = lessonForReaction(rxId)
  lesson ??= ORGANIC_CURRICULUM[0]!

  let mode = parseModeParam(params.get('mode'))
  if (!mode && challenge) mode = 'constructor'
  mode ??= 'molecule'

  const molId = validMol(molParam) ?? validMol(challenge) ?? defaultMolForLessonV2(lesson)
  let task = params.get('task')
  if (!task && challenge && organicMoleculeById[challenge]) task = `build:${challenge}`
  if (!task && mode === 'constructor' && validMol(molParam)) task = `build:${molParam}`
  return { lesson, mode, molId, rxId, task, formula: params.get('f'), challenge }
}

export function defaultMolForLessonV2(lesson: OrganicLesson): string {
  // у урока задан порядок «от простого к сложному» — первым открывается первая молекула полосы
  if (LESSON_MOLECULE_ORDER[lesson.id]) {
    const first = lessonMoleculeIds(lesson)[0]
    if (first) return first
  }
  const d = defaultMolForLesson(lesson)
  if (organicMoleculeById[d]) return d
  return lessonMoleculeIds(lesson)[0] ?? 'methane'
}

/** Новый URL: меняем только нужное, src и прочее сохраняем; старые challenge/chapter/section убираем после первого входа. */
export function patchOrganicParams(
  params: URLSearchParams,
  patch: Partial<Record<'lesson' | 'mode' | 'mol' | 'rx' | 'task' | 'f', string | null>>,
): URLSearchParams {
  const p = new URLSearchParams(params)
  p.delete('chapter')
  p.delete('section')
  p.delete('challenge')
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') p.delete(k)
    else p.set(k, v)
  }
  return p
}
