import { getIsometricSceneDef } from './learnIsometricScenes'

/** Нейтральные образовательные фото (Unsplash, без людей в кадре). */
export const LIFE_PHOTO = {
  labHero:
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=85',
  glassware:
    'https://images.unsplash.com/photo-1582719471137-c3967ffb1c42?auto=format&fit=crop&w=900&q=80',
  microscope:
    'https://images.unsplash.com/photo-1576086213869-783f5f57dffe?auto=format&fit=crop&w=900&q=80',
  materials:
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=900&q=80',
  food:
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80',
  medicine:
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80',
  nature:
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
  recycling:
    'https://images.unsplash.com/photo-1611284446314-60d298b55c22?auto=format&fit=crop&w=900&q=80',
  water:
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=900&q=80',
  periodic:
    'https://images.unsplash.com/photo-1606107557192-5867caff0028?auto=format&fit=crop&w=900&q=80',
  safety:
    'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80',
  classroom:
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=85',
} as const

export type LifePhotoCard = {
  title: string
  image: string
  chips: string[]
}

export type LifePhotoScene = {
  sceneId: string
  accent: string
  hero: { title: string; image: string }
  cards: LifePhotoCard[]
}

const DEFAULT_CARD_IMAGES = [
  LIFE_PHOTO.glassware,
  LIFE_PHOTO.materials,
  LIFE_PHOTO.food,
  LIFE_PHOTO.nature,
]

const SCENE_IMAGE_OVERRIDES: Record<string, { hero: string; cards: string[] }> = {
  topic_g7_c1_s01: {
    hero: LIFE_PHOTO.labHero,
    cards: [LIFE_PHOTO.microscope, LIFE_PHOTO.materials, LIFE_PHOTO.medicine, LIFE_PHOTO.recycling],
  },
}

function pickCardImages(sceneId: string, count: number): string[] {
  const o = SCENE_IMAGE_OVERRIDES[sceneId]
  const pool = o?.cards ?? DEFAULT_CARD_IMAGES
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]!)
}

export function getLifeScenePhotos(sceneId: string): LifePhotoScene | null {
  const iso = getIsometricSceneDef(sceneId)
  if (!iso) return null

  const heroImage = SCENE_IMAGE_OVERRIDES[sceneId]?.hero ?? LIFE_PHOTO.classroom
  const cardImages = pickCardImages(sceneId, iso.panels.length)

  return {
    sceneId,
    accent: iso.accent,
    hero: {
      title: (iso.centerTitle ?? '').replace(/\n/g, ' · '),
      image: heroImage,
    },
    cards: iso.panels.map((panel, i) => ({
      title: panel.title.replace(/\n/g, ' '),
      image: cardImages[i]!,
      chips: panel.labels.map((l) => l.text),
    })),
  }
}

const LIFE_PHOTO_EXCLUDE = new Set(['topic_g7_c1_s01'])

export function hasLifeScenePhotos(sceneId: string): boolean {
  if (LIFE_PHOTO_EXCLUDE.has(sceneId)) return false
  return getIsometricSceneDef(sceneId) != null
}
