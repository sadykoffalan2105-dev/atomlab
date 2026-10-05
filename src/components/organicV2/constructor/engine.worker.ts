/// <reference lib="webworker" />
/**
 * Фоновые расчёты Конструктора: название ИЮПАК больших молекул и 3D собранного (встраиватель движка).
 * Холст не ждёт их — разбор (H, формула, валентность, класс) идёт сразу, а это приходит следом.
 */
import { canonicalizeMol, embed3D, nameMol, toMol, type SkeletonGraph } from '../../../chemistry/organicV2'

export type EngineReq = { readonly id: number; readonly kind: 'name' | 'embed'; readonly graph: SkeletonGraph }

self.onmessage = (e: MessageEvent<EngineReq>) => {
  const { id, kind, graph } = e.data
  try {
    if (kind === 'name') {
      const nm = nameMol(canonicalizeMol(toMol(graph)).mol)
      postMessage({ id, ok: true, value: { ru: nm.ru, en: nm.en, uz: nm.uz, synonymsRu: nm.synonymsRu, synonymsEn: nm.synonymsEn, synonymsUz: nm.synonymsUz, systematic: nm.systematic } })
    } else {
      const em = embed3D(graph)
      postMessage({ id, ok: true, value: { atoms: em.atoms.map((a) => ({ el: a.el, p: a.p, hyb: a.hyb, charge: a.charge })), bonds: em.bonds.map((b) => ({ a: b.a, b: b.b, o: b.o, ar: b.ar })) } })
    }
  } catch (err) {
    postMessage({ id, ok: false, error: String(err) })
  }
}
