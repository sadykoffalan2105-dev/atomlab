import { MoleculeStructureGameHub } from '../moleculeGame/MoleculeStructureGameHub'

/** Интерактив §1: 3D-структуры молекул из каталога + тест. */
export function LearnCyberDashboard({
  sceneId,
  presentationMode = false,
}: {
  sceneId: string
  presentationMode?: boolean
}) {
  return <MoleculeStructureGameHub presentationMode={presentationMode} sectionId={sceneId} />
}
