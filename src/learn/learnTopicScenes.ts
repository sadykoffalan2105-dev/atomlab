import type { LearnSection, LearnVisualSpec } from '../types/learn'

/** ID сцены = topic_{grade}_{chapter}_{section}, например topic_g7_c1_s01 */
export function topicSceneVisualId(section: Pick<LearnSection, 'gradeId' | 'chapterId' | 'id'>): string {
  return `topic_${section.gradeId}_${section.chapterId}_${section.id}`
}

export function parseTopicSceneId(sceneId: string): { gradeId: string; chapterId: string; sectionId: string } | null {
  const m = sceneId.match(/^topic_(g[789])_(c\d+)_(s\d+)$/)
  if (!m) return null
  return { gradeId: m[1]!, chapterId: m[2]!, sectionId: m[3]! }
}

export function isTopicSceneId(id: string): boolean {
  return /^topic_g[789]_c\d+_s\d+$/.test(id)
}

export function topicSceneSpec(id: string): LearnVisualSpec {
  return { id, kind: 'topicScene', sceneId: id }
}
