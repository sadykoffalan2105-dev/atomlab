import { learnAllSections } from '../data/learnCurriculumUz'
import { messagesRu } from '../i18n/messagesRu'
import { parseTopicSceneId } from './learnTopicScenes'

export type TopicSceneDef =
  | { kind: 'particles'; colors: string[]; speeds: number[]; ordered: boolean[]; count: number }
  | { kind: 'atom'; protons: number; neutrons: number; shells: readonly { r: number; e: number }[]; accent: string }
  | { kind: 'burn'; accent: string; wind: number }
  | { kind: 'electrolysis'; accent: string; bubbleRate: number }
  | { kind: 'bond'; mode: 'ionic' | 'covalent' | 'polar'; leftColor: string; rightColor: string }
  | { kind: 'gas'; colors: string[]; pressure: number }
  | { kind: 'crystal'; color: string; layers: number }
  | { kind: 'metal'; color: string; activity: number }
  | { kind: 'periodic'; accent: string; period: number }
  | { kind: 'industry'; accent: string; stages: number }

const ACCENTS = ['#3dffec', '#ff8844', '#aa66ff', '#66ff99', '#ff5566', '#ffcc44', '#4488ff'] as const

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function defForSection(gradeId: string, chapterId: string, sectionId: string, kp: number): TopicSceneDef {
  const h = hash(`${gradeId}_${chapterId}_${sectionId}`)
  const accent = ACCENTS[h % ACCENTS.length]!
  const kinds: TopicSceneDef['kind'][] = [
    'particles',
    'atom',
    'burn',
    'electrolysis',
    'bond',
    'gas',
    'crystal',
    'metal',
    'periodic',
    'industry',
  ]
  const kind = kinds[(h + kp) % kinds.length]!

  switch (kind) {
    case 'particles':
      return {
        kind,
        colors: [accent, ACCENTS[(h + 1) % 7]!, ACCENTS[(h + 2) % 7]!],
        speeds: [0.2 + (h % 5) * 0.15, 0.8 + (h % 4) * 0.3, 1.5 + (h % 3) * 0.4],
        ordered: [h % 3 === 0, false, h % 2 === 0],
        count: 22 + (h % 20),
      }
    case 'atom':
      return {
        kind,
        protons: 1 + (h % 18),
        neutrons: h % 12,
        shells: [
          { r: 0.35, e: 2 },
          { r: 0.55 + (h % 3) * 0.08, e: Math.min(8, 2 + (h % 7)) },
        ],
        accent,
      }
    case 'burn':
      return { kind, accent, wind: 0.5 + (h % 10) * 0.1 }
    case 'electrolysis':
      return { kind, accent, bubbleRate: 0.25 + (h % 5) * 0.08 }
    case 'bond':
      return {
        kind,
        mode: (['ionic', 'covalent', 'polar'] as const)[h % 3]!,
        leftColor: accent,
        rightColor: ACCENTS[(h + 3) % 7]!,
      }
    case 'gas':
      return { kind, colors: [accent, '#aaccff'], pressure: 0.4 + (h % 6) * 0.15 }
    case 'crystal':
      return { kind, color: accent, layers: 2 + (h % 4) }
    case 'metal':
      return { kind, color: accent, activity: (h % 10) / 10 }
    case 'periodic':
      return { kind, accent, period: 1 + (h % 4) }
    case 'industry':
      return { kind, accent, stages: 2 + (h % 3) }
    default:
      return { kind: 'particles', colors: [accent], speeds: [1], ordered: [false], count: 30 }
  }
}

const sectionBySceneId = new Map<string, { kp: number; titleKey: string }>()
for (const sec of learnAllSections()) {
  sectionBySceneId.set(`topic_${sec.gradeId}_${sec.chapterId}_${sec.id}`, {
    kp: sec.kpNumber,
    titleKey: sec.titleKey,
  })
}

export function getTopicSceneDef(sceneId: string): TopicSceneDef | null {
  const parsed = parseTopicSceneId(sceneId)
  if (!parsed) return null
  if (parsed.gradeId === 'g7') return null
  const meta = sectionBySceneId.get(sceneId)
  const kp = meta?.kp ?? parseInt(parsed.sectionId.slice(1), 10)
  return defForSection(parsed.gradeId, parsed.chapterId, parsed.sectionId, kp)
}

export function getTopicSceneLabel(sceneId: string): string {
  const meta = sectionBySceneId.get(sceneId)
  if (meta && meta.titleKey in messagesRu) {
    return messagesRu[meta.titleKey as keyof typeof messagesRu]
  }
  return sceneId
}
