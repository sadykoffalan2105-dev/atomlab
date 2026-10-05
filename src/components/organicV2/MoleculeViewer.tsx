/**
 * Органика v2 — просмотрщик режима «Молекула».
 * ЗАГОТОВКА: контракт props — ./contracts.ts; реализацию делает агент этапа 2 (docs/plans/organic-v2.md).
 */
import type { MoleculeViewerProps } from './contracts'

export function MoleculeViewer(props: MoleculeViewerProps) {
  return <div className={props.className} data-ov2-stub="MoleculeViewer" />
}
