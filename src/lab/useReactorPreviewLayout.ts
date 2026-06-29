import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactorEquationTerm } from '../chemistry/reactorEquationBalance'
import type { ReactorPreviewAtom } from '../components/lab/reactorPreviewLayout'
import { buildReactorPreviewAtoms } from '../components/lab/reactorPreviewLayout'
import { requestPreviewLayout } from './reactorPreviewLayoutWorkerClient'

function termsSignature(terms: readonly ReactorEquationTerm[]): string {
  if (!terms.length) return ''
  return terms.map((t) => `${t.id}:${t.z}:${t.coeff}:${t.diatomic ? 1 : 0}`).join('|')
}

/**
 * Layout превью: мгновенный sync-кэш + WASM/worker off-thread для тяжёлых уравнений.
 * Shell ref не даёт вернуть пустой список между кадрами (zero-black-screen).
 */
export function useReactorPreviewLayout(
  terms: readonly ReactorEquationTerm[],
  coeffEditBurst: boolean,
): readonly ReactorPreviewAtom[] {
  const termsSig = useMemo(() => termsSignature(terms), [terms])
  const syncAtoms = useMemo(
    () => buildReactorPreviewAtoms(terms, { tier: 'full' }),
    [termsSig, terms],
  )

  const shellRef = useRef<readonly ReactorPreviewAtom[]>(syncAtoms)
  const genRef = useRef(0)
  const [atoms, setAtoms] = useState<readonly ReactorPreviewAtom[]>(syncAtoms)

  if (syncAtoms.length > 0) {
    shellRef.current = syncAtoms
  }

  useLayoutEffect(() => {
    genRef.current += 1
    const gen = genRef.current

    if (syncAtoms.length > 0) {
      shellRef.current = syncAtoms
      setAtoms(syncAtoms)
    }

    let cancelled = false
    let timer: number | null = null

    const runWorker = () => {
      void requestPreviewLayout(terms, { coeffEditBurst }).then((result) => {
        if (cancelled || gen !== genRef.current) return
        if (result.atoms.length > 0) {
          shellRef.current = result.atoms
          setAtoms(result.atoms)
        }
      })
    }

    const debounceMs = coeffEditBurst ? 40 : 0
    if (debounceMs > 0) timer = window.setTimeout(runWorker, debounceMs)
    else runWorker()

    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [termsSig, terms, coeffEditBurst, syncAtoms])

  if (atoms.length > 0) return atoms
  if (shellRef.current.length > 0) return shellRef.current
  return atoms
}
