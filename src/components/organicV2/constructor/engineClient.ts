/**
 * Клиент фонового воркера Конструктора (engine.worker.ts). Без поддержки Worker — считает тут же (setTimeout).
 */
import { canonicalizeMol, embed3D, nameMol, toMol, type SkeletonGraph } from '../../../chemistry/organicV2'
import type { NameSet } from './analysis'
import type { Embedded } from './toOV2'

export type { Embedded }

type Kind = 'name' | 'embed'
/** Два воркера (название и 3D), чтобы долгий намер большой молекулы не задерживал 3D. «Побеждает последний»:
 * новый запрос, пока старый ещё считается, перезапускает воркер — очередь устаревших расчётов не копится. */
const workers: Record<Kind, Worker | null> = { name: null, embed: null }
const busy: Record<Kind, number> = { name: 0, embed: 0 }
let seq = 0
const waiting = new Map<number, { kind: Kind; cb: (v: { ok: boolean; value?: unknown }) => void }>()

function getWorker(kind: Kind): Worker | null {
  if (busy[kind] && workers[kind]) {
    workers[kind]!.terminate()
    workers[kind] = null
    for (const [id, w] of waiting) if (w.kind === kind) { waiting.delete(id); w.cb({ ok: false }) }
    busy[kind] = 0
  }
  if (workers[kind]) return workers[kind]
  if (typeof Worker === 'undefined') return null
  try {
    const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown }>) => {
      const cb = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      busy[kind] = Math.max(0, busy[kind] - 1)
      cb?.cb(e.data)
    }
    w.onerror = () => { workers[kind] = null }
    workers[kind] = w
  } catch {
    workers[kind] = null
  }
  return workers[kind]
}

function local(kind: 'name' | 'embed', graph: SkeletonGraph): unknown {
  if (kind === 'name') {
    const nm = nameMol(canonicalizeMol(toMol(graph)).mol)
    return { ru: nm.ru, en: nm.en, uz: nm.uz, synonymsRu: nm.synonymsRu, synonymsEn: nm.synonymsEn, synonymsUz: nm.synonymsUz, systematic: nm.systematic }
  }
  const em = embed3D(graph)
  return { atoms: em.atoms.map((a) => ({ el: a.el, p: a.p, hyb: a.hyb, charge: a.charge })), bonds: em.bonds.map((b) => ({ a: b.a, b: b.b, o: b.o, ar: b.ar })) }
}

function run<T>(kind: Kind, graph: SkeletonGraph): Promise<T> {
  const w = getWorker(kind)
  if (!w) return new Promise((res, rej) => setTimeout(() => { try { res(local(kind, graph) as T) } catch (e) { rej(e) } }, 0))
  const id = ++seq
  busy[kind]++
  return new Promise((res, rej) => {
    waiting.set(id, { kind, cb: (r) => (r.ok ? res(r.value as T) : rej(new Error('engine'))) })
    // граф без лишних полей — структурное клонирование дешёвое
    w.postMessage({ id, kind, graph: { atoms: graph.atoms.map((a) => ({ ...a })), bonds: graph.bonds.map((b) => ({ ...b })) } })
  })
}

export const nameInBackground = (g: SkeletonGraph): Promise<NameSet> => run<NameSet>('name', g)
export const embedInBackground = (g: SkeletonGraph): Promise<Embedded> => run<Embedded>('embed', g)
