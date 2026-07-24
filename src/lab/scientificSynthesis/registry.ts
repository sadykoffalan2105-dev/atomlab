import type { ComponentType } from 'react'
import { Clo2ScientificSynthesisFx } from '../../components/lab/scientific/Clo2ScientificSynthesisFx'
import type { ScientificSynthesisFxProps } from './types'

export type { ScientificSynthesisFxProps } from './types'

const REGISTRY: Record<string, ComponentType<ScientificSynthesisFxProps>> = {
  clo2: Clo2ScientificSynthesisFx,
}

/** Научно-точный микромир по id продукта; иначе null → обычный ElementsCollapseFx. */
export function getScientificSynthesisFx(
  productId: string | undefined | null,
): ComponentType<ScientificSynthesisFxProps> | null {
  if (!productId) return null
  return REGISTRY[productId] ?? null
}

export function hasScientificSynthesisFx(productId: string | undefined | null): boolean {
  return Boolean(productId && REGISTRY[productId])
}
