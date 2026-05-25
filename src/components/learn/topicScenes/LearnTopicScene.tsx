import type { ComponentType } from 'react'
import { ConfiguredTopicScene } from './ConfiguredTopicScene'
import type { TopicSceneProps } from './scenesGrade7'
import * as G7 from './scenesGrade7'

const G7_MAP: Record<string, ComponentType<TopicSceneProps>> = {
  topic_g7_c1_s01: G7.G7C1S01Scene,
  topic_g7_c1_s02: G7.G7C1S02Scene,
  topic_g7_c1_s03: G7.G7C1S03Scene,
  topic_g7_c1_s04: G7.G7C1S04Scene,
  topic_g7_c1_s05: G7.G7C1S05Scene,
  topic_g7_c1_s06: G7.G7C1S06Scene,
  topic_g7_c1_s07: G7.G7C1S07Scene,
  topic_g7_c1_s08: G7.G7C1S08Scene,
  topic_g7_c1_s09: G7.G7C1S09Scene,
  topic_g7_c1_s10: G7.G7C1S10Scene,
  topic_g7_c2_s01: G7.G7C2S01Scene,
  topic_g7_c2_s02: G7.G7C2S02Scene,
  topic_g7_c2_s03: G7.G7C2S03Scene,
  topic_g7_c2_s04: G7.G7C2S04Scene,
  topic_g7_c2_s05: G7.G7C2S05Scene,
  topic_g7_c2_s06: G7.G7C2S06Scene,
  topic_g7_c3_s01: G7.G7C3S01Scene,
  topic_g7_c3_s02: G7.G7C3S02Scene,
  topic_g7_c3_s03: G7.G7C3S03Scene,
  topic_g7_c3_s04: G7.G7C3S04Scene,
  topic_g7_c3_s05: G7.G7C3S05Scene,
  topic_g7_c3_s06: G7.G7C3S06Scene,
  topic_g7_c4_s01: G7.G7C4S01Scene,
  topic_g7_c4_s02: G7.G7C4S02Scene,
  topic_g7_c4_s03: G7.G7C4S03Scene,
  topic_g7_c4_s04: G7.G7C4S04Scene,
  topic_g7_c5_s01: G7.G7C5S01Scene,
  topic_g7_c5_s02: G7.G7C5S02Scene,
  topic_g7_c5_s03: G7.G7C5S03Scene,
}

export function LearnTopicScene({ sceneId, autoRotate = true }: { sceneId: string; autoRotate?: boolean }) {
  const Explicit = G7_MAP[sceneId]
  if (Explicit) return <Explicit autoRotate={autoRotate} />
  return <ConfiguredTopicScene sceneId={sceneId} autoRotate={autoRotate} />
}
