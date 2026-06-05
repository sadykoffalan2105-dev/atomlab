/** Ручные картинки из Nano Banana: `public/learn/refs/{sceneId}.nanobanana.{ext}` */
export function learnRefImageCandidates(sceneId: string): string[] {
  const base = `/learn/refs/${sceneId}.nanobanana`
  return [`${base}.webp`, `${base}.png`, `${base}.jpg`]
}
