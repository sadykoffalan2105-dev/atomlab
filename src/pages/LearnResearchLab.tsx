import { Navigate, useSearchParams } from 'react-router-dom'
import { lessonForChallengeId } from '../data/organicLab/organicCurriculum'
import { lessonForMoleculeV2 } from '../data/organicLab/organicLessonsV2'
import { organicMoleculeById } from '../data/organicLab/organicMoleculeRegistry'
import { ORGANIC_BUILD_CHALLENGES } from '../data/researchLab/organicBuildCatalog'

function resolveChallenge(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === 'hexane') return 'n-hexane'
  if (ORGANIC_BUILD_CHALLENGES.some((c) => c.id === raw) || organicMoleculeById[raw]) return raw
  return undefined
}

/** Органика v2: старое «Собрать» = Конструктор с заданием «собери по названию». */
function organicLabUrl(challenge?: string): string {
  const p = new URLSearchParams()
  if (challenge) {
    const lesson = lessonForChallengeId(challenge) ?? lessonForMoleculeV2(challenge)
    if (lesson) p.set('lesson', lesson.id)
    p.set('challenge', challenge)
    p.set('mol', challenge)
    p.set('mode', 'constructor')
  }
  const qs = p.toString()
  return qs ? `/organic?${qs}` : '/organic'
}

/** Старые URL `/learn/research` → программа органической лаборатории. */
export function LearnResearchLab() {
  const [searchParams] = useSearchParams()
  const challenge = resolveChallenge(searchParams.get('challenge') ?? undefined)
  return <Navigate to={organicLabUrl(challenge)} replace />
}
