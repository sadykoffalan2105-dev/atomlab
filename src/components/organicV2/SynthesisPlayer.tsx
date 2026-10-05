/**
 * Органика v2 — проигрыватель синтеза/реакции по атомному соответствию.
 * ЗАГОТОВКА: контракт props — ./contracts.ts; реализацию делает агент этапа 2 (docs/plans/organic-v2.md).
 */
import type { SynthesisPlayerProps } from './contracts'

export function SynthesisPlayer(props: SynthesisPlayerProps) {
  return <div className={props.className} data-ov2-stub="SynthesisPlayer" />
}
