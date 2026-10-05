/**
 * Клиент фонового воркера Конструктора (engine.worker.ts). Без поддержки Worker — считает тут же (setTimeout).
 */
import { canonicalizeMol, embed3D, nameMol, toMol, type SkeletonGraph } from '../../../chemistry/organicV2'
import type { NameSet } from './analysis'
import type { P3Atom, P3Bond } from './Preview3D'

export interface Embedded { readonly atoms: readonly P3Atom[]; readonly bonds: readonly P3Bond[] }

let worker: Worker | null = null
let seq = 0
const waiting = new Map<number, (v: { ok: boolean; value?: unknown }) => void>()

function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined') return null
  try {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown }>) => {
      const cb = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      cb?.(e.data)
    }
    worker.onerror = () => { worker = null }
  } catch {
    worker = null
  }
  return worker
}

function local(kind: 'name' | 'embed', graph: SkeletonGraph): unknown {
  if (kind === 'name') {
    const nm = nameMol(canonicalizeMol(toMol(graph)).mol)
    return { ru: nm.ru, en: nm.en, uz: nm.uz, synonymsRu: nm.synonymsRu, synonymsEn: nm.synonymsEn, synonymsUz: nm.synonymsUz, systematic: nm.systematic }
  }
  const em = embed3D(graph)
  return { atoms: em.atoms.map((a) => ({ el: a.el, p: a.p })), bonds: em.bonds.map((b) => ({ a: b.a, b: b.b, o: b.o })) }
}

function run<T>(kind: 'name' | 'embed', graph: SkeletonGraph): Promise<T> {
  const w = getWorker()
  if (!w) return new Promise((res, rej) => setTimeout(() => { try { res(local(kind, graph) as T) } catch (e) { rej(e) } }, 0))
  const id = ++seq
  return new Promise((res, rej) => {
    waiting.set(id, (r) => (r.ok ? res(r.value as T) : rej(new Error('engine'))))
    // граф без лишних полей — структурное клонирование дешёвое
    w.postMessage({ id, kind, graph: { atoms: graph.atoms.map((a) => ({ ...a })), bonds: graph.bonds.map((b) => ({ ...b })) } })
  })
}

export const nameInBackground = (g: SkeletonGraph): Promise<NameSet> => run<NameSet>('name', g)
export const embedInBackground = (g: SkeletonGraph): Promise<Embedded> => run<Embedded>('embed', g)
