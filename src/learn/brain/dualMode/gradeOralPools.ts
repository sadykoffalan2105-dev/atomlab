/**
 * Устные экзаменационные пулы для всех классов (7–11).
 *
 * 7 класс — существующий пул (g7ExamPools.getOralExamPool). 8–11 — пулы,
 * сгенерированные scripts/build-teacher-exam-pools.mts в ./examPools/oral-g*.json
 * (грузятся динамическим import(), чтобы не утяжелять стартовый бандл).
 */
import type { AppLocale } from '../../../i18n/types'
import { getOralExamPool } from '../../g7ExamPools'
import type { OralExamItem } from '../../topicQuizTypes'

export type GradeOralItem = OralExamItem & { sectionId?: string; source?: string }

type PoolFile = { grade: number; items: GradeOralItem[] }

const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  g8: () => import('./examPools/oral-g8.json'),
  g9: () => import('./examPools/oral-g9.json'),
  g10: () => import('./examPools/oral-g10.json'),
  g11: () => import('./examPools/oral-g11.json'),
}

const cache = new Map<string, GradeOralItem[]>()
const pending = new Map<string, Promise<GradeOralItem[]>>()

function chapterNum(chapterId: string): number {
  return Number(String(chapterId).replace(/^c/, '')) || 0
}

async function loadGrade(gradeId: string): Promise<GradeOralItem[]> {
  const hit = cache.get(gradeId)
  if (hit) return hit
  const loader = LOADERS[gradeId]
  if (!loader) return []
  let p = pending.get(gradeId)
  if (!p) {
    p = loader()
      .then((mod) => {
        const items = ((mod.default as PoolFile)?.items ?? []).filter((it) => it?.questionSpeak && it.rubric?.length)
        cache.set(gradeId, items)
        return items
      })
      .catch(() => {
        pending.delete(gradeId)
        return [] as GradeOralItem[]
      })
    pending.set(gradeId, p)
  }
  return p
}

/** Выбрать вопросы главы (или всего класса, если в главе мало вопросов). */
export function selectChapterItems(
  items: readonly GradeOralItem[],
  chapterId: string,
  sectionId?: string,
  minPerChapter = 3,
): GradeOralItem[] {
  const n = chapterNum(chapterId)
  const chapter = items.filter((it) => it.chapterNum === n)
  const base = chapter.length >= minPerChapter ? chapter : [...chapter, ...items.filter((it) => it.chapterNum !== n)]
  if (!sectionId) return base
  // Вопросы текущего параграфа — первыми.
  return [...base.filter((it) => it.sectionId === sectionId), ...base.filter((it) => it.sectionId !== sectionId)]
}

/** Для EN/UZ оставить переведённые вопросы, если они есть. */
export function preferTranslated(items: readonly GradeOralItem[], locale: AppLocale): GradeOralItem[] {
  if (locale === 'ru') return [...items]
  const translated = items.filter((it) =>
    locale === 'en' ? Boolean(it.questionSpeakEn) : Boolean(it.questionSpeakUz || it.questionSpeakEn),
  )
  return translated.length >= 3 ? translated : [...items]
}

/** Синхронно: 7 класс или уже загруженный класс; иначе null (нужен loadOralPool). */
export function getOralPoolSync(gradeId: string, chapterId: string, sectionId?: string): GradeOralItem[] | null {
  if (gradeId === 'g7') return getOralExamPool(gradeId, chapterId)
  const items = cache.get(gradeId)
  if (!items) return LOADERS[gradeId] ? null : []
  return selectChapterItems(items, chapterId, sectionId)
}

/** Устный пул для любого класса 7–11. */
export async function loadOralPool(gradeId: string, chapterId: string, sectionId?: string): Promise<GradeOralItem[]> {
  if (gradeId === 'g7') return getOralExamPool(gradeId, chapterId)
  const items = await loadGrade(gradeId)
  return selectChapterItems(items, chapterId, sectionId)
}
