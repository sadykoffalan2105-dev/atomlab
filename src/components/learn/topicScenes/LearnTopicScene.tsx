import { hasLifeScenePhotos } from '../../../learn/learnTopicLifePhotos'
import { hasCyberDashboard } from '../../../learn/learnCyberDashboard'

/** Шаблонные изометрические сцены отключены — 3D только через каталог молекул. */
export function LearnTopicScene({ sceneId }: { sceneId: string; autoRotate?: boolean }) {
  if (hasCyberDashboard(sceneId) || hasLifeScenePhotos(sceneId)) return null
  return null
}
