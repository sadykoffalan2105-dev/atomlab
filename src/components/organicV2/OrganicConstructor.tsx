/**
 * Органика v2 — Конструктор (рисуешь скелет — H, название, 3D считает движок).
 * ЗАГОТОВКА: контракт props — ./contracts.ts; реализацию делает агент этапа 2 (docs/plans/organic-v2.md).
 */
import type { OrganicConstructorProps } from './contracts'

export function OrganicConstructor(props: OrganicConstructorProps) {
  return <div className={props.className} data-ov2-stub="OrganicConstructor" />
}
