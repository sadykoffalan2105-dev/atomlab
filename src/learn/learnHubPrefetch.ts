import { prefetchLearnImage } from '../components/learn/LearnSlideVisual'
import { publicAssetUrl } from '../utils/publicAssetUrl'

const prefetched = new Set<string>()

function prefetchOnce(url: string): void {
  if (prefetched.has(url)) return
  prefetched.add(url)
  prefetchLearnImage(url)
}

/** Постер § + первый JPEG-слайд при hover в хабе. */
export function prefetchLearnSectionHub(visualId: string | undefined): void {
  if (!visualId) return
  const topicId = visualId.startsWith('topic_') ? visualId : visualId
  prefetchOnce(`/learn/posters/${topicId}.png`)
  prefetchOnce(`/learn/slides/${topicId}/s02.jpg`)
}

/** WASM catalog core (один раз за сессию). */
export function prefetchWasmCore(): void {
  const url = publicAssetUrl('wasm/atomlab_core.wasm')
  if (prefetched.has(url)) return
  prefetched.add(url)
  void fetch(url, { method: 'GET', cache: 'force-cache' }).catch(() => {})
}
