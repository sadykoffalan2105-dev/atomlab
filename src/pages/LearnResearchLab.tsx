import { Navigate, useSearchParams } from 'react-router-dom'
import { lessonForChallengeId } from '../data/organicLab/organicCurriculum'
import { ORGANIC_BUILD_CHALLENGES } from '../data/researchLab/organicBuildCatalog'

function resolveChallenge(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === 'hexane') return 'n-hexane'
  if (ORGANIC_BUILD_CHALLENGES.some((c) => c.id === raw)) return raw
  return undefined
}

function organicLabUrl(challenge?: string): string {
  const p = new URLSearchParams()
  if (challenge) {
    const lesson = lessonForChallengeId(challenge)
    if (lesson) p.set('lesson', lesson.id)
    p.set('challenge', challenge)
    p.set('mol', challenge)
    p.set('mode', 'build')
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
