import { getIsometricSceneDef, getIsometricSceneTitle } from './learnIsometricScenes'
import { learnAllSections } from '../data/learnCurriculumUz'

const STYLE =
  'Premium isometric 3D educational infographic for Russian school chemistry, soft studio lighting, light gray-blue background #d8dce8, clean modern style like high-end EdTech app, rounded white platforms, vivid but not childish colors, sharp readable Russian Cyrillic text on image, no watermark, 16:9 landscape'

export function buildNanoBananaPrompt(sceneId: string): string {
  const def = getIsometricSceneDef(sceneId)
  const title = getIsometricSceneTitle(sceneId)
  if (!def) {
    return `${STYLE}. Topic: ${title}. Four isometric platforms with 3D chemistry icons and Russian labels explaining the lesson.`
  }

  const panelDesc = def.panels
    .map((p) => {
      const labels = p.labels.map((l) => l.text).join(', ')
      const props = p.props.map((pr) => pr.type).join(', ')
      return `Platform "${p.title.replace(/\n/g, ' ')}" with 3D objects (${props}), labels: ${labels}`
    })
    .join('; ')

  const center = def.centerTitle
    ? `Center: hexagon frame with ${def.centerProp?.type ?? 'DNA helix'}, title in Russian: "${def.centerTitle.replace(/\n/g, ' ')}". `
    : ''

  return `${STYLE}. Lesson topic: "${title}". ${center}Layout: ${panelDesc}. Style reference: chemistry science infographic with four corners and central DNA. All text must be in Russian.`
}

export function allNanoBananaPromptEntries(): { sceneId: string; gradeId: string; chapterId: string; sectionId: string; title: string; prompt: string }[] {
  return learnAllSections().map((sec) => {
    const sceneId = `topic_${sec.gradeId}_${sec.chapterId}_${sec.id}`
    return {
      sceneId,
      gradeId: sec.gradeId,
      chapterId: sec.chapterId,
      sectionId: sec.id,
      title: getIsometricSceneTitle(sceneId),
      prompt: buildNanoBananaPrompt(sceneId),
    }
  })
}
